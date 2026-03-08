import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { tardinessApi } from '../api/tardiness';
import { permissionsApi } from '../api/permissions';
import { studentsApi } from '../api/students';
import { settingsApi, StageConfigData } from '../api/settings';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';

// ═══════════════════════════════════════════════════════════
// Constants — مطابقة لـ JS_Attendance.html سطر 13-17
// ═══════════════════════════════════════════════════════════
const PERMISSION_REASONS = ['ظرف صحي', 'ظرف أسري', 'موعد حكومي', 'طلب ولي الأمر'];
const PERMISSION_RECEIVERS = ['الأب', 'الأخ', 'الأم', 'الجد', 'العم', 'آخر'];
const PERMISSION_RESPONSIBLES = ['الموجه الطلابي', 'الوكيل', 'المدير'];
const PERIODS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'];

const TARDINESS_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  Morning: { label: 'تأخر صباحي', color: '#dc2626', bg: '#fee2e2' },
  Period: { label: 'تأخر حصة', color: '#d97706', bg: '#fef3c7' },
};

// ═══════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════
interface LateRow {
  id: number; studentId: number; studentNumber: string; studentName: string;
  grade: string; className: string; stage: string; mobile: string;
  tardinessType: string; period: string; hijriDate: string;
  recordedBy: string; recordedAt: string; isSent: boolean;
}
interface PermRow {
  id: number; studentId: number; studentNumber: string; studentName: string;
  grade: string; className: string; stage: string; mobile: string;
  exitTime: string; reason: string; receiver: string; supervisor: string;
  hijriDate: string; recordedBy: string; recordedAt: string;
  confirmationTime: string; isSent: boolean;
}
interface StudentOption {
  id: number; studentNumber: string; name: string; stage: string; grade: string; className: string;
}

type MainTab = 'late' | 'permission' | 'archive';

