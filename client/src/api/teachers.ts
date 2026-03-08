import api from './client';

export interface TeacherData {
  civilId: string;
  name: string;
  mobile?: string;
  subjects?: string;
  assignedClasses?: string;
}

export const teachersApi = {
  getAll: () => api.get('/teachers'),
  add: (data: TeacherData) => api.post('/teachers', data),
  update: (id: number, data: TeacherData) => api.put(`/teachers/${id}`, data),
  delete: (id: number) => api.delete(`/teachers/${id}`),
  import: (teachers: TeacherData[], updateExisting: boolean) =>
    api.post('/teachers/import', { teachers, updateExisting }),
  createLink: (id: number) => api.post(`/teachers/${id}/create-link`),
  removeLink: (id: number) => api.post(`/teachers/${id}/remove-link`),
  createAllLinks: () => api.post('/teachers/create-all-links'),
  previewExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/teachers/preview-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importExcel: (file: File, updateExisting: boolean = false) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('updateExisting', String(updateExisting));
    return api.post('/teachers/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
