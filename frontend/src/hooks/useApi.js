import { useState, useCallback, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function useApi() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const controllerRef = useRef(null);

    useEffect(() => {
        return () => controllerRef.current?.abort();
    }, []);

    const request = useCallback(async (endpoint, options = {}) => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');

            const res = await fetch(`${API_URL}${endpoint}`, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                    ...options.headers,
                },
                ...options,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            let data;
            try {
                data = await res.json();
            } catch {
                throw { message: 'Сервер вернул некорректный ответ', status: res.status };
            }

            if (!res.ok) {
                throw { message: data.message, code: data.code, status: res.status };
            }

            return data;
        } catch (err) {
            if (err.name === 'AbortError') return;
            setError(err);
            throw err;
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    const get = useCallback((endpoint) => request(endpoint), [request]);
    const post = useCallback((endpoint, body) => request(endpoint, { method: 'POST', body }), [request]);
    const put = useCallback((endpoint, body) => request(endpoint, { method: 'PUT', body }), [request]);
    const del = useCallback((endpoint) => request(endpoint, { method: 'DELETE' }), [request]);

    return { get, post, put, del, loading, error };
}