// ═══════════════════════════════════════════════════════════
// Main Page — مطابق لـ renderAttendancePage() في JS_Attendance.html سطر 51
// ═══════════════════════════════════════════════════════════
const AttendancePage: React.FC = () => {
  const [lateRecords, setLateRecords] = useState<LateRow[]>([]);
  const [permRecords, setPermRecords] = useState<PermRow[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('__all__');
  const [activeTab, setActiveTab] = useState<MainTab>('late');
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const enabledStages = useMemo(() =>
    stages.filter((s) => s.isEnabled && s.grades.some((g) => g.isEnabled && g.classCount > 0)), [stages]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, pRes, sRes, stRes] = await Promise.all([
        tardinessApi.getAll(), permissionsApi.getAll(),
        settingsApi.getStructure(), studentsApi.getAll(),
      ]);
      if (lRes.data?.data) setLateRecords(lRes.data.data);
      if (pRes.data?.data) setPermRecords(pRes.data.data);
      if (sRes.data?.data?.stages) setStages(Array.isArray(sRes.data.data.stages) ? sRes.data.data.stages : []);
      if (stRes.data?.data) setStudents(stRes.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const stageId = stageFilter !== '__all__' ? (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter) : null;
  const todayDate = new Date().toISOString().split('T')[0];

  const todayLate = useMemo(() => {
    let list = lateRecords.filter((r) => r.recordedAt?.startsWith(todayDate));
    if (stageId) list = list.filter((r) => r.stage === stageId);
    return list;
  }, [lateRecords, todayDate, stageId]);

  const todayPerm = useMemo(() => {
    let list = permRecords.filter((r) => r.recordedAt?.startsWith(todayDate));
    if (stageId) list = list.filter((r) => r.stage === stageId);
    return list;
  }, [permRecords, todayDate, stageId]);

  if (loading) {
    return (<div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /><p style={{ color: '#666', marginTop: '16px' }}>جاري التحميل...</p></div>);
  }

  // ─── Tab colors ───
  const tabColors: Record<MainTab, { main: string; bg: string; light: string }> = {
    late: { main: '#dc2626', bg: '#fee2e2', light: '#fef2f2' },
    permission: { main: '#7c3aed', bg: '#ede9fe', light: '#f5f3ff' },
    archive: { main: '#6b7280', bg: '#f3f4f6', light: '#f9fafb' },
  };
  const tc = tabColors[activeTab];

  return (
    <div>
      {/* ═══ Header — مطابق لسطر 56-68 ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
            <span style={{ fontSize: '24px' }}>⏰</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111' }}>التأخر والاستئذان</h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#999' }}>
              المرحلة: <span style={{ color: '#dc2626', fontWeight: 700 }}>{stageFilter === '__all__' ? 'جميع المراحل' : stageFilter}</span>
            </p>
          </div>
        </div>
        {/* Stats — مطابق لسطر 66-67 */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '8px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626' }}>{todayLate.length}</div>
            <div style={{ fontSize: '12px', color: '#ef4444' }}>متأخر</div>
          </div>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '8px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed' }}>{todayPerm.length}</div>
            <div style={{ fontSize: '12px', color: '#8b5cf6' }}>مستأذن</div>
          </div>
        </div>
      </div>

      {/* ═══ Stage filter ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#6b7280' }}>المرحلة:</span>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
          <StagePill label="الكل" active={stageFilter === '__all__'} onClick={() => setStageFilter('__all__')} color={tc.main} />
          {enabledStages.map((s) => {
            const info = SETTINGS_STAGES.find((si) => si.id === s.stage);
            return <StagePill key={s.stage} label={info?.name || s.stage} active={stageFilter === (info?.name || s.stage)} onClick={() => setStageFilter(info?.name || s.stage)} color={tc.main} />;
          })}
        </div>
      </div>

      {/* ═══ Tabs — مطابق لسطر 71-88 ═══ */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {([
            { id: 'late' as MainTab, label: 'تأخر اليوم', icon: '⏰', count: todayLate.length, color: '#dc2626', bg: '#fef2f2' },
            { id: 'permission' as MainTab, label: 'استئذان اليوم', icon: '🚪', count: todayPerm.length, color: '#7c3aed', bg: '#f5f3ff' },
            { id: 'archive' as MainTab, label: 'الأرشيف', icon: '📦', color: '#6b7280', bg: '#f9fafb' },
          ] as const).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: '14px 20px', textAlign: 'center', fontWeight: 700, fontSize: '14px',
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              borderBottom: activeTab === tab.id ? `3px solid ${tab.color}` : '3px solid transparent',
              color: activeTab === tab.id ? tab.color : '#6b7280',
              background: activeTab === tab.id ? tab.bg : 'transparent',
            }}>
              {tab.icon} {tab.label}
              {'count' in tab && tab.count !== undefined && (
                <span style={{
                  marginRight: '8px', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                  background: activeTab === tab.id ? tab.color : '#9ca3af', color: '#fff',
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Tab content ═══ */}
      {activeTab === 'late' && (
        <LateTab records={todayLate} onRefresh={loadData} onAdd={() => setLateModalOpen(true)} />
      )}
      {activeTab === 'permission' && (
        <PermissionTab records={todayPerm} onRefresh={loadData} onAdd={() => setPermModalOpen(true)} />
      )}
      {activeTab === 'archive' && (
        <ArchiveTab stageId={stageId} />
      )}

      {/* Modals */}
      {lateModalOpen && <AddLateModal students={students} stageId={stageId} onClose={() => setLateModalOpen(false)} onSaved={() => { setLateModalOpen(false); loadData(); }} />}
      {permModalOpen && <AddPermModal students={students} stageId={stageId} onClose={() => setPermModalOpen(false)} onSaved={() => { setPermModalOpen(false); loadData(); }} />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// Late Tab — مطابق لـ renderLateTab() سطر 139
// ═══════════════════════════════════════════════════════════
const LateTab: React.FC<{ records: LateRow[]; onRefresh: () => void; onAdd: () => void }> = ({ records, onRefresh, onAdd }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LateRow | null>(null);
  const [msgRow, setMsgRow] = useState<LateRow | null>(null);

  const toggleSelect = (id: number) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selected.size === records.length ? setSelected(new Set()) : setSelected(new Set(records.map((r) => r.id)));

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try { await tardinessApi.delete(confirmDelete.id); showSuccess('تم الحذف'); setConfirmDelete(null); onRefresh(); } catch { showError('خطأ'); }
  };

  const handleSend = async (r: LateRow, msg: string) => {
    setSendingId(r.id); setMsgRow(null);
    try {
      const res = await tardinessApi.sendWhatsApp(r.id, { message: msg });
      if (res.data?.data?.success) { showSuccess('تم الإرسال'); onRefresh(); } else showError('فشل الإرسال');
    } catch { showError('خطأ'); } finally { setSendingId(null); }
  };

  const handleBulkSend = async () => {
    if (selected.size === 0) return;
    try {
      const res = await tardinessApi.sendWhatsAppBulk(Array.from(selected));
      if (res.data?.data) { showSuccess(`تم إرسال ${res.data.data.sentCount} من ${res.data.data.total}`); setSelected(new Set()); onRefresh(); }
    } catch { showError('خطأ'); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank'); if (!pw) return;
    const rows = records.map((r, i) => {
      const tt = TARDINESS_TYPES[r.tardinessType] || { label: r.tardinessType };
      return `<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.grade} / ${r.className}</td><td>${r.hijriDate || ''}</td><td>${tt.label}</td><td>${r.period || '-'}</td></tr>`;
    }).join('');
    pw.document.write(`<html dir="rtl"><head><title>سجل المتأخرين</title><style>body{font-family:Tahoma,Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#fee2e2;color:#dc2626}h2{text-align:center;color:#dc2626}@media print{body{padding:10px}}</style></head><body><h2>سجل المتأخرين</h2><p style="text-align:center">العدد: ${records.length}</p><table><thead><tr><th>م</th><th>الطالب</th><th>الصف</th><th>التاريخ</th><th>النوع</th><th>الحصة</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    pw.document.close(); setTimeout(() => pw.print(), 300);
  };

  return (
    <>
      {/* Toolbar — مطابق لسطر 143-168 */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#dc2626', color: '#fff', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}>➕ تسجيل تأخر</button>
          <button onClick={onRefresh} style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', borderRadius: '10px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>🔄 تحديث</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={toggleAll} style={{ padding: '8px 14px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '13px' }}>☑️ تحديد الكل</button>
          <button onClick={handleBulkSend} disabled={selected.size === 0} style={{ padding: '8px 14px', background: selected.size > 0 ? '#25d366' : '#d1d5db', color: '#fff', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '13px' }}>📱 إرسال للمحددين</button>
          <button onClick={handlePrint} style={{ padding: '8px 14px', background: '#ede9fe', color: '#6d28d9', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '13px' }}>🖨️ طباعة</button>
        </div>
      </div>

      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '48px', margin: 0 }}>✅</p>
          <p style={{ fontSize: '18px', color: '#6b7280', fontWeight: 500, margin: '12px 0 4px' }}>لا يوجد متأخرون اليوم</p>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>اضغط على "تسجيل تأخر" لإضافة طالب متأخر</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table className="data-table">
            <thead style={{ background: '#fef2f2' }}>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" checked={selected.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                <th>الطالب</th><th>الصف</th><th>نوع التأخر</th><th>الحصة</th><th>اليوم والتاريخ</th><th>الإرسال</th><th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const tt = TARDINESS_TYPES[r.tardinessType] || { label: r.tardinessType, color: '#374151', bg: '#f3f4f6' };
                return (
                  <tr key={r.id} style={{ background: selected.has(r.id) ? '#fef2f2' : undefined }}>
                    <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                    <td><div style={{ fontWeight: 700 }}>{r.studentName}</div><div style={{ fontSize: '12px', color: '#9ca3af' }}>{r.studentNumber}</div></td>
                    <td style={{ fontSize: '13px' }}>{r.grade} / {r.className}</td>
                    <td><span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: tt.bg, color: tt.color }}>{tt.label}</span></td>
                    <td><span style={{ padding: '4px 8px', background: '#f3f4f6', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>{r.period || '-'}</span></td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>{r.hijriDate}</td>
                    <td>{r.isSent ? <Badge label="تم ✓" bg="#dcfce7" color="#15803d" /> : <Badge label="لم يُرسل" bg="#fef3c7" color="#92400e" />}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <IconBtn icon="📱" title="إرسال" disabled={sendingId === r.id} onClick={() => setMsgRow(r)} />
                        <IconBtn icon="🗑️" title="حذف" onClick={() => setConfirmDelete(r)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && <ConfirmModal title="حذف السجل" message={`هل تريد حذف سجل التأخر للطالب ${confirmDelete.studentName}؟`} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />}
      {msgRow && <SendMsgModal name={msgRow.studentName} mobile={msgRow.mobile} defaultMsg={`السلام عليكم ورحمة الله وبركاته\n\nولي أمر الطالب: ${msgRow.studentName}\n\nنود إبلاغكم بتأخر ابنكم عن الحضور للمدرسة اليوم.\n${msgRow.tardinessType === 'Period' ? `نوع التأخر: تأخر حصة\nالحصة: ${msgRow.period}` : 'نوع التأخر: تأخر صباحي'}\n\nنأمل الحرص على الحضور المبكر.`} onSend={(msg) => handleSend(msgRow, msg)} onClose={() => setMsgRow(null)} color="#dc2626" />}
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// Permission Tab — مطابق لـ renderPermissionTab() سطر 287
// ═══════════════════════════════════════════════════════════
const PermissionTab: React.FC<{ records: PermRow[]; onRefresh: () => void; onAdd: () => void }> = ({ records, onRefresh, onAdd }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PermRow | null>(null);
  const [msgRow, setMsgRow] = useState<PermRow | null>(null);

  const toggleSelect = (id: number) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selected.size === records.length ? setSelected(new Set()) : setSelected(new Set(records.map((r) => r.id)));

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try { await permissionsApi.delete(confirmDelete.id); showSuccess('تم الحذف'); setConfirmDelete(null); onRefresh(); } catch { showError('خطأ'); }
  };

  const handleSend = async (r: PermRow, msg: string) => {
    setSendingId(r.id); setMsgRow(null);
    try {
      const res = await permissionsApi.sendWhatsApp(r.id, { message: msg });
      if (res.data?.data?.success) { showSuccess('تم الإرسال'); onRefresh(); } else showError('فشل الإرسال');
    } catch { showError('خطأ'); } finally { setSendingId(null); }
  };

  const handleBulkSend = async () => {
    if (selected.size === 0) return;
    try {
      const res = await permissionsApi.sendWhatsAppBulk(Array.from(selected));
      if (res.data?.data) { showSuccess(`تم إرسال ${res.data.data.sentCount} من ${res.data.data.total}`); setSelected(new Set()); onRefresh(); }
    } catch { showError('خطأ'); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank'); if (!pw) return;
    const rows = records.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.grade} / ${r.className}</td><td>${r.hijriDate || ''}</td><td>${r.exitTime || '-'}</td><td>${r.reason || '-'}</td><td>${r.receiver || '-'}</td></tr>`
    ).join('');
    pw.document.write(`<html dir="rtl"><head><title>سجل المستأذنين</title><style>body{font-family:Tahoma,Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#ede9fe;color:#7c3aed}h2{text-align:center;color:#7c3aed}@media print{body{padding:10px}}</style></head><body><h2>سجل المستأذنين</h2><p style="text-align:center">العدد: ${records.length}</p><table><thead><tr><th>م</th><th>الطالب</th><th>الصف</th><th>التاريخ</th><th>وقت الخروج</th><th>السبب</th><th>المستلم</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    pw.document.close(); setTimeout(() => pw.print(), 300);
  };

  return (
    <>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#7c3aed', color: '#fff', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>➕ تسجيل استئذان</button>
          <button onClick={onRefresh} style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', borderRadius: '10px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>🔄 تحديث</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={toggleAll} style={{ padding: '8px 14px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '13px' }}>☑️ تحديد الكل</button>
          <button onClick={handleBulkSend} disabled={selected.size === 0} style={{ padding: '8px 14px', background: selected.size > 0 ? '#25d366' : '#d1d5db', color: '#fff', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '13px' }}>📱 إرسال للمحددين</button>
          <button onClick={handlePrint} style={{ padding: '8px 14px', background: '#ede9fe', color: '#6d28d9', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '13px' }}>🖨️ طباعة</button>
        </div>
      </div>

      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '48px', margin: 0 }}>🚪</p>
          <p style={{ fontSize: '18px', color: '#6b7280', fontWeight: 500, margin: '12px 0 4px' }}>لا يوجد مستأذنون اليوم</p>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>اضغط على "تسجيل استئذان" لإضافة طالب مستأذن</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table className="data-table">
            <thead style={{ background: '#f5f3ff' }}>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" checked={selected.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                <th>الطالب</th><th>الصف</th><th>التاريخ</th><th>وقت الخروج</th><th>السبب</th><th>المستلم</th><th>التأكيد</th><th>الإرسال</th><th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ background: selected.has(r.id) ? '#f5f3ff' : undefined }}>
                  <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td><div style={{ fontWeight: 700 }}>{r.studentName}</div><div style={{ fontSize: '12px', color: '#9ca3af' }}>{r.studentNumber}</div></td>
                  <td style={{ fontSize: '13px' }}>{r.grade} / {r.className}</td>
                  <td style={{ fontSize: '12px', color: '#6b7280' }}>{r.hijriDate}</td>
                  <td><span style={{ padding: '4px 8px', background: '#ede9fe', color: '#7c3aed', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>{r.exitTime || '-'}</span></td>
                  <td style={{ fontSize: '13px', color: '#4b5563', maxWidth: '150px' }}>{r.reason || '-'}</td>
                  <td style={{ fontSize: '13px', color: '#4b5563' }}>{r.receiver || '-'}</td>
                  <td>{r.confirmationTime ? <Badge label={`خرج ${r.confirmationTime}`} bg="#dcfce7" color="#15803d" /> : <Badge label="معلق" bg="#fef3c7" color="#92400e" />}</td>
                  <td>{r.isSent ? <Badge label="تم ✓" bg="#dcfce7" color="#15803d" /> : <Badge label="لم يُرسل" bg="#fef3c7" color="#92400e" />}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <IconBtn icon="📱" title="إرسال" disabled={sendingId === r.id} onClick={() => setMsgRow(r)} />
                      <IconBtn icon="🗑️" title="حذف" onClick={() => setConfirmDelete(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && <ConfirmModal title="حذف السجل" message={`هل تريد حذف سجل الاستئذان للطالب ${confirmDelete.studentName}؟`} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />}
      {msgRow && <SendMsgModal name={msgRow.studentName} mobile={msgRow.mobile} defaultMsg={`السلام عليكم ورحمة الله وبركاته\n\nولي أمر الطالب: ${msgRow.studentName}\n\nنود إبلاغكم باستئذان ابنكم من المدرسة اليوم.\nوقت الخروج: ${msgRow.exitTime || '-'}\nالسبب: ${msgRow.reason || '-'}`} onSend={(msg) => handleSend(msgRow, msg)} onClose={() => setMsgRow(null)} color="#7c3aed" />}
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// Archive Tab — مطابق لـ renderArchiveTab() سطر 438
// ═══════════════════════════════════════════════════════════
const ArchiveTab: React.FC<{ stageId: string | null }> = ({ stageId }) => {
  const [archiveType, setArchiveType] = useState<'late' | 'permission'>('late');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [archiveRecords, setArchiveRecords] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadArchive = async () => {
    if (!dateFrom || !dateTo) { showError('يرجى تحديد تاريخ البداية والنهاية'); return; }
    setArchiveLoading(true); setSearched(true);
    try {
      const filters: any = {};
      if (stageId) filters.stage = stageId;
      // Convert gregorian dates to use API date filtering
      filters.dateFrom = dateFrom;
      filters.dateTo = dateTo;
      const res = archiveType === 'late'
        ? await tardinessApi.getAll(filters)
        : await permissionsApi.getAll(filters);
      setArchiveRecords(res.data?.data || []);
    } catch { showError('خطأ في تحميل الأرشيف'); }
    finally { setArchiveLoading(false); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank'); if (!pw) return;
    const isLate = archiveType === 'late';
    const headers = isLate
      ? '<th>م</th><th>الطالب</th><th>الصف</th><th>التاريخ</th><th>النوع</th><th>الحصة</th><th>المسجل</th>'
      : '<th>م</th><th>الطالب</th><th>الصف</th><th>التاريخ</th><th>وقت الخروج</th><th>السبب</th><th>المستلم</th>';
    const rows = archiveRecords.map((r: any, i: number) => {
      if (isLate) {
        const tt = TARDINESS_TYPES[r.tardinessType] || { label: r.tardinessType || '' };
        return `<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.grade} / ${r.className}</td><td>${r.hijriDate || ''}</td><td>${tt.label}</td><td>${r.period || '-'}</td><td>${r.recordedBy || ''}</td></tr>`;
      }
      return `<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.grade} / ${r.className}</td><td>${r.hijriDate || ''}</td><td>${r.exitTime || '-'}</td><td>${r.reason || '-'}</td><td>${r.receiver || '-'}</td></tr>`;
    }).join('');
    const color = isLate ? '#dc2626' : '#7c3aed';
    const title = isLate ? 'أرشيف التأخر' : 'أرشيف الاستئذان';
    pw.document.write(`<html dir="rtl"><head><title>${title}</title><style>body{font-family:Tahoma,Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f3f4f6}h2{text-align:center;color:${color}}@media print{body{padding:10px}}</style></head><body><h2>${title}</h2><p style="text-align:center">إجمالي السجلات: ${archiveRecords.length}</p><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`);
    pw.document.close(); setTimeout(() => pw.print(), 300);
  };

  return (
    <>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#4b5563', marginBottom: '6px' }}>النوع</label>
            <select value={archiveType} onChange={(e) => setArchiveType(e.target.value as any)} style={{ width: '100%', height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '14px', background: '#fff' }}>
              <option value="late">التأخر</option>
              <option value="permission">الاستئذان</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#4b5563', marginBottom: '6px' }}>من تاريخ (هجري)</label>
            <input type="text" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="مثال: 1447/01/01" style={{ width: '100%', height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#4b5563', marginBottom: '6px' }}>إلى تاريخ (هجري)</label>
            <input type="text" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="مثال: 1447/12/30" style={{ width: '100%', height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <button onClick={loadArchive} style={{ height: '40px', padding: '0 20px', background: '#4f46e5', color: '#fff', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>🔍 بحث</button>
          <button onClick={handlePrint} disabled={archiveRecords.length === 0} style={{ height: '40px', padding: '0 20px', background: archiveRecords.length > 0 ? '#ede9fe' : '#f3f4f6', color: archiveRecords.length > 0 ? '#6d28d9' : '#9ca3af', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>🖨️ طباعة</button>
        </div>
      </div>

      {archiveLoading ? (
        <div style={{ textAlign: 'center', padding: '64px' }}><div className="spinner" /><p style={{ color: '#666', marginTop: '16px' }}>جاري تحميل الأرشيف...</p></div>
      ) : !searched ? (
        <div style={{ textAlign: 'center', padding: '64px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '48px', margin: 0 }}>📦</p>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>اختر النوع والتاريخ ثم اضغط بحث</p>
        </div>
      ) : archiveRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '48px', margin: 0 }}>🔍</p>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>لا توجد سجلات في هذه الفترة</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table className="data-table">
            <thead style={{ background: archiveType === 'late' ? '#fef2f2' : '#f5f3ff' }}>
              <tr>
                <th>الطالب</th><th>الصف</th><th>التاريخ</th>
                <th>{archiveType === 'late' ? 'نوع التأخر' : 'وقت الخروج'}</th>
                <th>{archiveType === 'late' ? 'الحصة' : 'السبب'}</th>
                <th>المسجل</th>
              </tr>
            </thead>
            <tbody>
              {archiveRecords.map((r: any, i: number) => (
                <tr key={r.id || i}>
                  <td style={{ fontWeight: 700 }}>{r.studentName}</td>
                  <td style={{ fontSize: '13px' }}>{r.grade} / {r.className}</td>
                  <td style={{ fontSize: '12px', color: '#6b7280' }}>{r.hijriDate}</td>
                  <td>
                    {archiveType === 'late'
                      ? <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: (TARDINESS_TYPES[r.tardinessType] || {}).bg || '#f3f4f6', color: (TARDINESS_TYPES[r.tardinessType] || {}).color || '#374151' }}>{(TARDINESS_TYPES[r.tardinessType] || { label: r.tardinessType }).label}</span>
                      : <span style={{ padding: '4px 8px', background: '#ede9fe', color: '#7c3aed', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>{r.exitTime || '-'}</span>}
                  </td>
                  <td style={{ fontSize: '13px', color: '#4b5563' }}>{archiveType === 'late' ? (r.period || '-') : (r.reason || '-')}</td>
                  <td style={{ fontSize: '12px', color: '#9ca3af' }}>{r.recordedBy || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>إجمالي السجلات: <strong>{archiveRecords.length}</strong></div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// Add Late Modal — مطابق لـ getAttAddLateModalHTML() سطر 578
// ═══════════════════════════════════════════════════════════
const AddLateModal: React.FC<{ students: StudentOption[]; stageId: string | null; onClose: () => void; onSaved: () => void }> = ({ students, stageId, onClose, onSaved }) => {
  const [search, setSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [tardinessType, setTardinessType] = useState('Morning');
  const [period, setPeriod] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    const ids = new Set(selectedStudents.map((s) => s.id));
    let list = students.filter((s) => !ids.has(s.id) && (s.name.toLowerCase().includes(q) || s.studentNumber.includes(q)));
    if (stageId) list = list.filter((s) => s.stage === stageId);
    return list.slice(0, 10);
  }, [students, search, selectedStudents, stageId]);

  const handleSave = async () => {
    if (selectedStudents.length === 0) return showError('اختر طالب واحد على الأقل');
    if (tardinessType === 'Period' && !period) return showError('اختر الحصة');
    setSaving(true);
    try {
      const res = selectedStudents.length === 1
        ? await tardinessApi.add({ studentId: selectedStudents[0].id, tardinessType, period })
        : await tardinessApi.addBatch(selectedStudents.map((s) => s.id), tardinessType, period);
      if (res.data?.success || res.data?.data) { showSuccess(`تم تسجيل ${selectedStudents.length} طالب متأخر`); onSaved(); }
      else showError(res.data?.message || 'فشل');
    } catch { showError('خطأ'); } finally { setSaving(false); }
  };

  return (
    <ModalShell title="تسجيل تأخر" icon="⏰" gradientFrom="#fee2e2" gradientTo="#fef2f2" borderColor="#fecaca" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Type */}
        <div>
          <label style={labelStyle}>نوع التأخر *</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <TypeBtn label="تأخر صباحي" active={tardinessType === 'Morning'} color="#dc2626" bg="#fee2e2" onClick={() => setTardinessType('Morning')} />
            <TypeBtn label="تأخر حصة" active={tardinessType === 'Period'} color="#d97706" bg="#fef3c7" onClick={() => setTardinessType('Period')} />
          </div>
        </div>
        {tardinessType === 'Period' && (
          <div>
            <label style={labelStyle}>الحصة *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {PERIODS.map((p) => <button key={p} onClick={() => setPeriod(p)} style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: period === p ? '#dc2626' : '#f3f4f6', color: period === p ? '#fff' : '#374151', border: 'none' }}>{p}</button>)}
            </div>
          </div>
        )}
        {/* Students */}
        <StudentPicker search={search} setSearch={setSearch} filtered={filtered} selected={selectedStudents} onAdd={(s) => { setSelectedStudents((p) => [...p, s]); setSearch(''); }} onRemove={(id) => setSelectedStudents((p) => p.filter((s) => s.id !== id))} accentColor="#dc2626" accentBg="#fee2e2" />
      </div>
      <ModalFooter saving={saving} onClose={onClose} onSave={handleSave} label={`حفظ (${selectedStudents.length} طالب)`} color="#dc2626" />
    </ModalShell>
  );
};

// ═══════════════════════════════════════════════════════════
// Add Permission Modal — مطابق لـ getAttAddPermissionModalHTML() سطر 650
// ═══════════════════════════════════════════════════════════
const AddPermModal: React.FC<{ students: StudentOption[]; stageId: string | null; onClose: () => void; onSaved: () => void }> = ({ students, stageId, onClose, onSaved }) => {
  const [search, setSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [exitTime, setExitTime] = useState(new Date().toTimeString().slice(0, 5));
  const [reason, setReason] = useState('');
  const [receiver, setReceiver] = useState('');
  const [responsible, setResponsible] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    const ids = new Set(selectedStudents.map((s) => s.id));
    let list = students.filter((s) => !ids.has(s.id) && (s.name.toLowerCase().includes(q) || s.studentNumber.includes(q)));
    if (stageId) list = list.filter((s) => s.stage === stageId);
    return list.slice(0, 10);
  }, [students, search, selectedStudents, stageId]);

  const handleSave = async () => {
    if (selectedStudents.length === 0) return showError('اختر طالب واحد على الأقل');
    if (!reason) return showError('اختر السبب');
    if (!receiver) return showError('اختر المستلم');
    if (!responsible) return showError('اختر المسؤول');
    setSaving(true);
    try {
      const res = selectedStudents.length === 1
        ? await permissionsApi.add({ studentId: selectedStudents[0].id, exitTime, reason, receiver, supervisor: responsible })
        : await permissionsApi.addBatch(selectedStudents.map((s) => s.id), { exitTime, reason, receiver, supervisor: responsible });
      if (res.data?.success || res.data?.data) { showSuccess(`تم تسجيل ${selectedStudents.length} طالب مستأذن`); onSaved(); }
      else showError(res.data?.message || 'فشل');
    } catch { showError('خطأ'); } finally { setSaving(false); }
  };

  return (
    <ModalShell title="تسجيل استئذان" icon="🚪" gradientFrom="#ede9fe" gradientTo="#f5f3ff" borderColor="#ddd6fe" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <StudentPicker search={search} setSearch={setSearch} filtered={filtered} selected={selectedStudents} onAdd={(s) => { setSelectedStudents((p) => [...p, s]); setSearch(''); }} onRemove={(id) => setSelectedStudents((p) => p.filter((s) => s.id !== id))} accentColor="#7c3aed" accentBg="#ede9fe" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>وقت الخروج</label>
            <input type="time" value={exitTime} onChange={(e) => setExitTime(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>السبب *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle}>
              <option value="">اختر السبب</option>
              {PERMISSION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>المستلم *</label>
            <select value={receiver} onChange={(e) => setReceiver(e.target.value)} style={inputStyle}>
              <option value="">اختر المستلم</option>
              {PERMISSION_RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>المسؤول *</label>
            <select value={responsible} onChange={(e) => setResponsible(e.target.value)} style={inputStyle}>
              <option value="">اختر المسؤول</option>
              {PERMISSION_RESPONSIBLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>
      <ModalFooter saving={saving} onClose={onClose} onSave={handleSave} label={`حفظ (${selectedStudents.length} طالب)`} color="#7c3aed" />
    </ModalShell>
  );
};

// ═══════════════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════════════

const Badge: React.FC<{ label: string; bg: string; color: string }> = ({ label, bg, color }) => (
  <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: bg, color }}>{label}</span>
);

const IconBtn: React.FC<{ icon: string; title: string; disabled?: boolean; onClick: () => void }> = ({ icon, title, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} title={title} style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '16px', opacity: disabled ? 0.5 : 1 }}>{icon}</button>
);

const StagePill: React.FC<{ label: string; active: boolean; onClick: () => void; color: string }> = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, background: active ? '#fff' : 'transparent', color: active ? color : '#6b7280', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', border: 'none', cursor: 'pointer' }}>{label}</button>
);

const TypeBtn: React.FC<{ label: string; active: boolean; color: string; bg: string; onClick: () => void }> = ({ label, active, color, bg, onClick }) => (
  <button onClick={onClick} style={{ flex: 1, padding: '12px 8px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '14px', background: active ? bg : '#f9fafb', color: active ? color : '#6b7280', border: active ? `2px solid ${color}` : '1px solid #e5e7eb' }}>{label}</button>
);

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' };
const inputStyle: React.CSSProperties = { width: '100%', height: '42px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '10px', fontSize: '14px', background: '#fff', boxSizing: 'border-box' };

const StudentPicker: React.FC<{
  search: string; setSearch: (v: string) => void;
  filtered: StudentOption[]; selected: StudentOption[];
  onAdd: (s: StudentOption) => void; onRemove: (id: number) => void;
  accentColor: string; accentBg: string;
}> = ({ search, setSearch, filtered, selected, onAdd, onRemove, accentColor, accentBg }) => (
  <div>
    <label style={labelStyle}>الطلاب * <span style={{ fontWeight: 400, color: '#9ca3af' }}>(يمكنك اختيار أكثر من طالب)</span></label>
    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم..." style={{ ...inputStyle, marginBottom: '4px' }} />
    {filtered.length > 0 && (
      <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        {filtered.map((s) => (
          <div key={s.id} onClick={() => onAdd(s)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{s.name}</span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{s.grade} ({s.className})</span>
          </div>
        ))}
      </div>
    )}
    {selected.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
        {selected.map((s) => (
          <span key={s.id} style={{ padding: '4px 10px', background: accentBg, borderRadius: '8px', border: `1px solid ${accentColor}33`, fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {s.name}
            <button onClick={() => onRemove(s.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}>✕</button>
          </span>
        ))}
      </div>
    )}
  </div>
);

const ModalShell: React.FC<{
  title: string; icon: string; gradientFrom: string; gradientTo: string; borderColor: string;
  onClose: () => void; children: React.ReactNode;
}> = ({ title, icon, gradientFrom, gradientTo, borderColor, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', background: `linear-gradient(to left, ${gradientFrom}, ${gradientTo})`, borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>{icon} {title}</h3>
        <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af' }}>✕</button>
      </div>
      <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>{children}</div>
    </div>
  </div>
);

const ModalFooter: React.FC<{ saving: boolean; onClose: () => void; onSave: () => void; label: string; color: string }> = ({ saving, onClose, onSave, label, color }) => (
  <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px', margin: '24px -24px -24px -24px' }}>
    <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>إلغاء</button>
    <button onClick={onSave} disabled={saving} style={{ padding: '10px 24px', background: color, color: '#fff', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'جاري الحفظ...' : label}</button>
  </div>
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

const SendMsgModal: React.FC<{
  name: string; mobile: string; defaultMsg: string;
  onSend: (msg: string) => void; onClose: () => void; color: string;
}> = ({ name, mobile, defaultMsg, onSend, onClose, color }) => {
  const [message, setMessage] = useState(defaultMsg);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '520px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #dcfce7, #f0fdf4)', borderBottom: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#15803d' }}>📱 إرسال رسالة واتساب</h3>
            <span style={{ fontSize: '13px', color: '#4b5563' }}>{name} - {mobile || 'لا يوجد رقم'}</span>
          </div>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <label style={labelStyle}>نص الرسالة</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} style={{ width: '100%', padding: '12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', lineHeight: 1.8, resize: 'vertical', boxSizing: 'border-box', direction: 'rtl' as const }} />
        </div>
        <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
          <button onClick={() => onSend(message)} style={{ padding: '10px 24px', background: '#25d366', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>📱 إرسال</button>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
