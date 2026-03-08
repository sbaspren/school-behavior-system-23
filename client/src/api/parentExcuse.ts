import api from './client';

export interface ParentExcuseRow {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  grade: string;
  class: string;
  stage: string;
  excuseText: string;
  attachments: string;
  absenceDate: string;
  submittedAt: string;
  submittedTime: string;
  status: string;          // معلق / مقبول / مرفوض
  schoolNotes: string;
  accessCode: string;
}

export const parentExcuseApi = {
  // Admin endpoints
  getAll: (stage?: string, status?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (status) params.set('status', status);
    return api.get(`/parentexcuse?${params.toString()}`);
  },

  getPendingCount: (stage?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    return api.get(`/parentexcuse/pending-count?${params.toString()}`);
  },

  updateStatus: (id: number, status: string, notes?: string) =>
    api.put(`/parentexcuse/${id}/status`, { status, notes }),

  delete: (id: number) =>
    api.delete(`/parentexcuse/${id}`),

  // Public endpoints (parent form)
  verifyToken: (token: string) =>
    api.get(`/parentexcuse/public/verify?token=${token}`),

  submitExcuse: (data: { token: string; reason: string; hasAttachment: boolean; absenceDate?: string }) =>
    api.post('/parentexcuse/public/submit', data),

  generateCode: (studentNumber: string, stage: string) =>
    api.post('/parentexcuse/generate-code', { studentNumber, stage }),
};
