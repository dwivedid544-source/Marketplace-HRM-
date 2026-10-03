import api from '../utils/axios';

const faceService = {
    // Admin only: Register a new face for an employee
    registerFace: async (employee_id, descriptor) => {
        const response = await api.post('/face/register', { employee_id, descriptor });
        return response.data;
    },

    // Employee: Get today's attendance status
    getTodayStatus: async () => {
        const response = await api.get('/face/today-status');
        return response.data;
    },

    // Employee: Verify face and check-in
    checkIn: async (descriptor, livenessData = {}, latitude, longitude) => {
        const response = await api.post('/face/check-in', { descriptor, ...livenessData, latitude, longitude });
        return response.data;
    },

    // Employee: Verify face and check-out
    checkOut: async (descriptor, livenessData = {}, latitude, longitude) => {
        const response = await api.post('/face/check-out', { descriptor, ...livenessData, latitude, longitude });
        return response.data;
    },

    // Check if an employee already has a face registered
    checkStatus: async (employee_id) => {
        const response = await api.get(`/face/status/${employee_id}`);
        return response.data;
    },

    // Unlock / Delete face embedding for an employee
    deleteFace: async (employee_id) => {
        const response = await api.delete(`/face/delete/${employee_id}`);
        return response.data;
    }
};

export default faceService;
