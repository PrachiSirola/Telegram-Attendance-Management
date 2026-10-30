import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  events: [],
};

const liveSlice = createSlice({
  name: 'live',
  initialState,
  reducers: {
    pushLiveEvent(state, action) {
      state.events.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date().toISOString(),
        ...action.payload,
      });
      state.events = state.events.slice(0, 100);
    },
    clearLive(state) {
      state.events = [];
    },
  },
});

export const { pushLiveEvent, clearLive } = liveSlice.actions;
export default liveSlice.reducer;
