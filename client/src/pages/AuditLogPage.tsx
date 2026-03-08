import { useState, useEffect, useCallback, useMemo } from 'react';
import { violationsApi } from '../api/violations';
import { studentsApi } from '../api/students';

interface ViolationRecord {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  grade: string;
  className: string;
  stage: string;
  violationCode: string;
  description: string;
  type: string;
  degree: number;
  hijriDate: string;
  miladiDate: string;
  deduction: number;
  procedures: string;
  forms: string;
  dayName: string;
  recordedBy: string;
  recordedAt: string;
  isSent: boolean;
  notes: string;
}

interface StudentInfo {
  id: number;
  studentNumber: string;
  name: string;
  stage: string;
  grade: string;
  className: string;
}

type ViewMode = 'cards' | 'table';

const DEGREE_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#dcfce7', text: '#166534' },
  2: { bg: '#dbeafe', text: '#1e40af' },
  3: { bg: '#fef3c7', text: '#92400e' },
  4: { bg: '#ffedd5', text: '#9a3412' },
  5: { bg: '#fee2e2', text: '#991b1b' },
};

const GRADE_ORDER = ['أول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس'];

function getGradeWeight(name: string): number {
  const idx = GRADE_ORDER.findIndex(k => name.includes(k));
  return idx >= 0 ? idx : 99;
}

function toIndic(str: string | number): string {
  return String(str).replace(/\d/g, d => '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'[parseInt(d)]);
}

function escapeHtml(s: string): string {
  const el = document.createElement('div');
  el.textContent = s;
  return el.innerHTML;
}

