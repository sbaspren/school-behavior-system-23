import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { studentsApi } from '../api/students';
import { violationsApi } from '../api/violations';
import { settingsApi, StageConfigData } from '../api/settings';
import { printForm, FormId, PrintFormData, FORM_NAMES } from '../utils/printTemplates';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';

// ===== تعريف بطاقات النماذج =====
interface FormCardDef {
  id: FormId;
  title: string;
  desc: string;
  icon: string;
  color: string;
  requiresStudent: boolean;
  requiresViolation?: boolean;
}

interface FormCategory {
  title: string;
  icon: string;
  color: string;
  forms: FormCardDef[];
}

const FORM_CATEGORIES: FormCategory[] = [
  {
    title: 'المواظبة والغياب',
    icon: '📅',
    color: '#dc2626',
    forms: [
      { id: 'ghiab_bidon_ozr', title: 'متابعة غياب (بدون عذر)', desc: 'سجل تدرج الإجراءات للملف', icon: '🚫', color: '#dc2626', requiresStudent: true },
      { id: 'ghiab_ozr', title: 'إجراءات غياب (بعذر)', desc: 'توثيق الأعذار المقبولة', icon: '✅', color: '#16a34a', requiresStudent: true },
      { id: 'tahood_hodoor', title: 'تعهد التزام بالحضور', desc: 'عند تجاوز الغياب للحد المسموح', icon: '📝', color: '#ea580c', requiresStudent: false },
    ],
  },
  {
    title: 'نماذج الإجراءات السلوكية',
    icon: '⚖️',
    color: '#4f46e5',
    forms: [
      { id: 'iltizam_madrasi', title: 'عقد التزام مدرسي', desc: 'يوقع بداية العام أو عند العودة', icon: '🤝', color: '#4f46e5', requiresStudent: true },
      { id: 'tawid_darajat', title: 'فرص تعويض الدرجات', desc: 'لتحسين الدرجات المحسومة', icon: '📈', color: '#7c3aed', requiresStudent: true, requiresViolation: true },
      { id: 'rasd_tamayuz', title: 'رصد سلوك متميز', desc: 'سجل الطالب للإنجازات', icon: '⭐', color: '#059669', requiresStudent: true },
      { id: 'dawat_wali_amr', title: 'دعوة ولي أمر', desc: 'طلب حضور للمدرسة', icon: '📨', color: '#64748b', requiresStudent: false },
      { id: 'rasd_slooki', title: 'سجل مخالفات (للملف)', desc: 'يوضع في ملف الطالب', icon: '📁', color: '#64748b', requiresStudent: true },
      { id: 'khota_tadeel', title: 'خطة تعديل سلوك', desc: 'للموجه الطلابي', icon: '🧠', color: '#0d9488', requiresStudent: false },
      { id: 'mahdar_dab_wakea', title: 'محضر ضبط واقعة', desc: 'لتوثيق المخالفة', icon: '📋', color: '#b45309', requiresStudent: false },
      { id: 'tawtheeq_tawasol', title: 'توثيق تواصل ولي أمر', desc: 'تسجيل التواصل مع ولي الأمر', icon: '📞', color: '#0891b2', requiresStudent: false },
    ],
  },
  {
    title: 'المحاضر واللجان',
    icon: '👥',
    color: '#d97706',
    forms: [
      { id: 'mahdar_lajnah', title: 'محضر لجنة توجيه (مخالفة)', desc: 'لدراسة مخالفة سلوكية', icon: '👥', color: '#d97706', requiresStudent: false },
      { id: 'mahdar_lajnah_absence', title: 'محضر لجنة توجيه (غياب)', desc: 'لدراسة حالة غياب', icon: '👥', color: '#d97706', requiresStudent: false },
    ],
  },
  {
    title: 'نماذج فارغة للتوزيع',
    icon: '📄',
    color: '#7c3aed',
    forms: [
      { id: 'rasd_moalem', title: 'سجل متابعة معلم', desc: 'طباعة فارغ للتوزيع على المعلمين', icon: '👨‍🏫', color: '#7c3aed', requiresStudent: false },
    ],
  },
  {
    title: 'النماذج السرية والطارئة',
    icon: '🚨',
    color: '#b91c1c',
    forms: [
      { id: 'mashajara', title: 'محضر إثبات واقعة (مشاجرة)', desc: 'واقعة سلوك غير تربوي', icon: '⚡', color: '#b91c1c', requiresStudent: false },
      { id: 'eblagh_etha', title: 'إبلاغ عن إيذاء', desc: 'خاص بمركز البلاغات 1919', icon: '🛡️', color: '#b91c1c', requiresStudent: false },
      { id: 'high_risk', title: 'حالة عالية الخطورة', desc: 'للحالات الطارئة جداً', icon: '🔴', color: '#7f1d1d', requiresStudent: false },
    ],
  },
];

