import React from 'react';

interface Props {
  text?: string;
}

const LoadingSpinner: React.FC<Props> = ({ text = 'جاري التحميل...' }) => (
  <div style={{ textAlign: 'center', padding: '40px' }}>
    <div className="spinner" />
    <p style={{ marginTop: '12px', color: '#666' }}>{text}</p>
  </div>
);

export default LoadingSpinner;
