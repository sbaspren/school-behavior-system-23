import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { dashboardApi } from '../api/dashboard';
import { settingsApi, StageConfigData } from '../api/settings';
import { SETTINGS_STAGES } from '../utils/constants';

// ═══════ Types ═══════
interface TodayStats {
  absence: number; tardiness: number; permissions: number;
  permissionsOut: number; permissionsWaiting: number;
  violations: number; notes: number; pendingExcuses: number;
}
interface StageStatsItem {
  absence: number; tardiness: number; permissions: number;
  violations: number; notes: number;
}
interface PendingItem { name: string; violation?: string; type?: string; detail?: string; teacher?: string; grade?: string; cls?: string; degree?: number; date?: string; stage?: string; }
interface NotSentData { absence: number; tardiness: number; violations: number; }
interface AbsenceClassItem { stage: string; grade: string; className: string; count: number; }
interface RecentItem { type: string; teacher: string; detail: string; student: string; cls: string; recordedAt: string; stage: string; section: string; actionTaken: boolean; }
interface NeedsPrintItem { type: string; name: string; studentId: number; detail: string; degree: number; grade: string; cls: string; date: string; stage: string; section: string; }
interface TopViolator { studentId: number; studentName: string; studentNumber: string; grade: string; className: string; count: number; totalDeduction: number; }
interface CalendarEvent { d: number; m: number; label: string; type: string; holiday: boolean; }
interface SemesterInfo { name: string; start: number[]; end: number[]; weeks: number; }

interface DashboardData {
  hijriDate: string;
  today: TodayStats;
  stageStats: Record<string, StageStatsItem>;
  pending: {
    violationsNoAction: PendingItem[];
    notesPending: PendingItem[];
    notSent: NotSentData;
    notSentByStage: Record<string, NotSentData>;
  };
  absenceByClass: AbsenceClassItem[];
  recentActivity: RecentItem[];
  semesterTotals: { violations: number; absence: number; permissions: number; tardiness: number; };
  needsPrinting: NeedsPrintItem[];
  students: { total: number };
  violations: { total: number; totalDeduction: number; byDegree: { degree: number; count: number }[] };
  topViolators: TopViolator[];
}

// ═══════ Constants ═══════
const STAT_CARDS = [
  { key: 'absence', icon: 'event_busy', label: 'غياب اليوم', color: '#f97316', bg: '#fff7ed' },
  { key: 'tardiness', icon: 'timer_off', label: 'تأخر صباحي', color: '#ef4444', bg: '#fef2f2' },
  { key: 'permissions', icon: 'exit_to_app', label: 'استئذان', color: '#8b5cf6', bg: '#faf5ff' },
  { key: 'violations', icon: 'gavel', label: 'مخالفات', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'notes', icon: 'menu_book', label: 'ملاحظات', color: '#22c55e', bg: '#f0fdf4' },
  { key: 'pendingExcuses', icon: 'family_restroom', label: 'أعذار', color: '#f59e0b', bg: '#fffbeb' },
];

const SEMESTER_DATES: { name: string; start: number[]; end: number[]; weeks: number; events: { week: number; label: string; type: string }[] }[] = [
  {
    name: 'الفصل الأول', start: [2025, 7, 24], end: [2026, 0, 8], weeks: 18,
    events: [
      { week: 5, label: 'اليوم الوطني', type: 'national' },
      { week: 5, label: 'يوم المعلم', type: 'event' },
      { week: 8, label: 'إجازة إضافية', type: 'holiday' },
      { week: 13, label: 'إجازة الخريف', type: 'holiday' },
      { week: 16, label: 'إجازة إضافية', type: 'holiday' },
      { week: 17, label: 'اللغة العربية', type: 'event' },
    ]
  },
  {
    name: 'الفصل الثاني', start: [2026, 0, 18], end: [2026, 5, 25], weeks: 18,
    events: [
      { week: 1, label: 'يوم التعليم', type: 'event' },
      { week: 5, label: 'يوم التأسيس', type: 'national' },
      { week: 7, label: 'عيد الفطر', type: 'holiday' },
      { week: 8, label: 'يوم العلم', type: 'national' },
      { week: 12, label: 'يوم الصحة', type: 'event' },
      { week: 17, label: 'عيد الأضحى', type: 'holiday' },
    ]
  }
];

