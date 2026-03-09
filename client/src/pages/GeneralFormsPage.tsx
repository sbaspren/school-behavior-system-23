import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { studentsApi } from '../api/students';
import { violationsApi } from '../api/violations';
import { settingsApi, StageConfigData } from '../api/settings';
import { printForm, FormId, PrintFormData, FORM_NAMES } from '../utils/printTemplates';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';

// ===== Types =====
interface FormCardDef {
  id: FormId; title: string; desc: string; icon: string; color: string;
  requiresStudent: boolean; requiresViolation?: boolean; hasSpecialModal?: boolean;
}
interface FormCategory { title: string; icon: string; color: string; forms: FormCardDef[]; }

const FORM_CATEGORIES: FormCategory[] = [
  { title: 'المواظبة والغياب', icon: '📅', color: '#dc2626', forms: [
    { id: 'ghiab_bidon_ozr', title: 'متابعة غياب (بدون عذر)', desc: 'سجل تدرج الإجراءات للملف', icon: '🚫', color: '#dc2626', requiresStudent: true },
    { id: 'ghiab_ozr', title: 'إجراءات غياب (بعذر)', desc: 'توثيق الأعذار المقبولة', icon: '✅', color: '#16a34a', requiresStudent: true },
    { id: 'tahood_hodoor', title: 'تعهد التزام بالحضور', desc: 'عند تجاوز الغياب للحد المسموح', icon: '📝', color: '#ea580c', requiresStudent: false, hasSpecialModal: true },
  ]},
  { title: 'نماذج الإجراءات السلوكية', icon: '⚖️', color: '#4f46e5', forms: [
    { id: 'iltizam_madrasi', title: 'عقد التزام مدرسي', desc: 'يوقع بداية العام أو عند العودة', icon: '🤝', color: '#4f46e5', requiresStudent: true },
    { id: 'tawid_darajat', title: 'فرص تعويض الدرجات', desc: 'لتحسين الدرجات المحسومة', icon: '📈', color: '#7c3aed', requiresStudent: true, requiresViolation: true },
    { id: 'rasd_tamayuz', title: 'رصد سلوك متميز', desc: 'سجل الطالب للإنجازات', icon: '⭐', color: '#059669', requiresStudent: true },
    { id: 'dawat_wali_amr', title: 'دعوة ولي أمر', desc: 'طلب حضور للمدرسة', icon: '📨', color: '#64748b', requiresStudent: false, hasSpecialModal: true },
    { id: 'rasd_slooki', title: 'سجل مخالفات (للملف)', desc: 'يوضع في ملف الطالب', icon: '📁', color: '#64748b', requiresStudent: true },
    { id: 'khota_tadeel', title: 'خطة تعديل سلوك', desc: 'للموجه الطلابي', icon: '🧠', color: '#0d9488', requiresStudent: false, hasSpecialModal: true },
    { id: 'mahdar_dab_wakea', title: 'محضر ضبط واقعة', desc: 'لتوثيق المخالفة', icon: '📋', color: '#b45309', requiresStudent: false, hasSpecialModal: true },
    { id: 'tawtheeq_tawasol', title: 'توثيق تواصل ولي أمر', desc: 'تسجيل التواصل مع ولي الأمر', icon: '📞', color: '#0891b2', requiresStudent: false, hasSpecialModal: true },
  ]},
  { title: 'المحاضر واللجان', icon: '👥', color: '#d97706', forms: [
    { id: 'mahdar_lajnah', title: 'محضر لجنة توجيه (مخالفة)', desc: 'لدراسة مخالفة سلوكية', icon: '👥', color: '#d97706', requiresStudent: false, hasSpecialModal: true },
    { id: 'mahdar_lajnah_absence', title: 'محضر لجنة توجيه (غياب)', desc: 'لدراسة حالة غياب', icon: '👥', color: '#d97706', requiresStudent: false, hasSpecialModal: true },
  ]},
  { title: 'نماذج فارغة للتوزيع', icon: '📄', color: '#7c3aed', forms: [
    { id: 'rasd_moalem', title: 'سجل متابعة معلم', desc: 'طباعة فارغ أو مملوء', icon: '👨‍🏫', color: '#7c3aed', requiresStudent: false, hasSpecialModal: true },
  ]},
  { title: 'النماذج السرية والطارئة', icon: '🚨', color: '#b91c1c', forms: [
    { id: 'mashajara', title: 'محضر إثبات واقعة (مشاجرة)', desc: 'واقعة سلوك غير تربوي', icon: '⚡', color: '#b91c1c', requiresStudent: false, hasSpecialModal: true },
    { id: 'eblagh_etha', title: 'إبلاغ عن إيذاء', desc: 'خاص بمركز البلاغات 1919', icon: '🛡️', color: '#b91c1c', requiresStudent: false, hasSpecialModal: true },
    { id: 'high_risk', title: 'حالة عالية الخطورة', desc: 'للحالات الطارئة جداً', icon: '🔴', color: '#7f1d1d', requiresStudent: false, hasSpecialModal: true },
  ]},
];

interface StudentOption { id: number; studentNumber: string; name: string; stage: string; grade: string; className: string; }
interface ViolationOption { id: number; description: string; degree: number; hijriDate: string; procedures: string; deduction: number; }
interface SchoolSettingsData { schoolName: string; eduAdmin: string; eduDept: string; letterheadMode: string; letterheadImageUrl: string; }

// ===== Utilities =====
const getHijriDate = () => { try { return new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }) + ' هـ'; } catch { return ''; } };
const getDayName = (d?: Date) => ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][(d || new Date()).getDay()];
const getTodayStr = () => new Date().toISOString().split('T')[0];
const hijriFromDate = (dateStr: string) => { try { return new Date(dateStr).toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return dateStr; } };
const getNextWorkday = () => { const d = new Date(); d.setDate(d.getDate() + 1); while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d; };

