import api from './client';

export interface PermissionData {
  studentId: number;
  exitTime?: string;
  reason?: string;
  receiver?: string;
  supervisor?: string;
  hijriDate?: string;
  recordedBy?: string;
}

export interface PermissionFilters {
  stage?: string;
  grade?: string;
  className?: string;
  studentId?: number;
  hijriDate?: string;
  dateFrom?: string;
  dateTo?: string;
  isSent?: boolean;
  search?: string;
}

export const permissionsApi = {
  getAll: (filters?: PermissionFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.className) params.set('className', filters.className);
      if (filters.studentId) params.set('studentId', filters.studentId.toString());
      if (filters.hijriDate) params.set('hijriDate', filters.hijriDate);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.isSent !== undefined) params.set('isSent', filters.isSent.toString());
      if (filters.search) params.set('search', filters.search);
    }
    return api.get(`/permissions?${params.toString()}`);
  },

  getDailyStats: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/permissions/daily-stats?${params.toString()}`);
  },

  add: (data: PermissionData) => api.post('/permissions', data),

  addBatch: (studentIds: number[], data?: { exitTime?: string; reason?: string; receiver?: string; supervisor?: string; hijriDate?: string; recordedBy?: string }) =>
    api.post('/permissions/batch', { studentIds, ...data }),

  update: (id: number, data: Partial<PermissionData & { confirmationTime?: string }>) => api.put(`/permissions/${id}`, data),
  confirmExit: (id: number) => api.put(`/permissions/${id}/confirm`, {}),
  delete: (id: number) => api.delete(`/permissions/${id}`),
  deleteBulk: (ids: number[]) => api.post('/permissions/delete-bulk', { ids }),

  updateSent: (id: number, isSent: boolean) => api.put(`/permissions/${id}/sent`, { isSent }),
  updateSentBatch: (ids: number[]) => api.put('/permissions/sent-batch', { ids }),

  sendWhatsApp: (id: number, data?: { senderPhone?: string; message?: string; sentBy?: string }) =>
    api.post(`/permissions/${id}/send-whatsapp`, data || {}),

  sendWhatsAppBulk: (ids: number[], senderPhone?: string, sentBy?: string) =>
    api.post('/permissions/send-whatsapp-bulk', { ids, senderPhone, sentBy }),

  getStudentCount: (studentId: number) => api.get(`/permissions/student-count/${studentId}`),

  getReport: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/permissions/report?${params.toString()}`);
  },

  exportCsv: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/permissions/export?${params.toString()}`, { responseType: 'blob' });
  },
};
