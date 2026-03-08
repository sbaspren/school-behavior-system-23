import api from './client';

export const authApi = {
  login: (mobile: string, password: string) =>
    api.post('/auth/login', { mobile, password }),
  validateToken: (tokenLink: string) =>
    api.get(`/auth/token/${tokenLink}`),
};
