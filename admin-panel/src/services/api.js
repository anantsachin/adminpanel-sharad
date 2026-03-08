import axios from 'axios';

const API_BASE = 'https://adminpanel-sharad.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('dm_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('dm_token');
            localStorage.removeItem('dm_admin');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (email, password) => api.post('/auth/register', { email, password });

// Dashboard
export const getDashboard = () => api.get('/dashboard');

// Devices
export const getDevices = () => api.get('/devices');
export const getDevice = (id) => api.get(`/devices/${id}`);
export const deleteDevice = (id) => api.delete(`/devices/${id}`);
export const getDeviceStats = (id) => api.get(`/devices/${id}/stats`);

// Photos
export const getPhotos = (params) => api.get('/photos', { params });
export const deletePhoto = (id) => api.delete(`/photos/${id}`);

// Messages
export const getMessages = (params) => api.get('/messages', { params });
export const getConversations = (deviceId) => api.get(`/messages/conversations/${deviceId}`);
export const getThread = (params) => api.get('/messages/thread', { params });
export const deleteMessage = (id) => api.delete(`/messages/${id}`);

// Commands
export const sendCommand = (deviceId, command, params = {}) =>
    api.post(`/commands/${deviceId}`, { command, params });

// SMS
export const sendSMS = (deviceId, to, message) =>
    api.post('/messages/send', { deviceId, to, message });

export default api;
