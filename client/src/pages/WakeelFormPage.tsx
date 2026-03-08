import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { staffInputApi, StaffVerifyData, StaffStudent, StudentsMap, TodayEntries } from '../api/staffInput';
import { teacherInputApi } from '../api/teacherInput';
import { getTodayHijri } from '../utils/hijriDate';

// ═══════════════════════════════════════════
// Static Data — exact match to original GAS
// ═══════════════════════════════════════════

interface ViolationItem { id: number; stage: string; type: string; degree: number; degree_primary?: number; text: string; }
interface NoteItem { id: number; text: string; }
interface PositiveNoteItem { id: number; text: string; cat: string; }
interface PositiveItem { id: number; text: string; degree: number; group: string; }

const VIOLATIONS: ViolationItem[] = [
  {id:101,stage:'الكل',type:'حضوري',degree:1,text:'التأخر الصباحي'},
  {id:102,stage:'الكل',type:'حضوري',degree:1,text:'عدم حضور الاصطفاف الصباحي'},
  {id:103,stage:'الكل',type:'حضوري',degree:1,text:'التأخر عن الاصطفاف الصباحي أو العبث أثناءه'},
  {id:104,stage:'الكل',type:'حضوري',degree:1,text:'التأخر في الدخول إلى الحصص'},
  {id:105,stage:'متوسط وثانوي',type:'حضوري',degree:1,text:'إعاقة سير الحصص الدراسية'},
  {id:106,stage:'الكل',type:'حضوري',degree:1,text:'النوم داخل الفصل'},
  {id:107,stage:'الكل',type:'حضوري',degree:1,text:'تكرار خروج ودخول الطلبة من البوابة قبل وقت الحضور والانصراف'},
  {id:108,stage:'الكل',type:'حضوري',degree:1,text:'التجمهر أمام بوابة المدرسة'},
  {id:109,stage:'ابتدائي',type:'حضوري',degree:1,text:'تناول الأطعمة أو المشروبات أثناء الدرس بدون استئذان'},
  {id:201,stage:'الكل',type:'حضوري',degree:2,text:'عدم حضور الحصة الدراسية أو الهروب منها'},
  {id:202,stage:'الكل',type:'حضوري',degree:2,text:'الدخول أو الخروج من الفصل دون استئذان'},
  {id:203,stage:'الكل',type:'حضوري',degree:2,text:'دخول فصل آخر دون استئذان'},
  {id:204,stage:'الكل',type:'حضوري',degree:2,text:'إثارة الفوضى داخل الفصل أو المدرسة أو وسائل النقل المدرسي'},
  {id:301,stage:'الكل',type:'حضوري',degree:3,degree_primary:1,text:'عدم التقيد بالزي المدرسي'},
  {id:302,stage:'الكل',type:'حضوري',degree:3,degree_primary:2,text:'الشجار أو الاشتراك في مضاربة جماعية'},
  {id:303,stage:'الكل',type:'حضوري',degree:3,degree_primary:2,text:'الإشارة بحركات مخلة بالأدب تجاه الطلبة'},
  {id:304,stage:'الكل',type:'حضوري',degree:3,degree_primary:2,text:'التلفظ بكلمات نابية على الطلبة أو تهديدهم أو السخرية منهم'},
  {id:305,stage:'الكل',type:'حضوري',degree:3,degree_primary:2,text:'إلحاق الضرر المتعمد بممتلكات الطلبة'},
  {id:306,stage:'الكل',type:'حضوري',degree:3,degree_primary:2,text:'العبث بتجهيزات المدرسة أو مبانيها وحافلاتها'},
  {id:307,stage:'متوسط وثانوي',type:'حضوري',degree:3,text:'إحضار المواد أو الألعاب الخطرة دون استخدامها'},
  {id:308,stage:'الكل',type:'حضوري',degree:3,degree_primary:4,text:'حيازة السجائر بأنواعها'},
  {id:309,stage:'الكل',type:'حضوري',degree:3,degree_primary:4,text:'حيازة المواد الإعلامية الممنوعة'},
  {id:310,stage:'الكل',type:'حضوري',degree:3,text:'التوقيع عن ولي الأمر من غير علمه على المكاتبات'},
  {id:311,stage:'الكل',type:'حضوري',degree:3,degree_primary:2,text:'امتهان الكتب الدراسية'},
  {id:401,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'التعرض لأحد الطلبة بالضرب أو تعمد إصابته'},
  {id:402,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'سرقة شيء من ممتلكات الطلبة أو المدرسة'},
  {id:403,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'التصوير أو التسجيل الصوتي للطلبة'},
  {id:404,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'إلحاق الضرر المتعمد بتجهيزات المدرسة أو مبانيها'},
  {id:405,stage:'الكل',type:'حضوري',degree:4,text:'التدخين بأنواعه داخل المدرسة'},
  {id:406,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'الهروب من المدرسة'},
  {id:407,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'إحضار أو استخدام المواد أو الألعاب الخطرة'},
  {id:408,stage:'الكل',type:'حضوري',degree:4,text:'عرض أو توزيع المواد الإعلامية الممنوعة'},
  {id:501,stage:'الكل',type:'حضوري',degree:5,degree_primary:4,text:'الإساءة أو الاستهزاء بشيء من شعائر الإسلام'},
  {id:502,stage:'الكل',type:'حضوري',degree:5,degree_primary:4,text:'الإساءة للدولة أو رموزها'},
  {id:503,stage:'متوسط وثانوي',type:'حضوري',degree:5,text:'بث أو ترويج أفكار ومعتقدات متطرفة أو تكفيرية'},
  {id:504,stage:'متوسط وثانوي',type:'حضوري',degree:5,text:'الإساءة للأديان السماوية أو إثارة العنصرية والفتن'},
  {id:505,stage:'متوسط وثانوي',type:'حضوري',degree:5,text:'التزوير أو استخدام الوثائق والأختام الرسمية'},
  {id:506,stage:'الكل',type:'حضوري',degree:5,degree_primary:4,text:'التحرش الجنسي'},
  {id:507,stage:'الكل',type:'حضوري',degree:5,degree_primary:4,text:'المظاهر أو الصور أو الشعارات التي تدل على الشذوذ الجنسي أو الترويج لها'},
  {id:508,stage:'الكل',type:'حضوري',degree:5,degree_primary:4,text:'إشعال النار داخل المدرسة'},
  {id:509,stage:'الكل',type:'حضوري',degree:5,degree_primary:4,text:'حيازة آلة حادة أو أسلحة نارية'},
  {id:510,stage:'متوسط وثانوي',type:'حضوري',degree:5,text:'حيازة أو تعاطي أو ترويج المخدرات والمسكرات'},
  {id:511,stage:'الكل',type:'حضوري',degree:5,degree_primary:4,text:'الجرائم المعلوماتية بكافة أنواعها'},
  {id:512,stage:'متوسط وثانوي',type:'حضوري',degree:5,text:'ابتزاز الطلبة'},
  {id:513,stage:'الكل',type:'حضوري',degree:5,degree_primary:4,text:'التنمر بجميع أنواعه وأشكاله'},
  {id:601,stage:'الكل',type:'رقمي',degree:1,text:'التأخر في حضور الحصة الافتراضية'},
  {id:602,stage:'الكل',type:'رقمي',degree:1,text:'الخروج المتكرر من الحصص الافتراضية بدون عذر'},
  {id:603,stage:'الكل',type:'رقمي',degree:1,text:'إعاقة سير الحصص الافتراضية'},
  {id:604,stage:'الكل',type:'رقمي',degree:2,text:'الهروب من الحصة الافتراضية'},
  {id:605,stage:'الكل',type:'رقمي',degree:2,text:'الإرسال المتعمد لمواد أو روابط ليس لها علاقة بالمحتوى'},
  {id:606,stage:'الكل',type:'رقمي',degree:3,degree_primary:2,text:'استخدام صور منافية للقيم والذوق العام'},
  {id:607,stage:'الكل',type:'رقمي',degree:3,degree_primary:2,text:'التلفظ بكلمات نابية أو التهديد أو السخرية من الطلبة'},
  {id:608,stage:'متوسط وثانوي',type:'رقمي',degree:3,text:'تصوير أو تسجيل الدروس الافتراضية ونشرها'},
  {id:609,stage:'الكل',type:'رقمي',degree:3,text:'إساءة استخدام معلومات الدخول الشخصية'},
  {id:610,stage:'الكل',type:'رقمي',degree:4,degree_primary:3,text:'كتابة عبارات أو إرسال صور أو مقاطع مخلة بالآداب للمعلمين أو الطلبة'},
  {id:611,stage:'الكل',type:'رقمي',degree:4,degree_primary:3,text:'التصوير أو التسجيل الصوتي للمعلمين أو للطلبة'},
  {id:612,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'التنمر الإلكتروني'},
  {id:613,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'التحرش الجنسي الإلكتروني'},
  {id:614,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'الإساءة أو الاستهزاء بشيء من شعائر الإسلام (إلكتروني)'},
  {id:615,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'الإساءة للدولة أو رموزها (إلكتروني)'},
  {id:616,stage:'متوسط وثانوي',type:'رقمي',degree:5,text:'بث أو ترويج أفكار متطرفة أو الإساءة للأديان السماوية (إلكتروني)'},
  {id:617,stage:'متوسط وثانوي',type:'رقمي',degree:5,text:'ابتزاز الطلبة (إلكتروني)'},
  {id:618,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'المظاهر أو الشعارات الدالة على الشذوذ الجنسي (إلكتروني)'},
  {id:619,stage:'متوسط وثانوي',type:'رقمي',degree:5,text:'الترويج للمخدرات (إلكتروني)'},
  {id:620,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'الجرائم المعلوماتية بكافة أنواعها (إلكتروني)'},
  {id:701,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'تهديد المعلمين أو الإداريين'},
  {id:702,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'التلفظ بألفاظ غير لائقة تجاه المعلمين أو الإداريين'},
  {id:706,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'السخرية من المعلمين أو الإداريين قولاً أو فعلاً'},
  {id:707,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'التوقيع عن أحد منسوبي المدرسة على المكاتبات'},
  {id:708,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'تصوير المعلمين أو الإداريين أو التسجيل الصوتي لهم بدون إذن'},
  {id:703,stage:'الكل',type:'هيئة تعليمية',degree:5,text:'الاعتداء بالضرب على المعلمين أو الإداريين'},
  {id:704,stage:'الكل',type:'هيئة تعليمية',degree:5,text:'ابتزاز المعلمين أو الإداريين'},
  {id:705,stage:'الكل',type:'هيئة تعليمية',degree:5,text:'الجرائم المعلوماتية تجاه المعلمين أو الإداريين'},
  {id:709,stage:'الكل',type:'هيئة تعليمية',degree:5,text:'إلحاق الضرر بممتلكات المعلمين أو الإداريين أو سرقتها'},
  {id:710,stage:'الكل',type:'هيئة تعليمية',degree:5,text:'الإشارة بحركات مخلة بالأدب تجاه المعلمين أو الإداريين'},
];

