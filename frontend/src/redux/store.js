import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import liveReducer from './slices/liveSlice';
import tzReducer from './slices/tzSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    live: liveReducer,
    tz: tzReducer,
  },
});
