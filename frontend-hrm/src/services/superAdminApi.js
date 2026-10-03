import api from '../utils/axios';

const saApi = {
  get: (url, config = {}) => api.get(`/superadmin${url}`, config),
  post: (url, data = {}, config = {}) => api.post(`/superadmin${url}`, data, config),
  put: (url, data = {}, config = {}) => api.put(`/superadmin${url}`, data, config),
  delete: (url, config = {}) => api.delete(`/superadmin${url}`, config),
  patch: (url, data = {}, config = {}) => api.patch(`/superadmin${url}`, data, config),
};

export default saApi;