// ===== Shared styles =====
const OV: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' };
const MB = (w = '460px'): React.CSSProperties => ({ background: '#fff', borderRadius: '16px', width: w, maxWidth: '95vw', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', overflow: 'hidden', direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' });
const FL: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#1a1d2e', marginBottom: '4px', display: 'block' };
const FI: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: '12px', fontSize: '14px', fontFamily: 'inherit', background: '#f4f5f9', outline: 'none', boxSizing: 'border-box' };
const PB: React.CSSProperties = { width: '100%', padding: '12px', background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' };

const MH: React.FC<{ title: string; subtitle?: string; gradient: string; onClose: () => void }> = ({ title, subtitle, gradient, onClose }) => (
  <div style={{ background: `linear-gradient(135deg,${gradient})`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
    <div style={{ flex: 1 }}><div style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>{title}</div>{subtitle && <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}>{subtitle}</div>}</div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px' }}>✕</button>
  </div>
);

// ===== StudentPicker =====
const SP: React.FC<{ students: StudentOption[]; stage: string; onPick: (s: any) => void }> = ({ students, stage, onPick }) => {
  const [g, setG] = useState(''); const [c, setC] = useState(''); const [sid, setSid] = useState('');
  const ss = useMemo(() => students.filter(s => s.stage === stage), [students, stage]);
  const gs = useMemo(() => Array.from(new Set(ss.map(s => s.grade))).sort((a, b) => a.localeCompare(b, 'ar')), [ss]);
  const cs = useMemo(() => g ? Array.from(new Set(ss.filter(s => s.grade === g).map(s => s.className))).sort() : [], [ss, g]);
  const fs = useMemo(() => (g && c) ? ss.filter(s => s.grade === g && s.className === c).sort((a, b) => a.name.localeCompare(b.name, 'ar')) : [], [ss, g, c]);
  const sx: React.CSSProperties = { padding: '8px', border: '1.5px solid #d1d5db', borderRadius: '10px', fontSize: '12px', fontFamily: 'inherit', background: '#fff', width: '100%' };
  useEffect(() => { if (!sid) return; const st = fs.find(s => String(s.id) === sid); if (st) onPick({ studentName: st.name, grade: st.grade, class: st.className, violationDate: getHijriDate(), violationDay: getDayName() }); }, [sid]);
  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px', background: '#f9fafb', marginBottom: '12px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: '#1a1d2e', marginBottom: '8px', display: 'block' }}>اختيار الطالب</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <select value={g} onChange={e => { setG(e.target.value); setC(''); setSid(''); }} style={sx}><option value="">الصف</option>{gs.map(v => <option key={v} value={v}>{v}</option>)}</select>
        <select value={c} onChange={e => { setC(e.target.value); setSid(''); }} disabled={!g} style={{ ...sx, opacity: g ? 1 : 0.5 }}><option value="">الفصل</option>{cs.map(v => <option key={v} value={v}>{v}</option>)}</select>
        <select value={sid} onChange={e => setSid(e.target.value)} disabled={!c} style={{ ...sx, fontWeight: 700, opacity: c ? 1 : 0.5 }}><option value="">الطالب</option>{fs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
    </div>
  );
};

// ===== MAIN PAGE =====
const GeneralFormsPage: React.FC = () => {
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [currentStage, setCurrentStage] = useState('');
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettingsData>({ schoolName: '', eduAdmin: '', eduDept: '', letterheadMode: 'Text', letterheadImageUrl: '' });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FormCardDef | null>(null);
  const [modalGrade, setModalGrade] = useState(''); const [modalClass, setModalClass] = useState('');
  const [modalStudent, setModalStudent] = useState<StudentOption | null>(null);
  const [studentViolations, setStudentViolations] = useState<ViolationOption[]>([]);
  const [selectedViolation, setSelectedViolation] = useState<ViolationOption | null>(null);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [specialModal, setSpecialModal] = useState<FormId | null>(null);
  const [iltizamMode, setIltizamMode] = useState<'pick' | null>(null);

  useEffect(() => { (async () => { try {
    const [sR, stR, seR] = await Promise.all([studentsApi.getAll(), settingsApi.getStructure(), settingsApi.getSettings()]);
    if (sR.data?.data) setAllStudents(sR.data.data);
    if (stR.data?.data?.stages) { setStages(stR.data.data.stages); const en = (stR.data.data.stages as StageConfigData[]).filter(s => s.isEnabled && s.grades.some(g => g.isEnabled && g.classCount > 0)); if (en.length > 0) setCurrentStage(en[0].stage); }
    if (seR.data?.data) { const s = seR.data.data; setSchoolSettings({ schoolName: s.schoolName||'', eduAdmin: s.eduAdmin||'', eduDept: s.eduDept||'', letterheadMode: s.letterheadMode||'Text', letterheadImageUrl: s.letterheadImageUrl||'' }); }
  } catch {} finally { setLoading(false); } })(); }, []);

  const enabledStages = useMemo(() => stages.filter(s => s.isEnabled && s.grades.some(g => g.isEnabled && g.classCount > 0)), [stages]);
  const grades = useMemo(() => Array.from(new Set(allStudents.filter(s => !currentStage || s.stage === currentStage).map(s => s.grade))).sort((a, b) => a.localeCompare(b, 'ar')), [allStudents, currentStage]);
  const classes = useMemo(() => modalGrade ? Array.from(new Set(allStudents.filter(s => s.grade === modalGrade && (!currentStage || s.stage === currentStage)).map(s => s.className))).sort() : [], [allStudents, modalGrade, currentStage]);
  const filteredStudents = useMemo(() => (modalGrade && modalClass) ? allStudents.filter(s => s.grade === modalGrade && s.className === modalClass && (!currentStage || s.stage === currentStage)).sort((a, b) => a.name.localeCompare(b.name, 'ar')) : [], [allStudents, modalGrade, modalClass, currentStage]);

  const openFormModal = useCallback((form: FormCardDef) => {
    if (form.id === 'iltizam_madrasi') { setSelectedForm(form); setIltizamMode('pick'); return; }
    if (form.hasSpecialModal) { setSpecialModal(form.id); return; }
    if (!form.requiresStudent) { printForm(form.id, {}, schoolSettings); showSuccess(`جاري تحضير: ${form.title}`); return; }
    setSelectedForm(form); setModalGrade(''); setModalClass(''); setModalStudent(null); setStudentViolations([]); setSelectedViolation(null); setModalOpen(true);
  }, [schoolSettings]);

  const handleStudentSelect = useCallback(async (student: StudentOption) => {
    setModalStudent(student);
    if (selectedForm?.requiresViolation) { setLoadingViolations(true); try { const r = await violationsApi.getAll({ studentId: student.id }); if (r.data?.data) setStudentViolations(r.data.data.map((v: any) => ({ id: v.id, description: v.description, degree: v.degree, hijriDate: v.hijriDate, procedures: v.procedures, deduction: v.deduction }))); } catch { showError('خطأ في جلب المخالفات'); } finally { setLoadingViolations(false); } }
  }, [selectedForm]);

  const handlePrint = useCallback(() => {
    if (!selectedForm || !modalStudent) return;
    const data: PrintFormData = { studentName: modalStudent.name, grade: modalStudent.grade, class: modalStudent.className };
    try { data.violationDate = new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura'); data.violationDay = new Date().toLocaleDateString('ar-SA', { weekday: 'long' }); } catch {}
    if (selectedForm.requiresViolation && selectedViolation) { data.violationInfo = { name: selectedViolation.description, degree: String(selectedViolation.degree), date: selectedViolation.hijriDate, points: String(selectedViolation.deduction) }; data.violationText = selectedViolation.description; data.violationDegree = selectedViolation.degree; data.violationDate = selectedViolation.hijriDate; }
    if (selectedForm.id === 'rasd_slooki') data.violationsList = studentViolations.map(v => ({ description: v.description, degree: v.degree, date: v.hijriDate, procedures: v.procedures }));
    printForm(selectedForm.id, data, schoolSettings); showSuccess(`جاري طباعة: ${selectedForm.title}`); setModalOpen(false);
  }, [selectedForm, modalStudent, selectedViolation, studentViolations, schoolSettings]);

  const handleSpecialPrint = useCallback((formId: FormId, data: any) => { printForm(formId, data, schoolSettings); showSuccess('جاري طباعة النموذج'); setSpecialModal(null); }, [schoolSettings]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>جاري التحميل...</div>;
  const canPrint = modalStudent && (!selectedForm?.requiresViolation || selectedViolation);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '48px', height: '48px', background: '#fff7ed', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📂</div>
        <div><h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b', margin: 0 }}>النماذج العامة والإدارية</h1><p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>اختر النموذج المطلوب للطباعة</p></div>
      </div>
      {enabledStages.length > 1 && <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>{enabledStages.map(s => <button key={s.stage} onClick={() => setCurrentStage(s.stage)} style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: currentStage === s.stage ? '#4f46e5' : '#f3f4f6', color: currentStage === s.stage ? '#fff' : '#374151', border: 'none' }}>{SETTINGS_STAGES.find(st => st.id === s.stage)?.name || s.stage}</button>)}</div>}
      {FORM_CATEGORIES.map(cat => (
        <div key={cat.title} style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>{cat.icon}</span>{cat.title}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {cat.forms.map(form => (
              <div key={form.id} onClick={() => openFormModal(form)} style={{ background: '#fff', padding: '20px', borderRadius: '16px', cursor: 'pointer', border: '2px solid #e5e7eb', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = form.color; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ width: '36px', height: '36px', background: '#f9fafb', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{form.icon}</div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: form.color }}>{form.title}</h4>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>{form.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Iltizam options */}
      {iltizamMode === 'pick' && <div style={OV} onClick={() => setIltizamMode(null)}><div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '400px', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}><div style={{ width: '56px', height: '56px', background: '#eef2ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '28px' }}>🤝</div><h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>عقد الالتزام المدرسي</h3><p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>اختر طريقة الطباعة</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => { setIltizamMode(null); setSelectedForm(FORM_CATEGORIES[1].forms[0]); setModalGrade(''); setModalClass(''); setModalStudent(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', border: '2px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'right', width: '100%' }}><span style={{ fontSize: '20px' }}>👤</span><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>طباعة ببيانات الطالب</div><div style={{ fontSize: '12px', color: '#9ca3af' }}>اختر الطالب من القائمة</div></div></button>
          <button onClick={() => { setIltizamMode(null); printForm('iltizam_madrasi', { studentName: '', grade: '', violationDay: '', violationDate: '' }, schoolSettings); showSuccess('جاري طباعة: عقد التزام (فارغ)'); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', border: '2px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'right', width: '100%' }}><span style={{ fontSize: '20px' }}>📄</span><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>طباعة نموذج فارغ</div><div style={{ fontSize: '12px', color: '#9ca3af' }}>للتصوير وتوزيعه على عدة طلاب</div></div></button>
        </div>
        <button onClick={() => setIltizamMode(null)} style={{ width: '100%', marginTop: '16px', padding: '8px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>إلغاء</button>
      </div></div>}

      {/* Basic student picker modal */}
      {modalOpen && selectedForm && <div style={OV} onClick={() => setModalOpen(false)}><div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '480px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', background: 'linear-gradient(to left, #eef2ff, #e0e7ff)', borderBottom: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: '#eef2ff', borderRadius: '10px', border: '2px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{selectedForm.icon}</div>
          <div style={{ flex: 1 }}><h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{selectedForm.title}</h3><p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>حدد بيانات الطالب للطباعة</p></div>
          <button onClick={() => setModalOpen(false)} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ border: '2px solid #e5e7eb', borderRadius: '16px', padding: '12px', background: '#f9fafb' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px', display: 'block' }}>اختيار الطالب</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <select value={modalGrade} onChange={e => { setModalGrade(e.target.value); setModalClass(''); setModalStudent(null); setStudentViolations([]); setSelectedViolation(null); }} style={{ padding: '8px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '12px', background: '#fff' }}><option value="">الصف</option>{grades.map(g => <option key={g} value={g}>{g}</option>)}</select>
              <select value={modalClass} onChange={e => { setModalClass(e.target.value); setModalStudent(null); setStudentViolations([]); setSelectedViolation(null); }} disabled={!modalGrade} style={{ padding: '8px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '12px', background: '#fff', opacity: modalGrade ? 1 : 0.5 }}><option value="">الفصل</option>{classes.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <select value={modalStudent?.id?.toString() || ''} onChange={e => { const st = filteredStudents.find(s => s.id === Number(e.target.value)); if (st) handleStudentSelect(st); else { setModalStudent(null); setStudentViolations([]); setSelectedViolation(null); } }} disabled={!modalClass} style={{ padding: '8px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '12px', background: '#fff', fontWeight: 700, opacity: modalClass ? 1 : 0.5 }}><option value="">الطالب</option>{filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </div>
          </div>
          {selectedForm.requiresViolation && modalStudent && <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><span>⚠️</span> اختر المخالفة</label>
            {loadingViolations ? <div style={{ textAlign: 'center', padding: '12px', color: '#9ca3af', fontSize: '13px' }}>جاري التحميل...</div>
              : studentViolations.length === 0 ? <div style={{ textAlign: 'center', padding: '12px', color: '#ef4444', fontSize: '13px', background: '#fef2f2', borderRadius: '100px' }}>لا توجد مخالفات</div>
              : <select value={selectedViolation?.id?.toString() || ''} onChange={e => setSelectedViolation(studentViolations.find(x => x.id === Number(e.target.value)) || null)} style={{ width: '100%', padding: '10px 12px', border: '2px solid #fed7aa', borderRadius: '10px', fontSize: '13px', background: '#fff7ed' }}><option value="">-- اختر المخالفة --</option>{studentViolations.map(v => <option key={v.id} value={v.id}>{v.hijriDate} - د{v.degree} - {v.description.length > 30 ? v.description.substring(0, 30) + '...' : v.description}</option>)}</select>}
          </div>}
        </div>
        <div style={{ padding: '16px 20px', background: '#f9fafb', borderTop: '2px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={() => setModalOpen(false)} style={{ padding: '8px 20px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>إلغاء</button>
          <button onClick={handlePrint} disabled={!canPrint} style={{ padding: '8px 24px', background: canPrint ? '#4f46e5' : '#d1d5db', color: '#fff', borderRadius: '12px', fontWeight: 700, border: 'none', cursor: canPrint ? 'pointer' : 'not-allowed', opacity: canPrint ? 1 : 0.6 }}>🖨️ طباعة</button>
        </div>
      </div></div>}

      {/* Specialized modals */}
      {specialModal === 'dawat_wali_amr' && <DawatM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'tawtheeq_tawasol' && <TawtheeqM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'mahdar_dab_wakea' && <MahdarM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'mahdar_lajnah' && <LajnahM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'mahdar_lajnah_absence' && <LajnahAbsM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'tahood_hodoor' && <TahoodM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'high_risk' && <HighRiskM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'eblagh_etha' && <EblaghM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'khota_tadeel' && <KhotaM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'mashajara' && <MashajaraM sts={allStudents} stg={currentStage} onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
      {specialModal === 'rasd_moalem' && <RasdM onP={handleSpecialPrint} onC={() => setSpecialModal(null)} />}
    </div>
  );
};

// =============== SPECIALIZED MODAL COMPONENTS ===============
type MP = { sts: StudentOption[]; stg: string; onP: (id: FormId, d: any) => void; onC: () => void };

// ★ دعوة ولي أمر
const DawatM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const nd = getNextWorkday(); const [pk, setPk] = useState<any>(null);
  const [dy, setDy] = useState(getDayName(nd)); const [dt, setDt] = useState(nd.toISOString().split('T')[0]);
  const [hp, setHp] = useState(hijriFromDate(nd.toISOString().split('T')[0]) + ' هـ');
  const [tm, setTm] = useState('٩:٠٠'); const [mt, setMt] = useState('وكيل المدرسة'); const [rs, setRs] = useState('لمناقشة المستوى السلوكي للطالب');
  const hdc = (v: string) => { setDt(v); const d = new Date(v); if (!isNaN(d.getTime())) { setDy(getDayName(d)); setHp(hijriFromDate(v) + ' هـ'); } };
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB('440px')} onClick={e => e.stopPropagation()}>
    <MH title="دعوة ولي أمر طالب" gradient="#f59e0b,#d97706" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>اليوم</label><select value={dy} onChange={e => setDy(e.target.value)} style={FI}>{['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'].map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label style={FL}>التاريخ</label><input type="date" value={dt} onChange={e => hdc(e.target.value)} style={FI} /><div style={{ fontSize: '13px', color: '#059669', fontWeight: 700, marginTop: '4px', textAlign: 'center' }}>{hp}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>الساعة</label><select value={tm} onChange={e => setTm(e.target.value)} style={FI}>{['٧:٣٠','٨:٠٠','٨:٣٠','٩:٠٠','٩:٣٠','١٠:٠٠','١٠:٣٠','١١:٠٠','١١:٣٠','١٢:٠٠'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label style={FL}>وذلك لمقابلة</label><select value={mt} onChange={e => setMt(e.target.value)} style={FI}>{['إدارة المدرسة','وكيل المدرسة','الموجه الطلابي'].map(m => <option key={m}>{m}</option>)}</select></div>
      </div>
      <div><label style={FL}>الهدف من الزيارة</label><input type="text" value={rs} onChange={e => setRs(e.target.value)} style={FI} /></div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } onP('dawat_wali_amr', { ...pk, visitDay: dy, visitDate: hijriFromDate(dt), visitTime: tm, visitMeeting: mt, visitReason: rs }); }} style={PB}>🖨️ طباعة الدعوة</button>
    </div>
  </div></div>;
};

// ★ توثيق التواصل
const TawtheeqM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const [pk, setPk] = useState<any>(null); const [dy, setDy] = useState(getDayName()); const [dt, setDt] = useState(getTodayStr());
  const [ct, setCt] = useState('اتصال هاتفي'); const [rs, setRs] = useState(''); const [rl, setRl] = useState('تم التواصل بنجاح'); const [nt, setNt] = useState('');
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB()} onClick={e => e.stopPropagation()}>
    <MH title="توثيق التواصل مع ولي الأمر" gradient="#0891b2,#06b6d4" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>اليوم</label><select value={dy} onChange={e => setDy(e.target.value)} style={FI}>{['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'].map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label style={FL}>التاريخ</label><input type="date" value={dt} onChange={e => { setDt(e.target.value); setDy(getDayName(new Date(e.target.value))); }} style={FI} /></div>
      </div>
      <div><label style={FL}>طريقة التواصل</label><select value={ct} onChange={e => setCt(e.target.value)} style={FI}>{['اتصال هاتفي','حضوري','رسالة نصية'].map(t => <option key={t}>{t}</option>)}</select></div>
      <div><label style={FL}>سبب التواصل</label><input type="text" value={rs} onChange={e => setRs(e.target.value)} placeholder="مثال: لمناقشة المستوى السلوكي" style={FI} /></div>
      <div><label style={FL}>نتيجة التواصل</label><input type="text" value={rl} onChange={e => setRl(e.target.value)} style={FI} /></div>
      <div><label style={FL}>ملاحظات</label><input type="text" value={nt} onChange={e => setNt(e.target.value)} placeholder="اختياري" style={FI} /></div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } onP('tawtheeq_tawasol', { ...pk, contactDay: dy, contactDate: hijriFromDate(dt), contactType: ct, contactReason: rs, contactResult: rl, contactNotes: nt }); }} style={PB}>🖨️ طباعة التوثيق</button>
    </div>
  </div></div>;
};

// ★ محضر ضبط واقعة
const MahdarM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const [pk, setPk] = useState<any>(null); const [pb, setPb] = useState(''); const [loc, setLoc] = useState('');
  const obsT = ['إفادة شاهد','صور / فيديو','أدوات مضبوطة','تقرير طبي','أخرى'];
  const [oc, setOc] = useState<boolean[]>(new Array(5).fill(false)); const [oo, setOo] = useState('');
  const [ws, setWs] = useState([{ role: 'إداري', name: '' }]);
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB('500px')} onClick={e => e.stopPropagation()}>
    <MH title="محضر ضبط واقعة / مخالفة" gradient="#d97706,#f59e0b" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div><label style={FL}>وصف المشكلة</label><textarea value={pb} onChange={e => setPb(e.target.value)} rows={2} placeholder="بسبب قيامه بـ..." style={{ ...FI, resize: 'vertical' }} /></div>
      <div><label style={FL}>مكان الضبط</label><input type="text" value={loc} onChange={e => setLoc(e.target.value)} placeholder="الفناء، الفصل..." style={FI} /></div>
      <div><label style={FL}>المشاهدات</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {obsT.map((t, i) => <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}><input type="checkbox" checked={oc[i]} onChange={() => { const n = [...oc]; n[i] = !n[i]; setOc(n); }} /> {t}</label>)}
      </div>{oc[4] && <input type="text" value={oo} onChange={e => setOo(e.target.value)} placeholder="نوع آخر..." style={{ ...FI, marginTop: '8px' }} />}</div>
      <div><label style={FL}>شهود الواقعة</label>
        {ws.map((w, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '6px' }}>
          <select value={w.role} onChange={e => { const n = [...ws]; n[i] = { ...n[i], role: e.target.value }; setWs(n); }} style={{ padding: '8px', border: '1.5px solid #d1d5db', borderRadius: '10px', fontSize: '13px', background: '#f4f5f9' }}>{['إداري','معلم','طالب'].map(r => <option key={r}>{r}</option>)}</select>
          <input type="text" value={w.name} onChange={e => { const n = [...ws]; n[i] = { ...n[i], name: e.target.value }; setWs(n); }} placeholder="اسم الشاهد" style={{ padding: '8px', border: '1.5px solid #d1d5db', borderRadius: '10px', fontSize: '13px', background: '#f4f5f9' }} />
        </div>)}
        <button onClick={() => setWs([...ws, { role: 'إداري', name: '' }])} style={{ padding: '6px 14px', border: '1.5px dashed #6366f1', borderRadius: '10px', background: '#fff', color: '#4f46e5', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+ إضافة شاهد</button>
      </div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } const obs: string[] = []; obsT.forEach((t, i) => { if (oc[i]) obs.push(t === 'أخرى' ? oo : t); }); onP('mahdar_dab_wakea', { ...pk, violationText: pb, mahdarLocation: loc, mahdarObservations: obs, mahdarWitnesses: ws.filter(w => w.name.trim()) }); }} style={PB}>🖨️ طباعة المحضر</button>
    </div>
  </div></div>;
};

// ★ لجنة مخالفة
const LajnahM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const [pk, setPk] = useState<any>(null); const [ds, setDs] = useState(''); const [dg, setDg] = useState('١'); const [pv, setPv] = useState(''); const [rc, setRc] = useState('');
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB('480px')} onClick={e => e.stopPropagation()}>
    <MH title="محضر لجنة التوجيه (مخالفة)" gradient="#d97706,#f59e0b" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
        <div><label style={FL}>وصف المخالفة</label><input type="text" value={ds} onChange={e => setDs(e.target.value)} placeholder="نص المخالفة" style={FI} /></div>
        <div><label style={FL}>الدرجة</label><select value={dg} onChange={e => setDg(e.target.value)} style={FI}>{['١','٢','٣','٤','٥'].map(d => <option key={d}>{d}</option>)}</select></div>
      </div>
      <div><label style={FL}>الإجراءات السابقة</label><textarea value={pv} onChange={e => setPv(e.target.value)} rows={3} placeholder="١. ........" style={{ ...FI, resize: 'vertical' }} /></div>
      <div><label style={FL}>التوصيات والقرارات</label><textarea value={rc} onChange={e => setRc(e.target.value)} rows={3} placeholder="١. ........" style={{ ...FI, resize: 'vertical' }} /></div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } onP('mahdar_lajnah', { ...pk, violationText: ds, violationDegree: dg, lajnahPrevProcedures: pv, lajnahRecommendations: rc }); }} style={PB}>🖨️ طباعة المحضر</button>
    </div>
  </div></div>;
};

