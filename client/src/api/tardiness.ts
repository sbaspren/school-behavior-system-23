import api from './client';

export interface TardinessData {
  studentId: number;
  tardinessType?: string;
  period?: string;
  hijriDate?: string;
  recordedBy?: string;
}

export interface TardinessFilters {
  stage?: string;
  grade?: string;
  className?: string;
  studentId?: number;
  hijriDate?: string;
  dateFrom?: string;
  dateTo?: string;
  tardinessType?: string;
  isSent?: boolean;
  search?: string;
}

export const tardinessApi = {
  getAll: (filters?: TardinessFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.className) params.set('className', filters.className);
      if (filters.studentId) params.set('studentId', filters.studentId.toString());
      if (filters.hijriDate) params.set('hijriDate', filters.hijriDate);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.tardinessType) params.set('tardinessType', filters.tardinessType);
      if (filters.isSent !== undefined) params.set('isSent', filters.isSent.toString());
      if (filters.search) params.set('search', filters.search);
    }
    return api.get(`/tardiness?${params.toString()}`);
  },

  getDailyStats: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/tardiness/daily-stats?${params.toString()}`);
  },

  add: (data: TardinessData) => api.post('/tardiness', data),

  addBatch: (studentIds: number[], tardinessType?: string, period?: string, hijriDate?: string, recordedBy?: string) =>
    api.post('/tardiness/batch', { studentIds, tardinessType, period, hijriDate, recordedBy }),

  delete: (id: number) => api.delete(`/tardiness/${id}`),
  deleteBulk: (ids: number[]) => api.post('/tardiness/delete-bulk', { ids }),

  updateSent: (id: number, isSent: boolean) => api.put(`/tardiness/${id}/sent`, { isSent }),
  updateSentBatch: (ids: number[]) => api.put('/tardiness/sent-batch', { ids }),

  sendWhatsApp: (id: number, data?: { senderPhone?: string; message?: string; sentBy?: string }) =>
    api.post(`/tardiness/${id}/send-whatsapp`, data || {}),

  sendWhatsAppBulk: (ids: number[], senderPhone?: string, sentBy?: string) =>
    api.post('/tardiness/send-whatsapp-bulk', { ids, senderPhone, sentBy }),

  getStudentCount: (studentId: number) => api.get(`/tardiness/student-count/${studentId}`),

  getReport: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/tardiness/report?${params.toString()}`);
  },

  exportCsv: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/tardiness/export?${params.toString()}`, { responseType: 'blob' });
  },
};
