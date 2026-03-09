import React, { useState, useEffect, useCallback, useRef } from 'react';
import MI from '../components/shared/MI';
import toast from 'react-hot-toast';
import { whatsappApi } from '../api/whatsapp';

// ===== Interfaces =====
interface StatusResult {
  connected: boolean;
  phone: string | null;
  primaryPhone: string | null;
  hasPrimary: boolean;
  needSetup: boolean;
  sessions: any[];
  allSessions: any[];
  stage: string;
  effectiveStage: string;
  whatsappMode: string;
  connectedPhones?: { phoneNumber: string; isConnected: boolean }[];
  error?: string;
}

interface StatsResult {
  connectedPhones: number;
  savedPhones: number;
  totalMessages: number;
}

// ===== Constants =====
const USER_TYPES = ['وكيل', 'مدير', 'موجه'];
const STAGES = [
  { id: 'ابتدائي', label: 'المرحلة الابتدائية', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { id: 'متوسط',   label: 'المرحلة المتوسطة',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'ثانوي',   label: 'المرحلة الثانوية',   color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
];

function getStageInfo(stageId: string, waMode: string) {
  if (waMode === 'Unified') return { label: 'جميع المراحل', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
  return STAGES.find(s => s.id === stageId) || STAGES[1];
}

// ★ MainView types — تدفق الصفحة الرئيسية مطابق لـ JS_WhatsApp.html
type MainView =
  | 'loading' | 'error'
  | 'security-setup'
  | 'connected' | 'disconnected'
  | 'qr-verify' | 'qr-scan' | 'qr-success'
  | 'recovery-choose' | 'recovery-input' | 'recovery-change';

// ===== Main Component =====
const WhatsAppPage: React.FC = () => {
  // المرحلة الحالية — مطابق لـ currentStage في الأصلي
  const [currentStage, setCurrentStage] = useState('متوسط');

  // حالة الصفحة: 'loading' | 'main' | 'settings'
  const [pageView, setPageView] = useState<'loading' | 'main' | 'settings'>('loading');

  // بيانات الحالة — من GET /whatsapp/status
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [mainView, setMainView] = useState<MainView>('loading');

  // Security
  const [setupCode, setSetupCode] = useState('');
  const [setupPhone1, setSetupPhone1] = useState('');
  const [setupPhone2, setSetupPhone2] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [recoveryPhones, setRecoveryPhones] = useState<{ phone1: string | null; phone2: string | null; hasPhone1: boolean; hasPhone2: boolean }>({ phone1: null, phone2: null, hasPhone1: false, hasPhone2: false });
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newSecurityCode, setNewSecurityCode] = useState('');

  // QR
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrConnectedPhone, setQrConnectedPhone] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedPhonesBeforeQR = useRef<string[]>([]);

  // Settings
  const [serverUrl, setServerUrl] = useState('');
  const [serviceStatus, setServiceStatus] = useState('مفعل');
  const [waMode, setWaMode] = useState('PerStage');
  const [smsApiToken, setSmsApiToken] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [inspectResult, setInspectResult] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);

  // General
  const [actionLoading, setActionLoading] = useState(false);

  // =========================================================================
  // Load Status (نقطة الدخول الرئيسية — مطابق loadWhatsAppStatus + handleStatusResponse)
  // =========================================================================
  const loadStatus = useCallback(async () => {
    setPageView('loading');
    try {
      const res = await whatsappApi.getStatus(currentStage);
      const data = res.data?.data as StatusResult;
      if (!data) { setMainView('error'); setPageView('main'); return; }

      setStatus(data);

      // ★ مطابق handleStatusResponse — يقرر أي واجهة يعرض
      if (data.needSetup) {
        setMainView('security-setup');
      } else if (data.connected && data.sessions?.length > 0) {
        setMainView('connected');
        loadStats();
      } else {
        setMainView('disconnected');
      }
      setPageView('main');
    } catch {
      toast.error('فشل تحميل حالة الواتساب');
      setMainView('error');
      setPageView('main');
    }
  }, [currentStage]);

  const loadStats = useCallback(async () => {
    try {
      const res = await whatsappApi.getStats(currentStage);
      const d = res.data?.data;
      if (d?.stats) setStats(d.stats);
    } catch { /* ignore */ }
  }, [currentStage]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await whatsappApi.getSettings();
      const d = res.data?.data;
      if (d) {
        setServerUrl(d.serverUrl || '');
        setServiceStatus(d.serviceStatus || 'مفعل');
        setWaMode(d.whatsAppMode || 'PerStage');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStatus(); loadSettings(); }, [loadStatus, loadSettings]);
  useEffect(() => { return () => { stopQRPolling(); }; }, []);

  const stageInfo = getStageInfo(currentStage, status?.whatsappMode || waMode);

  // =========================================================================
  // Security Setup — مطابق submitSecuritySetup
  // =========================================================================
  const handleSecuritySetup = async () => {
    if (!setupCode || setupCode.length < 6) { toast.error('رمز الأمان يجب أن يكون 6 خانات على الأقل'); return; }
    if (!setupPhone1 || setupPhone1.length < 10) { toast.error('رقم الجوال الأول إجباري'); return; }
    setActionLoading(true);
    try {
      const res = await whatsappApi.setupSecurityCode(setupCode, setupPhone1, setupPhone2 || undefined);
      if (res.data?.success !== false) {
        toast.success('تم إعداد رمز الأمان بنجاح');
        loadStatus();
      } else {
        toast.error(res.data?.message || 'فشل الإعداد');
      }
    } catch { toast.error('فشل إعداد رمز الأمان'); }
    finally { setActionLoading(false); }
  };

  // =========================================================================
  // Verify Security Code → Open QR — مطابق createNewSession
  // =========================================================================
  const handleVerifyAndOpenQR = async () => {
    if (!securityCode) { toast.error('أدخل رمز الأمان'); return; }
    setActionLoading(true);
    try {
      const res = await whatsappApi.verifySecurityCode(securityCode);
      if (res.data?.data?.valid) {
        setSecurityCode('');
        openQRPage();
      } else {
        toast.error('رمز الأمان غير صحيح');
      }
    } catch { toast.error('فشل التحقق'); }
    finally { setActionLoading(false); }
  };

  // =========================================================================
  // QR Pairing — مطابق openQRPage + fetchAndShowQR + startQRPolling
  // =========================================================================
  const openQRPage = async () => {
    stopQRPolling();
    setMainView('qr-scan');
    setQrImage(null);
    setQrConnectedPhone(null);

    // حفظ الأرقام الحالية للمقارنة — مطابق سطر 398-403
    try {
      const saved = await whatsappApi.getSessions(currentStage);
      savedPhonesBeforeQR.current = (saved.data?.data || []).map((s: any) => s.phoneNumber);
    } catch {
      savedPhonesBeforeQR.current = [];
    }

    fetchAndShowQR();
  };

  const fetchAndShowQR = async () => {
    try {
      const res = await whatsappApi.getQR();
      const d = res.data?.data;
      if (d?.hasQR && d.qrData) {
        setQrImage(d.qrData);
        startQRPolling();
      } else {
        // QR fallback — مطابق showQRFallback
        toast.error('لم يتم الحصول على الباركود — تأكد من رابط السيرفر');
        setMainView(status?.connected ? 'connected' : 'disconnected');
      }
    } catch {
      toast.error('فشل الاتصال بالسيرفر');
      setMainView(status?.connected ? 'connected' : 'disconnected');
    }
  };

  // ★ startQRPolling — مطابق: polling كل 5 ثوان + تحديث QR كل 15 ثانية + timeout 3 دقائق
  const startQRPolling = () => {
    stopQRPolling();

    // Polling for new connection every 5s — مطابق سطر 520-545
    pollRef.current = setInterval(async () => {
      try {
        const connRes = await whatsappApi.getConnectedSessions();
        const phones: string[] = (connRes.data?.data?.phones || []).map((p: any) => p.phoneNumber);
        const newPhone = phones.find(p => !savedPhonesBeforeQR.current.includes(p));
        if (newPhone) {
          stopQRPolling();
          // ★ حفظ الرقم الجديد تلقائياً — مطابق saveNewPhoneToSheet
          try {
            await whatsappApi.syncAndSave({ phoneNumber: newPhone, stage: currentStage, userType: 'وكيل' });
          } catch { /* ignore */ }
          setQrConnectedPhone(newPhone);
          setMainView('qr-success');
        }
      } catch { /* ignore */ }
    }, 5000);

    // Refresh QR image every 15s — مطابق سطر 548-558
    qrRefreshRef.current = setInterval(async () => {
      try {
        const qrRes = await whatsappApi.getQR();
        if (qrRes.data?.data?.hasQR && qrRes.data.data.qrData) {
          setQrImage(qrRes.data.data.qrData);
        }
      } catch { /* ignore */ }
    }, 15000);

    // Timeout after 3 minutes — مطابق سطر 561-572
    qrTimeoutRef.current = setTimeout(() => {
      if (pollRef.current) {
        stopQRPolling();
        toast.error('انتهى وقت الانتظار — اضغط لإعادة المحاولة');
        setMainView(status?.connected ? 'connected' : 'disconnected');
      }
    }, 180000);
  };

  const stopQRPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (qrRefreshRef.current) { clearInterval(qrRefreshRef.current); qrRefreshRef.current = null; }
    if (qrTimeoutRef.current) { clearTimeout(qrTimeoutRef.current); qrTimeoutRef.current = null; }
  };

  // =========================================================================
  // Phone Management
  // =========================================================================
  const handleSetPrimary = async (id: number, phone: string) => {
    if (!window.confirm(`تعيين ${phone} كرقم رئيسي؟`)) return;
    try {
      await whatsappApi.setPrimary(id);
      toast.success('تم التعيين');
      loadStatus();
    } catch { toast.error('فشل التعيين'); }
  };

  const handleDeletePhone = async (id: number, phone: string) => {
    if (!window.confirm(`هل تريد حذف الرقم ${phone}؟`)) return;
    try {
      await whatsappApi.deleteSession(id);
      toast.success('تم حذف الرقم');
      loadStatus();
    } catch { toast.error('فشل الحذف'); }
  };

  // =========================================================================
  // Recovery — مطابق showRecoveryOptions + sendRecoveryCode + verifyRecoveryCode
  // =========================================================================
  const handleShowRecovery = async () => {
    try {
      const res = await whatsappApi.getSecurityStatus();
      const d = res.data?.data;
      if (d) {
        setRecoveryPhones({
          phone1: d.recoveryPhone1Masked,
          phone2: d.recoveryPhone2Masked,
          hasPhone1: d.hasRecoveryPhone1,
          hasPhone2: d.hasRecoveryPhone2,
        });
        if (!d.hasRecoveryPhone1 && !d.hasRecoveryPhone2) {
          toast.error('لم يتم تسجيل أرقام استرجاع.');
          return;
        }
        setMainView('recovery-choose');
      }
    } catch { toast.error('فشل جلب بيانات الاسترجاع'); }
  };

  const handleSendRecovery = async (phoneIndex: number) => {
    setActionLoading(true);
    try {
      const res = await whatsappApi.requestRecoveryCode(phoneIndex);
      if (res.data?.data?.sent) {
        toast.success(`تم إرسال رمز الاسترجاع إلى ${res.data.data.phoneMasked}`);
        setMainView('recovery-input');
      } else {
        toast.error(res.data?.message || 'فشل الإرسال');
      }
    } catch { toast.error('فشل إرسال رمز الاسترجاع'); }
    finally { setActionLoading(false); }
  };

  const handleVerifyRecovery = async () => {
    if (!recoveryCode || recoveryCode.length < 4) { toast.error('أدخل رمز الاسترجاع المكون من 4 أرقام'); return; }
    setActionLoading(true);
    try {
      const res = await whatsappApi.verifyRecoveryCode(recoveryCode);
      if (res.data?.data?.valid) {
        toast.success('تم التحقق بنجاح');
        setRecoveryCode('');
        setMainView('recovery-change');
      } else {
        toast.error('رمز الاسترجاع غير صحيح');
      }
    } catch { toast.error('فشل التحقق'); }
    finally { setActionLoading(false); }
  };

  const handleSaveNewCode = async () => {
    if (!newSecurityCode || newSecurityCode.length < 6) { toast.error('رمز الأمان يجب أن يكون 6 خانات على الأقل'); return; }
    setActionLoading(true);
    try {
      const res = await whatsappApi.changeSecurityCode({ newCode: newSecurityCode, bypassOldCode: true });
      if (res.data?.success !== false) {
        toast.success('تم تغيير رمز الأمان بنجاح');
        setNewSecurityCode('');
        loadStatus();
      } else {
        toast.error(res.data?.message || 'فشل التغيير');
      }
    } catch { toast.error('فشل تغيير رمز الأمان'); }
    finally { setActionLoading(false); }
  };

  // =========================================================================
  // Settings
  // =========================================================================
  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await whatsappApi.saveSettings({ serverUrl, serviceStatus, whatsAppMode: waMode, ...(smsApiToken ? { smsApiToken } : {}) });
      toast.success('تم حفظ الإعدادات');
      loadSettings();
    } catch { toast.error('فشل الحفظ'); }
    finally { setSettingsLoading(false); }
  };

  const handleInspectQR = async () => {
    setInspecting(true);
    try {
      const res = await whatsappApi.inspectQR();
      setInspectResult(JSON.stringify(res.data?.data, null, 2));
    } catch { setInspectResult('فشل الفحص'); }
    finally { setInspecting(false); }
  };

  const handlePing = async () => {
    toast('جاري إيقاظ السيرفر...');
    try {
      const res = await whatsappApi.ping();
      if (res.data?.data?.isOnline) toast.success('السيرفر متصل');
      else toast.error('السيرفر غير متصل');
    } catch { toast.error('فشل الاتصال'); }
  };

  // =========================================================================
  // RENDER — Settings Page
  // =========================================================================
  if (pageView === 'settings') {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => { setPageView('main'); loadStatus(); }} style={{ ...btnStyle('#f3f4f6', '#374151'), padding: '8px 16px' }}>→ رجوع</button>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>إعدادات الواتساب و SMS</h2>
        </div>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
            <div>
              <label style={labelStyle}>رابط سيرفر الواتساب</label>
              <input type="text" value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                placeholder="https://your-whatsapp-server.com" dir="ltr" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>حالة الخدمة</label>
              <select value={serviceStatus} onChange={e => setServiceStatus(e.target.value)} style={inputStyle}>
                <option value="مفعل">مفعل</option>
                <option value="معطل">معطل</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>نمط الواتساب</label>
              <select value={waMode} onChange={e => setWaMode(e.target.value)} style={inputStyle}>
                <option value="PerStage">رقم لكل مرحلة</option>
                <option value="Unified">رقم موحد لجميع المراحل</option>
              </select>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                {waMode === 'PerStage' ? 'كل مرحلة تستخدم رقم واتساب خاص بها' : 'جميع المراحل تستخدم رقم واتساب واحد'}
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#374151' }}>إعدادات SMS (Madar)</h3>
              <label style={labelStyle}>رمز API</label>
              <input type="password" value={smsApiToken} placeholder="أدخل رمز Madar API..." dir="ltr" style={inputStyle}
                onChange={e => setSmsApiToken(e.target.value)} />
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>اتركه فارغاً للإبقاء على القيمة الحالية</div>
            </div>
            <button onClick={handleSaveSettings} disabled={settingsLoading} style={{
              ...btnStyle('#25d366', '#fff'), opacity: settingsLoading ? 0.6 : 1, width: 'fit-content',
            }}>{settingsLoading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</button>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: '#374151' }}>تشخيص سيرفر QR</h3>
              <button onClick={handleInspectQR} disabled={inspecting} style={{
                ...btnStyle('#ede9fe', '#5b21b6'), opacity: inspecting ? 0.6 : 1,
              }}>{inspecting ? 'جاري الفحص...' : '🔍 تشخيص صفحة QR'}</button>
              {inspectResult && (
                <pre style={{ marginTop: '12px', background: '#1e1e2e', color: '#cdd6f4', padding: '16px', borderRadius: '8px', fontSize: '11px', overflow: 'auto', maxHeight: '300px', direction: 'ltr' }}>{inspectResult}</pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER — Main Page (مطابق تماماً لتدفق JS_WhatsApp.html)
  // =========================================================================
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* ===== Header — مطابق سطر 48-68 ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '12px', background: '#dcfce7', borderRadius: '16px' }}>
            <span style={{ fontSize: '32px' }}>💬</span>
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111', margin: 0 }}>أدوات واتساب</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>إدارة الرقم الرئيسي للتواصل</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* شارة النمط الموحد */}
          {(status?.whatsappMode === 'Unified' || waMode === 'Unified') && (
            <span style={{ padding: '4px 12px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>رقم موحد</span>
          )}
          {/* شارة المرحلة */}
          <div style={{
            background: stageInfo.bg, color: stageInfo.color, padding: '8px 16px', borderRadius: '12px',
            fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
            border: `1px solid ${stageInfo.border}`,
          }}>
            🏫 {stageInfo.label}
          </div>
          {/* اختيار المرحلة */}
          {status?.whatsappMode !== 'Unified' && waMode !== 'Unified' && (
            <select value={currentStage} onChange={e => setCurrentStage(e.target.value)} style={{
              padding: '8px 12px', border: '2px solid #e5e7eb', borderRadius: '10px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#fff',
            }}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
          )}
          <button onClick={handlePing} style={{ ...btnStyle('#f3f4f6', '#374151'), padding: '8px 12px', fontSize: '12px' }}>إيقاظ</button>
          <button onClick={() => loadStatus()} style={{ ...btnStyle('#f3f4f6', '#374151'), padding: '8px 12px', fontSize: '12px' }}>تحديث</button>
          <button onClick={() => setPageView('settings')} style={{ ...btnStyle('#f3f4f6', '#374151'), padding: '8px 12px', fontSize: '12px' }}>⚙️</button>
        </div>
      </div>

      {/* ===== Main Card — مطابق سطر 70-149 ===== */}
      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Banner */}
        <div style={{ background: 'linear-gradient(to left, #25d366, #128c7e)', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <span style={{ fontSize: '18px' }}>ℹ️</span>
            <span style={{ fontSize: '13px' }}>
              {(status?.whatsappMode === 'Unified' || waMode === 'Unified')
                ? 'رقم واحد رئيسي لجميع المراحل'
                : <>الرقم الرئيسي يُستخدم لجميع مراسلات <strong>{stageInfo.label}</strong></>
              }
            </span>
          </div>
        </div>

        {/* Content — 2 columns: instructions (left) + main (right) */}
        <div style={{ display: 'flex', minHeight: '450px' }}>
          {/* ★ Instructions Column — مطابق سطر 81-108 */}
          <div style={{ width: '50%', padding: '24px', background: '#f9fafb', borderLeft: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '24px', background: '#25d366', borderRadius: '4px', display: 'inline-block' }} />
              تعليمات ربط الواتساب
            </h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                'أدخل رمز الأمان (6 خانات على الأقل)',
                'اضغط "ربط الرقم الرئيسي"',
                'افتح واتساب على الجوال → "الأجهزة المرتبطة"',
                'اضغط "ربط جهاز" وامسح الباركود',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{
                    width: '24px', height: '24px', background: '#25d366', color: '#fff', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: '13px', color: '#374151', lineHeight: '24px' }}>{step}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '24px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px' }}>
              <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>
                ⭐ <strong>مهم:</strong> آخر رقم يُمسح بالباركود يصبح الرقم الرئيسي تلقائياً
              </p>
            </div>
          </div>

          {/* ★ Main Content Column */}
          <div style={{ width: '50%', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

            {/* Loading */}
            {(pageView === 'loading' || mainView === 'loading') && <Spinner text="جاري التحميل..." />}

            {/* ★ Security Setup — مطابق showSecuritySetupForm سطر 170-211 */}
            {mainView === 'security-setup' && (
              <div style={{ width: '100%', maxWidth: '340px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <IconCircle emoji="🔒" bg="#dcfce7" />
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>إعداد رمز الأمان</h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>أول مرة تستخدم أدوات الواتساب</p>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>رمز الأمان (6 خانات على الأقل)</label>
                    <input type="password" value={setupCode} onChange={e => setSetupCode(e.target.value)}
                      placeholder="••••••" maxLength={20} style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>جوال الاسترجاع الأول (إجباري)</label>
                    <input type="tel" value={setupPhone1} onChange={e => setSetupPhone1(e.target.value)}
                      placeholder="05xxxxxxxx" dir="ltr" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>جوال الاسترجاع الثاني (اختياري)</label>
                    <input type="tel" value={setupPhone2} onChange={e => setSetupPhone2(e.target.value)}
                      placeholder="05xxxxxxxx" dir="ltr" style={inputStyle} />
                  </div>
                  <button onClick={handleSecuritySetup} disabled={actionLoading} style={{
                    ...btnStyle('#25d366', '#fff'), width: '100%', opacity: actionLoading ? 0.6 : 1,
                  }}>💾 حفظ رمز الأمان</button>
                </div>
              </div>
            )}

            {/* ★ Connected State — مطابق showConnectedState سطر 247-277 */}
            {mainView === 'connected' && status && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <IconCircle emoji="✅" bg="#dcfce7" size={80} />
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a', marginBottom: '8px' }}>متصل بنجاح!</h3>
                <p style={{ fontSize: '18px', color: '#374151', fontWeight: 600, direction: 'ltr' as const, margin: '0 0 4px' }}>
                  {status.primaryPhone || status.phone}
                </p>
                {status.hasPrimary ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', background: '#fffbeb', color: '#b45309', borderRadius: '100px', fontSize: '12px', fontWeight: 700 }}>
                    ⭐ الرقم الرئيسي
                  </span>
                ) : (
                  <span style={{ padding: '4px 12px', background: '#f3f4f6', color: '#6b7280', borderRadius: '100px', fontSize: '12px', fontWeight: 700 }}>متصل</span>
                )}
                <div style={{ marginTop: '24px', display: 'grid', gap: '12px' }}>
                  <button onClick={() => setMainView('qr-verify')} style={{ ...btnStyle('#25d366', '#fff'), width: '100%' }}>
                    <span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span> تغيير الرقم الرئيسي
                  </button>
                  <button onClick={() => loadStatus()} style={{ ...btnStyle('#f3f4f6', '#374151'), width: '100%' }}>
                    <span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>refresh</span> تحديث الحالة
                  </button>
                </div>
              </div>
            )}

            {/* ★ Disconnected State — مطابق showDisconnectedState سطر 289-327 */}
            {mainView === 'disconnected' && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <IconCircle emoji="🔗" bg="#ffedd5" size={80} />
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>لا يوجد رقم رئيسي</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>لم يتم ربط رقم رئيسي لـ {stageInfo.label}</p>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>
                    ⚠️ لن يعمل أي تواصل (روابط، إشعارات، رسائل) إلا بعد ربط رقم رئيسي
                  </p>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>رمز الأمان</label>
                    <input type="password" value={securityCode} onChange={e => setSecurityCode(e.target.value)}
                      placeholder="••••••" style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
                      onKeyDown={e => { if (e.key === 'Enter') handleVerifyAndOpenQR(); }} />
                  </div>
                  <button onClick={handleVerifyAndOpenQR} disabled={actionLoading} style={{
                    ...btnStyle('#25d366', '#fff'), width: '100%', opacity: actionLoading ? 0.6 : 1,
                  }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span> ربط الرقم الرئيسي</button>
                </div>
                <button onClick={handleShowRecovery} style={{ background: 'none', border: 'none', color: '#25d366', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                  نسيت رمز الأمان؟
                </button>
              </div>
            )}

            {/* ★ QR Verify (change primary) — مطابق showAddNewPhoneForm سطر 673-705 */}
            {mainView === 'qr-verify' && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <IconCircle emoji="<span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>refresh</span>" bg="#fffbeb" />
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>تغيير الرقم الرئيسي</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>الرقم الجديد سيصبح الرقم الرئيسي لـ {stageInfo.label}</p>
                <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>رمز الأمان</label>
                    <input type="password" value={securityCode} onChange={e => setSecurityCode(e.target.value)}
                      placeholder="••••••" style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
                      onKeyDown={e => { if (e.key === 'Enter') handleVerifyAndOpenQR(); }} />
                  </div>
                  <button onClick={handleVerifyAndOpenQR} disabled={actionLoading} style={{
                    ...btnStyle('#25d366', '#fff'), width: '100%', opacity: actionLoading ? 0.6 : 1,
                  }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span> مسح باركود جديد</button>
                </div>
                <button onClick={() => setMainView('connected')} style={{ ...btnStyle('#f3f4f6', '#374151'), width: '100%' }}>إلغاء</button>
              </div>
            )}

            {/* ★ QR Scan — مطابق openQRPage + showQRInline سطر 368-457 */}
            {mainView === 'qr-scan' && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                {qrImage ? (
                  <>
                    <div style={{ background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '16px', padding: '20px', display: 'inline-block', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                        <img src={qrImage} alt="QR Code" style={{ width: '260px', height: '260px', imageRendering: 'pixelated', display: 'block' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px', color: '#15803d' }}>
                        <span style={{ fontSize: '16px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span></span>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>امسح الباركود من واتساب</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#16a34a', margin: '4px 0 0' }}>الإعدادات ← الأجهزة المرتبطة ← ربط جهاز</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '8px', height: '8px', background: '#25d366', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                      <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>جاري انتظار المسح...</p>
                    </div>
                  </>
                ) : (
                  <Spinner text="يتم الآن تكوين الاتصال..." sub="يرجى الانتظار لحظات" />
                )}
                <button onClick={() => { stopQRPolling(); setMainView(status?.connected ? 'connected' : 'disconnected'); }} style={{ ...btnStyle('#f3f4f6', '#374151'), marginTop: '8px' }}>إلغاء</button>
              </div>
            )}

            {/* ★ QR Success — مطابق showQRSuccess سطر 490-513 */}
            {mainView === 'qr-success' && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <IconCircle emoji="<span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>contact_phone</span>" bg="#dcfce7" size={80} border="#86efac" />
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>متصل بنجاح!</h3>
                <div style={{ background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '16px', padding: '20px', display: 'inline-block', marginBottom: '16px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, direction: 'ltr' as const, marginBottom: '4px' }}>{qrConnectedPhone}</div>
                  <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>تم ربط الحساب بنجاح</div>
                </div>
                <p style={{ color: '#16a34a', fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>✅ تم الاتصال بنجاح مع واتساب</p>
                <button onClick={() => loadStatus()} style={{ ...btnStyle('#25d366', '#fff'), padding: '12px 32px' }}>متابعة</button>
              </div>
            )}

            {/* ★ Recovery Choose — مطابق showRecoveryOptions سطر 814-843 */}
            {mainView === 'recovery-choose' && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <IconCircle emoji="💬" bg="#dbeafe" />
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>استرجاع رمز الأمان</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>اختر الرقم لإرسال رمز الاسترجاع:</p>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {recoveryPhones.hasPhone1 && (
                    <button onClick={() => handleSendRecovery(1)} disabled={actionLoading} style={{
                      ...btnStyle('#2563eb', '#fff'), width: '100%', opacity: actionLoading ? 0.6 : 1,
                    }}>إرسال إلى {recoveryPhones.phone1}</button>
                  )}
                  {recoveryPhones.hasPhone2 && (
                    <button onClick={() => handleSendRecovery(2)} disabled={actionLoading} style={{
                      ...btnStyle('#2563eb', '#fff'), width: '100%', opacity: actionLoading ? 0.6 : 1,
                    }}>إرسال إلى {recoveryPhones.phone2}</button>
                  )}
                  <button onClick={() => loadStatus()} style={{ ...btnStyle('#f3f4f6', '#374151'), width: '100%' }}>إلغاء</button>
                </div>
              </div>
            )}

            {/* ★ Recovery Input — مطابق showRecoveryCodeInput سطر 865-891 */}
            {mainView === 'recovery-input' && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <IconCircle emoji="🔢" bg="#dcfce7" />
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>أدخل رمز الاسترجاع</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <input type="text" value={recoveryCode}
                    onChange={e => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="----" maxLength={4} dir="ltr"
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', fontWeight: 800, letterSpacing: '12px' }}
                    onKeyDown={e => { if (e.key === 'Enter') handleVerifyRecovery(); }} />
                  <button onClick={handleVerifyRecovery} disabled={actionLoading} style={{
                    ...btnStyle('#25d366', '#fff'), width: '100%', opacity: actionLoading ? 0.6 : 1,
                  }}>تحقق</button>
                  <button onClick={() => loadStatus()} style={{ ...btnStyle('#f3f4f6', '#374151'), width: '100%' }}>إلغاء</button>
                </div>
              </div>
            )}

            {/* ★ Recovery Change Code — مطابق showNewSecurityCodeForm سطر 917-937 */}
            {mainView === 'recovery-change' && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <IconCircle emoji="🔓" bg="#dcfce7" />
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>تعيين رمز أمان جديد</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <input type="password" value={newSecurityCode} onChange={e => setNewSecurityCode(e.target.value)}
                    placeholder="الرمز الجديد (6 خانات على الأقل)" style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNewCode(); }} />
                  <button onClick={handleSaveNewCode} disabled={actionLoading} style={{
                    ...btnStyle('#25d366', '#fff'), width: '100%', opacity: actionLoading ? 0.6 : 1,
                  }}>حفظ الرمز الجديد</button>
                </div>
              </div>
            )}

            {/* Error */}
            {mainView === 'error' && (
              <div style={{ textAlign: 'center' }}>
                <IconCircle emoji="❌" bg="#fef2f2" />
                <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '12px' }}>فشل تحميل الحالة</p>
                <button onClick={() => loadStatus()} style={btnStyle('#25d366', '#fff')}>إعادة المحاولة</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Phones List — مطابق wa-phones-card سطر 122-128 ===== */}
      {status && (status.allSessions?.length > 0 || status.sessions?.length > 0) &&
       !['qr-scan', 'qr-success', 'security-setup'].includes(mainView) && (
        <div style={{ marginTop: '24px', background: '#fff', borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>smartphone</span> أرقام {stageInfo.label}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {(status.allSessions || status.sessions || []).map((session: any, i: number) => {
              const isConnected = session.status === 'متصل';
              const isPrimary = session.isPrimary;
              return (
                <div key={session.id || i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
                  background: isPrimary ? '#fffbeb' : '#f9fafb', borderRadius: '12px',
                  border: isPrimary ? '1px solid #fde68a' : '1px solid #e5e7eb',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: isConnected ? '#dcfce7' : '#fef2f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                    }}>{isConnected ? '✅' : '❌'}</div>
                    <div>
                      <p style={{ fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span dir="ltr">{session.phone || session.phoneNumber}</span>
                        {isPrimary && (
                          <span style={{ padding: '2px 8px', background: '#fffbeb', color: '#b45309', fontSize: '10px', borderRadius: '100px', fontWeight: 700 }}>
                            ⭐ رئيسي
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>{session.userType || '-'} • {session.messageCount || 0} رسالة</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700,
                      background: isConnected ? '#dcfce7' : '#fef2f2',
                      color: isConnected ? '#16a34a' : '#dc2626',
                    }}>{session.status || session.connectionStatus}</span>
                    {!isPrimary && isConnected && session.id && (
                      <button onClick={() => handleSetPrimary(session.id, session.phone || session.phoneNumber)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' }} title="تعيين كرئيسي">⭐</button>
                    )}
                    {session.id && (
                      <button onClick={() => handleDeletePhone(session.id, session.phone || session.phoneNumber)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', color: '#dc2626' }} title="حذف"><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>delete</span></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Stats — مطابق wa-stats-card سطر 130-149 ===== */}
      {stats && mainView === 'connected' && (
        <div style={{ marginTop: '24px', background: '#fff', borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>bar_chart</span> إحصائيات الإرسال - {stageInfo.label}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <StatCard label="أرقام متصلة" value={stats.connectedPhones} color="#2563eb" bg="#eff6ff" />
            <StatCard label="إجمالي الرسائل" value={stats.totalMessages} color="#16a34a" bg="#f0fdf4" />
            <StatCard label="أرقام مسجلة" value={stats.savedPhones} color="#7c3aed" bg="#f5f3ff" />
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
};

// ===== Sub Components =====
const IconCircle: React.FC<{ emoji: string; bg: string; size?: number; border?: string }> = ({ emoji, bg, size = 64, border }) => (
  <div style={{
    width: `${size}px`, height: `${size}px`, background: bg, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px', fontSize: `${size * 0.44}px`,
    border: border ? `2px solid ${border}` : undefined,
  }}>{emoji}</div>
);

const Spinner: React.FC<{ text: string; sub?: string }> = ({ text, sub }) => (
  <div style={{ textAlign: 'center', padding: '32px 0' }}>
    <div style={{ width: '48px', height: '48px', border: '4px solid #dcfce7', borderTop: '4px solid #25d366', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
    <p style={{ color: '#6b7280', margin: 0 }}>{text}</p>
    {sub && <p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0' }}>{sub}</p>}
  </div>
);

const StatCard: React.FC<{ label: string; value: number; color: string; bg: string }> = ({ label, value, color, bg }) => (
  <div style={{ background: bg, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
    <div style={{ fontSize: '28px', fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: '12px', color: '#6b7280' }}>{label}</div>
  </div>
);

// ===== Styles =====
const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '10px 20px', background: bg, color, border: 'none',
  borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
});
const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px', fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', border: '2px solid #d1d5db', borderRadius: '10px',
  fontSize: '14px', boxSizing: 'border-box' as const,
};

export default WhatsAppPage;
