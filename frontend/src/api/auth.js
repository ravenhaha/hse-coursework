import { api } from './client';

export const authApi = {
    register: (username, email, password) =>
        api.post('/auth/register', { username, email, password }),

    login: (username, password) => {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        return api.postForm('/auth/token', formData);
    },

    logout: () => api.post('/auth/logout'),

    getMe: () => api.get('/auth/me'),
};