const NOTES: NoteItem[] = [
  {id:1,text:'عدم حل الواجب'},{id:2,text:'عدم الحفظ'},
  {id:3,text:'عدم المشاركة والتفاعل'},{id:4,text:'عدم إحضار الكتاب الدراسي'},
  {id:5,text:'عدم إحضار الدفتر'},{id:6,text:'كثرة السرحان داخل الفصل'},
  {id:7,text:'عدم إحضار أدوات الرسم'},{id:8,text:'عدم إحضار الأدوات الهندسية'},
  {id:9,text:'عدم إحضار الملابس الرياضية'},{id:10,text:'النوم داخل الفصل'},
  {id:11,text:'عدم تدوين الملاحظات مع المعلم'},{id:12,text:'إهمال تسليم البحوث والمشاريع'},
  {id:13,text:'عدم المذاكرة للاختبارات القصيرة'},{id:14,text:'الانشغال بمادة أخرى أثناء الحصة'},
  {id:15,text:'عدم تصحيح الأخطاء في الدفتر'},{id:16,text:'عدم إحضار ملف الإنجاز'},
];

const POSITIVE_NOTES: Record<string, PositiveNoteItem[]> = {
  'ابتدائي': [
    {id:101,text:'بطل الفصل اليوم، شكراً لدعمكم',cat:'عام'},
    {id:102,text:'ملتزم جداً بنظام الفصل اليوم',cat:'انضباط'},
    {id:103,text:'خلوق ومؤدب مع زملائه، بارك الله في تربيتكم',cat:'أخلاق'},
    {id:104,text:'مبدعنا مستمر في تميزه لليوم، استمر يا بطل!',cat:'إنجاز'},
  ],
  'متوسط': [
    {id:201,text:'حضور مميز وتفاعل ذكي اليوم',cat:'عام'},
    {id:202,text:'كل التقدير لانضباطه وحرصه العالي في الحصة',cat:'انضباط'},
    {id:203,text:'خُلقه الراقي اليوم نموذج يفتخر به',cat:'أخلاق'},
    {id:204,text:'مستمر في وتيرة الإنجاز العالية، فخورون به',cat:'إنجاز'},
  ],
  'ثانوي': [
    {id:301,text:'تقديري لتميزه وانضباطه خلال حصة اليوم',cat:'عام'},
    {id:302,text:'جديته وانضباطه الذاتي يجعله قدوة لزملائه',cat:'انضباط'},
    {id:303,text:'نموذج للشاب الخلوق والمحترم، فخور بوجوده',cat:'أخلاق'},
    {id:304,text:'ثبات مستواه وتطوره المستمر، إلى القمة دائماً',cat:'إنجاز'},
  ],
};