// ★ لجنة غياب
const LajnahAbsM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const [pk, setPk] = useState<any>(null); const [ue, setUe] = useState(''); const [ex, setEx] = useState(''); const [pv, setPv] = useState(''); const [rc, setRc] = useState('');
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB()} onClick={e => e.stopPropagation()}>
    <MH title="محضر لجنة التوجيه (غياب)" gradient="#d97706,#f59e0b" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>أيام بدون عذر</label><input type="text" value={ue} onChange={e => setUe(e.target.value)} placeholder="0" style={FI} /></div>
        <div><label style={FL}>أيام بعذر</label><input type="text" value={ex} onChange={e => setEx(e.target.value)} placeholder="0" style={FI} /></div>
      </div>
      <div><label style={FL}>الإجراءات السابقة</label><textarea value={pv} onChange={e => setPv(e.target.value)} rows={3} style={{ ...FI, resize: 'vertical' }} /></div>
      <div><label style={FL}>التوصيات والقرارات</label><textarea value={rc} onChange={e => setRc(e.target.value)} rows={3} style={{ ...FI, resize: 'vertical' }} /></div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } onP('mahdar_lajnah_absence', { ...pk, lajnahPrevProcedures: pv, lajnahRecommendations: rc, unexcusedDays: ue || '0', excusedDays: ex || '0' }); }} style={PB}>🖨️ طباعة المحضر</button>
    </div>
  </div></div>;
};

