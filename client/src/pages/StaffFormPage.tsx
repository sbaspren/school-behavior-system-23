import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  staffInputApi, StaffVerifyData, StaffStudent, StudentsMap,
  GuardPermissionRecord, TodayEntries
} from '../api/staffInput';

const REASONS = ['ظرف صحي', 'ظرف أسري', 'موعد حكومي', 'طلب ولي الأمر'];
const GUARDIANS = ['الأب', 'الأخ', 'الأم', 'أخرى'];

type Tab = 'permission' | 'tardiness';

const StaffFormPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  // Page state
  const [pageData, setPageData] = useState<StaffVerifyData | null>(null);
  const [studentsMap, setStudentsMap] = useState<StudentsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [tab, setTab] = useState<Tab>('permission');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<StaffStudent[]>([]);
  const [reason, setReason] = useState(REASONS[0]);
  const [guardian, setGuardian] = useState(GUARDIANS[0]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // Guard state
  const [guardRecords, setGuardRecords] = useState<GuardPermissionRecord[]>([]);
  const [guardLoading, setGuardLoading] = useState(false);

  // Log modal
  const [showLog, setShowLog] = useState(false);
  const [logData, setLogData] = useState<TodayEntries | null>(null);

  // ── Load page data ──
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
      setError('رابط غير صالح أو حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Load guard permissions ──
  const loadGuardRecords = useCallback(async () => {
    if (!pageData?.staff.isGuard) return;
    setGuardLoading(true);
    try {
      const res = await staffInputApi.getGuardPermissions(token);
      if (res.data?.data) setGuardRecords(Array.isArray(res.data.data) ? res.data.data : []);
    } catch { /* empty */ }
    finally { setGuardLoading(false); }
  }, [token, pageData]);

  useEffect(() => { if (pageData?.staff.isGuard) loadGuardRecords(); }, [loadGuardRecords, pageData]);

  // ── Derived data ──
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

  // ── Auto-select first stage ──
  useEffect(() => {
    if (stages.length === 1 && !selectedStage) setSelectedStage(stages[0]);
  }, [stages, selectedStage]);

  // ── Set tab based on permissions ──
  useEffect(() => {
    if (!pageData) return;
    const perms = pageData.staff.permissions;
    if (perms.includes('permission')) setTab('permission');
    else if (perms.includes('tardiness')) setTab('tardiness');
  }, [pageData]);

  // ── Reset selections when stage/grade changes ──
  useEffect(() => { setSelectedGrade(''); setSelectedClass(''); setSelectedStudents([]); }, [selectedStage]);
  useEffect(() => { setSelectedClass(''); setSelectedStudents([]); }, [selectedGrade]);
  useEffect(() => { setSelectedStudents([]); }, [selectedClass]);

  // ── Actions ──
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
    if (selectedStudents.length === 0) { setMsg('اختر طلاباً أولاً'); return; }
    setSubmitting(true);
    setMsg('');
    try {
      if (tab === 'permission') {
        const res = await staffInputApi.savePermission({
          token, studentIds: selectedStudents.map(s => s.id),
          reason, guardian,
        });
        setMsg(res.data?.data?.message || 'تم الحفظ');
      } else {
        const res = await staffInputApi.saveTardiness({
          token, studentIds: selectedStudents.map(s => s.id),
        });
        setMsg(res.data?.data?.message || 'تم الحفظ');
      }
      setSelectedStudents([]);
    } catch {
      setMsg('حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmExit = async (id: number) => {
    try {
      await staffInputApi.confirmExit(id, token);
      loadGuardRecords();
    } catch { /* empty */ }
  };

  const openLog = async () => {
    setShowLog(true);
    try {
      const res = await staffInputApi.getTodayEntries(token);
      if (res.data?.data) setLogData(res.data.data);
    } catch { /* empty */ }
  };

  // ── Render ──

  if (loading) return (
    <div style={styles.center}>
      <div style={{ fontSize: '18px', color: '#6b7280' }}>جاري التحميل...</div>
    </div>
  );

  if (error || !pageData) return (
    <div style={styles.center}>
      <div style={{ fontSize: '18px', color: '#ef4444' }}>{error || 'خطأ غير متوقع'}</div>
    </div>
  );

  const { staff } = pageData;
  const isGuard = staff.isGuard;
  const perms = staff.permissions;
  const canPermission = perms.includes('permission');
  const canTardiness = perms.includes('tardiness');
  const tabColor = tab === 'permission' ? '#3b82f6' : '#f97316';

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ ...styles.header, background: tabColor }}>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>
          {pageData.sn || 'شؤون الطلاب'}
        </div>
        <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
          {staff.name} — {staff.role === 'Guard' ? 'حارس' : staff.role === 'Deputy' ? 'وكيل' : staff.role === 'Counselor' ? 'موجه' : staff.role === 'Admin' ? 'مدير' : 'موظف'}
        </div>
      </div>

      {/* Guard view */}
      {isGuard ? (
        <div style={styles.content}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#374151' }}>
            المستأذنون اليوم
          </h3>
          {guardLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>جاري التحميل...</div>
          ) : guardRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>لا يوجد مستأذنون اليوم</div>
          ) : (
            guardRecords.map(r => (
              <div key={r.id} style={{
                background: '#fff', borderRadius: '16px', padding: '12px',
                marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderRight: `4px solid ${r.confirmed ? '#22c55e' : '#f97316'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{r.studentName}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{r.grade} / {r.className}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      السبب: {r.reason || '-'} | المستلم: {r.receiver || '-'} | الخروج: {r.exitTime || '-'}
                    </div>
                  </div>
                  <div>
                    {r.confirmed ? (
                      <span style={{
                        background: '#dcfce7', color: '#15803d', padding: '4px 12px',
                        borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      }}>
                        خرج {r.confirmationTime}
                      </span>
                    ) : (
                      <button onClick={() => handleConfirmExit(r.id)} style={{
                        background: '#f97316', color: '#fff', border: 'none',
                        borderRadius: '8px', padding: '6px 16px', fontSize: '13px',
                        fontWeight: 700, cursor: 'pointer',
                      }}>
                        تأكيد الخروج
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <button onClick={loadGuardRecords} style={{
            width: '100%', padding: '10px', background: '#6366f1', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', marginTop: '12px',
          }}>
            تحديث
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          {canPermission && canTardiness && (
            <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb' }}>
              <button onClick={() => setTab('permission')} style={{
                flex: 1, padding: '12px', border: 'none', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer',
                background: tab === 'permission' ? '#3b82f6' : '#f3f4f6',
                color: tab === 'permission' ? '#fff' : '#6b7280',
              }}>
                استئذان
              </button>
              <button onClick={() => setTab('tardiness')} style={{
                flex: 1, padding: '12px', border: 'none', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer',
                background: tab === 'tardiness' ? '#f97316' : '#f3f4f6',
                color: tab === 'tardiness' ? '#fff' : '#6b7280',
              }}>
                تأخر
              </button>
            </div>
          )}

          <div style={styles.content}>
            {/* Stage → Grade → Class selectors */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {stages.length > 1 && (
                <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)}
                  style={styles.select}>
                  <option value="">المرحلة</option>
                  {stages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}
                style={styles.select} disabled={!selectedStage}>
                <option value="">الصف</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                style={styles.select} disabled={!selectedGrade}>
                <option value="">الفصل</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Permission-specific fields */}
            {tab === 'permission' && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <select value={reason} onChange={e => setReason(e.target.value)} style={styles.select}>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={guardian} onChange={e => setGuardian(e.target.value)} style={styles.select}>
                  {GUARDIANS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}

            {/* Selected students chips */}
            {selectedStudents.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px',
                padding: '8px', background: '#f0f9ff', borderRadius: '8px',
              }}>
                {selectedStudents.map(s => (
                  <span key={s.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: tabColor, color: '#fff', padding: '4px 10px',
                    borderRadius: '100px', fontSize: '12px', fontWeight: 600,
                  }}>
                    {shortenName(s.name)}
                    <span onClick={() => removeStudent(s.id)} style={{
                      cursor: 'pointer', marginRight: '2px', fontSize: '14px', lineHeight: 1,
                    }}>&times;</span>
                  </span>
                ))}
              </div>
            )}

            {/* Search + Select all */}
            {selectedClass && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="بحث عن طالب..."
                  style={{ flex: 1, padding: '8px 12px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '13px' }} />
                <button onClick={selectAll} style={{
                  padding: '8px 14px', background: '#e5e7eb', border: 'none',
                  borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}>
                  {filteredStudents.every(s => isSelected(s.id)) && filteredStudents.length > 0 ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              </div>
            )}

            {/* Student list */}
            {selectedClass && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '12px' }}>
                {filteredStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>لا يوجد طلاب</div>
                ) : (
                  filteredStudents.map(s => (
                    <div key={s.id} onClick={() => toggleStudent(s)} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                      background: isSelected(s.id) ? (tab === 'permission' ? '#eff6ff' : '#fff7ed') : '#fff',
                    }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '6px',
                        border: `2px solid ${isSelected(s.id) ? tabColor : '#d1d5db'}`,
                        background: isSelected(s.id) ? tabColor : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '12px', flexShrink: 0,
                      }}>
                        {isSelected(s.id) && '\u2713'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{s.name}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Message */}
            {msg && (
              <div style={{
                padding: '10px', borderRadius: '8px', marginBottom: '10px', textAlign: 'center',
                fontSize: '14px', fontWeight: 600,
                background: msg.includes('خطأ') ? '#fee2e2' : '#dcfce7',
                color: msg.includes('خطأ') ? '#dc2626' : '#15803d',
              }}>
                {msg}
              </div>
            )}
          </div>

          {/* Bottom fixed bar */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            display: 'flex', gap: '8px', padding: '10px 16px',
            background: '#fff', borderTop: '1px solid #e5e7eb',
            boxShadow: '0 -4px 12px rgba(0,0,0,.06)',
          }}>
            <button onClick={handleSubmit} disabled={submitting || selectedStudents.length === 0}
              style={{
                flex: 1, padding: '16px', border: 'none', borderRadius: '14px',
                fontSize: '17px', fontWeight: 700, cursor: 'pointer',
                background: selectedStudents.length === 0 ? '#d1d5db' : tabColor,
                color: '#fff', opacity: submitting ? 0.6 : 1,
                boxShadow: '0 4px 14px rgba(0,0,0,.15)',
              }}>
              {submitting ? 'جاري الحفظ...'
                : tab === 'permission'
                  ? `تسجيل استئذان (${selectedStudents.length})`
                  : `تسجيل تأخر (${selectedStudents.length})`
              }
            </button>
            <button onClick={openLog} style={{
              padding: '12px 16px', background: '#f3f4f6', border: 'none',
              borderRadius: '10px', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', color: '#374151',
            }}>
              السجل
            </button>
          </div>

          {/* Log modal */}
          {showLog && (
            <div style={styles.overlay} onClick={() => setShowLog(false)}>
              <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>سجل اليوم</h3>
                  <button onClick={() => setShowLog(false)} style={{
                    background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280',
                  }}>&times;</button>
                </div>
                {!logData ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>جاري التحميل...</div>
                ) : (
                  <>
                    {logData.permissions.length > 0 && (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6', marginBottom: '8px' }}>
                          الاستئذان ({logData.permissions.length})
                        </div>
                        {logData.permissions.map((r, i) => (
                          <div key={i} style={{ fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                            {r.studentName} — {r.grade}/{r.className} — {r.reason} — {r.recordedBy}
                          </div>
                        ))}
                      </>
                    )}
                    {logData.tardiness.length > 0 && (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f97316', marginTop: '12px', marginBottom: '8px' }}>
                          التأخر ({logData.tardiness.length})
                        </div>
                        {logData.tardiness.map((r, i) => (
                          <div key={i} style={{ fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                            {r.studentName} — {r.grade}/{r.className} — {r.recordedBy}
                          </div>
                        ))}
                      </>
                    )}
                    {logData.permissions.length === 0 && logData.tardiness.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>لا توجد سجلات اليوم</div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Helper ──
function shortenName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

// ── Styles ──
const styles: Record<string, React.CSSProperties> = {
  page: {
    direction: 'rtl', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif", maxWidth: '500px',
    margin: '0 auto', minHeight: '100vh', background: '#f0f2f5',
    paddingBottom: '70px',
  },
  header: {
    color: '#fff', padding: '16px 20px', textAlign: 'center',
  },
  content: {
    padding: '16px',
  },
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', direction: 'rtl' as const, fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif",
  },
  select: {
    flex: 1, padding: '8px 12px', border: '2px solid #e5e7eb',
    borderRadius: '12px', fontSize: '13px', minWidth: '90px',
  },
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px',
    width: '100%', maxWidth: '500px', maxHeight: '70vh', overflowY: 'auto' as const,
  },
};

export default StaffFormPage;
