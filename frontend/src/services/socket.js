import { io } from 'socket.io-client';
import { store } from '../redux/store';
import { pushLiveEvent } from '../redux/slices/liveSlice';

let socket = null;

export function connectSocket() {
  const token = store.getState().auth.accessToken;
  if (!token) return null;
  if (socket) return socket;

  socket = io({
    path: '/socket.io',
    auth: (cb) => cb({ token: store.getState().auth.accessToken }),
    transports: ['websocket', 'polling'],
  });

  socket.on('activity:new', (payload) => {
    store.dispatch(pushLiveEvent({ kind: 'activity', payload }));
  });
  socket.on('attendance:updated', (payload) => {
    store.dispatch(pushLiveEvent({ kind: 'attendance', payload }));
  });
  socket.on('leave:updated', (payload) => {
    store.dispatch(pushLiveEvent({ kind: 'leave', payload }));
  });
  socket.on('notification:new', (payload) => {
    store.dispatch(pushLiveEvent({ kind: 'notification', payload }));
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}