// ★ تعهد حضور
const TahoodM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const [pk, setPk] = useState<any>(null); const [ue, setUe] = useState(''); const [ex, setEx] = useState('');
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB('420px')} onClick={e => e.stopPropagation()}>
    <MH title="تعهد التزام بالحضور" gradient="#ea580c,#f97316" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>أيام بدون عذر</label><input type="text" value={ue} onChange={e => setUe(e.target.value)} placeholder="5" style={FI} /></div>
        <div><label style={FL}>أيام بعذر</label><input type="text" value={ex} onChange={e => setEx(e.target.value)} placeholder="3" style={FI} /></div>
      </div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } onP('tahood_hodoor', { ...pk, unexcusedDays: ue || '0', excusedDays: ex || '0' }); }} style={PB}>🖨️ طباعة التعهد</button>
    </div>
  </div></div>;
};

// ★ حالة عالية الخطورة
const HighRiskM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const rts = ['حيازة سلاح','مخدرات','تهديد بالعنف','مضاربة جماعية','تحرش'];
  const [pk, setPk] = useState<any>(null); const [rc, setRc] = useState<boolean[]>(new Array(5).fill(false));
  const [oth, setOth] = useState(false); const [ot, setOt] = useState(''); const [ds, setDs] = useState('');
  const [ob, setOb] = useState(''); const [dt, setDt] = useState(getTodayStr()); const [tm, setTm] = useState('٩:٠٠');
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB('480px')} onClick={e => e.stopPropagation()}>
    <MH title="حالة عالية الخطورة" gradient="#dc2626,#ef4444" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div><label style={FL}>نوع الخطر</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {rts.map((t, i) => <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}><input type="checkbox" checked={rc[i]} onChange={() => { const n = [...rc]; n[i] = !n[i]; setRc(n); }} /> {t}</label>)}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}><input type="checkbox" checked={oth} onChange={() => setOth(!oth)} /> أخرى</label>
      </div>{oth && <input type="text" value={ot} onChange={e => setOt(e.target.value)} placeholder="نوع آخر..." style={{ ...FI, marginTop: '8px' }} />}</div>
      <div><label style={FL}>وصف الحالة</label><textarea value={ds} onChange={e => setDs(e.target.value)} rows={3} placeholder="وصف تفصيلي..." style={{ ...FI, resize: 'vertical' }} /></div>
      <div><label style={FL}>اسم راصد الحالة</label><input type="text" value={ob} onChange={e => setOb(e.target.value)} style={FI} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>التاريخ</label><input type="date" value={dt} onChange={e => setDt(e.target.value)} style={FI} /></div>
        <div><label style={FL}>الوقت</label><select value={tm} onChange={e => setTm(e.target.value)} style={FI}>{['٧:٠٠','٧:٣٠','٨:٠٠','٨:٣٠','٩:٠٠','٩:٣٠','١٠:٠٠','١٠:٣٠','١١:٠٠','١١:٣٠','١٢:٠٠','١٢:٣٠','١:٠٠'].map(t => <option key={t}>{t}</option>)}</select></div>
      </div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } const types: string[] = []; rts.forEach((t, i) => { if (rc[i]) types.push(t); }); if (oth && ot) types.push(ot); onP('high_risk', { ...pk, riskTypes: types, riskDesc: ds, riskObserver: ob, riskDate: hijriFromDate(dt), riskTime: tm }); }} style={PB}>🖨️ طباعة النموذج</button>
    </div>
  </div></div>;
};

