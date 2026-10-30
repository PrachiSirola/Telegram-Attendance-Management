import { createSlice } from '@reduxjs/toolkit';

const load = () => ({
  admin: JSON.parse(localStorage.getItem('admin') || 'null'),
  organization: JSON.parse(localStorage.getItem('organization') || 'null'),
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  orgOverride: JSON.parse(localStorage.getItem('orgOverride') || 'null'),
});

const initialState = {
  ...load(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { admin, organization, accessToken, refreshToken } = action.payload;
      state.admin = admin;
      state.organization = organization ?? null;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      if (admin) localStorage.setItem('admin', JSON.stringify(admin));
      else localStorage.removeItem('admin');
      if (organization) localStorage.setItem('organization', JSON.stringify(organization));
      else localStorage.removeItem('organization');
      if (accessToken) localStorage.setItem('accessToken', accessToken);
      else localStorage.removeItem('accessToken');
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      else localStorage.removeItem('refreshToken');
      if (admin?.role === 'super_admin' && !organization) {
        const allCompanies = { id: 'ALL', name: 'All Companies', slug: null, active: true, allOrgs: true };
        state.orgOverride = allCompanies;
        localStorage.setItem('orgOverride', JSON.stringify(allCompanies));
      } else {
        state.orgOverride = null;
        localStorage.removeItem('orgOverride');
      }
    },
    logout(state) {
      state.admin = null;
      state.organization = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.orgOverride = null;
      localStorage.removeItem('admin');
      localStorage.removeItem('organization');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('orgOverride');
    },
    setOrgOverride(state, action) {
      state.orgOverride = action.payload;
      localStorage.setItem('orgOverride', JSON.stringify(action.payload));
    },
    clearOrgOverride(state) {
      state.orgOverride = null;
      localStorage.removeItem('orgOverride');
    },
  },
});

export const { setCredentials, logout, setOrgOverride, clearOrgOverride } = authSlice.actions;
export default authSlice.reducer;