import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  staffInputApi, StaffVerifyData, GuardPermissionRecord,
} from '../api/staffInput';

const STAGE_ICONS: Record<string, string> = {
  'طفولة مبكرة': '\u{1F7E3}',
  'ابتدائي': '\u{1F7E2}',
  'متوسط': '\u{1F537}',
  'ثانوي': '\u{1F536}',
};

const GuardDisplayPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [pageData, setPageData] = useState<StaffVerifyData | null>(null);
  const [stages, setStages] = useState<string[]>([]);
  const [curStage, setCurStage] = useState('');
  const [records, setRecords] = useState<GuardPermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; cls: string } | null>(null);

  const showToast = useCallback((msg: string, cls: string) => {
    setToast({ msg, cls });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Load initial data
  useEffect(() => {
    if (!token) { setError('لا يوجد رمز دخول'); setLoading(false); return; }
    staffInputApi.verify(token)
      .then(res => {
        const d = res.data?.data;
        if (!d?.success) { setError(d?.sn || 'رابط غير صالح أو منتهي'); return; }
        setPageData(d);
        // stages from enabled stages or fallback
        const s = ['متوسط', 'ثانوي']; // default
        setStages(s);
        if (s.length > 0) setCurStage(s[0]);
      })
      .catch(() => setError('رابط غير صالح أو حدث خطأ في الاتصال'))
      .finally(() => setLoading(false));
  }, [token]);

  // Load guard permissions
  const loadRecords = useCallback(async (stage?: string) => {
    if (!token) return;
    setRecordsLoading(true);
    try {
      const res = await staffInputApi.getGuardPermissions(token, stage);
      setRecords(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      showToast('\u274C \u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0627\u0644\u0633\u062C\u0644\u0627\u062A', 'te');
    } finally {
      setRecordsLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    if (curStage && pageData) loadRecords(curStage);
  }, [curStage, pageData, loadRecords]);

  const waitingCount = useMemo(() => records.filter(r => !r.confirmed).length, [records]);
  const doneCount = useMemo(() => records.filter(r => r.confirmed).length, [records]);

  const handleConfirmExit = useCallback(async (id: number) => {
    try {
      const res = await staffInputApi.confirmExit(id, token);
      const d = res.data?.data;
      if (d?.success) {
        setRecords(prev => prev.map(r =>
          r.id === id ? { ...r, confirmed: true, confirmationTime: d.confirmationTime || '' } : r
        ));
        showToast('\u2705 \u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062E\u0631\u0648\u062C', 'ts');
      } else {
        showToast('\u274C \u0641\u0634\u0644 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062E\u0631\u0648\u062C', 'te');
      }
    } catch {
      showToast('\u274C \u062D\u062F\u062B \u062E\u0637\u0623', 'te');
    }
  }, [token, showToast]);

  const [refreshSpin, setRefreshSpin] = useState(false);
  const doRefresh = () => {
    setRefreshSpin(true);
    loadRecords(curStage);
    setTimeout(() => setRefreshSpin(false), 1500);
  };

  // ── Render: Loading ──
  if (loading) return (
    <div style={S.center}>
      <div style={{ fontSize: '18px', color: '#6b7280' }}>جاري التحميل...</div>
    </div>
  );

  // ── Render: Error ──
  if (error || !pageData) return (
    <div style={S.center}>
      <div style={S.errScreen}>
        <div style={S.errIcon}>{'\uD83D\uDD12'}</div>
        <div style={S.errTitle}>رابط غير صالح</div>
        <div style={S.errMsg}>{error || 'تأكد من صحة الرابط'}</div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {/* Toast */}
      {toast && (
        <div style={{
          ...S.toast,
          background: toast.cls === 'ts' ? '#16a34a' : toast.cls === 'te' ? '#dc2626' : '#3b82f6',
          opacity: 1, transform: 'translateX(-50%) translateY(0)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header — sticky */}
      <div style={S.header}>
        <div style={S.hdrRow}>
          <div>
            <h1 style={S.hdrTitle}>{'\uD83D\uDEE1\uFE0F'} سجل المستأذنين</h1>
            <div style={S.hdrSub}>{'\uD83D\uDC64'} {pageData.staff.name}</div>
          </div>
        </div>
      </div>

      {/* Stage Tabs */}
      {stages.length > 0 && (
        <div style={S.tabs}>
          {stages.map(stage => (
            <button
              key={stage}
              onClick={() => setCurStage(stage)}
              style={{
                ...S.tab,
                ...(curStage === stage ? S.tabActive : {}),
              }}
            >
              {STAGE_ICONS[stage] || '\uD83D\uDD39'} {stage}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div style={S.main}>
        {/* Summary */}
        <div style={S.summary}>
          <div style={S.sumCard}>
            <div style={{ ...S.sumNum, color: '#f59e0b' }}>{waitingCount}</div>
            <div style={S.sumLabel}>{'\u23F3'} بانتظار الخروج</div>
          </div>
          <div style={S.sumCard}>
            <div style={{ ...S.sumNum, color: '#16a34a' }}>{doneCount}</div>
            <div style={S.sumLabel}>{'\u2705'} تم تأكيد خروجهم</div>
          </div>
        </div>

        {/* Records */}
        {recordsLoading ? (
          <div style={S.empty}>{'\u23F3'} جاري التحميل...</div>
        ) : records.length === 0 ? (
          <div style={S.empty}>
            <div style={S.emptyIcon}>{'\uD83D\uDCED'}</div>
            لا يوجد مستأذنين اليوم
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {records.map(r => (
              <div key={r.id} style={{
                ...S.sCard,
                ...(r.confirmed ? S.sCardConfirmed : {}),
              }}>
                <div style={S.sInfo}>
                  <div style={S.sName}>{r.studentName}</div>
                  <div style={S.sDetail}>
                    <span>{'\uD83C\uDFEB'} {r.className}</span>
                    {r.reason && <span>{'\uD83D\uDCDD'} {r.reason}</span>}
                    {r.exitTime && <span>{'\uD83D\uDD50'} {r.exitTime}</span>}
                    {r.confirmed && <span>{'\u2705'} خرج: {r.confirmationTime}</span>}
                  </div>
                </div>
                {r.confirmed ? (
                  <div style={S.sBtnDone}>{'\u2705'}</div>
                ) : (
                  <button
                    onClick={() => handleConfirmExit(r.id)}
                    style={S.sBtnWaiting}
                  >
                    {'\uD83D\uDEAA'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB Refresh */}
      <button onClick={doRefresh} style={S.fab}>
        <span style={refreshSpin ? { display: 'inline-block', animation: 'spin 0.8s linear infinite' } : {}}>
          {'\uD83D\uDD04'}
        </span>
        {' '}تحديث
      </button>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

// ── Styles matching GuardDisplay.html exactly ──
const S: Record<string, React.CSSProperties> = {
  page: {
    direction: 'rtl',
    fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif",
    background: '#f0f2f5',
    minHeight: '100vh',
    color: '#1f2937',
  },
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', direction: 'rtl',
    fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif",
  },
  header: {
    background: 'linear-gradient(135deg, #1e3a5f, #2c5282)',
    padding: '16px 20px',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    boxShadow: '0 2px 12px rgba(30,58,95,.3)',
  },
  hdrRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    maxWidth: '600px', margin: '0 auto',
  },
  hdrTitle: {
    fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0,
  },
  hdrSub: {
    fontSize: '12px', color: 'rgba(255,255,255,.8)', marginTop: '2px',
  },
  tabs: {
    display: 'flex', background: '#fff', margin: '16px 16px 0',
    borderRadius: '14px', overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto',
  },
  tab: {
    flex: 1, padding: '14px', textAlign: 'center',
    fontSize: '15px', fontWeight: 700, border: 'none',
    background: '#fff', color: '#6b7280', cursor: 'pointer',
    transition: 'all .25s',
    fontFamily: 'inherit',
  },
  tabActive: {
    color: '#fff',
    background: 'linear-gradient(135deg, #1e3a5f, #2c5282)',
  },
  main: {
    maxWidth: '600px', margin: '0 auto',
    padding: '16px 16px 100px',
  },
  summary: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '10px', marginBottom: '16px',
  },
  sumCard: {
    background: '#fff', borderRadius: '14px', padding: '14px',
    textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.05)',
  },
  sumNum: {
    fontSize: '28px', fontWeight: 800, lineHeight: 1,
  },
  sumLabel: {
    fontSize: '12px', fontWeight: 700, color: '#6b7280', marginTop: '4px',
  },
  sCard: {
    background: '#fff', borderRadius: '16px', padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    display: 'flex', alignItems: 'center', gap: '14px',
    borderRight: '5px solid #f59e0b',
    transition: 'all .3s',
  },
  sCardConfirmed: {
    borderRightColor: '#16a34a',
    background: '#f0fdf4',
  },
  sInfo: { flex: 1 },
  sName: {
    fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px',
  },
  sDetail: {
    fontSize: '12px', color: '#6b7280',
    display: 'flex', flexWrap: 'wrap', gap: '8px',
  },
  sBtnWaiting: {
    width: '56px', height: '56px', borderRadius: '50%',
    border: 'none', color: '#fff', fontSize: '24px',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
    boxShadow: '0 4px 12px rgba(245,158,11,.3)',
    fontFamily: 'inherit',
  },
  sBtnDone: {
    width: '56px', height: '56px', borderRadius: '50%',
    background: '#16a34a', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '24px', flexShrink: 0,
    color: '#fff',
  },
  empty: {
    textAlign: 'center', padding: '60px 20px', color: '#9ca3af', fontSize: '15px',
  },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  fab: {
    position: 'fixed', bottom: '20px', left: '50%',
    transform: 'translateX(-50%)',
    padding: '16px 40px', border: 'none', borderRadius: '100px',
    background: 'linear-gradient(135deg, #1e3a5f, #2c5282)',
    color: '#fff', fontSize: '16px', fontWeight: 800,
    fontFamily: 'inherit', cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(30,58,95,.3)', zIndex: 30,
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  toast: {
    position: 'fixed', top: '80px', left: '50%',
    transform: 'translateX(-50%) translateY(-20px)',
    padding: '14px 24px', borderRadius: '14px', color: '#fff',
    fontSize: '15px', fontWeight: 700, zIndex: 60,
    opacity: 0, transition: 'all .3s', pointerEvents: 'none',
    textAlign: 'center', minWidth: '200px',
    boxShadow: '0 8px 24px rgba(0,0,0,.2)',
  },
  errScreen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '60vh',
    textAlign: 'center', padding: '32px',
  },
  errIcon: { fontSize: '64px', marginBottom: '16px' },
  errTitle: { fontSize: '20px', fontWeight: 800, marginBottom: '8px' },
  errMsg: { color: '#6b7280', fontSize: '14px' },
};

export default GuardDisplayPage;
