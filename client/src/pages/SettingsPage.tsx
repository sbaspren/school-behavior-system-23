import React, { useState, useEffect, useCallback } from 'react';
import { settingsApi, SchoolSettingsData, StageConfigData, StructureData } from '../api/settings';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES, SECONDARY_TRACKS, CLASS_LETTERS } from '../utils/constants';
import AdminsTab from '../components/settings/AdminsTab';
import TeachersTab from '../components/settings/TeachersTab';
import StudentsTab from '../components/settings/StudentsTab';
import LinksTab from '../components/settings/LinksTab';

type Tab = 'school' | 'structure' | 'admins' | 'teachers' | 'students' | 'links';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'school', label: 'بيانات المدرسة', icon: '🏫' },
  { id: 'structure', label: 'هيكل الصفوف', icon: '🏗️' },
  { id: 'admins', label: 'الهيئة الإدارية', icon: '👤' },
  { id: 'teachers', label: 'المعلمين', icon: '👨‍🏫' },
  { id: 'students', label: 'الطلاب', icon: '👥' },
  { id: 'links', label: 'روابط النماذج', icon: '🔗' },
];

const SettingsPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>('school');
  const [loading, setLoading] = useState(true);
  const [schoolData, setSchoolData] = useState<SchoolSettingsData>({
    schoolName: '', eduAdmin: '', eduDept: '',
    letterheadMode: 'Image', letterheadImageUrl: '',
    whatsAppMode: 'PerStage', schoolType: 'Boys', secondarySystem: 'Semester',
    managerName: '', deputyName: '', counselorName: '', committeeName: '', wakeelName: '', wakeelSignature: '',
  });
  const [structureData, setStructureData] = useState<StageConfigData[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, structureRes] = await Promise.all([
        settingsApi.getSettings(),
        settingsApi.getStructure(),
      ]);
      if (settingsRes.data?.data) {
        setSchoolData(settingsRes.data.data);
      }
      if (structureRes.data?.data?.stages && Array.isArray(structureRes.data.data.stages) && structureRes.data.data.stages.length > 0) {
        setStructureData(structureRes.data.data.stages);
      } else {
        // Build initial stages if none exist
        setStructureData(buildInitialStages());
      }
    } catch {
      // First-time: no data yet, use defaults
      setStructureData(buildInitialStages());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ color: '#666', marginTop: '16px' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '24px' }}>⚙️</span>
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>settings</span>
            إعدادات النظام
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>إدارة بيانات المدرسة والمستخدمين والطلاب</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', background: '#fff', borderRadius: '16px 16px 0 0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0', borderBottom: 'none',
        overflowX: 'auto',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            style={{
              flex: 1, minWidth: '120px', padding: '16px 8px',
              fontSize: '14px', fontWeight: currentTab === tab.id ? 700 : 500,
              background: currentTab === tab.id ? '#eef2ff' : 'transparent',
              color: currentTab === tab.id ? '#4338ca' : '#6b7280',
              border: 'none', borderBottom: currentTab === tab.id ? '4px solid #4f46e5' : '4px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: '#fff', borderRadius: '0 0 16px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0', borderTop: 'none',
        padding: '24px', minHeight: '400px',
      }}>
        {currentTab === 'school' && (
          <SchoolTab data={schoolData} onChange={setSchoolData} onSaved={loadData} />
        )}
        {currentTab === 'structure' && (
          <StructureTab
            stages={structureData}
            schoolType={schoolData.schoolType}
            secondarySystem={schoolData.secondarySystem}
            onSaved={loadData}
          />
        )}
        {currentTab === 'admins' && <AdminsTab />}
        {currentTab === 'teachers' && <TeachersTab />}
        {currentTab === 'students' && <StudentsTab />}
        {currentTab === 'links' && <LinksTab />}
      </div>
    </div>
  );
};

// ============================================================
// School Tab - بيانات المدرسة والكليشة
// ============================================================
interface SchoolTabProps {
  data: SchoolSettingsData;
  onChange: (data: SchoolSettingsData) => void;
  onSaved: () => void;
}

