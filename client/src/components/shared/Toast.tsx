import toast, { Toaster } from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message, { duration: 3000, position: 'top-center' });
};

export const showError = (message: string) => {
  toast.error(message, { duration: 4000, position: 'top-center' });
};

export const ToastProvider = () => (
  <Toaster
    toastOptions={{
      style: {
        fontFamily: "'Cairo', sans-serif",
        direction: 'rtl',
        fontSize: '14px',
      },
    }}
  />
);
