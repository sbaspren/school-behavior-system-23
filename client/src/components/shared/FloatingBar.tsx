import React from 'react';

interface FloatingAction {
  icon: string;
  label: string;
  color: string;
  onClick: () => void;
}

interface Props {
  count: number;
  actions: FloatingAction[];
  onCancel: () => void;
}

/**
 * FloatingBar — شريط الإجراءات العائم عند التحديد
 * مطابق للأصلي: fixed bottom + عدد المحدد + أزرار جماعية + إلغاء
 */
const FloatingBar: React.FC<Props> = ({ count, actions, onCancel }) => {
  if (count === 0) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      background: '#1e293b',
      color: '#fff',
      borderRadius: 16,
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(10px)',
      animation: 'floatBarIn 0.3s ease',
    }}>
      <style>{`@keyframes floatBarIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <span style={{ fontWeight: 800, fontSize: 14 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginLeft: 4 }}>check_box</span>
        تم تحديد {count}
      </span>
      <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={a.onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 10,
            background: a.color,
            color: '#fff',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'filter 0.15s',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{a.icon}</span>
          {a.label}
        </button>
      ))}
      <button
        onClick={onCancel}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 14px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          border: 'none',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        إلغاء
      </button>
    </div>
  );
};

export default FloatingBar;