const POSITIVE: PositiveItem[] = [
  {id:1,text:'انضباط الطالب وعدم غيابه بدون عذر خلال الفصل الدراسي',degree:6,group:'6 درجات'},
  {id:2,text:'المشاركة في الخدمة المجتمعية خارج المدرسة',degree:6,group:'6 درجات / مشاركة'},
  {id:3,text:'تقديم فعالية حوارية',degree:6,group:'6 درجات / مشاركة'},
  {id:4,text:'المشاركة في حملة توعوية',degree:6,group:'6 درجات / مشاركة'},
  {id:5,text:'عرض تجارب شخصية ناجحة',degree:6,group:'6 درجات / مشاركة'},
  {id:6,text:'الالتحاق ببرنامج أو دورة',degree:6,group:'6 درجات / مشاركة'},
  {id:7,text:'مهارات الاتصال (العمل الجماعي، التعلم بالأقران)',degree:4,group:'4 درجات / مشاركة'},
  {id:8,text:'مهارات القيادة والمسؤولية (التخطيط، التحفيز)',degree:4,group:'4 درجات / مشاركة'},
  {id:9,text:'المهارات الرقمية (إعداد العروض، تصميم المحتوى الإلكتروني)',degree:4,group:'4 درجات / مشاركة'},
  {id:10,text:'مهارة إدارة الوقت',degree:4,group:'4 درجات / مشاركة'},
  {id:11,text:'كتابة رسالة شكر (للوطن، للقيادة الرشيدة، للأسرة، للمعلم)',degree:2,group:'درجتان / مشاركة'},
  {id:12,text:'المشاركة في الإذاعة',degree:2,group:'درجتان / مشاركة'},
  {id:13,text:'تقديم مقترح لصالح المجتمع المدرسي',degree:2,group:'درجتان / مشاركة'},
  {id:14,text:'التعاون مع الزملاء والمعلمين وإدارة المدرسة',degree:2,group:'درجتان / مشاركة'},
];

