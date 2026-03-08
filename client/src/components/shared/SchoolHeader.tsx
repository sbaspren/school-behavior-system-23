import React from 'react';

interface Props {
  schoolName: string;
  eduAdmin: string;
  eduDept: string;
  letterheadMode: string;
  letterheadImageUrl?: string;
}

const SchoolHeader: React.FC<Props> = ({
  schoolName,
  eduAdmin,
  eduDept,
  letterheadMode,
  letterheadImageUrl,
}) => {
  if (letterheadMode === 'Image' && letterheadImageUrl) {
    return (
      <div className="school-header">
        <img src={letterheadImageUrl} alt="ترويسة المدرسة" style={{ width: '100%', maxHeight: '200px' }} />
      </div>
    );
  }

  return (
    <div className="school-header" style={{ textAlign: 'center', padding: '16px', borderBottom: '2px solid #4f46e5', borderRadius: '12px' }}>
      <div style={{ fontSize: '14px', color: '#5c6178' }}>المملكة العربية السعودية</div>
      <div style={{ fontSize: '14px', color: '#5c6178' }}>وزارة التعليم</div>
      <div style={{ fontSize: '14px', color: '#5c6178' }}>{eduAdmin}</div>
      <div style={{ fontSize: '14px', color: '#5c6178' }}>{eduDept}</div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: '#4f46e5', marginTop: '8px' }}>
        {schoolName}
      </div>
    </div>
  );
};

export default SchoolHeader;
