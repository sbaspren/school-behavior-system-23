import api from './client';

export interface AcademicSubjectData {
  name: string;
  total: number;
  finalExam: number;
  evalTools: number;
  shortTests: number;
  grade: string;
}

export interface AcademicStudentData {
  identity: string;
  name: string;
  grade: string;
  classNum: string;
  semester: string;
  average?: number;
  generalGrade: string;
  rankGrade: string;
  rankClass: string;
  absence: number;
  tardiness: number;
  behaviorExcellent: string;
  behaviorPositive: string;
  subjects?: AcademicSubjectData[];
}

export interface AcademicImportRequest {
  stage: string;
  period: string;
  students: AcademicStudentData[];
}

export interface AcademicSearchFilters {
  stage: string;
  semester?: string;
  period?: string;
  grade?: string;
  classNum?: string;
  name?: string;
  generalGrade?: string;
  avgAbove?: number;
  avgBelow?: number;
  sortBy?: string;
}

export const academicApi = {
  getAll: (stage: string) =>
    api.get(`/academic?stage=${stage}`),

  getPeriods: (stage: string) =>
    api.get(`/academic/periods?stage=${stage}`),

  getStats: (stage: string, semester?: string, period?: string) => {
    const params = new URLSearchParams({ stage });
    if (semester) params.set('semester', semester);
    if (period) params.set('period', period);
    return api.get(`/academic/stats?${params.toString()}`);
  },

  getStudentReport: (identityNo: string, stage: string) =>
    api.get(`/academic/student/${identityNo}?stage=${stage}`),

  getClassComparison: (stage: string, semester?: string, period?: string) => {
    const params = new URLSearchParams({ stage });
    if (semester) params.set('semester', semester);
    if (period) params.set('period', period);
    return api.get(`/academic/class-comparison?${params.toString()}`);
  },

  getStudentProgress: (identityNo: string, stage: string) =>
    api.get(`/academic/progress/${identityNo}?stage=${stage}`),

  search: (filters: AcademicSearchFilters) => {
    const params = new URLSearchParams({ stage: filters.stage });
    if (filters.semester) params.set('semester', filters.semester);
    if (filters.period) params.set('period', filters.period);
    if (filters.grade) params.set('grade', filters.grade);
    if (filters.classNum) params.set('classNum', filters.classNum);
    if (filters.name) params.set('name', filters.name);
    if (filters.generalGrade) params.set('generalGrade', filters.generalGrade);
    if (filters.avgAbove !== undefined) params.set('avgAbove', filters.avgAbove.toString());
    if (filters.avgBelow !== undefined) params.set('avgBelow', filters.avgBelow.toString());
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    return api.get(`/academic/search?${params.toString()}`);
  },

  import: (data: AcademicImportRequest) =>
    api.post('/academic/import', data),

  deletePeriod: (stage: string, semester: string, period: string) =>
    api.delete(`/academic/period?stage=${stage}&semester=${semester}&period=${period}`),

  exportCsv: (stage: string, semester?: string, period?: string) => {
    const params = new URLSearchParams({ stage });
    if (semester) params.set('semester', semester);
    if (period) params.set('period', period);
    return api.get(`/academic/export-csv?${params.toString()}`, { responseType: 'blob' });
  },
};
