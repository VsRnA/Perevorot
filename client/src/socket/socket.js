import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  if (socket?.connected) return socket;
  // Корректно закрываем старый сокет перед созданием нового
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io({ auth: { token } });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
