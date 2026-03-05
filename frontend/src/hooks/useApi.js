import { useState, useCallback } from 'react';

const API_URL = 'http://localhost:5000/api';

export function useApi() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const request = useCallback(async (endpoint, options = {}) => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');

            const res = await fetch(`${API_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                    ...options.headers,
                },
                ...options,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            const data = await res.json();

            if (!res.ok) {
                throw { message: data.message, code: data.code, status: res.status };
            }

            return data;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const get = useCallback((endpoint) => request(endpoint), [request]);
    const post = useCallback((endpoint, body) => request(endpoint, { method: 'POST', body }), [request]);
    const put = useCallback((endpoint, body) => request(endpoint, { method: 'PUT', body }), [request]);
    const del = useCallback((endpoint) => request(endpoint, { method: 'DELETE' }), [request]);

    return { get, post, put, del, loading, error };
}