const AuditLogPage: React.FC = () => {
  const [records, setRecords] = useState<ViolationRecord[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  // Filters
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sel = document.getElementById('stage-selector') as HTMLSelectElement | null;
      const currentStage = sel?.value || undefined;
      const [vRes, sRes] = await Promise.all([
        violationsApi.getAll({ stage: currentStage }),
        studentsApi.getAll(currentStage),
      ]);
      setRecords(vRes.data?.data || []);
      setStudents(sRes.data?.data || []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived filter options
  const grades = useMemo(() => {
    const set = new Set(students.map(s => s.grade));
    return Array.from(set).sort((a, b) => getGradeWeight(a) - getGradeWeight(b));
  }, [students]);

  const classOptions = useMemo(() => {
    if (!gradeFilter) return [];
    const set = new Set(students.filter(s => s.grade === gradeFilter).map(s => s.className));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [students, gradeFilter]);

  const studentOptions = useMemo(() => {
    if (!gradeFilter || !classFilter) return [];
    return students
      .filter(s => s.grade === gradeFilter && s.className === classFilter)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [students, gradeFilter, classFilter]);

  // Filtered & sorted records
  const filtered = useMemo(() => {
    let result = records.filter(r => {
      if (gradeFilter && r.grade !== gradeFilter) return false;
      if (classFilter && r.className !== classFilter) return false;
      if (studentFilter && String(r.studentId) !== studentFilter) return false;
      if (degreeFilter && String(r.degree) !== degreeFilter) return false;
      return true;
    });
    result.sort((a, b) => {
      const wA = getGradeWeight(a.grade), wB = getGradeWeight(b.grade);
      if (wA !== wB) return wA - wB;
      if (a.grade === b.grade && a.className !== b.className) return a.className.localeCompare(b.className, 'ar');
      return a.studentName.localeCompare(b.studentName, 'ar');
    });
    return result;
  }, [records, gradeFilter, classFilter, studentFilter, degreeFilter]);

  // Group by student for cards view
  const grouped = useMemo(() => {
    const map = new Map<string, { info: ViolationRecord; violations: ViolationRecord[] }>();
    const order: string[] = [];
    filtered.forEach(r => {
      const key = `${r.studentId}-${r.grade}-${r.className}`;
      if (!map.has(key)) {
        map.set(key, { info: r, violations: [] });
        order.push(key);
      }
      map.get(key)!.violations.push(r);
    });
    return order.map(k => map.get(k)!);
  }, [filtered]);

  const handleGradeChange = (v: string) => {
    setGradeFilter(v);
    setClassFilter('');
    setStudentFilter('');
  };

  const handleClassChange = (v: string) => {
    setClassFilter(v);
    setStudentFilter('');
  };

  const clearFilters = () => {
    setGradeFilter('');
    setClassFilter('');
    setStudentFilter('');
    setDegreeFilter('');
  };

  const toggleView = () => {
    setViewMode(prev => prev === 'cards' ? 'table' : 'cards');
  };

  const printList = () => {
    const title = `سجل السلوك والمواظبة - ${gradeFilter || 'الكل'} ${classFilter ? '/ ' + classFilter : ''}`;
    let rows = '';
    let i = 0, counter = 1;
    while (i < filtered.length) {
      const rec = filtered[i];
      let rowspan = 1;
      for (let j = i + 1; j < filtered.length; j++) {
        if (filtered[j].studentName === rec.studentName && filtered[j].grade === rec.grade && filtered[j].className === rec.className) rowspan++;
        else break;
      }
      const procHtml = rec.procedures ? toIndic(rec.procedures).replace(/\n/g, '<br>').replace(/ - /g, '<br>- ') : '';
      rows += `<tr>
        <td rowspan="${rowspan}" style="font-weight:bold">${toIndic(counter)}</td>
        <td rowspan="${rowspan}" style="text-align:right;font-weight:bold">${escapeHtml(rec.studentName)}</td>
        <td rowspan="${rowspan}">${escapeHtml(rec.grade)}/${escapeHtml(rec.className)}</td>
        <td style="text-align:right">${escapeHtml(rec.description || '')}</td>
        <td>${toIndic(rec.degree)}</td>
        <td style="white-space:nowrap">${toIndic(rec.hijriDate || '')}</td>
        <td style="text-align:right;font-size:10pt;line-height:1.3">${procHtml}</td>
      </tr>`;
      for (let k = 1; k < rowspan; k++) {
        const nr = filtered[i + k];
        const np = nr.procedures ? toIndic(nr.procedures).replace(/\n/g, '<br>').replace(/ - /g, '<br>- ') : '';
        rows += `<tr>
          <td style="text-align:right">${escapeHtml(nr.description || '')}</td>
          <td>${toIndic(nr.degree)}</td>
          <td style="white-space:nowrap">${toIndic(nr.hijriDate || '')}</td>
          <td style="text-align:right;font-size:10pt;line-height:1.3">${np}</td>
        </tr>`;
      }
      i += rowspan;
      counter++;
    }
    const printDate = toIndic(new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura'));
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><title>سجل السلوك</title>
    <style>@page{size:A4 portrait;margin:10mm}body{font-family:'Traditional Arabic',serif;margin:0;padding:0}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid #000;padding:4px;font-size:12pt;text-align:center;word-wrap:break-word;vertical-align:middle}
    th{background:#f0f0f0;font-weight:bold;font-size:13pt}thead{display:table-header-group}</style></head>
    <body><table>
    <colgroup><col style="width:5%"><col style="width:18%"><col style="width:7%"><col style="width:25%"><col style="width:5%"><col style="width:12%"><col style="width:28%"></colgroup>
    <thead><tr><th colspan="7" style="border:none;padding-bottom:10px;background:none">
    <div style="text-align:center;font-size:18pt;font-weight:bold;margin:5px 0">${title}</div>
    <div style="text-align:center;font-size:12pt">تاريخ الطباعة: ${printDate}</div>
    </th></tr><tr><th>م</th><th>اسم الطالب</th><th>الصف</th><th>المخالفة السلوكية</th><th>د</th><th>التاريخ</th><th>الإجراءات المتخذة</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="7" style="border:none;height:50px"></td></tr>
    <tr><td colspan="7" style="border:none;text-align:left;padding-top:20px;padding-left:30px">
    <div style="display:inline-block;text-align:center;font-size:14pt;font-weight:bold">وكيل شؤون الطلاب<br><br>....................................</div>
    </td></tr></tfoot></table></body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  };

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0 }}>
          سجل السلوك والمخالفات
        </h2>
      </div>

      {/* Filter panel */}
      <div style={S.filterPanel}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <select value={gradeFilter} onChange={e => handleGradeChange(e.target.value)} style={S.filterSel}>
            <option value="">كل الصفوف</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={classFilter} onChange={e => handleClassChange(e.target.value)} style={S.filterSel} disabled={!gradeFilter}>
            <option value="">كل الفصول</option>
            {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)} style={{ ...S.filterSel, gridColumn: 'span 2' }} disabled={!classFilter}>
            <option value="">{classFilter ? 'كل الطلاب' : 'اختر الصف والفصل أولاً'}</option>
            {studentOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={degreeFilter} onChange={e => setDegreeFilter(e.target.value)} style={S.filterSel}>
            <option value="">كل الدرجات</option>
            {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>درجة {d}</option>)}
          </select>
          <button onClick={clearFilters} style={S.clearBtn}>مسح الفلاتر</button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
          <button onClick={loadData} style={S.actionBtnRefresh}>
            تحديث السجل
          </button>
          <button onClick={toggleView} style={S.actionBtnToggle}>
            {viewMode === 'cards' ? 'عرض الجدول' : 'عرض البطاقات'}
          </button>
          <button onClick={printList} style={S.actionBtnPrint}>
            طباعة القائمة
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {loading ? (
          <div style={S.emptyState}>جاري تحميل السجل...</div>
        ) : filtered.length === 0 ? (
          <div style={S.emptyState}>لا توجد مخالفات مطابقة</div>
        ) : viewMode === 'cards' ? (
          /* Cards view — grouped by student */
          <div style={{ display: 'grid', gap: '16px' }}>
            {grouped.map((group, gi) => {
              const maxDeg = Math.max(...group.violations.map(v => v.degree));
              const borderColor = maxDeg >= 4 ? '#ef4444' : maxDeg === 3 ? '#f97316' : '#22c55e';
              return (
                <div key={gi} style={{
                  background: '#fff', borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,.05)',
                  border: '1px solid #f3f4f6', overflow: 'hidden',
                  borderLeft: `4px solid ${borderColor}`,
                }}>
                  {/* Student header */}
                  <div style={{
                    padding: '12px 20px', background: '#f9fafb',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <h3 style={{ fontWeight: 700, color: '#1f2937', margin: 0, fontSize: '15px' }}>
                        {group.info.studentName}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                        {group.info.grade} / {group.info.className}
                      </p>
                    </div>
                    <span style={{
                      background: '#fff', padding: '2px 8px', borderRadius: '4px',
                      fontSize: '12px', fontWeight: 700, border: '1px solid #e5e7eb',
                    }}>
                      {group.violations.length} مخالفات
                    </span>
                  </div>
                  {/* Violations */}
                  <div style={{ padding: '16px 20px' }}>
                    {group.violations.map((v, vi) => {
                      const dc = DEGREE_COLORS[v.degree] || DEGREE_COLORS[1];
                      return (
                        <div key={vi} style={{
                          borderBottom: vi < group.violations.length - 1 ? '1px solid #f3f4f6' : 'none',
                          paddingBottom: '12px', marginBottom: vi < group.violations.length - 1 ? '12px' : 0,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                            <p style={{ fontWeight: 500, fontSize: '14px', color: '#1f2937', margin: 0, flex: 1 }}>
                              {v.description}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginRight: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{toIndic(v.hijriDate || '')}</span>
                              <span style={{
                                padding: '2px 8px', borderRadius: '4px',
                                fontSize: '10px', fontWeight: 700,
                                background: dc.bg, color: dc.text,
                              }}>
                                درجة {toIndic(v.degree)}
                              </span>
                            </div>
                          </div>
                          {/* Print buttons per violation */}
                          {v.degree >= 2 && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                              {v.degree >= 2 && (
                                <button style={S.vpBtn('#4f46e5')}>طباعة تعهد</button>
                              )}
                              {v.degree >= 3 && (
                                <button style={S.vpBtn('#2563eb')}>طباعة إشعار</button>
                              )}
                              {v.degree >= 4 && (
                                <button style={S.vpBtn('#be123c')}>طباعة محضر لجنة</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table view */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={S.th}>الطالب</th>
                  <th style={S.th}>الصف</th>
                  <th style={S.th}>المخالفة</th>
                  <th style={{ ...S.th, textAlign: 'center' }}>الدرجة</th>
                  <th style={{ ...S.th, textAlign: 'center' }}>التاريخ</th>
                  <th style={S.th}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const dc = DEGREE_COLORS[r.degree] || DEGREE_COLORS[1];
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ ...S.td, fontWeight: 700, color: '#111827' }}>{r.studentName}</td>
                      <td style={{ ...S.td, color: '#6b7280' }}>{r.grade} / {r.className}</td>
                      <td style={{ ...S.td, color: '#111827' }}>{r.description}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px',
                          fontSize: '12px', fontWeight: 700,
                          background: dc.bg, color: dc.text,
                        }}>
                          {toIndic(r.degree)}
                        </span>
                      </td>
                      <td style={{ ...S.td, textAlign: 'center', color: '#6b7280' }}>{toIndic(r.hijriDate || '')}</td>
                      <td style={{ ...S.td, color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.procedures}>
                        {r.procedures}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const S: Record<string, any> = {
  filterPanel: {
    background: '#fff', borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,.05)',
    border: '1px solid #e5e7eb', padding: '20px',
    marginBottom: '20px',
  },
  filterSel: {
    padding: '8px 12px', border: '2px solid #d1d5db',
    borderRadius: '8px', fontSize: '14px', height: '40px', width: '100%',
  },
  clearBtn: {
    padding: '8px 12px', background: '#f3f4f6', color: '#4b5563',
    border: 'none', borderRadius: '8px', fontSize: '14px',
    fontWeight: 700, cursor: 'pointer', height: '40px', width: '100%',
  },
  actionBtnRefresh: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', background: '#eef2ff', color: '#4338ca',
    borderRadius: '8px', fontSize: '14px', fontWeight: 500,
    cursor: 'pointer', border: 'none',
  },
  actionBtnToggle: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', background: '#fff', color: '#374151',
    borderRadius: '8px', fontSize: '14px', fontWeight: 500,
    cursor: 'pointer', border: '2px solid #d1d5db',
  },
  actionBtnPrint: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', background: '#faf5ff', color: '#7c3aed',
    borderRadius: '8px', fontSize: '14px', fontWeight: 500,
    cursor: 'pointer', border: 'none',
  },
  vpBtn: (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '4px 8px', background: '#f9fafb', borderRadius: '4px',
    border: '1px solid #e5e7eb', fontSize: '12px', color,
    cursor: 'pointer', fontWeight: 500,
  }),
  th: {
    padding: '12px 16px', textAlign: 'right' as const, fontSize: '12px',
    fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' as const,
  },
  td: {
    padding: '12px 16px', fontSize: '14px',
  },
  emptyState: {
    textAlign: 'center' as const, padding: '64px 20px',
    background: '#fff', borderRadius: '12px',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.05)',
    color: '#6b7280', fontSize: '15px',
  },
};

export default AuditLogPage;
