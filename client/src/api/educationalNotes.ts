import api from './client';

export interface EducationalNoteData {
  studentId: number;
  noteType?: string;
  details?: string;
  teacherName?: string;
  hijriDate?: string;
}

export interface EduNoteFilters {
  stage?: string;
  grade?: string;
  className?: string;
  studentId?: number;
  noteType?: string;
  hijriDate?: string;
  isSent?: boolean;
  search?: string;
}

export const educationalNotesApi = {
  getAll: (filters?: EduNoteFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.className) params.set('className', filters.className);
      if (filters.studentId) params.set('studentId', filters.studentId.toString());
      if (filters.noteType) params.set('noteType', filters.noteType);
      if (filters.hijriDate) params.set('hijriDate', filters.hijriDate);
      if (filters.isSent !== undefined) params.set('isSent', filters.isSent.toString());
      if (filters.search) params.set('search', filters.search);
    }
    return api.get(`/educationalnotes?${params.toString()}`);
  },

  getDailyStats: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/educationalnotes/daily-stats?${params.toString()}`);
  },

  add: (data: EducationalNoteData) => api.post('/educationalnotes', data),

  addBatch: (studentIds: number[], data?: { noteType?: string; details?: string; teacherName?: string; hijriDate?: string }) =>
    api.post('/educationalnotes/batch', { studentIds, ...data }),

  update: (id: number, data: Partial<EducationalNoteData>) => api.put(`/educationalnotes/${id}`, data),

  updateSent: (id: number, isSent: boolean) => api.put(`/educationalnotes/${id}/sent`, { isSent }),
  updateSentBatch: (ids: number[]) => api.put('/educationalnotes/sent-batch', { ids }),
  updateSentByStudent: (studentId: number) => api.put(`/educationalnotes/sent-by-student/${studentId}`),

  sendWhatsApp: (id: number, data?: { senderPhone?: string; message?: string; sentBy?: string }) =>
    api.post(`/educationalnotes/${id}/send-whatsapp`, data || {}),

  sendWhatsAppBulk: (ids: number[], senderPhone?: string, sentBy?: string) =>
    api.post('/educationalnotes/send-whatsapp-bulk', { ids, senderPhone, sentBy }),

  delete: (id: number) => api.delete(`/educationalnotes/${id}`),
  deleteBulk: (ids: number[]) => api.post('/educationalnotes/delete-bulk', { ids }),

  getStudentSummary: (studentId: number) => api.get(`/educationalnotes/student-summary/${studentId}`),
  getStudentCount: (studentId: number) => api.get(`/educationalnotes/student-count/${studentId}`),

  getReport: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/educationalnotes/report?${params.toString()}`);
  },

  getTypes: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/educationalnotes/types?${params.toString()}`);
  },

  saveTypes: (stage: string, types: string[]) =>
    api.post('/educationalnotes/types', { stage, types }),

  exportCsv: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/educationalnotes/export?${params.toString()}`, { responseType: 'blob' });
  },
};
