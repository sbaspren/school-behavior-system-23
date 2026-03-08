import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { whatsappApi } from '../api/whatsapp';

interface WhatsAppSession {
  id: number;
  phoneNumber: string;
  stage: string;
  userType: string;
  connectionStatus: string;
  linkedAt: string | null;
  lastUsed: string | null;
  messageCount: number;
  isPrimary: boolean;
}

interface ServerStatus {
  isOnline: boolean;
  connectedPhones: { phoneNumber: string; isConnected: boolean }[];
  error?: string;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  'متصل': { label: 'متصل', color: '#16a34a', bg: '#dcfce7' },
  'غير متصل': { label: 'غير متصل', color: '#dc2626', bg: '#fee2e2' },
  'قيد الربط': { label: 'قيد الربط', color: '#ca8a04', bg: '#fef9c3' },
};

const USER_TYPES = ['وكيل', 'مدير', 'موجه'];
const STAGES = [
  { id: 'ابتدائي', label: 'ابتدائي' },
  { id: 'متوسط', label: 'متوسط' },
  { id: 'ثانوي', label: 'ثانوي' },
];

type TabType = 'sessions' | 'qr' | 'settings' | 'security';

const WhatsAppPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newStage, setNewStage] = useState('ابتدائي');
  const [newUserType, setNewUserType] = useState('وكيل');

  // QR state
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Settings state
  const [serverUrl, setServerUrl] = useState('');
  const [serviceStatus, setServiceStatus] = useState('مفعل');
  const [waMode, setWaMode] = useState('PerStage');
  const [smsApiToken, setSmsApiToken] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, statusRes] = await Promise.all([
        whatsappApi.getSessions(),
        whatsappApi.getStatus(),
      ]);
      if (sessRes.data?.data) setSessions(sessRes.data.data);
      if (statusRes.data?.data) setServerStatus(statusRes.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await whatsappApi.getSettings();
      const d = res.data?.data;
      if (d) {
        setServerUrl(d.serverUrl || '');
        setServiceStatus(d.serviceStatus || 'مفعل');
        setWaMode(d.whatsAppMode || 'PerStage');
      }
    } catch { /* empty */ }
  }, []);

  useEffect(() => { loadSessions(); loadSettings(); }, [loadSessions, loadSettings]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleAdd = async () => {
    if (!newPhone.trim()) { toast.error('أدخل رقم الواتساب'); return; }
    try {
      await whatsappApi.addSession({ phoneNumber: newPhone.trim(), stage: newStage, userType: newUserType });
      toast.success('تم إضافة الجلسة');
      setShowAddForm(false);
      setNewPhone('');
      loadSessions();
    } catch { toast.error('فشل الإضافة'); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('هل تريد حذف هذه الجلسة؟')) return;
    try {
      await whatsappApi.deleteSession(id);
      toast.success('تم الحذف');
      loadSessions();
    } catch { toast.error('فشل الحذف'); }
  };

  const handleSetPrimary = async (id: number) => {
    try {
      await whatsappApi.setPrimary(id);
      toast.success('تم تعيين الجلسة الأساسية');
      loadSessions();
    } catch { toast.error('فشل التعيين'); }
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await whatsappApi.saveSettings({ serverUrl, serviceStatus, whatsAppMode: waMode, ...(smsApiToken ? { smsApiToken } : {}) });
      toast.success('تم حفظ الإعدادات');
      loadSettings();
    } catch { toast.error('فشل الحفظ'); }
    finally { setSettingsLoading(false); }
  };

  // QR Pairing
  const startQRPairing = async () => {
    setQrLoading(true);
    setQrData(null);
    try {
      const res = await whatsappApi.getQR();
      const d = res.data?.data;
      if (d?.hasQR) {
        setQrData(d.qrData);
        // Start polling for new connection every 5s
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const statusRes = await whatsappApi.getStatus();
            const status = statusRes.data?.data as ServerStatus;
            if (status?.connectedPhones?.length) {
              toast.success('تم الاتصال بنجاح!');
              stopQRPolling();
              loadSessions();
              setActiveTab('sessions');
            } else {
              // Refresh QR every 15s
              const qrRes = await whatsappApi.getQR();
              if (qrRes.data?.data?.hasQR) setQrData(qrRes.data.data.qrData);
            }
          } catch { /* ignore */ }
        }, 5000);

        // Timeout after 3 minutes
        setTimeout(() => {
          if (pollRef.current) {
            stopQRPolling();
            toast.error('انتهت مهلة ربط الواتساب');
          }
        }, 180000);
      } else {
        toast.error('لم يتم الحصول على QR — تأكد من رابط السيرفر');
      }
    } catch { toast.error('فشل الاتصال بالسيرفر'); }
    finally { setQrLoading(false); }
  };

  const stopQRPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setQrData(null);
  };

  const handlePing = async () => {
    toast('جاري إيقاظ السيرفر...');
    try {
      const res = await whatsappApi.ping();
      if (res.data?.data?.isOnline) toast.success('السيرفر متصل');
      else toast.error('السيرفر غير متصل');
      loadSessions();
    } catch { toast.error('فشل الاتصال'); }
  };

  const connected = sessions.filter(s => s.connectionStatus === 'متصل').length;
  const totalMessages = sessions.reduce((a, s) => a + s.messageCount, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111', margin: 0 }}>أدوات واتساب</h1>
          {serverStatus && (
            <span style={{
              padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 700,
              background: serverStatus.isOnline ? '#dcfce7' : '#fee2e2',
              color: serverStatus.isOnline ? '#16a34a' : '#dc2626',
            }}>{serverStatus.isOnline ? 'السيرفر متصل' : 'السيرفر غير متصل'}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handlePing} style={headerBtnStyle('#f3f4f6', '#374151')}>إيقاظ السيرفر</button>
          <button onClick={loadSessions} style={headerBtnStyle('#f3f4f6', '#374151')}>تحديث</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '0' }}>
        {([['sessions', 'الأرقام المربوطة'], ['qr', 'ربط رقم جديد'], ['settings', 'الإعدادات'], ['security', 'الأمان']] as [TabType, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
            background: activeTab === id ? '#25d366' : 'transparent',
            color: activeTab === id ? '#fff' : '#6b7280',
            borderRadius: '12px 12px 0 0',
          }}>{label}</button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="إجمالي الأرقام" value={sessions.length} color="#25d366" />
        <StatCard label="متصل" value={connected} color="#16a34a" />
        <StatCard label="إجمالي الرسائل" value={totalMessages} color="#2563eb" />
        <StatCard label="من السيرفر" value={serverStatus?.connectedPhones?.length ?? 0} color="#7c3aed" />
      </div>

      {/* Tab: Sessions */}
      {activeTab === 'sessions' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <button onClick={() => setShowAddForm(!showAddForm)} style={{
              padding: '10px 20px', background: '#25d366', color: '#fff', border: 'none',
              borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
            }}>{showAddForm ? 'إلغاء' : 'إضافة رقم'}</button>
          </div>

          {showAddForm && (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '20px', border: '2px solid #25d366' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>إضافة رقم واتساب جديد</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>رقم الواتساب</label>
                  <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                    placeholder="05xxxxxxxx" dir="ltr" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>المرحلة</label>
                  <select value={newStage} onChange={e => setNewStage(e.target.value)} style={inputStyle}>
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>نوع المستخدم</label>
                  <select value={newUserType} onChange={e => setNewUserType(e.target.value)} style={inputStyle}>
                    {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleAdd} style={{
                padding: '10px 24px', background: '#25d366', color: '#fff', border: 'none',
                borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
              }}>حفظ</button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>
          ) : sessions.length === 0 ? (
            <EmptyState message="لا توجد أرقام واتساب مربوطة" sub="أضف رقم واتساب أو اربط رقم جديد عبر QR Code" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {sessions.map(session => {
                const st = STATUS_STYLES[session.connectionStatus] || { label: session.connectionStatus, color: '#6b7280', bg: '#f3f4f6' };
                // Check if connected on server
                const isOnServer = serverStatus?.connectedPhones?.some(p => p.phoneNumber === session.phoneNumber);
                return (
                  <div key={session.id} style={{
                    background: '#fff', borderRadius: '16px', padding: '20px',
                    border: session.isPrimary ? '2px solid #25d366' : '1px solid #e5e7eb',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                        }}>💬</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px', direction: 'ltr' as const }}>{session.phoneNumber || 'غير محدد'}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{session.userType} - {session.stage}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{
                          padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 700,
                          background: st.bg, color: st.color,
                        }}>{st.label}</span>
                        {isOnServer && (
                          <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>متصل بالسيرفر</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <MiniStat label="الرسائل" value={String(session.messageCount)} />
                      <MiniStat label="آخر استخدام" value={session.lastUsed ? new Date(session.lastUsed).toLocaleDateString('ar-SA') : '-'} />
                    </div>

                    {session.isPrimary && (
                      <div style={{
                        textAlign: 'center', fontSize: '12px', color: '#16a34a', fontWeight: 700,
                        background: '#f0fdf4', padding: '6px', borderRadius: '6px', marginBottom: '12px',
                      }}>الرقم الرئيسي للمرحلة</div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {!session.isPrimary && (
                        <button onClick={() => handleSetPrimary(session.id)} style={smallBtnStyle('#2563eb', '#dbeafe')}>تعيين أساسي</button>
                      )}
                      <button onClick={() => handleDelete(session.id)} style={smallBtnStyle('#dc2626', '#fee2e2')}>حذف</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: QR Code Pairing */}
      {activeTab === 'qr' && (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>ربط رقم واتساب جديد</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
            امسح رمز QR من تطبيق الواتساب على جوالك لربط الرقم بالنظام
          </p>

          {!qrData ? (
            <div>
              {!serverStatus?.isOnline && (
                <div style={{ background: '#fef9c3', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#92400e', fontSize: '14px' }}>
                  تنبيه: السيرفر غير متصل حالياً. تأكد من تشغيل السيرفر وإعداد الرابط في الإعدادات.
                </div>
              )}
              <button onClick={startQRPairing} disabled={qrLoading} style={{
                padding: '14px 32px', background: '#25d366', color: '#fff', border: 'none',
                borderRadius: '12px', fontWeight: 700, fontSize: '16px', cursor: 'pointer',
                opacity: qrLoading ? 0.6 : 1,
              }}>{qrLoading ? 'جاري التحميل...' : 'بدء الربط'}</button>

              <div style={{ marginTop: '32px', textAlign: 'right' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>خطوات الربط:</h3>
                <ol style={{ color: '#4b5563', fontSize: '14px', lineHeight: 2, paddingRight: '20px' }}>
                  <li>افتح تطبيق واتساب على جوالك</li>
                  <li>اذهب إلى الإعدادات ← الأجهزة المرتبطة</li>
                  <li>اضغط "ربط جهاز"</li>
                  <li>وجّه الكاميرا نحو رمز QR</li>
                  <li>انتظر حتى يتم الربط تلقائياً</li>
                </ol>
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                background: '#fff', border: '2px solid #25d366', borderRadius: '16px',
                padding: '24px', display: 'inline-block', marginBottom: '16px',
              }}>
                <img src={qrData} alt="QR Code" style={{ width: '280px', height: '280px' }} />
              </div>
              <p style={{ color: '#16a34a', fontWeight: 700, marginBottom: '8px' }}>
                امسح الرمز من تطبيق الواتساب...
              </p>
              <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '16px' }}>
                يتم تحديث الرمز تلقائياً كل 15 ثانية — المهلة 3 دقائق
              </p>
              <button onClick={stopQRPolling} style={{
                padding: '10px 24px', background: '#fee2e2', color: '#dc2626', border: 'none',
                borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
              }}>إلغاء</button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'security' && <SecurityTab />}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px' }}>إعدادات الواتساب</h2>

          <div style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
            <div>
              <label style={labelStyle}>رابط سيرفر الواتساب</label>
              <input type="text" value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                placeholder="https://your-whatsapp-server.com" dir="ltr" style={inputStyle} />
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>رابط السيرفر الذي يتصل بواتساب ويب</div>
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
                <option value="Unified">رقم موحد</option>
              </select>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                {waMode === 'PerStage' ? 'كل مرحلة تستخدم رقم واتساب خاص بها' : 'جميع المراحل تستخدم رقم واتساب واحد'}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#374151' }}>إعدادات SMS (Madar)</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>رمز API</label>
                  <input type="password" value={smsApiToken} placeholder="أدخل رمز Madar API..." dir="ltr" style={inputStyle}
                    onChange={e => setSmsApiToken(e.target.value)} />
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>يُحفظ مشفراً — اتركه فارغاً للإبقاء على القيمة الحالية</div>
                </div>
              </div>
            </div>

            <button onClick={handleSaveSettings} disabled={settingsLoading} style={{
              padding: '12px 24px', background: '#25d366', color: '#fff', border: 'none',
              borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              opacity: settingsLoading ? 0.6 : 1, marginTop: '8px', width: 'fit-content',
            }}>{settingsLoading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== Security Tab =====
const SecurityTab: React.FC = () => {
  const [status, setStatus] = useState<{
    hasSecurityCode: boolean; hasRecoveryPhone1: boolean; hasRecoveryPhone2: boolean;
    recoveryPhone1Masked: string | null; recoveryPhone2Masked: string | null;
  } | null>(null);
  const [view, setView] = useState<'status' | 'setup' | 'verify' | 'change' | 'recovery-choose' | 'recovery-input'>('status');
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [recoveryPhone1, setRecoveryPhone1] = useState('');
  const [recoveryPhone2, setRecoveryPhone2] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryBypass, setRecoveryBypass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    whatsappApi.getSecurityStatus().then((res) => {
      if (res.data?.data) setStatus(res.data.data);
    });
  }, []);

  const handleSetup = async () => {
    setError('');
    if (!code || code.length < 6) { setError('رمز الأمان يجب أن يكون 6 أرقام على الأقل'); return; }
    if (!recoveryPhone1.trim()) { setError('جوال الاسترجاع الأول مطلوب'); return; }
    setSaving(true);
    try {
      const res = await whatsappApi.setupSecurityCode(code, recoveryPhone1.trim(), recoveryPhone2.trim() || undefined);
      if (res.data?.success) { toast.success('تم تعيين رمز الأمان'); setView('status'); setCode(''); setRecoveryPhone1(''); setRecoveryPhone2('');
        const s = await whatsappApi.getSecurityStatus(); if (s.data?.data) setStatus(s.data.data);
      } else setError(res.data?.message || 'خطأ');
    } catch { setError('خطأ في الاتصال'); }
    finally { setSaving(false); }
  };

  const handleVerify = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await whatsappApi.verifySecurityCode(code);
      if (res.data?.data?.valid) { setVerified(true); setView('change'); setCode(''); toast.success('تم التحقق'); }
      else setError('رمز الأمان غير صحيح');
    } catch { setError('خطأ'); }
    finally { setSaving(false); }
  };

  const handleChangeCode = async () => {
    setError('');
    if (!newCode || newCode.length < 6) { setError('رمز الأمان الجديد يجب أن يكون 6 أرقام على الأقل'); return; }
    if (newCode !== confirmCode) { setError('الرمز الجديد وتأكيده غير متطابقين'); return; }
    setSaving(true);
    try {
      const res = await whatsappApi.changeSecurityCode({
        newCode, bypassOldCode: recoveryBypass,
        ...(recoveryPhone1 ? { recoveryPhone1 } : {}),
        ...(recoveryPhone2 ? { recoveryPhone2 } : {}),
      });
      if (res.data?.success) { toast.success('تم تغيير رمز الأمان'); setView('status'); setNewCode(''); setConfirmCode(''); setVerified(false); setRecoveryBypass(false);
        const s = await whatsappApi.getSecurityStatus(); if (s.data?.data) setStatus(s.data.data);
      } else setError(res.data?.message || 'خطأ');
    } catch { setError('خطأ'); }
    finally { setSaving(false); }
  };

  const handleRequestRecovery = async (phoneIndex: number) => {
    setError('');
    setSaving(true);
    try {
      const res = await whatsappApi.requestRecoveryCode(phoneIndex);
      if (res.data?.data?.sent) { toast.success(`تم إرسال رمز الاسترجاع إلى ${res.data.data.phoneMasked}`); setView('recovery-input'); }
      else setError(res.data?.message || 'فشل إرسال الرمز');
    } catch { setError('خطأ'); }
    finally { setSaving(false); }
  };

  const handleVerifyRecovery = async () => {
    setError('');
    if (recoveryCode.length !== 4) { setError('رمز الاسترجاع 4 أرقام'); return; }
    setSaving(true);
    try {
      const res = await whatsappApi.verifyRecoveryCode(recoveryCode);
      if (res.data?.data?.valid) { toast.success('تم التحقق من رمز الاسترجاع'); setRecoveryBypass(true); setView('change'); setRecoveryCode(''); }
      else setError('رمز الاسترجاع غير صحيح أو منتهي الصلاحية');
    } catch { setError('خطأ'); }
    finally { setSaving(false); }
  };

  if (!status) return <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>;

  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb', maxWidth: '600px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        🔒 نظام الأمان
      </h2>

      {error && (
        <div style={{ padding: '10px 16px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}>{error}</div>
      )}

      {/* Status View */}
      {view === 'status' && (
        <div>
          <div style={{ padding: '20px', background: status.hasSecurityCode ? '#f0fdf4' : '#fef9c3', borderRadius: '16px', marginBottom: '20px', border: `2px solid ${status.hasSecurityCode ? '#bbf7d0' : '#fde68a'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>{status.hasSecurityCode ? '✅' : '⚠️'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: status.hasSecurityCode ? '#15803d' : '#a16207' }}>
                  {status.hasSecurityCode ? 'رمز الأمان مُفعّل' : 'لم يتم تعيين رمز الأمان'}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {status.hasSecurityCode ? 'يتم طلب الرمز عند تغيير إعدادات الواتساب' : 'يُنصح بتعيين رمز أمان لحماية الإعدادات'}
                </div>
              </div>
            </div>
            {status.hasSecurityCode && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
                <span style={{ padding: '4px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  استرجاع 1: {status.recoveryPhone1Masked || 'غير محدد'}
                </span>
                <span style={{ padding: '4px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  استرجاع 2: {status.recoveryPhone2Masked || 'غير محدد'}
                </span>
              </div>
            )}
          </div>

          {!status.hasSecurityCode ? (
            <button onClick={() => setView('setup')} style={{ padding: '12px 24px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              تعيين رمز الأمان
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => { setView('verify'); setVerified(false); }} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
                تغيير رمز الأمان
              </button>
              <button onClick={() => setView('recovery-choose')} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
                نسيت الرمز
              </button>
            </div>
          )}
        </div>
      )}

      {/* Setup View */}
      {view === 'setup' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={labelStyle}>رمز الأمان (6 أرقام على الأقل)</label>
            <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="أدخل رمز الأمان..." dir="ltr" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>جوال الاسترجاع الأول *</label>
            <input type="text" value={recoveryPhone1} onChange={(e) => setRecoveryPhone1(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>جوال الاسترجاع الثاني (اختياري)</label>
            <input type="text" value={recoveryPhone2} onChange={(e) => setRecoveryPhone2(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleSetup} disabled={saving} style={{ padding: '10px 24px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? '...' : 'حفظ'}
            </button>
            <button onClick={() => setView('status')} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Verify View (before change) */}
      {view === 'verify' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <p style={{ color: '#4b5563', margin: 0 }}>أدخل رمز الأمان الحالي للمتابعة</p>
          <div>
            <label style={labelStyle}>رمز الأمان الحالي</label>
            <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="أدخل الرمز..." dir="ltr" style={inputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleVerify} disabled={saving} style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? '...' : 'تحقق'}
            </button>
            <button onClick={() => { setView('status'); setCode(''); setError(''); }} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Change View */}
      {view === 'change' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <p style={{ color: '#16a34a', fontWeight: 700, margin: 0 }}>✅ تم التحقق — أدخل الرمز الجديد</p>
          <div>
            <label style={labelStyle}>رمز الأمان الجديد</label>
            <input type="password" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="6 أرقام على الأقل..." dir="ltr" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>تأكيد الرمز الجديد</label>
            <input type="password" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} placeholder="أعد إدخال الرمز..." dir="ltr" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleChangeCode} disabled={saving} style={{ padding: '10px 24px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? '...' : 'تغيير الرمز'}
            </button>
            <button onClick={() => { setView('status'); setNewCode(''); setConfirmCode(''); setError(''); setRecoveryBypass(false); }}
              style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Recovery Choose Phone */}
      {view === 'recovery-choose' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <p style={{ color: '#4b5563', margin: 0 }}>اختر جوال الاسترجاع لإرسال رمز مؤقت</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {status.hasRecoveryPhone1 && (
              <button onClick={() => handleRequestRecovery(1)} disabled={saving} style={{ flex: 1, padding: '16px', background: '#eef2ff', border: '2px solid #c7d2fe', borderRadius: '12px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📱</div>
                <div style={{ fontWeight: 700, color: '#4338ca' }}>جوال 1</div>
                <div style={{ fontSize: '12px', color: '#6b7280', direction: 'ltr' as const }}>{status.recoveryPhone1Masked}</div>
              </button>
            )}
            {status.hasRecoveryPhone2 && (
              <button onClick={() => handleRequestRecovery(2)} disabled={saving} style={{ flex: 1, padding: '16px', background: '#f5f3ff', border: '2px solid #ddd6fe', borderRadius: '12px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📱</div>
                <div style={{ fontWeight: 700, color: '#6d28d9' }}>جوال 2</div>
                <div style={{ fontSize: '12px', color: '#6b7280', direction: 'ltr' as const }}>{status.recoveryPhone2Masked}</div>
              </button>
            )}
          </div>
          <button onClick={() => { setView('status'); setError(''); }} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}>رجوع</button>
        </div>
      )}

      {/* Recovery Code Input */}
      {view === 'recovery-input' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <p style={{ color: '#4b5563', margin: 0 }}>أدخل رمز الاسترجاع المكوّن من 4 أرقام المُرسل إلى جوالك</p>
          <div>
            <label style={labelStyle}>رمز الاسترجاع</label>
            <input type="text" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="____" dir="ltr" maxLength={4}
              style={{ ...inputStyle, textAlign: 'center' as const, fontSize: '24px', fontWeight: 800, letterSpacing: '12px' }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyRecovery(); }} />
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', textAlign: 'center' }}>صالح لمدة 5 دقائق</div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleVerifyRecovery} disabled={saving} style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? '...' : 'تحقق'}
            </button>
            <button onClick={() => { setView('status'); setRecoveryCode(''); setError(''); }} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== Sub-components =====

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '2px solid #e5e7eb' }}>
    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: 800, color }}>{value}</div>
  </div>
);

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
    <div style={{ fontSize: '11px', color: '#6b7280' }}>{label}</div>
    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>{value}</div>
  </div>
);

const EmptyState: React.FC<{ message: string; sub: string }> = ({ message, sub }) => (
  <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
    <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>{message}</h3>
    <p style={{ color: '#9ca3af', fontSize: '14px' }}>{sub}</p>
  </div>
);

// ===== Styles =====

const headerBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '10px 20px', background: bg, color, border: 'none',
  borderRadius: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
});
const smallBtnStyle = (color: string, bg: string): React.CSSProperties => ({
  padding: '6px 14px', background: bg, color, border: 'none',
  borderRadius: '12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
});
const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px', fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px', border: '2px solid #d1d5db', borderRadius: '8px',
  fontSize: '14px', boxSizing: 'border-box' as const,
};

export default WhatsAppPage;
