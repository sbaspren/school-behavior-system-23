import toast, { Toaster } from 'react-hot-toast';

const TOAST_STYLE = {
  fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
  direction: 'rtl' as const,
  fontSize: '13px',
  fontWeight: 600,
  borderRadius: '12px',
  padding: '12px 24px',
  maxWidth: '500px',
  boxShadow: '0 8px 24px rgba(0,0,0,.08)',
};

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: { ...TOAST_STYLE, background: '#059669', color: '#fff' },
    iconTheme: { primary: '#fff', secondary: '#059669' },
  });
};

export const showError = (message: string) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-center',
    style: { ...TOAST_STYLE, background: '#dc2626', color: '#fff' },
    iconTheme: { primary: '#fff', secondary: '#dc2626' },
  });
};

export const showInfo = (message: string) => {
  toast(message, {
    duration: 3000,
    position: 'top-center',
    icon: 'ℹ️',
    style: { ...TOAST_STYLE, background: '#2563eb', color: '#fff' },
  });
};

export const showWarning = (message: string) => {
  toast(message, {
    duration: 3000,
    position: 'top-center',
    icon: '⚠️',
    style: { ...TOAST_STYLE, background: '#eab308', color: '#fff' },
  });
};

// دالة موحدة تطابق showEnhancedToast في الأصلي
export const showEnhancedToast = (type: string, message: string) => {
  switch (type) {
    case 'success': showSuccess(message); break;
    case 'danger':
    case 'error': showError(message); break;
    case 'info': showInfo(message); break;
    case 'warning': showWarning(message); break;
    default: showInfo(message);
  }
};

// Alias for backward compatibility
export const showToast = (message: string, type: string = 'info') => {
  const typeMap: Record<string, string> = { error: 'danger', success: 'success', info: 'info', warning: 'warning' };
  showEnhancedToast(typeMap[type] || type, message);
};

export const ToastProvider = () => (
  <Toaster
    toastOptions={{
      style: TOAST_STYLE,
    }}
  />
);
