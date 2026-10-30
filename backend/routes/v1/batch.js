const qs = require('qs');
const MAX_REQUESTS = 25;
const ALLOWED = [
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

function fakeResponse(finish) {
  let done = false;
  const out = {
    statusCode: 200,
    headersSent: false,
    locals: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set: () => out,
    header: () => out,
    type: () => out,
    setHeader: () => out,
    getHeader: () => undefined,
    on: () => out,
    once: () => out,
    json(body) {
      if (!done) {
        done = true;
        finish({ status: this.statusCode, body });
      }
      return this;
    },
    send(body) {
      return this.json(body);
    },
    end() {
      return this.json(null);
    },
  };
  return out;
}

function runOne(parentReq, router, rawUrl) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(String(rawUrl), 'http://batch.local');
    } catch {
      return resolve({ status: 400, body: { success: false, message: 'Bad batch request' } });
    }
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (!ALLOWED.some((re) => re.test(path))) {
      return resolve({ status: 400, body: { success: false, message: `Not allowed in a batch: ${path}` } });
    }
    const req = Object.create(parentReq);
    req.method = 'GET';
    req.url = path + u.search;
    req.originalUrl = `/api/v1${path}${u.search}`;
    req.baseUrl = '';
    req.params = {};
    req.body = {};
    req.query = qs.parse(u.search.slice(1));

    const res = fakeResponse(resolve);
    router(req, res, (err) => {
      if (err) {
        const status = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
        resolve({ status, body: { success: false, message: err.message || 'Server error' } });
      } else {
        resolve({ status: 404, body: { success: false, message: `Not Found: ${path}` } });
      }
    });
  });
}

function createBatchHandler(router) {
  return async function batch(req, res, next) {
    try {
      const list = Array.isArray(req.body?.requests) ? req.body.requests : null;
      if (!list || list.length === 0 || list.length > MAX_REQUESTS) {
        res.status(400);
        throw new Error(`requests must be a list of 1-${MAX_REQUESTS} paths`);
      }
      const results = await Promise.all(list.map((url) => runOne(req, router, url)));
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { createBatchHandler };