import React from 'react';

interface Props {
  icon: string;        // Material Symbols icon name
  title: string;
  color: string;
  hoverBg?: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean; // highlight required forms
}

/**
 * ActionIcon — أيقونة إجراء في صفوف الجدول
 * مطابق لأيقونات الأصلي: Material Symbols + لون محدد + tooltip
 */
const ActionIcon: React.FC<Props> = ({ icon, title, color, hoverBg, onClick, disabled, highlight }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: 6,
        borderRadius: 8,
        border: 'none',
        background: highlight ? '#fef3c7' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: highlight ? '0 0 0 2px #f59e0b' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!disabled && hoverBg) (e.currentTarget.style.background = hoverBg);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = highlight ? '#fef3c7' : 'transparent';
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20, color }}>{icon}</span>
    </button>
  );
};

export default ActionIcon;