// ★ إبلاغ إيذاء
const EblaghM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const [pk, setPk] = useState<any>(null); const [rp, setRp] = useState(''); const [rl, setRl] = useState('');
  const [sm, setSm] = useState(''); const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [p3, setP3] = useState('');
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB()} onClick={e => e.stopPropagation()}>
    <MH title="رصد وإبلاغ عن حالة إيذاء" gradient="#dc2626,#ef4444" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>اسم المُبَلِّغ</label><input type="text" value={rp} onChange={e => setRp(e.target.value)} placeholder="اسم الراصد" style={FI} /></div>
        <div><label style={FL}>صفته</label><input type="text" value={rl} onChange={e => setRl(e.target.value)} placeholder="معلم، وكيل..." style={FI} /></div>
      </div>
      <div><label style={FL}>ملخص الحالة</label><textarea value={sm} onChange={e => setSm(e.target.value)} rows={3} style={{ ...FI, resize: 'vertical' }} /></div>
      <div><label style={FL}>الإجراء الأول</label><input type="text" value={p1} onChange={e => setP1(e.target.value)} style={FI} /></div>
      <div><label style={FL}>الإجراء الثاني</label><input type="text" value={p2} onChange={e => setP2(e.target.value)} placeholder="اختياري" style={FI} /></div>
      <div><label style={FL}>الإجراء الثالث</label><input type="text" value={p3} onChange={e => setP3(e.target.value)} placeholder="اختياري" style={FI} /></div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } onP('eblagh_etha', { ...pk, eblaghReporter: rp, eblaghRole: rl, eblaghSummary: sm, eblaghProcedures: [p1, p2, p3].filter(p => p.trim()) }); }} style={PB}>🖨️ طباعة النموذج</button>
    </div>
  </div></div>;
};

