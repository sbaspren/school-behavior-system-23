import api from './client';

export const templatesApi = {
  getAll: () => api.get('/templates'),
  getByType: (type: string) => api.get(`/templates/${type}`),
  save: (type: string, message: string) => api.post('/templates', { type, message }),
  delete: (type: string) => api.delete(`/templates/${type}`),
};
