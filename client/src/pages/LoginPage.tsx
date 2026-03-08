import { useState } from 'react';
import { authApi } from '../api/auth';
import { showError } from '../components/shared/Toast';

interface Props {
  onLogin: (token: string, user: AuthUser) => void;
}

export interface AuthUser {
  id: number;
  name: string;
  role: string;
  mobile: string;
  scopeType?: string;
  scopeValue?: string;
}

const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !password.trim()) return showError('أدخل رقم الجوال وكلمة المرور');
    setLoading(true);
    try {
      const res = await authApi.login(mobile.trim(), password);
      if (res.data?.success && res.data.data) {
        const { token, user } = res.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        onLogin(token, user);
      } else {
        showError(res.data?.message || 'فشل تسجيل الدخول');
      }
    } catch {
      showError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)',
      direction: 'rtl',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '48px 40px',
        width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', background: '#4f46e5', borderRadius: '16px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: '28px', marginBottom: '16px',
          }}>ش</div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111', margin: '0 0 4px' }}>نظام شؤون الطلاب</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>نظام إدارة السلوك المدرسي</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
              رقم الجوال
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              placeholder="05xxxxxxxx"
              autoComplete="username"
              style={{
                width: '100%', padding: '12px 16px', border: '2px solid #d1d5db',
                borderRadius: '12px', fontSize: '16px', boxSizing: 'border-box',
                direction: 'ltr', textAlign: 'right',
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: '100%', padding: '12px 16px', border: '2px solid #d1d5db',
                borderRadius: '12px', fontSize: '16px', boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', background: '#4f46e5', color: '#fff',
              border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '24px' }}>
          نظام شؤون الطلاب - الإصدار 2.0
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