const EVENTS_DATA: CalendarEvent[] = [
  { d: 24, m: 8, label: 'بداية العام الدراسي', type: 'event', holiday: false },
  { d: 23, m: 9, label: 'إجازة اليوم الوطني', type: 'national', holiday: true },
  { d: 5, m: 10, label: 'يوم المعلم العالمي', type: 'event', holiday: false },
  { d: 12, m: 10, label: 'إجازة إضافية', type: 'holiday', holiday: true },
  { d: 16, m: 10, label: 'يوم الغذاء العالمي', type: 'event', holiday: false },
  { d: 16, m: 11, label: 'اليوم العالمي للتسامح', type: 'event', holiday: false },
  { d: 20, m: 11, label: 'اليوم العالمي للطفل', type: 'event', holiday: false },
  { d: 21, m: 11, label: 'بداية إجازة الخريف', type: 'holiday', holiday: true },
  { d: 3, m: 12, label: 'اليوم العالمي لذوي الإعاقة', type: 'event', holiday: false },
  { d: 11, m: 12, label: 'إجازة إضافية', type: 'holiday', holiday: true },
  { d: 18, m: 12, label: 'اليوم العالمي للغة العربية', type: 'event', holiday: false },
  { d: 9, m: 1, label: 'بداية إجازة منتصف العام', type: 'holiday', holiday: true },
  { d: 18, m: 1, label: 'بداية الفصل الثاني', type: 'event', holiday: false },
  { d: 24, m: 1, label: 'اليوم الدولي للتعليم', type: 'event', holiday: false },
  { d: 22, m: 2, label: 'يوم التأسيس السعودي', type: 'national', holiday: true },
  { d: 6, m: 3, label: 'بداية إجازة عيد الفطر', type: 'holiday', holiday: true },
  { d: 28, m: 3, label: 'نهاية إجازة عيد الفطر', type: 'event', holiday: false },
  { d: 11, m: 3, label: 'يوم العلم السعودي', type: 'national', holiday: false },
  { d: 7, m: 4, label: 'اليوم العالمي للصحة', type: 'event', holiday: false },
  { d: 22, m: 5, label: 'بداية إجازة عيد الأضحى', type: 'holiday', holiday: true },
  { d: 1, m: 6, label: 'نهاية إجازة عيد الأضحى', type: 'event', holiday: false },
  { d: 25, m: 6, label: 'بداية إجازة نهاية العام', type: 'holiday', holiday: true },
];

const DEGREE_COLORS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'الأولى', color: '#15803d', bg: '#dcfce7' },
  2: { label: 'الثانية', color: '#ca8a04', bg: '#fef9c3' },
  3: { label: 'الثالثة', color: '#ea580c', bg: '#ffedd5' },
  4: { label: 'الرابعة', color: '#dc2626', bg: '#fee2e2' },
  5: { label: 'الخامسة', color: '#7c2d12', bg: '#fecaca' },
};

// ═══════ Helpers ═══════
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'صباح الخير' : 'مساء الخير';
}

