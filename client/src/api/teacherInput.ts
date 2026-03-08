import axios from 'axios';

// Public API — no auth token needed
const publicApi = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api',
});

export interface TeacherPageData {
  success: boolean;
  sn: string;                    // school name
  t: { n: string; s: string };   // teacher name, subject
  cl: ClassInfo[];               // classes
  st: Record<string, StudentInfo[]>; // students by class key
}

export interface ClassInfo {
  k: string;   // key
  d: string;   // display name
  s: string;   // stage (Arabic)
  sub: string; // subject
}

export interface StudentInfo {
  i: string;   // studentNumber
  n: string;   // name
  p: string;   // phone
}

export interface TeacherFormSubmission {
  token: string;
  teacherName: string;
  className: string;
  inputType: string;
  itemId?: string;
  itemText?: string;
  itemDegree?: string;
  violationType?: string;
  absenceType?: string;
  teacherSubject?: string;
  details?: string;
  noteClassification?: string;
  hijriDate?: string;
  dayName?: string;
  noAbsence: boolean;
  notifyDeputy: boolean;
  students: { id: string; name: string; phone?: string }[];
}

export const teacherInputApi = {
  verify: (token: string) =>
    publicApi.get<{ data: TeacherPageData }>(`/teacherinput/public/verify?token=${token}`),

  submit: (data: TeacherFormSubmission) =>
    publicApi.post<{ data: { success: boolean; message: string; count?: number } }>(
      '/teacherinput/public/submit', data
    ),
};
