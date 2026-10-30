import { createSlice } from '@reduxjs/toolkit';
const tzSlice = createSlice({
  name: 'tz',
  initialState: { byId: {} },
  reducers: {
    setOrgTimezones(state, action) {
      const map = {};
      (action.payload || []).forEach((o) => {
        map[String(o.id || o._id)] = o.timezone;
      });
      state.byId = map;
    },
  },
});

export const { setOrgTimezones } = tzSlice.actions;
export default tzSlice.reducer;
