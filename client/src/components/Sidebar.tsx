import React from 'react';
import { NavLink } from 'react-router-dom';

interface Props {
  open: boolean;
  role?: string;
  schoolName?: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
  iconColor: string;
  roles?: string[];
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV_ITEMS: NavGroup[] = [
  // ── 0. لوحة المتابعة (بدون عنوان مجموعة) ──
  { section: '', items: [
    { path: '/', label: 'لوحة المتابعة', icon: 'dashboard', iconColor: '#4f46e5' },
  ]},

  // ── 1. السلوك والمخالفات ──
  { section: 'السلوك والمخالفات', items: [
    { path: '/violations', label: 'المخالفات السلوكية', icon: 'gavel', iconColor: '#6366f1' },
    { path: '/behavior-history', label: 'سجل سلوك الطالب', icon: 'folder_open', iconColor: '#6366f1' },
    { path: '/positive', label: 'السلوك الإيجابي', icon: 'star', iconColor: '#f59e0b' },
  ]},

  // ── 2. الشؤون التعليمية ──
  { section: 'الشؤون التعليمية', items: [
    { path: '/notes', label: 'الملاحظات التربوية', icon: 'menu_book', iconColor: '#10b981' },
    { path: '/academic', label: 'التحصيل الدراسي', icon: 'analytics', iconColor: '#14b8a6' },
  ]},

  // ── 3. المواظبة والغياب ──
  { section: 'المواظبة والغياب', items: [
    { path: '/tardiness', label: 'التأخر', icon: 'timer_off', iconColor: '#ef4444', roles: ['Admin', 'Deputy', 'Counselor', 'Guard'] },
    { path: '/permissions', label: 'الاستئذان', icon: 'exit_to_app', iconColor: '#06b6d4', roles: ['Admin', 'Deputy', 'Counselor', 'Guard'] },
    { path: '/absence', label: 'الغياب', icon: 'event_busy', iconColor: '#f97316', roles: ['Admin', 'Deputy', 'Counselor'] },
    { path: '/attendance', label: 'التأخر والاستئذان', icon: 'schedule', iconColor: '#0891b2', roles: ['Admin', 'Deputy', 'Counselor', 'Guard'] },
    { path: '/parent-excuse', label: 'أعذار أولياء الأمور', icon: 'mark_email_read', iconColor: '#8b5cf6', roles: ['Admin', 'Deputy', 'Counselor'] },
  ]},

  // ── 4. الخدمات العامة ──
  { section: 'الخدمات العامة', items: [
    { path: '/general-forms', label: 'النماذج العامة', icon: 'folder_open', iconColor: '#f97316', roles: ['Admin', 'Deputy', 'Counselor'] },
  ]},

  // ── 5. نظام نور ──
  { section: 'نظام نور', items: [
    { path: '/noor', label: 'التوثيق في نور', icon: 'cloud_sync', iconColor: '#00897b', roles: ['Admin', 'Deputy', 'Counselor'] },
  ]},

  // ── 6. خدمات التواصل ──
  { section: 'خدمات التواصل', items: [
    { path: '/whatsapp', label: 'أدوات واتساب', icon: 'chat', iconColor: '#22c55e', roles: ['Admin', 'Deputy'] },
    { path: '/communication', label: 'سجل التواصل', icon: 'history', iconColor: '#3b82f6', roles: ['Admin', 'Deputy', 'Counselor'] },
  ]},

  // ── 7. النظام ──
  { section: 'النظام', items: [
    { path: '/settings', label: 'الإعدادات', icon: 'settings', iconColor: '#64748b', roles: ['Admin'] },
    { path: '/audit-log', label: 'سجل السلوك', icon: 'history', iconColor: '#6366f1', roles: ['Admin', 'Deputy', 'Counselor'] },
    { path: '/reports', label: 'التقارير والإحصائيات', icon: 'bar_chart', iconColor: '#14b8a6', roles: ['Admin', 'Deputy', 'Counselor'] },
  ]},
];

const Sidebar: React.FC<Props> = ({ open, role, schoolName }) => {
  if (!open) return null;

  const visibleGroups = NAV_ITEMS.map(group => ({
    ...group,
    items: group.items.filter(item => !item.roles || (role && item.roles.includes(role))),
  })).filter(group => group.items.length > 0);

  return (
    <aside style={{
      width: '240px', minWidth: '240px', height: '100vh',
      background: '#fff', borderLeft: '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column',
      boxShadow: '1px 0 8px rgba(0,0,0,.03)',
    }}>
      {/* Logo — مطابق للأصلي: 36×36, radius 10px, icon 20px */}
      <div style={{
        height: '64px', display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: '12px',
        borderBottom: '1px solid var(--c-border-light)',
      }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span className="material-symbols-outlined" style={{
            fontSize: '28px', color: 'white',
            WebkitTextFillColor: 'white', background: 'none',
          }}>school</span>
        </div>
        <div>
          <h1 style={{
            margin: 0, fontSize: '15px', fontWeight: 800,
            color: 'var(--c-text)',
            fontFamily: "'Noto Kufi Arabic', sans-serif",
            lineHeight: 1.3,
          }}>نظام شؤون الطلاب</h1>
          <div style={{ fontSize: '10px', color: '#9da3b8', fontWeight: 500 }}>
            {schoolName || ''}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
        {visibleGroups.map((group, gi) => (
          <div key={group.section || gi}>
            {/* عنوان المجموعة */}
            {group.section && (
              <div className="nav-section-title" style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--c-text-muted)',
                letterSpacing: '0.3px',
                padding: '4px 12px',
                marginTop: gi === 1 ? '8px' : '16px',
                marginBottom: '4px',
              }}>
                {group.section}
              </div>
            )}

            {/* عناصر التنقل */}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '8px 12px', borderRadius: '8px',
                  textDecoration: 'none', fontSize: '13px',
                  color: isActive ? '#fff' : 'var(--c-text-secondary)',
                  background: isActive ? 'var(--c-primary)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  marginBottom: '2px',
                  transition: 'all 0.15s cubic-bezier(.4,0,.2,1)',
                  borderRight: isActive ? '3px solid var(--c-primary-dark)' : '3px solid transparent',
                  boxShadow: isActive ? '0 2px 8px var(--c-primary-glow)' : 'none',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span className="material-symbols-outlined" style={{
                      fontSize: '20px',
                      color: isActive ? '#fff' : item.iconColor,
                      WebkitTextFillColor: isActive ? '#fff' : undefined,
                      background: isActive ? 'none' : undefined,
                    }}>{item.icon}</span>
                    <span style={{
                      fontWeight: isActive ? 'bold' : 500,
                    }}>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}

            {/* فاصل بعد لوحة المتابعة */}
            {gi === 0 && <div style={{
              height: '1px', background: 'var(--c-border-light)',
              margin: '8px 12px',
            }} />}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
