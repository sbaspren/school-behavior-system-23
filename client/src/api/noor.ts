import api from './client';

export interface NoorStatusUpdate {
  id: number;
  type: string; // violation, tardiness, compensation, excellent, absence
  status: string; // تم or failed
}

export const noorApi = {
  getPendingRecords: (stage?: string, type?: string, filterMode?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (type) params.set('type', type);
    if (filterMode) params.set('filterMode', filterMode);
    return api.get(`/noor/pending-records?${params.toString()}`);
  },
  getStats: (stage?: string, filterMode?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (filterMode) params.set('filterMode', filterMode);
    return api.get(`/noor/stats?${params.toString()}`);
  },
  updateStatus: (updates: NoorStatusUpdate[]) =>
    api.post('/noor/update-status', { updates }),
  getMappings: () => api.get('/noor/mappings'),
};
