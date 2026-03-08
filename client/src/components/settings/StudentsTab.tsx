import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { studentsApi, StudentData } from '../../api/students';
import { settingsApi, StageConfigData } from '../../api/settings';
import { showSuccess, showError } from '../shared/Toast';
import { SETTINGS_STAGES, CLASS_LETTERS } from '../../utils/constants';

interface StudentRow {
  id: number;
  studentNumber: string;
  name: string;
  stage: string;
  grade: string;
  className: string;
  mobile: string;
}

const StudentsTab: React.FC = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('__all__');
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StudentRow | null>(null);

  const enabledStages = useMemo(() =>
    stages.filter((s) => s.isEnabled && s.grades.some((g) => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([
        studentsApi.getAll(),
        settingsApi.getStructure(),
      ]);
      if (sRes.data?.data) setStudents(sRes.data.data);
      if (stRes.data?.data?.stages) setStages(Array.isArray(stRes.data.data.stages) ? stRes.data.data.stages : []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset grade/class when stage changes
  useEffect(() => { setGradeFilter(''); setClassFilter(''); }, [stageFilter]);
  useEffect(() => { setClassFilter(''); }, [gradeFilter]);

  // Get available grades for current stage
  const availableGrades = useMemo(() => {
    if (stageFilter === '__all__') return [];
    const stageConfig = stages.find((s) => {
      const info = SETTINGS_STAGES.find((si) => si.id === s.stage);
      return info?.name === stageFilter || s.stage === stageFilter;
    });
    if (!stageConfig) return [];
    return stageConfig.grades.filter((g) => g.isEnabled && g.classCount > 0);
  }, [stageFilter, stages]);

  // Get available classes for current grade
  const availableClasses = useMemo(() => {
    if (!gradeFilter) return [];
    const grade = availableGrades.find((g) => g.gradeName === gradeFilter);
    if (!grade) return [];
    return CLASS_LETTERS.slice(0, grade.classCount);
  }, [gradeFilter, availableGrades]);

  // Filter students
  const filteredStudents = useMemo(() => {
    let list = students;

    if (stageFilter !== '__all__') {
      const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
      list = list.filter((s) => s.stage === stageId);
    }
    if (gradeFilter) {
      list = list.filter((s) => s.grade === gradeFilter);
    }
    if (classFilter) {
      list = list.filter((s) => s.className === classFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.studentNumber.includes(q));
    }

    return list;
  }, [students, stageFilter, gradeFilter, classFilter, search]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await studentsApi.delete(confirmDelete.id);
      if (res.data?.success) {
        showSuccess('تم حذف الطالب');
        setConfirmDelete(null);
        loadData();
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // تحديد المرحلة: من الفلتر الحالي أو فارغة (الباكند يكشفها تلقائياً)
    let importStage = '';
    if (stageFilter && stageFilter !== '__all__') {
      const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
      importStage = stageId;
    }

    try {
      const res = await studentsApi.importExcel(file, importStage);
      if (res.data?.success) {
        const d = res.data.data;
        showSuccess(`تم الاستيراد: ${d.added} جديد، ${d.updated} محدّث، ${d.skipped} متجاوز`);
        loadData();
      } else {
        showError(res.data?.message || 'فشل الاستيراد');
      }
    } catch { showError('فشل الاتصال أثناء الاستيراد'); }
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
          <span style={{ color: '#6366f1' }}>👥</span>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>الطلاب</h3>
          <span style={{ padding: '2px 8px', background: '#e0e7ff', color: '#4338ca', fontSize: '14px', borderRadius: '9999px', fontWeight: 700 }}>{filteredStudents.length}</span>
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>/ {students.length} إجمالي</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setModalOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            background: '#f3f4f6', color: '#374151', borderRadius: '8px', fontWeight: 500, border: 'none', cursor: 'pointer',
          }}>
            ➕ إضافة يدوي
          </button>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            background: '#4f46e5', color: '#fff', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
          }}>
            📤 استيراد Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {/* Stage filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#6b7280' }}>المرحلة:</span>
          <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
            <FilterBtn label="الكل" active={stageFilter === '__all__'} onClick={() => setStageFilter('__all__')} />
            {enabledStages.map((stage) => {
              const info = SETTINGS_STAGES.find((s) => s.id === stage.stage);
              return <FilterBtn key={stage.stage} label={info?.name || stage.stage} active={stageFilter === (info?.name || stage.stage)} onClick={() => setStageFilter(info?.name || stage.stage)} />;
            })}
          </div>
        </div>

        {/* Grade filter */}
        {availableGrades.length > 0 && (
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}
            style={{ padding: '6px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }}>
            <option value="">جميع الصفوف</option>
            {availableGrades.map((g) => (
              <option key={g.gradeName} value={g.gradeName}>{g.gradeName}</option>
            ))}
          </select>
        )}

        {/* Class filter */}
        {availableClasses.length > 0 && (
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
            style={{ padding: '6px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }}>
            <option value="">جميع الفصول</option>
            {availableClasses.map((letter) => (
              <option key={letter} value={letter}>{gradeFilter} ({letter})</option>
            ))}
          </select>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الطالب..."
          style={{ width: '100%', height: '40px', padding: '0 16px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }} />
      </div>

      {/* Table */}
      {filteredStudents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}>👥</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا يوجد طلاب</p>
          <p style={{ fontSize: '14px' }}>أضف طالباً أو استورد من Excel</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الطالب</th>
                  <th>الاسم</th>
                  <th>الصف</th>
                  <th>الفصل</th>
                  <th style={{ textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '14px' }}>{s.studentNumber || '-'}</td>
                    <td style={{ fontWeight: 700, color: '#1f2937' }}>{s.name}</td>
                    <td style={{ fontSize: '14px', color: '#4b5563' }}>{s.grade || '-'}</td>
                    <td style={{ fontSize: '14px', color: '#4b5563' }}>{s.className || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => setConfirmDelete(s)} style={{ padding: '6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {modalOpen && (
        <AddStudentModal stages={stages} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); loadData(); }} />
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '400px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>تأكيد الحذف</h3>
            <p style={{ margin: '0 0 24px', color: '#4b5563' }}>هل أنت متأكد من حذف "{confirmDelete.name}"؟</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
              <button onClick={handleDelete} style={{ padding: '8px 24px', background: '#dc2626', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Filter Button
// ============================================================
const FilterBtn: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '6px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
    background: active ? '#fff' : 'transparent',
    color: active ? '#4338ca' : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    border: 'none', cursor: 'pointer',
  }}>
    {label}
  </button>
);

// ============================================================
// Add Student Modal
// ============================================================
interface AddStudentModalProps {
  stages: StageConfigData[];
  onClose: () => void;
  onSaved: () => void;
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ stages, onClose, onSaved }) => {
  const [studentNumber, setStudentNumber] = useState('');
  const [name, setName] = useState('');
  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);

  const enabledStages = stages.filter((s) => s.isEnabled);

  const availableGrades = useMemo(() => {
    const stageConfig = enabledStages.find((s) => s.stage === stage);
    if (!stageConfig) return [];
    return stageConfig.grades.filter((g) => g.isEnabled && g.classCount > 0);
  }, [stage, enabledStages]);

  const availableClasses = useMemo(() => {
    const gradeConfig = availableGrades.find((g) => g.gradeName === grade);
    if (!gradeConfig) return [];
    return CLASS_LETTERS.slice(0, gradeConfig.classCount);
  }, [grade, availableGrades]);

  useEffect(() => { setGrade(''); setClassName(''); }, [stage]);
  useEffect(() => { setClassName(''); }, [grade]);

  const handleSave = async () => {
    if (!name.trim()) { showError('الاسم مطلوب'); return; }
    if (!stage) { showError('المرحلة مطلوبة'); return; }

    setSaving(true);
    const data: StudentData = {
      studentNumber: studentNumber.trim(),
      name: name.trim(),
      stage,
      grade,
      className,
      mobile: mobile.trim(),
    };

    try {
      const res = await studentsApi.add(data);
      if (res.data?.success) {
        showSuccess('تم إضافة الطالب بنجاح');
        onSaved();
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #eef2ff, #e0e7ff)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>إضافة طالب جديد</h3>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>رقم الطالب</label>
            <input type="text" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} maxLength={10}
              style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>الاسم *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>المرحلة *</label>
              <select value={stage} onChange={(e) => setStage(e.target.value)}
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', background: '#fff', boxSizing: 'border-box' }}>
                <option value="">اختر</option>
                {enabledStages.map((s) => {
                  const info = SETTINGS_STAGES.find((si) => si.id === s.stage);
                  return <option key={s.stage} value={s.stage}>{info?.name || s.stage}</option>;
                })}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>الصف</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} disabled={!stage}
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', background: '#fff', boxSizing: 'border-box' }}>
                <option value="">اختر</option>
                {availableGrades.map((g) => (
                  <option key={g.gradeName} value={g.gradeName}>{g.gradeName}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>الفصل</label>
              <select value={className} onChange={(e) => setClassName(e.target.value)} disabled={!grade}
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', background: '#fff', boxSizing: 'border-box' }}>
                <option value="">اختر</option>
                {availableClasses.map((letter) => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>جوال ولي الأمر</label>
              <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05XXXXXXXX"
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 24px', background: '#4f46e5', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'جاري الإضافة...' : 'إضافة'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentsTab;
