import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { violationsApi } from '../api/violations';
import { positiveBehaviorApi } from '../api/positiveBehavior';
import { studentsApi } from '../api/students';
import { SETTINGS_STAGES } from '../utils/constants';

// ═══════════════════════════════════════════════════════════════
// صفحة سجل السلوك والمخالفات — مطابقة لـ JS_History.html
// ═══════════════════════════════════════════════════════════════

interface ViolRecord {
  id: number; studentId: number; studentNumber: string; studentName: string;
  grade: string; className: string; stage: string;
  violationCode: string; description: string; type: string;
  degree: number; hijriDate: string; miladiDate: string;
  deduction: number; procedures: string;
  recordedBy: string; recordedAt: string; isSent: boolean; notes: string;
}

interface PosRecord {
  id: number; studentId: number; studentNumber: string; studentName: string;
  grade: string; className: string; stage: string;
  behaviorType: string; degree: string; details: string;
  hijriDate: string; recordedBy: string; recordedAt: string; isSent: boolean;
}

interface StudentOption {
  id: number; studentNumber: string; name: string;
  stage: string; grade: string; className: string;
}

const DEGREE_LABELS: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: 'الأولى', color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  2: { label: 'الثانية', color: '#ca8a04', bg: '#fef9c3', border: '#fde68a' },
  3: { label: 'الثالثة', color: '#ea580c', bg: '#ffedd5', border: '#fdba74' },
  4: { label: 'الرابعة', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  5: { label: 'الخامسة', color: '#7c2d12', bg: '#fecaca', border: '#f87171' },
};

const GRADE_ORDER = ['أول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس'];

const sortGrade = (a: string, b: string) => {
  const iA = GRADE_ORDER.findIndex((k) => a.includes(k));
  const iB = GRADE_ORDER.findIndex((k) => b.includes(k));
  return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
};

const toIndic = (n: string | number) =>
  String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

