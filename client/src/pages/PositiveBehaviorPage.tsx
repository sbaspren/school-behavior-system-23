import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { positiveBehaviorApi } from '../api/positiveBehavior';
import { studentsApi } from '../api/students';
import { settingsApi, StageConfigData } from '../api/settings';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';

const THEME = '#10b981'; // emerald-500

const BEHAVIOR_TYPES = [
  'المحافظة على الصلاة', 'التفوق الدراسي', 'حسن السلوك والأخلاق',
  'المشاركة في الأنشطة', 'التطوع وخدمة المجتمع', 'حفظ القرآن الكريم',
  'النظافة الشخصية والعامة', 'الالتزام بالزي المدرسي', 'التعاون مع الزملاء',
  'الانضباط والالتزام', 'الإبداع والابتكار', 'القيادة الطلابية',
  'المحافظة على الممتلكات', 'احترام المعلمين والطلاب', 'المبادرة الإيجابية',
];

interface BehaviorRow {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  grade: string;
  className: string;
  stage: string;
  behaviorType: string;
  degree: string;
  details: string;
  hijriDate: string;
  recordedBy: string;
  recordedAt: string;
  isSent: boolean;
}

interface StudentOption {
  id: number;
  studentNumber: string;
  name: string;
  stage: string;
  grade: string;
  className: string;
}

interface DailyStats {
  totalRecords: number;
  todayCount: number;
  uniqueStudents: number;
  totalDegrees: number;
}

