import { io } from 'socket.io-client';
import { getAuthToken } from './api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

let socket = null;
const listeners = new Map(); // machineId -> Set of callback functions

export const getSocket = () => {
  if (!socket) {
    const token = getAuthToken();

    socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('⚡ [Socket.IO] Connected to backend server:', socket.id);

      // Re-join active machine rooms on reconnect
      listeners.forEach((_, machineId) => {
        socket.emit('join_machine', machineId);
      });
    });

    socket.on('telemetry_update', (data) => {
      if (!data || !data.machineId) return;
      const cbs = listeners.get(data.machineId);
      if (cbs) {
        cbs.forEach((cb) => cb(data));
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.IO] Disconnected:', reason);
    });

    socket.on('error_message', (err) => {
      console.error('❌ [Socket.IO] Server error:', err);
    });
  }

  return socket;
};

// Subscribe a callback to live telemetry for a specific machineId
export const subscribeToMachine = (machineId, callback) => {
  if (!machineId || typeof callback !== 'function') return () => {};

  const cleanId = String(machineId).trim();
  const s = getSocket();

  if (!listeners.has(cleanId)) {
    listeners.set(cleanId, new Set());
    if (s.connected) {
      s.emit('join_machine', cleanId);
    }
  }

  listeners.get(cleanId).add(callback);

  // Return unsubscription function
  return () => {
    const set = listeners.get(cleanId);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        listeners.delete(cleanId);
        if (s.connected) {
          s.emit('leave_machine', cleanId);
        }
      }
    }
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
  }
};

export default {
  getSocket,
  subscribeToMachine,
  disconnectSocket,
};
