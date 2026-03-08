import api from './client';

export const extensionApi = {
  getAbsenceData: () => api.get('/extension/absence'),
};
