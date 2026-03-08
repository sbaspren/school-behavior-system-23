import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { teachersApi, TeacherData } from '../../api/teachers';
import { settingsApi, StageConfigData } from '../../api/settings';
import { showSuccess, showError } from '../shared/Toast';
import { SETTINGS_STAGES, CLASS_LETTERS, STAGE_SUBJECTS } from '../../utils/constants';

interface TeacherRow {
  id: number;
  civilId: string;
  name: string;
  mobile: string;
  subjects: string;
  assignedClasses: string;
}

const STAGE_COLORS: Record<string, { chip: string; chipOff: string; text: string }> = {
  Primary: { chip: '#dcfce7', chipOff: '#f3f4f6', text: '#15803d' },
  Intermediate: { chip: '#dbeafe', chipOff: '#f3f4f6', text: '#1d4ed8' },
  Secondary: { chip: '#f3e8ff', chipOff: '#f3f4f6', text: '#7c3aed' },
};

const TeachersTab: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('__all__');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeacherRow | null>(null);

  const enabledStages = useMemo(() =>
    stages.filter((s) => s.isEnabled && s.grades.some((g) => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        teachersApi.getAll(),
        settingsApi.getStructure(),
      ]);
      if (tRes.data?.data) setTeachers(tRes.data.data);
      if (sRes.data?.data?.stages) setStages(Array.isArray(sRes.data.data.stages) ? sRes.data.data.stages : []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter teachers
  const filteredTeachers = useMemo(() => {
    let list = teachers;

    if (stageFilter === '__unassigned__') {
      list = list.filter((t) => !t.assignedClasses);
    } else if (stageFilter !== '__all__') {
      const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
      list = list.filter((t) => t.assignedClasses && t.assignedClasses.includes(`_${stageId}_`));
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.civilId.includes(q) ||
        t.mobile.includes(q)
      );
    }

    return list;
  }, [teachers, stageFilter, search]);

  const unassignedCount = teachers.filter((t) => !t.assignedClasses).length;

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await teachersApi.delete(confirmDelete.id);
      if (res.data?.success) {
        showSuccess('تم حذف المعلم');
        setConfirmDelete(null);
        loadData();
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
  };

  // Import preview state
  const [importPreview, setImportPreview] = useState<{ file: File; rows: { civilId: string; name: string; mobile: string; isExisting: boolean }[] } | null>(null);
  const [importUpdateExisting, setImportUpdateExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  // ★ Progress modal — مطابق للأصلي showImportProgressModal
  const [importProgress, setImportProgress] = useState<{ text: string; pct: number; done: boolean } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const res = await teachersApi.previewExcel(file);
      if (res.data?.success && res.data.data) {
        const rows = res.data.data as { civilId: string; name: string; mobile: string; isExisting: boolean }[];
        if (rows.length === 0) {
          showError('لم يتم العثور على بيانات في الملف');
          return;
        }
        setImportPreview({ file, rows });
        setImportUpdateExisting(false);
      } else {
        showError(res.data?.message || 'فشل قراءة الملف');
      }
    } catch { showError('فشل الاتصال أثناء قراءة الملف'); }
  };

  const executeImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    setImportPreview(null);
    // ★ إظهار نافذة التقدم بعد إغلاق المعاينة
    setImportProgress({ text: 'جاري الاستيراد...', pct: 40, done: false });
    const t1 = setTimeout(() => setImportProgress((p) => p && !p.done ? { ...p, text: 'جاري مقارنة البيانات...', pct: 65 } : p), 1800);
    const t2 = setTimeout(() => setImportProgress((p) => p && !p.done ? { ...p, text: 'جاري الكتابة والحفظ...', pct: 85 } : p), 4000);
    try {
      const res = await teachersApi.importExcel(importPreview.file, importUpdateExisting);
      clearTimeout(t1); clearTimeout(t2);
      if (res.data?.success) {
        const d = res.data.data;
        setImportProgress({ text: 'تم بنجاح!', pct: 100, done: true });
        setTimeout(() => {
          setImportProgress(null);
          showSuccess(`تم الاستيراد: ${d.added} جديد، ${d.updated} محدّث، ${d.skipped} متجاوز`);
          loadData();
        }, 1200);
      } else {
        clearTimeout(t1); clearTimeout(t2);
        setImportProgress(null);
        showError(res.data?.message || 'فشل الاستيراد');
      }
    } catch {
      clearTimeout(t1); clearTimeout(t2);
      setImportProgress(null);
      showError('فشل الاتصال أثناء الاستيراد');
    } finally { setImporting(false); }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div className="spinner" />
        <p style={{ color: '#666', marginTop: '16px' }}>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#14b8a6' }}>👨‍🏫</span>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>المعلمين</h3>
          <span style={{ padding: '2px 8px', background: '#ccfbf1', color: '#0f766e', fontSize: '14px', borderRadius: '9999px', fontWeight: 700 }}>{filteredTeachers.length}</span>
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>/ {teachers.length} إجمالي</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setEditingTeacher(null); setModalOpen(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            background: '#f3f4f6', color: '#374151', borderRadius: '8px', fontWeight: 500, border: 'none', cursor: 'pointer',
          }}>
            ➕ إضافة يدوي
          </button>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            background: '#0d9488', color: '#fff', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
          }}>
            📤 استيراد Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Stage Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#6b7280' }}>المرحلة:</span>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '4px', flexWrap: 'wrap' }}>
          <FilterButton label="الكل" count={teachers.length} active={stageFilter === '__all__'} onClick={() => setStageFilter('__all__')} />
          {enabledStages.map((stage) => {
            const stageInfo = SETTINGS_STAGES.find((s) => s.id === stage.stage);
            const count = teachers.filter((t) => t.assignedClasses && t.assignedClasses.includes(`_${stage.stage}_`)).length;
            return (
              <FilterButton key={stage.stage} label={stageInfo?.name || stage.stage} count={count}
                active={stageFilter === (stageInfo?.name || stage.stage)} onClick={() => setStageFilter(stageInfo?.name || stage.stage)} />
            );
          })}
          {unassignedCount > 0 && (
            <FilterButton label="بدون فصول" count={unassignedCount} active={stageFilter === '__unassigned__'} onClick={() => setStageFilter('__unassigned__')} color="#ea580c" />
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو السجل المدني..."
          style={{ width: '100%', height: '40px', padding: '0 16px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }} />
      </div>

      {/* Table */}
      {filteredTeachers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}>👨‍🏫</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا يوجد معلمين {stageFilter === '__unassigned__' ? 'بدون فصول' : stageFilter === '__all__' ? '' : 'في هذه المرحلة'}</p>
          <p style={{ fontSize: '14px' }}>أضف معلماً أو استورد من Excel</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>السجل المدني</th>
                  <th>المواد</th>
                  <th>الفصول</th>
                  <th style={{ textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((t) => {
                  const subjects = t.subjects ? t.subjects.split(',').filter(Boolean) : [];
                  const classes = t.assignedClasses ? t.assignedClasses.split(',').filter(Boolean) : [];
                  const classLabels = classes.map((c) => {
                    const parts = c.split('_');
                    return parts.length >= 3 ? `${parts[0]} (${parts[parts.length - 1]})` : c;
                  });

                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#1f2937' }}>{t.name}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{t.mobile || ''}</div>
                      </td>
                      <td style={{ fontSize: '14px', color: '#4b5563', fontFamily: 'monospace' }}>{t.civilId || '-'}</td>
                      <td style={{ fontSize: '14px', color: '#4b5563' }}>
                        {subjects.length > 0 ? subjects.slice(0, 2).join('، ') + (subjects.length > 2 ? '...' : '') : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {classLabels.length > 0 ? (
                            <>
                              {classLabels.slice(0, 4).map((cl, i) => (
                                <span key={i} style={{ padding: '2px 8px', background: '#ccfbf1', color: '#0f766e', fontSize: '12px', borderRadius: '9999px', fontWeight: 700 }}>{cl}</span>
                              ))}
                              {classLabels.length > 4 && <span style={{ fontSize: '12px', color: '#9ca3af' }}>+{classLabels.length - 4}</span>}
                            </>
                          ) : (
                            <span style={{ padding: '2px 8px', background: '#fff7ed', color: '#ea580c', fontSize: '12px', borderRadius: '9999px' }}>بدون فصول</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => { setEditingTeacher(t); setModalOpen(true); }} style={{ padding: '6px', color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => setConfirmDelete(t)} style={{ padding: '6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <TeacherModal teacher={editingTeacher} stages={stages}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadData(); }} />
      )}

      {/* Import Preview Modal */}
      {importPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #ccfbf1, #d1fae5)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>معاينة الاستيراد</h3>
              <button onClick={() => setImportPreview(null)} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                <span style={{ padding: '4px 12px', background: '#dcfce7', color: '#15803d', borderRadius: '9999px', fontSize: '14px', fontWeight: 700 }}>
                  جديد: {importPreview.rows.filter(r => !r.isExisting).length}
                </span>
                <span style={{ padding: '4px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '9999px', fontSize: '14px', fontWeight: 700 }}>
                  موجود: {importPreview.rows.filter(r => r.isExisting).length}
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                <input type="checkbox" checked={importUpdateExisting} onChange={(e) => setImportUpdateExisting(e.target.checked)} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>تحديث المعلمين الموجودين</span>
              </label>
            </div>
            <div style={{ padding: '0 24px', overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الاسم</th>
                    <th>السجل المدني</th>
                    <th>الجوال</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{row.name}</td>
                      <td style={{ fontFamily: 'monospace' }}>{row.civilId || '-'}</td>
                      <td>{row.mobile || '-'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                          background: row.isExisting ? '#fef3c7' : '#dcfce7',
                          color: row.isExisting ? '#92400e' : '#15803d',
                        }}>
                          {row.isExisting ? 'موجود' : 'جديد'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setImportPreview(null)} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
              <button onClick={executeImport} disabled={importing} style={{
                padding: '8px 24px', background: '#0d9488', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: importing ? 0.7 : 1,
              }}>
                {importing ? 'جاري الاستيراد...' : 'تنفيذ الاستيراد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <ConfirmDeleteModal name={confirmDelete.name} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}

      {/* ★ Import Progress Modal — مطابق للأصلي showImportProgressModal */}
      {importProgress && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', maxWidth: '420px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: importProgress.done ? '#dcfce7' : '#ccfbf1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: '28px',
            }}>
              {importProgress.done ? '✅' : '🔄'}
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>استيراد المعلمين</h3>
            <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: importProgress.done ? '#15803d' : '#374151' }}>
              {importProgress.text}
            </p>
            <div style={{ background: '#f3f4f6', borderRadius: '9999px', height: '12px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{
                width: `${importProgress.pct}%`, height: '100%', borderRadius: '9999px',
                background: importProgress.done ? 'linear-gradient(to left, #22c55e, #16a34a)' : 'linear-gradient(to left, #0d9488, #14b8a6)',
                transition: 'width 0.7s ease-out',
              }} />
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>{importProgress.pct}%</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Filter Button
// ============================================================
const FilterButton: React.FC<{ label: string; count: number; active: boolean; onClick: () => void; color?: string }> = ({ label, count, active, onClick, color }) => (
  <button onClick={onClick} style={{
    padding: '6px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
    background: active ? '#fff' : 'transparent',
    color: active ? (color || '#0f766e') : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
  }}>
    {label} <span style={{ fontSize: '12px', color: active ? (color || '#14b8a6') : '#9ca3af' }}>({count})</span>
  </button>
);

// ============================================================
// Teacher Modal
// ============================================================
interface TeacherModalProps {
  teacher: TeacherRow | null;
  stages: StageConfigData[];
  onClose: () => void;
  onSaved: () => void;
}

const TeacherModal: React.FC<TeacherModalProps> = ({ teacher, stages, onClose, onSaved }) => {
  const isEdit = !!teacher;
  const [civilId, setCivilId] = useState(teacher?.civilId || '');
  const [name, setName] = useState(teacher?.name || '');
  const [mobile, setMobile] = useState(teacher?.mobile || '');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(() =>
    teacher?.assignedClasses ? teacher.assignedClasses.split(',').filter(Boolean) : []
  );
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() =>
    teacher?.subjects ? teacher.subjects.split(',').filter(Boolean) : []
  );
  const [saving, setSaving] = useState(false);

  // Detect stages from selected classes
  const detectedStageIds = useMemo(() => {
    const set = new Set<string>();
    selectedClasses.forEach((c) => {
      const parts = c.split('_');
      if (parts.length >= 3) set.add(parts[parts.length - 2]);
    });
    return Array.from(set);
  }, [selectedClasses]);

  const isSharedTeacher = detectedStageIds.length > 1;

  const toggleClass = (key: string) => {
    setSelectedClasses((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  };

  const toggleSubject = (subjectName: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectName) ? prev.filter((s) => s !== subjectName) : [...prev, subjectName]
    );
  };

  const handleSave = async () => {
    if (!civilId.trim()) { showError('السجل المدني مطلوب'); return; }
    if (!name.trim()) { showError('الاسم مطلوب'); return; }
    if (!/^[12]\d{9}$/.test(civilId.trim())) { showError('السجل المدني يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2'); return; }
    if (mobile.trim() && !/^05\d{8}$/.test(mobile.trim())) { showError('رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05'); return; }

    setSaving(true);
    const data: TeacherData = {
      civilId: civilId.trim(),
      name: name.trim(),
      mobile: mobile.trim(),
      subjects: selectedSubjects.join(','),
      assignedClasses: selectedClasses.join(','),
    };

    try {
      const res = isEdit
        ? await teachersApi.update(teacher!.id, data)
        : await teachersApi.add(data);
      if (res.data?.success) {
        showSuccess('تم الحفظ بنجاح');
        onSaved();
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
    finally { setSaving(false); }
  };

  // Build classes list
  const classesByStage = useMemo(() => {
    const result: { stageId: string; stageName: string; classes: { key: string; label: string }[] }[] = [];
    stages.forEach((stage) => {
      if (!stage.isEnabled) return;
      const stageInfo = SETTINGS_STAGES.find((s) => s.id === stage.stage);
      const classes: { key: string; label: string }[] = [];
      stage.grades.forEach((grade) => {
        if (!grade.isEnabled || grade.classCount === 0) return;
        CLASS_LETTERS.slice(0, grade.classCount).forEach((letter) => {
          classes.push({
            key: `${grade.gradeName}_${stage.stage}_${letter}`,
            label: `${grade.gradeName} (${letter})`,
          });
        });
      });
      if (classes.length > 0) {
        result.push({ stageId: stage.stage, stageName: stageInfo?.name || stage.stage, classes });
      }
    });
    return result;
  }, [stages]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #ccfbf1, #d1fae5)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{isEdit ? 'تعديل معلم' : 'إضافة معلم جديد'}</h3>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Civil ID + Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>السجل المدني *</label>
              <input type="text" value={civilId} onChange={(e) => setCivilId(e.target.value)} maxLength={10}
                readOnly={isEdit}
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box', background: isEdit ? '#f3f4f6' : '#fff', cursor: isEdit ? 'not-allowed' : 'text' }} />
              {isEdit && <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>السجل المدني هو المعرّف ولا يمكن تغييره</p>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>الاسم *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Mobile */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>الجوال</label>
            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05XXXXXXXX"
              style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box' }} />
          </div>

          {/* Classes */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>الفصول المسندة</label>
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', maxHeight: '160px', overflowY: 'auto' }}>
              {classesByStage.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', margin: 0 }}>لم يتم إعداد هيكل المدرسة</p>
              ) : (
                classesByStage.map((group) => (
                  <div key={group.stageId} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 700, color: '#374151', marginBottom: '8px', fontSize: '14px' }}>{group.stageName}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {group.classes.map((cls) => (
                        <label key={cls.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={selectedClasses.includes(cls.key)} onChange={() => toggleClass(cls.key)} />
                          <span style={{ fontSize: '14px' }}>{cls.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Subjects */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 700, color: '#4b5563' }}>المواد</label>
              {isSharedTeacher && (
                <span style={{ padding: '4px 12px', background: '#f3e8ff', color: '#7c3aed', fontSize: '12px', borderRadius: '9999px', fontWeight: 700 }}>
                  معلم مشترك: {detectedStageIds.map((id) => STAGE_SUBJECTS[id]?.name || id).join(' + ')}
                </span>
              )}
            </div>
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', maxHeight: '192px', overflowY: 'auto' }}>
              {detectedStageIds.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', margin: 0 }}>اختر الفصول أولاً لعرض المواد</p>
              ) : (
                detectedStageIds.map((stageId) => {
                  const stageInfo = STAGE_SUBJECTS[stageId];
                  if (!stageInfo) return null;
                  const colors = STAGE_COLORS[stageId] || STAGE_COLORS.Intermediate;
                  return (
                    <div key={stageId} style={{ paddingBottom: '12px', borderBottom: detectedStageIds.length > 1 ? '1px solid #e5e7eb' : 'none', marginBottom: '8px' }}>
                      {detectedStageIds.length > 1 && (
                        <div style={{ fontWeight: 700, fontSize: '14px', color: colors.text, marginBottom: '8px' }}>🏫 {stageInfo.name}</div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {stageInfo.subjects.map((subj) => {
                          const isSelected = selectedSubjects.includes(subj);
                          return (
                            <button key={subj} onClick={() => toggleSubject(subj)} style={{
                              padding: '4px 12px', fontSize: '12px', borderRadius: '9999px',
                              border: '1px solid',
                              background: isSelected ? colors.chip : colors.chipOff,
                              borderColor: isSelected ? colors.text : '#d1d5db',
                              color: isSelected ? colors.text : '#6b7280',
                              cursor: 'pointer', fontWeight: isSelected ? 700 : 400,
                              transition: 'all 0.15s',
                            }}>
                              {subj}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px' }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 24px', background: '#0d9488', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ' : 'إضافة'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Confirm Delete Modal
// ============================================================
const ConfirmDeleteModal: React.FC<{ name: string; onConfirm: () => void; onCancel: () => void }> = ({ name, onConfirm, onCancel }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
    <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '400px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>تأكيد الحذف</h3>
      <p style={{ margin: '0 0 24px', color: '#4b5563' }}>هل أنت متأكد من حذف "{name}"؟</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={onConfirm} style={{ padding: '8px 24px', background: '#dc2626', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>حذف</button>
      </div>
    </div>
  </div>
);

export default TeachersTab;
