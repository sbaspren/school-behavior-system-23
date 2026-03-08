import api from './client';

export interface StudentData {
  studentNumber?: string;
  name: string;
  stage?: string;
  grade?: string;
  className?: string;
  mobile?: string;
}

export const studentsApi = {
  getAll: (stage?: string, grade?: string, className?: string) => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (grade) params.set('grade', grade);
    if (className) params.set('className', className);
    return api.get(`/students?${params.toString()}`);
  },
  add: (data: StudentData) => api.post('/students', data),
  delete: (id: number) => api.delete(`/students/${id}`),
  import: (stage: string, students: StudentData[]) =>
    api.post('/students/import', { stage, students }),
  importExcel: (file: File, stage: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('stage', stage);
    return api.post('/students/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
