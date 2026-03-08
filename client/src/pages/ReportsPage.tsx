import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { violationsApi } from '../api/violations';
import { settingsApi, StageConfigData } from '../api/settings';
import { SETTINGS_STAGES } from '../utils/constants';

const DEGREE_COLORS: Record<number, string> = {
  1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#7c2d12',
};
const DEGREE_LABELS: Record<number, string> = {
  1: 'الأولى', 2: 'الثانية', 3: 'الثالثة', 4: 'الرابعة', 5: 'الخامسة',
};

interface ReportData {
  total: number;
  totalDeduction: number;
  topStudents: { studentId: number; studentName: string; grade: string; className: string; count: number; totalDeduction: number; behaviorScore: number }[];
  byClass: { grade: string; className: string; count: number }[];
  byDegree: { degree: number; count: number; deduction: number }[];
  byDate: { date: string; count: number }[];
  byDescription: { description: string; count: number }[];
}

const ReportsPage: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('__all__');
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const enabledStages = useMemo(() =>
    stages.filter(s => s.isEnabled && s.grades.some(g => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const stage = stageFilter !== '__all__' ? stageFilter : undefined;
      const [rRes, sRes] = await Promise.all([
        violationsApi.getReport(stage, gradeFilter || undefined, classFilter || undefined, dateFrom || undefined, dateTo || undefined),
        settingsApi.getStructure(),
      ]);
      if (rRes.data?.data) setData(rRes.data.data);
      if (sRes.data?.data?.stages) setStages(Array.isArray(sRes.data.data.stages) ? sRes.data.data.stages : []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [stageFilter, gradeFilter, classFilter]);

  // Extract unique grades/classes from byClass data for filters
  const grades = useMemo(() => data ? Array.from(new Set(data.byClass.map(c => c.grade))).sort() : [], [data]);
  const classes = useMemo(() => data ? Array.from(new Set(data.byClass.filter(c => !gradeFilter || c.grade === gradeFilter).map(c => c.className))).sort() : [], [data, gradeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const uniqueStudents = useMemo(() => data?.topStudents?.length || 0, [data]);
  const highRisk = useMemo(() =>
    data?.byDegree?.filter(d => d.degree >= 4).reduce((sum, d) => sum + d.count, 0) || 0,
    [data]
  );

  const maxDegreeCount = useMemo(() =>
    Math.max(1, ...(data?.byDegree?.map(d => d.count) || [1])),
    [data]
  );
  const maxClassCount = useMemo(() =>
    Math.max(1, ...(data?.byClass?.slice(0, 10).map(c => c.count) || [1])),
    [data]
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>التقارير والإحصائيات</h1>
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={stageFilter} onChange={e => { setStageFilter(e.target.value); setGradeFilter(''); setClassFilter(''); }}
          style={{ padding: '8px 16px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minWidth: '160px' }}>
          <option value="__all__">جميع المراحل</option>
          {enabledStages.map(s => {
            const label = SETTINGS_STAGES.find(ss => ss.id === s.stage)?.name || s.stage;
            return <option key={s.stage} value={s.stage}>{label}</option>;
          })}
        </select>
        <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setClassFilter(''); }}
          style={{ padding: '8px 12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الصفوف</option>
          {grades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الفصول</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          placeholder="من تاريخ" style={{ padding: '8px 12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          placeholder="إلى تاريخ" style={{ padding: '8px 12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
        <button onClick={loadData} style={{
          padding: '8px 20px', background: '#6366f1', color: '#fff', border: 'none',
          borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>تحديث</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>لا توجد بيانات</div>
      ) : (
        <>
          {/* بطاقات الإحصائيات */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <StatCard label="إجمالي المخالفات" value={data.total} color="#6366f1" />
            <StatCard label="طلاب مخالفون" value={uniqueStudents} color="#0ea5e9" />
            <StatCard label="مخالفات عالية الخطورة" value={highRisk} color="#ef4444" subtitle="(درجة ٤-٥)" />
            <StatCard label="إجمالي الحسم" value={data.totalDeduction} color="#f59e0b" suffix=" درجة" />
          </div>

          {/* الرسوم البيانية */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* توزيع المخالفات حسب الدرجة */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>توزيع المخالفات حسب الدرجة</h3>
              {data.byDegree.map(d => (
                <div key={d.degree} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>الدرجة {DEGREE_LABELS[d.degree]}</span>
                    <span style={{ color: '#6b7280' }}>{d.count} مخالفة ({data.total > 0 ? Math.round(d.count / data.total * 100) : 0}%)</span>
                  </div>
                  <div style={{ height: '24px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${(d.count / maxDegreeCount) * 100}%`,
                      background: DEGREE_COLORS[d.degree], borderRadius: '6px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
              {/* حلقة بصرية */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <div style={{ width: '160px', height: '160px', borderRadius: '50%', position: 'relative',
                  background: data.total > 0 ? generateConicGradient(data.byDegree, data.total) : '#f3f4f6',
                }}>
                  <div style={{
                    position: 'absolute', top: '25%', left: '25%', width: '50%', height: '50%',
                    borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#374151',
                  }}>{data.total}</div>
                </div>
              </div>
            </div>

            {/* مقارنة الفصول */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>المخالفات حسب الفصل (أعلى ١٠)</h3>
              {data.byClass.slice(0, 10).map((c, i) => (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 600 }}>{c.grade} / {c.className}</span>
                    <span style={{ color: '#6b7280' }}>{c.count}</span>
                  </div>
                  <div style={{ height: '20px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${(c.count / maxClassCount) * 100}%`,
                      background: `hsl(${220 + i * 15}, 70%, 55%)`, borderRadius: '5px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* أكثر 5 مخالفات شيوعاً */}
          {data.byDescription && data.byDescription.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>أكثر المخالفات شيوعاً (أعلى ٥)</h3>
              {data.byDescription.map((d, i) => {
                const maxDesc = Math.max(1, ...data.byDescription.map(x => x.count));
                return (
                  <div key={i} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 600, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</span>
                      <span style={{ color: '#6b7280' }}>{d.count}</span>
                    </div>
                    <div style={{ height: '20px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${(d.count / maxDesc) * 100}%`,
                        background: `hsl(${340 + i * 25}, 65%, 50%)`, borderRadius: '5px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* أكثر الطلاب مخالفات */}
          <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>أكثر الطلاب مخالفات (أعلى ١٠)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '10px', textAlign: 'right' }}>م</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>الطالب</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>الصف</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>المخالفات</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>الحسم</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>درجة السلوك</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topStudents.map((s, i) => (
                    <tr key={s.studentId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px' }}>{i + 1}</td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{s.studentName}</td>
                      <td style={{ padding: '10px' }}>{s.grade} / {s.className}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 10px', borderRadius: '100px', fontWeight: 600 }}>{s.count}</span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{s.totalDeduction}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: '100px', fontWeight: 600,
                          background: s.behaviorScore >= 70 ? '#dcfce7' : s.behaviorScore >= 40 ? '#fef9c3' : '#fee2e2',
                          color: s.behaviorScore >= 70 ? '#15803d' : s.behaviorScore >= 40 ? '#ca8a04' : '#dc2626',
                        }}>{s.behaviorScore}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ===== بطاقة إحصائية =====
function StatCard({ label, value, color, subtitle, suffix }: {
  label: string; value: number; color: string; subtitle?: string; suffix?: string;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>{value}{suffix || ''}</div>
      {subtitle && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{subtitle}</div>}
    </div>
  );
}

// ===== توليد تدرج دائري للحلقة =====
function generateConicGradient(byDegree: { degree: number; count: number }[], total: number): string {
  if (total === 0) return '#f3f4f6';
  let cumPct = 0;
  const stops: string[] = [];
  byDegree.forEach(d => {
    if (d.count === 0) return;
    const pct = (d.count / total) * 100;
    stops.push(`${DEGREE_COLORS[d.degree]} ${cumPct}% ${cumPct + pct}%`);
    cumPct += pct;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export default ReportsPage;
