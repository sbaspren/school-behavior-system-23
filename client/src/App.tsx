import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/shared/Toast';
import Sidebar from './components/Sidebar';
import LoginPage, { AuthUser } from './pages/LoginPage';
import { settingsApi } from './api/settings';
import SettingsPage from './pages/SettingsPage';
import ViolationsPage from './pages/ViolationsPage';
import PositiveBehaviorPage from './pages/PositiveBehaviorPage';
import TardinessPage from './pages/TardinessPage';
import AbsencePage from './pages/AbsencePage';
import PermissionsPage from './pages/PermissionsPage';
import EducationalNotesPage from './pages/EducationalNotesPage';
import DashboardPage from './pages/DashboardPage';
import WhatsAppPage from './pages/WhatsAppPage';
import CommunicationPage from './pages/CommunicationPage';
import NoorPage from './pages/NoorPage';
import AcademicPage from './pages/AcademicPage';
import ParentExcusePage from './pages/ParentExcusePage';
import TeacherFormPage from './pages/TeacherFormPage';
import StaffFormPage from './pages/StaffFormPage';
import GuardDisplayPage from './pages/GuardDisplayPage';
import WakeelFormPage from './pages/WakeelFormPage';
import CounselorFormPage from './pages/CounselorFormPage';
import AdminTardinessPage from './pages/AdminTardinessPage';
import AttendancePage from './pages/AttendancePage';
import AuditLogPage from './pages/AuditLogPage';
import ReportsPage from './pages/ReportsPage';
import GeneralFormsPage from './pages/GeneralFormsPage';
import HistoryPage from './pages/HistoryPage';
import ParentExcusePublicPage from './pages/ParentExcusePublicPage';
import './App.css';

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function AppContent() {
  const [sidebarOpen] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);
  const [schoolName, setSchoolName] = useState('');
  const [stages, setStages] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const location = useLocation();

  const handleLogin = useCallback((_token: string, u: AuthUser) => {
    setUser(u);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // جلب إعدادات المدرسة والمراحل
  const fetchAppData = useCallback(async () => {
    try {
      const [settingsRes, stagesRes] = await Promise.all([
        settingsApi.getSettings().catch(() => null),
        settingsApi.getStages().catch(() => null),
      ]);
      if (settingsRes?.data?.data?.schoolName) {
        setSchoolName(settingsRes.data.data.schoolName);
      }
      if (stagesRes?.data?.data && Array.isArray(stagesRes.data.data)) {
        // Backend returns: [{id, name, grades}] — نأخذ name (الاسم العربي)
        const stageNames = stagesRes.data.data.map((s: any) => s.name || s.id || s);
        setStages(stageNames);
        if (stageNames.length > 0 && !currentStage) {
          setCurrentStage(stageNames[0]);
        }
      }
    } catch (e) {
      // silent — settings might not be configured yet
    }
  }, [currentStage]);

  useEffect(() => {
    if (user) {
      fetchAppData();
    }
  }, [user, fetchAppData]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchAppData();
    setRefreshing(false);
  }, [refreshing, fetchAppData]);

  // Public routes — no auth required
  if (location.pathname === '/form') {
    return <TeacherFormPage />;
  }
  if (location.pathname === '/staff-form') {
    return <StaffFormPage />;
  }
  if (location.pathname === '/guard') {
    return <GuardDisplayPage />;
  }
  if (location.pathname === '/wakeel-form') {
    return <WakeelFormPage />;
  }
  if (location.pathname === '/counselor-form') {
    return <CounselorFormPage />;
  }
  if (location.pathname === '/admin-tardiness') {
    return <AdminTardinessPage />;
  }
  if (location.pathname === '/parent-excuse-form') {
    return <ParentExcusePublicPage />;
  }

  // Not logged in → show login page
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div style={{ display: 'flex', direction: 'rtl', fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif", minHeight: '100vh' }}>
      <Sidebar open={sidebarOpen} role={user.role} schoolName={schoolName} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Top Header — مطابق للأصلي */}
        <header className="no-print" style={{
          background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: '56px', minHeight: '56px',
          boxShadow: '0 1px 4px rgba(0,0,0,.03)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <select
              id="stage-selector"
              value={currentStage}
              onChange={(e) => setCurrentStage(e.target.value)}
              style={{ minWidth: '170px' }}
            >
              {stages.length === 0 && <option value="">جاري التحميل...</option>}
              {stages.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              id="refreshBtn"
              onClick={handleRefresh}
              style={{ opacity: refreshing ? 0.5 : 1, pointerEvents: refreshing ? 'none' : 'auto' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
              {' '}تحديث
            </button>
            <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{user.name}</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', background: '#f3f4f6', padding: '4px 8px', borderRadius: '6px' }}>{user.role}</span>
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', background: '#fee2e2', color: '#dc2626',
              borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>
              خروج
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f4f5f9' }}>
          <Routes>
            <Route path="/violations" element={<ViolationsPage />} />
            <Route path="/behavior-history" element={<HistoryPage />} />
            <Route path="/positive" element={<PositiveBehaviorPage />} />
            <Route path="/tardiness" element={<TardinessPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/absence" element={<AbsencePage />} />
            <Route path="/permissions" element={<PermissionsPage />} />
            <Route path="/notes" element={<EducationalNotesPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/communication" element={<CommunicationPage />} />
            <Route path="/noor" element={<NoorPage />} />
            <Route path="/academic" element={<AcademicPage />} />
            <Route path="/parent-excuse" element={<ParentExcusePage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/general-forms" element={<GeneralFormsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <div id="print-container" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider />
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
