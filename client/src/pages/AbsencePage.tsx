import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { absenceApi, AbsenceData } from '../api/absence';
import { studentsApi } from '../api/students';
import { settingsApi, StageConfigData } from '../api/settings';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';

const SCHOOL_DAYS = 180;

const ABSENCE_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  FullDay: { label: 'يوم كامل', color: '#dc2626', bg: '#fee2e2' },
  Period: { label: 'حصة', color: '#ea580c', bg: '#ffedd5' },
};

const EXCUSE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  Excused: { label: 'بعذر', color: '#16a34a', bg: '#dcfce7' },
  Unexcused: { label: 'بدون عذر', color: '#dc2626', bg: '#fee2e2' },
};

interface AbsenceRow {
  id: number; studentId: number; studentNumber: string; studentName: string;
  grade: string; className: string; stage: string; mobile: string;
  absenceType: string; period: string; hijriDate: string; dayName: string;
  recordedBy: string; recordedAt: string; status: string; excuseType: string;
  isSent: boolean; tardinessStatus: string; arrivalTime: string; notes: string;
}

interface CumulativeRow {
  studentId: number; studentNumber: string; studentName: string;
  grade: string; className: string; stage: string;
  excusedDays: number; unexcusedDays: number; lateDays: number;
  totalDays: number;
}

interface StudentOption { id: number; studentNumber: string; name: string; stage: string; grade: string; className: string; }

type TabType = 'today' | 'approved' | 'reports';

