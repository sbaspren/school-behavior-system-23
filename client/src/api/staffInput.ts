import axios from 'axios';

// Public API — no auth token needed (same pattern as teacherInput)
const publicApi = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api',
});

export interface StaffInfo {
  id: number;
  name: string;
  role: string;
  permissions: string[];
  isGuard: boolean;
}

export interface StaffVerifyData {
  success: boolean;
  sn: string;          // school name
  staff: StaffInfo;
}

export interface StaffStudent {
  id: number;
  num: string;
  name: string;
  phone: string;
}

// stage (Arabic) → grade → class → students
export type StudentsMap = Record<string, Record<string, Record<string, StaffStudent[]>>>;

export interface GuardPermissionRecord {
  id: number;
  studentName: string;
  grade: string;
  className: string;
  stage: string;
  reason: string;
  receiver: string;
  exitTime: string;
  confirmationTime: string;
  confirmed: boolean;
}

export interface TodayEntries {
  permissions: { type: string; studentName: string; grade: string; className: string; stage: string; reason: string; exitTime: string; recordedBy: string; time: string }[];
  tardiness: { type: string; studentName: string; grade: string; className: string; stage: string; recordedBy: string; time: string }[];
}

export const staffInputApi = {
  verify: (token: string) =>
    publicApi.get<{ data: StaffVerifyData }>(`/staffinput/public/verify?token=${token}`),

  getStudents: (token: string) =>
    publicApi.get<{ data: StudentsMap }>(`/staffinput/public/students?token=${token}`),

  savePermission: (data: { token: string; studentIds: number[]; reason?: string; guardian?: string }) =>
    publicApi.post<{ data: { success: boolean; message: string; count: number } }>(
      '/staffinput/public/permission', data
    ),

  saveTardiness: (data: { token: string; studentIds: number[] }) =>
    publicApi.post<{ data: { success: boolean; message: string; count: number } }>(
      '/staffinput/public/tardiness', data
    ),

  getGuardPermissions: (token: string, stage?: string) =>
    publicApi.get<{ data: GuardPermissionRecord[] }>(
      `/staffinput/public/guard-permissions?token=${token}${stage ? `&stage=${stage}` : ''}`
    ),

  confirmExit: (id: number, token: string) =>
    publicApi.put<{ data: { success: boolean; message: string; confirmationTime: string } }>(
      `/staffinput/public/confirm-exit/${id}?token=${token}`
    ),

  getTodayEntries: (token: string) =>
    publicApi.get<{ data: TodayEntries }>(`/staffinput/public/today-entries?token=${token}`),
};
