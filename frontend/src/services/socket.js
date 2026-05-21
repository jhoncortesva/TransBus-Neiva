import { io } from 'socket.io-client';
import { BASE_URL } from './api';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(BASE_URL, {
      transports: ['websocket'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
