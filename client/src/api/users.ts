import api from './client';

export interface UserData {
  name: string;
  role?: string;
  mobile?: string;
  email?: string;
  password?: string;
  permissions?: string;
  scopeType?: string;
  scopeValue?: string;
}

export const usersApi = {
  getAll: () => api.get('/users'),
  add: (data: UserData) => api.post('/users', data),
  update: (id: number, data: UserData) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  createLink: (id: number) => api.post(`/users/${id}/create-link`),
  removeLink: (id: number) => api.post(`/users/${id}/remove-link`),
  createAllLinks: () => api.post('/users/create-all-links'),
};
