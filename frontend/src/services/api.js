import axios from 'axios';

const TOKEN_KEY = 'lms_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Lets AuthContext react to an expired or revoked session anywhere in the app.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/login') || err.config?.url?.startsWith('/auth/register');
    if (err.response?.status === 401 && !isAuthCall) onUnauthorized();
    return Promise.reject(err);
  }
);

export const errorMessage = (err) =>
  err.response?.data?.details?.map((d) => d.message).join('. ')
  || err.response?.data?.message
  || (err.request ? 'Cannot reach the server. Check your connection and try again.' : 'Something went wrong.');

export default api;

// Uploaded images and lesson files are served by the API; prefix with its origin when it differs from the web app's.
export const assetUrl = (path) => (path && path.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${path}` : path);
