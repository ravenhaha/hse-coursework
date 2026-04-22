import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { authApi } from '../api/auth';

export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // При старте — проверяем, валидна ли сессия (по httpOnly cookie)
    useEffect(() => {
        let cancelled = false;
        authApi.getMe()
            .then((me) => { if (!cancelled) setUser(me); })
            .catch(() => { if (!cancelled) setUser(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const login = useCallback(async (username, password) => {
        await authApi.login(username, password); // бэк ставит cookie
        const me = await authApi.getMe();
        setUser(me);
        return me;
    }, []);

    const register = useCallback(async (username, email, password) => {
        await authApi.register(username, email, password);
        return login(username, password); // сразу логиним
    }, [login]);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // даже если бэк ответил ошибкой — чистим локальный стейт
        }
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}