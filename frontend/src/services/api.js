import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://coomotortrans-production.up.railway.app';

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

  savePushSub: async ({ push_token, route_name, latitude, longitude }) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/auth/push-sub`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ push_token, route_name, latitude, longitude }),
    });
    return handleResponse(response);
  },

  removePushSub: async (route_name) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/auth/push-sub`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ route_name }),
    });
    return handleResponse(response);
  },

  changePassword: async (currentPassword, newPassword) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handleResponse(response);
  },

  updatePhoto: async (photo) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/auth/update-photo`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ photo }),
    });
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

  update: async (id, data) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/drivers/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
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

export const routesAPI = {
  getAll: async () => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/routes`, { headers });
    return handleResponse(response);
  },

  getById: async (id) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/routes/${id}`, { headers });
    return handleResponse(response);
  },

  create: async (data) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/routes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (id, data) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/routes/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/api/routes/${id}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(response);
  },
};

export { BASE_URL };
