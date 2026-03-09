import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MI from '../components/shared/MI';
import { academicApi, AcademicStudentData, AcademicSubjectData } from '../api/academic';
import { settingsApi, StageConfigData } from '../api/settings';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  BarElement, RadialLinearScale, PointElement, LineElement, Filler,
} from 'chart.js';
import { Doughnut, Bar, Radar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  BarElement, RadialLinearScale, PointElement, LineElement, Filler,
);

// ── Types ──
interface PeriodInfo { semester: string; period: string; count?: number }
interface SummaryRow {
  id: number; identityNo: string; studentName: string; grade: string; classNum: string;
  semester: string; period: string; average: number | null; generalGrade: string;
  rankGrade: string; rankClass: string; absence: number; tardiness: number;
  behaviorExcellent: string; behaviorPositive: string;
}
interface GradeRow {
  id: number; identityNo: string; studentName: string; grade: string; classNum: string;
  semester: string; period: string; subject: string; total: number; finalExam: number;
  evalTools: number; shortTests: number; gradeLabel: string;
}
interface StatsData {
  totalStudents: number; avgAll: number; maxAvg: number; minAvg: number;
  gradeDist: Record<string, number>;
  categories: { excellent: number; good: number; average: number; weak: number; danger: number };
  subjects: { name: string; avg: number; max: number; min: number; count: number; above90: number; below60: number; below50: number }[];
  topTen: SummaryRow[]; bottomTen: SummaryRow[];
  classSummary: { label: string; grade: string; classNum: string; count: number; avg: number; max: number; min: number; excellent: number; weak: number }[];
  dangerStudents: { identity: string; name: string; weakSubjects: string[]; weakCount: number }[];
  absence: { total: number; tardiness: number; studentsWithAbsence: number };
  periods: PeriodInfo[];
}
interface StudentReport {
  student: { name: string; identity: string; grade: string; classNum: string };
  summary: SummaryRow[]; grades: GradeRow[];
  analysis: {
    strengths: string[]; weaknesses: string[]; weaknessPattern: string;
    academicGrades: { name: string; total: number; grade: string }[];
    examVsWork: { name: string; finalExam: number; classWork: number }[];
    absence: number; tardiness: number; behaviorExcellent: string; behaviorPositive: string;
  };
}
interface ClassCompItem { subject: string; classes: { classLabel: string; avg: number; count: number; above90: number; below60: number }[] }

const PERIOD_OPTIONS = ['الفترة الاولى', 'الفترة الثانية', 'نهاية الفصل'];
const NON_ACADEMIC = ['السلوك', 'المواظبة', 'النشاط'];

