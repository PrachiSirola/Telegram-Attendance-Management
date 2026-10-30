import axios, { AxiosError } from 'axios';
import { store } from '../redux/store';
import { setCredentials, logout } from '../redux/slices/authSlice';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const { accessToken, orgOverride, admin } = store.getState().auth;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (orgOverride?.id && admin?.role === 'super_admin') {
    config.headers['X-Org-Override'] = orgOverride.id;
  }
  return config;
});
const BATCH_WINDOW_MS = 12;
const BATCHABLE = [
  /^\/employees(\/[a-f0-9]{24}(\/summary)?|\/stats)?$/i,
  /^\/attendance(\/counts|\/today\/[a-f0-9]{24})?$/i,
  /^\/activities(\/counts)?$/i,
  /^\/leaves(\/counts)?$/i,
  /^\/dashboard\/(summary|details\/[a-z_]+)$/i,
  /^\/notifications$/i,
  /^\/reports\/summary$/i,
  /^\/off-days$/i,
  /^\/organizations(\/timezones|\/current|\/[a-f0-9]{24}\/admins)?$/i,
];
const httpAdapter = axios.getAdapter(api.defaults.adapter);
let queue = [];
let flushTimer = null;
const inflight = new Map();

function pathOf(config) {
  const full = api.getUri(config); // baseURL + url + serialized params
  return full.startsWith('/api/v1') ? full.slice('/api/v1'.length) : null;
}

function batchable(config, path) {
  if (!path || (config.method || 'get').toLowerCase() !== 'get') return false;
  if (config.responseType && config.responseType !== 'json') return false;
  if (config.signal || config.skipBatch) return false;
  return BATCHABLE.some((re) => re.test(path.split('?')[0]));
}

const respond = (config, status, data) => ({ data, status, statusText: '', headers: {}, config, request: {} });

function fail(config, status, data, message) {
  const response = respond(config, status, data);
  return new AxiosError(
    message || `Request failed with status code ${status}`,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    response
  );
}

async function flush() {
  flushTimer = null;
  const items = queue;
  queue = [];
  const groups = new Map();
  items.forEach((it) => {
    const key = `${it.config.headers?.Authorization || ''}|${it.config.headers?.['X-Org-Override'] || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });
  await Promise.all(
    [...groups.values()].map(async (group) => {
      if (group.length === 1) {
        const [it] = group;
        httpAdapter(it.config).then(it.resolve, it.reject);
        return;
      }
      const headers = {};
      const sample = group[0].config.headers;
      if (sample?.Authorization) headers.Authorization = sample.Authorization;
      if (sample?.['X-Org-Override']) headers['X-Org-Override'] = sample['X-Org-Override'];
      try {
        const res = await axios.post('/api/v1/batch', { requests: group.map((g) => g.path) }, { headers });
        const results = res.data?.data || [];
        group.forEach((g, i) => {
          const r = results[i];
          if (r && r.status >= 200 && r.status < 300) g.resolve(respond(g.config, r.status, r.body));
          else g.reject(fail(g.config, r?.status || 500, r?.body, r?.body?.message));
        });
      } catch (err) {
        const status = err.response?.status;
        group.forEach((g) =>
          g.reject(status ? fail(g.config, status, err.response.data, err.response.data?.message) : err)
        );
      }
    })
  );
}

api.defaults.adapter = (config) => {
  const path = pathOf(config);
  if (!batchable(config, path)) return httpAdapter(config);
  const key = `${config.headers?.Authorization || ''}|${config.headers?.['X-Org-Override'] || ''}|${path}`;
  const pending = inflight.get(key);
  if (pending) return pending.then((r) => ({ ...r, config }));
  const p = new Promise((resolve, reject) => {
    queue.push({ config, path, resolve, reject });
    if (!flushTimer) flushTimer = setTimeout(flush, BATCH_WINDOW_MS);
  });
  inflight.set(key, p);
  const clear = () => inflight.delete(key);
  p.then(clear, clear);
  return p;
};

let refreshPromise = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        store.dispatch(logout());
        return Promise.reject(error);
      }
      try {
        refreshPromise =
          refreshPromise ||
          axios.post('/api/v1/auth/refresh', { refreshToken }).then((res) => {
            const accessToken = res.data.data.accessToken;
            store.dispatch(
              setCredentials({
                accessToken,
                refreshToken,
                admin: store.getState().auth.admin,
                organization: store.getState().auth.organization,
              })
            );
            return accessToken;
          });
        const accessToken = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        refreshPromise = null;
        store.dispatch(logout());
      }
    }
    return Promise.reject(error);
  }
);

export default api;