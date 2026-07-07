import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor: attach JWT token ─────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor: handle 401 + token refresh ──────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const newToken = data.data.accessToken;

        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const accountsAPI = {
  getAll: () => api.get('/accounts'),
  getById: (id) => api.get(`/accounts/${id}`),
  create: (data) => api.post('/accounts', data),
  deposit: (id, data) => api.post(`/accounts/${id}/deposit`, data),
  withdraw: (id, data) => api.post(`/accounts/${id}/withdraw`, data),
};

export const transactionsAPI = {
  transfer: (data) => api.post('/transactions/transfer', data),
  getAll: (params) => api.get('/transactions', { params }),
  getByAccount: (id, params) => api.get(`/transactions/account/${id}`, { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  getFraudExplanation: (id) => api.get(`/transactions/${id}/fraud-explanation`),
  askFraudQuestion: (id, question) => api.post(`/transactions/${id}/fraud-explanation/ask`, { question }),
};

export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getSpending: (months = 6) => api.get('/analytics/spending', { params: { months } }),
  getTrends: (days = 30) => api.get('/analytics/trends', { params: { days } }),
  getRecipients: (limit = 5) => api.get('/analytics/recipients', { params: { limit } }),
};

export const fraudAPI = {
  getFlags: (params) => api.get('/fraud/flags', { params }),
  getFlag: (id) => api.get(`/fraud/flags/${id}`),
  resolve: (id, note) => api.patch(`/fraud/flags/${id}/resolve`, { note }),
};

export default api;
