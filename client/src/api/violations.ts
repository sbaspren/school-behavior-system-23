import api from './client';

export interface ViolationData {
  studentId: number;
  violationCode?: string;
  description?: string;
  type?: string;
  degree: number;
  hijriDate?: string;
  miladiDate?: string;
  recordedBy?: string;
  notes?: string;
}

export interface RepetitionInfo {
  currentCount: number;
  nextRepetition: number;
  deduction: number;
  procedures: string[];
  previousProcedures: string[];
}

export interface ViolationFilters {
  stage?: string;
  grade?: string;
  className?: string;
  studentId?: number;
  degree?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  isSent?: boolean;
}

export const violationsApi = {
  getAll: (filters?: ViolationFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.className) params.set('className', filters.className);
      if (filters.studentId) params.set('studentId', filters.studentId.toString());
      if (filters.degree) params.set('degree', filters.degree.toString());
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.search) params.set('search', filters.search);
      if (filters.isSent !== undefined) params.set('isSent', filters.isSent.toString());
    }
    return api.get(`/violations?${params.toString()}`);
  },

  getDailyStats: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/violations/daily-stats?${params.toString()}`);
  },

  getRepetition: (studentId: number, degree: number, violationCode?: string) => {
    const params = new URLSearchParams({ studentId: studentId.toString(), degree: degree.toString() });
    if (violationCode) params.set('violationCode', violationCode);
    return api.get(`/violations/repetition?${params.toString()}`);
  },

  add: (data: ViolationData) => api.post('/violations', data),

  addBatch: (studentIds: number[], violationCode: string, data?: { type?: string; procedures?: string[]; forms?: string[]; recordedBy?: string }) =>
    api.post('/violations/batch', { studentIds, violationCode, ...data }),

  getCompensationEligible: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/violations/compensation-eligible?${params.toString()}`);
  },
  update: (id: number, data: Partial<ViolationData>) => api.put(`/violations/${id}`, data),
  delete: (id: number) => api.delete(`/violations/${id}`),
  deleteBulk: (ids: number[]) => api.post('/violations/delete-bulk', { ids }),

  updateSent: (id: number, isSent: boolean) => api.put(`/violations/${id}/sent`, { isSent }),
  updateSentBatch: (ids: number[]) => api.put('/violations/sent-batch', { ids }),

  sendWhatsApp: (id: number, data?: { senderPhone?: string; message?: string; sentBy?: string }) =>
    api.post(`/violations/${id}/send-whatsapp`, data || {}),

  sendWhatsAppBulk: (ids: number[], senderPhone?: string, sentBy?: string) =>
    api.post('/violations/send-whatsapp-bulk', { ids, senderPhone, sentBy }),

  getTypes: () => api.get('/violations/types'),
  getStudentSummary: (studentId: number) => api.get(`/violations/student-summary/${studentId}`),

  getReport: (stage?: string, grade?: string, className?: string, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (grade) params.set('grade', grade);
    if (className) params.set('className', className);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return api.get(`/violations/report?${params.toString()}`);
  },

  exportCsv: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/violations/export?${params.toString()}`, { responseType: 'blob' });
  },
};
