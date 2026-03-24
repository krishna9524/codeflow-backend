import api from './api';

// Login
export const login = (credentials) => {
    return api.post('/users/login', credentials);
};

// Register
export const register = (userData) => {
    return api.post('/users/register', userData);
};

// Get Profile
export const getUserProfile = () => {
    return api.get('/users/profile');
};

// Update Profile
export const updateUserProfile = (data) => {
    return api.put('/users/profile', data);
};

// --- THIS IS THE CRITICAL FUNCTION ---
export const getDashboardStats = () => {
    return api.get('/users/dashboard/stats');
};