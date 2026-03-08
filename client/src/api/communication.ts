import api from './client';

export interface LogCommunicationData {
  stage: string;
  studentId: number;
  studentNumber?: string;
  studentName?: string;
  grade?: string;
  className?: string;
  phone?: string;
  messageType?: string;
  messageTitle?: string;
  messageContent?: string;
  status?: string;
  sender?: string;
  notes?: string;
}

export interface AddSessionData {
  phoneNumber: string;
  stage?: string;
  userType?: string;
}

export const communicationApi = {
  getAll: (params?: {
    stage?: string; messageType?: string; status?: string;
    dateFrom?: string; dateTo?: string; search?: string; studentId?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.stage) sp.set('stage', params.stage);
    if (params?.messageType) sp.set('messageType', params.messageType);
    if (params?.status) sp.set('status', params.status);
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    if (params?.search) sp.set('search', params.search);
    if (params?.studentId) sp.set('studentId', params.studentId.toString());
    return api.get(`/communication?${sp.toString()}`);
  },
  getSummary: (stage?: string) => {
    const sp = new URLSearchParams();
    if (stage) sp.set('stage', stage);
    return api.get(`/communication/summary?${sp.toString()}`);
  },
  log: (data: LogCommunicationData) => api.post('/communication', data),
  updateStatus: (id: number, data: { status?: string; notes?: string }) =>
    api.put(`/communication/${id}/status`, data),
  delete: (id: number) => api.delete(`/communication/${id}`),
  export: (params?: {
    stage?: string; messageType?: string; status?: string;
    dateFrom?: string; dateTo?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.stage) sp.set('stage', params.stage);
    if (params?.messageType) sp.set('messageType', params.messageType);
    if (params?.status) sp.set('status', params.status);
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    return api.get(`/communication/export?${sp.toString()}`);
  },

  // WhatsApp
  getWhatsAppSessions: () => api.get('/communication/whatsapp/sessions'),
  addWhatsAppSession: (data: AddSessionData) =>
    api.post('/communication/whatsapp/sessions', data),
  setPrimarySession: (id: number) =>
    api.put(`/communication/whatsapp/sessions/${id}/primary`),
  deleteWhatsAppSession: (id: number) =>
    api.delete(`/communication/whatsapp/sessions/${id}`),
  getWhatsAppStats: () => api.get('/communication/whatsapp/stats'),
};