// ===== بيانات الطالب =====
interface StudentOption {
  id: number;
  studentNumber: string;
  name: string;
  stage: string;
  grade: string;
  className: string;
}

interface ViolationOption {
  id: number;
  description: string;
  degree: number;
  hijriDate: string;
  procedures: string;
  deduction: number;
}

// ===== الصفحة الرئيسية =====
const GeneralFormsPage: React.FC = () => {
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<{ schoolName: string; eduAdmin: string; eduDept: string; letterheadMode: string; letterheadImageUrl: string }>({
    schoolName: '', eduAdmin: '', eduDept: '', letterheadMode: 'Text', letterheadImageUrl: '',
  });
  const [loading, setLoading] = useState(true);

  // حالة المودال
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FormCardDef | null>(null);
  const [modalGrade, setModalGrade] = useState('');
  const [modalClass, setModalClass] = useState('');
  const [modalStudent, setModalStudent] = useState<StudentOption | null>(null);
  const [studentViolations, setStudentViolations] = useState<ViolationOption[]>([]);
  const [selectedViolation, setSelectedViolation] = useState<ViolationOption | null>(null);
  const [loadingViolations, setLoadingViolations] = useState(false);

  // حالة التزام مدرسي
  const [iltizamMode, setIltizamMode] = useState<'pick' | 'student' | 'blank' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, stRes, settRes] = await Promise.all([
          studentsApi.getAll(),
          settingsApi.getStructure(),
          settingsApi.getSettings(),
        ]);
        if (sRes.data?.data) setAllStudents(sRes.data.data);
        if (stRes.data?.data?.stages) setStages(stRes.data.data.stages);
        if (settRes.data?.data) {
          const s = settRes.data.data;
          setSchoolSettings({
            schoolName: s.schoolName || '', eduAdmin: s.eduAdmin || '', eduDept: s.eduDept || '',
            letterheadMode: s.letterheadMode || 'Text', letterheadImageUrl: s.letterheadImageUrl || '',
          });
        }
      } catch { /* empty */ }
      finally { setLoading(false); }
    })();
  }, []);

  const enabledStages = useMemo(() =>
    stages.filter(s => s.isEnabled && s.grades.some(g => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  // قوائم الفلاتر
  const grades = useMemo(() => {
    return Array.from(new Set(allStudents.map(s => s.grade))).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allStudents]);

  const classes = useMemo(() => {
    if (!modalGrade) return [];
    return Array.from(new Set(allStudents.filter(s => s.grade === modalGrade).map(s => s.className))).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allStudents, modalGrade]);

  const filteredStudents = useMemo(() => {
    if (!modalGrade || !modalClass) return [];
    return allStudents
      .filter(s => s.grade === modalGrade && s.className === modalClass)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [allStudents, modalGrade, modalClass]);

  // فتح المودال
  const openFormModal = useCallback((form: FormCardDef) => {
    // التزام مدرسي → خيارات
    if (form.id === 'iltizam_madrasi') {
      setSelectedForm(form);
      setIltizamMode('pick');
      return;
    }

    // نموذج لا يحتاج طالب → طباعة مباشرة
    if (!form.requiresStudent) {
      printForm(form.id, {}, schoolSettings);
      showSuccess(`جاري تحضير: ${form.title}`);
      return;
    }

    // نموذج يحتاج طالب → فتح المودال
    setSelectedForm(form);
    setModalGrade('');
    setModalClass('');
    setModalStudent(null);
    setStudentViolations([]);
    setSelectedViolation(null);
    setModalOpen(true);
  }, [schoolSettings]);

  // اختيار طالب → جلب مخالفاته إذا لزم
  const handleStudentSelect = useCallback(async (student: StudentOption) => {
    setModalStudent(student);
    if (selectedForm?.requiresViolation) {
      setLoadingViolations(true);
      try {
        const res = await violationsApi.getAll({ studentId: student.id });
        if (res.data?.data) {
          const vList: ViolationOption[] = res.data.data.map((v: any) => ({
            id: v.id, description: v.description, degree: v.degree,
            hijriDate: v.hijriDate, procedures: v.procedures, deduction: v.deduction,
          }));
          setStudentViolations(vList);
        }
      } catch { showError('خطأ في جلب المخالفات'); }
      finally { setLoadingViolations(false); }
    }
  }, [selectedForm]);

  // تنفيذ الطباعة
  const handlePrint = useCallback(() => {
    if (!selectedForm || !modalStudent) return;

    const data: PrintFormData = {
      studentName: modalStudent.name,
      grade: modalStudent.grade,
      class: modalStudent.className,
    };

    // إضافة تاريخ اليوم
    const today = new Date();
    try {
      data.violationDate = today.toLocaleDateString('ar-SA-u-ca-islamic-umalqura');
      data.violationDay = today.toLocaleDateString('ar-SA', { weekday: 'long' });
    } catch { /* empty */ }

    // إذا النموذج يحتاج مخالفة
    if (selectedForm.requiresViolation && selectedViolation) {
      data.violationInfo = {
        name: selectedViolation.description,
        degree: String(selectedViolation.degree),
        date: selectedViolation.hijriDate,
        points: String(selectedViolation.deduction),
      };
      data.violationText = selectedViolation.description;
      data.violationDegree = selectedViolation.degree;
      data.violationDate = selectedViolation.hijriDate;
    }

    // إذا رصد سلوكي → إرسال كل المخالفات
    if (selectedForm.id === 'rasd_slooki') {
      data.violationsList = studentViolations.map(v => ({
        description: v.description,
        degree: v.degree,
        date: v.hijriDate,
        procedures: v.procedures,
      }));
    }

    printForm(selectedForm.id, data, schoolSettings);
    showSuccess(`جاري طباعة: ${selectedForm.title}`);
    setModalOpen(false);
  }, [selectedForm, modalStudent, selectedViolation, studentViolations, schoolSettings]);

  // طباعة التزام فارغ
  const handleIltizamBlank = useCallback(() => {
    printForm('iltizam_madrasi', {}, schoolSettings);
    showSuccess('جاري طباعة: عقد التزام مدرسي (فارغ)');
    setIltizamMode(null);
  }, [schoolSettings]);

  // التزام مع طالب
  const handleIltizamWithStudent = useCallback(() => {
    setIltizamMode(null);
    setModalGrade('');
    setModalClass('');
    setModalStudent(null);
    setStudentViolations([]);
    setSelectedViolation(null);
    setModalOpen(true);
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>جاري التحميل...</div>;
  }

  const canPrint = modalStudent && (!selectedForm?.requiresViolation || selectedViolation);

  return (
    <div>
      {/* العنوان */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '48px', height: '48px', background: '#fff7ed', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
          📂
        </div>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b', margin: 0 }}>النماذج العامة والإدارية</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>اختر النموذج المطلوب للطباعة</p>
        </div>
      </div>

      {/* الفئات */}
      {FORM_CATEGORIES.map((cat) => (
        <div key={cat.title} style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{cat.icon}</span>
            {cat.title}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {cat.forms.map((form) => (
              <div
                key={form.id}
                onClick={() => openFormModal(form)}
                style={{
                  background: '#fff', padding: '20px', borderRadius: '16px', cursor: 'pointer',
                  border: '2px solid #e5e7eb', transition: 'all 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = form.color; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ width: '36px', height: '36px', background: '#f9fafb', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    {form.icon}
                  </div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: form.color }}>{form.title}</h4>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>{form.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* مودال خيارات التزام مدرسي */}
      {iltizamMode === 'pick' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setIltizamMode(null)}>
          <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '400px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ width: '56px', height: '56px', background: '#eef2ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '28px' }}>🤝</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>عقد الالتزام المدرسي</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>اختر طريقة الطباعة</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={handleIltizamWithStudent} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px',
                border: '2px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'right', width: '100%',
              }}>
                <span style={{ fontSize: '20px' }}>👤</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#1f2937' }}>طباعة ببيانات الطالب</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>اختر الطالب من القائمة</div>
                </div>
              </button>
              <button onClick={handleIltizamBlank} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px',
                border: '2px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'right', width: '100%',
              }}>
                <span style={{ fontSize: '20px' }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#1f2937' }}>طباعة نموذج فارغ</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>للتصوير وتوزيعه على عدة طلاب</div>
                </div>
              </button>
            </div>
            <button onClick={() => setIltizamMode(null)} style={{ width: '100%', marginTop: '16px', padding: '8px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* مودال اختيار الطالب */}
      {modalOpen && selectedForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setModalOpen(false)}>
          <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '480px', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}>

            {/* رأس المودال */}
            <div style={{ padding: '16px 20px', background: 'linear-gradient(to left, #eef2ff, #e0e7ff)', borderBottom: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: '#eef2ff', borderRadius: '10px', border: '2px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                {selectedForm.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>{selectedForm.title}</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>حدد بيانات الطالب للطباعة</p>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
            </div>

            {/* محتوى المودال */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* اختيار الطالب */}
              <div style={{ border: '2px solid #e5e7eb', borderRadius: '16px', padding: '12px', background: '#f9fafb' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px', display: 'block' }}>اختيار الطالب</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {/* الصف */}
                  <select value={modalGrade} onChange={(e) => { setModalGrade(e.target.value); setModalClass(''); setModalStudent(null); setStudentViolations([]); setSelectedViolation(null); }}
                    style={{ padding: '8px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '12px', background: '#fff' }}>
                    <option value="">الصف</option>
                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {/* الفصل */}
                  <select value={modalClass} onChange={(e) => { setModalClass(e.target.value); setModalStudent(null); setStudentViolations([]); setSelectedViolation(null); }}
                    disabled={!modalGrade}
                    style={{ padding: '8px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '12px', background: '#fff', opacity: modalGrade ? 1 : 0.5 }}>
                    <option value="">الفصل</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {/* الطالب */}
                  <select
                    value={modalStudent?.id?.toString() || ''}
                    onChange={(e) => {
                      const st = filteredStudents.find(s => s.id === Number(e.target.value));
                      if (st) handleStudentSelect(st);
                      else { setModalStudent(null); setStudentViolations([]); setSelectedViolation(null); }
                    }}
                    disabled={!modalClass}
                    style={{ padding: '8px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '12px', background: '#fff', fontWeight: 700, opacity: modalClass ? 1 : 0.5 }}>
                    <option value="">الطالب</option>
                    {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* قسم اختيار المخالفة */}
              {selectedForm.requiresViolation && modalStudent && (
                <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚠️</span> اختر المخالفة المراد التعويض عنها
                  </label>
                  {loadingViolations ? (
                    <div style={{ textAlign: 'center', padding: '12px', color: '#9ca3af', fontSize: '13px' }}>جاري التحميل...</div>
                  ) : studentViolations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '12px', color: '#ef4444', fontSize: '13px', background: '#fef2f2', borderRadius: '100px' }}>
                      لا توجد مخالفات مسجلة لهذا الطالب
                    </div>
                  ) : (
                    <select
                      value={selectedViolation?.id?.toString() || ''}
                      onChange={(e) => {
                        const v = studentViolations.find(x => x.id === Number(e.target.value));
                        setSelectedViolation(v || null);
                      }}
                      style={{ width: '100%', padding: '10px 12px', border: '2px solid #fed7aa', borderRadius: '10px', fontSize: '13px', background: '#fff7ed' }}>
                      <option value="">-- اختر المخالفة --</option>
                      {studentViolations.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.hijriDate} - د{v.degree} - {v.description.length > 30 ? v.description.substring(0, 30) + '...' : v.description}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* أزرار */}
            <div style={{ padding: '16px 20px', background: '#f9fafb', borderTop: '2px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '8px 20px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>
                إلغاء
              </button>
              <button
                onClick={handlePrint}
                disabled={!canPrint}
                style={{
                  padding: '8px 24px', background: canPrint ? '#4f46e5' : '#d1d5db', color: '#fff',
                  borderRadius: '12px', fontWeight: 700, border: 'none',
                  cursor: canPrint ? 'pointer' : 'not-allowed', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  opacity: canPrint ? 1 : 0.6,
                }}>
                🖨️ طباعة النموذج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralFormsPage;
