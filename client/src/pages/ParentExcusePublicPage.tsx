import React, { useState, useEffect } from 'react';
import { parentExcuseApi } from '../api/parentExcuse';

interface StudentData {
  id: string;
  name: string;
  grade: string;
  section: string;
  stage: string;
}

interface PageData {
  success: boolean;
  error?: string;
  schoolName?: string;
  student?: StudentData;
  absence?: { excused: number; unexcused: number; late: number };
  today?: { date: string; day: string };
}

const ParentExcusePublicPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [error, setError] = useState('');
  const [excuseText, setExcuseText] = useState('');
  const [absenceDate, setAbsenceDate] = useState('');
  const [hasAttachment, setHasAttachment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const token = new URLSearchParams(window.location.search).get('token') || '';

  useEffect(() => {
    if (!token) {
      setError('الرابط غير صالح — لا يوجد رمز');
      setLoading(false);
      return;
    }
    parentExcuseApi.verifyToken(token).then((res) => {
      const d = res.data?.data;
      if (d && d.success !== false) {
        setPageData({ success: true, ...d });
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        setAbsenceDate(`${yyyy}-${mm}-${dd}`);
      } else {
        setError(d?.error || d?.message || 'رابط غير صالح أو منتهي الصلاحية');
      }
    }).catch(() => {
      setError('خطأ في الاتصال بالسيرفر');
    }).finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (excuseText.trim().length < 5) { alert('يرجى كتابة سبب الغياب (5 أحرف على الأقل)'); return; }
    if (excuseText.length > 500) { alert('سبب الغياب يجب ألا يتجاوز 500 حرف'); return; }
    setSubmitting(true);
    try {
      const res = await parentExcuseApi.submitExcuse({ token, reason: excuseText, hasAttachment, absenceDate });
      const d = res.data?.data || res.data;
      if (d?.success !== false) {
        setSuccessMessage(d?.message || 'تم إرسال العذر بنجاح');
        setSubmitted(true);
      } else {
        alert('خطأ: ' + (d?.error || d?.message || 'غير معروف'));
      }
    } catch { alert('خطأ في الإرسال'); }
    finally { setSubmitting(false); }
  };

  const handleExit = () => {
    try { window.close(); } catch { /* noop */ }
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;font-family:inherit;direction:rtl"><div><div style="font-size:64px;margin-bottom:16px"><span className="material-symbols-outlined" style={{fontSize:16,color:'#15803d'}}>check_circle</span></div><h2 style="font-size:20px;font-weight:800;color:#1f2937;margin-bottom:8px">يمكنك إغلاق هذه الصفحة</h2><p style="color:#6b7280;font-size:14px">تم تسجيل العذر بنجاح</p></div></div>';
  };

  // Loading screen
  if (loading) {
    return (
      <div style={styles.loadingOverlay}>
        <div style={styles.spinner} />
        <p style={{ marginTop: 16, color: '#666' }}>جاري التحميل...</p>
      </div>
    );
  }

  // Error screen
  if (error || !pageData?.success) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center', direction: 'rtl', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", background: '#f0fdf4' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}><span className="material-symbols-outlined" style={{fontSize:16,color:'#dc2626'}}>cancel</span></div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>خطأ</h2>
        <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, maxWidth: 320 }}>{error || pageData?.error || 'خطأ غير معروف'}</p>
      </div>
    );
  }

  const student = pageData.student!;
  const absence = pageData.absence || { excused: 0, unexcused: 0, late: 0 };
  const todayISO = new Date().toISOString().split('T')[0];

  // Success screen
  if (submitted) {
    return (
      <div style={{ ...styles.body, background: '#f0fdf4' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16, animation: 'pulse 2s ease infinite' }}><span className="material-symbols-outlined" style={{fontSize:16,color:'#15803d'}}>check_circle</span></div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>تم إرسال العذر بنجاح!</h2>
          <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>{successMessage}</p>
          <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 14, textAlign: 'right', width: '100%', maxWidth: 480, border: '2px solid #bbf7d0' }}>
            <DetailRow label="الطالب" value={student.name} />
            <DetailRow label="الصف" value={`${student.grade} - ${student.section}`} />
            {absenceDate && <DetailRow label="تاريخ الغياب" value={absenceDate} />}
            <DetailRow label="العذر" value={excuseText.substring(0, 80) + (excuseText.length > 80 ? '...' : '')} />
            {hasAttachment && <DetailRow label="المرفقات" value="ستُسلم مع الطالب" valueColor="#16a34a" />}
          </div>
          <div style={{ marginTop: 20, padding: '12px 14px', background: '#fef3c7', border: '2px solid #fde68a', borderRadius: 12, width: '100%', maxWidth: 480 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', lineHeight: 1.6, textAlign: 'right' }}>ℹ️ في حال وجود مرفقات، يرجى تسليمها مع الطالب عند حضوره للمدرسة.</p>
          </div>
          <button onClick={handleExit} style={styles.btnExit}>🚪 إغلاق الصفحة</button>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div style={styles.body}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 30, lineHeight: 1 }}>🏫</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>{pageData.schoolName || 'نموذج عذر الغياب'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>نموذج تقديم عذر غياب</div>
            </div>
          </div>
          <div style={styles.studentCard}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>👤</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: 'white', fontSize: 15 }}>{student.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{student.grade} - {student.section}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={styles.mainContainer}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {/* Date bar */}
          <div style={styles.dateBar}>📅 {pageData.today?.day || ''} - {pageData.today?.date || ''}</div>

          {/* Stats */}
          <div style={styles.statsGrid}>
            <div style={{ ...styles.statCard, background: '#fef2f2', borderColor: '#fecaca' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{absence.unexcused}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginTop: 4 }}>غياب بدون عذر</div>
            </div>
            <div style={{ ...styles.statCard, background: '#eff6ff', borderColor: '#bfdbfe' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{absence.excused}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginTop: 4 }}>غياب بعذر</div>
            </div>
          </div>

          {/* Warning */}
          <div style={styles.warningBox}>
            <span className="material-symbols-outlined" style={{ fontSize: 72, color: '#d1d5db' }}>warning</span>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', lineHeight: 1.6 }}>
              تنبيه: الطالب الذي يتجاوز غيابه <strong>18 يوم دراسي بدون عذر</strong> يُحرم من دخول الاختبارات حسب لائحة الانتظام الدراسي.
            </div>
          </div>

          {/* Absence date */}
          <div style={styles.formSection}>
            <div style={styles.formTitle}>📅 تاريخ الغياب</div>
            <div style={styles.formSubtitle}>حدد يوم أو أيام الغياب</div>
            <input type="date" value={absenceDate} onChange={(e) => setAbsenceDate(e.target.value)} max={todayISO}
              style={{ ...styles.textarea, minHeight: 'auto', padding: '12px 14px', fontSize: 14 }} />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>اختر تاريخ يوم الغياب (أو آخر يوم إذا كان أكثر من يوم)</div>
          </div>

          {/* Excuse text */}
          <div style={styles.formSection}>
            <div style={styles.formTitle}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>edit</span> سبب الغياب</div>
            <div style={styles.formSubtitle}>اكتب سبب غياب ابنك بالتفصيل</div>
            <textarea value={excuseText} onChange={(e) => setExcuseText(e.target.value)} maxLength={500}
              placeholder="مثال: كان يعاني من ارتفاع في درجة الحرارة ولم يتمكن من الحضور..."
              style={{ ...styles.textarea, minHeight: 140 }} />
            <div style={{ textAlign: 'left', fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{excuseText.length} / 500</div>
          </div>

          {/* Attachments */}
          <div style={styles.formSection}>
            <div style={styles.formTitle}>📎 المرفقات</div>
            <div style={styles.attachNote}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
              <p style={{ fontSize: 12, color: '#374151', fontWeight: 600, lineHeight: 1.6 }}>
                المرفقات (تقارير طبية، أعذار رسمية) تُسلّم ورقياً مع الطالب عند حضوره للمدرسة.
              </p>
            </div>
            <div style={styles.attachCheckbox} onClick={() => setHasAttachment(!hasAttachment)}>
              <input type="checkbox" checked={hasAttachment} onChange={() => { /* handled by parent onClick */ }} style={{ width: 20, height: 20, accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0 }} />
              <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>لدي مرفقات سيتم تسليمها مع ابني</label>
            </div>
          </div>
        </div>
      </div>

      {/* Submit area */}
      <div style={styles.submitArea}>
        <button onClick={handleSubmit} disabled={submitting || excuseText.trim().length < 5} style={styles.btnSubmit}>
          {submitting ? '⏳ جاري الإرسال...' : '<span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>upload</span> إرسال العذر'}
        </button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}`}</style>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14, borderBottom: '1px solid #d1fae5' }}>
    <span style={{ color: '#6b7280' }}>{label}:</span>
    <span style={{ fontWeight: 700, color: valueColor || 'inherit', maxWidth: 200, textAlign: 'left', fontSize: value.length > 40 ? 13 : 14 }}>{value}</span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  body: { display: 'flex', flexDirection: 'column', height: '100vh', direction: 'rtl', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", background: '#f0fdf4' },
  loadingOverlay: { position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, flexDirection: 'column' },
  spinner: { width: 48, height: 48, border: '4px solid #d1fae5', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  header: { background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', padding: '14px 16px', flexShrink: 0 },
  studentCard: { marginTop: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.12)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: 10 },
  mainContainer: { flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' as unknown as undefined },
  dateBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'white', borderRadius: 12, marginBottom: 14, border: '2px solid #bbf7d0', fontSize: 13, fontWeight: 600, color: '#374151' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  statCard: { padding: '16px 12px', borderRadius: 14, textAlign: 'center', border: '2px solid' },
  warningBox: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: '#fef3c7', border: '2px solid #fde68a', borderRadius: 12, marginBottom: 16 },
  formSection: { background: 'white', borderRadius: 16, padding: '18px 16px', border: '2px solid #d1fae5', marginBottom: 14 },
  formTitle: { fontSize: 16, fontWeight: 800, color: '#1f2937', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 },
  formSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 14 },
  textarea: { width: '100%', padding: 14, border: '2px solid #d1fae5', borderRadius: 12, fontSize: 15, outline: 'none', resize: 'vertical' as const, lineHeight: 1.7, fontFamily: 'inherit', boxSizing: 'border-box' as const },
  attachNote: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: '#f0fdf4', borderRadius: 10, marginTop: 10 },
  attachCheckbox: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer', marginTop: 10 },
  submitArea: { padding: '14px 16px', flexShrink: 0, background: 'white', borderTop: '1px solid #d1fae5' },
  btnSubmit: { width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', padding: 16, border: 'none', borderRadius: 14, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: 'white', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 14px rgba(22,163,74,0.35)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnExit: { width: '100%', maxWidth: 480, marginTop: 16, display: 'flex', padding: 14, border: '2px solid #e5e7eb', borderRadius: 14, background: 'white', color: '#6b7280', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', gap: 8 },
};

export default ParentExcusePublicPage;
