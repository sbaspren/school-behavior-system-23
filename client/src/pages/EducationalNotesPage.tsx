import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { educationalNotesApi } from '../api/educationalNotes';
import { studentsApi } from '../api/students';
import { settingsApi, StageConfigData } from '../api/settings';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';
import { printForm } from '../utils/printTemplates';
import { printDailyReport } from '../utils/printDaily';
import { sortByClass } from '../utils/printUtils';

const THEME = '#059669'; // emerald-600

interface NoteRow {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  grade: string;
  className: string;
  stage: string;
  mobile: string;
  noteType: string;
  details: string;
  teacherName: string;
  hijriDate: string;
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
  todayCount: number;
  totalCount: number;
  unsentCount: number;
  sentCount: number;
}

interface ReportData {
  total: number;
  uniqueStudents: number;
  sent: number;
  unsent: number;
  topStudents: { studentId: number; studentName: string; grade: string; className: string; count: number }[];
  byClass: { className: string; count: number }[];
  byType: { type: string; count: number }[];
}

const EducationalNotesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'today' | 'approved' | 'reports'>('today');
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [currentStage, setCurrentStage] = useState('');
  const [noteTypes, setNoteTypes] = useState<string[]>([]);
  const [stats, setStats] = useState<DailyStats>({ todayCount: 0, totalCount: 0, unsentCount: 0, sentCount: 0 });
  const [schoolSettings, setSchoolSettings] = useState<Record<string, string>>({});

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
    settingsApi.getSettings().then(res => {
      if (res.data?.data) setSchoolSettings(res.data.data);
    });
  }, []);

  useEffect(() => {
    if (!currentStage) return;
    educationalNotesApi.getTypes(currentStage).then(res => {
      if (res.data?.data) setNoteTypes(res.data.data);
    });
    educationalNotesApi.getDailyStats(currentStage).then(res => {
      if (res.data?.data) setStats(res.data.data);
    });
  }, [currentStage]);

  const refreshStats = useCallback(() => {
    if (!currentStage) return;
    educationalNotesApi.getDailyStats(currentStage).then(res => {
      if (res.data?.data) setStats(res.data.data);
    });
  }, [currentStage]);

  const stageName = (id: string) => SETTINGS_STAGES.find(s => s.id === id)?.name || id;

  return (
    <div>
      {/* Hero Header */}
      <div style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderRadius: '16px', padding: '24px 32px', marginBottom: '24px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>الملاحظات التربوية — {stageName(currentStage)}</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '14px' }}>
              {new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <HeroStat label="ملاحظات اليوم" value={stats.todayCount} />
            <HeroStat label="إجمالي الملاحظات" value={stats.totalCount} />
            <HeroStat label="لم تُرسل" value={stats.unsentCount} />
          </div>
        </div>
        {/* Stage selector */}
        {enabledStages.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            {enabledStages.map(s => (
              <button key={s.stage} onClick={() => setCurrentStage(s.stage)}
                style={{
                  padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  background: currentStage === s.stage ? '#fff' : 'rgba(255,255,255,0.15)',
                  color: currentStage === s.stage ? THEME : '#fff',
                  border: 'none',
                }}>{stageName(s.stage)}</button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
        {[
          { id: 'today' as const, label: 'اليومي' },
          { id: 'approved' as const, label: 'المعتمد' },
          { id: 'reports' as const, label: 'التقارير' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? `3px solid ${THEME}` : '3px solid transparent',
              color: activeTab === tab.id ? THEME : '#6b7280',
            }}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'today' && <TodayTab stage={currentStage} noteTypes={noteTypes} onRefresh={refreshStats} schoolSettings={schoolSettings} />}
      {activeTab === 'approved' && <ApprovedTab stage={currentStage} noteTypes={noteTypes} schoolSettings={schoolSettings} />}
      {activeTab === 'reports' && <ReportsTab stage={currentStage} />}
    </div>
  );
};

// ────────────────────────── Hero Stat ──────────────────────────
const HeroStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '28px', fontWeight: 800 }}>{value}</div>
    <div style={{ fontSize: '12px', opacity: 0.8 }}>{label}</div>
  </div>
);

// ────────────────────────── TODAY TAB ──────────────────────────
const TodayTab: React.FC<{ stage: string; noteTypes: string[]; onRefresh: () => void; schoolSettings: Record<string, string> }> = ({ stage, noteTypes, onRefresh, schoolSettings }) => {
  const [records, setRecords] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [typesModalOpen, setTypesModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [msgEditorRow, setMsgEditorRow] = useState<NoteRow | null>(null);

  const loadToday = useCallback(async () => {
    if (!stage) return;
    setLoading(true);
    try {
      const today = new Date();
      const cal = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const parts = cal.formatToParts(today);
      const y = parts.find(p => p.type === 'year')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      const d = parts.find(p => p.type === 'day')?.value || '';
      const hijriDate = `${y}/${m}/${d}`;
      const res = await educationalNotesApi.getAll({ stage, hijriDate });
      if (res.data?.data) setRecords(res.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [stage]);

  useEffect(() => { loadToday(); }, [loadToday]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === records.length) setSelected(new Set());
    else setSelected(new Set(records.map(r => r.id)));
  };

  const handleSendWhatsApp = (row: NoteRow) => {
    setMsgEditorRow(row);
  };

  const handleConfirmSend = async (id: number, message: string) => {
    setMsgEditorRow(null);
    try {
      const res = await educationalNotesApi.sendWhatsApp(id, { message });
      if (res.data?.data?.success) { showSuccess('تم إرسال الإشعار'); loadToday(); onRefresh(); }
      else showError(res.data?.data?.message || 'فشل الإرسال');
    } catch { showError('فشل الإرسال'); }
  };

  const handleBulkSend = async () => {
    const ids = Array.from(selected).filter(id => {
      const r = records.find(rec => rec.id === id);
      return r && !r.isSent;
    });
    if (ids.length === 0) { showError('جميع المحددين تم إرسالهم سابقاً'); return; }
    if (!window.confirm(`سيتم إرسال إشعارات لـ ${ids.length} ولي أمر. متابعة؟`)) return;
    setSending(true);
    try {
      const res = await educationalNotesApi.sendWhatsAppBulk(ids);
      if (res.data?.data) showSuccess(`تم: ${res.data.data.success} ناجح، ${res.data.data.fail} فاشل`);
      setSelected(new Set());
      loadToday();
      onRefresh();
    } catch { showError('فشل الإرسال الجماعي'); }
    finally { setSending(false); }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`هل تريد حذف ${ids.length} ملاحظة؟`)) return;
    try {
      await educationalNotesApi.deleteBulk(ids);
      showSuccess(`تم حذف ${ids.length} ملاحظة`);
      setSelected(new Set());
      loadToday();
      onRefresh();
    } catch { showError('فشل الحذف'); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('هل تريد حذف هذه الملاحظة؟')) return;
    try {
      await educationalNotesApi.delete(id);
      showSuccess('تم الحذف');
      loadToday();
      onRefresh();
    } catch { showError('فشل الحذف'); }
  };

  const handleExport = async () => {
    try {
      const res = await educationalNotesApi.exportCsv(stage);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'educational_notes.csv'; a.click();
    } catch { showError('فشل التصدير'); }
  };

  const printToday = () => {
    if (records.length === 0) { showError('لا يوجد بيانات للطباعة'); return; }
    const toPrint = selected.size > 0 ? records.filter(r => selected.has(r.id)) : records;
    printDailyReport('notes', toPrint as unknown as Record<string, unknown>[], schoolSettings as any, stage);
  };

  // ترتيب حسب الصف
  const sortedRecords = useMemo(() => sortByClass(records, 'studentName' as keyof NoteRow, 'grade' as keyof NoteRow, 'className' as keyof NoteRow), [records]);

  return (
    <div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setModalOpen(true)} style={btnStyle(THEME, '#fff')}>+ تسجيل ملاحظة</button>
        <button onClick={() => loadToday()} style={btnStyle('#f3f4f6', '#374151')}>تحديث</button>
        <button onClick={() => setTypesModalOpen(true)} style={btnStyle('#fef3c7', '#92400e')}>أنواع الملاحظات</button>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <>
            <span style={{ fontSize: '13px', fontWeight: 700, color: THEME }}>{selected.size} محدد</span>
            <button onClick={handleBulkSend} disabled={sending} style={btnStyle('#22c55e', '#fff')}>{sending ? 'جاري الإرسال...' : 'إرسال للمحددين'}</button>
            <button onClick={handleBulkDelete} style={btnStyle('#fee2e2', '#dc2626')}>حذف المحددين</button>
          </>
        )}
        <button onClick={printToday} style={btnStyle('#f3f4f6', '#374151')}>طباعة</button>
        <button onClick={handleExport} style={btnStyle('#f3f4f6', '#374151')}>تصدير CSV</button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#9ca3af', fontSize: '18px' }}>لا توجد ملاحظات مسجلة اليوم</p>
          <button onClick={() => setModalOpen(true)} style={{ ...btnStyle(THEME, '#fff'), marginTop: '16px' }}>+ تسجيل ملاحظة</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: THEME }}>
                <th style={{ ...thStyle, color: '#fff', width: '36px' }}>
                  <input type="checkbox" checked={selected.size === records.length && records.length > 0} onChange={toggleAll} />
                </th>
                <th style={{ ...thStyle, color: '#fff', width: '36px' }}>#</th>
                <th style={{ ...thStyle, color: '#fff' }}>اسم الطالب</th>
                <th style={{ ...thStyle, color: '#fff' }}>الصف</th>
                <th style={{ ...thStyle, color: '#fff' }}>نوع الملاحظة</th>
                <th style={{ ...thStyle, color: '#fff' }}>التفاصيل</th>
                <th style={{ ...thStyle, color: '#fff' }}>المسجل</th>
                <th style={{ ...thStyle, color: '#fff' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={tdStyle}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.studentName}</td>
                  <td style={tdStyle}>{r.grade} / {r.className}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '12px', fontWeight: 600, background: '#ecfdf5', color: '#059669' }}>{r.noteType}</span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.details}>{r.details || '-'}</td>
                  <td style={{ ...tdStyle, fontSize: '12px', color: '#6b7280' }}>{r.teacherName || '-'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      {r.isSent ? (
                        <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>تم</span>
                      ) : (
                        <button onClick={() => handleSendWhatsApp(r)} style={{ padding: '2px 8px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '100px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>إرسال</button>
                      )}
                      <button onClick={() => { printForm('tawtheeq_tawasol', { studentName: r.studentName, grade: r.grade + ' / ' + r.className, contactType: 'ملاحظة تربوية', contactReason: (r.noteType || '') + (r.details ? ' - ' + r.details : ''), violationDate: r.hijriDate || '', contactResult: r.isSent ? 'تم التواصل عبر الواتساب' : 'لم يتم الإرسال بعد', notes: 'المسجّل: ' + (r.teacherName || '-') }); }} style={{ padding: '2px 6px', background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }} title="توثيق تواصل">📞</button>
                      <button onClick={() => handleDelete(r.id)} style={{ padding: '2px 6px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
            <span>تم الإرسال: {records.filter(r => r.isSent).length}</span>
            <span>لم يُرسل: {records.filter(r => !r.isSent).length}</span>
          </div>
        </div>
      )}

      {modalOpen && <AddNoteModal stage={stage} noteTypes={noteTypes} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); loadToday(); onRefresh(); }} />}
      {typesModalOpen && <NoteTypesModal stage={stage} types={noteTypes} onClose={() => setTypesModalOpen(false)} onSaved={(t) => { setTypesModalOpen(false); /* types updated externally */ }} />}

      {msgEditorRow && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setMsgEditorRow(null); }}>
          <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '520px', width: '95%', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #dcfce7, #f0fdf4)', borderBottom: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#15803d' }}>إرسال رسالة واتساب</h3>
                <span style={{ fontSize: '13px', color: '#4b5563' }}>{msgEditorRow.studentName} - {msgEditorRow.mobile || 'لا يوجد رقم'}</span>
              </div>
              <button onClick={() => setMsgEditorRow(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>x</button>
            </div>
            <EduMsgEditor record={msgEditorRow} onSend={(msg) => handleConfirmSend(msgEditorRow.id, msg)} onClose={() => setMsgEditorRow(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

// ────────────────────────── Message Editor ──────────────────────────
const EduMsgEditor: React.FC<{ record: NoteRow; onSend: (msg: string) => void; onClose: () => void }> = ({ record, onSend, onClose }) => {
  const hijriDate = record.hijriDate || new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'long', day: 'numeric' });
  const defaultMsg = `ولي أمر الطالب / ${record.studentName}\nالسلام عليكم ورحمة الله وبركاته\nنفيدكم بأنه تم تسجيل ملاحظة تربوية على ابنكم:\nنوع الملاحظة: ${record.noteType}${record.details ? `\nالتفاصيل: ${record.details}` : ''}\nالتاريخ: ${hijriDate}\nنأمل متابعة الطالب والتعاون معنا.\nمع تحيات إدارة المدرسة`;
  const [message, setMessage] = useState(defaultMsg);
  return (
    <>
      <div style={{ padding: '20px 24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>نص الرسالة</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={8}
          style={{ width: '100%', padding: '12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', lineHeight: 1.8, resize: 'vertical', boxSizing: 'border-box', direction: 'rtl' }} />
        <button onClick={() => setMessage(defaultMsg)} style={{ marginTop: '8px', padding: '4px 10px', background: '#f3f4f6', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>إعادة تعيين</button>
      </div>
      <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={() => onSend(message)} style={{ padding: '8px 24px', background: '#25d366', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>إرسال</button>
      </div>
    </>
  );
};

// ────────────────────────── APPROVED TAB ──────────────────────────
const ApprovedTab: React.FC<{ stage: string; noteTypes: string[]; schoolSettings: Record<string, string> }> = ({ stage, noteTypes, schoolSettings }) => {
  const [records, setRecords] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detailStudent, setDetailStudent] = useState<{ name: string; grade: string; cls: string; notes: NoteRow[] } | null>(null);

  const loadAll = useCallback(async () => {
    if (!stage) return;
    setLoading(true);
    try {
      const res = await educationalNotesApi.getAll({ stage });
      if (res.data?.data) setRecords(res.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [stage]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const grades = useMemo(() => Array.from(new Set(records.map(r => r.grade))).sort(), [records]);
  const classes = useMemo(() => {
    if (!gradeFilter) return [];
    return Array.from(new Set(records.filter(r => r.grade === gradeFilter).map(r => r.className))).sort();
  }, [records, gradeFilter]);

  const filtered = useMemo(() => {
    let list = records;
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(r => r.studentName.includes(q) || r.studentNumber.includes(q));
    }
    if (gradeFilter) list = list.filter(r => r.grade === gradeFilter);
    if (classFilter) list = list.filter(r => r.className === classFilter);
    if (typeFilter !== 'all') list = list.filter(r => r.noteType === typeFilter);
    if (dateFrom) list = list.filter(r => r.hijriDate >= dateFrom);
    if (dateTo) list = list.filter(r => r.hijriDate <= dateTo);
    return list;
  }, [records, search, gradeFilter, classFilter, typeFilter, dateFrom, dateTo]);

  // Group by student
  const studentGroups = useMemo(() => {
    const groups: Record<string, { info: NoteRow; notes: NoteRow[] }> = {};
    filtered.forEach(r => {
      const key = String(r.studentId);
      if (!groups[key]) groups[key] = { info: r, notes: [] };
      groups[key].notes.push(r);
    });
    return Object.values(groups).sort((a, b) => b.notes.length - a.notes.length);
  }, [filtered]);

  const printList = () => {
    if (filtered.length === 0) { showError('لا توجد بيانات للطباعة'); return; }
    printDailyReport('notes', filtered as unknown as Record<string, unknown>[], schoolSettings as any, stage);
  };

  return (
    <div>
      {/* Action bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => loadAll()} style={btnStyle('#f3f4f6', '#374151')}>تحديث</button>
        <button onClick={printList} style={btnStyle('#7c3aed', '#fff')}>طباعة القائمة</button>
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
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>الفترة:</span>
        <input type="text" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="من (هجري)"
          style={{ padding: '6px 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '12px', width: '120px' }} />
        <input type="text" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="إلى (هجري)"
          style={{ padding: '6px 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '12px', width: '120px' }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '4px 8px', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>مسح</button>
        )}
      </div>

      {/* Type quick filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setTypeFilter('all')} style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: typeFilter === 'all' ? '#ecfdf5' : '#f9fafb', color: typeFilter === 'all' ? THEME : '#6b7280', border: typeFilter === 'all' ? `1px solid ${THEME}` : '1px solid #e5e7eb' }}>الكل</button>
        {noteTypes.map(t => (
          <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
            style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: typeFilter === t ? '#ecfdf5' : '#f9fafb', color: typeFilter === t ? THEME : '#6b7280', border: typeFilter === t ? `1px solid ${THEME}` : '1px solid #e5e7eb' }}>{t}</button>
        ))}
        <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: 'auto' }}>{filtered.length} ملاحظة</span>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#9ca3af' }}>لا توجد ملاحظات مطابقة</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {studentGroups.map((g, idx) => {
            const notSent = g.notes.filter(n => !n.isSent).length;
            const typeCounts: Record<string, number> = {};
            g.notes.forEach(n => { typeCounts[n.noteType] = (typeCounts[n.noteType] || 0) + 1; });
            return (
              <div key={idx} onClick={() => setDetailStudent({ name: g.info.studentName, grade: g.info.grade, cls: g.info.className, notes: g.notes })}
                style={{ background: '#fff', borderRadius: '12px', border: `2px solid ${g.notes.length >= 10 ? THEME : g.notes.length >= 5 ? '#a7f3d0' : notSent > 0 ? '#fdba74' : '#e5e7eb'}`, padding: '16px', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 800, color: THEME }}>{g.notes.length}</span>
                  {notSent > 0
                    ? <span style={{ fontSize: '10px', fontWeight: 700, background: '#fff7ed', color: '#9a3412', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fdba74' }}>{notSent} لم يُرسل</span>
                    : <span style={{ fontSize: '10px', fontWeight: 700, background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>تم الإرسال</span>
                  }
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '14px', margin: '0 0 4px', color: '#1f2937' }}>{g.info.studentName}</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px' }}>{g.info.grade}/{g.info.className}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {Object.entries(typeCounts).map(([t, c]) => (
                    <div key={t} style={{ flex: 1, textAlign: 'center', background: '#ecfdf5', borderRadius: '8px', padding: '6px 4px', minWidth: '60px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: THEME }}>{c}</div>
                      <div style={{ fontSize: '9px', color: '#047857', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>الطالب</th><th style={thStyle}>الصف</th><th style={thStyle}>نوع الملاحظة</th>
                <th style={thStyle}>التفاصيل</th><th style={thStyle}>التاريخ</th><th style={thStyle}>الإرسال</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.studentName}</td>
                  <td style={tdStyle}>{r.grade} / {r.className}</td>
                  <td style={tdStyle}><span style={{ padding: '2px 8px', background: '#ecfdf5', color: THEME, borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{r.noteType}</span></td>
                  <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.details || '-'}</td>
                  <td style={tdStyle}>{r.hijriDate || '-'}</td>
                  <td style={tdStyle}>{r.isSent
                    ? <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>تم</span>
                    : <span style={{ padding: '2px 8px', background: '#fff7ed', color: '#9a3412', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>لم يُرسل</span>
                  }</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student detail modal */}
      {detailStudent && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setDetailStudent(null); }}>
          <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '640px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to left, #ecfdf5, #fff)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{detailStudent.name}</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{detailStudent.grade} / {detailStudent.cls}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: '#ecfdf5', color: THEME, padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>{detailStudent.notes.length} ملاحظة</span>
                <button onClick={() => setDetailStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af' }}>x</button>
              </div>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {detailStudent.notes.map(n => (
                <div key={n.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '12px', borderRight: `4px solid ${THEME}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>{n.details || '-'}</p>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{n.hijriDate || ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', background: '#ecfdf5', color: THEME, borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>{n.noteType}</span>
                    {n.isSent
                      ? <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: '100px', fontSize: '10px', fontWeight: 700 }}>تم</span>
                      : <span style={{ padding: '2px 8px', background: '#fff7ed', color: '#9a3412', borderRadius: '100px', fontSize: '10px', fontWeight: 700 }}>لم يُرسل</span>
                    }
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{n.teacherName || ''}</span>
                    <button onClick={() => { printForm('tawtheeq_tawasol', { studentName: detailStudent.name, grade: detailStudent.grade + ' / ' + detailStudent.cls, contactType: 'ملاحظة تربوية', contactReason: n.noteType + (n.details ? ' - ' + n.details : ''), violationDate: n.hijriDate || '', contactResult: n.isSent ? 'تم التواصل عبر الواتساب' : 'لم يتم الإرسال بعد', notes: 'المسجّل: ' + (n.teacherName || '-') }); }} style={{ padding: '2px 8px', background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>📞 توثيق تواصل</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ────────────────────────── REPORTS TAB ──────────────────────────
const ReportsTab: React.FC<{ stage: string }> = ({ stage }) => {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    if (!stage) return;
    setLoading(true);
    try {
      const res = await educationalNotesApi.getReport(stage);
      if (res.data?.data) setReport(res.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [stage]);

  useEffect(() => { loadReport(); }, [loadReport]);

  if (loading) return <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>;
  if (!report) return <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>اضغط تحديث لعرض البيانات</div>;

  return (
    <div>
      <button onClick={loadReport} style={{ ...btnStyle('#4f46e5', '#fff'), marginBottom: '16px' }}>تحديث</button>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <ReportCard label="إجمالي الملاحظات" value={report.total} color={THEME} />
        <ReportCard label="عدد الطلاب" value={report.uniqueStudents} color="#3b82f6" />
        <ReportCard label="تم إرسالها" value={report.sent} color="#22c55e" />
        <ReportCard label="لم تُرسل" value={report.unsent} color="#f97316" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Top students */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fef2f2' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>أكثر الطلاب ملاحظات</h3>
          </div>
          <div style={{ padding: '16px' }}>
            {report.topStudents.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>لا توجد بيانات</p> :
              report.topStudents.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderRadius: '8px', background: i < 3 ? '#fef2f2' : '#f9fafb', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: i < 3 ? '#ef4444' : '#d1d5db', color: i < 3 ? '#fff' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>{i + 1}</span>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{s.studentName}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: '8px' }}>{s.grade} {s.className}</span>
                    </div>
                  </div>
                  <span style={{ padding: '2px 8px', background: '#ecfdf5', color: THEME, borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>{s.count} ملاحظة</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* By class */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#ecfdf5' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>الملاحظات حسب الفصل</h3>
          </div>
          <div style={{ padding: '16px' }}>
            {report.byClass.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>لا توجد بيانات</p> :
              report.byClass.map((c, i) => {
                const pct = report.total > 0 ? Math.round((c.count / report.total) * 100) : 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.className}</span>
                    <div style={{ flex: 1, background: '#e5e7eb', borderRadius: '99px', height: '16px' }}>
                      <div style={{ width: `${pct}%`, background: THEME, borderRadius: '99px', height: '16px' }} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151', width: '40px', textAlign: 'left' }}>{c.count}</span>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* By type */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', gridColumn: 'span 2' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f5f3ff' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>الملاحظات حسب النوع</h3>
          </div>
          <div style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {report.byType.length === 0 ? <p style={{ color: '#9ca3af' }}>لا توجد بيانات</p> :
              report.byType.map((t, i) => {
                const colors = ['#059669', '#3b82f6', '#7c3aed', '#f59e0b', '#ef4444', '#06b6d4', '#4f46e5', '#f97316'];
                const color = colors[i % colors.length];
                const pct = report.total > 0 ? Math.round((t.count / report.total) * 100) : 0;
                return (
                  <div key={i} style={{ textAlign: 'center', padding: '16px', background: '#f9fafb', borderRadius: '12px', minWidth: '100px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color, marginBottom: '4px' }}>{t.count}</div>
                    <div style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{t.type}</div>
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>{pct}%</div>
                  </div>
                );
              })
            }
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', borderRight: `4px solid ${color}` }}>
    <div style={{ fontSize: '28px', fontWeight: 800, color, marginBottom: '4px' }}>{value}</div>
    <div style={{ fontSize: '13px', color: '#6b7280' }}>{label}</div>
  </div>
);

// ────────────────────────── ADD NOTE MODAL ──────────────────────────
interface AddModalProps { stage: string; noteTypes: string[]; onClose: () => void; onSaved: () => void }

const AddNoteModal: React.FC<AddModalProps> = ({ stage, noteTypes, onClose, onSaved }) => {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [noteType, setNoteType] = useState('');
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
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStudents.map(s => s.id)));
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) return showError('اختر طالب واحد على الأقل');
    if (!noteType) return showError('اختر نوع الملاحظة');
    setSaving(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await educationalNotesApi.addBatch(ids, { noteType, details: details || undefined });
      if (res.data?.success !== false) { showSuccess(res.data?.data?.message || 'تم الحفظ بنجاح'); onSaved(); }
      else showError(res.data?.message || 'فشل الحفظ');
    } catch { showError('فشل الحفظ'); }
    finally { setSaving(false); }
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '640px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: `linear-gradient(to right, ${THEME}, #047857)`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 700 }}>تسجيل ملاحظة تربوية</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '24px', cursor: 'pointer' }}>x</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>الصف</label>
              <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setClassFilter(''); setSelectedIds(new Set()); }} style={inputStyle}>
                <option value="">اختر الصف</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>الفصل</label>
              <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSelectedIds(new Set()); }} disabled={!gradeFilter} style={inputStyle}>
                <option value="">اختر الفصل</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <label style={labelStyle}>الطلاب <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '11px' }}>(يمكنك اختيار أكثر من طالب)</span></label>
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

          <label style={labelStyle}>نوع الملاحظة</label>
          <select value={noteType} onChange={e => setNoteType(e.target.value)} style={inputStyle}>
            <option value="">اختر نوع الملاحظة</option>
            {noteTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={labelStyle}>التفاصيل (اختياري)</label>
          <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="أضف تفاصيل إضافية..." />
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', justifyContent: 'flex-end', background: '#f9fafb' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: '#fff', border: '2px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', background: THEME, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────── NOTE TYPES MODAL ──────────────────────────
const NoteTypesModal: React.FC<{ stage: string; types: string[]; onClose: () => void; onSaved: (types: string[]) => void }> = ({ stage, types: initialTypes, onClose, onSaved }) => {
  const [types, setTypes] = useState<string[]>(initialTypes);
  const [newType, setNewType] = useState('');
  const [saving, setSaving] = useState(false);

  const addType = async () => {
    const trimmed = newType.trim();
    if (!trimmed) return;
    if (types.includes(trimmed)) { showError('هذا النوع موجود مسبقاً'); return; }
    const updated = [...types, trimmed];
    setSaving(true);
    try {
      await educationalNotesApi.saveTypes(stage, updated);
      setTypes(updated);
      setNewType('');
      showSuccess(`تم إضافة "${trimmed}"`);
    } catch { showError('فشل الحفظ'); }
    finally { setSaving(false); }
  };

  const deleteType = async (index: number) => {
    const updated = types.filter((_, i) => i !== index);
    setSaving(true);
    try {
      await educationalNotesApi.saveTypes(stage, updated);
      setTypes(updated);
      showSuccess('تم الحذف');
    } catch { showError('فشل الحذف'); }
    finally { setSaving(false); }
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) { onSaved(types); onClose(); } }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '480px', width: '95%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(to right, #f59e0b, #d97706)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 700 }}>إعدادات أنواع الملاحظات</h3>
          <button onClick={() => { onSaved(types); onClose(); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '24px', cursor: 'pointer' }}>x</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ background: '#ecfdf5', border: '2px solid #a7f3d0', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 12px', fontWeight: 700, color: '#047857', fontSize: '14px' }}>إضافة نوع جديد</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={newType} onChange={e => setNewType(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addType(); }}
                placeholder="اكتب اسم النوع..." style={{ flex: 1, padding: '10px 14px', border: '2px solid #a7f3d0', borderRadius: '10px', fontSize: '14px' }} />
              <button onClick={addType} disabled={saving} style={{ padding: '10px 20px', background: THEME, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>إضافة</button>
            </div>
          </div>
          <h4 style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '14px', color: '#374151' }}>الأنواع الموجودة</h4>
          {types.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>لا توجد أنواع مضافة</p> :
            types.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '28px', height: '28px', background: '#ecfdf5', color: THEME, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{t}</span>
                </div>
                <button onClick={() => deleteType(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '18px' }}>x</button>
              </div>
            ))
          }
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', textAlign: 'left', background: '#f9fafb' }}>
          <button onClick={() => { onSaved(types); onClose(); }} style={{ padding: '8px 24px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>إغلاق</button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────── SHARED STYLES ──────────────────────────
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '13px' };
const tdStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'right', fontSize: '14px' };
const selectStyle: React.CSSProperties = { padding: '6px 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '12px', background: '#f9fafb' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' };
const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '8px 16px', background: bg, color, border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
});

export default EducationalNotesPage;
