import { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import { setSessionExpiredHandler } from '../api/client'; // 🆕

export const AuthContext = createContext(null);

function normalizeUser(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email || '',
    name: raw.display_name || raw.email || 'Пользователь',
    avatar: raw.avatar_url || null,
    isActive: raw.is_active ?? true,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false); // 🆕 для тоста

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      const u = normalizeUser(data);
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  // 🆕 Регистрируем глобальный обработчик "сессия умерла"
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setSessionExpired(true); // покажем тост
      // НЕ редиректим тут — ProtectedRoute сам уведёт на /login,
      // потому что user стал null.
    });
    // Снимаем обработчик при размонтировании (на всякий)
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    const u = normalizeUser(res.user);
    setUser(u);
    setSessionExpired(false); // 🆕 успешный логин — гасим флаг
    return u;
  }, []);

  const register = useCallback(async (email, password) => {
    const res = await authApi.register(email, password);
    const u = normalizeUser(res.user);
    setUser(u);
    setSessionExpired(false); // 🆕
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setSessionExpired(false); // 🆕 обычный logout — не тост
    }
  }, []);

  const patchUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // 🆕 функция для UI чтобы скрыть тост вручную
  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        patchUser,
        setUser,
        sessionExpired,            // 🆕
        dismissSessionExpired,     // 🆕
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}