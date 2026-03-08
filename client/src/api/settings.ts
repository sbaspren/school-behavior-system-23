import api from './client';

export interface SchoolSettingsData {
  id?: number;
  schoolName: string;
  eduAdmin: string;
  eduDept: string;
  letterheadMode: string;
  letterheadImageUrl: string;
  whatsAppMode: string;
  schoolType: string;
  secondarySystem: string;
  // ★ حقول طاقم العمل — تُستخدم في المطبوعات والتقارير
  managerName?: string;
  deputyName?: string;
  counselorName?: string;
  committeeName?: string;
  wakeelName?: string;
  wakeelSignature?: string;
}

export interface GradeConfigData {
  gradeName: string;
  classCount: number;
  isEnabled: boolean;
}

export interface StageConfigData {
  stage: string;
  isEnabled: boolean;
  grades: GradeConfigData[];
}

export interface StructureData {
  schoolType: string;
  secondarySystem: string;
  stages: StageConfigData[];
}

export const settingsApi = {
  getSettings: () => api.get('/settings'),
  saveSettings: (data: SchoolSettingsData) => api.post('/settings', data),
  getStructure: () => api.get('/settings/structure'),
  saveStructure: (data: StructureData) => api.post('/settings/structure', data),
  isConfigured: () => api.get('/settings/is-configured'),
  getStages: () => api.get('/settings/stages'),
};
