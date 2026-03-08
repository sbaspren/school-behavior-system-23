import api from './client';

export interface AbsenceData {
  studentId: number;
  absenceType?: string;
  period?: string;
  hijriDate?: string;
  dayName?: string;
  recordedBy?: string;
  notes?: string;
}

export interface AbsenceUpdateData {
  status?: string;
  excuseType?: string;
  notes?: string;
  tardinessStatus?: string;
  arrivalTime?: string;
  noorStatus?: string;
}

export interface AbsenceFilters {
  stage?: string;
  grade?: string;
  className?: string;
  studentId?: number;
  hijriDate?: string;
  dateFrom?: string;
  dateTo?: string;
  excuseType?: string;
  isSent?: boolean;
  search?: string;
}

export const absenceApi = {
  getAll: (filters?: AbsenceFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.className) params.set('className', filters.className);
      if (filters.studentId) params.set('studentId', filters.studentId.toString());
      if (filters.hijriDate) params.set('hijriDate', filters.hijriDate);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.excuseType) params.set('excuseType', filters.excuseType);
      if (filters.isSent !== undefined) params.set('isSent', filters.isSent.toString());
      if (filters.search) params.set('search', filters.search);
    }
    return api.get(`/absence?${params.toString()}`);
  },

  getDailyStats: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/absence/daily-stats?${params.toString()}`);
  },

  add: (data: AbsenceData) => api.post('/absence', data),

  addBatch: (studentIds: number[], data?: { absenceType?: string; period?: string; hijriDate?: string; dayName?: string; recordedBy?: string; notes?: string }) =>
    api.post('/absence/batch', { studentIds, ...data }),

  update: (id: number, data: AbsenceUpdateData) => api.put(`/absence/${id}`, data),

  updateLateStatus: (id: number, status: string, arrivalTime?: string) =>
    api.put(`/absence/${id}/late-status`, { status, arrivalTime }),

  updateExcuseType: (id: number, excuseType: string) =>
    api.put(`/absence/${id}/excuse-type`, { excuseType }),

  updateSent: (id: number, isSent: boolean) => api.put(`/absence/${id}/sent`, { isSent }),
  updateSentBatch: (ids: number[]) => api.put('/absence/sent-batch', { ids }),

  sendWhatsApp: (id: number, data?: { senderPhone?: string; message?: string; sentBy?: string }) =>
    api.post(`/absence/${id}/send-whatsapp`, data || {}),

  sendWhatsAppBulk: (ids: number[], senderPhone?: string, sentBy?: string) =>
    api.post('/absence/send-whatsapp-bulk', { ids, senderPhone, sentBy }),

  delete: (id: number) => api.delete(`/absence/${id}`),
  deleteBulk: (ids: number[]) => api.post('/absence/delete-bulk', { ids }),

  getCumulative: (studentId: number) => api.get(`/absence/cumulative/${studentId}`),

  getAllCumulative: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/absence/cumulative?${params.toString()}`);
  },

  getStudentCount: (studentId: number) => api.get(`/absence/student-count/${studentId}`),

  getSummary: (stage?: string, hijriDate?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (hijriDate) params.set('hijriDate', hijriDate);
    return api.get(`/absence/summary?${params.toString()}`);
  },

  getReport: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/absence/report?${params.toString()}`);
  },

  exportCsv: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/absence/export?${params.toString()}`, { responseType: 'blob' });
  },

  importFromExcel: (students: { studentNumber?: string; name?: string; absenceType?: string }[], source: string, hijriDate?: string, dayName?: string) =>
    api.post('/absence/import', { students, source, hijriDate, dayName }),

  updateCumulative: (studentId: number, data: { excusedDays?: number; unexcusedDays?: number; lateDays?: number }) =>
    api.put(`/absence/cumulative/${studentId}`, data),

  importNoorCumulative: (rows: { name: string; late: number; unexcused: number; excused: number }[]) =>
    api.post('/absence/cumulative/import-noor', { rows }),

  getStatistics: (filters?: { stage?: string; grade?: string; className?: string; dateFrom?: string; dateTo?: string }) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.className) params.set('className', filters.className);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
    }
    return api.get(`/absence/statistics?${params.toString()}`);
  },
};
