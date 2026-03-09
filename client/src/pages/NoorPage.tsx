import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PageHero from '../components/shared/PageHero';
import TabBar from '../components/shared/TabBar';
import EmptyState from '../components/shared/EmptyState';
import ActionIcon from '../components/shared/ActionIcon';
import { noorApi, NoorStatusUpdate } from '../api/noor';
import { showSuccess, showError } from '../components/shared/Toast';

// ════════════════════════════════════════════════════════════
// تعريفات التبويبات الخمسة — مطابق للأصلي NOOR_TABS
// ════════════════════════════════════════════════════════════
interface TabDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  desc: string;
}

const NOOR_TABS: Record<string, TabDef> = {
  violations:   { id: 'violations',   icon: '⚖️', label: 'مخالفات',       color: '#ef4444', desc: 'المخالفات السلوكية المعلقة للتوثيق في نور' },
  tardiness:    { id: 'tardiness',    icon: '⏱️', label: 'تأخر',          color: '#f59e0b', desc: 'سجلات التأخر الصباحي — تُدخل كمخالفة الدرجة الأولى' },
  compensation: { id: 'compensation', icon: '🔄', label: 'تعويضية',       color: '#3b82f6', desc: 'درجات التعويض — فرص تعويض للطلاب المخصوم منهم' },
  excellent:    { id: 'excellent',    icon: '🌟', label: 'سلوك متمايز',   color: '#22c55e', desc: 'السلوك المتمايز للطلاب المتميزين' },
  absence:      { id: 'absence',     icon: '📅', label: 'غياب يومي',     color: '#f97316', desc: 'سجلات الغياب اليومي — يُدخل في نفس اليوم فقط' },
};
const TAB_ORDER = ['violations', 'tardiness', 'compensation', 'excellent', 'absence'];

const DEGREE_COLORS: Record<string, { bg: string; color: string }> = {
  '1': { bg: '#dcfce7', color: '#15803d' },
  '2': { bg: '#fef9c3', color: '#ca8a04' },
  '3': { bg: '#ffedd5', color: '#ea580c' },
  '4': { bg: '#fee2e2', color: '#dc2626' },
  '5': { bg: '#fecaca', color: '#7c2d12' },
};

const DEGREE_NAMES: Record<string, string> = {
  '1': 'الأولى', '2': 'الثانية', '3': 'الثالثة', '4': 'الرابعة', '5': 'الخامسة',
};