const SchoolTab: React.FC<SchoolTabProps> = ({ data, onChange, onSaved }) => {
  const [editMode, setEditMode] = useState(!data.schoolName);
  const [saving, setSaving] = useState(false);
  const hasSavedData = !!(data.letterheadImageUrl || data.eduAdmin || data.schoolName);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await settingsApi.saveSettings(data);
      if (res.data?.success) {
        showSuccess('تم حفظ واعتماد الكليشة — ستظهر في جميع المطبوعات');
        setEditMode(false);
        onSaved();
      } else {
        showError(res.data?.message || 'خطأ في الحفظ');
      }
    } catch {
      showError('خطأ في الاتصال');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#6366f1' }}>🏫</span>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>بيانات المدرسة والكليشة</h3>
        </div>
        {hasSavedData && !editMode && (
          <button onClick={() => setEditMode(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', background: '#fffbeb', color: '#b45309',
            border: '1px solid #fde68a', borderRadius: '12px',
            fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          }}>
            ✏️ تعديل البيانات
          </button>
        )}
      </div>

      {/* Letterhead Preview */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span>👁️</span>
          <span style={{ fontWeight: 700, color: '#374151', fontSize: '14px' }}>الكليشة المعتمدة حالياً</span>
          <span style={{
            marginRight: 'auto', fontSize: '12px', padding: '2px 8px', borderRadius: '9999px',
            background: hasSavedData ? '#dcfce7' : '#f3f4f6',
            color: hasSavedData ? '#15803d' : '#6b7280', fontWeight: 700,
          }}>
            {hasSavedData ? '✓ محفوظة' : 'لم تُحفظ بعد'}
          </span>
        </div>
        <div style={{
          padding: '24px 30px', textAlign: 'center', fontFamily: "'Traditional Arabic', 'Amiri', serif",
          direction: 'rtl', borderBottom: '3px solid #1a365d', margin: '16px 20px',
        }}>
          <LetterheadPreview data={data} />
        </div>
      </div>

      {/* Edit Fields */}
      {editMode && (
        <>
          {/* Letterhead Mode */}
          <div style={{ background: 'linear-gradient(to left, #eef2ff, #faf5ff)', borderRadius: '16px', padding: '20px', border: '1px solid #c7d2fe', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span>🖨️</span>
              <h4 style={{ margin: 0, fontWeight: 700, color: '#1f2937' }}>نوع الكليشة في المطبوعات</h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <input type="radio" checked={data.letterheadMode === 'Image'} onChange={() => onChange({ ...data, letterheadMode: 'Image' })} style={{ marginTop: '2px' }} />
                <div>
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>صورة كليشة جاهزة</span>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>ارفع صورة الكليشة الكاملة كما هي (شعارات + نصوص)</p>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <input type="radio" checked={data.letterheadMode === 'Text'} onChange={() => onChange({ ...data, letterheadMode: 'Text' })} style={{ marginTop: '2px' }} />
                <div>
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>كليشة نصية</span>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>أدخل بيانات المدرسة وسيتم بناء الكليشة تلقائياً</p>
                </div>
              </label>
            </div>

            {/* Image mode */}
            {data.letterheadMode === 'Image' && (
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>رابط صورة الكليشة</label>
                <input
                  type="url" dir="ltr"
                  value={data.letterheadImageUrl}
                  onChange={(e) => onChange({ ...data, letterheadImageUrl: e.target.value })}
                  placeholder="https://i.ibb.co/xxxxx/logo.png"
                  style={{ width: '100%', padding: '12px 16px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                  يمكنك رفع الصورة على imgbb.com ولصق الرابط المباشر هنا
                </p>
              </div>
            )}

            {/* Text mode */}
            {data.letterheadMode === 'Text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#fff', borderRadius: '8px', padding: '12px', border: '1px solid #e5e7eb', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
                  <div style={{ fontWeight: 700, color: '#374151' }}>المملكة العربية السعودية</div>
                  <div style={{ color: '#4b5563' }}>وزارة التعليم</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>↑ ثابت تلقائياً ↑</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>الإدارة التعليمية</label>
                  <input type="text" value={data.eduAdmin}
                    onChange={(e) => onChange({ ...data, eduAdmin: e.target.value })}
                    placeholder="مثال: الإدارة العامة للتعليم بمنطقة عسير"
                    style={{ width: '100%', padding: '10px 16px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>القسم / المكتب</label>
                  <input type="text" value={data.eduDept}
                    onChange={(e) => onChange({ ...data, eduDept: e.target.value })}
                    placeholder="مثال: مكتب التعليم بخميس مشيط"
                    style={{ width: '100%', padding: '10px 16px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>اسم المدرسة</label>
                  <input type="text" value={data.schoolName}
                    onChange={(e) => onChange({ ...data, schoolName: e.target.value })}
                    placeholder="مثال: متوسطة وثانوية العرين"
                    style={{ width: '100%', padding: '10px 16px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', textAlign: 'center', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp Mode */}
          <div style={{ background: 'linear-gradient(to left, #f0fdf4, #ecfdf5)', borderRadius: '16px', padding: '20px', border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span>💬</span>
              <h4 style={{ margin: 0, fontWeight: 700, color: '#1f2937' }}>نمط الواتساب</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <input type="radio" checked={data.whatsAppMode === 'PerStage'} onChange={() => onChange({ ...data, whatsAppMode: 'PerStage' })} style={{ marginTop: '2px' }} />
                <div>
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>رقم لكل مرحلة</span>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>كل مرحلة لها رقم رئيسي مستقل</p>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <input type="radio" checked={data.whatsAppMode === 'Unified'} onChange={() => onChange({ ...data, whatsAppMode: 'Unified' })} style={{ marginTop: '2px' }} />
                <div>
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>رقم واحد لجميع المراحل</span>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>رقم رئيسي واحد يُستخدم لجميع المراحل</p>
                </div>
              </label>
            </div>
          </div>

          {/* ★ طاقم العمل والتوقيعات — تُستخدم في المطبوعات */}
          <div style={{ background: 'linear-gradient(to left, #fef9ec, #fffbeb)', borderRadius: '16px', padding: '20px', border: '1px solid #fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span>👔</span>
              <h4 style={{ margin: 0, fontWeight: 700, color: '#1f2937' }}>طاقم العمل والتوقيعات</h4>
              <span style={{ fontSize: '12px', color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: '9999px' }}>تظهر في أسفل المطبوعات</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { key: 'managerName', label: 'مدير المدرسة', placeholder: 'اسم المدير' },
                { key: 'deputyName', label: 'وكيل المدرسة', placeholder: 'اسم الوكيل' },
                { key: 'counselorName', label: 'المرشد الطلابي', placeholder: 'اسم المرشد' },
                { key: 'committeeName', label: 'لجنة السلوك', placeholder: 'اسم رئيس اللجنة' },
                { key: 'wakeelName', label: 'الوكيل (للطباعة)', placeholder: 'اسم الوكيل في التقارير' },
                { key: 'wakeelSignature', label: 'بيانات التوقيع', placeholder: 'النص أسفل التوقيع' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>{label}</label>
                  <input
                    type="text"
                    value={(data as any)[key] || ''}
                    onChange={(e) => onChange({ ...data, [key]: e.target.value })}
                    placeholder={placeholder}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f0f0f0' }}>
            {hasSavedData && (
              <button onClick={() => setEditMode(false)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', background: '#f3f4f6', color: '#374151',
                borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
              }}>
                ✕ إلغاء
              </button>
            )}
            <button onClick={handleSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 32px', background: '#4f46e5', color: '#fff',
              borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79,70,229,0.3)', opacity: saving ? 0.7 : 1,
            }}>
              💾 {saving ? 'جاري الحفظ...' : 'حفظ واعتماد الكليشة'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================
// Letterhead Preview
// ============================================================
const LetterheadPreview: React.FC<{ data: SchoolSettingsData }> = ({ data }) => {
  if (data.letterheadMode === 'Image') {
    if (data.letterheadImageUrl) {
      return <img src={data.letterheadImageUrl} alt="كليشة" style={{ height: '85px', maxWidth: '100%', objectFit: 'contain' }} />;
    }
    return <p style={{ color: '#aaa', fontSize: '14px' }}>لم يتم تحديد صورة كليشة بعد</p>;
  }

  return (
    <>
      <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 2px', color: '#000' }}>المملكة العربية السعودية</p>
      <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 6px', color: '#000' }}>وزارة التعليم</p>
      {data.eduAdmin && <p style={{ fontSize: '16px', margin: '2px 0', color: '#333' }}>{data.eduAdmin}</p>}
      {data.eduDept && <p style={{ fontSize: '16px', margin: '2px 0', color: '#333' }}>{data.eduDept}</p>}
      {data.schoolName && <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '8px 0 0', color: '#1a365d' }}>{data.schoolName}</p>}
      {!data.eduAdmin && !data.eduDept && !data.schoolName && (
        <p style={{ color: '#aaa', fontSize: '14px', marginTop: '8px' }}>أدخل بيانات المدرسة من زر "تعديل البيانات"</p>
      )}
    </>
  );
};

// ============================================================
// Structure Tab - هيكل الصفوف والفصول
// ============================================================
interface StructureTabProps {
  stages: StageConfigData[];
  schoolType: string;
  secondarySystem: string;
  onSaved: () => void;
}

const StructureTab: React.FC<StructureTabProps> = ({ stages: initialStages, schoolType: initialSchoolType, secondarySystem: initialSecSystem, onSaved }) => {
  const [schoolType, setSchoolType] = useState(initialSchoolType || 'Boys');
  const [secondarySystem, setSecondarySystem] = useState(initialSecSystem || 'Semester');
  const [stages, setStages] = useState<StageConfigData[]>(() => {
    if (initialStages.length > 0) return initialStages;
    return buildInitialStages();
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ removedStages: string[]; dataToDelete?: string[]; message: string } | null>(null);

  // When secondary system changes, update secondary grade list
  useEffect(() => {
    const secGrades = SECONDARY_TRACKS[secondarySystem] || SECONDARY_TRACKS.Semester;
    setStages((prev) =>
      prev.map((s) => {
        if (s.stage !== 'Secondary') return s;
        return {
          ...s,
          grades: secGrades.map((name) => {
            const existing = s.grades.find((g) => g.gradeName === name);
            return existing || { gradeName: name, classCount: 0, isEnabled: false };
          }),
        };
      })
    );
  }, [secondarySystem]);

  const toggleStage = (stageId: string) => {
    setStages((prev) => prev.map((s) => s.stage === stageId ? { ...s, isEnabled: !s.isEnabled } : s));
  };

  const toggleGrade = (stageId: string, gradeName: string) => {
    setStages((prev) =>
      prev.map((s) => {
        if (s.stage !== stageId) return s;
        return {
          ...s,
          grades: s.grades.map((g) => {
            if (g.gradeName !== gradeName) return g;
            const newEnabled = !g.isEnabled;
            return { ...g, isEnabled: newEnabled, classCount: newEnabled ? g.classCount : 0 };
          }),
        };
      })
    );
  };

  const setClassCount = (stageId: string, gradeName: string, count: number) => {
    setStages((prev) =>
      prev.map((s) => {
        if (s.stage !== stageId) return s;
        return {
          ...s,
          grades: s.grades.map((g) =>
            g.gradeName === gradeName ? { ...g, classCount: Math.max(0, Math.min(15, count)) } : g
          ),
        };
      })
    );
  };

  const doSave = async (confirmedDeletion = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const payload: StructureData & { confirmedDeletion?: boolean } = { schoolType, secondarySystem, stages, confirmedDeletion };
      const res = await settingsApi.saveStructure(payload);
      const resData = res.data?.data;

      // إذا السيرفر يطلب تأكيد حذف مراحل (مطابق لـ saveSchoolStructure سطر 235-253)
      if (resData?.needsConfirmation) {
        setDeleteConfirm({
          removedStages: resData.removedStages || [],
          dataToDelete: resData.dataToDelete || [],
          message: resData.message || 'سيتم حذف بيانات المراحل المُلغاة. هل أنت متأكد؟',
        });
        setSaving(false);
        return;
      }

      if (res.data?.success) {
        showSuccess('تم حفظ الهيكل بنجاح');
        setDeleteConfirm(null);
        onSaved();
      } else {
        showError(res.data?.message || 'خطأ في الحفظ');
      }
    } catch {
      showError('خطأ في الاتصال');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => doSave(false);
  const handleConfirmedSave = () => doSave(true);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <span style={{ color: '#6366f1' }}>🏗️</span>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>هيكل الصفوف والفصول</h3>
      </div>

      {/* School Type */}
      <div style={{ background: '#f9fafb', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>نوع المدرسة</label>
        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="radio" checked={schoolType === 'Boys'} onChange={() => setSchoolType('Boys')} />
            <span style={{ fontWeight: 500 }}>بنين</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="radio" checked={schoolType === 'Girls'} onChange={() => setSchoolType('Girls')} />
            <span style={{ fontWeight: 500 }}>بنات</span>
          </label>
        </div>
      </div>

      {/* Stages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {stages.map((stage) => {
          const stageInfo = SETTINGS_STAGES.find((s) => s.id === stage.stage);
          const isSecondary = stage.stage === 'Secondary';

          return (
            <div key={stage.stage} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {/* Stage Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={stage.isEnabled} onChange={() => toggleStage(stage.stage)} />
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>{stageInfo?.name || stage.stage}</span>
                </label>
                {isSecondary && (
                  <select value={secondarySystem} onChange={(e) => setSecondarySystem(e.target.value)}
                    style={{ padding: '6px 12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                    <option value="Semester">فصلي</option>
                    <option value="Tracks">مسارات</option>
                  </select>
                )}
              </div>

              {/* Grades */}
              <div style={{ padding: '20px', opacity: stage.isEnabled ? 1 : 0.5, pointerEvents: stage.isEnabled ? 'auto' : 'none' }}>
                {stage.grades.map((grade) => {
                  const letters = CLASS_LETTERS.slice(0, grade.classCount);
                  return (
                    <div key={grade.gradeName} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 0', borderBottom: '1px solid #f3f4f6',
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={grade.isEnabled} onChange={() => toggleGrade(stage.stage, grade.gradeName)} />
                        <span style={{ fontWeight: 500, color: '#374151' }}>{grade.gradeName}</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <select
                          value={grade.classCount}
                          onChange={(e) => setClassCount(stage.stage, grade.gradeName, parseInt(e.target.value))}
                          disabled={!grade.isEnabled}
                          style={{ padding: '4px 12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '64px' }}
                        >
                          {Array.from({ length: 16 }, (_, n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {letters.map((l) => (
                            <span key={l} style={{
                              background: '#e0e7ff', color: '#4338ca',
                              padding: '2px 8px', borderRadius: '100px',
                              fontSize: '14px', fontWeight: 700,
                            }}>
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f0f0f0' }}>
        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 32px', background: '#4f46e5', color: '#fff',
          borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(79,70,229,0.3)', opacity: saving ? 0.7 : 1,
        }}>
          💾 {saving ? 'جاري الحفظ...' : 'حفظ الهيكل'}
        </button>
      </div>

      {/* ★ نافذة تأكيد حذف المراحل — مطابق لـ showDeleteConfirmationModal في JS_Settings.html سطر 904 */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px', padding: '32px',
            maxWidth: '500px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '32px' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>تأكيد حذف مراحل</h3>
            </div>

            <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8, marginBottom: '16px' }}>
              {deleteConfirm.message}
            </p>

            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
              padding: '16px', marginBottom: '24px',
            }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b', margin: '0 0 8px' }}>
                المراحل التي ستُحذف بياناتها:
              </p>
              {deleteConfirm.removedStages.map((stage) => (
                <div key={stage} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0',
                }}>
                  <span style={{ color: '#dc2626' }}>🗑️</span>
                  <span style={{ fontWeight: 700, color: '#991b1b' }}>{stage}</span>
                  <span style={{ fontSize: '12px', color: '#b91c1c' }}>(طلاب + سجلات مخالفات + غياب + ...)</span>
                </div>
              ))}
              {/* ★ قائمة البيانات التفصيلية — مطابق لـ sheetsToDelete في الأصلي */}
              {deleteConfirm.dataToDelete && deleteConfirm.dataToDelete.length > 0 && (
                <div style={{ marginTop: '12px', maxHeight: '120px', overflowY: 'auto', background: '#fff', borderRadius: '8px', padding: '8px', border: '1px solid #fecaca' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c', margin: '0 0 4px' }}>السجلات التي ستُحذف:</p>
                  {deleteConfirm.dataToDelete.map((item, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#6b7280', padding: '2px 0' }}>• {item}</div>
                  ))}
                </div>
              )}
            </div>

            <p style={{ fontSize: '13px', color: '#dc2626', fontWeight: 700, marginBottom: '20px' }}>
              ⛔ هذا الإجراء لا يمكن التراجع عنه!
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                padding: '10px 24px', background: '#f3f4f6', color: '#374151',
                borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
              }}>
                إلغاء
              </button>
              <button onClick={handleConfirmedSave} disabled={saving} style={{
                padding: '10px 24px', background: '#dc2626', color: '#fff',
                borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                opacity: saving ? 0.7 : 1,
              }}>
                {saving ? 'جاري الحذف...' : '🗑️ تأكيد الحذف والحفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



// ============================================================
// Helpers
// ============================================================
function buildInitialStages(): StageConfigData[] {
  return SETTINGS_STAGES.map((stage) => ({
    stage: stage.id,
    isEnabled: false,
    grades: stage.grades.map((name) => ({
      gradeName: name,
      classCount: 0,
      isEnabled: false,
    })),
  }));
}

export default SettingsPage;
