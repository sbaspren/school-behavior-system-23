import api from './client';

export interface SendWithLogData {
  studentId: number;
  studentNumber?: string;
  studentName?: string;
  grade?: string;
  className?: string;
  phone: string;
  messageType?: string;
  messageTitle?: string;
  message: string;
  stage?: string;
  sender?: string;
}

export interface AddSessionData {
  phoneNumber: string;
  stage?: string;
  userType?: string;
}

export interface SyncSaveData {
  phoneNumber: string;
  stage?: string;
  userType?: string;
}

export interface WhatsAppSettingsData {
  serverUrl?: string;
  serviceStatus?: string;
  smsApiToken?: string;
  smsSenderName?: string;
  whatsAppMode?: string;
}

export const whatsappApi = {
  // Settings
  getSettings: () => api.get('/whatsapp/settings'),
  saveSettings: (data: WhatsAppSettingsData) => api.post('/whatsapp/settings', data),

  // Server status
  getStatus: (stage?: string) => {
    const sp = new URLSearchParams();
    if (stage) sp.set('stage', stage);
    return api.get(`/whatsapp/status?${sp.toString()}`);
  },
  ping: () => api.post('/whatsapp/ping'),

  // QR Code
  getQR: () => api.get('/whatsapp/qr'),
  // inspectQREndpoint — تشخيص صفحة QR من السيرفر (مطابق GAS سطر 601)
  inspectQR: () => api.get('/whatsapp/qr/inspect'),

  // Connected sessions from server
  getConnectedSessions: () => api.get('/whatsapp/connected-sessions'),
  // getConnectedSessionsByStage — مطابق GAS سطر 705
  getConnectedByStage: (stage?: string) => {
    const sp = new URLSearchParams();
    if (stage) sp.set('stage', stage);
    return api.get(`/whatsapp/connected-sessions/by-stage?${sp.toString()}`);
  },

  // Send
  send: (data: { senderPhone?: string; recipientPhone: string; message: string; stage?: string }) =>
    api.post('/whatsapp/send', data),
  sendWithLog: (data: SendWithLogData) => api.post('/whatsapp/send-with-log', data),

  // Session management
  getSessions: (stage?: string, userType?: string) => {
    const sp = new URLSearchParams();
    if (stage) sp.set('stage', stage);
    if (userType) sp.set('userType', userType);
    return api.get(`/whatsapp/sessions?${sp.toString()}`);
  },
  addSession: (data: AddSessionData) => api.post('/whatsapp/sessions', data),
  setPrimary: (id: number) => api.put(`/whatsapp/sessions/${id}/primary`),
  // updatePhoneStatus — تحديث حالة جلسة (مطابق GAS سطر 503)
  updateStatus: (id: number, status: string) =>
    api.put(`/whatsapp/sessions/${id}/status`, { status }),
  deleteSession: (id: number) => api.delete(`/whatsapp/sessions/${id}`),
  // rebuildSessionsSheet — إعادة بناء الجلسات (مطابق GAS سطر 136)
  rebuildSessions: () => api.post('/whatsapp/sessions/rebuild'),
  // checkPhoneStatusInServer — فحص رقم في السيرفر (مطابق GAS سطر 671)
  checkPhoneOnServer: (phone: string) =>
    api.get(`/whatsapp/sessions/check-server?phone=${encodeURIComponent(phone)}`),
  // getPrimaryPhoneForStage — الرقم الرئيسي للمرحلة (مطابق GAS سطر 453)
  getPrimaryForStage: (stage?: string) => {
    const sp = new URLSearchParams();
    if (stage) sp.set('stage', stage);
    return api.get(`/whatsapp/sessions/primary?${sp.toString()}`);
  },
  // syncAndSavePhone — مزامنة وحفظ رقم من السيرفر (مطابق GAS سطر 894)
  syncAndSave: (data: SyncSaveData) => api.post('/whatsapp/sessions/sync', data),

  getStats: (stage?: string) => {
    const sp = new URLSearchParams();
    if (stage) sp.set('stage', stage);
    return api.get(`/whatsapp/stats?${sp.toString()}`);
  },
  getUserTypes: () => api.get('/whatsapp/user-types'),

  // Security
  getSecurityStatus: () => api.get('/whatsapp/security/status'),
  setupSecurityCode: (code: string, recoveryPhone1: string, recoveryPhone2?: string) =>
    api.post('/whatsapp/security/setup', { code, recoveryPhone1, recoveryPhone2 }),
  verifySecurityCode: (code: string) => api.post('/whatsapp/security/verify', { code }),
  requestRecoveryCode: (phoneIndex: number) => api.post('/whatsapp/security/request-recovery', { phoneIndex }),
  verifyRecoveryCode: (code: string) => api.post('/whatsapp/security/verify-recovery', { code }),
  changeSecurityCode: (data: { oldCode?: string; newCode: string; recoveryPhone1?: string; recoveryPhone2?: string; bypassOldCode?: boolean }) =>
    api.post('/whatsapp/security/change-code', data),
};

// SMS
export const smsApi = {
  send: (phone: string, message: string) => api.post('/sms/send', { phone, message }),
  sendBulk: (recipients: { name: string; phone: string }[], messageTemplate: string) =>
    api.post('/sms/send-bulk', { recipients, messageTemplate }),
  checkBalance: () => api.get('/sms/balance'),
  getTemplates: () => api.get('/sms/templates'),
  testConnection: () => api.get('/sms/test-connection'),
};
