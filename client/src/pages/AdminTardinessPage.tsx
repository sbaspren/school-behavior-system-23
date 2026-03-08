import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { staffInputApi, StaffVerifyData, StaffStudent, StudentsMap } from '../api/staffInput';

const AdminTardinessPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [pageData, setPageData] = useState<StaffVerifyData | null>(null);
  const [studentsMap, setStudentsMap] = useState<StudentsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<StaffStudent[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; cls: string } | null>(null);

  const showToast = useCallback((msg: string, cls: string) => {
    setToast({ msg, cls });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Load data
  useEffect(() => {
    if (!token) { setError('لا يوجد رمز دخول'); setLoading(false); return; }
    Promise.all([
      staffInputApi.verify(token),
      staffInputApi.getStudents(token),
    ]).then(([vRes, sRes]) => {
      const d = vRes.data?.data;
      if (!d?.success) { setError('رابط غير صالح أو منتهي'); return; }
      setPageData(d);
      if (sRes.data?.data) setStudentsMap(sRes.data.data);
    }).catch(() => setError('رابط غير صالح أو حدث خطأ'))
      .finally(() => setLoading(false));
  }, [token]);

  // Derived data
  const stages = useMemo(() => Object.keys(studentsMap), [studentsMap]);
  const grades = useMemo(() =>
    selectedStage && studentsMap[selectedStage] ? Object.keys(studentsMap[selectedStage]) : [],
    [studentsMap, selectedStage]
  );
  const classes = useMemo(() =>
    selectedStage && selectedGrade && studentsMap[selectedStage]?.[selectedGrade]
      ? Object.keys(studentsMap[selectedStage][selectedGrade]) : [],
    [studentsMap, selectedStage, selectedGrade]
  );
  const currentStudents = useMemo(() =>
    selectedStage && selectedGrade && selectedClass
      ? studentsMap[selectedStage]?.[selectedGrade]?.[selectedClass] || []
      : [],
    [studentsMap, selectedStage, selectedGrade, selectedClass]
  );

  const filteredStudents = useMemo(() => {
    if (!search) return currentStudents;
    const q = search.toLowerCase();
    return currentStudents.filter(s => s.name.toLowerCase().includes(q));
  }, [currentStudents, search]);

  const isSelected = useCallback((id: number) =>
    selectedStudents.some(s => s.id === id), [selectedStudents]);

  // Auto-select single stage
  useEffect(() => {
    if (stages.length === 1 && !selectedStage) setSelectedStage(stages[0]);
  }, [stages, selectedStage]);

  // Reset on cascade change
  useEffect(() => { setSelectedGrade(''); setSelectedClass(''); setSelectedStudents([]); }, [selectedStage]);
  useEffect(() => { setSelectedClass(''); setSelectedStudents([]); }, [selectedGrade]);
  useEffect(() => { setSelectedStudents([]); }, [selectedClass]);

  const toggleStudent = (s: StaffStudent) => {
    setSelectedStudents(prev =>
      prev.some(x => x.id === s.id) ? prev.filter(x => x.id !== s.id) : [...prev, s]
    );
  };

  const selectAll = () => {
    const toAdd = filteredStudents.filter(s => !isSelected(s.id));
    if (toAdd.length > 0) setSelectedStudents(prev => [...prev, ...toAdd]);
    else setSelectedStudents(prev => prev.filter(s => !filteredStudents.some(f => f.id === s.id)));
  };

  const removeStudent = (id: number) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
  };

  const handleSubmit = async () => {
    if (selectedStudents.length === 0) return;
    setSubmitting(true);
    try {
      await staffInputApi.saveTardiness({
        token, studentIds: selectedStudents.map(s => s.id),
      });
      showToast('\u2705 تم تسجيل التأخر — ' + selectedStudents.length + ' طالب', 'ts');
      setSelectedStudents([]);
    } catch {
      showToast('\u274C حدث خطأ أثناء الحفظ', 'te');
    } finally {
      setSubmitting(false);
    }
  };

  const [refreshSpin, setRefreshSpin] = useState(false);
  const doRefresh = () => {
    setRefreshSpin(true);
    staffInputApi.getStudents(token).then(res => {
      if (res.data?.data) setStudentsMap(res.data.data);
      showToast('\u2705 تم التحديث', 'ts');
    }).catch(() => showToast('\u274C فشل', 'te'))
      .finally(() => setRefreshSpin(false));
  };

  if (loading) return (
    <div style={S.center}>
      <div style={{ fontSize: '18px', color: '#6b7280' }}>جاري التحميل...</div>
    </div>
  );

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
            <h1 style={S.hdrTitle}>{'\u23F0'} تسجيل التأخر الصباحي</h1>
            <div style={S.hdrSub}>{'\uD83D\uDC64'} {pageData.staff.name}{pageData.staff.role ? ' — ' + pageData.staff.role : ''}</div>
          </div>
          <button onClick={doRefresh} style={S.hdrBtn}>
            <span style={refreshSpin ? { display: 'inline-block', animation: 'spin 0.8s linear infinite' } : {}}>
              {'\uD83D\uDD04'}
            </span>
          </button>
        </div>
      </div>

      <div style={S.main}>
        {/* Card: المرحلة والصف */}
        <div style={{ ...S.card, borderColor: 'rgba(234,88,12,.15)' }}>
          <div style={S.cardTitle}>{'\uD83C\uDFEB'} المرحلة والصف</div>
          <div style={S.fr}>
            <div>
              <div style={S.fl}>المرحلة</div>
              <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)} style={S.sel}>
                <option value="">اختر</option>
                {stages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={S.fl}>الصف</div>
              <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} style={S.sel} disabled={!selectedStage}>
                <option value="">اختر</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Card: المتأخرين */}
        <div style={{ ...S.card, borderColor: 'rgba(234,88,12,.15)' }}>
          <div style={S.cardTitle}>
            {'\uD83D\uDC65'} المتأخرين
            {selectedStudents.length > 0 && (
              <span style={S.badge}>{selectedStudents.length}</span>
            )}
          </div>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={'\uD83D\uDD0D ابحث عن طالب...'}
            style={S.sb}
          />
          <div style={S.sl}>
            {!selectedClass ? (
              <div style={S.emptyList}>اختر المرحلة والصف أولاً</div>
            ) : filteredStudents.length === 0 ? (
              <div style={S.emptyList}>لا يوجد طلاب</div>
            ) : (
              <>
                {/* Select all row */}
                <div onClick={selectAll} style={S.sa}>
                  <span style={S.sat}>تحديد الكل ({filteredStudents.length})</span>
                </div>
                {filteredStudents.map(s => (
                  <div key={s.id} onClick={() => toggleStudent(s)}
                    style={{
                      ...S.si,
                      background: isSelected(s.id) ? '#fff7ed' : undefined,
                    }}>
                    <div style={{
                      ...S.ck,
                      ...(isSelected(s.id) ? { background: '#ea580c', borderColor: '#ea580c' } : {}),
                    }}>
                      {isSelected(s.id) && '\u2713'}
                    </div>
                    <span style={S.sn}>{s.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Chips */}
          {selectedStudents.length > 0 && (
            <div style={S.chips}>
              {selectedStudents.map(s => (
                <span key={s.id} style={S.chip}>
                  {shortenName(s.name)}
                  <span onClick={(e) => { e.stopPropagation(); removeStudent(s.id); }} style={S.chipX}>{'\u2715'}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Class selector (shown between stage/grade and list) */}
        {selectedGrade && (
          <div style={{ ...S.card, borderColor: 'rgba(234,88,12,.15)', padding: '12px 18px' }}>
            <div style={S.fl}>الفصل</div>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={S.sel} disabled={!selectedGrade}>
              <option value="">اختر الفصل</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={S.bbar}>
        <div style={S.bbarIn}>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedStudents.length === 0}
            style={{
              ...S.btnS,
              opacity: (submitting || selectedStudents.length === 0) ? 0.4 : 1,
              cursor: (submitting || selectedStudents.length === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? '\u23F3 جاري...' : '\u2705 تسجيل التأخر'}
            {!submitting && selectedStudents.length > 0 && ` (${selectedStudents.length})`}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

function shortenName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

// ── Styles matching AdminTardinessForm.html exactly ──
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
    background: 'linear-gradient(135deg, #c2410c, #ea580c)',
    padding: '16px 20px',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    boxShadow: '0 2px 12px rgba(194,65,12,.3)',
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
  hdrBtn: {
    width: '42px', height: '42px', borderRadius: '12px', border: 'none',
    background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: '20px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  main: {
    maxWidth: '600px', margin: '0 auto',
    padding: '16px 16px 120px',
  },
  card: {
    background: '#fff', borderRadius: '16px', padding: '18px',
    marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    border: '2px solid transparent',
  },
  cardTitle: {
    fontSize: '14px', fontWeight: 700, color: '#374151',
    marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
  },
  fr: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px',
  },
  fl: {
    fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '4px',
  },
  sel: {
    width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb',
    borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit',
    background: '#fff', color: '#1f2937',
  },
  sb: {
    width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb',
    borderRadius: '12px', fontSize: '14px', fontFamily: 'inherit',
    marginBottom: '10px',
  },
  sl: {
    maxHeight: '350px', overflowY: 'auto',
    border: '2px solid #e5e7eb', borderRadius: '12px',
  },
  si: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px 14px', borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer', userSelect: 'none',
  },
  ck: {
    width: '22px', height: '22px', borderRadius: '6px',
    border: '2px solid #d1d5db', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', color: '#fff', transition: 'all .15s',
  },
  sn: {
    fontSize: '15px', fontWeight: 600, color: '#1f2937', flex: 1,
  },
  sa: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', background: '#f9fafb',
    borderBottom: '2px solid #e5e7eb', cursor: 'pointer', userSelect: 'none',
  },
  sat: {
    fontSize: '13px', fontWeight: 700, color: '#6b7280',
  },
  badge: {
    fontSize: '12px', fontWeight: 800, padding: '2px 10px',
    borderRadius: '100px', color: '#fff', background: '#ea580c',
  },
  chips: {
    display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '6px 10px', borderRadius: '100px',
    fontSize: '12px', fontWeight: 700, color: '#fff', background: '#ea580c',
  },
  chipX: {
    cursor: 'pointer', fontSize: '14px', opacity: 0.8,
  },
  bbar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    padding: '14px 16px', background: '#fff',
    borderTop: '1px solid #e5e7eb', zIndex: 30,
    boxShadow: '0 -4px 12px rgba(0,0,0,.06)',
  },
  bbarIn: {
    maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px',
  },
  btnS: {
    flex: 1, padding: '16px', border: 'none', borderRadius: '14px',
    color: '#fff', fontSize: '17px', fontWeight: 800, fontFamily: 'inherit',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '8px',
    boxShadow: '0 4px 14px rgba(0,0,0,.15)',
    background: 'linear-gradient(135deg, #c2410c, #ea580c)',
  },
  emptyList: {
    textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '15px',
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

export default AdminTardinessPage;
