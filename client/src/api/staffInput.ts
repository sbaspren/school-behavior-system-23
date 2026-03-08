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
  gradeMap: Record<string, string[]>;  // ★ stage → grade names
  enabledStages: string[];             // ★ enabled stage names
  token: string;                       // ★ echo back
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

// ★ مطابق للأصلي: مجمّع حسب المرحلة
export interface TodayEntries {
  entries: Record<string, { name: string; type: string; time: string }[]>;
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

// ★ Helper: Flatten grade students (2-level selection for permission/tardiness)
export interface FlatStudent extends StaffStudent {
  cls: string;   // full class name (e.g., "الأول أ")
  sec: string;   // section letter (e.g., "أ")
}

export function flattenGradeStudents(
  studentsMap: StudentsMap, stage: string, grade: string
): FlatStudent[] {
  const gradeData = studentsMap[stage]?.[grade];
  if (!gradeData) return [];
  const result: FlatStudent[] = [];
  const classes = Object.keys(gradeData).sort();
  for (const cls of classes) {
    const sec = cls;
    for (const s of gradeData[cls]) {
      result.push({ ...s, cls: `${grade} ${cls}`, sec });
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return result;
}
