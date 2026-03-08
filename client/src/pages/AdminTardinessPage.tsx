import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  staffInputApi, StaffVerifyData, StudentsMap,
  FlatStudent, flattenGradeStudents
} from '../api/staffInput';

// ★ مطابق للأصلي AdminTardinessForm.html — تأخر صباحي فقط، بدون تبويبات
const AdminTardinessPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [pageData, setPageData] = useState<StaffVerifyData | null>(null);
  const [studentsMap, setStudentsMap] = useState<StudentsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [selected, setSelected] = useState<FlatStudent[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; cls: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const showToast = useCallback((msg: string, cls: string) => {
    setToast({ msg, cls });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadData = useCallback(async () => {
    if (!token) { setError('لا يوجد رمز'); setLoading(false); return; }
    try {
      const [vRes, sRes] = await Promise.all([
        staffInputApi.verify(token),
        staffInputApi.getStudents(token),
      ]);
      if (vRes.data?.data) setPageData(vRes.data.data);
      if (sRes.data?.data) setStudentsMap(sRes.data.data);
    } catch {
      setError('رابط غير صالح أو منتهي الصلاحية');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const stages = useMemo(() => pageData?.gradeMap ? Object.keys(pageData.gradeMap) : [], [pageData]);
  const grades = useMemo(() => stage && pageData?.gradeMap?.[stage] ? pageData.gradeMap[stage] : [], [pageData, stage]);

  // ★ 2-level: flatten
  const allStudents = useMemo(() =>
    stage && grade ? flattenGradeStudents(studentsMap, stage, grade) : [],
    [studentsMap, stage, grade]
  );
  const filtered = useMemo(() => {
    if (!search) return allStudents;
    return allStudents.filter(s => s.name.includes(search));
  }, [allStudents, search]);

  const isSelected = useCallback((id: number) => selected.some(s => s.id === id), [selected]);

  useEffect(() => { if (stages.length === 1 && !stage) setStage(stages[0]); }, [stages, stage]);
  useEffect(() => { setGrade(''); setSelected([]); setSearch(''); }, [stage]);
  useEffect(() => { setSelected([]); setSearch(''); }, [grade]);

  const toggleStudent = (s: FlatStudent) => {
    setSelected(prev => prev.some(x => x.id === s.id) ? prev.filter(x => x.id !== s.id) : [...prev, s]);
  };

  const selectAll = () => {
    const allOn = filtered.every(s => isSelected(s.id));
    if (allOn) {
      const ids = new Set(filtered.map(s => s.id));
      setSelected(prev => prev.filter(s => !ids.has(s.id)));
    } else {
      setSelected(prev => [...prev, ...filtered.filter(s => !isSelected(s.id))]);
    }
  };

  const removeStudent = (id: number) => setSelected(prev => prev.filter(s => s.id !== id));

  const handleSubmit = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await staffInputApi.saveTardiness({ token, studentIds: selected.map(s => s.id) });
      showToast(`✅ تم تسجيل التأخر — ${res.data?.data?.count || selected.length} طالب`, 'ts');
      setSelected([]);
    } catch { showToast('❌ حدث خطأ', 'te'); }
    finally { setSubmitting(false); }
  };

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await staffInputApi.getStudents(token);
      if (res.data?.data) { setStudentsMap(res.data.data); showToast('✅ تم التحديث', 'ts'); }
    } catch { showToast('❌ فشل', 'te'); }
    finally { setRefreshing(false); }
  };

  if (loading) return <div style={S.center}><div style={S.loadingText}>⏳ جاري التحميل...</div></div>;

  if (error || !pageData) return (
    <div style={S.center}>
      <div style={S.errScr}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
        <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>رابط غير صالح</div>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>{error || 'تأكد من صحة الرابط'}</div>
      </div>
    </div>
  );

  const canSubmit = selected.length > 0 && stage && grade;

  return (
    <div style={S.page}>
      {/* Header — برتقالي */}
      <div style={S.header}>
        <div style={S.hdrRow}>
          <div>
            <h1 style={S.hdrTitle}>⏰ تسجيل التأخر الصباحي</h1>
            <div style={S.hdrSub}>👤 {pageData.staff.name}{pageData.staff.role ? ` — ${pageData.staff.role}` : ''}</div>
          </div>
          <button onClick={doRefresh} style={S.hdrBtn}>
            <span style={refreshing ? { display: 'inline-block', animation: 'spin .8s linear infinite' } : {}}>🔄</span>
          </button>
        </div>
      </div>

      <div style={S.main}>
        <div style={S.card}>
          <div style={S.cardTitle}>🏫 المرحلة والصف</div>
          <div style={S.fr}>
            <div>
              <div style={S.fl}>المرحلة</div>
              <select value={stage} onChange={e => setStage(e.target.value)} style={S.sel}>
                <option value="">اختر</option>
                {stages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={S.fl}>الصف</div>
              <select value={grade} onChange={e => setGrade(e.target.value)} style={S.sel} disabled={!stage}>
                <option value="">اختر</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>
            👥 المتأخرين
            {selected.length > 0 && <span style={S.badge}>{selected.length}</span>}
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ابحث عن طالب..." style={S.sb} />
          <div style={S.sl}>
            {!grade ? (
              <div style={S.empty}>اختر المرحلة والصف أولاً</div>
            ) : filtered.length === 0 ? (
              <div style={S.empty}>لا يوجد طلاب</div>
            ) : (
              <>
                <div onClick={selectAll} style={S.sa}>
                  <span style={S.sat}>تحديد الكل ({filtered.length})</span>
                </div>
                {filtered.map(s => {
                  const on = isSelected(s.id);
                  return (
                    <div key={s.id} onClick={() => toggleStudent(s)}
                      style={{ ...S.si, background: on ? '#fff7ed' : '#fff' }}>
                      <div style={{ ...S.ck, background: on ? '#ea580c' : '#fff', borderColor: on ? '#ea580c' : '#d1d5db' }}>
                        {on && <span style={{ color: '#fff', fontSize: '13px' }}>✓</span>}
                      </div>
                      <span style={S.sn}>{s.name}</span>
                      <span style={S.ct}>{s.sec}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          {selected.length > 0 && (
            <div style={S.chips}>
              {selected.map(s => (
                <span key={s.id} style={S.chip}>
                  {shortenName(s.name)} <span style={S.chipC}>({s.sec})</span>
                  <span style={S.chipX} onClick={e => { e.stopPropagation(); removeStudent(s.id); }}>✕</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={S.bbar}>
        <div style={S.bbarIn}>
          <button onClick={handleSubmit} disabled={!canSubmit || submitting}
            style={{ ...S.btnS, opacity: canSubmit && !submitting ? 1 : 0.4 }}>
            {submitting ? '⏳ جاري...' : '✅ تسجيل التأخر'}
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ ...S.toast, background: toast.cls === 'ts' ? '#16a34a' : toast.cls === 'te' ? '#dc2626' : '#3b82f6' }}>
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

function shortenName(n: string): string {
  const p = n.trim().split(/\s+/);
  return p.length <= 2 ? n : `${p[0]} ${p[p.length - 1]}`;
}

const S: Record<string, React.CSSProperties> = {
  page: { direction: 'rtl', fontFamily: "'Segoe UI','Tahoma','Arial',sans-serif", background: '#f0f2f5', minHeight: '100vh', color: '#1f2937' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', direction: 'rtl' as const },
  loadingText: { fontSize: '18px', color: '#6b7280' },
  errScr: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const, padding: '32px' },
  header: { background: 'linear-gradient(135deg,#c2410c,#ea580c)', padding: '16px 20px', position: 'sticky' as const, top: 0, zIndex: 40, boxShadow: '0 2px 12px rgba(194,65,12,.3)' },
  hdrRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '600px', margin: '0 auto' },
  hdrTitle: { fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0 },
  hdrSub: { fontSize: '12px', color: 'rgba(255,255,255,.8)', marginTop: '2px' },
  hdrBtn: { width: '42px', height: '42px', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  main: { maxWidth: '600px', margin: '0 auto', padding: '16px 16px 120px' },
  card: { background: '#fff', borderRadius: '16px', padding: '18px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,.05)', border: '2px solid rgba(234,88,12,.15)' },
  cardTitle: { fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' },
  fr: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' },
  fl: { fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '4px' },
  sel: { width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit', background: '#fff', color: '#1f2937', appearance: 'none' as const },
  sb: { width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '14px', fontFamily: 'inherit', marginBottom: '10px', boxSizing: 'border-box' as const },
  sl: { maxHeight: '350px', overflowY: 'auto' as const, border: '2px solid #e5e7eb', borderRadius: '12px' },
  si: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', userSelect: 'none' as const },
  ck: { width: '22px', height: '22px', borderRadius: '6px', border: '2px solid #d1d5db', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', transition: 'all .15s' },
  sn: { fontSize: '15px', fontWeight: 600, color: '#1f2937', flex: 1 },
  ct: { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', background: '#f3f4f6', color: '#6b7280', flexShrink: 0 },
  sa: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', cursor: 'pointer', userSelect: 'none' as const },
  sat: { fontSize: '13px', fontWeight: 700, color: '#6b7280' },
  badge: { fontSize: '12px', fontWeight: 800, padding: '2px 10px', borderRadius: '100px', color: '#fff', background: '#ea580c' },
  chips: { display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginTop: '10px' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, color: '#fff', background: '#ea580c' },
  chipC: { opacity: 0.75, fontSize: '10px' },
  chipX: { cursor: 'pointer', fontSize: '14px', opacity: 0.8 },
  empty: { textAlign: 'center' as const, padding: '40px 20px', color: '#9ca3af', fontSize: '15px' },
  bbar: { position: 'fixed' as const, bottom: 0, left: 0, right: 0, padding: '14px 16px', background: '#fff', borderTop: '1px solid #e5e7eb', zIndex: 30, boxShadow: '0 -4px 12px rgba(0,0,0,.06)' },
  bbarIn: { maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px' },
  btnS: { flex: 1, padding: '16px', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '17px', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: 'linear-gradient(135deg,#c2410c,#ea580c)', boxShadow: '0 4px 14px rgba(0,0,0,.15)' },
  toast: { position: 'fixed' as const, top: '80px', left: '50%', transform: 'translateX(-50%)', padding: '14px 24px', borderRadius: '14px', color: '#fff', fontSize: '15px', fontWeight: 700, zIndex: 60, textAlign: 'center' as const, minWidth: '200px', boxShadow: '0 8px 24px rgba(0,0,0,.2)' },
};

export default AdminTardinessPage;
