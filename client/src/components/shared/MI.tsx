import React from 'react';

/**
 * MI — Material Icon inline helper
 * مساعد لاستبدال emoji بـ Material Symbols في الأزرار والنصوص
 * Usage: <MI n="print" /> بدل 🖨️
 */
const MI: React.FC<{ n: string; s?: number; c?: string; }> = ({ n, s = 16, c }) => (
  <span className="material-symbols-outlined" style={{ fontSize: s, verticalAlign: 'middle', color: c }}>{n}</span>
);

export default MI;
