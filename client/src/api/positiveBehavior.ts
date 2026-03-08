import api from './client';

export interface PositiveBehaviorData {
  studentId: number;
  behaviorType?: string;
  degree?: string;
  details?: string;
  hijriDate?: string;
  recordedBy?: string;
}

export interface PosBehaviorFilters {
  stage?: string;
  grade?: string;
  className?: string;
  studentId?: number;
  search?: string;
}

export const positiveBehaviorApi = {
  getAll: (filters?: PosBehaviorFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.className) params.set('className', filters.className);
      if (filters.studentId) params.set('studentId', filters.studentId.toString());
      if (filters.search) params.set('search', filters.search);
    }
    return api.get(`/positivebehavior?${params.toString()}`);
  },

  getDailyStats: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/positivebehavior/daily-stats?${params.toString()}`);
  },

  add: (data: PositiveBehaviorData) => api.post('/positivebehavior', data),

  addBatch: (studentIds: number[], data?: { behaviorType?: string; degree?: string; details?: string; hijriDate?: string; recordedBy?: string }) =>
    api.post('/positivebehavior/batch', { studentIds, ...data }),

  update: (id: number, data: Partial<PositiveBehaviorData>) => api.put(`/positivebehavior/${id}`, data),

  delete: (id: number) => api.delete(`/positivebehavior/${id}`),
  deleteBulk: (ids: number[]) => api.post('/positivebehavior/delete-bulk', { ids }),

  saveCompensation: (data: { studentId: number; behaviorText: string; noorValue?: string; violationId?: number; violationCode?: string }) =>
    api.post('/positivebehavior/compensation', data),

  getStudentSummary: (studentId: number) => api.get(`/positivebehavior/student-summary/${studentId}`),

  getReport: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/positivebehavior/report?${params.toString()}`);
  },

  exportCsv: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/positivebehavior/export?${params.toString()}`, { responseType: 'blob' });
  },
};