// خيارات نوع الغياب — مطابق للأصلي ABSENCE_TYPE_OPTIONS
const ABSENCE_TYPE_OPTIONS = [
  { label: 'غياب بعذر', value: '141,' },
  { label: 'غياب بدون عذر', value: '48,' },
  { label: 'غياب منصة بعذر', value: '800667,' },
  { label: 'غياب منصة بدون عذر', value: '1201153,' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NoorRecord = Record<string, any>;

interface NoorStats {
  violations: number;
  tardiness: number;
  compensation: number;
  excellent: number;
  absence: number;
  total: number;
  documentedToday: number;
}

const NoorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('violations');
  const [filterMode, setFilterMode] = useState<'today' | 'all'>('today');
  const [stats, setStats] = useState<NoorStats | null>(null);
  const [records, setRecords] = useState<NoorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [updating, setUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultDetails, setResultDetails] = useState<{ name: string; grade: string; className: string; type: string; ok: boolean }[] | null>(null);
  const [absenceOverrides, setAbsenceOverrides] = useState<Record<number, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [noorMappings, setNoorMappings] = useState<Record<string, any> | null>(null);

  // ════════════════════════════════════════
  // ★ حالة الاتصال بإضافة نور — مطابق لـ NOOR_STATE في JS_Noor.html
  // ════════════════════════════════════════
  const [extConnected, setExtConnected] = useState(false);
  const [extUserName, setExtUserName] = useState('');
  const [extWorking, setExtWorking] = useState(false);
  const [extProgress, setExtProgress] = useState({ done: 0, total: 0, current: '' });
  const bridgeInboxRef = useRef<HTMLDivElement | null>(null);
  const bridgeOutboxRef = useRef<HTMLDivElement | null>(null);

  // ════════════════════════════════════════
  // ★ جسر إضافة كروم — مطابق لـ _noorFindBridge / _noorSendToExt في JS_Noor.html
  // ════════════════════════════════════════
  const findBridge = useCallback(() => {
    bridgeInboxRef.current = document.getElementById('noor-bridge-inbox') as HTMLDivElement;
    bridgeOutboxRef.current = document.getElementById('noor-bridge-outbox') as HTMLDivElement;
    // محاولة parent (لو في iframe)
    if (!bridgeInboxRef.current) {
      try { bridgeInboxRef.current = window.parent.document.getElementById('noor-bridge-inbox') as HTMLDivElement; } catch { /* */ }
    }
    if (!bridgeOutboxRef.current) {
      try { bridgeOutboxRef.current = window.parent.document.getElementById('noor-bridge-outbox') as HTMLDivElement; } catch { /* */ }
    }
  }, []);

  const sendToExt = useCallback((data: Record<string, unknown>) => {
    findBridge();
    if (!bridgeInboxRef.current) return false;
    bridgeInboxRef.current.textContent = JSON.stringify(data);
    return true;
  }, [findBridge]);

  // ★ معالجة رسائل الإضافة — مطابق لـ _noorHandleExtMessage في JS_Noor.html
  const handleExtMessage = useCallback((data: Record<string, unknown>) => {
    if (!data?.action) return;
    switch (data.action) {
      case 'connected':
        setExtConnected(true);
        setExtUserName(String(data.userName || ''));
        showSuccess('تم الاتصال بنور عبر الإضافة — جاهز للتوثيق');
        break;
      case 'progress':
        setExtProgress({ done: Number(data.done || 0), total: Number(data.total || 0), current: String(data.current || '') });
        break;
      case 'done': {
        setExtWorking(false);
        const results = data.results as { success: number; failed: number; updates: { rowIndex: number; type: string; status: string }[] } | undefined;
        if (results?.updates) {
          // تحديث حالة نور في قاعدة البيانات
          const apiUpdates: NoorStatusUpdate[] = results.updates.map(u => ({
            id: u.rowIndex, type: u.type, status: u.status,
          }));
          noorApi.updateStatus(apiUpdates).catch(() => {});
        }
        const successCount = results?.success || 0;
        const failedCount = results?.failed || 0;
        showSuccess(`تم التوثيق: ${successCount} نجح${failedCount > 0 ? ` | ${failedCount} فشل` : ''}`);
        loadRecords(activeTab);
        loadStats();
        break;
      }
      case 'error':
        setExtWorking(false);
        showError('خطأ: ' + String(data.message || ''));
        break;
      case 'disconnected':
        setExtConnected(false);
        setExtUserName('');
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ★ مراقبة رسائل الإضافة عبر MutationObserver + postMessage
  useEffect(() => {
    findBridge();
    const outbox = bridgeOutboxRef.current;
    let observer: MutationObserver | null = null;
    if (outbox) {
      observer = new MutationObserver(() => {
        if (!outbox.textContent) return;
        try {
          const data = JSON.parse(outbox.textContent);
          outbox.textContent = '';
          handleExtMessage(data);
        } catch { outbox.textContent = ''; }
      });
      observer.observe(outbox, { childList: true, characterData: true, subtree: true });
    }
    // fallback: postMessage
    const msgHandler = (e: MessageEvent) => {
      if (e.data?.source === 'noor-extension') handleExtMessage(e.data);
    };
    window.addEventListener('message', msgHandler);
    // Ping on mount
    sendToExt({ source: 'school-system', action: 'ping' });
    return () => {
      observer?.disconnect();
      window.removeEventListener('message', msgHandler);
    };
  }, [findBridge, handleExtMessage, sendToExt]);

  const noorConnect = () => {
    const sent = sendToExt({ source: 'school-system', action: 'ping' });
    if (!sent) showError('الجسر غير موجود — تأكد أن إضافة نور مفعّلة ونور مفتوح في تبويب آخر');
    else showSuccess('جاري فحص الاتصال...');
  };

  const noorDisconnect = () => {
    setExtConnected(false);
    setExtUserName('');
    showSuccess('تم قطع الاتصال بنور');
  };

  // ════════════════════════════════════════
  // جلب الإحصائيات
  // ════════════════════════════════════════
  const loadStats = useCallback(async () => {
    try {
      const res = await noorApi.getStats(undefined, filterMode);
      if (res.data?.data) setStats(res.data.data);
    } catch { /* empty */ }
  }, [filterMode]);

  // ════════════════════════════════════════
  // جلب السجلات
  // ════════════════════════════════════════
  const loadRecords = useCallback(async (type: string) => {
    setLoading(true);
    setSelected(new Set());
    setAbsenceOverrides({});
    try {
      const res = await noorApi.getPendingRecords(undefined, type, filterMode);
      if (res.data?.data?.records) {
        setRecords(res.data.data.records);
      } else {
        setRecords([]);
      }
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filterMode]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadRecords(activeTab); }, [activeTab, loadRecords]);
  useEffect(() => {
    noorApi.getMappings().then(res => {
      if (res.data?.data) setNoorMappings(res.data.data);
    }).catch(() => {});
  }, []);

  // ════════════════════════════════════════
  // تبديل التبويب
  // ════════════════════════════════════════
  const switchTab = (tab: string) => {
    setActiveTab(tab);
  };

  // ════════════════════════════════════════
  // تبديل الفلتر
  // ════════════════════════════════════════
  const switchFilter = (mode: 'today' | 'all') => {
    setFilterMode(mode);
  };

  // ════════════════════════════════════════
  // تحديد / إلغاء الكل
  // ════════════════════════════════════════
  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(records.map((_, i) => i)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleOne = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ════════════════════════════════════════
  // تجاوز نوع الغياب — مطابق للأصلي noorSetAbsenceOverride_ / noorApplyAbsenceTypeAll_
  // ════════════════════════════════════════
  const setAbsenceOverride = (idx: number, value: string) => {
    setAbsenceOverrides(prev => ({ ...prev, [idx]: value }));
    setSelected(prev => { const next = new Set(prev); next.add(idx); return next; });
  };

  const applyAbsenceTypeAll = (value: string) => {
    if (!value) return;
    const overrides: Record<number, string> = {};
    const newSelected = new Set(selected);
    records.forEach((_, idx) => {
      overrides[idx] = value;
      newSelected.add(idx);
    });
    setAbsenceOverrides(prev => ({ ...prev, ...overrides }));
    setSelected(newSelected);
    showSuccess('تم تطبيق نوع الغياب على جميع السجلات');
  };

  // ════════════════════════════════════════
  // تحديث حالة نور (تم)
  // ════════════════════════════════════════
  const markAsDone = async () => {
    if (selected.size === 0) {
      showError('لم يتم تحديد أي سجل');
      return;
    }
    setConfirmOpen(true);
  };

  const executeMarkAsDone = async () => {
    setConfirmOpen(false);
    const selectedRecs = Array.from(selected).map(idx => records[idx]);

    // ★ إذا الإضافة متصلة: أرسل للتوثيق الفعلي عبر الجسر
    if (extConnected) {
      const recsWithOverrides = selectedRecs.map((rec, i) => {
        const idx = Array.from(selected)[i];
        const override = absenceOverrides[idx];
        return override ? { ...rec, _absenceOverride: override } : rec;
      }).filter(rec => rec._noorValue); // فقط المطابق

      if (recsWithOverrides.length === 0) {
        showError('لم يتم تحديد سجلات مطابقة لنور');
        return;
      }

      setExtWorking(true);
      setExtProgress({ done: 0, total: recsWithOverrides.length, current: '' });

      const stageKey = recsWithOverrides[0]?.stage || '';
      const gradeMap = noorMappings?.grades?.[stageKey] || {};

      const sent = sendToExt({
        source: 'school-system',
        action: 'execute',
        operation: activeTab,
        records: recsWithOverrides,
        stage: stageKey,
        gradeMap,
      });

      if (!sent) {
        setExtWorking(false);
        showError('الجسر غير متصل — تأكد من فتح نور في تبويب آخر مع تفعيل الإضافة');
      }
      return;
    }

    // ★ بدون إضافة: تحديث حالة نور في قاعدة البيانات فقط
    setUpdating(true);
    try {
      const updates: NoorStatusUpdate[] = selectedRecs.map(rec => ({
        id: rec.id,
        type: rec._type,
        status: 'تم',
      }));

      const res = await noorApi.updateStatus(updates);
      if (res.data?.data) {
        const { updated, failed } = res.data.data;
        const details = selectedRecs.map((rec, i) => ({
          name: rec.studentName || '',
          grade: rec.grade || '',
          className: rec.className || rec.class || '',
          type: rec.description || rec.tardinessType || rec.behaviorType || rec.excuseType || '',
          ok: i < updated,
        }));
        setResultDetails(details);
        showSuccess(`تم تحديث ${updated} سجل${failed > 0 ? ` (${failed} فشل)` : ''}`);
        loadRecords(activeTab);
        loadStats();
      }
    } catch {
      showError('خطأ في تحديث الحالة');
    } finally {
      setUpdating(false);
    }
  };

  // ════════════════════════════════════════
  // تجميع السجلات حسب الصف/الفصل
  // ════════════════════════════════════════
  const groupedRecords = useMemo(() => {
    const groups: { key: string; grade: string; className: string; records: { rec: NoorRecord; idx: number }[] }[] = [];
    const map = new Map<string, typeof groups[0]>();

    records.forEach((rec, idx) => {
      const key = `${rec.grade || ''}|${rec.className || rec.class || ''}`;
      let group = map.get(key);
      if (!group) {
        group = { key, grade: rec.grade || '', className: rec.className || rec.class || '', records: [] };
        map.set(key, group);
        groups.push(group);
      }
      group.records.push({ rec, idx });
    });

    return groups;
  }, [records]);

  const currentTabDef = NOOR_TABS[activeTab];

  return (
    <div>
      {/* Hero Banner — مطابق لـ .page-hero: gradient أخضر غامق نور */}
      <PageHero
        title="التوثيق في نور"
        subtitle="إدارة المخالفات والتأخر والسلوك الإيجابي والغياب — ربط مباشر مع نظام نور"
        gradient="linear-gradient(135deg, #00695c, #00897b)"
        stats={[
          { icon: 'gavel', label: 'مخالفات', value: stats?.violations ?? '-', color: '#ef4444' },
          { icon: 'timer_off', label: 'تأخر', value: stats?.tardiness ?? '-', color: '#f59e0b' },
          { icon: 'autorenew', label: 'تعويضية', value: stats?.compensation ?? '-', color: '#60a5fa' },
          { icon: 'stars', label: 'متمايز', value: stats?.excellent ?? '-', color: '#86efac' },
          { icon: 'event_busy', label: 'غياب', value: stats?.absence ?? '-', color: '#f97316' },
          { icon: 'check_circle', label: 'موثق اليوم', value: stats?.documentedToday ?? '-', color: '#10b981' },
        ]}
      />

      {/* ═══ فلتر العرض: اليوم / كل غير الموثق ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
        background: '#fff', borderRadius: '16px', border: '2px solid #e5e7eb', padding: '8px 16px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', marginLeft: '8px' }}>عرض:</span>
        <button
          onClick={() => switchFilter('today')}
          style={{
            padding: '6px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
            background: filterMode === 'today' ? '#4f46e5' : '#f3f4f6',
            color: filterMode === 'today' ? '#fff' : '#6b7280',
            border: 'none', cursor: 'pointer',
          }}
        >
          📆 اليوم
        </button>
        <button
          onClick={() => switchFilter('all')}
          style={{
            padding: '6px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
            background: filterMode === 'all' ? '#4f46e5' : '#f3f4f6',
            color: filterMode === 'all' ? '#fff' : '#6b7280',
            border: 'none', cursor: 'pointer',
          }}
        >
          🕐 كل غير الموثق
        </button>
      </div>

      {/* ═══ شريط الاتصال بإضافة نور ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', borderRadius: '16px', border: '2px solid #e5e7eb',
        padding: '10px 16px', marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: extConnected ? '#22c55e' : '#ef4444',
            display: 'inline-block',
            boxShadow: `0 0 8px ${extConnected ? '#22c55e50' : '#ef444450'}`,
          }} />
          <div>
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#1f2937' }}>
              {extConnected ? 'متصل بنور' : 'غير متصل'}
            </span>
            {extUserName && (
              <span style={{ fontSize: '12px', color: '#9ca3af', marginRight: '8px' }}>({extUserName})</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {extConnected ? (
            <>
              <button onClick={() => sendToExt({ source: 'school-system', action: 'ping' })}
                style={{ padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, background: '#f3f4f6', color: '#374151', border: '2px solid #d1d5db', cursor: 'pointer' }}>
                🔄 تحديث الحالة
              </button>
              <button onClick={noorDisconnect}
                style={{ padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, background: '#f3f4f6', color: '#374151', border: '2px solid #d1d5db', cursor: 'pointer' }}>
                🔗 قطع الاتصال
              </button>
            </>
          ) : (
            <button onClick={noorConnect}
              style={{ padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer' }}>
              🔗 فحص الاتصال
            </button>
          )}
        </div>
      </div>

      {/* ═══ شاشة التقدم (عند التوثيق الفعلي) ═══ */}
      {extWorking && (
        <div style={{
          background: '#fff', borderRadius: '20px', border: '2px solid #e5e7eb',
          padding: '40px', textAlign: 'center', marginBottom: '16px',
        }}>
          <div style={{ width: '120px', height: '120px', margin: '0 auto 20px', position: 'relative' }}>
            <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - (extProgress.total > 0 ? extProgress.done / extProgress.total : 0))}`}
                style={{ transition: 'stroke-dashoffset 0.5s' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 900, color: '#1f2937' }}>
              {extProgress.total > 0 ? Math.round(extProgress.done / extProgress.total * 100) : 0}%
            </div>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>جاري التوثيق في نور...</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>{extProgress.done} من {extProgress.total} سجل</p>
          {extProgress.current && (
            <p style={{ fontSize: '12px', color: '#6b7280', background: '#f8fafc', borderRadius: '12px', padding: '8px 16px', display: 'inline-block' }}>
              {extProgress.current}
            </p>
          )}
          <div style={{ marginTop: '24px' }}>
            <button onClick={() => { setExtWorking(false); sendToExt({ source: 'school-system', action: 'cancel' }); showSuccess('تم إيقاف التوثيق'); }}
              style={{ padding: '8px 24px', borderRadius: '12px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>
              ⏹ إيقاف
            </button>
          </div>
        </div>
      )}

      {/* ═══ التبويبات (5 تبويبات) ═══ */}
      <div style={{
        display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '16px', padding: '4px',
        marginBottom: '16px', overflowX: 'auto',
      }}>
        {TAB_ORDER.map(key => {
          const t = NOOR_TABS[key];
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? t.color : '#6b7280',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: isActive ? `2px solid ${t.color}` : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ شريط إجراءات ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', borderRadius: '16px', border: '2px solid #e5e7eb',
        padding: '12px 16px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => { loadRecords(activeTab); loadStats(); }}
            style={{
              padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
              background: '#f3f4f6', color: '#374151', border: '2px solid #d1d5db', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            🔄 تحديث السجلات
          </button>
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>
            {records.length > 0 ? `${records.length} سجل` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selected.size > 0 && (
            <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: 700 }}>
              {selected.size} محدد
            </span>
          )}
          <button
            onClick={markAsDone}
            disabled={selected.size === 0 || updating}
            style={{
              padding: '8px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
              background: selected.size > 0 ? (extConnected ? '#4f46e5' : '#22c55e') : '#e5e7eb',
              color: selected.size > 0 ? '#fff' : '#9ca3af',
              border: 'none', cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: '6px',
              opacity: updating ? 0.7 : 1,
            }}
          >
            {extConnected ? '▶️' : '✅'} {updating ? 'جاري التحديث...' : (extConnected ? 'بدء التوثيق في نور' : 'تحديث كـ "تم" في نور')}
          </button>
        </div>
      </div>

      {/* ═══ شريط نوع الغياب للجميع (لتبويب الغياب فقط) ═══ */}
      {activeTab === 'absence' && records.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          background: '#fff', borderRadius: '16px', border: '2px solid #e5e7eb',
          padding: '10px 16px', marginBottom: '12px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ☑️ نوع الغياب للجميع:
          </span>
          <select
            onChange={(e) => applyAbsenceTypeAll(e.target.value)}
            defaultValue=""
            style={{
              padding: '6px 12px', border: '2px solid #d1d5db', borderRadius: '12px',
              fontSize: '13px', minWidth: '170px', background: '#fff',
            }}
          >
            <option value="">— الافتراضي حسب البيانات —</option>
            {ABSENCE_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>يُطبّق على جميع الطلاب</span>
        </div>
      )}

      {/* ═══ حاوية الجدول ═══ */}
      <div style={{
        background: '#fff', borderRadius: '16px', border: '2px solid #e5e7eb', overflow: 'hidden',
      }}>
        {/* رأس القسم */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>{currentTabDef.icon}</span>
          <div>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937' }}>{currentTabDef.label}</span>
            <span style={{ fontSize: '12px', color: '#9ca3af', marginRight: '8px' }}>{currentTabDef.desc}</span>
          </div>
        </div>

        {/* الجدول */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <div className="spinner" />
            <p style={{ color: '#9ca3af', marginTop: '12px' }}>جاري التحميل...</p>
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <p style={{ fontSize: '36px', margin: '0 0 8px' }}>✅</p>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>لا توجد سجلات معلقة</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selected.size === records.length && records.length > 0}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th>اسم الطالب</th>
                  <th>الصف</th>
                  <th>الفصل</th>
                  {activeTab === 'violations' && <><th>المخالفة</th><th>الدرجة</th><th>التاريخ</th></>}
                  {activeTab === 'tardiness' && <><th>نوع التأخر</th><th>التاريخ</th></>}
                  {activeTab === 'compensation' && <><th>السلوك التعويضي</th><th>التاريخ</th></>}
                  {activeTab === 'excellent' && <><th>السلوك المتمايز</th><th>المعلم</th><th>التاريخ</th></>}
                  {activeTab === 'absence' && <><th>نوع الغياب</th><th>التاريخ</th></>}
                  <th>نور</th>
                </tr>
              </thead>
              <tbody>
                {groupedRecords.map(group => (
                  <React.Fragment key={group.key}>
                    {/* صف المجموعة */}
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan={getColSpan(activeTab)} style={{
                        padding: '6px 16px', fontSize: '13px', fontWeight: 700, color: '#4b5563',
                      }}>
                        <span style={{ color: currentTabDef.color }}>{group.grade}</span>
                        {group.className && <span style={{ color: '#9ca3af' }}> / {group.className}</span>}
                        <span style={{
                          marginRight: '12px', fontSize: '11px', color: '#9ca3af',
                          background: '#f3f4f6', padding: '2px 8px', borderRadius: '100px',
                        }}>
                          {group.records.length} سجل
                        </span>
                      </td>
                    </tr>
                    {/* صفوف البيانات */}
                    {group.records.map(({ rec, idx }) => (
                      <tr key={`${rec._type}-${rec.id}`} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(idx)}
                            onChange={() => toggleOne(idx)}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: '#1f2937' }}>{rec.studentName}</td>
                        <td style={{ fontSize: '13px', color: '#4b5563' }}>{rec.grade}</td>
                        <td style={{ fontSize: '13px', color: '#4b5563' }}>{rec.className || rec.class}</td>

                        {activeTab === 'violations' && (
                          <>
                            <td style={{ fontSize: '13px', color: '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rec.description || rec.violationCode}
                            </td>
                            <td>
                              <DegreeBadge degree={String(rec.degree)} />
                            </td>
                            <td style={{ fontSize: '12px', color: '#6b7280' }}>{rec.date}</td>
                          </>
                        )}

                        {activeTab === 'tardiness' && (
                          <>
                            <td style={{ fontSize: '13px', color: '#374151' }}>{rec.tardinessType || 'تأخر صباحي'}</td>
                            <td style={{ fontSize: '12px', color: '#6b7280' }}>{rec.date}</td>
                          </>
                        )}

                        {activeTab === 'compensation' && (
                          <>
                            <td style={{ fontSize: '13px', color: '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rec.behaviorType || rec.details}
                            </td>
                            <td style={{ fontSize: '12px', color: '#6b7280' }}>{rec.date}</td>
                          </>
                        )}

                        {activeTab === 'excellent' && (
                          <>
                            <td style={{ fontSize: '13px', color: '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rec.behaviorType || rec.details}
                            </td>
                            <td style={{ fontSize: '13px', color: '#6b7280' }}>{rec.recordedBy}</td>
                            <td style={{ fontSize: '12px', color: '#6b7280' }}>{rec.date}</td>
                          </>
                        )}

                        {activeTab === 'absence' && (
                          <>
                            <td>
                              <select
                                value={absenceOverrides[idx] || getDefaultAbsenceValue(rec)}
                                onChange={(e) => setAbsenceOverride(idx, e.target.value)}
                                style={{
                                  fontSize: '12px', padding: '4px 8px', border: '2px solid #ddd',
                                  borderRadius: '12px', minWidth: '130px', background: '#fff',
                                }}
                              >
                                {ABSENCE_TYPE_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ fontSize: '12px', color: '#6b7280' }}>{rec.hijriDate || rec.date}</td>
                          </>
                        )}

                        <td>
                          {(absenceOverrides[idx] || rec._noorValue) ? (
                            <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', background: '#dcfce7', color: '#15803d' }}>✓ مطابق</span>
                          ) : (
                            <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', background: '#fee2e2', color: '#dc2626' }}>✗ غير مطابق</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* فوتر */}
        {records.length > 0 && (
          <div style={{
            padding: '10px 16px', borderTop: '1px solid #f3f4f6',
            display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#6b7280',
          }}>
            <span>الإجمالي: <strong style={{ color: '#1f2937' }}>{records.length}</strong> سجل</span>
            <span style={{ marginRight: 'auto' }}>المحدد: <strong style={{ color: '#4f46e5' }}>{selected.size}</strong></span>
          </div>
        )}
      </div>

      {/* مربع تأكيد التوثيق */}
      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>☁️</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>تأكيد التوثيق في نور</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              سيتم تحديث <strong style={{ color: '#4f46e5' }}>{selected.size}</strong> سجل كـ "تم" في نور
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmOpen(false)}
                style={{ padding: '8px 24px', borderRadius: '12px', border: '2px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>إلغاء</button>
              <button onClick={executeMarkAsDone}
                style={{ padding: '8px 24px', borderRadius: '12px', border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>بدء التوثيق</button>
            </div>
          </div>
        </div>
      )}

      {/* جدول نتائج التوثيق */}
      {resultDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '600px', width: '95%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>نتائج التوثيق</h3>
              <button onClick={() => setResultDetails(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <span style={{ padding: '4px 12px', borderRadius: '100px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '13px' }}>
                نجح: {resultDetails.filter(r => r.ok).length}
              </span>
              <span style={{ padding: '4px 12px', borderRadius: '100px', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '13px' }}>
                فشل: {resultDetails.filter(r => !r.ok).length}
              </span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '8px', textAlign: 'right' }}>الطالب</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>الصف</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>النوع</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>الحالة</th>
                </tr></thead>
                <tbody>
                  {resultDetails.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: '8px' }}>{r.grade} ({r.className})</td>
                      <td style={{ padding: '8px' }}>{r.type}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {r.ok ? <span style={{ color: '#15803d' }}>✓</span> : <span style={{ color: '#dc2626' }}>✗</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// مكونات مساعدة
// ════════════════════════════════════════════════════════════

const StatBadge: React.FC<{ icon: string; label: string; value: string | number; color: string }> = ({ icon, label, value, color }) => (
  <div style={{
    background: 'rgba(255,255,255,0.08)', borderRadius: '16px', padding: '12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  }}>
    <span style={{ fontSize: '20px' }}>{icon}</span>
    <span style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</span>
    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{label}</span>
  </div>
);

const DegreeBadge: React.FC<{ degree: string }> = ({ degree }) => {
  const info = DEGREE_COLORS[degree] || DEGREE_COLORS['1'];
  const name = DEGREE_NAMES[degree] || degree;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
      background: info.bg, color: info.color,
    }}>
      {name}
    </span>
  );
};

// حساب قيمة الغياب الافتراضية حسب البيانات — مطابق للأصلي noorMapAbsence_
function getDefaultAbsenceValue(rec: NoorRecord): string {
  // ★ أولاً: استخدم _noorValue من السيرفر إذا موجود
  if (rec._noorValue) return rec._noorValue;

  const absType = String(rec.absenceType || '').trim();
  const excType = String(rec.excuseType || '').trim();

  // فحص enum (من ASP.NET)
  if (excType === 'PlatformExcused') return '800667,';
  if (excType === 'PlatformUnexcused') return '1201153,';
  if (excType === 'Excused') return '141,';
  if (excType === 'Unexcused') return '48,';

  // فحص النصوص العربية (fallback — من GAS الأصلي)
  if (excType.includes('منصة') || excType.includes('مدرستي') || absType.includes('منصة')) {
    if (excType.includes('بدون') || absType.includes('بدون')) return '1201153,';
    return '800667,';
  }

  if (excType === 'مقبول' || excType === 'بعذر' || excType === 'معذور' || absType.includes('بعذر')) {
    return '141,';
  }

  return '48,'; // غياب بدون عذر — القيمة الافتراضية
}

function getColSpan(tab: string): number {
  switch (tab) {
    case 'violations': return 8;
    case 'excellent': return 8;
    case 'tardiness': return 7;
    case 'compensation': return 7;
    case 'absence': return 7;
    default: return 8;
  }
}

export default NoorPage;
