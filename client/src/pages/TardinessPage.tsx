import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MI from '../components/shared/MI';
import PageHero from '../components/shared/PageHero';
import TabBar from '../components/shared/TabBar';
import ActionBar from '../components/shared/ActionBar';
import FloatingBar from '../components/shared/FloatingBar';
import EmptyState from '../components/shared/EmptyState';
import ActionIcon from '../components/shared/ActionIcon';
import { tardinessApi, TardinessData } from '../api/tardiness';
import { studentsApi } from '../api/students';
import { settingsApi, StageConfigData } from '../api/settings';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';
import { printForm } from '../utils/printTemplates';
import { printDailyReport } from '../utils/printDaily';
import { templatesApi } from '../api/templates';

const TARDINESS_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  Morning: { label: 'تأخر صباحي', color: '#dc2626', bg: '#fee2e2' },
  Period: { label: 'تأخر عن الحصة', color: '#ea580c', bg: '#ffedd5' },
  Assembly: { label: 'تأخر عن الاصطفاف', color: '#ca8a04', bg: '#fef9c3' },
};

const PERIODS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'];

interface TardinessRow {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  grade: string;
  className: string;
  stage: string;
  mobile: string;
  tardinessType: string;
  period: string;
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

type TabType = 'today' | 'approved' | 'reports';

const TardinessPage: React.FC = () => {
  const [records, setRecords] = useState<TardinessRow[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('__all__');
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<Record<string, string>>({});

  const enabledStages = useMemo(() =>
    stages.filter((s) => s.isEnabled && s.grades.some((g) => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, sRes, seRes] = await Promise.all([
        tardinessApi.getAll(),
        settingsApi.getStructure(),
        settingsApi.getSettings(),
      ]);
      if (rRes.data?.data) setRecords(rRes.data.data);
      if (sRes.data?.data?.stages) setStages(Array.isArray(sRes.data.data.stages) ? sRes.data.data.stages : []);
      if (seRes.data?.data) setSchoolSettings(seRes.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredByStage = useMemo(() => {
    if (stageFilter === '__all__') return records;
    const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
    return records.filter((r) => r.stage === stageId);
  }, [records, stageFilter]);

  const todayDate = new Date().toISOString().split('T')[0];
  const todayRecords = useMemo(() =>
    filteredByStage.filter((r) => r.recordedAt?.startsWith(todayDate)),
    [filteredByStage, todayDate]
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div className="spinner" />
        <p style={{ color: '#666', marginTop: '16px' }}>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="sec-tardiness">
      {/* Hero Banner — مطابق لـ .page-hero: gradient أحمر + عدادات */}
      <PageHero
        title="التأخر"
        subtitle="تسجيل ومتابعة حالات التأخر"
        gradient="linear-gradient(135deg, #dc2626, #ef4444)"
        stats={[
          { icon: 'timer_off', label: 'تأخر اليوم', value: todayRecords.length, color: '#fbbf24' },
          { icon: 'bar_chart', label: 'إجمالي التأخر', value: filteredByStage.length, color: '#c084fc' },
          { icon: 'check_circle', label: 'تم الإرسال', value: filteredByStage.filter((r) => r.isSent).length, color: '#86efac' },
        ]}
      />

      {/* Tabs — مطابق لـ .tabs-bar: 3 tabs مع Material Symbols بلون أحمر */}
      <TabBar
        tabs={[
          { id: 'today', label: 'اليومي', icon: 'today' },
          { id: 'approved', label: 'المعتمد', icon: 'verified' },
          { id: 'reports', label: 'التقارير', icon: 'bar_chart' },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabType)}
        sectionColor="#dc2626"
      />

      {/* Stage Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#6b7280' }}>المرحلة:</span>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
          <FilterBtn label="الكل" count={records.length} active={stageFilter === '__all__'} onClick={() => setStageFilter('__all__')} color="#dc2626" />
          {enabledStages.map((stage) => {
            const info = SETTINGS_STAGES.find((s) => s.id === stage.stage);
            const count = records.filter((r) => r.stage === stage.stage).length;
            return <FilterBtn key={stage.stage} label={info?.name || stage.stage} count={count} active={stageFilter === (info?.name || stage.stage)} onClick={() => setStageFilter(info?.name || stage.stage)} color="#dc2626" />;
          })}
        </div>
      </div>

      {activeTab === 'today' && <TodayTab records={todayRecords} onRefresh={loadData} stageFilter={stageFilter} schoolSettings={schoolSettings} />}
      {activeTab === 'approved' && <ApprovedTab records={filteredByStage} onRefresh={loadData} schoolSettings={schoolSettings} />}
      {activeTab === 'reports' && <ReportsTab records={filteredByStage} />}

      {modalOpen && <AddTardinessModal stages={enabledStages} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); loadData(); }} />}
    </div>
  );
};

// ============================================================
// Today Tab
// ============================================================
const TodayTab: React.FC<{
  records: TardinessRow[];
  onRefresh: () => void;
  stageFilter: string;
  schoolSettings: Record<string, string>;
}> = ({ records, onRefresh, stageFilter, schoolSettings }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<TardinessRow | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [msgEditorRow, setMsgEditorRow] = useState<TardinessRow | null>(null);

  const filtered = useMemo(() => {
    let list = records;
    if (typeFilter) list = list.filter((r) => r.tardinessType === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.studentName.toLowerCase().includes(q) || r.studentNumber.includes(q));
    }
    return list;
  }, [records, typeFilter, search]);

  const toggleSelect = (id: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((r) => r.id))); };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await tardinessApi.delete(confirmDelete.id);
      showSuccess('تم حذف السجل'); setConfirmDelete(null); onRefresh();
    } catch { showError('خطأ'); }
  };

  const handleSendWhatsApp = (r: TardinessRow) => {
    setMsgEditorRow(r);
  };

  const handleConfirmSend = async (r: TardinessRow, message: string) => {
    setSendingId(r.id);
    setMsgEditorRow(null);
    try {
      const res = await tardinessApi.sendWhatsApp(r.id, { message });
      if (res.data?.data?.success) { showSuccess('تم إرسال الرسالة'); onRefresh(); }
      else showError(res.data?.message || 'فشل الإرسال');
    } catch { showError('خطأ'); }
    finally { setSendingId(null); }
  };

  const handleSendBulk = async () => {
    if (selected.size === 0) return;
    try {
      const res = await tardinessApi.sendWhatsAppBulk(Array.from(selected));
      if (res.data?.data) { showSuccess(`تم إرسال ${res.data.data.sentCount} من ${res.data.data.total}`); setSelected(new Set()); onRefresh(); }
    } catch { showError('خطأ في الإرسال الجماعي'); }
  };

  const handleDeleteBulk = async () => {
    if (selected.size === 0) return;
    try {
      const res = await tardinessApi.deleteBulk(Array.from(selected));
      if (res.data?.data) { showSuccess(`تم حذف ${res.data.data.deletedCount} سجل`); setSelected(new Set()); onRefresh(); }
    } catch { showError('خطأ'); }
  };

  const handleExport = async () => {
    try {
      const stage = stageFilter !== '__all__' ? (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter) : undefined;
      const res = await tardinessApi.exportCsv(stage);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'tardiness.csv'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { showError('خطأ في التصدير'); }
  };

  const handlePrintToday = () => {
    const toPrint = selected.size > 0 ? filtered.filter(r => selected.has(r.id)) : filtered;
    if (toPrint.length === 0) { showError('لا يوجد بيانات للطباعة'); return; }
    const stage = stageFilter !== '__all__' ? (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter) : undefined;
    printDailyReport('tardiness', toPrint as unknown as Record<string, unknown>[], schoolSettings as any, stage);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم..."
          style={{ flex: 1, minWidth: '200px', height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الأنواع</option>
          {Object.entries(TARDINESS_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <button onClick={handlePrintToday} style={{ height: '38px', padding: '0 16px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>print</span> طباعة</button>
        <button onClick={handleExport} style={{ height: '38px', padding: '0 16px', background: '#059669', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>download</span> تصدير</button>
      </div>

      {/* Floating Selection Bar */}
      {selected.size > 0 && (
        <div style={{ position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,64,175,0.95)', color: '#fff', padding: '12px 24px', borderRadius: '100px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '16px', zIndex: 50, backdropFilter: 'blur(8px)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontWeight: 800, fontSize: '16px' }}>{selected.size}</span><span style={{ fontSize: '13px' }}>محدد</span></span>
          <span style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.3)' }} />
          <button onClick={handlePrintToday} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>print</span> طباعة</button>
          <button onClick={handleSendBulk} style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span> إرسال</button>
          <button onClick={handleDeleteBulk} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>delete</span> حذف</button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 72, color: '#d1d5db' }}>timer_off</span>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد حالات تأخر لهذا اليوم</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
                  <th>الطالب</th>
                  <th>الصف</th>
                  <th>النوع</th>
                  <th>الحصة</th>
                  <th>الإرسال</th>
                  <th style={{ textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const tt = TARDINESS_TYPES[r.tardinessType] || { label: r.tardinessType, color: '#374151', bg: '#f3f4f6' };
                  return (
                    <tr key={r.id} style={{ background: selected.has(r.id) ? '#eff6ff' : undefined }}>
                      <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#1f2937' }}>{r.studentName}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{r.studentNumber}</div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{r.grade} ({r.className})</td>
                      <td><span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, background: tt.bg, color: tt.color }}>{tt.label}</span></td>
                      <td style={{ fontSize: '13px' }}>{r.period || '-'}</td>
                      <td>
                        {r.isSent ? (
                          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>تم</span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>لم يُرسل</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => handleSendWhatsApp(r)} disabled={sendingId === r.id} title="إرسال واتساب"
                            style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: sendingId === r.id ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: sendingId === r.id ? 0.5 : 1 }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span></button>
                          <button onClick={() => { printForm('tawtheeq_tawasol', { studentName: r.studentName, grade: r.grade + ' / ' + r.className, contactType: 'تأخر', contactReason: 'تأخر ' + (r.tardinessType || '') + (r.period ? ' - ' + r.period : ''), violationDate: r.hijriDate || '', contactResult: r.isSent ? 'تم التواصل' : 'لم يتم الإرسال' }); }} title="توثيق تواصل"
                            style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>contact_phone</span></button>
                          <button onClick={() => setConfirmDelete(r)} title="حذف"
                            style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>delete</span></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="تأكيد حذف سجل التأخر"
          message={`هل أنت متأكد من حذف سجل التأخر للطالب ${confirmDelete.studentName}؟`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {msgEditorRow && (
        <MessageEditorModal
          record={msgEditorRow}
          onSend={(msg) => handleConfirmSend(msgEditorRow, msg)}
          onClose={() => setMsgEditorRow(null)}
        />
      )}
    </>
  );
};

// ============================================================
// Message Editor Modal
// ============================================================
const MessageEditorModal: React.FC<{
  record: TardinessRow;
  onSend: (message: string) => void;
  onClose: () => void;
}> = ({ record, onSend, onClose }) => {
  const hijriDate = record.hijriDate || new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'long', day: 'numeric' });
  const typeLabel = TARDINESS_TYPES[record.tardinessType]?.label || record.tardinessType;
  const defaultMsg = `ولي أمر الطالب / ${record.studentName}\nالسلام عليكم ورحمة الله وبركاته\nنفيدكم بأن ابنكم قد سُجّل عليه ${typeLabel}${record.period ? ` (${record.period})` : ''} بتاريخ ${hijriDate}.\nنأمل متابعة الطالب والحرص على الحضور في الوقت المحدد.\nمع تحيات إدارة المدرسة`;
  const [message, setMessage] = useState(defaultMsg);
  const [templateLoaded, setTemplateLoaded] = useState(false);

  useEffect(() => {
    templatesApi.getByType('تأخر').then(res => {
      const saved = res.data?.data?.template;
      if (saved) {
        const filled = saved.replace('{اسم_الطالب}', record.studentName).replace('{نوع_التأخر}', typeLabel).replace('{الحصة}', record.period || '').replace('{التاريخ}', hijriDate);
        setMessage(filled);
        setTemplateLoaded(true);
      }
    }).catch(() => {});
  }, []);

  const handleSaveAsTemplate = async () => { try { await templatesApi.save('تأخر', message); showSuccess('تم حفظ القالب'); } catch { showError('فشل'); } };
  const handleResetTemplate = async () => { try { await templatesApi.delete('تأخر'); setMessage(defaultMsg); setTemplateLoaded(false); showSuccess('تم استعادة القالب الافتراضي'); } catch { showError('فشل'); } };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '520px', padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #dcfce7, #f0fdf4)', borderBottom: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#15803d' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span> إرسال رسالة واتساب</h3>
            <span style={{ fontSize: '13px', color: '#4b5563' }}>{record.studentName} - {record.mobile || 'لا يوجد رقم'}</span>
          </div>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>نص الرسالة</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8}
            style={{ width: '100%', padding: '12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', lineHeight: 1.8, resize: 'vertical', boxSizing: 'border-box', direction: 'rtl' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleSaveAsTemplate} style={{ padding: '4px 12px', background: '#eef2ff', color: '#4f46e5', borderRadius: '6px', border: '1px solid #c7d2fe', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>💾 حفظ كقالب</button>
            <button onClick={handleResetTemplate} style={{ padding: '4px 12px', background: '#f3f4f6', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>إعادة تعيين</button>
            {templateLoaded && <span style={{ fontSize: '11px', color: '#059669', alignSelf: 'center' }}>✓ قالب محفوظ</span>}
          </div>
        </div>
        <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
          <button onClick={() => onSend(message)} style={{ padding: '8px 24px', background: '#25d366', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span> إرسال</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Approved Tab - السجل التراكمي
// ============================================================
const ApprovedTab: React.FC<{
  records: TardinessRow[];
  onRefresh: () => void;
  schoolSettings: Record<string, string>;
}> = ({ records, onRefresh, schoolSettings }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [detailStudent, setDetailStudent] = useState<{ studentId: number; studentName: string } | null>(null);

  const studentGroups = useMemo(() => {
    let list = records;
    if (typeFilter) list = list.filter((r) => r.tardinessType === typeFilter);
    if (gradeFilter) list = list.filter((r) => r.grade === gradeFilter);
    if (classFilter) list = list.filter((r) => r.className === classFilter);
    if (dateFrom) list = list.filter((r) => r.hijriDate >= dateFrom);
    if (dateTo) list = list.filter((r) => r.hijriDate <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.studentName.toLowerCase().includes(q) || r.studentNumber.includes(q));
    }
    const groups = new Map<number, { student: TardinessRow; records: TardinessRow[] }>();
    for (const r of list) {
      if (!groups.has(r.studentId)) groups.set(r.studentId, { student: r, records: [] });
      groups.get(r.studentId)!.records.push(r);
    }
    return Array.from(groups.values()).sort((a, b) => b.records.length - a.records.length);
  }, [records, typeFilter, gradeFilter, classFilter, search]);

  const grades = useMemo(() => Array.from(new Set(records.map((r) => r.grade))).sort(), [records]);
  const classes = useMemo(() => Array.from(new Set(records.filter((r) => !gradeFilter || r.grade === gradeFilter).map((r) => r.className))).sort(), [records, gradeFilter]);

  const allFilteredRecords = useMemo(() => {
    let list = records;
    if (typeFilter) list = list.filter((r) => r.tardinessType === typeFilter);
    if (gradeFilter) list = list.filter((r) => r.grade === gradeFilter);
    if (classFilter) list = list.filter((r) => r.className === classFilter);
    if (dateFrom) list = list.filter((r) => r.hijriDate >= dateFrom);
    if (dateTo) list = list.filter((r) => r.hijriDate <= dateTo);
    if (search) { const q = search.toLowerCase(); list = list.filter((r) => r.studentName.toLowerCase().includes(q) || r.studentNumber.includes(q)); }
    return list.sort((a, b) => `${a.grade}${a.className}`.localeCompare(`${b.grade}${b.className}`));
  }, [records, typeFilter, gradeFilter, classFilter, dateFrom, dateTo, search]);

  const handlePrintArchive = () => {
    if (allFilteredRecords.length === 0) { showError('لا يوجد بيانات للطباعة'); return; }
    printDailyReport('tardiness', allFilteredRecords as unknown as Record<string, unknown>[], schoolSettings as any);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..."
          style={{ flex: 1, minWidth: '200px', height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }} />
        <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setClassFilter(''); }}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الصفوف</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الفصول</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الأنواع</option>
          {Object.entries(TARDINESS_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setViewMode('cards')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === 'cards' ? '#fff' : 'transparent', color: viewMode === 'cards' ? '#ea580c' : '#6b7280', fontWeight: 700, fontSize: '13px' }}>🎴 بطاقات</button>
          <button onClick={() => setViewMode('table')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? '#ea580c' : '#6b7280', fontWeight: 700, fontSize: '13px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>assignment</span> جدول</button>
        </div>
        <button onClick={handlePrintArchive} style={{ height: '38px', padding: '0 16px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>print</span> طباعة</button>
      </div>

      {/* Date range filter */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>الفترة:</span>
        <input type="text" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="من تاريخ (هجري)"
          style={{ height: '34px', padding: '0 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px', width: '140px' }} />
        <input type="text" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="إلى تاريخ (هجري)"
          style={{ height: '34px', padding: '0 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px', width: '140px' }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>مسح</button>
        )}
      </div>

      {studentGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>assignment</span></p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد سجلات</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {studentGroups.map(({ student, records: rList }) => {
            const morning = rList.filter((r) => r.tardinessType === 'Morning').length;
            const period = rList.filter((r) => r.tardinessType === 'Period').length;
            return (
              <div key={student.studentId} onClick={() => setDetailStudent({ studentId: student.studentId, studentName: student.studentName })}
                style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{student.studentName}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{student.grade} ({student.className})</div>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: rList.length >= 5 ? '#dc2626' : '#ea580c' }}>{rList.length}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {morning > 0 && <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '12px', background: '#fee2e2', color: '#dc2626' }}>صباحي: {morning}</span>}
                  {period > 0 && <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '12px', background: '#ffedd5', color: '#ea580c' }}>حصة: {period}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>الطالب</th><th>الصف</th><th>العدد</th><th>صباحي</th><th>حصة</th><th style={{ textAlign: 'center' }}>تفاصيل</th></tr>
            </thead>
            <tbody>
              {studentGroups.map(({ student, records: rList }) => (
                <tr key={student.studentId}>
                  <td style={{ fontWeight: 700 }}>{student.studentName}</td>
                  <td>{student.grade} ({student.className})</td>
                  <td style={{ fontWeight: 700, color: '#ea580c' }}>{rList.length}</td>
                  <td>{rList.filter((r) => r.tardinessType === 'Morning').length}</td>
                  <td>{rList.filter((r) => r.tardinessType === 'Period').length}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => setDetailStudent({ studentId: student.studentId, studentName: student.studentName })}
                      style={{ padding: '4px 12px', background: '#fff7ed', color: '#ea580c', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>عرض</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailStudent && (
        <StudentDetailModal
          studentName={detailStudent.studentName}
          records={records.filter((r) => r.studentId === detailStudent.studentId)}
          onClose={() => setDetailStudent(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
};

// ============================================================
// Student Detail Modal
// ============================================================
const StudentDetailModal: React.FC<{
  studentName: string;
  records: TardinessRow[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({ studentName, records, onClose, onRefresh }) => {
  const handleSendAll = async () => {
    const unsent = records.filter((r) => !r.isSent);
    if (unsent.length === 0) { showError('جميع السجلات تم إرسالها'); return; }
    try {
      const res = await tardinessApi.sendWhatsAppBulk(unsent.map((r) => r.id));
      if (res.data?.data) { showSuccess(`تم إرسال ${res.data.data.sentCount} رسالة`); onRefresh(); }
    } catch { showError('خطأ'); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const rows = records.map((r) => {
      const tt = TARDINESS_TYPES[r.tardinessType] || { label: r.tardinessType };
      return `<tr><td>${r.hijriDate}</td><td>${tt.label}</td><td>${r.period || '-'}</td><td>${r.isSent ? 'نعم' : 'لا'}</td></tr>`;
    }).join('');
    pw.document.write(`<html dir="rtl"><head><title>سجل التأخر - ${studentName}</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f0f0f0}h2{text-align:center}@media print{body{padding:15px}}</style></head>
      <body><h2>سجل التأخر</h2><p><strong>الطالب:</strong> ${studentName} | <strong>إجمالي التأخر:</strong> ${records.length}</p>
      <table><thead><tr><th>التاريخ</th><th>النوع</th><th>الحصة</th><th>إرسال</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    pw.document.close(); pw.print();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #fff7ed, #ffedd5)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{studentName}</h3>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>إجمالي التأخر: <strong>{records.length}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSendAll} style={{ padding: '6px 12px', background: '#25d366', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span> إرسال الكل</button>
            <button onClick={handlePrint} style={{ padding: '6px 12px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>print</span> طباعة</button>
            <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          <table className="data-table">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الحصة</th><th>المسجل</th><th>الإرسال</th></tr></thead>
            <tbody>
              {records.map((r) => {
                const tt = TARDINESS_TYPES[r.tardinessType] || { label: r.tardinessType, color: '#374151', bg: '#f3f4f6' };
                return (
                  <tr key={r.id}>
                    <td style={{ fontSize: '13px' }}>{r.hijriDate}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: tt.bg, color: tt.color }}>{tt.label}</span></td>
                    <td>{r.period || '-'}</td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>{r.recordedBy}</td>
                    <td>{r.isSent ? <span style={{ color: '#15803d' }}><span className="material-symbols-outlined" style={{fontSize:16,color:'#15803d'}}>check_circle</span></span> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Reports Tab
// ============================================================
const ReportsTab: React.FC<{ records: TardinessRow[] }> = ({ records }) => {
  const morningCount = records.filter((r) => r.tardinessType === 'Morning').length;
  const periodCount = records.filter((r) => r.tardinessType === 'Period').length;

  const topStudents = useMemo(() => {
    const groups = new Map<number, { name: string; grade: string; cls: string; count: number }>();
    for (const r of records) {
      const g = groups.get(r.studentId) || { name: r.studentName, grade: r.grade, cls: r.className, count: 0 };
      g.count++;
      groups.set(r.studentId, g);
    }
    return Array.from(groups.entries()).map(([id, g]) => ({ id, ...g })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [records]);

  const byClass = useMemo(() => {
    const groups = new Map<string, number>();
    for (const r of records) { const key = `${r.grade} (${r.className})`; groups.set(key, (groups.get(key) || 0) + 1); }
    return Array.from(groups.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [records]);

  const maxByClass = Math.max(...byClass.map((c) => c.count), 1);

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const studentRows = topStudents.map((s, i) => `<tr><td>${i + 1}</td><td>${s.name}</td><td>${s.grade} (${s.cls})</td><td>${s.count}</td></tr>`).join('');
    pw.document.write(`<html dir="rtl"><head><title>تقرير التأخر</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f0f0f0}h2,h3{text-align:center}@media print{body{padding:15px}}</style></head>
      <body><h2>تقرير التأخر</h2><p style="text-align:center">الإجمالي: ${records.length} | صباحي: ${morningCount} | حصة: ${periodCount}</p>
      <h3>أكثر الطلاب تأخراً</h3><table><thead><tr><th>#</th><th>الطالب</th><th>الصف</th><th>العدد</th></tr></thead><tbody>${studentRows}</tbody></table></body></html>`);
    pw.document.close(); pw.print();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={handlePrint} style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>print</span> طباعة التقرير</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="إجمالي التأخر" value={records.length} color="#ea580c" />
        <StatCard label="تأخر صباحي" value={morningCount} color="#dc2626" />
        <StatCard label="تأخر عن الحصة" value={periodCount} color="#ca8a04" />
        <StatCard label="تم الإرسال" value={records.filter((r) => r.isSent).length} color="#15803d" />
      </div>

      {/* Type distribution bar */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>التوزيع حسب النوع</h4>
        {Object.entries(TARDINESS_TYPES).map(([key, t]) => {
          const count = records.filter((r) => r.tardinessType === key).length;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ width: '100px', fontSize: '13px', fontWeight: 700, color: t.color }}>{t.label}</span>
              <div style={{ flex: 1, height: '24px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max((count / Math.max(records.length, 1)) * 100, count > 0 ? 5 : 0)}%`, height: '100%', background: t.color, borderRadius: '6px' }} />
              </div>
              <span style={{ width: '40px', fontSize: '14px', fontWeight: 700 }}>{count}</span>
            </div>
          );
        })}
      </div>

      {byClass.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>التأخر حسب الفصل</h4>
          {byClass.slice(0, 10).map((c) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <span style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#4b5563' }}>{c.name}</span>
              <div style={{ flex: 1, height: '20px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${(c.count / maxByClass) * 100}%`, height: '100%', background: '#ea580c', borderRadius: '6px' }} />
              </div>
              <span style={{ width: '30px', fontSize: '13px', fontWeight: 700 }}>{c.count}</span>
            </div>
          ))}
        </div>
      )}

      {topStudents.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>أكثر الطلاب تأخراً</h4>
          </div>
          <table className="data-table">
            <thead><tr><th>#</th><th>الطالب</th><th>الصف</th><th>العدد</th></tr></thead>
            <tbody>
              {topStudents.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: '#6b7280' }}>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{s.name}</td>
                  <td>{s.grade} ({s.cls})</td>
                  <td style={{ fontWeight: 700, color: '#ea580c' }}>{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// ============================================================
// Shared Components
// ============================================================
const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
    <span style={{ fontSize: '24px', fontWeight: 800, color }}>{value}</span>
    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
  </div>
);

const FilterBtn: React.FC<{ label: string; count: number; active: boolean; onClick: () => void; color: string }> = ({ label, count, active, onClick, color }) => (
  <button onClick={onClick} style={{
    padding: '6px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
    background: active ? '#fff' : 'transparent', color: active ? color : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', border: 'none', cursor: 'pointer',
  }}>
    {label} <span style={{ fontSize: '12px', color: active ? color : '#9ca3af' }}>({count})</span>
  </button>
);

const ConfirmModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void }> = ({ title, message, onConfirm, onCancel }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '400px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: '0 0 24px', color: '#4b5563' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={onConfirm} style={{ padding: '8px 24px', background: '#dc2626', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>تأكيد</button>
      </div>
    </div>
  </div>
);

// ============================================================
// Add Tardiness Modal
// ============================================================
const AddTardinessModal: React.FC<{ stages: StageConfigData[]; onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [tardinessType, setTardinessType] = useState('Morning');
  const [period, setPeriod] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { studentsApi.getAll().then((res) => { if (res.data?.data) setStudents(res.data.data); }); }, []);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return [];
    const q = studentSearch.trim().toLowerCase();
    const selectedIds = new Set(selectedStudents.map((s) => s.id));
    return students.filter((s) => !selectedIds.has(s.id) && (s.name.toLowerCase().includes(q) || s.studentNumber.includes(q))).slice(0, 10);
  }, [students, studentSearch, selectedStudents]);

  const addStudent = (s: StudentOption) => {
    setSelectedStudents((prev) => [...prev, s]);
    setStudentSearch('');
  };

  const removeStudent = (id: number) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    if (selectedStudents.length === 0) return showError('اختر طالب واحد على الأقل');
    setSaving(true);
    try {
      if (selectedStudents.length === 1) {
        const data: TardinessData = { studentId: selectedStudents[0].id, tardinessType, period };
        const res = await tardinessApi.add(data);
        if (res.data?.success) { showSuccess('تم تسجيل التأخر'); onSaved(); }
        else showError(res.data?.message || 'فشل');
      } else {
        const res = await tardinessApi.addBatch(selectedStudents.map((s) => s.id), tardinessType, period);
        if (res.data?.data) { showSuccess(res.data.data.message || 'تم التسجيل'); onSaved(); }
        else showError(res.data?.message || 'فشل');
      }
    } catch { showError('فشل التسجيل'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #fff7ed, #ffedd5)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>تسجيل تأخر</h3>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Student search */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>الطلاب * (يمكن اختيار عدة طلاب)</label>
            <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الرقم..."
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }} />
            {filteredStudents.length > 0 && (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '4px' }}>
                {filteredStudents.map((s) => (
                  <div key={s.id} onClick={() => addStudent(s)} style={{
                    padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{s.grade} ({s.className})</span>
                  </div>
                ))}
              </div>
            )}
            {selectedStudents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {selectedStudents.map((s) => (
                  <span key={s.id} style={{ padding: '4px 10px', background: '#fff7ed', borderRadius: '8px', border: '1px solid #fed7aa', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {s.name}
                    <button onClick={() => removeStudent(s.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Type */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>نوع التأخر</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.entries(TARDINESS_TYPES).map(([key, t]) => (
                <button key={key} onClick={() => setTardinessType(key)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: '8px',
                  background: tardinessType === key ? t.bg : '#f9fafb',
                  color: tardinessType === key ? t.color : '#6b7280',
                  border: tardinessType === key ? `2px solid ${t.color}` : '1px solid #e5e7eb',
                  fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                }}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Period */}
          {tardinessType === 'Period' && (
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>الحصة</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PERIODS.map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} style={{
                    padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    background: period === p ? '#ea580c' : '#f3f4f6',
                    color: period === p ? '#fff' : '#374151',
                    border: period === p ? '2px solid #c2410c' : '1px solid #d1d5db',
                  }}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 24px', background: '#ea580c', color: '#fff',
            borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'جاري الحفظ...' : `حفظ (${selectedStudents.length} طالب)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TardinessPage;
