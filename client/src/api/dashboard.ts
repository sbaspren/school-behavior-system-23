import api from './client';

export const dashboardApi = {
  get: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/dashboard?${params.toString()}`);
  },

  getCalendar: () => api.get('/dashboard/calendar'),
};
