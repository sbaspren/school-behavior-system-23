import React from 'react';

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmColor?: string;
  icon?: string;
}

/**
 * ConfirmModal — منبثقة تأكيد مطابقة للأصلي
 * أيقونة تحذير + نص + زرين (تأكيد/إلغاء)
 */
const ConfirmModal: React.FC<Props> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'تأكيد',
  confirmColor = '#dc2626',
  icon = 'warning',
}) => (
  <div
    style={{
      position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)',
      backdropFilter: 'blur(4px)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
  >
    <div style={{
      background: '#fff', borderRadius: 20, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      width: '100%', maxWidth: 400, overflow: 'hidden',
      animation: 'modalIn 0.2s ease',
    }}>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}`}</style>
      {/* Icon */}
      <div style={{ textAlign: 'center', padding: '24px 24px 0' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: confirmColor === '#dc2626' ? '#fef2f2' : '#eff6ff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 12,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: confirmColor }}>{icon}</span>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#111827' }}>{title}</h3>
        <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
      </div>
      {/* Buttons */}
      <div style={{
        display: 'flex', borderTop: '1px solid #f3f4f6',
      }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '14px', color: '#6b7280', background: 'none',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 14, fontWeight: 600, borderRight: '1px solid #f3f4f6',
          }}
        >
          إلغاء
        </button>
        <button
          onClick={onConfirm}
          style={{
            flex: 1, padding: '14px', color: confirmColor, background: 'none',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 14, fontWeight: 700,
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmModal;
