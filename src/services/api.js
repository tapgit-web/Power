// API Service for Custom Backend (Node.js + Express + MongoDB Atlas)
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const TOKEN_KEY = 'power_monitor_jwt_token';

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

const request = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const api = {
  // Auth
  login: async (email, password) => {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.success && result.data?.token) {
      setAuthToken(result.data.token);
    }
    return result;
  },

  getMe: async () => request('/api/auth/me'),

  logout: () => {
    setAuthToken(null);
  },

  // User Management (Admin)
  listUsers: async () => request('/api/admin/users'),

  createUser: async ({ email, password, role, assignedMachines, allMachines }) =>
    request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, role, assignedMachines, allMachines }),
    }),

  updateUser: async (id, { role, assignedMachines, allMachines }) =>
    request(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ role, assignedMachines, allMachines }),
    }),

  deleteUser: async (id) =>
    request(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),

  // Machine Management
  listMachines: async () => request('/api/machines'),

  getMachine: async (machineId) => request(`/api/machines/${machineId}`),

  createMachine: async ({ machineId, displayName, category, deviceId }) =>
    request('/api/machines', {
      method: 'POST',
      body: JSON.stringify({ machineId, displayName, category, deviceId }),
    }),

  deleteMachine: async (machineId) =>
    request(`/api/machines/${machineId}`, {
      method: 'DELETE',
    }),

  updateCustomLabels: async (machineId, customLabels) =>
    request(`/api/machines/${machineId}/labels`, {
      method: 'PUT',
      body: JSON.stringify({ customLabels }),
    }),

  // Logging Controls
  toggleMachineLogging: async (machineId, isLoggingEnabled, loggingIntervalSec) =>
    request(`/api/machines/${machineId}/logging`, {
      method: 'PUT',
      body: JSON.stringify({ isLoggingEnabled, loggingIntervalSec }),
    }),

  getSystemSettings: async () => request('/api/machines/config/settings'),

  updateSystemSettings: async (settings) =>
    request('/api/machines/config/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Modbus Write Control
  dispatchModbusWrite: async (machineId, { startingRegAddr, data, requestType, writeList }) =>
    request(`/api/machines/${machineId}/write`, {
      method: 'POST',
      body: JSON.stringify({ startingRegAddr, data, requestType, writeList }),
    }),

  // Logs & CSV
  getLogs: async (machineId, from, to, limit) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (limit) params.append('limit', limit);
    return request(`/api/machines/${machineId}/logs?${params.toString()}`);
  },

  getExportLogsUrl: (machineId, from, to) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return `${BACKEND_URL}/api/machines/${machineId}/logs/export?${params.toString()}`;
  },
};

export default api;