const formatClassShort = (grade: string, cls: string, stage: string) => {
  let g = '';
  if (grade.includes('أول') || grade.includes('اول')) g = '1';
  else if (grade.includes('ثاني')) g = '2';
  else if (grade.includes('ثالث')) g = '3';
  else if (grade.includes('رابع')) g = '4';
  else if (grade.includes('خامس')) g = '5';
  else if (grade.includes('سادس')) g = '6';
  const stageAbbr = stage.includes('متوسط') || stage === 'Intermediate' ? 'م'
    : stage.includes('ثانوي') || stage === 'Secondary' ? 'ث'
    : stage.includes('ابتدائي') || stage === 'Primary' ? 'ب' : '';
  return `${toIndic(g)}/${stageAbbr}/${cls}`;
};

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════
const HistoryPage: React.FC = () => {
  const [violations, setViolations] = useState<ViolRecord[]>([]);
  const [posRecords, setPosRecords] = useState<PosRecord[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [stageFilter, setStageFilter] = useState('__all__');
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, pRes, sRes] = await Promise.all([
        violationsApi.getAll(),
        positiveBehaviorApi.getAll(),
        studentsApi.getAll(),
      ]);
      if (vRes.data?.data) setViolations(vRes.data.data);
      if (pRes.data?.data) setPosRecords(pRes.data.data);
      if (sRes.data?.data) setStudents(sRes.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Stage filtered students
  const stageStudents = useMemo(() => {
    if (stageFilter === '__all__') return students;
    const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
    return students.filter((s) => s.stage === stageId);
  }, [students, stageFilter]);

  // Grades
  const grades = useMemo(() => {
    const set = new Set(stageStudents.map((s) => s.grade));
    return Array.from(set).sort(sortGrade);
  }, [stageStudents]);

  // Classes based on grade
  const classes = useMemo(() => {
    if (!gradeFilter) return [];
    const set = new Set(stageStudents.filter((s) => s.grade === gradeFilter).map((s) => s.className));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'ar', { numeric: true }));
  }, [stageStudents, gradeFilter]);

  // Students in class
  const studentsInClass = useMemo(() => {
    if (!gradeFilter || !classFilter) return [];
    return stageStudents
      .filter((s) => s.grade === gradeFilter && s.className === classFilter)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [stageStudents, gradeFilter, classFilter]);

  // Filtered violations
  const filteredViolations = useMemo(() => {
    let list = violations;
    if (stageFilter !== '__all__') {
      const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
      list = list.filter((v) => v.stage === stageId);
    }
    if (gradeFilter) list = list.filter((v) => v.grade === gradeFilter);
    if (classFilter) list = list.filter((v) => v.className === classFilter);
    if (studentFilter) list = list.filter((v) => String(v.studentId) === studentFilter);
    if (degreeFilter) list = list.filter((v) => String(v.degree) === degreeFilter);

    // Sort: grade → class → name
    return [...list].sort((a, b) => {
      const gDiff = sortGrade(a.grade, b.grade);
      if (gDiff !== 0) return gDiff;
      if (a.className !== b.className) return String(a.className).localeCompare(String(b.className), 'ar');
      return a.studentName.localeCompare(b.studentName, 'ar');
    });
  }, [violations, stageFilter, gradeFilter, classFilter, studentFilter, degreeFilter]);

  // Filtered positive records
  const filteredPositive = useMemo(() => {
    let list = posRecords;
    if (stageFilter !== '__all__') {
      const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
      list = list.filter((r) => r.stage === stageId);
    }
    if (gradeFilter) list = list.filter((r) => r.grade === gradeFilter);
    if (classFilter) list = list.filter((r) => r.className === classFilter);
    if (studentFilter) list = list.filter((r) => String(r.studentId) === studentFilter);
    return list;
  }, [posRecords, stageFilter, gradeFilter, classFilter, studentFilter]);

  // Group by student
  const studentGroups = useMemo(() => {
    const groups = new Map<number, { info: ViolRecord; violations: ViolRecord[]; positive: PosRecord[] }>();
    for (const v of filteredViolations) {
      if (!groups.has(v.studentId)) {
        groups.set(v.studentId, { info: v, violations: [], positive: [] });
      }
      groups.get(v.studentId)!.violations.push(v);
    }
    for (const p of filteredPositive) {
      if (!groups.has(p.studentId)) {
        groups.set(p.studentId, {
          info: { studentId: p.studentId, studentName: p.studentName, grade: p.grade, className: p.className, stage: p.stage } as ViolRecord,
          violations: [], positive: [],
        });
      }
      groups.get(p.studentId)!.positive.push(p);
    }
    return Array.from(groups.values()).sort((a, b) => {
      const gDiff = sortGrade(a.info.grade, b.info.grade);
      if (gDiff !== 0) return gDiff;
      if (a.info.className !== b.info.className) return String(a.info.className).localeCompare(String(b.info.className), 'ar');
      return a.info.studentName.localeCompare(b.info.studentName, 'ar');
    });
  }, [filteredViolations, filteredPositive]);

  const clearFilters = () => {
    setGradeFilter(''); setClassFilter(''); setStudentFilter(''); setDegreeFilter('');
  };

  // ═══ Print (matching JS_History.html printHistoryList) ═══
  const handlePrint = () => {
    if (filteredViolations.length === 0) return;
    const title = `سجل السلوك والمواظبة - ${gradeFilter || 'الكل'} ${classFilter ? '/ ' + classFilter : ''}`;
    const hijriToday = toIndic(new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura'));

    // Group by student for rowspan
    let rows = '';
    let i = 0;
    let counter = 1;
    const sorted = filteredViolations;

    while (i < sorted.length) {
      const rec = sorted[i];
      const normName = rec.studentName.replace(/[أإآ]/g, 'ا').trim();
      let rowspan = 1;
      for (let j = i + 1; j < sorted.length; j++) {
        const nn = sorted[j].studentName.replace(/[أإآ]/g, 'ا').trim();
        if (nn === normName && sorted[j].grade === rec.grade && sorted[j].className === rec.className) rowspan++;
        else break;
      }

      const cls = formatClassShort(rec.grade, rec.className, rec.stage);
      const deg = toIndic(rec.degree);
      const dt = toIndic(rec.hijriDate || '');
      const procs = toIndic(rec.procedures || '').replace(/\n/g, '<br>').replace(/ - /g, '<br>- ');

      rows += `<tr>
        <td rowspan="${rowspan}" style="font-weight:bold">${toIndic(counter)}</td>
        <td rowspan="${rowspan}" style="text-align:right;font-weight:bold">${rec.studentName}</td>
        <td rowspan="${rowspan}">${cls}</td>
        <td style="text-align:right">${rec.description || ''}</td>
        <td>${deg}</td>
        <td style="white-space:nowrap">${dt}</td>
        <td style="text-align:right;font-size:10pt;line-height:1.3">${procs}</td>
      </tr>`;

      for (let k = 1; k < rowspan; k++) {
        const nr = sorted[i + k];
        rows += `<tr>
          <td style="text-align:right">${nr.description || ''}</td>
          <td>${toIndic(nr.degree)}</td>
          <td style="white-space:nowrap">${toIndic(nr.hijriDate || '')}</td>
          <td style="text-align:right;font-size:10pt;line-height:1.3">${toIndic(nr.procedures || '').replace(/\n/g, '<br>')}</td>
        </tr>`;
      }

      i += rowspan;
      counter++;
    }

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><title>سجل السلوك</title>
      <style>@page{size:A4 portrait;margin:10mm}body{font-family:'Traditional Arabic',Tahoma,serif;margin:0;padding:15px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:4px;font-size:12pt;text-align:center;word-wrap:break-word;vertical-align:middle}
      th{background:#f0f0f0;font-weight:bold;font-size:13pt}thead{display:table-header-group}</style></head>
      <body><table>
        <colgroup><col style="width:5%"><col style="width:18%"><col style="width:7%"><col style="width:25%"><col style="width:5%"><col style="width:12%"><col style="width:28%"></colgroup>
        <thead>
          <tr><th colspan="7" style="border:none;padding-bottom:10px;background:none">
            <div style="text-align:center;font-size:18pt;font-weight:bold;margin:5px 0">${title}</div>
            <div style="text-align:center;font-size:12pt">تاريخ الطباعة: ${hijriToday}</div>
          </th></tr>
          <tr><th>م</th><th>اسم الطالب</th><th>الصف</th><th>المخالفة السلوكية</th><th>د</th><th>التاريخ</th><th>الإجراءات المتخذة</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="7" style="border:none;text-align:left;padding-top:30px">
          <div style="display:inline-block;text-align:center;font-size:14pt;font-weight:bold">وكيل شؤون الطلاب<br><br>....................................</div>
        </td></tr></tfoot>
      </table></body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  // ═══ Detail Modal ═══
  const [detailGroup, setDetailGroup] = useState<typeof studentGroups[0] | null>(null);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /><p style={{ color: '#666', marginTop: '16px' }}>جاري تحميل السجل...</p></div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
            <span style={{ fontSize: '24px' }}>📂</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111' }}>سجل السلوك والمخالفات</h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>عرض شامل لمخالفات وسلوكيات الطلاب</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="إجمالي المخالفات" value={filteredViolations.length} color="#dc2626" />
        <StatCard label="طلاب بمخالفات" value={studentGroups.filter((g) => g.violations.length > 0).length} color="#4f46e5" />
        <StatCard label="سلوك إيجابي" value={filteredPositive.length} color="#059669" />
        <StatCard label="درجة ٤-٥" value={filteredViolations.filter((v) => v.degree >= 4).length} color="#ea580c" />
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          {/* Stage */}
          <select value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); clearFilters(); }}
            style={selectStyle}>
            <option value="__all__">كل المراحل</option>
            {SETTINGS_STAGES.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          {/* Grade */}
          <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setClassFilter(''); setStudentFilter(''); }}
            style={selectStyle}>
            <option value="">كل الصفوف</option>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {/* Class */}
          <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setStudentFilter(''); }}
            disabled={!gradeFilter} style={{ ...selectStyle, opacity: gradeFilter ? 1 : 0.5 }}>
            <option value="">كل الفصول</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {/* Student */}
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}
            disabled={!classFilter} style={{ ...selectStyle, opacity: classFilter ? 1 : 0.5 }}>
            <option value="">كل الطلاب</option>
            {studentsInClass.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
          {/* Degree */}
          <select value={degreeFilter} onChange={(e) => setDegreeFilter(e.target.value)} style={selectStyle}>
            <option value="">كل الدرجات</option>
            {[1, 2, 3, 4, 5].map((d) => <option key={d} value={String(d)}>درجة {d}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
          <button onClick={loadData} style={actionBtnStyle('#eef2ff', '#4f46e5')}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>refresh</span> تحديث السجل</button>
          <button onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')} style={actionBtnStyle('#f3f4f6', '#374151')}>
            {viewMode === 'cards' ? '<span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>assignment</span> عرض الجدول' : '🎴 عرض البطاقات'}
          </button>
          <button onClick={handlePrint} style={actionBtnStyle('#f5f3ff', '#7c3aed')}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>print</span> طباعة القائمة</button>
          <button onClick={clearFilters} style={actionBtnStyle('#f3f4f6', '#6b7280')}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>delete</span> مسح الفلاتر</button>
          <span style={{ fontSize: '13px', color: '#6b7280', alignSelf: 'center', marginRight: 'auto' }}>
            {filteredViolations.length} مخالفة | {studentGroups.length} طالب
          </span>
        </div>
      </div>

      {/* Content */}
      {studentGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}>🔍</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد مخالفات مطابقة</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {studentGroups.map((group) => {
            const maxDeg = group.violations.length > 0 ? Math.max(...group.violations.map((v) => v.degree)) : 0;
            const borderColor = maxDeg >= 4 ? '#ef4444' : maxDeg >= 3 ? '#f97316' : maxDeg >= 1 ? '#22c55e' : '#6366f1';
            const totalDeduction = group.violations.reduce((s, v) => s + v.deduction, 0);
            const behaviorScore = Math.max(0, 100 - totalDeduction);

            return (
              <div key={group.info.studentId} style={{
                background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
                borderRight: `4px solid ${borderColor}`, overflow: 'hidden',
              }}>
                {/* Student Header */}
                <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setDetailGroup(group)}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>{group.info.studentName}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{group.info.grade} / {group.info.className}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: behaviorScore >= 80 ? '#059669' : behaviorScore >= 60 ? '#ca8a04' : '#dc2626' }}>
                      {behaviorScore}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ ١٠٠</span>
                    <span style={{ padding: '4px 12px', background: '#fff', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, border: '1px solid #e5e7eb' }}>
                      {group.violations.length} مخالفة
                    </span>
                    {group.positive.length > 0 && (
                      <span style={{ padding: '4px 12px', background: '#d1fae5', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, color: '#059669' }}>
                        {group.positive.length} إيجابي
                      </span>
                    )}
                  </div>
                </div>

                {/* Violations */}
                <div style={{ padding: '12px 16px' }}>
                  {group.violations.map((v) => {
                    const deg = DEGREE_LABELS[v.degree] || DEGREE_LABELS[1];
                    return (
                      <div key={v.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{v.description}</p>
                          {v.procedures && (
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                              {v.procedures.split('\n').join(' • ')}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginRight: '12px' }}>
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{toIndic(v.hijriDate || '')}</span>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: deg.bg, color: deg.color }}>
                            درجة {toIndic(v.degree)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                <tr>
                  <th style={thStyle}>الطالب</th>
                  <th style={thStyle}>الصف</th>
                  <th style={thStyle}>المخالفة</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '60px' }}>الدرجة</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>التاريخ</th>
                  <th style={thStyle}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredViolations.map((v) => {
                  const deg = DEGREE_LABELS[v.degree] || DEGREE_LABELS[1];
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '13px' }}>{v.studentName}</td>
                      <td style={{ padding: '8px 12px', fontSize: '13px', color: '#6b7280' }}>{v.grade} / {v.className}</td>
                      <td style={{ padding: '8px 12px', fontSize: '13px' }}>{v.description}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: deg.bg, color: deg.color }}>{toIndic(v.degree)}</span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>{toIndic(v.hijriDate || '')}</td>
                      <td style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.procedures}>
                        {v.procedures}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDetailGroup(null); }}>
          <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '700px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>📂 {detailGroup.info.studentName}</h3>
                <div style={{ fontSize: '14px', color: '#4338ca', marginTop: '4px' }}>
                  {detailGroup.info.grade} / {detailGroup.info.className} — {detailGroup.violations.length} مخالفة | {detailGroup.positive.length} سلوك إيجابي
                </div>
              </div>
              <button onClick={() => setDetailGroup(null)} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Behavior Score */}
              {(() => {
                const totalDed = detailGroup.violations.reduce((s, v) => s + v.deduction, 0);
                const score = Math.max(0, 100 - totalDed);
                const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#ca8a04' : '#dc2626';
                return (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1, padding: '12px', background: '#fef2f2', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626' }}>{detailGroup.violations.length}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>مخالفات</div>
                    </div>
                    <div style={{ flex: 1, padding: '12px', background: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669' }}>{detailGroup.positive.length}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>سلوك إيجابي</div>
                    </div>
                    <div style={{ flex: 1, padding: '12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: scoreColor }}>{score}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>درجة السلوك</div>
                    </div>
                  </div>
                );
              })()}

              {/* Violations List */}
              {detailGroup.violations.length > 0 && (
                <>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle',color:'#dc2626'}}>gavel</span> المخالفات</h4>
                  {detailGroup.violations.map((v) => {
                    const deg = DEGREE_LABELS[v.degree] || DEGREE_LABELS[1];
                    return (
                      <div key={v.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '8px', borderRight: `3px solid ${deg.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px' }}>{v.description}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{toIndic(v.hijriDate || '')}</span>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: deg.bg, color: deg.color }}>
                              درجة {toIndic(v.degree)}
                            </span>
                          </div>
                        </div>
                        {v.procedures && <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{v.procedures}</p>}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Positive Behaviors */}
              {detailGroup.positive.length > 0 && (
                <>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#059669', margin: '16px 0 8px' }}>⭐ السلوك الإيجابي</h4>
                  {detailGroup.positive.map((p) => (
                    <div key={p.id} style={{ border: '1px solid #d1fae5', borderRadius: '8px', padding: '12px', marginBottom: '8px', borderRight: '3px solid #059669' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{p.behaviorType}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{p.hijriDate}</span>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>
                            {p.degree}
                          </span>
                        </div>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>المعلم: {p.recordedBy}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══ Shared Components ═══
const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
    <span style={{ fontSize: '24px', fontWeight: 800, color }}>{value}</span>
    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
  </div>
);

const selectStyle: React.CSSProperties = {
  height: '40px', padding: '0 12px', border: '2px solid #d1d5db',
  borderRadius: '12px', fontSize: '14px', background: '#fff',
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'right', fontWeight: 700,
  color: '#4b5563', fontSize: '13px', borderBottom: '2px solid #e5e7eb',
};

const actionBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '8px 16px', background: bg, color, borderRadius: '8px',
  border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px',
});

export default HistoryPage;