// ★ خطة تعديل سلوك
const KhotaM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const [pk, setPk] = useState<any>(null); const [db, setDb] = useState(''); const [ag, setAg] = useState('');
  const [st, setSt] = useState(getTodayStr()); const [en, setEn] = useState('');
  const [pb, setPb] = useState(''); const [dg, setDg] = useState('١'); const [ds, setDs] = useState('');
  const [m1, setM1] = useState(''); const [m2, setM2] = useState('');
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB('480px')} onClick={e => e.stopPropagation()}>
    <MH title="خطة تعديل سلوك" gradient="#0d9488,#14b8a6" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SP students={sts} stage={stg} onPick={setPk} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>تاريخ الميلاد</label><input type="date" value={db} onChange={e => setDb(e.target.value)} style={FI} /></div>
        <div><label style={FL}>العمر</label><input type="text" value={ag} onChange={e => setAg(e.target.value)} placeholder="١٢ سنة" style={FI} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={FL}>تاريخ البداية</label><input type="date" value={st} onChange={e => setSt(e.target.value)} style={FI} /></div>
        <div><label style={FL}>تاريخ النهاية</label><input type="date" value={en} onChange={e => setEn(e.target.value)} style={FI} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
        <div><label style={FL}>المشكلة السلوكية</label><input type="text" value={pb} onChange={e => setPb(e.target.value)} style={FI} /></div>
        <div><label style={FL}>الدرجة</label><select value={dg} onChange={e => setDg(e.target.value)} style={FI}>{['١','٢','٣','٤','٥'].map(d => <option key={d}>{d}</option>)}</select></div>
      </div>
      <div><label style={FL}>وصف المشكلة</label><textarea value={ds} onChange={e => setDs(e.target.value)} rows={2} style={{ ...FI, resize: 'vertical' }} /></div>
      <div><label style={FL}>المظهر السلوكي الأول</label><input type="text" value={m1} onChange={e => setM1(e.target.value)} style={FI} /></div>
      <div><label style={FL}>المظهر السلوكي الثاني</label><input type="text" value={m2} onChange={e => setM2(e.target.value)} style={FI} /></div>
      <button onClick={() => { if (!pk) { showError('اختر طالباً'); return; } onP('khota_tadeel', { ...pk, khotaDob: hijriFromDate(db), khotaAge: ag, khotaStart: hijriFromDate(st), khotaEnd: hijriFromDate(en), khotaProblem: pb, khotaDegree: dg, khotaDesc: ds, khotaManifestations: [m1, m2].filter(m => m.trim()) }); }} style={PB}>🖨️ طباعة الخطة</button>
    </div>
  </div></div>;
};

