import { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    const u = res.user || res;
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (email, password) => {
    await authApi.register(email, password);
    const res = await authApi.login(email, password);
    const u = res.user || res;
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally { setUser(null); }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}