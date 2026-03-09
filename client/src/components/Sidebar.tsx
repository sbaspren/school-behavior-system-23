import React from 'react';
import { NavLink } from 'react-router-dom';

interface Props {
  open: boolean;
  role?: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: string; // Material Symbols icon name
  roles?: string[];
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV_ITEMS: NavGroup[] = [
  { section: '', items: [
    { path: '/', label: 'لوحة التحكم', icon: 'dashboard' },
  ]},
  { section: 'شؤون الطلاب', items: [
    { path: '/violations', label: 'المخالفات السلوكية', icon: 'gavel' },
    { path: '/behavior-history', label: 'سجل سلوك الطالب', icon: 'folder_open' },
    { path: '/positive', label: 'السلوك الإيجابي', icon: 'star' },
    { path: '/attendance', label: 'التأخر والاستئذان', icon: 'schedule', roles: ['Admin', 'Deputy', 'Counselor', 'Guard'] },
    { path: '/tardiness', label: 'التأخر', icon: 'timer_off', roles: ['Admin', 'Deputy', 'Counselor', 'Guard'] },
    { path: '/absence', label: 'الغياب', icon: 'event_busy', roles: ['Admin', 'Deputy', 'Counselor'] },
    { path: '/permissions', label: 'الاستئذان', icon: 'exit_to_app', roles: ['Admin', 'Deputy', 'Counselor', 'Guard'] },
    { path: '/notes', label: 'الملاحظات التربوية', icon: 'menu_book' },
    { path: '/parent-excuse', label: 'أعذار أولياء الأمور', icon: 'mark_email_read', roles: ['Admin', 'Deputy', 'Counselor'] },
    { path: '/general-forms', label: 'النماذج العامة', icon: 'folder_open', roles: ['Admin', 'Deputy', 'Counselor'] },
    { path: '/audit-log', label: 'سجل السلوك', icon: 'history', roles: ['Admin', 'Deputy', 'Counselor'] },
  ]},
  { section: 'التواصل', items: [
    { path: '/whatsapp', label: 'الواتساب', icon: 'chat', roles: ['Admin', 'Deputy'] },
    { path: '/communication', label: 'سجل التواصل', icon: 'call', roles: ['Admin', 'Deputy', 'Counselor'] },
  ]},
  { section: 'التوثيق', items: [
    { path: '/noor', label: 'التوثيق في نور', icon: 'cloud_sync', roles: ['Admin', 'Deputy', 'Counselor'] },
    { path: '/academic', label: 'التحصيل الدراسي', icon: 'analytics', roles: ['Admin', 'Deputy', 'Counselor'] },
    { path: '/reports', label: 'التقارير والإحصائيات', icon: 'bar_chart', roles: ['Admin', 'Deputy', 'Counselor'] },
  ]},
  { section: 'النظام', items: [
    { path: '/settings', label: 'الإعدادات', icon: 'settings', roles: ['Admin'] },
  ]},
];

const Sidebar: React.FC<Props> = ({ open, role }) => {
  if (!open) return null;

  const visibleGroups = NAV_ITEMS.map(group => ({
    ...group,
    items: group.items.filter(item => !item.roles || (role && item.roles.includes(role))),
  })).filter(group => group.items.length > 0);

  return (
    <aside style={{
      width: '240px', minWidth: '240px', height: '100vh',
      background: '#fff', borderLeft: '1px solid #e8ebf2',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
      boxShadow: '1px 0 8px rgba(0,0,0,.03)',
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #e8ebf2',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{
          width: '40px', height: '40px',
          background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)',
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '18px',
          boxShadow: '0 2px 8px rgba(79,70,229,.25)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>school</span>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '14px', color: '#1a1d2e', fontFamily: "'Noto Kufi Arabic', Cairo, sans-serif" }}>شؤون الطلاب</div>
          <div style={{ fontSize: '11px', color: '#9da3b8' }}>نظام إدارة السلوك</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '8px 12px', flex: 1 }}>
        {visibleGroups.map((group, gi) => (
          <div key={group.section || gi}>
            {group.section && (
              <div style={{
                fontSize: '10px', fontWeight: 700, color: '#9da3b8',
                letterSpacing: '0.3px',
                margin: '16px 8px 8px', padding: 0,
              }}>
                {group.section}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className="sidebar-nav-item"
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '8px',
                  textDecoration: 'none', fontSize: '13px',
                  color: isActive ? '#fff' : '#5c6178',
                  background: isActive ? '#4f46e5' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  marginBottom: '2px',
                  transition: 'all 0.15s cubic-bezier(.4,0,.2,1)',
                  borderRight: isActive ? '3px solid #3730a3' : '3px solid transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(79,70,229,.15)' : 'none',
                })}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            {gi === 0 && <div style={{ height: '1px', background: '#e8ebf2', margin: '8px 0' }} />}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
