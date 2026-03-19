import { io } from 'socket.io-client';
import { BASE_URL } from './api';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(BASE_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
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
