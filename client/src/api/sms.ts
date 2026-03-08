import api from './client';

export interface SmsBulkRecipient {
  name: string;
  phone: string;
}

export const smsApi = {
  send: (phone: string, message: string) =>
    api.post('/sms/send', { phone, message }),

  sendBulk: (recipients: SmsBulkRecipient[], messageTemplate: string) =>
    api.post('/sms/send-bulk', { recipients, messageTemplate }),

  getBalance: () => api.get('/sms/balance'),

  getTemplates: () => api.get('/sms/templates'),

  compose: (type: string, studentName: string) =>
    api.post('/sms/compose', { type, studentName }),

  testConnection: () => api.get('/sms/test-connection'),
};
