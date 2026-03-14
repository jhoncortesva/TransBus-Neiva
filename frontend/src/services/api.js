import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ IMPORTANT: Change this to your machine's local IP address
// Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find your IP
// Example: 'http://192.168.1.100:3000'
const BASE_URL = 'http://192.168.100.137:3000'; // <-- CHANGE THIS

const getHeaders = async (isFormData = false) => {
  const token = await AsyncStorage.getItem('token');
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data;
};

export const authAPI = {
  login: async (username, password) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, password }),
    });
    return handleResponse(response);
  },

  register: async (userData) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  getProfile: async () => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/auth/profile`, { headers });
    return handleResponse(response);
  },
};

export const driversAPI = {
  create: async (formData) => {
    const headers = await getHeaders(true);
    const response = await fetch(`${BASE_URL}/api/drivers`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(response);
  },

  getAll: async () => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/drivers`, { headers });
    return handleResponse(response);
  },

  toggleStatus: async (id) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/drivers/${id}/toggle-status`, {
      method: 'PATCH',
      headers,
    });
    return handleResponse(response);
  },
};

export { BASE_URL };