// ★ مشاجرة
const MashajaraM: React.FC<MP> = ({ sts, stg, onP, onC }) => {
  const ss = useMemo(() => sts.filter(s => s.stage === stg), [sts, stg]);
  const gds = useMemo(() => Array.from(new Set(ss.map(s => s.grade))).sort((a, b) => a.localeCompare(b, 'ar')), [ss]);
  const [dy, setDy] = useState(getDayName()); const [dt, setDt] = useState(getTodayStr()); const [tm, setTm] = useState('٩:٠٠'); const [lc, setLc] = useState('');
  const [mg, setMg] = useState(''); const [mc, setMc] = useState(''); const [ms, setMs] = useState('');
  const [as2, setAs2] = useState<{ id: string; name: string; grade: string }[]>([]); const [ini, setIni] = useState(''); const [ds, setDs] = useState('');
  const [pd, setPd] = useState(['']); const [md, setMd] = useState(['']);
  const [au, setAu] = useState([{ role: '', name: '' }]);
  const mcs = useMemo(() => mg ? Array.from(new Set(ss.filter(s => s.grade === mg).map(s => s.className))).sort() : [], [ss, mg]);
  const mfs = useMemo(() => (mg && mc) ? ss.filter(s => s.grade === mg && s.className === mc).sort((a, b) => a.name.localeCompare(b.name, 'ar')) : [], [ss, mg, mc]);
  const sx2: React.CSSProperties = { padding: '8px', border: '1.5px solid #d1d5db', borderRadius: '10px', fontSize: '12px', background: '#fff', width: '100%' };
  const addS = () => { if (!ms) return; if (as2.find(s => s.id === ms)) { showError('مضاف مسبقاً'); return; } if (as2.length >= 12) { showError('الحد ١٢'); return; } const st = mfs.find(s => String(s.id) === ms); if (st) { setAs2([...as2, { id: ms, name: st.name, grade: st.grade + '/' + st.className }]); setMs(''); } };
  const roles = ['','مدير المدرسة','وكيل الشؤون التعليمية','وكيل شؤون الطلاب','الموجه الطلابي','المعلم','الإداري'];
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB('560px')} onClick={e => e.stopPropagation()}>
    <MH title="محضر إثبات واقعة (مشاجرة)" gradient="#dc2626,#ef4444" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div><label style={FL}>اليوم</label><select value={dy} onChange={e => setDy(e.target.value)} style={FI}>{['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'].map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label style={FL}>التاريخ</label><input type="date" value={dt} onChange={e => { setDt(e.target.value); setDy(getDayName(new Date(e.target.value))); }} style={FI} /></div>
        <div><label style={FL}>الساعة</label><select value={tm} onChange={e => setTm(e.target.value)} style={FI}>{['٧:٠٠','٧:٣٠','٨:٠٠','٨:٣٠','٩:٠٠','٩:٣٠','١٠:٠٠','١٠:٣٠','١١:٠٠','١١:٣٠','١٢:٠٠','١٢:٣٠','١:٠٠'].map(t => <option key={t}>{t}</option>)}</select></div>
      </div>
      <div><label style={FL}>المكان</label><input type="text" value={lc} onChange={e => setLc(e.target.value)} placeholder="الفناء، الممر..." style={FI} /></div>
      <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px', background: '#f9fafb' }}>
        <label style={{ ...FL, marginBottom: '8px' }}>أطراف النزاع (٢-١٢ طالب)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <select value={mg} onChange={e => { setMg(e.target.value); setMc(''); setMs(''); }} style={sx2}><option value="">الصف</option>{gds.map(g => <option key={g} value={g}>{g}</option>)}</select>
          <select value={mc} onChange={e => { setMc(e.target.value); setMs(''); }} disabled={!mg} style={{ ...sx2, opacity: mg ? 1 : 0.5 }}><option value="">الفصل</option>{mcs.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select value={ms} onChange={e => setMs(e.target.value)} disabled={!mc} style={{ ...sx2, opacity: mc ? 1 : 0.5 }}><option value="">الطالب</option>{mfs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <button onClick={addS} style={{ padding: '6px 14px', border: '1.5px dashed #6366f1', borderRadius: '10px', background: '#fff', color: '#4f46e5', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+ إضافة طالب</button>
        <div style={{ marginTop: '8px' }}>{as2.map((s, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '4px', fontSize: '12px' }}><span style={{ fontWeight: 700, color: '#4f46e5' }}>{i + 1}</span> {s.name} <span style={{ color: '#6b7280' }}>({s.grade})</span><button onClick={() => setAs2(as2.filter((_, j) => j !== i))} style={{ marginRight: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>✕</button></div>)}</div>
      </div>
      <select value={ini} onChange={e => setIni(e.target.value)} style={FI}><option value="">اختر المبادر</option>{as2.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
      <div><label style={FL}>وصف الواقعة</label><textarea value={ds} onChange={e => setDs(e.target.value)} rows={2} style={{ ...FI, resize: 'vertical' }} /></div>
      <div><label style={FL}>الأضرار الجسدية</label>{pd.map((d, i) => <input key={i} type="text" value={d} onChange={e => { const n = [...pd]; n[i] = e.target.value; setPd(n); }} placeholder="ضرر جسدي..." style={{ ...FI, marginBottom: '4px' }} />)}<button onClick={() => setPd([...pd, ''])} style={{ padding: '4px 12px', border: '1px dashed #d1d5db', borderRadius: '8px', background: '#fff', fontSize: '11px', cursor: 'pointer' }}>+ إضافة</button></div>
      <div><label style={FL}>الأضرار المادية</label>{md.map((d, i) => <input key={i} type="text" value={d} onChange={e => { const n = [...md]; n[i] = e.target.value; setMd(n); }} placeholder="ضرر مادي..." style={{ ...FI, marginBottom: '4px' }} />)}<button onClick={() => setMd([...md, ''])} style={{ padding: '4px 12px', border: '1px dashed #d1d5db', borderRadius: '8px', background: '#fff', fontSize: '11px', cursor: 'pointer' }}>+ إضافة</button></div>
      <div><label style={FL}>محرر/محررو المحضر</label>{au.map((a, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '6px' }}>
        <select value={a.role} onChange={e => { const n = [...au]; n[i] = { ...n[i], role: e.target.value }; setAu(n); }} style={{ padding: '8px', border: '1.5px solid #d1d5db', borderRadius: '10px', fontSize: '12px', background: '#fff' }}>{roles.map(r => <option key={r} value={r}>{r || 'الصفة'}</option>)}</select>
        <input type="text" value={a.name} onChange={e => { const n = [...au]; n[i] = { ...n[i], name: e.target.value }; setAu(n); }} placeholder="الاسم" style={{ padding: '8px', border: '1.5px solid #d1d5db', borderRadius: '10px', fontSize: '13px', background: '#f4f5f9' }} />
      </div>)}<button onClick={() => setAu([...au, { role: '', name: '' }])} style={{ padding: '4px 12px', border: '1px dashed #6366f1', borderRadius: '8px', background: '#fff', color: '#4f46e5', fontSize: '11px', cursor: 'pointer' }}>+ إضافة محرر</button></div>
      <button onClick={() => { if (as2.length < 2) { showError('يجب إضافة طالبين على الأقل'); return; } onP('mashajara', { day: dy, date: hijriFromDate(dt), time: tm, location: lc, students: as2.map(s => ({ name: s.name, grade: s.grade })), initiator: ini, description: ds, physicalDamage: pd.filter(d => d.trim()), materialDamage: md.filter(d => d.trim()), authors: au.filter(a => a.name.trim()), authorName: au[0]?.name || '', authorRole: au[0]?.role || '' }); }} style={PB}>🖨️ طباعة المحضر</button>
    </div>
  </div></div>;
};

// ★ رصد معلم
const RasdM: React.FC<{ onP: (id: FormId, d: any) => void; onC: () => void }> = ({ onP, onC }) => {
  const [md, setMd] = useState<'blank' | 'filled'>('blank');
  const [tn, setTn] = useState(''); const [sb, setSb] = useState(''); const [gr, setGr] = useState('');
  const [vs, setVs] = useState([{ studentName: '', violation: '', action: '', date: '' }, { studentName: '', violation: '', action: '', date: '' }, { studentName: '', violation: '', action: '', date: '' }]);
  const vI: React.CSSProperties = { padding: '7px 8px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '12px', background: '#fff', minWidth: 0 };
  const os = (a: boolean): React.CSSProperties => ({ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: `2px solid ${a ? '#7c3aed' : '#e5e7eb'}`, borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: a ? '#f5f3ff' : '#fff' });
  return <div style={OV} onClick={e => { if (e.target === e.currentTarget) onC(); }}><div style={MB('560px')} onClick={e => e.stopPropagation()}>
    <MH title="سجل متابعة ورصد مخالفات (للمعلم)" subtitle="النموذج ١٧" gradient="#7c3aed,#8b5cf6" onClose={onC} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        <label style={os(md === 'blank')} onClick={() => setMd('blank')}><input type="radio" checked={md === 'blank'} onChange={() => setMd('blank')} style={{ accentColor: '#7c3aed' }} /> طباعة فارغ</label>
        <label style={os(md === 'filled')} onClick={() => setMd('filled')}><input type="radio" checked={md === 'filled'} onChange={() => setMd('filled')} style={{ accentColor: '#7c3aed' }} /> طباعة مملوء</label>
      </div>
      <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px', background: '#f9fafb' }}>
        <label style={{ ...FL, marginBottom: '8px' }}>بيانات المعلم</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div><label style={FL}>اسم المعلم</label><input type="text" value={tn} onChange={e => setTn(e.target.value)} placeholder="اسم المعلم" style={FI} /></div>
          <div><label style={FL}>المادة</label><input type="text" value={sb} onChange={e => setSb(e.target.value)} placeholder="الرياضيات..." style={FI} /></div>
          <div><label style={FL}>الصف</label><input type="text" value={gr} onChange={e => setGr(e.target.value)} placeholder="ثاني / أ" style={FI} /></div>
        </div>
      </div>
      {md === 'filled' && <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px', background: '#f9fafb' }}>
        <label style={{ ...FL, marginBottom: '8px' }}>المخالفات (حتى ١٢)</label>
        {vs.map((v, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 2fr 2fr 2fr 1fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6d28d9', minWidth: '18px', textAlign: 'center' }}>{i + 1}</span>
          <input type="text" value={v.studentName} onChange={e => { const n = [...vs]; n[i] = { ...n[i], studentName: e.target.value }; setVs(n); }} placeholder="الطالب" style={vI} />
          <input type="text" value={v.violation} onChange={e => { const n = [...vs]; n[i] = { ...n[i], violation: e.target.value }; setVs(n); }} placeholder="المخالفة" style={vI} />
          <input type="text" value={v.action} onChange={e => { const n = [...vs]; n[i] = { ...n[i], action: e.target.value }; setVs(n); }} placeholder="الإجراء" style={vI} />
          <input type="text" value={v.date} onChange={e => { const n = [...vs]; n[i] = { ...n[i], date: e.target.value }; setVs(n); }} placeholder="التاريخ" style={vI} />
          <button onClick={() => setVs(vs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>)}
        <button onClick={() => { if (vs.length >= 12) { showError('الحد ١٢'); return; } setVs([...vs, { studentName: '', violation: '', action: '', date: '' }]); }} style={{ padding: '6px 14px', border: '1.5px dashed #7c3aed', borderRadius: '10px', background: '#fff', color: '#6d28d9', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+ إضافة مخالفة</button>
      </div>}
      <button onClick={() => { const d: any = { teacherName: tn, subject: sb, grade: gr }; if (md === 'filled') { const vl = vs.filter(v => v.studentName.trim() || v.violation.trim()); if (vl.length > 0) d.violations = vl; } onP('rasd_moalem', d); }} style={PB}>🖨️ طباعة النموذج</button>
    </div>
  </div></div>;
};

export default GeneralFormsPage;