const PositiveBehaviorPage: React.FC = () => {
  const [records, setRecords] = useState<BehaviorRow[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [currentStage, setCurrentStage] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState<{ name: string; grade: string; cls: string; behaviors: BehaviorRow[] } | null>(null);
  const [stats, setStats] = useState<DailyStats>({ totalRecords: 0, todayCount: 0, uniqueStudents: 0, totalDegrees: 0 });

  const enabledStages = useMemo(() =>
    stages.filter(s => s.isEnabled && s.grades.some(g => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  useEffect(() => {
    settingsApi.getStructure().then(res => {
      if (res.data?.data?.stages) {
        const st = Array.isArray(res.data.data.stages) ? res.data.data.stages : [];
        setStages(st);
        const enabled = st.filter((s: StageConfigData) => s.isEnabled && s.grades.some((g: { isEnabled: boolean; classCount: number }) => g.isEnabled && g.classCount > 0));
        if (enabled.length > 0) setCurrentStage(enabled[0].stage);
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!currentStage) return;
    setLoading(true);
    try {
      const [rRes, sRes] = await Promise.all([
        positiveBehaviorApi.getAll({ stage: currentStage }),
        positiveBehaviorApi.getDailyStats(currentStage),
      ]);
      if (rRes.data?.data) setRecords(rRes.data.data);
      if (sRes.data?.data) setStats(sRes.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [currentStage]);

  useEffect(() => { loadData(); }, [loadData]);

  const grades = useMemo(() => Array.from(new Set(records.map(r => r.grade))).sort(), [records]);
  const classes = useMemo(() => {
    if (!gradeFilter) return [];
    return Array.from(new Set(records.filter(r => r.grade === gradeFilter).map(r => r.className))).sort();
  }, [records, gradeFilter]);

  const filtered = useMemo(() => {
    let list = records;
    if (search.trim()) list = list.filter(r => r.studentName.includes(search.trim()) || r.studentNumber.includes(search.trim()));
    if (gradeFilter) list = list.filter(r => r.grade === gradeFilter);
    if (classFilter) list = list.filter(r => r.className === classFilter);
    return list;
  }, [records, search, gradeFilter, classFilter]);

  const studentGroups = useMemo(() => {
    const groups: Record<string, { info: BehaviorRow; behaviors: BehaviorRow[] }> = {};
    filtered.forEach(r => {
      const key = String(r.studentId);
      if (!groups[key]) groups[key] = { info: r, behaviors: [] };
      groups[key].behaviors.push(r);
    });
    return Object.values(groups).sort((a, b) => b.behaviors.length - a.behaviors.length);
  }, [filtered]);

  const stageName = (id: string) => SETTINGS_STAGES.find(s => s.id === id)?.name || id;

  const handleDelete = async (id: number) => {
    if (!window.confirm('هل تريد حذف هذا السجل؟')) return;
    try {
      await positiveBehaviorApi.delete(id);
      showSuccess('تم الحذف');
      loadData();
    } catch { showError('فشل الحذف'); }
  };

  const handlePrint = () => {
    if (filtered.length === 0) { showError('لا توجد بيانات للطباعة'); return; }
    const w = window.open('', '_blank');
    if (!w) return;
    const sorted = [...filtered].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, 'ar');
      if (a.className !== b.className) return String(a.className).localeCompare(String(b.className), 'ar');
      return a.studentName.localeCompare(b.studentName, 'ar');
    });
    let rows = '', lastKey = '';
    sorted.forEach((r, i) => {
      const key = r.grade + r.className;
      if (key !== lastKey && i > 0) rows += '<tr style="height:8px;background:#e5e7eb"><td colspan="8"></td></tr>';
      lastKey = key;
      rows += `<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.grade}</td><td>${r.className}</td><td>${r.behaviorType}</td><td style="font-weight:bold;color:#059669">${r.degree || '-'}</td><td>${r.details || '-'}</td><td>${r.recordedBy || '-'}</td></tr>`;
    });
    let title = 'سجل السلوك المتمايز';
    if (gradeFilter) title += ' - ' + gradeFilter;
    if (classFilter) title += ' / ' + classFilter;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:13px}th{background:#10b981;color:#fff}</style></head><body><h2 style="text-align:center">${title}</h2><p style="text-align:center;color:#666">${stageName(currentStage)}</p><table><thead><tr><th style="width:5%">م</th><th style="width:22%">اسم الطالب</th><th style="width:10%">الصف</th><th style="width:8%">الفصل</th><th style="width:22%">السلوك المتمايز</th><th style="width:8%">الدرجة</th><th style="width:15%">التفاصيل</th><th style="width:10%">المعلم</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:center;margin-top:16px">${sorted.length} سجل</p></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleExport = async () => {
    try {
      const res = await positiveBehaviorApi.exportCsv(currentStage);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'positive_behavior.csv'; a.click();
    } catch { showError('فشل التصدير'); }
  };

  return (
    <div>
      {/* Hero Header */}
      <div style={{ background: `linear-gradient(135deg, ${THEME} 0%, #059669 100%)`, borderRadius: '16px', padding: '24px 32px', marginBottom: '24px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>السلوك المتمايز — {stageName(currentStage)}</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '14px' }}>
              {new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.totalRecords}</div><div style={{ fontSize: '12px', opacity: 0.8 }}>إجمالي السجلات</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.uniqueStudents}</div><div style={{ fontSize: '12px', opacity: 0.8 }}>عدد الطلاب</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.totalDegrees}</div><div style={{ fontSize: '12px', opacity: 0.8 }}>إجمالي الدرجات</div></div>
          </div>
        </div>
        {enabledStages.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            {enabledStages.map(s => (
              <button key={s.stage} onClick={() => setCurrentStage(s.stage)}
                style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: currentStage === s.stage ? '#fff' : 'rgba(255,255,255,0.15)', color: currentStage === s.stage ? THEME : '#fff', border: 'none' }}>{stageName(s.stage)}</button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => setModalOpen(true)} style={btnStyle(THEME, '#fff')}>+ تسجيل سلوك</button>
        <button onClick={() => loadData()} style={btnStyle('#f3f4f6', '#374151')}>تحديث</button>
        <button onClick={handlePrint} style={btnStyle(THEME, '#fff')}>طباعة القائمة</button>
        <button onClick={handleExport} style={btnStyle('#f3f4f6', '#374151')}>تصدير CSV</button>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <input type="text" placeholder="ابحث بالاسم..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px', width: '180px' }} />
        <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setClassFilter(''); }}
          style={selectStyle}><option value="">كل الصفوف</option>{grades.map(g => <option key={g} value={g}>{g}</option>)}</select>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} disabled={!gradeFilter}
          style={selectStyle}><option value="">كل الفصول</option>{classes.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setViewMode('cards')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: viewMode === 'cards' ? '#fff' : 'transparent', color: viewMode === 'cards' ? THEME : '#9ca3af', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>بطاقات</button>
          <button onClick={() => setViewMode('table')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? THEME : '#9ca3af', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>جدول</button>
        </div>
        <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: 'auto' }}>{filtered.length} سجل</span>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#9ca3af', fontSize: '18px' }}>لا توجد سجلات سلوك متمايز</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {studentGroups.map((g, idx) => {
            const total = g.behaviors.length;
            const totalDeg = g.behaviors.reduce((sum, b) => sum + (parseFloat(b.degree) || 0), 0);
            let badge = 'بداية', badgeBg = '#dbeafe', badgeColor = '#1e40af';
            if (total >= 10) { badge = 'متميز'; badgeBg = '#dcfce7'; badgeColor = '#166534'; }
            else if (total >= 5) { badge = 'جيد جداً'; badgeBg = '#ecfdf5'; badgeColor = '#047857'; }
            else if (total >= 3) { badge = 'جيد'; badgeBg = '#f0fdfa'; badgeColor = '#0f766e'; }
            return (
              <div key={idx} onClick={() => setDetailStudent({ name: g.info.studentName, grade: g.info.grade, cls: g.info.className, behaviors: g.behaviors })}
                style={{ background: '#fff', borderRadius: '12px', border: `2px solid ${total >= 10 ? THEME : total >= 5 ? '#a7f3d0' : '#e5e7eb'}`, padding: '16px', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: THEME }}>{totalDeg}</span>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>درجة</span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, background: badgeBg, color: badgeColor, padding: '2px 8px', borderRadius: '12px' }}>{badge}</span>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '14px', margin: '0 0 4px', color: '#1f2937' }}>{g.info.studentName}</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px' }}>{g.info.grade}/{g.info.className}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, textAlign: 'center', background: '#ecfdf5', borderRadius: '8px', padding: '6px 4px', minWidth: '60px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: THEME }}>{total}</div>
                    <div style={{ fontSize: '9px', color: '#047857' }}>عدد السلوكيات</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: '#fffbeb', borderRadius: '8px', padding: '6px 4px', minWidth: '60px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#b45309' }}>{totalDeg}</div>
                    <div style={{ fontSize: '9px', color: '#92400e' }}>إجمالي الدرجات</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#ecfdf5', borderBottom: '2px solid #a7f3d0' }}>
                <th style={thStyle}>م</th><th style={thStyle}>اسم الطالب</th><th style={thStyle}>الصف</th><th style={thStyle}>الفصل</th>
                <th style={thStyle}>السلوك</th><th style={thStyle}>الدرجة</th><th style={thStyle}>المعلم</th><th style={thStyle}>التاريخ</th><th style={thStyle}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.studentName}</td>
                  <td style={tdStyle}>{r.grade}</td>
                  <td style={tdStyle}>{r.className}</td>
                  <td style={tdStyle}><span style={{ padding: '2px 8px', background: '#ecfdf5', color: THEME, borderRadius: '100px', fontSize: '11px', fontWeight: 600 }}>{r.behaviorType}</span></td>
                  <td style={tdStyle}><span style={{ padding: '2px 8px', background: '#ecfdf5', color: THEME, borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>{r.degree || '-'}</span></td>
                  <td style={{ ...tdStyle, fontSize: '12px', color: '#6b7280' }}>{r.recordedBy || '-'}</td>
                  <td style={{ ...tdStyle, fontSize: '12px', color: '#6b7280' }}>{r.hijriDate || '-'}</td>
                  <td style={tdStyle}><button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} style={{ padding: '2px 8px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Detail Modal */}
      {detailStudent && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setDetailStudent(null); }}>
          <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '640px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to left, #ecfdf5, #fff)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{detailStudent.name}</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{detailStudent.grade} / {detailStudent.cls}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: '#ecfdf5', color: THEME, padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>{detailStudent.behaviors.length} سلوك متمايز</span>
                <button onClick={() => setDetailStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af' }}>x</button>
              </div>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {(() => { const totalDeg = detailStudent.behaviors.reduce((s, b) => s + (parseFloat(b.degree) || 0), 0); return totalDeg > 0 ? (
                <div style={{ background: '#ecfdf5', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#047857' }}>إجمالي الدرجات</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#047857' }}>{totalDeg}</span>
                </div>
              ) : null; })()}
              {detailStudent.behaviors.map(b => (
                <div key={b.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '12px', borderRight: `4px solid ${THEME}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', margin: 0, flex: 1 }}>{b.behaviorType}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginRight: '12px' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{b.hijriDate || ''}</span>
                      {b.degree && <span style={{ padding: '2px 8px', background: '#ecfdf5', color: THEME, borderRadius: '100px', fontSize: '10px', fontWeight: 700 }}>درجة {b.degree}</span>}
                    </div>
                  </div>
                  {b.details && <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>{b.details}</p>}
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>المعلم: {b.recordedBy || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {modalOpen && <AddBehaviorModal stage={currentStage} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); loadData(); }} />}
    </div>
  );
};

// ────────────────────────── ADD MODAL ──────────────────────────
const AddBehaviorModal: React.FC<{ stage: string; onClose: () => void; onSaved: () => void }> = ({ stage, onClose, onSaved }) => {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [behaviorType, setBehaviorType] = useState('');
  const [degree, setDegree] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { studentsApi.getAll().then(res => { if (res.data?.data) setStudents(res.data.data); }); }, []);

  const stageStudents = useMemo(() => students.filter(s => s.stage === stage), [students, stage]);
  const grades = useMemo(() => Array.from(new Set(stageStudents.map(s => s.grade))).sort(), [stageStudents]);
  const classes = useMemo(() => {
    if (!gradeFilter) return [];
    return Array.from(new Set(stageStudents.filter(s => s.grade === gradeFilter).map(s => s.className))).sort();
  }, [stageStudents, gradeFilter]);
  const filteredStudents = useMemo(() => {
    if (!gradeFilter || !classFilter) return [];
    return stageStudents.filter(s => s.grade === gradeFilter && s.className === classFilter).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [stageStudents, gradeFilter, classFilter]);

  const toggleStudent = (id: number) => {
    setSelectedIds(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };
  const toggleAll = () => {
    if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStudents.map(s => s.id)));
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) return showError('اختر طالب واحد على الأقل');
    if (!behaviorType) return showError('اختر نوع السلوك');
    setSaving(true);
    try {
      const res = await positiveBehaviorApi.addBatch(Array.from(selectedIds), { behaviorType, degree: degree || undefined, details: details || undefined });
      if (res.data?.success !== false) { showSuccess(res.data?.data?.message || 'تم الحفظ'); onSaved(); }
      else showError(res.data?.message || 'فشل الحفظ');
    } catch { showError('فشل الحفظ'); }
    finally { setSaving(false); }
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '640px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: `linear-gradient(to right, ${THEME}, #059669)`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 700 }}>تسجيل سلوك متمايز</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '24px', cursor: 'pointer' }}>x</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>الصف</label>
              <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setClassFilter(''); setSelectedIds(new Set()); }} style={inputStyle}>
                <option value="">اختر الصف</option>{grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>الفصل</label>
              <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSelectedIds(new Set()); }} disabled={!gradeFilter} style={inputStyle}>
                <option value="">اختر الفصل</option>{classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <label style={labelStyle}>الطلاب</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <button type="button" onClick={toggleAll} disabled={filteredStudents.length === 0} style={{ padding: '4px 12px', background: '#ecfdf5', color: THEME, border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>تحديد الكل</button>
            {selectedIds.size > 0 && <span style={{ fontSize: '12px', color: '#6b7280' }}>تم اختيار {selectedIds.size} طالب</span>}
          </div>
          <div style={{ border: '2px solid #d1d5db', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', marginBottom: '16px' }}>
            {filteredStudents.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px', margin: 0 }}>اختر الصف والفصل أولاً</p>
            ) : filteredStudents.map(s => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selectedIds.has(s.id) ? '#ecfdf5' : 'transparent' }}>
                <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                <span style={{ fontSize: '14px' }}>{s.name}</span>
              </label>
            ))}
          </div>

          <label style={labelStyle}>نوع السلوك الإيجابي</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {BEHAVIOR_TYPES.map(bt => (
              <button key={bt} onClick={() => setBehaviorType(bt)} type="button"
                style={{ padding: '6px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: behaviorType === bt ? THEME : '#f3f4f6', color: behaviorType === bt ? '#fff' : '#374151', border: behaviorType === bt ? `2px solid #059669` : '1px solid #d1d5db' }}>{bt}</button>
            ))}
          </div>

          <label style={labelStyle}>الدرجة (اختياري)</label>
          <input type="text" value={degree} onChange={e => setDegree(e.target.value)} style={inputStyle} placeholder="مثال: 1 أو 2..." />

          <label style={labelStyle}>التفاصيل (اختياري)</label>
          <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="وصف إضافي..." />
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', justifyContent: 'flex-end', background: '#f9fafb' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: '#fff', border: '2px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', background: THEME, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────── SHARED STYLES ──────────────────────────
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '11px', color: THEME };
const tdStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'right', fontSize: '13px' };
const selectStyle: React.CSSProperties = { padding: '6px 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '12px', background: '#f9fafb' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' };
const btnStyle = (bg: string, color: string): React.CSSProperties => ({ padding: '8px 16px', background: bg, color, border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' });

export default PositiveBehaviorPage;