function getSemesterProgress() {
  const now = new Date();
  for (let i = 0; i < SEMESTER_DATES.length; i++) {
    const s = SEMESTER_DATES[i];
    const start = new Date(s.start[0], s.start[1], s.start[2]);
    const end = new Date(s.end[0], s.end[1], s.end[2]);
    if (now >= start && now <= end) {
      const total = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();
      const pct = Math.min(100, Math.round((elapsed / total) * 100));
      const remaining = Math.ceil((end.getTime() - now.getTime()) / 86400000);
      const week = Math.max(1, Math.min(s.weeks, Math.floor((now.getTime() - start.getTime()) / (7 * 86400000)) + 1));
      return { name: s.name, pct, remaining, semIdx: i, week, weeks: s.weeks };
    }
  }
  for (let j = 0; j < SEMESTER_DATES.length; j++) {
    const ns = new Date(SEMESTER_DATES[j].start[0], SEMESTER_DATES[j].start[1], SEMESTER_DATES[j].start[2]);
    if (ns > now) {
      const d2n = Math.ceil((ns.getTime() - now.getTime()) / 86400000);
      return { name: `إجازة — ${SEMESTER_DATES[j].name} بعد ${d2n} يوم`, pct: 100, remaining: d2n, semIdx: j > 0 ? j - 1 : 0, week: 18, weeks: 18 };
    }
  }
  return { name: 'انتهى العام', pct: 100, remaining: 0, semIdx: 1, week: 18, weeks: 18 };
}

