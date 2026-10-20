import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setUnauthorizedHandler, tokenStore } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const clearSession = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    if (!tokenStore.get()) return;
    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(clearSession)
      .finally(() => setLoading(false));
  }, [clearSession]);

  const startSession = ({ token, user: u }) => { tokenStore.set(token); setUser(u); return u; };

  const value = useMemo(() => ({
    user,
    loading,
    login: async (email, password) => startSession((await api.post('/auth/login', { email, password })).data),
    register: async (payload) => startSession((await api.post('/auth/register', payload)).data),
    setUser, // lets Settings update the signed-in user after a change
    replaceToken: (token) => tokenStore.set(token),
    logout: async () => {
      try { await api.post('/auth/logout'); } catch { /* token may already be invalid */ }
      clearSession();
    },
  }), [user, loading, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
