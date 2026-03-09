import React from 'react';

interface Props {
  icon: string;        // Material Symbols icon name
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: string;
  sectionColor?: string;
  onAction?: () => void;
}

/**
 * EmptyState — مطابق لـ .empty-state في CSS_Styles.html (سطر 490)
 * أيقونة Material كبيرة + نص + زر إجراء
 */
const EmptyState: React.FC<Props> = ({ icon, title, description, actionLabel, actionIcon, sectionColor, onAction }) => {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 72, color: '#d1d5db' }}>{icon}</span>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>{title}</h3>
      {description && <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 16 }}>{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            borderRadius: 12,
            background: sectionColor || '#4f46e5',
            color: '#fff',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {actionIcon && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{actionIcon}</span>}
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