// ═══════ Main Component ═══════
const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');
  const [timelineSem, setTimelineSem] = useState(() => getSemesterProgress().semIdx);
  const [printSectionHidden, setPrintSectionHidden] = useState(false);

  const enabledStages = useMemo(() =>
    stages.filter((s) => s.isEnabled && s.grades.some((g) => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        dashboardApi.get(stageFilter || undefined),
        settingsApi.getStructure(),
      ]);
      if (dRes.data?.data) setData(dRes.data.data);
      if (sRes.data?.data?.stages) {
        const raw = sRes.data.data.stages;
        setStages(Array.isArray(raw) ? raw : Object.values(raw));
      }
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [stageFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const timer = setInterval(loadData, 120000);
    return () => clearInterval(timer);
  }, [loadData]);

  const stageLabel = (id: string) => SETTINGS_STAGES.find(s => s.id === id)?.name || id;

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af' }}>جاري التحميل...</div>;
  }

  if (!data) {
    return <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af' }}>لا توجد بيانات</div>;
  }

  const now = new Date();
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  let hijriStr = '';
  try { hijriStr = now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { /* empty */ }
  let miladiStr = '';
  try { miladiStr = now.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { /* empty */ }

  const curStageStats = stageFilter ? (data.stageStats[stageFilter] || {} as StageStatsItem) : null;
  const notSent = stageFilter
    ? (data.pending.notSentByStage[stageFilter] || { absence: 0, tardiness: 0, violations: 0 })
    : data.pending.notSent;
  const totalNotSent = notSent.absence + notSent.tardiness + notSent.violations;

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* ═══════ Row 1: Greeting + Date ═══════ */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1a1d2e', lineHeight: 1.4, margin: 0 }}>
            {getGreeting()}، <span style={{ background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>وكيل شؤون الطلاب</span>
          </h2>
          <p style={{ fontSize: 13, color: '#9da3b8', marginTop: 4, fontWeight: 500 }}>
            {stageFilter ? stageLabel(stageFilter) : 'جميع المراحل'}
          </p>
          {/* Stage filter buttons */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setStageFilter('')} style={filterBtn(!stageFilter)}>الكل</button>
            {enabledStages.map(s => (
              <button key={s.stage} onClick={() => setStageFilter(s.stage)} style={filterBtn(stageFilter === s.stage)}>{stageLabel(s.stage)}</button>
            ))}
          </div>
        </div>

        {/* Date card */}
        <div style={{
          minWidth: 240, background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)',
          borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
          position: 'relative', overflow: 'hidden', boxShadow: '0 4px 15px rgba(79,70,229,.2)'
        }}>
          <div style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, background: 'rgba(255,255,255,.08)', borderRadius: '50%' }} />
          <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'white' }}>calendar_today</span>
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'white', lineHeight: 1.3 }}>{hijriStr}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{dayNames[now.getDay()]} — {miladiStr}</div>
          </div>
        </div>
      </div>

      {/* ═══════ Row 2: Timeline ═══════ */}
      <SemesterTimeline semIdx={timelineSem} onSwitch={setTimelineSem} />

      {/* ═══════ Row 3: Stats Cards ═══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        {STAT_CARDS.map(sc => {
          const todayAny = data.today as unknown as Record<string, number>;
          const val = curStageStats
            ? (curStageStats[sc.key as keyof StageStatsItem] ?? todayAny[sc.key] ?? 0)
            : (todayAny[sc.key] ?? 0);
          return (
            <div key={sc.key} style={{
              background: '#fff', borderRadius: 16, padding: '12px 10px',
              border: '1px solid #f0f2f7', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
              position: 'relative', overflow: 'hidden', cursor: 'default'
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 3, height: '100%', background: sc.color }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: sc.bg, flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: sc.color }}>{sc.icon}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{sc.label}</span>
              </div>
              <div style={{ textAlign: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#1a1d2e' }}>{val}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════ Row 4: Attention Cards + Recent ═══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Attention cards */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1d2e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ef4444' }}>notifications_active</span> يحتاج انتباهك
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <AttentionCard icon="gavel" title="مخالفات بدون إجراء" count={data.pending.violationsNoAction.length} color="#ef4444"
              items={data.pending.violationsNoAction.slice(0, 3).map(v => ({ text: v.name, tag: `${v.grade} ${v.cls}` }))} />
            <AttentionCard icon="edit_note" title="ملاحظات معلقة" count={data.pending.notesPending.length} color="#f97316"
              items={data.pending.notesPending.slice(0, 3).map(n => ({ text: `${n.name} — ${n.type}`, tag: n.cls || '' }))} />
            <AttentionCard icon="sms_failed" title="لم يُبلّغ ولي الأمر" count={totalNotSent} color="#3b82f6"
              items={[
                ...(notSent.absence > 0 ? [{ text: `${notSent.absence} غياب`, tag: 'اليوم' }] : []),
                ...(notSent.tardiness > 0 ? [{ text: `${notSent.tardiness} تأخر`, tag: 'اليوم' }] : []),
                ...(notSent.violations > 0 ? [{ text: `${notSent.violations} مخالفة`, tag: 'اليوم' }] : []),
              ]} />
            <AttentionCard icon="pending_actions" title="أعذار بانتظار" count={data.today.pendingExcuses} color="#8b5cf6" items={[]} />
          </div>
        </div>

        {/* Recent Activity (referrals) */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #f0f2f7', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1d2e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6366f1' }}>swap_horiz</span> تحويلات المعلمين
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {data.recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: '#9da3b8', fontSize: 11 }}>لا توجد تحويلات اليوم</div>
            ) : data.recentActivity.map((it, i) => {
              const typeColors: Record<string, { bg: string; fg: string }> = {
                'مخالفة': { bg: '#fef2f2', fg: '#dc2626' },
                'ملاحظة': { bg: '#f0fdf4', fg: '#16a34a' },
              };
              const c = typeColors[it.type] || { bg: '#fffbeb', fg: '#d97706' };
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px',
                  borderBottom: i < data.recentActivity.length - 1 ? '1px solid #f8fafc' : 'none',
                  opacity: it.actionTaken ? 0.55 : 1
                }}>
                  {it.actionTaken ? (
                    <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', color: '#22c55e', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                    </div>
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: 'white', background: c.fg, flexShrink: 0 }}>
                      {(it.teacher || '').substring(0, 2)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: it.actionTaken ? '#94a3b8' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.teacher}</div>
                    <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.detail} — {it.student}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: it.actionTaken ? '#f0fdf4' : c.bg, color: it.actionTaken ? '#22c55e' : c.fg, flexShrink: 0 }}>
                    {it.actionTaken ? 'تم' : it.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════ Row 5: Calendar + Violations by Degree + Absence Grid ═══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <CalendarCard />

        {/* Violations by degree */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>المخالفات حسب الدرجة</h3>
          {data.violations.byDegree.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>لا توجد مخالفات</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.violations.byDegree.map(d => {
                const dc = DEGREE_COLORS[d.degree] || { label: `${d.degree}`, color: '#374151', bg: '#f3f4f6' };
                const maxCount = Math.max(...data.violations.byDegree.map(x => x.count), 1);
                return (
                  <div key={d.degree} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ minWidth: 60, padding: '4px 8px', borderRadius: 100, fontSize: 12, fontWeight: 700, textAlign: 'center', background: dc.bg, color: dc.color }}>{dc.label}</span>
                    <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 6, height: 24, overflow: 'hidden' }}>
                      <div style={{ width: `${(d.count / maxCount) * 100}%`, height: '100%', background: dc.color, borderRadius: 6, minWidth: d.count > 0 ? 24 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{d.count}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Absence by class */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>متابعة إدخال الغياب</h3>
          {data.absenceByClass.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#9da3b8', fontSize: 12 }}>لا توجد بيانات غياب اليوم</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.absenceByClass.map((ac, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 100, background: '#eef2ff', color: '#6366f1' }}>{ac.className}</span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#475569' }}>{ac.grade}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: ac.count > 0 ? '#dc2626' : '#22c55e' }}>{ac.count}</span>
                </div>
              ))}
            </div>
          )}
          {/* Attendance percentage */}
          {(() => {
            const totalStudents = data.students?.total || 0;
            const todayAbsence = curStageStats ? (curStageStats.absence ?? 0) : data.today.absence;
            const attendPct = totalStudents > 0 ? Math.round(((totalStudents - todayAbsence) / totalStudents) * 100) : 100;
            const pctColor = attendPct >= 95 ? '#22c55e' : attendPct >= 90 ? '#f59e0b' : '#ef4444';
            return (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#9da3b8' }}>نسبة الحضور</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: pctColor }}>{attendPct}%</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ═══════ Row 6: Top Violators + Needs Printing ═══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Top violators */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>أكثر الطلاب مخالفات</h3>
          {data.topViolators.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>لا توجد بيانات</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.topViolators.map((s, i) => (
                <div key={s.studentId} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: i < data.topViolators.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                    background: i === 0 ? '#fee2e2' : i === 1 ? '#fef9c3' : '#f3f4f6',
                    color: i === 0 ? '#dc2626' : i === 1 ? '#ca8a04' : '#6b7280',
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.studentName}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.studentNumber} · {s.grade} {s.className}</div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>-{s.totalDeduction} درجة</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs printing */}
        {data.needsPrinting.length > 0 && (
          <div style={cardStyle}>
            <h3 style={{ ...cardTitleStyle, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => setPrintSectionHidden(h => !h)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ef4444' }}>print</span>
              يحتاج توثيق
              <span style={{ fontSize: 11, fontWeight: 800, color: 'white', background: '#ef4444', padding: '1px 8px', borderRadius: 100 }}>{data.needsPrinting.length}</span>
              <span style={{ marginRight: 'auto', fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>{printSectionHidden ? '▼ إظهار' : '▲ إخفاء'}</span>
            </h3>
            {!printSectionHidden && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Violations */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', marginBottom: 6 }}>مخالفات بدون نماذج</div>
                  {data.needsPrinting.filter(x => x.type === 'مخالفة').map((it, i) => (
                    <PrintItem key={i} item={it} />
                  ))}
                </div>
                {/* Absences */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#ea580c', marginBottom: 6 }}>غياب متكرر</div>
                  {data.needsPrinting.filter(x => x.type === 'غياب').map((it, i) => (
                    <PrintItem key={i} item={it} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════ Row 7: Semester Totals ═══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <MiniStat label="إجمالي الطلاب" value={data.students?.total || 0} color="#4f46e5" />
        <MiniStat label="إجمالي المخالفات (الفصل)" value={data.semesterTotals.violations} color="#dc2626" />
        <MiniStat label="إجمالي الغياب (الفصل)" value={data.semesterTotals.absence} color="#f97316" />
        <MiniStat label="إجمالي الاستئذان (الفصل)" value={data.semesterTotals.permissions} color="#8b5cf6" />
        <MiniStat label="إجمالي التأخر (الفصل)" value={data.semesterTotals.tardiness} color="#ef4444" />
      </div>
    </div>
  );
};

// ═══════ Sub-Components ═══════

const AttentionCard: React.FC<{ icon: string; title: string; count: number; color: string; items: { text: string; tag: string }[] }> = ({ icon, title, count, color, items }) => (
  <div style={{ background: '#fff', borderRadius: 16, padding: 14, border: '1px solid #f0f2f7', boxShadow: '0 1px 4px rgba(0,0,0,.04)', cursor: 'pointer' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1a1d2e', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color }}>{icon}</span> {title}
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, padding: '2px 10px', borderRadius: 100, color: 'white', background: color, minWidth: 28, textAlign: 'center' }}>{count}</div>
    </div>
    {items.length > 0 ? (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: 11, color: '#475569', fontWeight: 500 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.text}</span>
            {it.tag && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 100, background: '#f1f5f9', color: '#64748b', flexShrink: 0 }}>{it.tag}</span>}
          </li>
        ))}
      </ul>
    ) : count === 0 ? (
      <div style={{ textAlign: 'center', padding: 8, color: '#9da3b8', fontSize: 11 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#d1d5db', display: 'block', marginBottom: 2 }}>check_circle</span>لا يوجد
      </div>
    ) : null}
  </div>
);

const SemesterTimeline: React.FC<{ semIdx: number; onSwitch: (idx: number) => void }> = ({ semIdx, onSwitch }) => {
  const sem = SEMESTER_DATES[semIdx];
  const now = new Date();
  const start = new Date(sem.start[0], sem.start[1], sem.start[2]);
  const end = new Date(sem.end[0], sem.end[1], sem.end[2]);
  const isCurrent = now >= start && now <= end;
  const curWeek = isCurrent ? Math.max(1, Math.min(sem.weeks, Math.floor((now.getTime() - start.getTime()) / (7 * 86400000)) + 1)) : (now > end ? sem.weeks : 0);
  const pct = isCurrent ? Math.min(100, Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)) : (now > end ? 100 : 0);
  const remaining = isCurrent ? Math.ceil((end.getTime() - now.getTime()) / 86400000) : 0;
  const holidayWeeks = new Set(sem.events.filter(e => e.type === 'holiday').map(e => e.week));
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const nextEvt = isCurrent ? sem.events.find(e => e.week >= curWeek) : null;

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid #f0f2f7', boxShadow: '0 1px 3px rgba(0,0,0,.05)', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1d2e', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#4f46e5' }}>timeline</span> الخط الزمني
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 600, color: '#9da3b8' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />وطنية</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 600, color: '#9da3b8' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />إجازة</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 600, color: '#9da3b8' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />مناسبة</span>
          </div>
          <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
            {[0, 1].map(idx => (
              <button key={idx} onClick={() => onSwitch(idx)} style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: semIdx === idx ? '#4f46e5' : 'transparent',
                color: semIdx === idx ? 'white' : '#64748b',
                boxShadow: semIdx === idx ? '0 2px 6px rgba(79,70,229,.25)' : 'none',
              }}>{idx === 0 ? 'الأول' : 'الثاني'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline bar */}
      <div style={{ position: 'relative', paddingTop: 40 }}>
        {/* Needle */}
        {isCurrent && (
          <div style={{ position: 'absolute', top: -2, right: `${((curWeek - 0.5) / sem.weeks) * 100}%`, transform: 'translateX(50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'right .6s ease' }}>
            <div style={{ background: '#4f46e5', color: 'white', padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(79,70,229,.35)', position: 'relative' }}>
              الأسبوع {curWeek} · {dayNames[now.getDay()]}
              <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 8, height: 8, background: '#4f46e5', borderRadius: 1 }} />
            </div>
            <div style={{ width: 2, height: 34, background: '#4f46e5', marginTop: 2, borderRadius: 1, boxShadow: '0 0 6px rgba(79,70,229,.3)' }} />
            <div style={{ width: 8, height: 8, background: '#4f46e5', border: '2px solid white', borderRadius: '50%', boxShadow: '0 0 6px rgba(79,70,229,.4)', marginTop: -1 }} />
          </div>
        )}

        {/* Progress bar */}
        <div style={{ position: 'relative', height: 30, background: '#f1f5f9', borderRadius: 15, overflow: 'visible' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#4f46e5,#8b5cf6)', borderRadius: 15, position: 'absolute', top: 0, right: 0, width: `${pct}%`, transition: 'width .6s ease', zIndex: 1 }} />
          <div style={{ display: 'flex', width: '100%', position: 'relative', zIndex: 2 }}>
            {Array.from({ length: sem.weeks }, (_, i) => i + 1).map(w => {
              const cls = isCurrent ? (w > curWeek ? 'future' : w === curWeek ? 'current' : 'passed') : (now < start ? 'future' : 'passed');
              const isHol = holidayWeeks.has(w);
              let clr = cls === 'current' ? 'white' : cls === 'passed' ? 'rgba(255,255,255,.7)' : '#94a3b8';
              let bg = isHol ? (cls === 'future' ? 'rgba(239,68,68,.1)' : 'rgba(239,68,68,.2)') : 'transparent';
              let rad = w === 1 ? '0 15px 15px 0' : (w === sem.weeks ? '15px 0 0 15px' : undefined);
              return (
                <div key={w} style={{
                  flex: 1, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: cls === 'current' ? 900 : 700, color: clr, background: bg,
                  borderLeft: w < sem.weeks ? `1px solid ${cls === 'future' ? '#e2e8f0' : 'rgba(255,255,255,.12)'}` : undefined,
                  borderRadius: rad,
                }}>{w}</div>
              );
            })}
          </div>
        </div>

        {/* Events dots */}
        <div style={{ position: 'relative', height: 24, marginTop: 4 }}>
          {sem.events.map((ev, i) => {
            const ePct = ((ev.week - 0.5) / sem.weeks) * 100;
            const ec = ev.type === 'national' ? '#10b981' : ev.type === 'holiday' ? '#ef4444' : '#6366f1';
            return (
              <div key={i} style={{ position: 'absolute', top: 2, right: `${ePct}%`, transform: 'translateX(50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ec, boxShadow: `0 0 0 2px ${ec}33`, flexShrink: 0 }} />
                <div style={{ fontSize: 7, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', marginTop: 1, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</div>
              </div>
            );
          })}
        </div>

        {/* Week labels */}
        <div style={{ display: 'flex', width: '100%' }}>
          {Array.from({ length: sem.weeks }, (_, i) => i + 1).map(w => (
            <div key={w} style={{ flex: 1, textAlign: 'center', fontSize: 8, fontWeight: w === curWeek && isCurrent ? 800 : 600, color: w === curWeek && isCurrent ? '#4f46e5' : '#94a3b8' }}>
              س{w}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f2f7', flexWrap: 'wrap', gap: 6 }}>
        <SumItem color="#4f46e5" label="الأسبوع" value={`${curWeek} / ${sem.weeks}`} />
        <SumItem color="#10b981" label="مضى" value={`${pct}%`} />
        <SumItem color="#f59e0b" label="باقي" value={`${remaining} يوم`} />
        {nextEvt && <SumItem color={nextEvt.type === 'national' ? '#10b981' : nextEvt.type === 'holiday' ? '#ef4444' : '#6366f1'} label="القادم" value={nextEvt.label} />}
      </div>
    </div>
  );
};

const SumItem: React.FC<{ color: string; label: string; value: string }> = ({ color, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#64748b' }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
    {label}: <span style={{ fontWeight: 800, color: '#1a1d2e' }}>{value}</span>
  </div>
);

const CalendarCard: React.FC = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  let hijriMonth = '';
  try { hijriMonth = now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { month: 'long', year: 'numeric' }); } catch { /* empty */ }

  const holidays = EVENTS_DATA.filter(e => e.m === month + 1 && e.holiday).map(e => e.d);
  const monthEvents = EVENTS_DATA.filter(e => e.m === month + 1);
  const eventDays = new Map<number, CalendarEvent>();
  monthEvents.filter(e => !e.holiday).forEach(e => eventDays.set(e.d, e));

  const dns = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #f0f2f7', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1a1d2e', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#4f46e5' }}>calendar_month</span> {monthNames[month]}
        </span>
        <span style={{ fontSize: 9, color: '#9da3b8', fontWeight: 700 }}>{hijriMonth}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center', marginBottom: 6 }}>
        {dns.map(d => <div key={d} style={{ fontSize: 8, fontWeight: 800, color: '#9da3b8', padding: 2 }}>{d}</div>)}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
          const dow = (firstDay + d - 1) % 7;
          const isOff = dow === 5 || dow === 6;
          const isToday = d === todayDate;
          const isHol = holidays.includes(d);
          const isEv = eventDays.has(d);
          let style: React.CSSProperties = { fontSize: 10, fontWeight: 600, padding: '4px 1px', borderRadius: 6, cursor: 'default' };
          if (isToday) style = { ...style, background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)', color: 'white', fontWeight: 800, boxShadow: '0 3px 10px rgba(79,70,229,.25)' };
          else if (isHol) style = { ...style, color: '#ef4444', textDecoration: 'line-through', fontWeight: 700, background: '#fef2f2' };
          else if (isEv) style = { ...style, color: '#4f46e5', fontWeight: 700, background: '#eef2ff' };
          else if (isOff) style = { ...style, color: '#d1d5db' };
          else style = { ...style, color: '#5c6178' };
          return <div key={d} style={style}>{d}</div>;
        })}
      </div>
      {monthEvents.length > 0 && (
        <div style={{ borderTop: '1px solid #f0f2f7', paddingTop: 6 }}>
          {monthEvents.slice(0, 3).map((ev, i) => {
            const dc = ev.holiday ? '#ef4444' : ev.type === 'national' ? '#10b981' : '#6366f1';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0', fontSize: 9, fontWeight: 600, color: '#5c6178' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: dc, flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.label}</span>
                <span style={{ fontSize: 8, color: '#9da3b8', fontWeight: 700, flexShrink: 0 }}>{ev.d}/{ev.m}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PrintItem: React.FC<{ item: NeedsPrintItem }> = ({ item }) => {
  const isViol = item.type === 'مخالفة';
  const degBg = isViol ? (item.degree >= 4 ? '#dc2626' : item.degree >= 3 ? '#f97316' : '#f59e0b') : '#ea580c';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 4, background: '#f8fafc', borderRadius: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 900, color: 'white', background: degBg, padding: '1px 6px', borderRadius: 100, flexShrink: 0 }}>
        {isViol ? `د${item.degree}` : `${item.degree}x`}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1d2e', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#9da3b8', flexShrink: 0 }}>{item.grade}</span>
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #e5e7eb', textAlign: 'center' }}>
    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
  </div>
);

// ═══════ Styles ═══════
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb' };
const cardTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#111', margin: '0 0 12px' };
const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 12, border: active ? '2px solid #4f46e5' : '2px solid #e8ebf2',
  background: active ? '#eef2ff' : '#fff', color: active ? '#4f46e5' : '#374151',
  fontWeight: active ? 700 : 400, fontSize: 12, cursor: 'pointer',
});

export default DashboardPage;