const DEGREE_COLORS: Record<number, string> = {1:'#d1fae5',2:'#fef3c7',3:'#fed7aa',4:'#fecaca',5:'#e9d5ff'};
const DEGREE_TEXT: Record<number, string> = {1:'#065f46',2:'#92400e',3:'#9a3412',4:'#991b1b',5:'#6b21a8'};
const DEGREE_LABELS: Record<number, string> = {1:'الأولى',2:'الثانية',3:'الثالثة',4:'الرابعة',5:'الخامسة'};
const POS_DEG_COLORS: Record<number, string> = {6:'#dcfce7',4:'#fef9c3',2:'#dbeafe'};
const POS_DEG_TEXT: Record<number, string> = {6:'#166534',4:'#854d0e',2:'#1e40af'};
const REASONS = ['ظرف صحي', 'ظرف أسري', 'موعد حكومي', 'طلب ولي الأمر'];
const GUARDIANS = ['الأب', 'الأخ', 'الأم', 'أخرى'];

function isViolAvailable(v: ViolationItem, stage: string) {
  if (!stage || v.stage === 'الكل') return true;
  if (stage === 'ابتدائي') return v.stage === 'ابتدائي' || v.stage === 'الكل';
  return v.stage === 'متوسط وثانوي' || v.stage === 'الكل';
}
function effectiveDeg(v: ViolationItem, stage: string) {
  return (stage === 'ابتدائي' && v.degree_primary) ? v.degree_primary : v.degree;
}

// ═══════════════════════════════════════════
// Tab configs
// ═══════════════════════════════════════════

type TabId = 'violations' | 'absence' | 'positive' | 'notes' | 'permission' | 'tardiness';

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: 'violations', label: 'مخالفات', color: '#ef4444' },
  { id: 'absence', label: 'غياب', color: '#f59e0b' },
  { id: 'positive', label: 'سلوك', color: '#22c55e' },
  { id: 'notes', label: 'ملاحظات', color: '#06b6d4' },
  { id: 'permission', label: 'استئذان', color: '#3b82f6' },
  { id: 'tardiness', label: 'تأخر', color: '#f97316' },
];

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