const AcademicPage: React.FC = () => {
  // ── State ──
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [currentStage, setCurrentStage] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'reports' | 'charts'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPeriod, setImportPeriod] = useState('نهاية الفصل');
  const [importStatus, setImportStatus] = useState<{ type: string; msg: string } | null>(null);
  const [importing, setImporting] = useState(false);
  // Reports state
  const [filterName, setFilterName] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterAvgAbove, setFilterAvgAbove] = useState('');
  const [filterAvgBelow, setFilterAvgBelow] = useState('');
  const [filterGeneralGrade, setFilterGeneralGrade] = useState('');
  const [sortBy, setSortBy] = useState('avg_desc');
  // Student report
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  // Subject report
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [subjectReportData, setSubjectReportData] = useState<GradeRow[] | null>(null);
  // Class comparison
  const [classComparison, setClassComparison] = useState<ClassCompItem[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabledStages = useMemo(() =>
    stages.filter(s => s.isEnabled && s.grades.some(g => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  // ── Load stages ──
  useEffect(() => {
    settingsApi.getStructure().then(res => {
      if (res.data?.data?.stages) {
        const st = Array.isArray(res.data.data.stages) ? res.data.data.stages : [];
        setStages(st);
        const enabled = st.filter((s: StageConfigData) => s.isEnabled && s.grades.some((g: { isEnabled: boolean; classCount: number }) => g.isEnabled && g.classCount > 0));
        if (enabled.length > 0) setCurrentStage(enabled[0].stage);
      }
    });
  }, []);

  // ── Load data ──
  const loadData = useCallback(async () => {
    if (!currentStage) return;
    setLoading(true);
    setStudentReport(null);
    setSubjectReportData(null);
    setClassComparison(null);
    try {
      const res = await academicApi.getAll(currentStage);
      const d = res.data?.data;
      if (d) {
        setSummary(d.summary || []);
        setGrades(d.grades || []);
        setPeriods(d.periods || []);
        if (d.summary?.length > 0) {
          const lp = d.periods?.length > 0 ? d.periods[d.periods.length - 1] : null;
          const sRes = await academicApi.getStats(currentStage, lp?.semester, lp?.period);
          if (sRes.data?.data) setStats(sRes.data.data);
        } else {
          setStats(null);
          setImportOpen(true);
        }
      }
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [currentStage]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Header stats ──
  const headerStats = useMemo(() => {
    let ls = summary;
    if (periods.length > 0) {
      const lp = periods[periods.length - 1];
      ls = summary.filter(r => r.semester === lp.semester && r.period === lp.period);
    }
    const avgs = ls.map(r => r.average).filter((a): a is number => a !== null && a > 0);
    const avgAll = avgs.length > 0 ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : '-';
    return { students: ls.length, periods: periods.length, avg: avgAll };
  }, [summary, periods]);

  // ── Excel import ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus({ type: 'info', msg: 'جاري قراءة الملف...' });
    const t0 = Date.now();

    try {
      const data = await file.arrayBuffer();
      setImportStatus({ type: 'info', msg: 'جاري تحليل الشهادات...' });
      const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
      const parseTime = ((Date.now() - t0) / 1000).toFixed(1);

      const students: AcademicStudentData[] = [];
      let detectedSemester = '';

      for (let i = 0; i < wb.SheetNames.length; i++) {
        try {
          const ws = wb.Sheets[wb.SheetNames[i]];
          const arr = sheetTo2DArray(ws);
          if (!arr || arr.length < 30) continue;
          const st = parseStudentFromArray(arr, detectedSemester);
          if (!st) continue;
          if (!detectedSemester && st.semester) detectedSemester = st.semester;
          if (!st.semester) st.semester = detectedSemester || 'غير محدد';
          students.push(st);
        } catch { /* skip sheet */ }
      }

      if (students.length === 0) {
        setImportStatus({ type: 'error', msg: `لم يتم العثور على بيانات طلاب (تم فحص ${wb.SheetNames.length} شيت)` });
        setImporting(false);
        return;
      }

      setImportStatus({ type: 'info', msg: `تم تحليل ${students.length} طالب في ${parseTime} ثانية - جاري الحفظ...` });

      const res = await academicApi.import({ stage: currentStage, period: importPeriod, students });
      const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
      if (res.data?.data) {
        const r = res.data.data;
        setImportStatus({ type: 'success', msg: `تم استيراد ${r.imported} طالب في ${totalTime} ثانية (${detectedSemester || 'غير محدد'} - ${importPeriod})` });
        showSuccess('تم الاستيراد بنجاح');
        loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
      setImportStatus({ type: 'error', msg });
      showError('فشل الاستيراد');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [currentStage, importPeriod, loadData]);

  // ── Student report ──
  const showStudentReport = useCallback(async (identityNo: string) => {
    setReportLoading(true);
    try {
      const res = await academicApi.getStudentReport(identityNo, currentStage);
      if (res.data?.data) setStudentReport(res.data.data);
      else showError('لم يتم العثور على الطالب');
    } catch { showError('خطأ في تحميل التقرير'); }
    finally { setReportLoading(false); }
  }, [currentStage]);

  // ── Delete period ──
  const deletePeriod = useCallback(async (semester: string, period: string) => {
    if (!window.confirm(`هل تريد حذف بيانات ${period} — ${semester}؟`)) return;
    try {
      await academicApi.deletePeriod(currentStage, semester, period);
      showSuccess('تم الحذف');
      loadData();
    } catch { showError('فشل الحذف'); }
  }, [currentStage, loadData]);

  // ── Class comparison ──
  const loadClassComparison = useCallback(async () => {
    const lp = periods.length > 0 ? periods[periods.length - 1] : null;
    try {
      const res = await academicApi.getClassComparison(currentStage, lp?.semester, lp?.period);
      if (res.data?.data) setClassComparison(res.data.data);
    } catch { showError('خطأ'); }
  }, [currentStage, periods]);

  // ── Filtered reports ──
  const filteredStudents = useMemo(() => {
    let res = [...summary];
    if (filterName) res = res.filter(r => r.studentName.includes(filterName));
    if (filterGrade) res = res.filter(r => r.grade === filterGrade);
    if (filterClass) res = res.filter(r => String(r.classNum) === filterClass);
    if (filterPeriod) {
      const [sem, per] = filterPeriod.split('|');
      res = res.filter(r => r.semester === sem && r.period === per);
    }
    if (filterGeneralGrade) res = res.filter(r => r.generalGrade === filterGeneralGrade);
    const aa = parseFloat(filterAvgAbove) || 0;
    const ab = parseFloat(filterAvgBelow) || 999;
    res = res.filter(r => {
      const avg = r.average || 0;
      return avg >= aa && avg <= ab;
    });
    if (sortBy === 'avg_desc') res.sort((a, b) => (b.average || 0) - (a.average || 0));
    else if (sortBy === 'avg_asc') res.sort((a, b) => (a.average || 0) - (b.average || 0));
    else res.sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar'));
    return res.slice(0, 100);
  }, [summary, filterName, filterGrade, filterClass, filterPeriod, filterAvgAbove, filterAvgBelow, filterGeneralGrade, sortBy]);

  const gradeOptions = useMemo(() => Array.from(new Set(summary.map(r => r.grade))).sort(), [summary]);
  const classOptions = useMemo(() => Array.from(new Set(summary.map(r => String(r.classNum)))).sort(), [summary]);
  const generalGradeOptions = useMemo(() => Array.from(new Set(summary.map(r => r.generalGrade).filter(Boolean))).sort(), [summary]);
  const subjectOptions = useMemo(() =>
    Array.from(new Set(grades.map(g => g.subject).filter(s => !NON_ACADEMIC.includes(s)))),
    [grades]
  );

  const filterByCategory = (cat: string) => {
    const ranges: Record<string, [string, string]> = {
      excellent: ['95', ''], good: ['80', '95'], average: ['65', '80'], weak: ['50', '65'], danger: ['0', '50']
    };
    const r = ranges[cat];
    if (!r) return;
    setFilterAvgAbove(r[0]);
    setFilterAvgBelow(r[1]);
    setTab('reports');
  };

  // ── If student report is open ──
  if (studentReport && !reportLoading) return <StudentReportView report={studentReport} onBack={() => setStudentReport(null)} />;

  // ── Color helpers ──
  const avgColor = (avg: number) => avg >= 90 ? 'emerald' : avg >= 75 ? 'blue' : avg >= 60 ? 'amber' : 'red';
  const subjectColor = (avg: number) => avg >= 90 ? 'emerald' : avg >= 80 ? 'blue' : avg >= 70 ? 'amber' : 'red';

  return (
    <div className="max-w-full relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-200">
            <span className="material-symbols-outlined text-3xl text-teal-600">analytics</span>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">التحصيل الدراسي</h2>
            <div className="flex gap-2 items-center mt-1">
              {enabledStages.map(s => {
                const info = SETTINGS_STAGES.find(x => x.id === s.stage);
                return (
                  <button key={s.stage} onClick={() => setCurrentStage(s.stage)}
                    className={`text-xs px-3 py-1 rounded-full font-bold transition-all ${currentStage === s.stage
                      ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {info?.name || s.stage}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-bold text-teal-600">{headerStats.students || '-'}</div>
            <div className="text-xs text-gray-500">طالب</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-bold text-blue-600">{headerStats.periods || '-'}</div>
            <div className="text-xs text-gray-500">فترة</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-black text-amber-600">{headerStats.avg !== '-' ? headerStats.avg + '%' : '-'}</div>
            <div className="text-xs text-gray-500">المعدل العام</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-5">
        <div className="flex border-b border-gray-200">
          {([
            { id: 'dashboard' as const, label: 'لوحة المؤشرات', icon: 'dashboard', color: 'teal' },
            { id: 'reports' as const, label: 'تقارير تفصيلية', icon: 'description', color: 'purple' },
            { id: 'charts' as const, label: 'رسوم بيانية', icon: 'bar_chart', color: 'indigo' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 px-4 py-4 text-center font-bold transition-all border-b-2 whitespace-nowrap ${tab === t.id
                ? `border-${t.color}-500 text-${t.color}-600 bg-${t.color}-50`
                : `border-transparent text-gray-500 hover:text-${t.color}-600`}`}>
              <span className="material-symbols-outlined align-middle ml-1">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-8">
          <span className="material-symbols-outlined animate-spin text-teal-500 text-4xl">sync</span>
          <p className="text-gray-500 mt-2">جاري تحميل البيانات...</p>
        </div>
      )}

      {!loading && tab === 'dashboard' && (
        <>
          {/* Import section */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <button onClick={() => setImportOpen(!importOpen)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-all">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-500">upload_file</span>
                <span className="font-bold text-gray-700">استيراد شهادات نور</span>
                {periods.length > 0
                  ? <span className="text-xs text-gray-400 mr-2">({periods.length} فترة مستوردة)</span>
                  : <span className="text-xs text-amber-500 mr-2">لم يتم الاستيراد بعد</span>}
              </div>
              <span className={`material-symbols-outlined text-gray-400 transition-transform ${importOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>
            {importOpen && (
              <div style={{ borderTop: '1px solid #e5e7eb' }}>
                <div className="p-5">
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-xs font-bold text-gray-500 mb-1">الفترة</label>
                      <select value={importPeriod} onChange={e => setImportPeriod(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300">
                        {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="text-xs text-gray-400 self-end pb-2">الفصل الدراسي يُستخرج تلقائيا من الشهادة</div>
                  </div>
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-teal-300 rounded-xl p-6 text-center bg-teal-50/30 cursor-pointer hover:border-teal-500 hover:bg-teal-50/60 transition-all">
                    <span className="material-symbols-outlined text-4xl text-teal-400 mb-2">cloud_upload</span>
                    <p className="text-gray-600 font-bold text-sm">اضغط لرفع ملف Excel او اسحبه هنا</p>
                    <p className="text-xs text-gray-400 mt-1">ملفات شهادات نور (.xlsx)</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                      onChange={handleFileSelect} disabled={importing} />
                  </div>
                  {importStatus && (
                    <div className={`mt-4 rounded-lg p-4 text-center ${importStatus.type === 'error' ? 'bg-red-50 border border-red-200' :
                      importStatus.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                      <span className={`material-symbols-outlined ${importing ? 'animate-spin' : ''} ${importStatus.type === 'error' ? 'text-red-500' :
                        importStatus.type === 'success' ? 'text-green-500' : 'text-blue-500'}`}>
                        {importStatus.type === 'error' ? 'error' : importStatus.type === 'success' ? 'check_circle' : 'sync'}
                      </span>
                      <p className={`font-bold mt-2 ${importStatus.type === 'error' ? 'text-red-700' :
                        importStatus.type === 'success' ? 'text-green-700' : 'text-blue-700'}`}>{importStatus.msg}</p>
                    </div>
                  )}
                  {periods.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {periods.map((p, i) => {
                        const cnt = summary.filter(r => r.semester === p.semester && r.period === p.period).length;
                        return (
                          <span key={i} className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 px-3 py-1.5 rounded-full text-xs font-bold">
                            {p.semester} — {p.period} ({cnt} طالب)
                            <button onClick={(e) => { e.stopPropagation(); deletePeriod(p.semester, p.period); }}
                              className="text-teal-400 hover:text-red-500 mr-1" title="حذف">&times;</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dashboard content */}
          {!stats && summary.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-gray-300">inbox</span>
              <p className="text-gray-400 mt-3 text-lg">لا توجد بيانات بعد</p>
              <p className="text-gray-300 text-sm mt-1">استورد شهادات نور من الزر اعلاه</p>
            </div>
          )}

          {stats && (
            <>
              {/* Quick cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                <QuickCard value={stats.totalStudents} label="اجمالي الطلاب" color="teal" />
                <QuickCard value={stats.avgAll + '%'} label="المعدل العام" color="blue" />
                <QuickCard value={stats.maxAvg + '%'} label="اعلى معدل" color="green" />
                <QuickCard value={stats.minAvg + '%'} label="اقل معدل" color="red" />
                <QuickCard value={stats.absence.studentsWithAbsence} label="طلاب لديهم غياب" color="amber" />
              </div>

              {/* Categories */}
              <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
                <h4 className="font-bold text-gray-700 mb-4">تصنيف الطلاب</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <CatCard count={stats.categories.excellent} total={Object.values(stats.categories).reduce((a, b) => a + b, 0) || 1}
                    color="emerald" label="متفوق (95+)" onClick={() => filterByCategory('excellent')} />
                  <CatCard count={stats.categories.good} total={Object.values(stats.categories).reduce((a, b) => a + b, 0) || 1}
                    color="blue" label="جيد (80-94)" onClick={() => filterByCategory('good')} />
                  <CatCard count={stats.categories.average} total={Object.values(stats.categories).reduce((a, b) => a + b, 0) || 1}
                    color="amber" label="متوسط (65-79)" onClick={() => filterByCategory('average')} />
                  <CatCard count={stats.categories.weak} total={Object.values(stats.categories).reduce((a, b) => a + b, 0) || 1}
                    color="orange" label="ضعيف (50-64)" onClick={() => filterByCategory('weak')} />
                  <CatCard count={stats.categories.danger} total={Object.values(stats.categories).reduce((a, b) => a + b, 0) || 1}
                    color="red" label="خطر (&lt;50)" onClick={() => filterByCategory('danger')} />
                </div>
              </div>

              {/* Subjects & Classes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h4 className="font-bold text-gray-700 mb-3">ترتيب المواد (الاصعب &larr; الاسهل)</h4>
                  <div className="space-y-2">
                    {stats.subjects.map((s, i) => {
                      const c = subjectColor(s.avg);
                      return (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                          <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-bold">{s.name}</span>
                              <span className={`text-sm font-bold text-${c}-600`}>{s.avg}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className={`bg-${c}-500 h-2 rounded-full`} style={{ width: `${s.avg}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>&ge;90: {s.above90}</span>
                              <span>&lt;60: {s.below60}</span>
                              <span>&lt;50: {s.below50}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h4 className="font-bold text-gray-700 mb-3">مقارنة الفصول</h4>
                  <div className="space-y-2">
                    {stats.classSummary.map((c, i) => {
                      const co = c.avg >= 90 ? 'emerald' : c.avg >= 80 ? 'blue' : 'amber';
                      return (
                        <div key={i} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-800">{c.label}</span>
                            <span className="text-xs text-gray-400">{c.count} طالب</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                            <div className={`bg-${co}-500 h-2.5 rounded-full`} style={{ width: `${c.avg}%` }} />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className={`text-${co}-600 font-bold`}>المعدل: {c.avg}%</span>
                            <span className="text-emerald-600">متفوق: {c.excellent}</span>
                            <span className="text-red-600">ضعيف: {c.weak}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Top/Bottom 10 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h4 className="font-bold text-gray-700 mb-3">العشرة الاوائل</h4>
                  <div className="space-y-1">
                    {stats.topTen.map((s, i) => {
                      const avg = s.average || 0;
                      const medal = i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : String(i + 1);
                      return (
                        <div key={i} onClick={() => showStudentReport(s.identityNo)}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-50 cursor-pointer transition-all">
                          <span className="w-7 text-center text-lg">{medal}</span>
                          <span className="flex-1 text-sm font-bold text-gray-800 truncate">{s.studentName}</span>
                          <span className="text-xs text-gray-400">{s.grade} / {s.classNum}</span>
                          <span className="text-sm font-bold text-emerald-600">{avg.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h4 className="font-bold text-gray-700 mb-3">اقل 10 طلاب</h4>
                  <div className="space-y-1">
                    {stats.bottomTen.map((s, i) => {
                      const avg = s.average || 0;
                      return (
                        <div key={i} onClick={() => showStudentReport(s.identityNo)}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 cursor-pointer transition-all">
                          <span className="w-7 text-center text-xs text-gray-400">{i + 1}</span>
                          <span className="flex-1 text-sm font-bold text-gray-800 truncate">{s.studentName}</span>
                          <span className="text-xs text-gray-400">{s.grade} / {s.classNum}</span>
                          <span className="text-sm font-bold text-red-600">{avg.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Danger students */}
              {stats.dangerStudents.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-5 mb-5">
                  <h4 className="font-bold text-red-700 mb-3">طلاب منطقة الخطر (3+ مواد اقل من 60%)</h4>
                  <div className="space-y-2">
                    {stats.dangerStudents.map((s, i) => (
                      <div key={i} onClick={() => showStudentReport(s.identity)}
                        className="flex items-center gap-3 p-2 bg-white rounded-lg border border-red-100 cursor-pointer hover:shadow transition-all">
                        <span className="material-symbols-outlined text-red-500">warning</span>
                        <span className="font-bold text-sm">{s.name}</span>
                        <span className="text-xs text-red-600 flex-1">{s.weakCount} مواد: {s.weakSubjects.join('، ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Reports Tab */}
      {!loading && tab === 'reports' && (
        <>
          {summary.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-gray-300">inbox</span>
              <p className="text-gray-400 mt-3">لا توجد بيانات</p>
            </div>
          ) : subjectReportData ? (
            <SubjectReportView data={subjectReportData} subject={selectedSubject}
              onBack={() => setSubjectReportData(null)} onStudent={showStudentReport} />
          ) : classComparison ? (
            <ClassComparisonView data={classComparison} onBack={() => setClassComparison(null)} />
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
                <h4 className="font-bold text-gray-700 mb-4">بحث وفلترة</h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <input value={filterName} onChange={e => setFilterName(e.target.value)}
                    placeholder="بحث بالاسم..." className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">كل الصفوف</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">كل الفصول</option>
                    {classOptions.map(c => <option key={c} value={c}>فصل {c}</option>)}
                  </select>
                  <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">كل الفترات</option>
                    {periods.map((p, i) => <option key={i} value={`${p.semester}|${p.period}`}>{p.semester} — {p.period}</option>)}
                  </select>
                  <select value={filterGeneralGrade} onChange={e => setFilterGeneralGrade(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">كل التقديرات</option>
                    {generalGradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input value={filterAvgAbove} onChange={e => setFilterAvgAbove(e.target.value)}
                    type="number" placeholder="معدل اكثر من" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <input value={filterAvgBelow} onChange={e => setFilterAvgBelow(e.target.value)}
                    type="number" placeholder="معدل اقل من" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="avg_desc">الاعلى معدلا</option>
                    <option value="avg_asc">الاقل معدلا</option>
                    <option value="name">ابجدي</option>
                  </select>
                  <button onClick={() => setSubjectModalOpen(true)}
                    className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-600 transition-all">
                    تقرير مادة
                  </button>
                  <button onClick={() => { setClassComparison(null); loadClassComparison(); }}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-all">
                    مقارنة فصول
                  </button>
                  <button onClick={async () => {
                    try {
                      const lp = periods[periods.length - 1];
                      const res = await academicApi.exportCsv(currentStage, lp?.semester, lp?.period);
                      const blob = new Blob([res.data], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'academic_export.csv'; a.click();
                      URL.revokeObjectURL(url);
                    } catch { showError('خطأ في التصدير'); }
                  }}
                    className="bg-teal-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-600 transition-all">
                    <span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle'}}>download</span> تصدير CSV
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-500 mb-3">
                النتائج: <span className="font-bold text-purple-600">{filteredStudents.length}</span> طالب
              </div>

              <div className="space-y-2">
                {filteredStudents.map((s, i) => {
                  const avg = s.average || 0;
                  const c = avg >= 95 ? 'emerald' : avg >= 80 ? 'blue' : avg >= 65 ? 'amber' : avg >= 50 ? 'orange' : 'red';
                  return (
                    <div key={s.id || i} onClick={() => showStudentReport(s.identityNo)}
                      className="bg-white rounded-lg border p-3 flex items-center gap-3 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-sm font-bold text-gray-400 w-8 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-gray-800">{s.studentName}</span>
                        <span className="text-xs text-gray-400 mr-2">{s.grade} / فصل {s.classNum}</span>
                      </div>
                      <div className="flex gap-2 items-center flex-shrink-0">
                        <span className="text-xs text-gray-400">{s.generalGrade}</span>
                        <div className={`bg-${c}-100 text-${c}-700 font-bold px-3 py-1 rounded-lg text-sm`}>
                          {avg.toFixed(1)}%
                        </div>
                        {s.absence > 0 && (
                          <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">غياب {s.absence}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Subject select modal */}
          {subjectModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={e => { if (e.target === e.currentTarget) setSubjectModalOpen(false); }}>
              <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]">
                <h3 className="font-bold text-lg mb-4">اختر المادة</h3>
                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mb-4">
                  {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-3">
                  <button onClick={() => {
                    const subj = selectedSubject || subjectOptions[0];
                    const filtered = grades.filter(g => g.subject === subj);
                    filtered.sort((a, b) => b.total - a.total);
                    setSubjectReportData(filtered);
                    setSelectedSubject(subj);
                    setSubjectModalOpen(false);
                  }} className="flex-1 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600">عرض</button>
                  <button onClick={() => setSubjectModalOpen(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50">الغاء</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Charts Tab */}
      {!loading && tab === 'charts' && (
        <>
          {!stats ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <span className="material-symbols-outlined text-5xl text-gray-300">bar_chart</span>
              <p className="text-gray-400 mt-3">لا توجد بيانات</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Grade Distribution - Doughnut */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h4 className="font-bold text-gray-700 mb-3">توزيع التقديرات</h4>
                <div style={{ maxHeight: 320, display: 'flex', justifyContent: 'center' }}>
                  <Doughnut
                    data={{
                      labels: Object.keys(stats.gradeDist),
                      datasets: [{
                        data: Object.values(stats.gradeDist),
                        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#6366f1'],
                        borderWidth: 2,
                      }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: true,
                      plugins: {
                        legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Cairo' }, padding: 12 } },
                        tooltip: { rtl: true, titleFont: { family: 'Cairo' }, bodyFont: { family: 'Cairo' } },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Student Categories - Bar */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h4 className="font-bold text-gray-700 mb-3">تصنيف الطلاب</h4>
                <Bar
                  data={{
                    labels: ['متفوق (95+)', 'جيد (80-94)', 'متوسط (65-79)', 'ضعيف (50-64)', 'خطر (<50)'],
                    datasets: [{
                      label: 'عدد الطلاب',
                      data: [stats.categories.excellent, stats.categories.good, stats.categories.average, stats.categories.weak, stats.categories.danger],
                      backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'],
                      borderRadius: 6,
                    }],
                  }}
                  options={{
                    responsive: true, indexAxis: 'x' as const,
                    plugins: {
                      legend: { display: false },
                      tooltip: { rtl: true, bodyFont: { family: 'Cairo' }, titleFont: { family: 'Cairo' } },
                    },
                    scales: {
                      x: { ticks: { font: { family: 'Cairo', size: 11 } } },
                      y: { beginAtZero: true, ticks: { precision: 0 } },
                    },
                  }}
                />
              </div>

              {/* Subject Averages - Horizontal Bar */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h4 className="font-bold text-gray-700 mb-3">متوسط المواد</h4>
                <Bar
                  data={{
                    labels: stats.subjects.map(s => s.name),
                    datasets: [{
                      label: 'المتوسط',
                      data: stats.subjects.map(s => s.avg),
                      backgroundColor: stats.subjects.map(s =>
                        s.avg >= 90 ? '#10b981' : s.avg >= 80 ? '#3b82f6' : s.avg >= 70 ? '#f59e0b' : '#ef4444'
                      ),
                      borderRadius: 4,
                    }],
                  }}
                  options={{
                    responsive: true, indexAxis: 'y' as const,
                    plugins: {
                      legend: { display: false },
                      tooltip: { rtl: true, bodyFont: { family: 'Cairo' }, titleFont: { family: 'Cairo' } },
                    },
                    scales: {
                      x: { beginAtZero: true, max: 100 },
                      y: { ticks: { font: { family: 'Cairo', size: 11 } } },
                    },
                  }}
                />
              </div>

              {/* Class Comparison - Multi-dataset Bar */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h4 className="font-bold text-gray-700 mb-3">مقارنة الفصول</h4>
                <Bar
                  data={{
                    labels: stats.classSummary.map(c => c.label),
                    datasets: [
                      { label: 'المتوسط', data: stats.classSummary.map(c => c.avg), backgroundColor: '#3b82f6', borderRadius: 4 },
                      { label: 'الأعلى', data: stats.classSummary.map(c => c.max), backgroundColor: '#10b981', borderRadius: 4 },
                      { label: 'الأدنى', data: stats.classSummary.map(c => c.min), backgroundColor: '#f97316', borderRadius: 4 },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Cairo' }, padding: 12 } },
                      tooltip: { rtl: true, bodyFont: { family: 'Cairo' }, titleFont: { family: 'Cairo' } },
                    },
                    scales: {
                      x: { ticks: { font: { family: 'Cairo', size: 10 } } },
                      y: { beginAtZero: true, max: 100 },
                    },
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {reportLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <span className="material-symbols-outlined animate-spin text-teal-500 text-4xl">sync</span>
            <p className="text-gray-500 mt-2">جاري تحميل تقرير الطالب...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──

const QuickCard: React.FC<{ value: string | number; label: string; color: string }> = ({ value, label, color }) => (
  <div className="bg-white rounded-xl shadow-sm border p-4 text-center hover:shadow-md transition-all">
    <div className={`text-3xl font-bold text-${color}-600`}>{value}</div>
    <div className="text-xs text-gray-500 mt-1">{label}</div>
  </div>
);

const CatCard: React.FC<{ count: number; total: number; color: string; label: string; onClick: () => void }> = ({ count, total, color, label, onClick }) => {
  const pct = Math.round(count / total * 100);
  return (
    <div onClick={onClick}
      className={`text-center p-3 bg-${color}-50 border border-${color}-100 rounded-xl cursor-pointer hover:shadow-md transition-all`}>
      <div className={`text-2xl font-bold text-${color}-600`}>{count}</div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
        <div className={`bg-${color}-500 h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Student Report View ──
const StudentReportView: React.FC<{ report: StudentReport; onBack: () => void }> = ({ report, onBack }) => {
  const { student, summary, analysis } = report;
  const latest = summary[summary.length - 1];
  const avg = latest?.average || 0;
  const ac = avg >= 90 ? 'emerald' : avg >= 75 ? 'blue' : avg >= 60 ? 'amber' : 'red';

  return (
    <div className="max-w-full">
      <button onClick={onBack} className="mb-4 text-teal-600 hover:text-teal-800 flex items-center gap-1">
        <span className="material-symbols-outlined">arrow_forward</span> رجوع
      </button>

      {/* Student card */}
      <div className={`bg-gradient-to-l from-${ac}-50 to-white rounded-xl shadow-sm border p-6 mb-5`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">{student.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{student.grade} — فصل {student.classNum} | الهوية: {student.identity}</p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold text-${ac}-600`}>{avg.toFixed(1)}%</div>
            <div className="text-sm text-gray-500">{latest?.generalGrade}</div>
          </div>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mt-5">
          <MiniBox value={latest?.rankGrade || '-'} label="ترتيب الصف" />
          <MiniBox value={latest?.rankClass || '-'} label="ترتيب الفصل" />
          <MiniBox value={analysis.absence} label="الغياب" extraClass={analysis.absence > 0 ? 'text-red-600' : 'text-green-600'} />
          <MiniBox value={analysis.tardiness} label="التاخر" />
          <MiniBox value={analysis.strengths.length} label="مواد قوة" extraClass="text-emerald-600" />
          <MiniBox value={analysis.weaknesses.length} label="مواد ضعف" extraClass="text-red-600" />
          <MiniBox value={analysis.behaviorExcellent || '-'} label="سلوك متميز" />
          <MiniBox value={analysis.behaviorPositive || '-'} label="سلوك ايجابي" />
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h4 className="font-bold text-gray-700 mb-3">نقاط القوة (90%+)</h4>
          {analysis.strengths.length > 0 ? analysis.strengths.map((x, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg mb-1">
              <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
              <span className="text-sm">{x}</span>
            </div>
          )) : <p className="text-gray-400 text-sm">لا يوجد</p>}

          <h4 className="font-bold text-gray-700 mb-3 mt-5">نقاط الضعف (&lt;65%)</h4>
          {analysis.weaknesses.length > 0 ? analysis.weaknesses.map((x, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg mb-1">
              <span className="material-symbols-outlined text-red-500 text-sm">warning</span>
              <span className="text-sm">{x}</span>
            </div>
          )) : <p className="text-gray-400 text-sm">لا يوجد</p>}

          {analysis.weaknessPattern !== 'لا يوجد' && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <strong>نمط الضعف:</strong> {analysis.weaknessPattern}
            </div>
          )}
        </div>

        {/* Subject map - Radar */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h4 className="font-bold text-gray-700 mb-3">خريطة المواد</h4>
          {analysis.academicGrades.length > 0 ? (
            <div style={{ maxHeight: 350, display: 'flex', justifyContent: 'center' }}>
              <Radar
                data={{
                  labels: analysis.academicGrades.map(g => g.name),
                  datasets: [{
                    label: 'الدرجة',
                    data: analysis.academicGrades.map(g => g.total),
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    pointBackgroundColor: analysis.academicGrades.map(g =>
                      g.total >= 90 ? '#10b981' : g.total >= 70 ? '#3b82f6' : g.total >= 50 ? '#f59e0b' : '#ef4444'
                    ),
                    pointRadius: 5,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    r: {
                      beginAtZero: true, max: 100,
                      pointLabels: { font: { family: 'Cairo', size: 11 } },
                      ticks: { stepSize: 20, display: false },
                    },
                  },
                }}
              />
            </div>
          ) : <p className="text-gray-400 text-sm">لا توجد بيانات</p>}
        </div>
      </div>

      {/* Grades table */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
        <h4 className="font-bold text-gray-700 mb-3">الدرجات التفصيلية</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="p-2.5 text-right font-bold">المادة</th>
                <th className="p-2.5 text-center font-bold">المجموع</th>
                <th className="p-2.5 text-center font-bold">اختبار نهائي</th>
                <th className="p-2.5 text-center font-bold">ادوات تقييم</th>
                <th className="p-2.5 text-center font-bold">اختبارات قصيرة</th>
                <th className="p-2.5 text-center font-bold">التقدير</th>
              </tr>
            </thead>
            <tbody>
              {analysis.academicGrades.map((g, i) => {
                const gc = g.total >= 90 ? 'emerald' : g.total >= 70 ? 'blue' : g.total >= 50 ? 'amber' : 'red';
                const fg = report.grades.find(gr =>
                  gr.subject === g.name && gr.semester === latest?.semester && gr.period === latest?.period
                );
                return (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-2.5 font-bold">{g.name}</td>
                    <td className={`p-2.5 text-center font-bold text-${gc}-600`}>{g.total}</td>
                    <td className="p-2.5 text-center">{fg?.finalExam ?? '-'}</td>
                    <td className="p-2.5 text-center">{fg?.evalTools ?? '-'}</td>
                    <td className="p-2.5 text-center">{fg?.shortTests ?? '-'}</td>
                    <td className="p-2.5 text-center">{g.grade}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exam vs Classwork - Grouped Bar */}
      {analysis.examVsWork.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
          <h4 className="font-bold text-gray-700 mb-3">الاختبار النهائي مقابل اعمال السنة</h4>
          <Bar
            data={{
              labels: analysis.examVsWork.map(e => e.name),
              datasets: [
                { label: 'اختبار نهائي', data: analysis.examVsWork.map(e => e.finalExam), backgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'اعمال السنة', data: analysis.examVsWork.map(e => e.classWork), backgroundColor: '#10b981', borderRadius: 4 },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Cairo' }, padding: 12 } },
                tooltip: { rtl: true, bodyFont: { family: 'Cairo' }, titleFont: { family: 'Cairo' } },
              },
              scales: {
                x: { ticks: { font: { family: 'Cairo', size: 10 } } },
                y: { beginAtZero: true, max: 100 },
              },
            }}
          />
        </div>
      )}
    </div>
  );
};

const MiniBox: React.FC<{ value: string | number; label: string; extraClass?: string }> = ({ value, label, extraClass }) => (
  <div className="text-center p-2 bg-white/70 rounded-lg border">
    <div className={`text-lg font-bold ${extraClass || ''}`}>{value}</div>
    <div className="text-xs text-gray-400">{label}</div>
  </div>
);

// ── Subject Report View ──
const SubjectReportView: React.FC<{ data: GradeRow[]; subject: string; onBack: () => void; onStudent: (id: string) => void }> = ({ data, subject, onBack, onStudent }) => {
  const totals = data.map(r => r.total);
  const avg = totals.length > 0 ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : '0';
  return (
    <>
      <button onClick={onBack} className="mb-3 text-purple-600 hover:text-purple-800 flex items-center gap-1 text-sm">
        <span className="material-symbols-outlined text-sm">arrow_forward</span> رجوع للتقارير
      </button>
      <div className="bg-purple-50 rounded-xl border border-purple-200 p-5 mb-4">
        <h4 className="font-bold text-purple-700 text-lg mb-3">تقرير: {subject}</h4>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center bg-white rounded-lg p-2 border"><div className="text-xl font-bold text-purple-600">{data.length}</div><div className="text-xs">طالب</div></div>
          <div className="text-center bg-white rounded-lg p-2 border"><div className="text-xl font-bold text-blue-600">{avg}%</div><div className="text-xs">المتوسط</div></div>
          <div className="text-center bg-white rounded-lg p-2 border"><div className="text-xl font-bold text-emerald-600">{totals.filter(t => t >= 90).length}</div><div className="text-xs">&ge;90%</div></div>
          <div className="text-center bg-white rounded-lg p-2 border"><div className="text-xl font-bold text-red-600">{totals.filter(t => t < 60).length}</div><div className="text-xs">&lt;60%</div></div>
        </div>
      </div>
      <div className="space-y-2">
        {data.slice(0, 50).map((g, i) => {
          const c = g.total >= 90 ? 'emerald' : g.total >= 70 ? 'blue' : g.total >= 50 ? 'amber' : 'red';
          return (
            <div key={i} onClick={() => onStudent(g.identityNo)}
              className="bg-white rounded-lg border p-3 flex items-center gap-3 hover:shadow cursor-pointer transition-all">
              <span className="text-sm font-bold text-gray-400 w-8 text-center">{i + 1}</span>
              <span className="flex-1 font-bold text-sm">{g.studentName}</span>
              <span className="text-xs text-gray-400">{g.grade} / {g.classNum}</span>
              <div className={`bg-${c}-100 text-${c}-700 font-bold px-3 py-1 rounded-lg text-sm`}>{g.total}</div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ── Class Comparison View ──
const ClassComparisonView: React.FC<{ data: ClassCompItem[]; onBack: () => void }> = ({ data, onBack }) => (
  <>
    <button onClick={onBack} className="mb-3 text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm">
      <span className="material-symbols-outlined text-sm">arrow_forward</span> رجوع للتقارير
    </button>
    <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 mb-4">
      <h4 className="font-bold text-blue-700 text-lg">مقارنة الفصول حسب المادة</h4>
    </div>
    {data.map((item, idx) => (
      <div key={idx} className="bg-white rounded-lg border p-4 mb-3">
        <h5 className="font-bold text-gray-700 mb-3">{item.subject}</h5>
        <div className={`grid grid-cols-${Math.min(item.classes.length, 4)} gap-3`}>
          {item.classes.map((cl, ci) => {
            const co = cl.avg >= 85 ? 'emerald' : cl.avg >= 75 ? 'blue' : 'amber';
            return (
              <div key={ci} className={`text-center p-3 bg-${co}-50 rounded-lg border border-${co}-100`}>
                <div className="font-bold text-sm">{cl.classLabel}</div>
                <div className={`text-2xl font-bold text-${co}-600 my-1`}>{cl.avg}%</div>
                <div className="text-xs text-gray-500">{cl.count} طالب</div>
                <div className="flex justify-center gap-2 text-xs mt-1">
                  <span className="text-emerald-600">&ge;90: {cl.above90}</span>
                  <span className="text-red-600">&lt;60: {cl.below60}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ))}
  </>
);

// ══════════════════════════════════════════════════
// Excel parsing utilities (matching old system exactly)
// ══════════════════════════════════════════════════

function sheetTo2DArray(ws: XLSX.WorkSheet): string[][] | null {
  const ref = ws['!ref'];
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);
  const maxR = Math.min(range.e.r, 69);
  const maxC = Math.min(range.e.c, 49);

  const mergeMap: Record<string, string> = {};
  const merges = ws['!merges'] || [];
  for (const mg of merges) {
    const tlAddr = XLSX.utils.encode_cell({ r: mg.s.r, c: mg.s.c });
    for (let mr = mg.s.r; mr <= mg.e.r; mr++) {
      for (let mc = mg.s.c; mc <= mg.e.c; mc++) {
        if (mr !== mg.s.r || mc !== mg.s.c) {
          mergeMap[mr + ',' + mc] = tlAddr;
        }
      }
    }
  }

  const rows: string[][] = [];
  for (let r = 0; r <= maxR; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const lookupAddr = mergeMap[r + ',' + c] || addr;
      const cell = ws[lookupAddr] as { v?: unknown } | undefined;
      row.push(cell && cell.v !== undefined ? String(cell.v) : '');
    }
    rows.push(row);
  }
  return rows;
}

function parseStudentFromArray(d: string[][], fallbackSemester: string): AcademicStudentData | null {
  const c = (row: number, col: number): string => {
    if (row < 1 || row > d.length || col < 1 || col > d[0].length) return '';
    return String(d[row - 1][col - 1] || '');
  };
  const toN = (v: string): number => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  let name = c(28, 35);
  if (name.includes('اسم الطالب:')) name = name.replace('اسم الطالب:', '').trim();
  if (!name) return null;

  const classNum = c(28, 27);
  const identity = c(30, 19);
  if (!identity || identity === '0' || identity === 'undefined') return null;

  const gradeText = c(19, 10);
  let grade = '';
  if (gradeText.includes('الأول')) grade = 'الأول المتوسط';
  else if (gradeText.includes('الثاني')) grade = 'الثاني المتوسط';
  else if (gradeText.includes('الثالث')) grade = 'الثالث المتوسط';
  else grade = gradeText;

  let semester = fallbackSemester || '';
  if (!semester) {
    outerLoop:
    for (let r = 0; r < Math.min(d.length, 25); r++) {
      for (let cc = 0; cc < d[r].length; cc++) {
        const v = d[r][cc] || '';
        if (v.includes('الفصل الدراسي الأول') || v.includes('الفصل الأول')) { semester = 'الفصل الأول'; break outerLoop; }
        else if (v.includes('الفصل الدراسي الثاني') || v.includes('الفصل الثاني')) { semester = 'الفصل الثاني'; break outerLoop; }
        else if (v.includes('الفصل الدراسي الثالث') || v.includes('الفصل الثالث')) { semester = 'الفصل الثالث'; break outerLoop; }
      }
    }
  }

  const subjects: AcademicSubjectData[] = [];
  let average = 0, generalGrade = '';
  const maxSubjRow = Math.min(d.length, 60);
  for (let r = 35; r <= maxSubjRow; r++) {
    const auVal = c(r, 47).trim();
    if (!auVal || auVal === 'المواد الدراسية' || auVal === 'مجموع الدرجات الموزونة') continue;
    if (auVal === 'المعدل') { average = parseFloat(c(r, 24).replace('%', '').trim()) || 0; continue; }
    if (auVal === 'التقدير العام') { generalGrade = c(r, 37) || c(r, 24); continue; }
    subjects.push({
      name: auVal,
      total: toN(c(r, 34)),
      finalExam: toN(c(r, 38)),
      evalTools: toN(c(r, 40)),
      shortTests: toN(c(r, 45)),
      grade: c(r, 24),
    });
  }

  let rankGrade = '', rankClass = '', absence = '0', tardiness = '0', behExc = '', behPos = '';
  const scanEnd = Math.min(d.length, 68);
  for (let r = 50; r <= scanEnd; r++) {
    for (let cc = 0; cc < (d[r - 1] || []).length; cc++) {
      const cv = d[r - 1][cc] || '';
      if (!cv) continue;
      if (cv.includes('الترتيب على الصف')) rankGrade = c(r, 7);
      if (cv.includes('الترتيب على الفصل')) rankClass = c(r, 7);
      if (cv.includes('غياب بدون عذر')) absence = c(r, 9) || '0';
      if (cv.includes('تأخر بدون عذر')) tardiness = c(r, 9) || '0';
      if (cv.includes('درجة السلوك المتميز')) behExc = c(r, 44);
      if (cv.includes('درجة السلوك الإيجابي')) behPos = c(r, 44);
    }
  }

  return {
    name, identity, grade, classNum, semester, average: average || undefined,
    generalGrade, rankGrade, rankClass,
    absence: parseInt(absence) || 0, tardiness: parseInt(tardiness) || 0,
    behaviorExcellent: behExc, behaviorPositive: behPos,
    subjects,
  };
}

export default AcademicPage;