const AbsencePage: React.FC = () => {
  const [records, setRecords] = useState<AbsenceRow[]>([]);
  const [cumulativeRecords, setCumulativeRecords] = useState<CumulativeRow[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('__all__');
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [modalOpen, setModalOpen] = useState(false);

  const enabledStages = useMemo(() =>
    stages.filter((s) => s.isEnabled && s.grades.some((g) => g.isEnabled && g.classCount > 0)), [stages]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const stageId = stageFilter !== '__all__' ? (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter) : undefined;
      const [rRes, sRes, cRes] = await Promise.all([
        absenceApi.getAll(),
        settingsApi.getStructure(),
        absenceApi.getAllCumulative(stageId),
      ]);
      if (rRes.data?.data) setRecords(rRes.data.data);
      if (sRes.data?.data?.stages) setStages(Array.isArray(sRes.data.data.stages) ? sRes.data.data.stages : []);
      if (cRes.data?.data) setCumulativeRecords(cRes.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [stageFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredByStage = useMemo(() => {
    if (stageFilter === '__all__') return records;
    const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
    return records.filter((r) => r.stage === stageId);
  }, [records, stageFilter]);

  const todayDate = new Date().toISOString().split('T')[0];
  const todayRecords = useMemo(() =>
    filteredByStage.filter((r) => r.recordedAt?.startsWith(todayDate)), [filteredByStage, todayDate]);

  if (loading) {
    return (<div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /><p style={{ color: '#666', marginTop: '16px' }}>جاري التحميل...</p></div>);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <span style={{ fontSize: '24px' }}>📋</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111' }}>الغياب</h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>تسجيل ومتابعة حالات الغياب</p>
          </div>
        </div>
        <button onClick={() => setModalOpen(true)} style={{
          padding: '10px 20px', background: '#ea580c', color: '#fff',
          borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(234,88,12,0.3)',
        }}>+ تسجيل غياب</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="غياب اليوم" value={todayRecords.length} color="#ea580c" />
        <StatCard label="بدون عذر" value={filteredByStage.filter((r) => r.excuseType === 'Unexcused').length} color="#dc2626" />
        <StatCard label="بعذر" value={filteredByStage.filter((r) => r.excuseType === 'Excused').length} color="#2563eb" />
        <StatCard label="تم الإرسال" value={filteredByStage.filter((r) => r.isSent).length} color="#15803d" />
        <StatCard label="حماية (10+)" value={cumulativeRecords.filter((r) => r.unexcusedDays >= 10).length} color="#ef4444" />
      </div>

      {/* Stage Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#6b7280' }}>المرحلة:</span>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
          <FilterBtn label="الكل" count={records.length} active={stageFilter === '__all__'} onClick={() => setStageFilter('__all__')} color="#ea580c" />
          {enabledStages.map((stage) => {
            const info = SETTINGS_STAGES.find((s) => s.id === stage.stage);
            const count = records.filter((r) => r.stage === stage.stage).length;
            return <FilterBtn key={stage.stage} label={info?.name || stage.stage} count={count} active={stageFilter === (info?.name || stage.stage)} onClick={() => setStageFilter(info?.name || stage.stage)} color="#ea580c" />;
          })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '10px', padding: '4px', marginBottom: '16px' }}>
        {([
          { id: 'today' as TabType, label: 'الغياب اليومي', icon: '📅' },
          { id: 'approved' as TabType, label: 'السجل التراكمي', icon: '📋' },
          { id: 'reports' as TabType, label: 'التقارير', icon: '📊' },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '10px 16px', borderRadius: '8px',
            background: activeTab === tab.id ? '#fff' : 'transparent',
            color: activeTab === tab.id ? '#ea580c' : '#6b7280',
            fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer',
            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>{tab.icon} {tab.label}</button>
        ))}
      </div>

      {activeTab === 'today' && <TodayTab records={todayRecords} onRefresh={loadData} stageFilter={stageFilter} />}
      {activeTab === 'approved' && <ApprovedTab records={cumulativeRecords} dailyRecords={filteredByStage} onRefresh={loadData} />}
      {activeTab === 'reports' && <ReportsTab records={filteredByStage} cumulativeRecords={cumulativeRecords} />}

      {modalOpen && <AddAbsenceModal stages={enabledStages} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); loadData(); }} />}
    </div>
  );
};

// ============================================================
// Today Tab
// ============================================================
const TodayTab: React.FC<{ records: AbsenceRow[]; onRefresh: () => void; stageFilter: string }> = ({ records, onRefresh, stageFilter }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AbsenceRow | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [msgEditorRow, setMsgEditorRow] = useState<AbsenceRow | null>(null);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // Handle merged cells
      if (sheet['!merges']) {
        for (const merge of sheet['!merges']) {
          const srcRef = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
          const srcCell = sheet[srcRef];
          if (srcCell) {
            for (let r = merge.s.r + 1; r <= merge.e.r; r++) {
              const tRef = XLSX.utils.encode_cell({ r, c: merge.s.c });
              if (!sheet[tRef]) sheet[tRef] = { t: srcCell.t, v: srcCell.v };
            }
          }
        }
      }
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      // Find header row
      const hdrIdx = rows.findIndex(r => r.some(c => String(c).includes('\u0627\u0644\u0625\u0633\u0645'))); // الإسم
      if (hdrIdx < 0) { showError('\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062a\u0639\u0631\u0641 \u0639\u0644\u0649 \u0647\u064a\u0643\u0644 \u0627\u0644\u0645\u0644\u0641'); return; }
      const hdrs = rows[hdrIdx].map(String);
      const nameCol = hdrs.findIndex(h => h.includes('\u0627\u0644\u0625\u0633\u0645'));
      const idCol = hdrs.findIndex(h => h.includes('\u0627\u0644\u0647\u0648\u064a\u0629'));
      const typeCol = hdrs.findIndex(h => h.includes('\u0646\u0648\u0639'));
      // Fill down empty cells in key columns
      const fillCols = hdrs.map((h, i) => (h.includes('\u0627\u0644\u0641\u0635\u0644') || h.includes('\u0627\u0644\u0645\u0631\u062d\u0644\u0629') || h.includes('\u0646\u0648\u0639')) ? i : -1).filter(i => i >= 0);
      for (const ci of fillCols) {
        let last = '';
        for (let r = hdrIdx + 1; r < rows.length; r++) {
          const v = String(rows[r]?.[ci] || '').trim();
          if (v) last = v; else if (last && rows[r]) rows[r][ci] = last;
        }
      }
      const students: { studentNumber?: string; name?: string; absenceType?: string }[] = [];
      for (let i = hdrIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[nameCol]) continue;
        const name = String(row[nameCol]).trim();
        const num = idCol >= 0 ? String(row[idCol]).trim() : '';
        const rawType = typeCol >= 0 ? String(row[typeCol]).trim() : '';
        const absenceType = rawType.includes('\u062d\u0635\u0629') ? 'Period' : 'FullDay';
        students.push({ studentNumber: num, name, absenceType });
      }
      if (students.length === 0) { showError('\u0644\u0627 \u064a\u0648\u062c\u062f \u0637\u0644\u0627\u0628 \u0641\u064a \u0627\u0644\u0645\u0644\u0641'); return; }
      if (!window.confirm(`\u0633\u064a\u062a\u0645 \u0627\u0633\u062a\u064a\u0631\u0627\u062f ${students.length} \u0637\u0627\u0644\u0628. \u0647\u0644 \u062a\u0631\u064a\u062f \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629\u061f`)) return;
      const res = await absenceApi.importFromExcel(students, 'noor');
      if (res.data?.data) showSuccess(res.data.data.message);
      onRefresh();
    } catch (err: any) {
      showError('\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f: ' + (err?.message || ''));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const filtered = useMemo(() => {
    if (!search) return records;
    const q = search.toLowerCase();
    return records.filter((r) => r.studentName.toLowerCase().includes(q) || r.studentNumber.includes(q));
  }, [records, search]);

  const toggleSelect = (id: number) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((r) => r.id))); };

  const handleDelete = async () => { if (!confirmDelete) return; try { await absenceApi.delete(confirmDelete.id); showSuccess('تم الحذف'); setConfirmDelete(null); onRefresh(); } catch { showError('خطأ'); } };

  const handleSendWhatsApp = (r: AbsenceRow) => {
    setMsgEditorRow(r);
  };

  const handleConfirmSend = async (message: string) => {
    if (!msgEditorRow) return;
    setSendingId(msgEditorRow.id);
    try { const res = await absenceApi.sendWhatsApp(msgEditorRow.id, { message }); if (res.data?.data?.success) { showSuccess('تم الإرسال'); setMsgEditorRow(null); onRefresh(); } else showError(res.data?.message || 'فشل'); }
    catch { showError('خطأ'); } finally { setSendingId(null); }
  };

  const handleSendBulk = async () => {
    if (selected.size === 0) return;
    try { const res = await absenceApi.sendWhatsAppBulk(Array.from(selected)); if (res.data?.data) { showSuccess(`تم إرسال ${res.data.data.sentCount} من ${res.data.data.total}`); setSelected(new Set()); onRefresh(); } }
    catch { showError('خطأ'); }
  };

  const handleDeleteBulk = async () => {
    if (selected.size === 0) return;
    try { const res = await absenceApi.deleteBulk(Array.from(selected)); if (res.data?.data) { showSuccess(`تم حذف ${res.data.data.deletedCount}`); setSelected(new Set()); onRefresh(); } }
    catch { showError('خطأ'); }
  };

  const handleToggleExcuse = async (r: AbsenceRow) => {
    const newType = r.excuseType === 'Excused' ? 'Unexcused' : 'Excused';
    try { await absenceApi.updateExcuseType(r.id, newType); showSuccess(`تم التغيير إلى ${newType === 'Excused' ? 'بعذر' : 'بدون عذر'}`); onRefresh(); } catch { showError('خطأ'); }
  };

  const handleExport = async () => {
    try {
      const stage = stageFilter !== '__all__' ? (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter) : undefined;
      const res = await absenceApi.exportCsv(stage);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'absence.csv'; a.click(); window.URL.revokeObjectURL(url);
    } catch { showError('خطأ في التصدير'); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const rows = filtered.map((r, i) => `<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.studentNumber}</td><td>${r.grade} (${r.className})</td><td>${r.excuseType === 'Excused' ? 'بعذر' : 'بدون عذر'}</td><td>${r.tardinessStatus === 'متأخر' ? 'متأخر ' + r.arrivalTime : 'غائب'}</td><td>${r.isSent ? 'تم' : '-'}</td></tr>`).join('');
    pw.document.write(`<html dir="rtl"><head><title>كشف الغياب اليومي</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f0f0f0}h2{text-align:center}@media print{body{padding:15px}}</style></head>
      <body><h2>كشف الغياب اليومي</h2><p style="text-align:center">العدد: ${filtered.length}</p>
      <table><thead><tr><th>#</th><th>الطالب</th><th>الرقم</th><th>الصف</th><th>العذر</th><th>الحالة</th><th>الإرسال</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    pw.document.close(); pw.print();
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..."
          style={{ flex: 1, minWidth: '200px', height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }} />
        <button onClick={handlePrint} style={{ height: '38px', padding: '0 16px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>🖨️ طباعة</button>
        <button onClick={handleExport} style={{ height: '38px', padding: '0 16px', background: '#059669', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>📥 تصدير</button>
        <label style={{ height: '38px', padding: '0 16px', background: '#7c3aed', color: '#fff', borderRadius: '8px', fontWeight: 700, cursor: importing ? 'not-allowed' : 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', opacity: importing ? 0.6 : 1 }}>
          {importing ? '⏳ جاري الاستيراد...' : '📂 استيراد Excel'}
          <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} style={{ display: 'none' }} disabled={importing} />
        </label>
      </div>

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#fef2f2', borderRadius: '10px', marginBottom: '12px', border: '1px solid #fecaca' }}>
          <span style={{ fontWeight: 700, color: '#dc2626' }}>تم تحديد {selected.size}</span>
          <div style={{ flex: 1 }} />
          <button onClick={handleSendBulk} style={{ padding: '6px 16px', background: '#25d366', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>📱 إرسال واتساب</button>
          <button onClick={handleDeleteBulk} style={{ padding: '6px 16px', background: '#dc2626', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>🗑️ حذف</button>
          <button onClick={() => setSelected(new Set())} style={{ padding: '6px 12px', background: '#e5e7eb', color: '#374151', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>إلغاء</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}><p style={{ fontSize: '48px' }}>📋</p><p style={{ fontSize: '18px', fontWeight: 500 }}>لا يوجد غياب مسجل اليوم</p></div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th style={{ width: '40px' }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
                <th>الطالب</th><th>الصف</th><th>العذر</th><th>الحالة</th><th>الإرسال</th><th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ background: selected.has(r.id) ? '#fef2f2' : undefined }}>
                    <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                    <td><div style={{ fontWeight: 700 }}>{r.studentName}</div><div style={{ fontSize: '12px', color: '#9ca3af' }}>{r.studentNumber}</div></td>
                    <td style={{ fontSize: '13px' }}>{r.grade} ({r.className})</td>
                    <td>
                      <button onClick={() => handleToggleExcuse(r)} style={{
                        padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: r.excuseType === 'Excused' ? '#dcfce7' : '#fee2e2',
                        color: r.excuseType === 'Excused' ? '#16a34a' : '#dc2626',
                      }}>{r.excuseType === 'Excused' ? 'بعذر' : 'بدون عذر'}</button>
                    </td>
                    <td>
                      {r.tardinessStatus === 'متأخر' ? (
                        <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>متأخر {r.arrivalTime}</span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>غائب</span>
                      )}
                    </td>
                    <td>
                      {r.isSent ? <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>تم</span>
                        : <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>لم يُرسل</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button onClick={() => handleSendWhatsApp(r)} disabled={sendingId === r.id} title="إرسال واتساب" style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: sendingId === r.id ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: sendingId === r.id ? 0.5 : 1 }}>📱</button>
                        <button onClick={() => setConfirmDelete(r)} title="حذف" style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmDelete && <ConfirmModal title="تأكيد حذف الغياب" message={`حذف سجل الغياب للطالب ${confirmDelete.studentName}؟`} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />}

      {msgEditorRow && <AbsMsgEditorModal row={msgEditorRow} onClose={() => setMsgEditorRow(null)} onSend={handleConfirmSend} sending={sendingId === msgEditorRow.id} />}
    </>
  );
};

// ── Absence Message Editor Modal ──
const AbsMsgEditorModal: React.FC<{ row: AbsenceRow; onClose: () => void; onSend: (msg: string) => void; sending: boolean }> = ({ row, onClose, onSend, sending }) => {
  const defaultMsg = `ولي أمر الطالب / ${row.studentName}\nالصف: ${row.grade} / ${row.className}\n\nنفيدكم بغياب ابنكم يوم ${row.dayName || ''} بتاريخ ${row.hijriDate || ''}\n${row.excuseType === 'Excused' ? 'نوع العذر: بعذر' : 'بدون عذر'}\n\nنأمل التواصل مع إدارة المدرسة.`;
  const [message, setMessage] = useState(defaultMsg);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '95%', maxWidth: '500px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff7ed' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ea580c' }}>تعديل رسالة الواتساب</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>الطالب: <b>{row.studentName}</b> — {row.grade}/{row.className}</div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={8} style={{ width: '100%', padding: '10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', direction: 'rtl' }} />
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', justifyContent: 'flex-end', background: '#f9fafb' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#fff', border: '2px solid #d1d5db', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>إلغاء</button>
          <button onClick={() => onSend(message)} disabled={sending} style={{ padding: '8px 20px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1 }}>{sending ? 'جاري الإرسال...' : 'إرسال'}</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Approved Tab (Cumulative)
// ============================================================
const ApprovedTab: React.FC<{ records: CumulativeRow[]; dailyRecords: AbsenceRow[]; onRefresh: () => void }> = ({ records, dailyRecords, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [detailStudent, setDetailStudent] = useState<{ studentId: number; studentName: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    let list = records;
    if (gradeFilter) list = list.filter((r) => r.grade === gradeFilter);
    if (classFilter) list = list.filter((r) => r.className === classFilter);
    if (search) { const q = search.toLowerCase(); list = list.filter((r) => r.studentName.toLowerCase().includes(q) || r.studentNumber.includes(q)); }
    switch (levelFilter) {
      case 'zero': return list.filter((r) => r.unexcusedDays === 0 && r.excusedDays === 0);
      case 'warning': return list.filter((r) => r.unexcusedDays >= 3 && r.unexcusedDays <= 4);
      case 'danger': return list.filter((r) => r.unexcusedDays >= 5 && r.unexcusedDays <= 9);
      case 'critical': return list.filter((r) => r.unexcusedDays >= 10);
      default: return list;
    }
  }, [records, gradeFilter, classFilter, search, levelFilter]);

  const grades = useMemo(() => Array.from(new Set(records.map((r) => r.grade))).sort(), [records]);
  const classes = useMemo(() => Array.from(new Set(records.filter((r) => !gradeFilter || r.grade === gradeFilter).map((r) => r.className))).sort(), [records, gradeFilter]);

  const getAttendance = (r: CumulativeRow) => Math.max(0, Math.round(((SCHOOL_DAYS - r.totalDays) / SCHOOL_DAYS) * 100));
  const getBadge = (u: number) => {
    if (u >= 10) return { text: 'حماية', color: '#dc2626', bg: '#fee2e2' };
    if (u >= 5) return { text: 'لجنة', color: '#ea580c', bg: '#ffedd5' };
    if (u >= 3) return { text: 'إنذار', color: '#ca8a04', bg: '#fef9c3' };
    return null;
  };

  const toggleSelect = (id: number) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((r) => r.studentId))); };

  const selectedRecords = useMemo(() => filtered.filter((r) => selected.has(r.studentId)), [filtered, selected]);

  const handlePrint = () => {
    const pw = window.open('', '_blank'); if (!pw) return;
    const sorted = [...filtered].sort((a, b) => `${a.grade}${a.className}`.localeCompare(`${b.grade}${b.className}`));
    let prevClass = '';
    const rows = sorted.map((r, i) => {
      const classKey = `${r.grade} (${r.className})`;
      let separator = '';
      if (classKey !== prevClass) { prevClass = classKey; separator = `<tr style="background:#f0f0f0;font-weight:700"><td colspan="7">${classKey}</td></tr>`; }
      return `${separator}<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.studentNumber}</td><td>${r.unexcusedDays}</td><td>${r.excusedDays}</td><td>${r.totalDays}</td><td>${getAttendance(r)}%</td></tr>`;
    }).join('');
    pw.document.write(`<html dir="rtl"><head><title>كشف متابعة الغياب</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#e5e7eb}h2{text-align:center}@media print{body{padding:15px}}</style></head>
      <body><h2>كشف متابعة الغياب</h2><p style="text-align:center">العدد: ${filtered.length}</p>
      <table><thead><tr><th>#</th><th>الطالب</th><th>الرقم</th><th>بدون عذر</th><th>بعذر</th><th>الإجمالي</th><th>المواظبة</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    pw.document.close(); pw.print();
  };

  // Individual pledge form (تعهد فردي)
  const handlePrintPledge = (r: CumulativeRow) => {
    const pw = window.open('', '_blank'); if (!pw) return;
    pw.document.write(`<html dir="rtl"><head><title>تعهد التزام بالحضور</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:40px;direction:rtl}h2{text-align:center;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:10px;text-align:right}th{background:#f0f0f0}.sig{margin-top:60px;display:flex;justify-content:space-between}.sig div{text-align:center;width:30%}.sig div span{display:block;margin-top:40px;border-top:1px solid #333;padding-top:5px}@media print{body{padding:20px}}</style></head>
      <body>
      <h2>تعهد الالتزام بالحضور والمواظبة</h2>
      <p style="text-align:center;font-size:16px">أنا ولي أمر الطالب / <strong>${r.studentName}</strong></p>
      <table>
        <tr><th>اسم الطالب</th><td>${r.studentName}</td><th>رقم الطالب</th><td>${r.studentNumber}</td></tr>
        <tr><th>الصف</th><td>${r.grade}</td><th>الفصل</th><td>${r.className}</td></tr>
        <tr><th>أيام الغياب بدون عذر</th><td style="font-size:16pt;font-weight:700;color:#dc2626;text-align:center">${r.unexcusedDays}</td><th>أيام الغياب بعذر</th><td style="font-size:16pt;font-weight:700;color:#2563eb;text-align:center">${r.excusedDays}</td></tr>
      </table>
      <p style="margin-top:20px;line-height:2">أتعهد أنا ولي أمر الطالب المذكور أعلاه بمتابعة ابني والتزامه بالحضور وعدم الغياب بدون عذر مقبول، وفي حال تكرار الغياب أتحمل المسؤولية كاملة، وأعلم بأن تكرار الغياب يعرض ابني للإجراءات النظامية وفق لائحة السلوك والمواظبة.</p>
      <div class="sig">
        <div>الطالب<span>التوقيع</span></div>
        <div>ولي الأمر<span>التوقيع</span></div>
        <div>وكيل شؤون الطلاب<span>التوقيع</span></div>
      </div>
      </body></html>`);
    pw.document.close(); pw.print();
  };

  // Individual referral form (إحالة فردي)
  const handlePrintReferral = (r: CumulativeRow) => {
    const pw = window.open('', '_blank'); if (!pw) return;
    pw.document.write(`<html dir="rtl"><head><title>إحالة طالب - غياب</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:40px;direction:rtl}h2{text-align:center;margin-bottom:10px}h4{text-align:center;color:#666;margin-top:0}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:10px;text-align:right}th{background:#f0f0f0}.sec{margin-top:30px;padding:16px;border:1px solid #999;border-radius:8px}.sig{margin-top:50px;display:flex;justify-content:space-between}.sig div{text-align:center;width:30%}.sig div span{display:block;margin-top:40px;border-top:1px solid #333;padding-top:5px}@media print{body{padding:20px}}</style></head>
      <body>
      <div style="text-align:left;font-size:12px;color:#999">(سري)</div>
      <h2>نموذج إحالة طالب إلى الموجه الطلابي</h2>
      <h4>(غياب وتأخر دراسي)</h4>
      <table>
        <tr><th>اسم الطالب</th><td>${r.studentName}</td><th>رقم الطالب</th><td>${r.studentNumber}</td></tr>
        <tr><th>الصف</th><td>${r.grade}</td><th>الفصل</th><td>${r.className}</td></tr>
        <tr><th>أيام الغياب بدون عذر</th><td>${r.unexcusedDays} أيام</td><th>أيام الغياب بعذر</th><td>${r.excusedDays} أيام</td></tr>
      </table>
      <p><strong>سبب الإحالة:</strong> تكرار غياب الطالب وتأثيره السلبي على مستواه الدراسي والسلوكي</p>
      <div class="sec">
        <p style="font-weight:700;margin:0 0 12px">ما تم حيال الطالب من الموجه الطلابي:</p>
        <div style="min-height:80px;border-bottom:1px dotted #999"></div>
      </div>
      <div class="sig">
        <div>وكيل شؤون الطلاب<span>التوقيع</span></div>
        <div>الموجه الطلابي<span>التوقيع</span></div>
        <div>مدير المدرسة<span>التوقيع</span></div>
      </div>
      </body></html>`);
    pw.document.close(); pw.print();
  };

  // Group pledge form (تعهد جماعي)
  const handlePrintGroupPledge = () => {
    if (selectedRecords.length === 0) { showError('لم يتم تحديد طلاب'); return; }
    const pw = window.open('', '_blank'); if (!pw) return;
    const rows = selectedRecords.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.grade} (${r.className})</td><td>${r.unexcusedDays}</td><td>${r.excusedDays}</td><td></td></tr>`
    ).join('');
    pw.document.write(`<html dir="rtl"><head><title>كشف تعهد جماعي</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:40px;direction:rtl}h2{text-align:center;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f0f0f0}.sig{margin-top:50px;display:flex;justify-content:space-around}.sig div{text-align:center}.sig div span{display:block;margin-top:40px;border-top:1px solid #333;padding-top:5px}@media print{body{padding:20px}}</style></head>
      <body>
      <h2>كشف تعهد الالتزام بالحضور والمواظبة</h2>
      <p style="text-align:center">عدد الطلاب: <strong>${selectedRecords.length}</strong></p>
      <table>
        <thead><tr><th>م</th><th>اسم الطالب</th><th>الصف/الفصل</th><th>بدون عذر</th><th>بعذر</th><th>توقيع الطالب</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sig">
        <div>وكيل شؤون الطلاب<span>التوقيع</span></div>
      </div>
      </body></html>`);
    pw.document.close(); pw.print();
  };

  // Group referral form (إحالة جماعية)
  const handlePrintGroupReferral = () => {
    if (selectedRecords.length === 0) { showError('لم يتم تحديد طلاب'); return; }
    const pw = window.open('', '_blank'); if (!pw) return;
    const rows = selectedRecords.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.grade} (${r.className})</td><td>${r.unexcusedDays}</td><td>${r.excusedDays}</td><td></td></tr>`
    ).join('');
    pw.document.write(`<html dir="rtl"><head><title>كشف إحالة جماعية</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:40px;direction:rtl}h2{text-align:center;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f0f0f0}.sig{margin-top:50px;display:flex;justify-content:space-around}.sig div{text-align:center}.sig div span{display:block;margin-top:40px;border-top:1px solid #333;padding-top:5px}@media print{body{padding:20px}}</style></head>
      <body>
      <h2>نموذج إحالة للموجه الطلابي</h2>
      <p style="text-align:center">عدد الطلاب: <strong>${selectedRecords.length}</strong></p>
      <table>
        <thead><tr><th>م</th><th>اسم الطالب</th><th>الصف/الفصل</th><th>بدون عذر</th><th>بعذر</th><th>ما تم حيال الطالب</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sig">
        <div>وكيل شؤون الطلاب<span>التوقيع</span></div>
        <div>الموجه الطلابي<span>التوقيع</span></div>
      </div>
      </body></html>`);
    pw.document.close(); pw.print();
  };

  // Bulk WhatsApp send from archive
  const handleBulkSend = async () => {
    if (selectedRecords.length === 0) return;
    // Find daily record IDs for selected students (unsent ones)
    const studentIds = new Set(selectedRecords.map((r) => r.studentId));
    const unsentIds = dailyRecords.filter((r) => studentIds.has(r.studentId) && !r.isSent).map((r) => r.id);
    if (unsentIds.length === 0) { showError('لا توجد سجلات غير مرسلة لهؤلاء الطلاب'); return; }
    setSending(true);
    try {
      const res = await absenceApi.sendWhatsAppBulk(unsentIds);
      if (res.data?.data) {
        showSuccess(`تم إرسال ${res.data.data.sentCount} من ${res.data.data.total}`);
        setSelected(new Set());
        onRefresh();
      }
    } catch { showError('خطأ في الإرسال'); }
    finally { setSending(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..."
          style={{ flex: 1, minWidth: '200px', height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }} />
        <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setClassFilter(''); }}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الصفوف</option>{grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الفصول</option>{classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={handlePrint} style={{ height: '38px', padding: '0 16px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>🖨️ طباعة</button>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setViewMode('cards')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === 'cards' ? '#fff' : 'transparent', color: viewMode === 'cards' ? '#ea580c' : '#6b7280', fontWeight: 700, fontSize: '13px' }}>🎴 بطاقات</button>
          <button onClick={() => setViewMode('table')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? '#ea580c' : '#6b7280', fontWeight: 700, fontSize: '13px' }}>📋 جدول</button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#fff7ed', borderRadius: '10px', marginBottom: '12px', border: '1px solid #fed7aa', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#ea580c' }}>تم تحديد {selected.size} طالب</span>
          <div style={{ flex: 1 }} />
          <button onClick={handlePrintGroupPledge} style={{ padding: '6px 14px', background: '#6366f1', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>📄 كشف تعهد</button>
          <button onClick={handlePrintGroupReferral} style={{ padding: '6px 14px', background: '#7c3aed', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>📤 كشف إحالة</button>
          <button onClick={handleBulkSend} disabled={sending} style={{ padding: '6px 14px', background: '#25d366', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: sending ? 0.6 : 1 }}>
            {sending ? '⏳ جاري الإرسال...' : '📱 إرسال واتساب'}
          </button>
          <button onClick={() => setSelected(new Set())} style={{ padding: '6px 12px', background: '#e5e7eb', color: '#374151', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>إلغاء</button>
        </div>
      )}

      {/* Level Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'الكل', bg: '#f3f4f6', color: '#374151' },
          { id: 'zero', label: 'المنضبطين', bg: '#dcfce7', color: '#15803d' },
          { id: 'warning', label: 'إنذار (3-4)', bg: '#fef9c3', color: '#a16207' },
          { id: 'danger', label: 'لجنة (5-9)', bg: '#ffedd5', color: '#c2410c' },
          { id: 'critical', label: 'حماية (10+)', bg: '#fee2e2', color: '#dc2626' },
        ].map((f) => (
          <button key={f.id} onClick={() => setLevelFilter(f.id)} style={{
            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            background: levelFilter === f.id ? f.bg : '#f9fafb',
            color: levelFilter === f.id ? f.color : '#6b7280',
            border: levelFilter === f.id ? `2px solid ${f.color}` : '1px solid #e5e7eb',
          }}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}><p style={{ fontSize: '48px' }}>📋</p><p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد سجلات</p></div>
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {filtered.map((r) => {
            const att = getAttendance(r);
            const badge = getBadge(r.unexcusedDays);
            const isSel = selected.has(r.studentId);
            return (
              <div key={r.studentId}
                style={{ background: isSel ? '#fff7ed' : '#fff', borderRadius: '12px', border: `2px solid ${isSel ? '#f97316' : badge ? badge.color + '60' : '#e5e7eb'}`, padding: '16px', transition: 'box-shadow 0.2s', position: 'relative' }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
                {/* Checkbox */}
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={isSel} onChange={() => toggleSelect(r.studentId)} onClick={(e) => e.stopPropagation()} />
                  {badge && <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.text}</span>}
                </div>
                {/* Attendance */}
                <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: att >= 95 ? '#15803d' : att >= 90 ? '#ca8a04' : '#dc2626' }}>{att}%</span>
                </div>
                <div style={{ marginTop: '36px', marginBottom: '12px', cursor: 'pointer' }} onClick={() => setDetailStudent({ studentId: r.studentId, studentName: r.studentName })}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{r.studentName}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>{r.grade} ({r.className})</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginBottom: '12px' }}>
                  <div><div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>{r.unexcusedDays}</div><div style={{ fontSize: '10px', color: '#9ca3af' }}>بدون عذر</div></div>
                  <div><div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>{r.excusedDays}</div><div style={{ fontSize: '10px', color: '#9ca3af' }}>بعذر</div></div>
                  <div><div style={{ fontSize: '18px', fontWeight: 800, color: '#ca8a04' }}>{r.lateDays}</div><div style={{ fontSize: '10px', color: '#9ca3af' }}>تأخر</div></div>
                </div>
                {/* Form Buttons */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
                  <button onClick={(e) => { e.stopPropagation(); handlePrintPledge(r); }} style={{ flex: 1, padding: '5px', background: '#eef2ff', color: '#4f46e5', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}>📄 تعهد</button>
                  <button onClick={(e) => { e.stopPropagation(); handlePrintReferral(r); }} style={{ flex: 1, padding: '5px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}>📤 إحالة</button>
                  <button onClick={(e) => { e.stopPropagation(); setDetailStudent({ studentId: r.studentId, studentName: r.studentName }); }} style={{ flex: 1, padding: '5px', background: '#fef2f2', color: '#ea580c', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}>عرض</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr>
              <th style={{ width: '40px' }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
              <th>الطالب</th><th>الصف</th><th>بدون عذر</th><th>بعذر</th><th>تأخر</th><th>المواظبة</th><th>الإجراء</th><th style={{ textAlign: 'center' }}>نماذج / تفاصيل</th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => {
                const att = getAttendance(r);
                const badge = getBadge(r.unexcusedDays);
                return (
                  <tr key={r.studentId} style={{ background: selected.has(r.studentId) ? '#fff7ed' : undefined }}>
                    <td><input type="checkbox" checked={selected.has(r.studentId)} onChange={() => toggleSelect(r.studentId)} /></td>
                    <td style={{ fontWeight: 700 }}>{r.studentName}</td>
                    <td>{r.grade} ({r.className})</td>
                    <td style={{ fontWeight: 700, color: r.unexcusedDays > 0 ? '#dc2626' : '#d1d5db' }}>{r.unexcusedDays}</td>
                    <td style={{ fontWeight: 700, color: r.excusedDays > 0 ? '#2563eb' : '#d1d5db' }}>{r.excusedDays}</td>
                    <td>{r.lateDays}</td>
                    <td style={{ fontWeight: 700, color: att >= 95 ? '#15803d' : att >= 90 ? '#ca8a04' : '#dc2626' }}>{att}%</td>
                    <td>{badge ? <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.text}</span> : '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button onClick={() => handlePrintPledge(r)} title="تعهد" style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>📄</button>
                        <button onClick={() => handlePrintReferral(r)} title="إحالة" style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>📤</button>
                        <button onClick={() => setDetailStudent({ studentId: r.studentId, studentName: r.studentName })}
                          style={{ padding: '4px 12px', background: '#fef2f2', color: '#ea580c', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>عرض</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailStudent && (
        <StudentDetailModal studentName={detailStudent.studentName} records={dailyRecords.filter((r) => r.studentId === detailStudent.studentId)}
          cumulative={records.find((r) => r.studentId === detailStudent.studentId)} onClose={() => setDetailStudent(null)} onRefresh={onRefresh} />
      )}
    </>
  );
};

// ============================================================
// Student Detail Modal
// ============================================================
const StudentDetailModal: React.FC<{ studentName: string; records: AbsenceRow[]; cumulative?: CumulativeRow; onClose: () => void; onRefresh: () => void }> = ({ studentName, records, cumulative, onClose, onRefresh }) => {
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({ excusedDays: cumulative?.excusedDays || 0, unexcusedDays: cumulative?.unexcusedDays || 0, lateDays: cumulative?.lateDays || 0 });
  const [saving, setSaving] = useState(false);

  const handleSendAll = async () => {
    const unsent = records.filter((r) => !r.isSent);
    if (unsent.length === 0) { showError('جميع السجلات تم إرسالها'); return; }
    try { const res = await absenceApi.sendWhatsAppBulk(unsent.map((r) => r.id)); if (res.data?.data) { showSuccess(`تم إرسال ${res.data.data.sentCount}`); onRefresh(); } } catch { showError('خطأ'); }
  };

  const handleSaveCumulative = async () => {
    if (!cumulative) return;
    setSaving(true);
    try {
      await absenceApi.updateCumulative(cumulative.studentId, editValues);
      showSuccess('تم تحديث الغياب التراكمي');
      setEditing(false);
      onRefresh();
    } catch { showError('خطأ في التحديث'); }
    finally { setSaving(false); }
  };

  const att = cumulative ? Math.max(0, Math.round(((SCHOOL_DAYS - cumulative.totalDays) / SCHOOL_DAYS) * 100)) : 100;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #fef2f2, #fee2e2)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{studentName}</h3>
            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              <span>بدون عذر: <strong style={{ color: '#dc2626' }}>{cumulative?.unexcusedDays || 0}</strong></span>
              <span>بعذر: <strong style={{ color: '#2563eb' }}>{cumulative?.excusedDays || 0}</strong></span>
              <span>المواظبة: <strong style={{ color: att >= 95 ? '#15803d' : '#dc2626' }}>{att}%</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSendAll} style={{ padding: '6px 12px', background: '#25d366', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>📱 إرسال الكل</button>
            <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {cumulative && (
            <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editing ? '12px' : 0 }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#ea580c' }}>الغياب التراكمي</span>
                {!editing ? (
                  <button onClick={() => { setEditValues({ excusedDays: cumulative.excusedDays, unexcusedDays: cumulative.unexcusedDays, lateDays: cumulative.lateDays }); setEditing(true); }}
                    style={{ padding: '4px 12px', background: '#fff', color: '#ea580c', borderRadius: '6px', border: '1px solid #fecaca', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>✏️ تعديل</button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleSaveCumulative} disabled={saving}
                      style={{ padding: '4px 12px', background: '#15803d', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px', opacity: saving ? 0.6 : 1 }}>{saving ? '...' : '💾 حفظ'}</button>
                    <button onClick={() => setEditing(false)} style={{ padding: '4px 12px', background: '#e5e7eb', color: '#374151', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>إلغاء</button>
                  </div>
                )}
              </div>
              {editing && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {[
                    { key: 'unexcusedDays' as const, label: 'بدون عذر', color: '#dc2626' },
                    { key: 'excusedDays' as const, label: 'بعذر', color: '#2563eb' },
                    { key: 'lateDays' as const, label: 'تأخر', color: '#ca8a04' },
                  ].map((f) => (
                    <div key={f.key} style={{ textAlign: 'center' }}>
                      <label style={{ fontSize: '11px', color: f.color, fontWeight: 700 }}>{f.label}</label>
                      <input type="number" min={0} value={editValues[f.key]} onChange={(e) => setEditValues((p) => ({ ...p, [f.key]: parseInt(e.target.value) || 0 }))}
                        style={{ width: '100%', height: '32px', textAlign: 'center', border: '2px solid #d1d5db', borderRadius: '6px', fontSize: '14px', fontWeight: 700, marginTop: '4px' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <table className="data-table">
            <thead><tr><th>التاريخ</th><th>اليوم</th><th>النوع</th><th>العذر</th><th>الحالة</th><th>الإرسال</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: '13px' }}>{r.hijriDate}</td>
                  <td>{r.dayName || '-'}</td>
                  <td><span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: ABSENCE_TYPES[r.absenceType]?.bg || '#f3f4f6', color: ABSENCE_TYPES[r.absenceType]?.color || '#374151' }}>{ABSENCE_TYPES[r.absenceType]?.label || r.absenceType}</span></td>
                  <td><span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: EXCUSE_LABELS[r.excuseType]?.bg || '#f3f4f6', color: EXCUSE_LABELS[r.excuseType]?.color || '#374151' }}>{EXCUSE_LABELS[r.excuseType]?.label || r.excuseType}</span></td>
                  <td>{r.tardinessStatus === 'متأخر' ? <span style={{ color: '#ca8a04' }}>متأخر {r.arrivalTime}</span> : <span style={{ color: '#dc2626' }}>غائب</span>}</td>
                  <td>{r.isSent ? <span style={{ color: '#15803d' }}>✅</span> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                </tr>
              ))}
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
const ReportsTab: React.FC<{ records: AbsenceRow[]; cumulativeRecords: CumulativeRow[] }> = ({ records, cumulativeRecords }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredRecords = useMemo(() => {
    let list = records;
    if (dateFrom) list = list.filter((r) => r.hijriDate >= dateFrom);
    if (dateTo) list = list.filter((r) => r.hijriDate <= dateTo);
    return list;
  }, [records, dateFrom, dateTo]);

  const topStudents = useMemo(() =>
    [...cumulativeRecords].sort((a, b) => b.totalDays - a.totalDays).slice(0, 10), [cumulativeRecords]);

  const byClass = useMemo(() => {
    const g = new Map<string, number>();
    for (const r of filteredRecords) { const key = `${r.grade} (${r.className})`; g.set(key, (g.get(key) || 0) + 1); }
    return Array.from(g.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const byDay = useMemo(() => {
    const g = new Map<string, number>();
    for (const r of filteredRecords) { const key = r.dayName || 'غير محدد'; g.set(key, (g.get(key) || 0) + 1); }
    return Array.from(g.entries()).map(([day, count]) => ({ day, count })).sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const maxByClass = Math.max(...byClass.map((c) => c.count), 1);
  const excusedCount = filteredRecords.filter((r) => r.excuseType === 'Excused').length;
  const unexcusedCount = filteredRecords.filter((r) => r.excuseType === 'Unexcused').length;

  const handlePrint = () => {
    const pw = window.open('', '_blank'); if (!pw) return;
    const studentRows = topStudents.map((s, i) => `<tr><td>${i + 1}</td><td>${s.studentName}</td><td>${s.grade} (${s.className})</td><td>${s.unexcusedDays}</td><td>${s.excusedDays}</td><td>${s.totalDays}</td></tr>`).join('');
    const dateRange = dateFrom || dateTo ? `<p style="text-align:center">الفترة: ${dateFrom || '...'} إلى ${dateTo || '...'}</p>` : '';
    pw.document.write(`<html dir="rtl"><head><title>تقرير الغياب</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f0f0f0}h2,h3{text-align:center}@media print{body{padding:15px}}</style></head>
      <body><h2>تقرير الغياب</h2>${dateRange}<p style="text-align:center">الإجمالي: ${filteredRecords.length} | بدون عذر: ${unexcusedCount} | بعذر: ${excusedCount}</p>
      <h3>أكثر الطلاب غياباً</h3><table><thead><tr><th>#</th><th>الطالب</th><th>الصف</th><th>بدون عذر</th><th>بعذر</th><th>الإجمالي</th></tr></thead><tbody>${studentRows}</tbody></table></body></html>`);
    pw.document.close(); pw.print();
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>الفترة:</span>
        <input type="text" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="من تاريخ (هجري)"
          style={{ height: '34px', padding: '0 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px', width: '140px' }} />
        <input type="text" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="إلى تاريخ (هجري)"
          style={{ height: '34px', padding: '0 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px', width: '140px' }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            style={{ height: '34px', padding: '0 12px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>مسح</button>
        )}
        <div style={{ marginRight: 'auto' }}>
          <button onClick={handlePrint} style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>🖨️ طباعة التقرير</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="إجمالي الغياب" value={filteredRecords.length} color="#ea580c" />
        <StatCard label="بدون عذر" value={unexcusedCount} color="#dc2626" />
        <StatCard label="بعذر" value={excusedCount} color="#2563eb" />
      </div>

      {/* By Day */}
      {byDay.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>الغياب حسب اليوم</h4>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {byDay.map((d) => (
              <div key={d.day} style={{ textAlign: 'center', padding: '16px', background: '#f9fafb', borderRadius: '12px', minWidth: '80px' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d' }}>{d.count}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{d.day}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Class */}
      {byClass.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>الغياب حسب الفصل</h4>
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

      {/* Top Students */}
      {topStudents.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}><h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>أكثر الطلاب غياباً</h4></div>
          <table className="data-table">
            <thead><tr><th>#</th><th>الطالب</th><th>الصف</th><th>بدون عذر</th><th>بعذر</th><th>الإجمالي</th><th>المواظبة</th></tr></thead>
            <tbody>
              {topStudents.map((s, i) => {
                const att = Math.max(0, Math.round(((SCHOOL_DAYS - s.totalDays) / SCHOOL_DAYS) * 100));
                return (
                  <tr key={s.studentId}><td style={{ fontWeight: 700, color: '#6b7280' }}>{i + 1}</td><td style={{ fontWeight: 700 }}>{s.studentName}</td><td>{s.grade} ({s.className})</td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>{s.unexcusedDays}</td><td style={{ color: '#2563eb' }}>{s.excusedDays}</td><td style={{ fontWeight: 700 }}>{s.totalDays}</td>
                    <td style={{ fontWeight: 700, color: att >= 95 ? '#15803d' : att >= 90 ? '#ca8a04' : '#dc2626' }}>{att}%</td></tr>
                );
              })}
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
  <button onClick={onClick} style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, background: active ? '#fff' : 'transparent', color: active ? color : '#6b7280', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', border: 'none', cursor: 'pointer' }}>
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
// Add Absence Modal
// ============================================================
const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const PERIODS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'];

const AddAbsenceModal: React.FC<{ stages: StageConfigData[]; onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [absenceType, setAbsenceType] = useState('FullDay');
  const [period, setPeriod] = useState('');
  const [dayName, setDayName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { studentsApi.getAll().then((res) => { if (res.data?.data) setStudents(res.data.data); }); }, []);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return [];
    const q = studentSearch.trim().toLowerCase();
    const ids = new Set(selectedStudents.map((s) => s.id));
    return students.filter((s) => !ids.has(s.id) && (s.name.toLowerCase().includes(q) || s.studentNumber.includes(q))).slice(0, 10);
  }, [students, studentSearch, selectedStudents]);

  const handleSave = async () => {
    if (selectedStudents.length === 0) return showError('اختر طالب واحد على الأقل');
    setSaving(true);
    try {
      if (selectedStudents.length === 1) {
        const data: AbsenceData = { studentId: selectedStudents[0].id, absenceType, period, dayName, notes };
        const res = await absenceApi.add(data);
        if (res.data?.success) { showSuccess('تم تسجيل الغياب'); onSaved(); } else showError(res.data?.message || 'فشل');
      } else {
        const res = await absenceApi.addBatch(selectedStudents.map((s) => s.id), { absenceType, period, dayName, notes });
        if (res.data?.data) { showSuccess(res.data.data.message || 'تم'); onSaved(); } else showError(res.data?.message || 'فشل');
      }
    } catch { showError('فشل التسجيل'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #fef2f2, #fee2e2)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>تسجيل غياب</h3>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Students */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>الطلاب * (يمكن اختيار عدة طلاب)</label>
            <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم..."
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }} />
            {filteredStudents.length > 0 && (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '4px' }}>
                {filteredStudents.map((s) => (
                  <div key={s.id} onClick={() => { setSelectedStudents((p) => [...p, s]); setStudentSearch(''); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span><span style={{ fontSize: '12px', color: '#6b7280' }}>{s.grade} ({s.className})</span>
                  </div>
                ))}
              </div>
            )}
            {selectedStudents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {selectedStudents.map((s) => (
                  <span key={s.id} style={{ padding: '4px 10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {s.name}<button onClick={() => setSelectedStudents((p) => p.filter((x) => x.id !== s.id))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Absence Type */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>نوع الغياب</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.entries(ABSENCE_TYPES).map(([key, t]) => (
                <button key={key} onClick={() => setAbsenceType(key)} style={{
                  flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  background: absenceType === key ? t.bg : '#f3f4f6', color: absenceType === key ? t.color : '#374151',
                  border: absenceType === key ? `2px solid ${t.color}` : '1px solid #d1d5db',
                }}>{t.label}</button>
              ))}
            </div>
          </div>
          {/* Period (if Period type) */}
          {absenceType === 'Period' && (
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>الحصة</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PERIODS.map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} style={{
                    padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    background: period === p ? '#ea580c' : '#f3f4f6', color: period === p ? '#fff' : '#374151',
                    border: period === p ? '2px solid #c2410c' : '1px solid #d1d5db',
                  }}>{p}</button>
                ))}
              </div>
            </div>
          )}
          {/* Day Name */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>اليوم</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {DAY_NAMES.map((d) => (
                <button key={d} onClick={() => setDayName(d)} style={{
                  padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: dayName === d ? '#2563eb' : '#f3f4f6', color: dayName === d ? '#fff' : '#374151',
                  border: dayName === d ? '2px solid #1d4ed8' : '1px solid #d1d5db',
                }}>{d}</button>
              ))}
            </div>
          </div>
          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>ملاحظات (اختياري)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 24px', background: '#ea580c', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1,
          }}>{saving ? 'جاري الحفظ...' : `حفظ (${selectedStudents.length} طالب)`}</button>
        </div>
      </div>
    </div>
  );
};

export default AbsencePage;