export default function WakeelFormPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  // Page state
  const [pageData, setPageData] = useState<StaffVerifyData | null>(null);
  const [studentsMap, setStudentsMap] = useState<StudentsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [tab, setTab] = useState<TabId>('violations');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<StaffStudent[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Tab-specific state
  const [violSubType, setViolSubType] = useState('حضوري');
  const [violSearch, setViolSearch] = useState('');
  const [selectedViol, setSelectedViol] = useState<ViolationItem | null>(null);
  const [absenceType, setAbsenceType] = useState('يوم كامل');
  const [selectedPositive, setSelectedPositive] = useState<PositiveItem | null>(null);
  const [positiveDetails, setPositiveDetails] = useState('');
  const [noteSubType, setNoteSubType] = useState('سلبية');
  const [selectedNote, setSelectedNote] = useState<{ id: number; text: string } | null>(null);
  const [noteDetails, setNoteDetails] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [guardian, setGuardian] = useState(GUARDIANS[0]);

  // Log modal
  const [showLog, setShowLog] = useState(false);
  const [logData, setLogData] = useState<TodayEntries | null>(null);

  // ── Load data ──
  const loadData = useCallback(async () => {
    if (!token) { setError('لا يوجد رمز'); setLoading(false); return; }
    try {
      const [vRes, sRes] = await Promise.all([
        staffInputApi.verify(token),
        staffInputApi.getStudents(token),
      ]);
      if (vRes.data?.data) setPageData(vRes.data.data);
      if (sRes.data?.data) setStudentsMap(sRes.data.data);
    } catch {
      setError('رابط غير صالح أو حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ──
  const stages = useMemo(() => Object.keys(studentsMap), [studentsMap]);
  const grades = useMemo(() =>
    selectedStage && studentsMap[selectedStage] ? Object.keys(studentsMap[selectedStage]) : [],
    [studentsMap, selectedStage]);
  const classes = useMemo(() =>
    selectedStage && selectedGrade && studentsMap[selectedStage]?.[selectedGrade]
      ? Object.keys(studentsMap[selectedStage][selectedGrade]) : [],
    [studentsMap, selectedStage, selectedGrade]);

  const currentStudents = useMemo(() => {
    if (!selectedStage || !selectedGrade) return [];
    // Permission & Tardiness: load all students for grade (all classes) — ★ مع معلومات الفصل
    if (tab === 'permission' || tab === 'tardiness') {
      const gradeData = studentsMap[selectedStage]?.[selectedGrade];
      if (!gradeData) return [];
      const result: (StaffStudent & { _cls?: string; _sec?: string })[] = [];
      for (const cls of Object.keys(gradeData).sort()) {
        for (const s of gradeData[cls]) {
          result.push({ ...s, _cls: `${selectedGrade} ${cls}`, _sec: cls });
        }
      }
      result.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      return result;
    }
    // Other tabs: need class selected
    if (!selectedClass) return [];
    return studentsMap[selectedStage]?.[selectedGrade]?.[selectedClass] || [];
  }, [studentsMap, selectedStage, selectedGrade, selectedClass, tab]);

  const filteredStudents = useMemo(() => {
    if (!search) return currentStudents;
    const q = search.toLowerCase();
    return currentStudents.filter(s => s.name.toLowerCase().includes(q));
  }, [currentStudents, search]);

  const isSelected = useCallback((id: number) =>
    selectedStudents.some(s => s.id === id), [selectedStudents]);

  const toggleStudent = useCallback((s: StaffStudent) => {
    setSelectedStudents(prev =>
      prev.some(x => x.id === s.id) ? prev.filter(x => x.id !== s.id) : [...prev, s]
    );
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents([...filteredStudents]);
    }
  }, [filteredStudents, selectedStudents]);

  // ── Tab change ──
  const handleTabChange = useCallback((newTab: TabId) => {
    setTab(newTab);
    setSelectedStudents([]);
    setSelectedViol(null);
    setSelectedPositive(null);
    setSelectedNote(null);
    setSearch('');
    setMsg(null);
    // Keep stage/grade/class selection
  }, []);

  // ── Stage/grade/class change ──
  const handleStageChange = useCallback((s: string) => {
    setSelectedStage(s);
    setSelectedGrade('');
    setSelectedClass('');
    setSelectedStudents([]);
  }, []);

  const handleGradeChange = useCallback((g: string) => {
    setSelectedGrade(g);
    setSelectedClass('');
    setSelectedStudents([]);
  }, []);

  // ── Violations list ──
  const filteredViolations = useMemo(() => {
    let list = VIOLATIONS.filter(v => v.type === violSubType && isViolAvailable(v, selectedStage));
    if (violSearch) {
      const q = violSearch.toLowerCase();
      list = list.filter(v => v.text.toLowerCase().includes(q));
    }
    return list;
  }, [violSubType, selectedStage, violSearch]);

  // ── Notes list ──
  const currentNotes = useMemo(() => {
    if (noteSubType === 'سلبية') return NOTES;
    return POSITIVE_NOTES[selectedStage] || POSITIVE_NOTES['متوسط'] || [];
  }, [noteSubType, selectedStage]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (selectedStudents.length === 0) return;
    setSubmitting(true);
    setMsg(null);
    try {
      if (tab === 'permission') {
        await staffInputApi.savePermission({
          token,
          studentIds: selectedStudents.map(s => s.id),
          reason,
          guardian,
        });
      } else if (tab === 'tardiness') {
        await staffInputApi.saveTardiness({
          token,
          studentIds: selectedStudents.map(s => s.id),
        });
      } else {
        // Use teacherInput submit for violations, absence, notes, positive
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const today = new Date();
        const dayName = dayNames[today.getDay()];

        let inputType = '';
        let itemId = '';
        let itemText = '';
        let itemDegree = '';
        let violationType = '';
        let noteClassification = '';
        let details = '';

        if (tab === 'violations' && selectedViol) {
          inputType = 'violation';
          itemId = String(selectedViol.id);
          itemText = selectedViol.text;
          itemDegree = String(effectiveDeg(selectedViol, selectedStage));
          violationType = selectedViol.type;
        } else if (tab === 'absence') {
          inputType = 'absence';
        } else if (tab === 'positive' && selectedPositive) {
          inputType = 'positive';
          itemId = String(selectedPositive.id);
          itemText = selectedPositive.text;
          itemDegree = String(selectedPositive.degree);
          details = positiveDetails;
        } else if (tab === 'notes' && selectedNote) {
          inputType = noteSubType === 'سلبية' ? 'note' : 'positive-note';
          itemId = String(selectedNote.id);
          itemText = selectedNote.text;
          noteClassification = noteSubType;
          details = noteDetails;
        } else {
          setMsg({ text: 'يرجى اختيار عنصر', type: 'error' });
          setSubmitting(false);
          return;
        }

        await teacherInputApi.submit({
          token,
          teacherName: pageData?.staff.name || '',
          className: selectedClass || `${selectedGrade}`,
          inputType,
          itemId,
          itemText,
          itemDegree,
          violationType,
          absenceType: tab === 'absence' ? absenceType : undefined,
          details,
          noteClassification,
          hijriDate: getTodayHijri(),
          dayName,
          noAbsence: false,
          notifyDeputy: false,
          students: selectedStudents.map(s => ({ id: String(s.id), name: s.name, phone: s.phone })),
        });
      }

      setMsg({ text: `تم التسجيل بنجاح (${selectedStudents.length} طالب)`, type: 'success' });
      setSelectedStudents([]);
    } catch {
      setMsg({ text: 'حدث خطأ أثناء الحفظ', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [tab, token, selectedStudents, selectedViol, selectedStage, selectedClass, selectedGrade,
    selectedPositive, positiveDetails, selectedNote, noteSubType, noteDetails, reason, guardian,
    absenceType, pageData]);

  // ── Log ──
  const loadLog = useCallback(async () => {
    try {
      const res = await staffInputApi.getTodayEntries(token);
      if (res.data?.data) setLogData(res.data.data);
    } catch { /* empty */ }
    setShowLog(true);
  }, [token]);

  // ── Auto-hide message ──
  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  // ── Render ──
  if (loading) return <div style={S.loadingPage}>جاري التحميل...</div>;
  if (error) return (
    <div style={S.errorPage}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{error}</div>
    </div>
  );

  const tabColor = TABS.find(t => t.id === tab)?.color || '#3b82f6';
  const needsClass = tab !== 'permission' && tab !== 'tardiness';

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ fontSize: '18px', fontWeight: 800 }}>نموذج الوكيل</div>
        <div style={{ fontSize: '13px', opacity: 0.85 }}>{pageData?.staff.name} — {pageData?.sn}</div>
        <button onClick={() => loadData()} style={S.refreshBtn}>تحديث</button>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => handleTabChange(t.id)} style={{
            ...S.tabBtn,
            borderBottom: tab === t.id ? `3px solid ${t.color}` : '3px solid transparent',
            color: tab === t.id ? t.color : '#6b7280',
            fontWeight: tab === t.id ? 700 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          margin: '8px 16px', padding: '10px 16px', borderRadius: '8px',
          background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'success' ? '#166534' : '#991b1b',
          fontSize: '14px', fontWeight: 600, textAlign: 'center',
        }}>
          {msg.text}
        </div>
      )}

      {/* Content */}
      <div style={S.content}>
        {/* Stage/Grade/Class selectors */}
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: needsClass ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
            <select value={selectedStage} onChange={e => handleStageChange(e.target.value)} style={S.select}>
              <option value="">المرحلة</option>
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={selectedGrade} onChange={e => handleGradeChange(e.target.value)} style={S.select}>
              <option value="">الصف</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {needsClass && (
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudents([]); }} style={S.select}>
                <option value="">الفصل</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Tab-specific content */}
        {tab === 'violations' && (
          <div style={S.card}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              {['حضوري', 'رقمي', 'هيئة تعليمية'].map(t => (
                <button key={t} onClick={() => setViolSubType(t)} style={{
                  ...S.pillBtn,
                  background: violSubType === t ? '#ef4444' : '#f3f4f6',
                  color: violSubType === t ? '#fff' : '#374151',
                }}>{t}</button>
              ))}
            </div>
            <input placeholder="بحث في المخالفات..." value={violSearch}
              onChange={e => setViolSearch(e.target.value)} style={S.searchInput} />
            <div style={S.scrollList}>
              {filteredViolations.map(v => {
                const deg = effectiveDeg(v, selectedStage);
                const active = selectedViol?.id === v.id;
                return (
                  <div key={v.id} onClick={() => setSelectedViol(active ? null : v)} style={{
                    ...S.listItem,
                    background: active ? '#fef2f2' : '#fff',
                    borderRight: `4px solid ${active ? '#ef4444' : DEGREE_COLORS[deg]}`,
                  }}>
                    <span style={{ flex: 1, fontSize: '13px' }}>{v.text}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                      background: DEGREE_COLORS[deg], color: DEGREE_TEXT[deg],
                    }}>{DEGREE_LABELS[deg]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'absence' && (
          <div style={S.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {['يوم كامل', 'حصة'].map(t => (
                <div key={t} onClick={() => setAbsenceType(t)} style={{
                  padding: '20px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                  border: `2px solid ${absenceType === t ? '#f59e0b' : '#e5e7eb'}`,
                  background: absenceType === t ? '#fffbeb' : '#fff',
                  fontWeight: 700, fontSize: '15px',
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '4px' }}>{t === 'يوم كامل' ? '📅' : '⏱️'}</div>
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'positive' && (
          <div style={S.card}>
            <div style={S.scrollList}>
              {POSITIVE.map(p => {
                const active = selectedPositive?.id === p.id;
                return (
                  <div key={p.id} onClick={() => setSelectedPositive(active ? null : p)} style={{
                    ...S.listItem,
                    background: active ? '#f0fdf4' : '#fff',
                    borderRight: `4px solid ${active ? '#22c55e' : POS_DEG_COLORS[p.degree] || '#e5e7eb'}`,
                  }}>
                    <span style={{ flex: 1, fontSize: '13px' }}>{p.text}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                      background: POS_DEG_COLORS[p.degree], color: POS_DEG_TEXT[p.degree],
                    }}>{p.degree} درجات</span>
                  </div>
                );
              })}
            </div>
            {selectedPositive && (
              <textarea placeholder="تفاصيل إضافية (اختياري)..." value={positiveDetails}
                onChange={e => setPositiveDetails(e.target.value)} style={S.textarea} rows={2} />
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div style={S.card}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              {['سلبية', 'إشادة'].map(t => (
                <button key={t} onClick={() => { setNoteSubType(t); setSelectedNote(null); }} style={{
                  ...S.pillBtn,
                  background: noteSubType === t ? '#06b6d4' : '#f3f4f6',
                  color: noteSubType === t ? '#fff' : '#374151',
                }}>{t === 'سلبية' ? 'ملاحظات سلبية' : 'إشادة'}</button>
              ))}
            </div>
            <div style={S.scrollList}>
              {currentNotes.map((n: any) => {
                const active = selectedNote?.id === n.id;
                return (
                  <div key={n.id} onClick={() => setSelectedNote(active ? null : n)} style={{
                    ...S.listItem,
                    background: active ? '#ecfeff' : '#fff',
                    borderRight: `4px solid ${active ? '#06b6d4' : '#e5e7eb'}`,
                  }}>
                    <span style={{ flex: 1, fontSize: '13px' }}>{n.text}</span>
                    {'cat' in n && <span style={{ fontSize: '11px', color: '#9ca3af' }}>{(n as PositiveNoteItem).cat}</span>}
                  </div>
                );
              })}
            </div>
            {selectedNote && (
              <textarea placeholder="تفاصيل إضافية (اختياري)..." value={noteDetails}
                onChange={e => setNoteDetails(e.target.value)} style={S.textarea} rows={2} />
            )}
          </div>
        )}

        {tab === 'permission' && (
          <div style={S.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <select value={reason} onChange={e => setReason(e.target.value)} style={S.select}>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={guardian} onChange={e => setGuardian(e.target.value)} style={S.select}>
                {GUARDIANS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Student selector */}
        {(selectedStage && selectedGrade && (!needsClass || selectedClass)) && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>
                اختر الطلاب
                {selectedStudents.length > 0 && (
                  <span style={{
                    marginRight: '8px', padding: '2px 10px', borderRadius: '12px',
                    background: tabColor, color: '#fff', fontSize: '12px',
                  }}>{selectedStudents.length}</span>
                )}
              </span>
              <button onClick={toggleAll} style={{ ...S.pillBtn, background: '#f3f4f6', fontSize: '12px' }}>
                {selectedStudents.length === filteredStudents.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            </div>
            <input placeholder="بحث عن طالب..." value={search}
              onChange={e => setSearch(e.target.value)} style={S.searchInput} />

            {/* Selected chips */}
            {selectedStudents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '8px 0' }}>
                {selectedStudents.map(s => {
                  const sec = (s as any)._sec;
                  return (
                  <span key={s.id} onClick={() => toggleStudent(s)} style={{
                    padding: '4px 10px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
                    background: tabColor + '20', color: tabColor, fontWeight: 600,
                  }}>
                    {s.name.split(' ').slice(0, 2).join(' ')}{sec ? ` (${sec})` : ''} ✕
                  </span>
                  );
                })}
              </div>
            )}

            <div style={S.scrollList}>
              {filteredStudents.map(s => {
                const sec = (s as any)._sec;
                return (
                <div key={s.id} onClick={() => toggleStudent(s)} style={{
                  ...S.studentItem,
                  background: isSelected(s.id) ? tabColor + '10' : '#fff',
                }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '4px',
                    border: `2px solid ${isSelected(s.id) ? tabColor : '#d1d5db'}`,
                    background: isSelected(s.id) ? tabColor : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '12px', fontWeight: 700,
                  }}>
                    {isSelected(s.id) && '✓'}
                  </div>
                  <span style={{ fontSize: '14px', flex: 1 }}>{s.name}</span>
                  {sec && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', background: '#f3f4f6', color: '#6b7280' }}>{sec}</span>}
                </div>
                );
              })}
              {filteredStudents.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                  {currentStudents.length === 0 ? 'اختر المرحلة والصف' : 'لا توجد نتائج'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={S.bottomBar}>
        <button onClick={handleSubmit} disabled={submitting || selectedStudents.length === 0} style={{
          ...S.submitBtn,
          background: selectedStudents.length > 0 ? tabColor : '#d1d5db',
          opacity: submitting ? 0.6 : 1,
        }}>
          {submitting ? 'جاري الإرسال...' : `إرسال (${selectedStudents.length})`}
        </button>
        <button onClick={loadLog} style={S.logBtn}>سجل اليوم</button>
      </div>

      {/* Log modal */}
      {showLog && (
        <div style={S.overlay} onClick={() => setShowLog(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>سجل اليوم</span>
              <button onClick={() => setShowLog(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
              {logData?.entries ? (() => {
                const entries = logData.entries;
                const stageKeys = Object.keys(entries);
                const total = stageKeys.reduce((sum, k) => sum + entries[k].length, 0);
                if (total === 0) return <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>📭 لا توجد سجلات</div>;
                return stageKeys.map(st => {
                  const arr = entries[st];
                  if (!arr?.length) return null;
                  return (
                    <div key={st}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#6b7280', padding: '8px 12px', background: '#f3f4f6', borderRadius: '10px', margin: '12px 0 8px', textAlign: 'center' }}>🔷 {st} ({arr.length})</div>
                      {arr.map((e, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700 }}>{e.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', color: '#fff', background: e.type === 'استئذان' ? '#3b82f6' : '#ea580c' }}>
                            {e.type} {e.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                });
              })() : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>لا توجد سجلات اليوم</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════

const S: Record<string, React.CSSProperties> = {
  page: { direction: 'rtl', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif", minHeight: '100vh', background: '#f0f2f5', paddingBottom: '70px' },
  loadingPage: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif", fontSize: '16px', color: '#6b7280' },
  errorPage: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif" },
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: '#fff',
    padding: '16px 20px', textAlign: 'center',
  },
  refreshBtn: {
    position: 'absolute', left: '16px', top: '16px',
    border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff',
    padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
  },
  tabBar: {
    display: 'flex', background: '#fff', overflowX: 'auto',
    borderBottom: '1px solid #e5e7eb', position: 'sticky', top: '76px', zIndex: 99,
  },
  tabBtn: {
    flex: 1, padding: '12px 8px', border: 'none', background: 'none',
    fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif",
  },
  content: { maxWidth: '600px', margin: '0 auto', padding: '12px 16px' },
  card: { background: '#fff', borderRadius: '16px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  select: { width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif" },
  searchInput: { width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif", marginBottom: '8px', boxSizing: 'border-box' },
  pillBtn: { padding: '6px 14px', borderRadius: '100px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif" },
  scrollList: { maxHeight: '280px', overflowY: 'auto' },
  listItem: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.15s',
  },
  studentItem: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
  },
  textarea: { width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif", marginTop: '8px', boxSizing: 'border-box', resize: 'vertical' },
  bottomBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    display: 'flex', gap: '8px', padding: '12px 16px',
    background: '#fff', borderTop: '1px solid #e5e7eb', zIndex: 100,
    maxWidth: '600px', margin: '0 auto',
    boxShadow: '0 -4px 12px rgba(0,0,0,.06)',
  },
  submitBtn: {
    flex: 1, padding: '14px', border: 'none', borderRadius: '12px',
    color: '#fff', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif",
  },
  logBtn: {
    padding: '14px 20px', border: '2px solid #d1d5db', borderRadius: '12px',
    background: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif",
  },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '600px', maxHeight: '70vh' },
};
