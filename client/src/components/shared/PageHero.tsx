import React from 'react';

export interface HeroStat {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  gradient: string;
  stats?: HeroStat[];
}

/**
 * PageHero — مطابق لـ .page-hero في CSS_Styles.html (سطر 432-441)
 * gradient + نمط SVG + عدادات
 */
const PageHero: React.FC<Props> = ({ title, subtitle, gradient, stats }) => {
  return (
    <div style={{
      margin: '0 0 16px',
      borderRadius: 20,
      overflow: 'hidden',
      background: gradient,
      color: '#fff',
      position: 'relative',
    }}>
      {/* SVG pattern overlay — مطابق لـ .page-hero::before */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />
      {/* Content — مطابق لـ .hero-content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '24px 28px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, opacity: 0.85, margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
        {stats && stats.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
            gap: 10,
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 14,
                padding: '12px 16px',
                textAlign: 'center',
                minWidth: 90,
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: s.color || '#fff' }}>{s.icon}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHero;
