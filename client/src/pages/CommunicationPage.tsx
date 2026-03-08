import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { communicationApi } from '../api/communication';
import { settingsApi, StageConfigData } from '../api/settings';
import { SETTINGS_STAGES } from '../utils/constants';
import { escapeHtml, buildLetterheadHtml, getSharedPrintCSS, getFormTemplateCSS, toIndic, openPrintWindow, getTodayDates } from '../utils/printUtils';

const MESSAGE_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  'واتساب': { label: 'واتساب', color: '#16a34a', bg: '#dcfce7' },
  'SMS': { label: 'SMS', color: '#2563eb', bg: '#dbeafe' },
  'إيميل': { label: 'إيميل', color: '#7c3aed', bg: '#f5f3ff' },
  'مخالفة': { label: 'مخالفة', color: '#dc2626', bg: '#fee2e2' },
  'ملاحظة': { label: 'ملاحظة', color: '#059669', bg: '#d1fae5' },
  'غياب': { label: 'غياب', color: '#ea580c', bg: '#ffedd5' },
  'تأخر': { label: 'تأخر', color: '#ca8a04', bg: '#fef9c3' },
};

const SEND_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  'تم': { label: 'تم الإرسال', color: '#16a34a', bg: '#dcfce7' },
  'فشل': { label: 'فشل', color: '#dc2626', bg: '#fee2e2' },
  'جاري الإرسال': { label: 'جاري الإرسال', color: '#ca8a04', bg: '#fef9c3' },
};

interface CommRow {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  grade: string;
  className: string;
  stage: string;
  mobile: string;
  messageType: string;
  messageTitle: string;
  messageBody: string;
  sendStatus: string;
  sentBy: string;
  hijriDate: string;
  miladiDate: string;
  time: string;
  notes: string;
}

interface SummaryData {
  total: number;
  sent: number;
  failed: number;
  todayCount: number;
  weekCount: number;
  byType: { type: string; count: number }[];
}

