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
  status: string;
  schoolNotes: string;
  accessCode: string;
  source?: string;
  miladiDate?: string;
  day?: string;
  parentName?: string;
}

export const parentExcuseApi = {
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

  updateStatus: (id: number, status: string, notes?: string, sendMessage?: boolean) =>
    api.put(`/parentexcuse/${id}/status`, { status, notes, sendMessage }),

  delete: (id: number) =>
    api.delete(`/parentexcuse/${id}`),

  sendCustomMessage: (id: number, message: string) =>
    api.post(`/parentexcuse/${id}/send-message`, { message }),

  verifyToken: (token: string) =>
    api.get(`/parentexcuse/public/verify?token=${token}`),

  submitExcuse: (data: { token: string; reason: string; hasAttachment: boolean; absenceDate?: string }) =>
    api.post('/parentexcuse/public/submit', data),

  generateCode: (studentNumber: string, stage: string) =>
    api.post('/parentexcuse/generate-code', { studentNumber, stage }),

  generateLink: (studentNumber: string, stage: string) =>
    api.post('/parentexcuse/generate-code', { studentNumber, stage }),
};
