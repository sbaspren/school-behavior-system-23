import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { teacherInputApi, TeacherPageData, ClassInfo, StudentInfo } from '../api/teacherInput';

// ═══════════════════════════════════════════
// Static Data — exact match to original GAS
// ═══════════════════════════════════════════

interface ViolationItem { id: number; stage: string; type: string; degree: number; degree_primary?: number; text: string; }
interface NoteItem { id: number; text: string; }
interface PositiveNoteItem { id: number; text: string; cat: string; }
interface PositiveItem { id: number; text: string; degree: number; group: string; }

const VIOLATIONS: ViolationItem[] = [
  // حضوري — الدرجة الأولى
  {id:101,stage:'الكل',type:'حضوري',degree:1,text:'التأخر الصباحي'},
  {id:102,stage:'الكل',type:'حضوري',degree:1,text:'عدم حضور الاصطفاف الصباحي'},
  {id:103,stage:'الكل',type:'حضوري',degree:1,text:'التأخر عن الاصطفاف الصباحي أو العبث أثناءه'},
  {id:104,stage:'الكل',type:'حضوري',degree:1,text:'التأخر في الدخول إلى الحصص'},
  {id:105,stage:'متوسط وثانوي',type:'حضوري',degree:1,text:'إعاقة سير الحصص الدراسية'},
  {id:106,stage:'الكل',type:'حضوري',degree:1,text:'النوم داخل الفصل'},
  {id:107,stage:'الكل',type:'حضوري',degree:1,text:'تكرار خروج ودخول الطلبة من البوابة قبل وقت الحضور والانصراف'},
  {id:108,stage:'الكل',type:'حضوري',degree:1,text:'التجمهر أمام بوابة المدرسة'},
  {id:109,stage:'ابتدائي',type:'حضوري',degree:1,text:'تناول الأطعمة أو المشروبات أثناء الدرس بدون استئذان'},
  // حضوري — الدرجة الثانية
  {id:201,stage:'الكل',type:'حضوري',degree:2,text:'عدم حضور الحصة الدراسية أو الهروب منها'},
  {id:202,stage:'الكل',type:'حضوري',degree:2,text:'الدخول أو الخروج من الفصل دون استئذان'},
  {id:203,stage:'الكل',type:'حضوري',degree:2,text:'دخول فصل آخر دون استئذان'},
  {id:204,stage:'الكل',type:'حضوري',degree:2,text:'إثارة الفوضى داخل الفصل أو المدرسة أو وسائل النقل المدرسي'},
  // حضوري — الدرجة الثالثة
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
  // حضوري — الدرجة الرابعة
  {id:401,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'التعرض لأحد الطلبة بالضرب أو تعمد إصابته'},
  {id:402,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'سرقة شيء من ممتلكات الطلبة أو المدرسة'},
  {id:403,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'التصوير أو التسجيل الصوتي للطلبة'},
  {id:404,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'إلحاق الضرر المتعمد بتجهيزات المدرسة أو مبانيها'},
  {id:405,stage:'الكل',type:'حضوري',degree:4,text:'التدخين بأنواعه داخل المدرسة'},
  {id:406,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'الهروب من المدرسة'},
  {id:407,stage:'الكل',type:'حضوري',degree:4,degree_primary:3,text:'إحضار أو استخدام المواد أو الألعاب الخطرة'},
  {id:408,stage:'الكل',type:'حضوري',degree:4,text:'عرض أو توزيع المواد الإعلامية الممنوعة'},
  // حضوري — الدرجة الخامسة
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
  // رقمي — الدرجة الأولى
  {id:601,stage:'الكل',type:'رقمي',degree:1,text:'التأخر في حضور الحصة الافتراضية'},
  {id:602,stage:'الكل',type:'رقمي',degree:1,text:'الخروج المتكرر من الحصص الافتراضية بدون عذر'},
  {id:603,stage:'الكل',type:'رقمي',degree:1,text:'إعاقة سير الحصص الافتراضية'},
  // رقمي — الدرجة الثانية
  {id:604,stage:'الكل',type:'رقمي',degree:2,text:'الهروب من الحصة الافتراضية'},
  {id:605,stage:'الكل',type:'رقمي',degree:2,text:'الإرسال المتعمد لمواد أو روابط ليس لها علاقة بالمحتوى'},
  // رقمي — الدرجة الثالثة
  {id:606,stage:'الكل',type:'رقمي',degree:3,degree_primary:2,text:'استخدام صور منافية للقيم والذوق العام'},
  {id:607,stage:'الكل',type:'رقمي',degree:3,degree_primary:2,text:'التلفظ بكلمات نابية أو التهديد أو السخرية من الطلبة'},
  {id:608,stage:'متوسط وثانوي',type:'رقمي',degree:3,text:'تصوير أو تسجيل الدروس الافتراضية ونشرها'},
  {id:609,stage:'الكل',type:'رقمي',degree:3,text:'إساءة استخدام معلومات الدخول الشخصية'},
  // رقمي — الدرجة الرابعة
  {id:610,stage:'الكل',type:'رقمي',degree:4,degree_primary:3,text:'كتابة عبارات أو إرسال صور أو مقاطع مخلة بالآداب للمعلمين أو الطلبة'},
  {id:611,stage:'الكل',type:'رقمي',degree:4,degree_primary:3,text:'التصوير أو التسجيل الصوتي للمعلمين أو للطلبة'},
  // رقمي — الدرجة الخامسة
  {id:612,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'التنمر الإلكتروني'},
  {id:613,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'التحرش الجنسي الإلكتروني'},
  {id:614,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'الإساءة أو الاستهزاء بشيء من شعائر الإسلام (إلكتروني)'},
  {id:615,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'الإساءة للدولة أو رموزها (إلكتروني)'},
  {id:616,stage:'متوسط وثانوي',type:'رقمي',degree:5,text:'بث أو ترويج أفكار متطرفة أو الإساءة للأديان السماوية (إلكتروني)'},
  {id:617,stage:'متوسط وثانوي',type:'رقمي',degree:5,text:'ابتزاز الطلبة (إلكتروني)'},
  {id:618,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'المظاهر أو الشعارات الدالة على الشذوذ الجنسي (إلكتروني)'},
  {id:619,stage:'متوسط وثانوي',type:'رقمي',degree:5,text:'الترويج للمخدرات (إلكتروني)'},
  {id:620,stage:'الكل',type:'رقمي',degree:5,degree_primary:4,text:'الجرائم المعلوماتية بكافة أنواعها (إلكتروني)'},
  // هيئة تعليمية — الدرجة الرابعة
  {id:701,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'تهديد المعلمين أو الإداريين'},
  {id:702,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'التلفظ بألفاظ غير لائقة تجاه المعلمين أو الإداريين'},
  {id:706,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'السخرية من المعلمين أو الإداريين قولاً أو فعلاً'},
  {id:707,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'التوقيع عن أحد منسوبي المدرسة على المكاتبات'},
  {id:708,stage:'الكل',type:'هيئة تعليمية',degree:4,text:'تصوير المعلمين أو الإداريين أو التسجيل الصوتي لهم بدون إذن'},
  // هيئة تعليمية — الدرجة الخامسة
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

const DEGREE_LABELS: Record<number, string> = {1:'الأولى',2:'الثانية',3:'الثالثة',4:'الرابعة',5:'الخامسة'};
const DEGREE_COLORS: Record<number, string> = {1:'#d1fae5',2:'#fef3c7',3:'#fed7aa',4:'#fecaca',5:'#e9d5ff'};
const DEGREE_TEXT: Record<number, string> = {1:'#065f46',2:'#92400e',3:'#9a3412',4:'#991b1b',5:'#6b21a8'};
const INPUT_TYPES = [
  {id:'absence',label:'غياب',color:'#f97316',icon:'event_busy'},
  {id:'violation',label:'مخالفة سلوكية',color:'#ef4444',icon:'gavel'},
  {id:'note',label:'ملاحظة تربوية',color:'#3b82f6',icon:'menu_book'},
  {id:'positive',label:'سلوك متمايز',color:'#22c55e',icon:'star'},
];
const STAGE_LABELS: Record<string,string> = {'متوسط':'المرحلة المتوسطة','ثانوي':'المرحلة الثانوية','ابتدائي':'المرحلة الابتدائية','طفولة مبكرة':'مرحلة الطفولة المبكرة'};
const STAGE_SHORT: Record<string,string> = {'متوسط':'المتوسطة','ثانوي':'الثانوية','ابتدائي':'الابتدائية','طفولة مبكرة':'الطفولة المبكرة'};
const DEPUTY_LABELS: Record<string,string> = {'متوسط':'وكيل المتوسط','ثانوي':'وكيل الثانوي','ابتدائي':'وكيل الابتدائي','طفولة مبكرة':'وكيل الطفولة المبكرة'};

function isViolAvailable(v: ViolationItem, stage: string) {
  if (!stage || v.stage === 'الكل') return true;
  if (stage === 'ابتدائي') return v.stage === 'ابتدائي' || v.stage === 'الكل';
  return v.stage === 'متوسط وثانوي' || v.stage === 'الكل';
}
function effectiveDeg(v: ViolationItem, stage: string) {
  return (stage === 'ابتدائي' && v.degree_primary) ? v.degree_primary : v.degree;
}

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

type Step = 1 | 2 | 3 | 'note-details' | 'positive-details' | 4 | 5 | 'success';

interface SelectedItem { id: number | string; text: string; degree: number; type?: string; }

export default function TeacherFormPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageData, setPageData] = useState<TeacherPageData | null>(null);
  const [step, setStep] = useState<Step>(1);

  // State
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [violSubType, setViolSubType] = useState('حضوري');
  const [detectedStage, setDetectedStage] = useState('');
  const [noteSubType, setNoteSubType] = useState('سلبية');
  const [absenceType, setAbsenceType] = useState('');
  const [noteDetails, setNoteDetails] = useState('');
  const [positiveDetails, setPositiveDetails] = useState('');
  const [noAbsence, setNoAbsence] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Load data
  useEffect(() => {
    if (!token) { setError('الرمز مطلوب'); setLoading(false); return; }
    teacherInputApi.verify(token)
      .then(res => {
        const d = (res.data as any).data || res.data;
        if (!d || !d.t || !d.cl) { setError('البيانات غير مكتملة'); return; }
        setPageData(d);
      })
      .catch(() => setError('رابط غير صالح أو منتهي'))
      .finally(() => setLoading(false));
  }, [token]);

  // Helpers
  const classInfo = useCallback((name: string): ClassInfo | undefined => {
    return pageData?.cl.find(c => c.d === name || c.k === name);
  }, [pageData]);

  const students = useMemo((): StudentInfo[] => {
    if (!pageData || !selectedClass) return [];
    return pageData.st[selectedClass] || [];
  }, [pageData, selectedClass]);

  const goBack = useCallback(() => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 'note-details') setStep(3);
    else if (step === 'positive-details') setStep(3);
    else if (step === 4) setStep(selectedType === 'note' ? 'note-details' : selectedType === 'positive' ? 'positive-details' : 3);
    else if (step === 5) setStep(4);
  }, [step, selectedType]);

  // Step handlers
  const handleSelectClass = (name: string) => {
    setSelectedClass(name);
    setSelectedType(''); setSelectedItem(null); setSelectedStudents([]);
    const ci = classInfo(name);
    setDetectedStage(ci?.s || '');
    setStep(2);
  };

  const handleSelectType = (id: string) => {
    setSelectedType(id); setSelectedItem(null); setViolSubType('حضوري');
    setNoteSubType('سلبية'); setAbsenceType(''); setNoteDetails(''); setPositiveDetails('');
    setNoAbsence(false); setSearchQuery('');
    setStep(3);
  };

  const handleSelectAbsenceType = (t: string) => {
    setAbsenceType(t);
    setSelectedItem({ id: 'absence', text: t === 'حصة' ? 'غياب حصة' : 'غياب يوم كامل', degree: 0 });
    setSelectedStudents([]); setStep(4);
  };

  const handleSelectViolation = (v: ViolationItem) => {
    const ed = effectiveDeg(v, detectedStage);
    setSelectedItem({ id: v.id, text: v.text, degree: ed, type: v.type });
    setSelectedStudents([]); setStep(4);
  };

  const handleSelectNote = (item: NoteItem | PositiveNoteItem) => {
    setSelectedItem({ id: item.id, text: item.text, degree: 0 });
    setStep('note-details');
  };

  const handleSelectPositive = (p: PositiveItem) => {
    setSelectedItem({ id: p.id, text: p.text, degree: p.degree });
    setStep('positive-details');
  };

  const handleConfirmNoteDetails = () => { setSelectedStudents([]); setStep(4); };
  const handleConfirmPositiveDetails = () => { setSelectedStudents([]); setStep(4); };

  const handleToggleStudent = (id: string) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === students.length) setSelectedStudents([]);
    else setSelectedStudents(students.map(s => s.i));
  };

  const handleConfirmNoAbsence = () => {
    setNoAbsence(true); setSelectedStudents([]); setStep(5);
  };

  const handleConfirmStudents = () => {
    if (selectedStudents.length > 0) setStep(5);
  };

  // Submit
  const handleSubmit = async () => {
    if (!pageData) return;
    setSubmitting(true);
    try {
      const ci = classInfo(selectedClass);
      const classSub = ci?.sub || pageData.t.s || '';
      const sd = students.filter(s => selectedStudents.includes(s.i))
        .map(s => ({ id: s.i, name: s.n, phone: s.p }));

      const res = await teacherInputApi.submit({
        token,
        teacherName: pageData.t.n,
        className: selectedClass,
        inputType: selectedType,
        itemId: selectedItem ? String(selectedItem.id) : undefined,
        itemText: selectedItem?.text,
        itemDegree: selectedItem?.degree ? String(selectedItem.degree) : undefined,
        violationType: selectedType === 'violation' ? violSubType : undefined,
        absenceType: absenceType || 'يوم كامل',
        teacherSubject: classSub,
        details: selectedType === 'note' ? noteDetails : selectedType === 'positive' ? positiveDetails : undefined,
        noteClassification: noteSubType || 'سلبي',
        noAbsence,
        notifyDeputy: true,
        students: noAbsence ? [] : sd,
      });
      const d = (res.data as any).data || res.data;
      setSuccessMsg(d.message || 'تم الإرسال بنجاح');
      setStep('success');
    } catch {
      alert('حدث خطأ أثناء الإرسال');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedClass(''); setSelectedType(''); setSelectedItem(null);
    setSelectedStudents([]); setViolSubType('حضوري'); setDetectedStage('');
    setNoteSubType('سلبية'); setAbsenceType(''); setNoteDetails('');
    setPositiveDetails(''); setNoAbsence(false); setSearchQuery('');
    setSubmitting(false); setSuccessMsg('');
    setStep(1);
  };

  // ═══════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════

  if (loading) return (
    <div style={styles.loadingScreen}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ ...styles.spinner, animation: 'spin 1s linear infinite' }} />
      <p style={{ marginTop: 16, color: '#666' }}>جاري التحميل...</p>
    </div>
  );

  if (error) return (
    <div style={styles.loadingScreen}>
      <div style={{ ...styles.iconWrap, background: 'linear-gradient(135deg,#fee2e2,#fecaca)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#ef4444' }}>error</span>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>خطأ</h2>
      <p style={{ color: '#6b7280' }}>{error}</p>
    </div>
  );

  if (!pageData) return null;

  const CLASS_ICONS = ['person', 'school', 'groups', 'diversity_3', 'group_work', 'family_restroom', 'badge', 'groups_2'];
  const deputyLabel = DEPUTY_LABELS[detectedStage] || 'الوكيل';
  const typeLabel = INPUT_TYPES.find(t => t.id === selectedType)?.label || '';
  const stageShort = STAGE_SHORT[detectedStage] || detectedStage;
  const stageFull = STAGE_LABELS[detectedStage] || detectedStage;
  const classGridCols = pageData.cl.length >= 4 ? 'repeat(2, 1fr)' : '1fr';

  // Filter students by search
  const filteredStudents = students.filter(s =>
    !searchQuery || s.n.includes(searchQuery) || s.i.includes(searchQuery)
  );

  return (
    <div style={styles.container}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ═══ الهيدر الثابت ═══ */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.schoolRow}>
            <div style={styles.schoolIcon}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'white' }}>school</span>
            </div>
            <div>
              <div style={styles.schoolName}>{pageData.sn || 'المدرسة'}</div>
              <div style={styles.schoolSub}>نموذج إدخال المعلم</div>
            </div>
          </div>
          <div style={styles.teacherRow}>
            <div style={styles.teacherAvatar}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'white' }}>person</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.teacherName}>{pageData.t.n}</div>
              <div style={styles.teacherSubject}>{pageData.t.s}</div>
            </div>
            {detectedStage && <span style={styles.stageBadge}>{detectedStage}</span>}
          </div>
        </div>
      </div>

      {/* ═══ شريط زر الرجوع ═══ */}
      {step !== 1 && step !== 'success' && (
        <div style={styles.backBar}>
          <button style={styles.backBarBtn} onClick={goBack}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span> رجوع
          </button>
        </div>
      )}

      {/* ═══ حاوية الخطوات ═══ */}
      <div style={styles.stepsContainer}>

      {/* Step 1: Choose Class */}
      <div style={step === 1 ? styles.stepPanelActive : styles.stepPanel}>
          <div style={styles.stepHeader}>
            <div style={styles.stepTitle}><span style={styles.stepNum}>1</span> اختر الفصل</div>
            <div style={styles.stepSubtitle}>اختر فصلك لبدء الإدخال</div>
          </div>
          <div style={styles.stepBody}>
            <div style={{ ...styles.classGrid, gridTemplateColumns: classGridCols }}>
              {pageData.cl.map((c, i) => {
                const isActive = selectedClass === (c.d || c.k);
                const icon = CLASS_ICONS[i % CLASS_ICONS.length];
                const color = ['#667eea','#3b82f6','#8b5cf6','#6366f1','#4f46e5'][i % 5];
                return (
                  <div key={c.k} style={{
                    ...styles.classCard,
                    ...(isActive ? styles.classCardActive : {}),
                  }} onClick={() => handleSelectClass(c.d || c.k)}>
                    <div style={{ ...styles.typeIcon, background: color + '18', margin: '0 auto 10px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 26, color }}>{icon}</span>
                    </div>
                    <div style={styles.typeLabel}>{c.d}</div>
                  </div>
                );
              })}
              {pageData.cl.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 16 }}>لا توجد فصول</p>}
            </div>
          </div>
        </div>

      {/* Step 2: Choose Type */}
      <div style={step === 2 ? styles.stepPanelActive : styles.stepPanel}>
          <div style={styles.stepHeader}>
            <div style={styles.stepTitle}><span style={styles.stepNum}>2</span> نوع الإدخال</div>
            <div style={styles.stepSubtitle}>اختر نوع البيانات التي تريد إدخالها</div>
          </div>
          <div style={styles.stepBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {INPUT_TYPES.map(t => {
              const isActive = selectedType === t.id;
              return (
                <div key={t.id} style={{
                  ...styles.typeCard,
                  ...(isActive ? styles.typeCardActive : {}),
                }} onClick={() => handleSelectType(t.id)}>
                  <div style={{ ...styles.typeIcon, background: t.color + '18' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26, color: t.color }}>{t.icon}</span>
                  </div>
                  <div style={styles.typeLabel}>{t.label}</div>
                </div>
              );
            })}
            </div>
          </div>
        </div>

      {/* Step 3: Choose Item */}
      <div style={step === 3 ? styles.stepPanelActive : styles.stepPanel}>
          <div style={styles.stepHeader}>
            <div style={styles.stepTitle}><span style={styles.stepNum}>3</span> {
              selectedType === 'absence' ? 'نوع الغياب' :
              selectedType === 'violation' ? 'اختر المخالفة' :
              selectedType === 'note' ? 'اختر نوع الملاحظة' : 'اختر السلوك المتمايز'
            }</div>
          </div>
          <div style={styles.stepBody}>
            {/* Absence — vertical cards */}
            {selectedType === 'absence' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                <div style={styles.absenceCard} onClick={() => handleSelectAbsenceType('يوم كامل')}>
                  <div style={styles.absenceIcon}>
                    <span className="material-symbols-outlined" style={{ color: '#4f46e5', fontSize: 24 }}>event_busy</span>
                  </div>
                  <p style={{ fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>غياب يوم كامل</p>
                  <p style={{ fontSize: 13, color: '#6b7280' }}>لادخال الغياب الرسمي خلال الحصة الاولى</p>
                </div>
                <div style={styles.absenceCard} onClick={() => handleSelectAbsenceType('حصة')}>
                  <div style={styles.absenceIcon}>
                    <span className="material-symbols-outlined" style={{ color: '#4f46e5', fontSize: 24 }}>schedule</span>
                  </div>
                  <p style={{ fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>غياب حصة</p>
                  <p style={{ fontSize: 13, color: '#6b7280' }}>لادخال غياب الطالب عن حصة معينه</p>
                </div>
              </div>
            )}

            {/* Violations */}
            {selectedType === 'violation' && (
              <>
                <div style={styles.subTypeBtns}>
                  {['حضوري', 'رقمي', 'هيئة تعليمية'].map(t => (
                    <div key={t} style={{
                      ...styles.subTypeBtn,
                      ...(violSubType === t ? styles.subTypeBtnActive : {}),
                    }} onClick={() => { setViolSubType(t); setSearchQuery(''); }}>
                      {t}
                      <span style={styles.countBadge}>
                        {VIOLATIONS.filter(v => v.type === t && isViolAvailable(v, detectedStage)).length}
                      </span>
                    </div>
                  ))}
                </div>
                <input style={styles.searchInput} placeholder="ابحث في المخالفات..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} />
                <ViolationsList
                  stage={detectedStage} subType={violSubType} query={searchQuery}
                  selectedId={selectedItem?.id} onSelect={handleSelectViolation}
                />
              </>
            )}

            {/* Notes */}
            {selectedType === 'note' && (
              <>
                <div style={styles.subTypeBtns}>
                  {['سلبية', 'إشادة'].map(t => (
                    <div key={t} style={{
                      ...styles.subTypeBtn,
                      ...(noteSubType === t ? styles.subTypeBtnActive : {}),
                    }} onClick={() => { setNoteSubType(t); setSearchQuery(''); }}>
                      {t}
                      <span style={styles.countBadge}>
                        {t === 'إشادة' ? (POSITIVE_NOTES[detectedStage] || []).length : NOTES.length}
                      </span>
                    </div>
                  ))}
                </div>
                <input style={styles.searchInput} placeholder={noteSubType === 'إشادة' ? 'ابحث في الإشادات...' : 'ابحث في الملاحظات السلبية...'}
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <NotesList stage={detectedStage} subType={noteSubType} query={searchQuery}
                  selectedId={selectedItem?.id} onSelect={handleSelectNote} />
              </>
            )}

            {/* Positive */}
            {selectedType === 'positive' && (
              <>
                <input style={styles.searchInput} placeholder="ابحث في السلوك المتمايز..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <PositiveList query={searchQuery} selectedId={selectedItem?.id}
                  onSelect={handleSelectPositive} />
              </>
            )}
          </div>
        </div>

      {/* Step 3b: Note details */}
      <div style={step === 'note-details' ? styles.stepPanelActive : styles.stepPanel}>
          <div style={styles.stepHeader}>
            <div style={styles.stepTitle}><span style={styles.stepNum}>3ب</span> تفاصيل إضافية لولي الأمر (اختياري)</div>
            <div style={styles.stepSubtitle}>أضف أي تفاصيل تريد إرسالها لولي الأمر، أو اضغط التالي للمتابعة بدون تفاصيل</div>
          </div>
          <div style={{ ...styles.stepBody, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <textarea style={styles.textarea} placeholder="أضف أي تفاصيل تريد إرسالها لولي الأمر..." value={noteDetails}
              onChange={e => setNoteDetails(e.target.value)} />
          </div>
          <div style={styles.stepFooter}>
            <button style={styles.btnPrimary} onClick={handleConfirmNoteDetails}>التالي</button>
          </div>
        </div>

      {/* Step 3b: Positive details */}
      <div style={step === 'positive-details' ? styles.stepPanelActive : styles.stepPanel}>
          <div style={styles.stepHeader}>
            <div style={styles.stepTitle}><span style={styles.stepNum}>3ب</span> تفاصيل إضافية (اختياري)</div>
            <div style={styles.stepSubtitle}>أضف تفاصيل أو اكتب سلوكاً متمايزاً مخصصاً، أو اضغط التالي للمتابعة</div>
          </div>
          <div style={{ ...styles.stepBody, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <textarea style={styles.textarea} placeholder="أضف تفاصيل أو اكتب سلوكاً متمايزاً لم يكن في القائمة..." value={positiveDetails}
              onChange={e => setPositiveDetails(e.target.value)} />
          </div>
          <div style={styles.stepFooter}>
            <button style={styles.btnPrimary} onClick={handleConfirmPositiveDetails}>التالي</button>
          </div>
        </div>

      {/* Step 4: Select Students */}
      <div style={step === 4 ? styles.stepPanelActive : styles.stepPanel}>
          <div style={styles.stepHeader}>
            <div style={styles.stepTitle}>
              <span style={styles.stepNum}>4</span> اختر الطلاب
              <span style={{ marginRight: 'auto', fontSize: 13, color: '#6b7280', fontWeight: 500 }}>({students.length} طالب)</span>
            </div>
          </div>
          <div style={styles.stepBody}>
            {/* No absence button */}
            {selectedType === 'absence' && (
              <div style={styles.noAbsenceBtn} onClick={handleConfirmNoAbsence}>
                <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: 24 }}>check_circle</span>
                <span style={{ fontWeight: 800, color: '#166534', fontSize: 15 }}>لا يوجد غائب ✅</span>
              </div>
            )}

            <input style={styles.searchInput} placeholder="ابحث عن طالب..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} />
            <div style={styles.selectAllBar}>
              <label style={styles.selectAllLabel}>
                <input type="checkbox" style={{ width: 20, height: 20, accentColor: '#4f46e5', cursor: 'pointer' }}
                  checked={selectedStudents.length === students.length && students.length > 0}
                  onChange={handleSelectAll} />
                تحديد الكل
              </label>
              <span style={styles.selectedCount}>{selectedStudents.length} محدد</span>
            </div>
            <div>
              {filteredStudents.map(s => {
                const sel = selectedStudents.includes(s.i);
                return (
                  <div key={s.i} style={{
                    ...styles.studentItem,
                    ...(sel ? styles.studentItemSelected : {}),
                  }} onClick={() => handleToggleStudent(s.i)}>
                    <div style={styles.studentAvatar}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>person</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, color: '#1f2937', fontSize: 14, margin: 0 }}>{s.n}</p>
                      <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{s.i}</p>
                    </div>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', border: '2px solid',
                      borderColor: sel ? '#4f46e5' : '#d1d5db',
                      background: sel ? '#4f46e5' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sel && <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'white' }}>check</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={styles.stepFooter}>
            <button style={{ ...styles.btnPrimary, opacity: selectedStudents.length === 0 ? 0.5 : 1 }}
              disabled={selectedStudents.length === 0}
              onClick={handleConfirmStudents}>
              تأكيد الاختيار ({selectedStudents.length})
            </button>
          </div>
        </div>

      {/* Step 5: Summary & Submit */}
      <div style={step === 5 ? styles.stepPanelActive : styles.stepPanel}>
          <div style={styles.stepHeader}>
            <div style={styles.stepTitle}><span style={styles.stepNum}>5</span> ملخص وإرسال</div>
          </div>
          <div style={{ ...styles.stepBody, display: 'flex', flexDirection: 'column' }}>
            <div style={styles.summaryBox}>
              {noAbsence ? (
                <>
                  <SummaryRow label="الحالة" value="لا يوجد غائب ✅" valueColor="#22c55e" />
                  <SummaryRow label="الفصل" value={selectedClass} />
                  <SummaryRow label="المرحلة" value={stageShort} />
                </>
              ) : (
                <>
                  <SummaryRow label="النوع" value={typeLabel} />
                  {selectedItem?.text && <SummaryRow label="التفاصيل" value={selectedItem.text} />}
                  {selectedItem?.degree ? <SummaryRow label="الدرجة" value={String(selectedItem.degree)} /> : null}
                  {selectedType === 'violation' && <SummaryRow label="نوع المخالفة" value={violSubType} />}
                  {selectedType === 'absence' && absenceType && <SummaryRow label="نوع الغياب" value={absenceType} />}
                  {selectedType === 'note' && <SummaryRow label="التصنيف" value={noteSubType} />}
                  {selectedType === 'note' && noteDetails && <SummaryRow label="التفاصيل الإضافية" value={noteDetails} />}
                  {selectedType === 'positive' && positiveDetails && <SummaryRow label="التفاصيل الإضافية" value={positiveDetails} />}
                  <SummaryRow label="الفصل" value={selectedClass} />
                  <SummaryRow label="المرحلة" value={stageFull} />
                  <SummaryRow label="عدد الطلاب" value={String(selectedStudents.length)} valueColor="#4f46e5" />
                </>
              )}
            </div>
            <button style={{ ...styles.btnPrimary, opacity: submitting ? 0.5 : 1 }} disabled={submitting}
              onClick={handleSubmit}>
              {submitting ? (
                <><span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: 20, verticalAlign: 'middle' }}>sync</span> جاري الإرسال...</>
              ) : `إرسال إلى ${deputyLabel}`}
            </button>
          </div>
        </div>

      {/* Success */}
      <div style={step === 'success' ? styles.stepPanelActive : styles.stepPanel}>
          <div style={styles.successWrap}>
            <div style={{ ...styles.iconWrap, background: 'linear-gradient(135deg,#e0e7ff,#f3e8ff)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#4f46e5' }}>check_circle</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>تم الإرسال بنجاح!</h2>
            <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>{successMsg || 'تم إرسال البيانات للوكيل'}</p>
            <div style={styles.summaryBox}>
              {noAbsence ? (
                <>
                  <SummaryRow label="الحالة" value="لا يوجد غائب ✅" valueColor="#22c55e" />
                  <SummaryRow label="الفصل" value={selectedClass} />
                  <SummaryRow label="المرحلة" value={stageShort} />
                </>
              ) : (
                <>
                  <SummaryRow label="النوع" value={typeLabel} />
                  <SummaryRow label="الفصل" value={selectedClass} />
                  <SummaryRow label="المرحلة" value={stageShort} />
                  <SummaryRow label="عدد الطلاب" value={String(selectedStudents.length)} valueColor="#4f46e5" />
                </>
              )}
            </div>
            <div style={{ width: '100%', flexShrink: 0, marginTop: 12 }}>
              <button style={styles.btnPrimary} onClick={resetForm}>إدخال مرة أخرى</button>
              <button style={styles.btnExit} onClick={() => {
                try { window.close(); } catch {}
                document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;font-family:Cairo,sans-serif;direction:rtl"><div style="width:80px;height:80px;background:#fef2f2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><span class="material-symbols-outlined" style="font-size:40px;color:#dc2626">logout</span></div><h2 style="font-size:20px;font-weight:800;color:#1f2937;margin-bottom:8px">تم الخروج</h2><p style="color:#6b7280">يمكنك إغلاق هذه النافذة يدوياً</p></div>';
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                خروج
              </button>
            </div>
          </div>
        </div>

      </div>{/* end steps-container */}
    </div>
  );
}

// ═══════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 15, borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280' }}>{label}:</span>
      <span style={{ fontWeight: 700, color: valueColor || '#1f2937', fontSize: 13 }}>{value}</span>
    </div>
  );
}

function ViolationsList({ stage, subType, query, selectedId, onSelect }: {
  stage: string; subType: string; query: string;
  selectedId?: number | string; onSelect: (v: ViolationItem) => void;
}) {
  const items = VIOLATIONS.filter(v =>
    v.type === subType && isViolAvailable(v, stage) &&
    (!query || v.text.includes(query))
  );

  // Group by effective degree
  const groups: Record<number, ViolationItem[]> = {};
  items.forEach(v => {
    const d = effectiveDeg(v, stage);
    if (!groups[d]) groups[d] = [];
    groups[d].push(v);
  });

  return (
    <div>
      {[1, 2, 3, 4, 5].map(deg => {
        if (!groups[deg]) return null;
        return (
          <div key={deg} style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 13, marginBottom: 6,
              background: DEGREE_COLORS[deg], color: DEGREE_TEXT[deg],
            }}>
              الدرجة {DEGREE_LABELS[deg]} ({groups[deg].length})
            </div>
            {groups[deg].map(v => {
              const ed = effectiveDeg(v, stage);
              const sel = selectedId === v.id;
              return (
                <div key={v.id} style={{
                  padding: '14px 16px', background: sel ? '#eef2ff' : 'white', borderRadius: 12,
                  marginBottom: 8, border: `2px solid ${sel ? '#4f46e5' : '#e5e7eb'}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 10, touchAction: 'manipulation',
                }} onClick={() => onSelect(v)}>
                  <p style={{ fontWeight: 600, color: '#1f2937', fontSize: 13, flex: 1, margin: 0 }}>{v.text}</p>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 14,
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                    background: DEGREE_COLORS[ed], color: DEGREE_TEXT[ed],
                  }}>{ed}</span>
                </div>
              );
            })}
          </div>
        );
      })}
      {items.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>لا توجد نتائج</p>}
    </div>
  );
}

function NotesList({ stage, subType, query, selectedId, onSelect }: {
  stage: string; subType: string; query: string;
  selectedId?: number | string; onSelect: (n: NoteItem | PositiveNoteItem) => void;
}) {
  const items = subType === 'إشادة'
    ? (POSITIVE_NOTES[stage] || []).filter(n => !query || n.text.includes(query))
    : NOTES.filter(n => !query || n.text.includes(query));

  return (
    <div>
      {items.map(n => {
        const sel = selectedId === n.id;
        return (
          <div key={n.id} style={{
            padding: '14px 16px', background: sel ? '#eef2ff' : 'white', borderRadius: 12,
            marginBottom: 8, border: `2px solid ${sel ? '#4f46e5' : '#e5e7eb'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 10, touchAction: 'manipulation',
          }} onClick={() => onSelect(n)}>
            <p style={{ fontWeight: 600, color: '#1f2937', fontSize: 13, flex: 1, margin: 0 }}>{n.text}</p>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 14,
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              background: subType === 'إشادة' ? '#bbf7d0' : '#fecaca',
              color: subType === 'إشادة' ? '#16a34a' : '#dc2626',
              border: `1px solid ${subType === 'إشادة' ? '#86efac' : '#fca5a5'}`,
            }}>{subType === 'إشادة' ? 'إشادة' : 'سلبية'}</span>
          </div>
        );
      })}
      {items.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>لا توجد نتائج</p>}
    </div>
  );
}

function PositiveList({ query, selectedId, onSelect }: {
  query: string; selectedId?: number | string; onSelect: (p: PositiveItem) => void;
}) {
  const gColors: Record<number, string> = { 6: '#d1fae5', 4: '#fef3c7', 2: '#dbeafe' };
  const gText: Record<number, string> = { 6: '#065f46', 4: '#92400e', 2: '#1e40af' };

  const items = POSITIVE.filter(p => !query || p.text.includes(query));

  return (
    <div>
      {items.map(p => {
        const sel = selectedId === p.id;
        return (
          <div key={p.id} style={{
            padding: '14px 16px', background: sel ? '#eef2ff' : 'white', borderRadius: 12,
            marginBottom: 8, border: `2px solid ${sel ? '#4f46e5' : '#e5e7eb'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 10, touchAction: 'manipulation',
          }} onClick={() => onSelect(p)}>
            <p style={{ fontWeight: 600, color: '#1f2937', fontSize: 13, flex: 1, margin: 0 }}>{p.text}</p>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 14,
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              background: gColors[p.degree] || '#d1fae5',
              color: gText[p.degree] || '#065f46',
              border: `1px solid ${(gText[p.degree] || '#065f46') + '33'}`,
            }}>{p.degree}</span>
          </div>
        );
      })}
      {items.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>لا توجد نتائج</p>}
    </div>
  );
}

// ═══════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════

const FONT = "'Cairo', sans-serif";

const styles: Record<string, React.CSSProperties> = {
  container: {
    direction: 'rtl', fontFamily: FONT,
    maxWidth: 480, margin: '0 auto', height: '100vh',
    background: '#f3f4f6', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', WebkitTapHighlightColor: 'transparent',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '14px 16px', flexShrink: 0,
  },
  headerInner: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'stretch',
  },
  schoolRow: {
    display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start',
  },
  schoolIcon: {
    width: 44, height: 44, background: 'rgba(255,255,255,0.2)', borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  schoolName: { fontSize: 15, fontWeight: 800, color: 'white', whiteSpace: 'nowrap' as const },
  schoolSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' as const },
  teacherRow: {
    marginTop: 10, display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', background: 'rgba(255,255,255,0.12)',
    borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
  },
  teacherAvatar: {
    width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  teacherName: { fontWeight: 700, color: 'white', fontSize: 14 },
  teacherSubject: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  stageBadge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 16,
    fontSize: 10, fontWeight: 700, marginRight: 6,
    background: 'rgba(255,255,255,0.2)', color: '#e0e7ff',
  },
  backBar: {
    padding: '8px 16px', background: '#f3f4f6', flexShrink: 0,
    borderBottom: '1px solid #e5e7eb',
  },
  backBarBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', border: '2px solid #e5e7eb', background: 'white',
    color: '#6b7280', borderRadius: 10, fontSize: 13, fontWeight: 700,
    fontFamily: FONT, cursor: 'pointer', touchAction: 'manipulation' as const,
  },
  stepsContainer: { flex: 1, overflow: 'hidden', position: 'relative' as const },
  stepPanel: {
    position: 'absolute' as const, inset: 0, display: 'flex', flexDirection: 'column' as const,
    background: '#f3f4f6', opacity: 0, pointerEvents: 'none' as const,
    transition: 'opacity .2s ease',
  },
  stepPanelActive: {
    position: 'absolute' as const, inset: 0, display: 'flex', flexDirection: 'column' as const,
    background: '#f3f4f6', opacity: 1, pointerEvents: 'auto' as const, zIndex: 1,
  },
  stepHeader: { padding: '16px 16px 12px', flexShrink: 0 },
  stepTitle: {
    fontSize: 18, fontWeight: 800, color: '#1f2937',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  stepNum: {
    width: 30, height: 30,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 800, flexShrink: 0,
  },
  stepSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, marginRight: 40 },
  stepBody: {
    flex: 1, overflowY: 'auto' as const, padding: '0 16px 16px',
    WebkitOverflowScrolling: 'touch' as any,
  },
  stepFooter: {
    padding: '12px 16px', flexShrink: 0, background: 'white',
    borderTop: '1px solid #e5e7eb',
  },
  classGrid: {
    display: 'grid', gap: 12,
  },
  classCard: {
    background: 'white', border: '2px solid #e5e7eb', borderRadius: 16,
    padding: '20px 12px', textAlign: 'center' as const, cursor: 'pointer',
    transition: 'all .15s', touchAction: 'manipulation' as const,
  },
  classCardActive: {
    background: 'linear-gradient(135deg, #f5f3ff, #eef2ff)',
    border: '2px solid #4f46e5',
    boxShadow: '0 0 0 3px rgba(79,70,229,0.1)',
  },
  typeCard: {
    background: 'white', border: '2px solid #e5e7eb', borderRadius: 16,
    padding: '16px 20px', textAlign: 'right' as const, cursor: 'pointer',
    transition: 'all .15s', touchAction: 'manipulation' as const,
    display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10,
  },
  typeCardActive: {
    borderColor: '#4f46e5', background: 'linear-gradient(135deg, #f5f3ff, #eef2ff)',
    boxShadow: '0 0 0 3px rgba(79,70,229,0.1)',
  },
  typeIcon: {
    width: 48, height: 48, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  typeLabel: { fontSize: 15, fontWeight: 700, color: '#1f2937' },
  absenceCard: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    textAlign: 'center' as const, padding: '24px 20px',
    background: '#eef2ff', border: '2px solid #c7d2fe', borderRadius: 14,
    cursor: 'pointer', touchAction: 'manipulation' as const, transition: 'all .15s',
  },
  absenceIcon: {
    width: 48, height: 48, background: '#c7d2fe', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  subTypeBtns: { display: 'flex', gap: 8, marginBottom: 12 },
  subTypeBtn: {
    flex: 1, padding: '10px 6px', border: '2px solid #e5e7eb', borderRadius: 12,
    textAlign: 'center' as const, cursor: 'pointer', background: 'white',
    fontSize: 12, fontWeight: 700, touchAction: 'manipulation' as const,
    fontFamily: FONT,
  },
  subTypeBtnActive: {
    borderColor: '#4f46e5', background: '#eef2ff', color: '#4f46e5',
  },
  countBadge: {
    display: 'block', fontSize: 11, fontWeight: 500, color: '#9ca3af', marginTop: 2,
  },
  searchInput: {
    width: '100%', padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: 12,
    fontSize: 15, fontFamily: FONT, marginBottom: 10,
    outline: 'none', touchAction: 'manipulation' as const,
    boxSizing: 'border-box' as const, direction: 'rtl' as const,
  },
  itemRow: {
    padding: '14px 16px', background: 'white', borderRadius: 12, marginBottom: 8,
    border: '2px solid #e5e7eb', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    touchAction: 'manipulation' as const,
  },
  itemRowSelected: {
    borderColor: '#4f46e5', background: '#eef2ff',
  },
  degreeBadge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 14,
    fontSize: 11, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' as const,
  },
  noAbsenceBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 14, background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 12,
    cursor: 'pointer', touchAction: 'manipulation' as const, marginBottom: 12,
  },
  selectAllBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', background: 'white', borderRadius: 12,
    marginBottom: 10, border: '2px solid #e5e7eb',
  },
  selectAllLabel: {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    fontSize: 14, fontWeight: 600, touchAction: 'manipulation' as const,
  },
  selectedCount: { fontSize: 14, color: '#4f46e5', fontWeight: 700 },
  studentItem: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
    background: 'white', borderRadius: 12, marginBottom: 8,
    border: '2px solid #e5e7eb', cursor: 'pointer',
    touchAction: 'manipulation' as const,
  },
  studentItemSelected: {
    borderColor: '#4f46e5', background: '#eef2ff',
  },
  studentAvatar: {
    width: 40, height: 40, background: '#eef2ff', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between', padding: '12px 0',
    fontSize: 15,
  },
  summaryBox: {
    background: 'white', borderRadius: 14, padding: 16, border: '2px solid #e5e7eb',
    marginBottom: 16, width: '100%',
  },
  btnPrimary: {
    width: '100%', padding: 16, border: 'none', borderRadius: 14,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white', fontSize: 16, fontWeight: 700, fontFamily: FONT,
    cursor: 'pointer', boxShadow: '0 4px 14px rgba(102,126,234,0.35)',
    touchAction: 'manipulation' as const,
  },
  btnExit: {
    width: '100%', padding: 14, border: '2px solid #ef4444', borderRadius: 14,
    background: '#fef2f2', color: '#ef4444', fontSize: 15, fontWeight: 700,
    fontFamily: FONT, cursor: 'pointer', touchAction: 'manipulation' as const,
    marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  textarea: {
    width: '100%', minHeight: 220, padding: 16, border: '2px solid #e5e7eb',
    borderRadius: 14, fontFamily: FONT, fontSize: 16,
    outline: 'none', resize: 'vertical' as const, touchAction: 'manipulation' as const,
    lineHeight: 1.6, boxSizing: 'border-box' as const, direction: 'rtl' as const,
  },
  loadingScreen: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(255,255,255,0.95)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, flexDirection: 'column' as const,
    fontFamily: FONT, direction: 'rtl' as const,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  successWrap: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', minHeight: '100%', padding: '32px 16px',
    textAlign: 'center' as const, overflowY: 'auto' as const,
    WebkitOverflowScrolling: 'touch' as any,
  },
  spinner: {
    width: 48, height: 48, border: '4px solid #e5e7eb', borderTopColor: '#667eea',
    borderRadius: '50%',
  },
};