const CommunicationPage: React.FC = () => {
  const [records, setRecords] = useState<CommRow[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('__all__');
  const [typeFilter, setTypeFilter] = useState('__all__');
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<CommRow | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<{ schoolName: string; eduAdmin: string; eduDept: string; letterheadMode: string; letterheadImageUrl: string }>({
    schoolName: '', eduAdmin: '', eduDept: '', letterheadMode: 'Text', letterheadImageUrl: '',
  });

  const enabledStages = useMemo(() =>
    stages.filter((s) => s.isEnabled && s.grades.some((g) => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const stg = stageFilter !== '__all__' ? stageFilter : undefined;
      const [rRes, sRes, sumRes, schRes] = await Promise.all([
        communicationApi.getAll({ stage: stg }),
        settingsApi.getStructure(),
        communicationApi.getSummary(stg),
        settingsApi.getSettings(),
      ]);
      if (rRes.data?.data) setRecords(rRes.data.data);
      if (sRes.data?.data?.stages) setStages(Array.isArray(sRes.data.data.stages) ? sRes.data.data.stages : []);
      if (sumRes.data?.data) setSummary(sumRes.data.data);
      if (schRes.data?.data) setSchoolSettings(schRes.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [stageFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = records;
    if (typeFilter !== '__all__') list = list.filter(r => r.messageType === typeFilter);
    if (statusFilter !== '__all__') list = list.filter(r => r.sendStatus === statusFilter);
    if (dateFrom) list = list.filter(r => r.miladiDate >= dateFrom.replace(/-/g, '/'));
    if (dateTo) list = list.filter(r => r.miladiDate <= dateTo.replace(/-/g, '/'));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => r.studentName.toLowerCase().includes(q) || r.studentNumber.includes(q) || r.mobile.includes(q));
    }
    return list;
  }, [records, typeFilter, statusFilter, dateFrom, dateTo, search]);

  const stageLabel = (id: string) => SETTINGS_STAGES.find(s => s.id === id)?.name || id;

  const clearFilters = () => {
    setTypeFilter('__all__');
    setStatusFilter('__all__');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('هل تريد حذف هذا السجل؟')) return;
    try {
      await communicationApi.delete(id);
      toast.success('تم الحذف');
      loadData();
    } catch { toast.error('فشل الحذف'); }
  };

  const handleResend = async (rec: CommRow) => {
    if (!window.confirm(`هل تريد إعادة إرسال الرسالة إلى ولي أمر ${rec.studentName}؟`)) return;
    toast('جاري إعادة الإرسال...');
    try {
      await communicationApi.log({
        stage: rec.stage,
        studentId: rec.studentId,
        studentNumber: rec.studentNumber,
        studentName: rec.studentName,
        grade: rec.grade,
        className: rec.className,
        phone: rec.mobile,
        messageType: rec.messageType,
        messageTitle: (rec.messageTitle || '') + ' (إعادة إرسال)',
        messageContent: rec.messageBody,
        sender: rec.sentBy,
      });
      toast.success('تم إعادة الإرسال');
      loadData();
    } catch { toast.error('فشل إعادة الإرسال'); }
  };

  const handlePrint = () => {
    if (filtered.length === 0) { toast.error('لا توجد بيانات للطباعة'); return; }
    const { hijri } = getTodayDates();
    const letterheadHtml = buildLetterheadHtml(schoolSettings);
    const stgName = stageFilter !== '__all__' ? stageLabel(stageFilter) : '';

    const rows = filtered.map((rec, i) => {
      const statusColor = (rec.sendStatus || '').includes('تم') ? 'green' : '#999';
      const statusText = (rec.sendStatus || '').includes('تم') ? '✓' : '✗';
      return `<tr>
        <td class="data-cell">${toIndic(i + 1)}</td>
        <td class="data-cell">${escapeHtml(rec.hijriDate)}</td>
        <td class="name-cell">${escapeHtml(rec.studentName)}</td>
        <td class="data-cell">${escapeHtml(rec.grade)}/${escapeHtml(rec.className)}</td>
        <td class="data-cell" style="direction:ltr;font-size:11pt">${escapeHtml(rec.mobile)}</td>
        <td class="data-cell">${escapeHtml(rec.messageType)}</td>
        <td class="data-cell" style="color:${statusColor};font-weight:bold">${statusText}</td>
      </tr>`;
    }).join('');

    const headers = `<th class="col-header" style="width:5%">م</th><th class="col-header" style="width:12%">التاريخ</th><th class="col-header" style="width:24%">اسم الطالب</th><th class="col-header" style="width:10%">الصف</th><th class="col-header" style="width:14%">الجوال</th><th class="col-header" style="width:18%">النوع</th><th class="col-header" style="width:7%">الحالة</th>`;

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
      <title>سجل التواصل</title>
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
      <style>${getSharedPrintCSS()}</style></head><body>
      <table class="main-table"><thead>
        <tr><td colspan="7" class="header-cell">
          ${letterheadHtml}
          <div class="form-title">سجل التواصل مع أولياء الأمور</div>
          ${stgName ? `<div class="form-subtitle">${escapeHtml(stgName)}</div>` : ''}
          <div class="form-date">${hijri} | عدد الرسائل: ${toIndic(filtered.length)}</div>
        </td></tr>
        <tr>${headers}</tr>
      </thead>
      <tbody>${rows}</tbody></table>
      <div class="footer-block"><div class="footer-flex">
        <div>المجموع: ${toIndic(filtered.length)} رسالة</div>
        <div style="text-align:center"><strong>وكيل شؤون الطلاب</strong><br><span class="with-dots"></span></div>
      </div></div></body></html>`;

    openPrintWindow(html);
  };

  const handlePrintSingle = (rec: CommRow) => {
    const { hijri } = getTodayDates();
    const letterheadHtml = buildLetterheadHtml(schoolSettings);

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
      <title>إشعار تواصل</title>
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
      <style>
        @page{size:A4 portrait;margin:1.0cm}
        body{margin:0;padding:0;font-family:"Traditional Arabic","Amiri",serif;font-size:16pt;direction:rtl;background:white;color:#000}
        .page{max-width:210mm;margin:0 auto;padding:1.5cm}
        .form-title{text-align:center;font-size:19pt;font-weight:bold;font-family:"Amiri",serif;margin:5mm 0 8mm}
        .info-table{width:100%;margin-bottom:20px;font-size:14pt}
        .info-table td{padding:8px}
        .info-table .lbl{background:#f5f5f5;font-weight:bold;width:25%;border:1px solid #ddd}
        .info-table .val{border:1px solid #ddd}
        .msg-box{border:1px solid #ccc;padding:15px;border-radius:5px;background:#fafafa;margin-top:15px}
        .msg-title{font-weight:bold;margin-bottom:10px;color:#555;font-size:14pt}
        .msg-body{white-space:pre-wrap;line-height:1.8;font-size:13pt}
        .footer{margin-top:40px;display:flex;justify-content:space-between;font-size:14pt;font-weight:bold}
        .with-dots{border-bottom:1px dotted #999;display:inline-block;min-width:120px;min-height:22px}
      </style></head><body>
      <div class="page">
        ${letterheadHtml}
        <div class="form-title">إشعار تواصل مع ولي الأمر</div>
        <table class="info-table">
          <tr><td class="lbl">اسم الطالب:</td><td class="val">${escapeHtml(rec.studentName)}</td></tr>
          <tr><td class="lbl">الصف:</td><td class="val">${escapeHtml(rec.grade)} / ${escapeHtml(rec.className)}</td></tr>
          <tr><td class="lbl">رقم الجوال:</td><td class="val" style="direction:ltr;text-align:right">${escapeHtml(rec.mobile)}</td></tr>
          <tr><td class="lbl">تاريخ الإرسال:</td><td class="val">${escapeHtml(rec.hijriDate)} - ${escapeHtml(rec.time)}</td></tr>
          <tr><td class="lbl">نوع الرسالة:</td><td class="val">${escapeHtml(rec.messageType)}</td></tr>
          <tr><td class="lbl">حالة الإرسال:</td><td class="val">${escapeHtml(rec.sendStatus)}</td></tr>
        </table>
        <div class="msg-box"><div class="msg-title">نص الرسالة:</div>
          <div class="msg-body">${escapeHtml(rec.messageBody).replace(/\n/g, '<br>')}</div></div>
        <div class="footer">
          <div>وكيل شؤون الطلاب: <span class="with-dots"></span></div>
          <div>التاريخ: ${hijri}</div>
        </div>
      </div></body></html>`;

    openPrintWindow(html);
  };

  const handleExport = async () => {
    toast('جاري تصدير البيانات...');
    try {
      const stg = stageFilter !== '__all__' ? stageFilter : undefined;
      const res = await communicationApi.export({
        stage: stg,
        messageType: typeFilter !== '__all__' ? typeFilter : undefined,
        status: statusFilter !== '__all__' ? statusFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const data = res.data?.data;
      if (!data || data.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }

      const headers = ['التاريخ', 'الوقت', 'الطالب', 'الصف', 'الجوال', 'النوع', 'العنوان', 'الرسالة', 'الحالة', 'المرسل'];
      const csvRows = [headers.join(',')];
      data.forEach((r: any) => {
        csvRows.push([
          r.hijriDate, r.time, r.studentName, r.gradeClass,
          r.mobile, r.messageType, `"${(r.messageTitle || '').replace(/"/g, '""')}"`,
          `"${(r.messageBody || '').replace(/"/g, '""')}"`, r.sendStatus, r.sentBy,
        ].join(','));
      });
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `سجل_التواصل_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم التصدير');
    } catch { toast.error('فشل التصدير'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111', margin: 0 }}>سجل التواصل</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handlePrint} style={toolBtnStyle('#7c3aed', '#f5f3ff')}>طباعة</button>
          <button onClick={handleExport} style={toolBtnStyle('#16a34a', '#dcfce7')}>تصدير Excel</button>
          <button onClick={loadData} style={{
            padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none',
            borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
          }}>تحديث</button>
        </div>
      </div>

      {/* Stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="إجمالي الرسائل" value={summary.total} color="#374151" />
          <StatCard label="تم الإرسال" value={summary.sent} color="#16a34a" />
          <StatCard label="فشل" value={summary.failed} color="#dc2626" />
          <StatCard label="اليوم" value={summary.todayCount} color="#2563eb" />
          <StatCard label="هذا الأسبوع" value={summary.weekCount} color="#7c3aed" />
        </div>
      )}

      {/* Stage filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setStageFilter('__all__')} style={filterBtnStyle(stageFilter === '__all__')}>الكل</button>
        {enabledStages.map(s => (
          <button key={s.stage} onClick={() => setStageFilter(s.stage)} style={filterBtnStyle(stageFilter === s.stage)}>{stageLabel(s.stage)}</button>
        ))}
      </div>

      {/* Filters bar */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
            <option value="__all__">كل الأنواع</option>
            <option value="مخالفة">مخالفة سلوكية</option>
            <option value="ملاحظة">ملاحظة تربوية</option>
            <option value="غياب">غياب</option>
            <option value="تأخر">تأخر</option>
            <option value="واتساب">واتساب</option>
            <option value="SMS">SMS</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="__all__">كل الحالات</option>
            <option value="تم">تم الإرسال</option>
            <option value="فشل">فشل</option>
            <option value="جاري الإرسال">جاري الإرسال</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selectStyle} placeholder="من تاريخ" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={selectStyle} placeholder="إلى تاريخ" />
          <input type="text" placeholder="بحث بالاسم أو الجوال..." value={search} onChange={e => setSearch(e.target.value)} style={selectStyle} />
          <button onClick={clearFilters} style={{
            padding: '8px 16px', background: '#f3f4f6', color: '#6b7280', border: '2px solid #d1d5db',
            borderRadius: '12px', fontSize: '13px', cursor: 'pointer', fontWeight: 600,
          }}>مسح الفلاتر</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>لا توجد سجلات تواصل</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>الطالب</th>
                <th style={thStyle}>الصف</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>العنوان</th>
                <th style={thStyle}>الحالة</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const mt = MESSAGE_TYPES[r.messageType] || { label: r.messageType, color: '#374151', bg: '#f3f4f6' };
                const ss = SEND_STATUS[r.sendStatus] || { label: r.sendStatus, color: '#6b7280', bg: '#f3f4f6' };
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>
                      <div>{r.hijriDate || r.miladiDate || '-'}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{r.time}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', direction: 'ltr' as const }}>{r.mobile}</div>
                    </td>
                    <td style={tdStyle}>{r.grade} / {r.className}</td>
                    <td style={tdStyle}>
                      <span style={{ background: mt.bg, color: mt.color, padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>{mt.label}</span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={r.messageTitle || r.messageBody?.substring(0, 80)}>
                      {r.messageTitle || r.messageBody?.substring(0, 40) || '-'}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ background: ss.bg, color: ss.color, padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>{ss.label}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setSelectedRecord(r)} title="عرض التفاصيل" style={actionBtnStyle('#2563eb', '#dbeafe')}>👁</button>
                      <button onClick={() => handleResend(r)} title="إعادة الإرسال" style={actionBtnStyle('#16a34a', '#dcfce7')}>↻</button>
                      <button onClick={() => handleDelete(r.id)} title="حذف" style={actionBtnStyle('#dc2626', '#fee2e2')}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedRecord && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }} onClick={() => setSelectedRecord(null)}>
          <div style={{
            background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '640px',
            maxHeight: '90vh', overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderRadius: '20px 20px 0 0',
            }}>
              <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '16px', margin: 0 }}>تفاصيل الرسالة</h3>
              <button onClick={() => setSelectedRecord(null)} style={{
                background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer',
              }}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <InfoBox label="الطالب" value={selectedRecord.studentName} />
                <InfoBox label="الصف" value={`${selectedRecord.grade} / ${selectedRecord.className}`} />
                <InfoBox label="التاريخ والوقت" value={`${selectedRecord.hijriDate} - ${selectedRecord.time}`} />
                <InfoBox label="رقم الجوال" value={selectedRecord.mobile} dir="ltr" />
                <InfoBox label="نوع الرسالة" value={selectedRecord.messageType} />
                <InfoBox label="حالة الإرسال" value={selectedRecord.sendStatus}
                  valueColor={(selectedRecord.sendStatus || '').includes('تم') ? '#16a34a' : '#dc2626'} />
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>نص الرسالة</div>
                <div style={{
                  fontSize: '14px', lineHeight: 1.8, whiteSpace: 'pre-wrap',
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px',
                }}>{selectedRecord.messageBody || '-'}</div>
              </div>
              {selectedRecord.sentBy && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
                  المرسل: {selectedRecord.sentBy}
                </div>
              )}
            </div>
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #e5e7eb',
              display: 'flex', gap: '8px', justifyContent: 'flex-end',
            }}>
              <button onClick={() => handlePrintSingle(selectedRecord)} style={toolBtnStyle('#7c3aed', '#f5f3ff')}>طباعة</button>
              <button onClick={() => { handleResend(selectedRecord); setSelectedRecord(null); }} style={toolBtnStyle('#16a34a', '#dcfce7')}>إعادة إرسال</button>
              <button onClick={() => setSelectedRecord(null)} style={{
                padding: '8px 20px', background: '#4b5563', color: '#fff', border: 'none',
                borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
              }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== Sub-components =====

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb' }}>
    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: 800, color }}>{value}</div>
  </div>
);

const InfoBox: React.FC<{ label: string; value: string; dir?: string; valueColor?: string }> = ({ label, value, dir, valueColor }) => (
  <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px' }}>
    <div style={{ fontSize: '11px', color: '#6b7280' }}>{label}</div>
    <div style={{
      fontWeight: 700, color: valueColor || '#111', fontSize: '14px',
      direction: dir as any,
    }}>{value || '-'}</div>
  </div>
);

// ===== Helpers =====

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: '12px', border: active ? '2px solid #374151' : '2px solid #d1d5db',
  background: active ? '#f3f4f6' : '#fff', color: active ? '#111' : '#374151',
  fontWeight: active ? 700 : 400, fontSize: '13px', cursor: 'pointer',
});
const selectStyle: React.CSSProperties = {
  padding: '8px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px',
};
const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '13px', color: '#374151' };
const tdStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'right' };
const toolBtnStyle = (color: string, bg: string): React.CSSProperties => ({
  padding: '8px 16px', background: bg, color, border: 'none', borderRadius: '12px',
  fontWeight: 700, fontSize: '13px', cursor: 'pointer',
});
const actionBtnStyle = (color: string, bg: string): React.CSSProperties => ({
  width: '30px', height: '30px', borderRadius: '6px', border: 'none', background: bg,
  color, cursor: 'pointer', fontSize: '14px', marginInline: '2px',
});

export default CommunicationPage;
