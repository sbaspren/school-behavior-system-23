// ===== قوالب الطباعة الرسمية (23 نموذج) =====
import { toIndic, escapeHtml, shortenName, getFormTemplateCSS, buildLetterheadHtml, adjustAllFields } from './printUtils';

// ===== أنواع البيانات =====
export interface PrintFormData {
  studentName?: string;
  grade?: string;
  class?: string;
  violationDay?: string;
  violationDate?: string;
  violationDegree?: string | number;
  violationText?: string;
  managerName?: string;
  deputyName?: string;
  counselorName?: string;
  procedures?: string[];
  committeeMembers?: { name: string; role: string }[];
  // دعوة ولي أمر
  visitDay?: string;
  visitDate?: string;
  visitTime?: string;
  visitMeeting?: string;
  visitReason?: string;
  // محضر ضبط واقعة
  mahdarLocation?: string;
  mahdarObservations?: string[];
  mahdarWitnesses?: { name: string; role: string }[];
  // لجنة
  lajnahPrevProcedures?: string;
  lajnahRecommendations?: string;
  // غياب
  unexcusedDays?: string | number;
  excusedDays?: string | number;
  // إحالة جماعية / تعهد جماعي
  studentsList?: { name: string; grade?: string; cls?: string; unexcused?: number; excused?: number }[];
  // رصد سلوكي
  violationsList?: { description: string; degree: number; date: string; procedures: string }[];
  // تعويض درجات
  violationInfo?: { name: string; degree: string; date: string; points: string };
  // حالة عالية الخطورة
  riskTypes?: string[];
  riskDesc?: string;
  riskObserver?: string;
  riskDate?: string;
  riskTime?: string;
  // إبلاغ إيذاء
  eblaghReporter?: string;
  eblaghRole?: string;
  eblaghSummary?: string;
  eblaghProcedures?: string[];
  // خطة تعديل
  khotaDob?: string;
  khotaAge?: string;
  khotaStart?: string;
  khotaEnd?: string;
  khotaProblem?: string;
  khotaDegree?: string;
  khotaDesc?: string;
  khotaManifestations?: string[];
  // رصد معلم
  subject?: string;
  teacherName?: string;
  violations?: { studentName: string; violation: string; action: string; date: string }[];
  // مشاجرة
  day?: string;
  date?: string;
  time?: string;
  location?: string;
  initiator?: string;
  description?: string;
  physicalDamage?: string[] | string;
  materialDamage?: string[] | string;
  involvedStudents?: { name: string; grade: string; role: string }[];
  witnesses?: string[];
  authors?: { name: string; role: string }[];
  students?: { name: string; grade: string }[];
  authorName?: string;
  authorRole?: string;
  // توثيق تواصل
  contactDay?: string;
  contactDate?: string;
  contactType?: string;
  contactReason?: string;
  contactResult?: string;
  contactNotes?: string;
  notes?: string;
}

interface SchoolSettings {
  letterheadMode: string;
  letterheadImageUrl?: string;
  schoolName?: string;
  eduAdmin?: string;
  eduDept?: string;
  letterhead?: string;
}

// ===== قائمة النماذج =====
export type FormId =
  | 'ishar_wali_amr' | 'tahood_slooki' | 'dawat_wali_amr' | 'mahdar_dab_wakea'
  | 'mahdar_lajnah' | 'mahdar_lajnah_absence' | 'ehalat_talib' | 'group_ehala'
  | 'rasd_slooki' | 'tawid_darajat' | 'rasd_tamayuz' | 'ghiab_bidon_ozr'
  | 'ghiab_ozr' | 'tahood_hodoor' | 'group_tahood' | 'iltizam_madrasi'
  | 'rasd_moalem' | 'high_risk' | 'eblagh_etha' | 'khota_tadeel'
  | 'ehalat_absence' | 'tawtheeq_tawasol' | 'mashajara';

// ===== أسماء النماذج بالعربي =====
export const FORM_NAMES: Record<FormId, string> = {
  ishar_wali_amr: 'إشعار ولي أمر',
  tahood_slooki: 'تعهد سلوكي',
  dawat_wali_amr: 'دعوة ولي أمر',
  mahdar_dab_wakea: 'محضر ضبط واقعة',
  mahdar_lajnah: 'محضر لجنة (مخالفة)',
  mahdar_lajnah_absence: 'محضر لجنة (غياب)',
  ehalat_talib: 'إحالة طالب',
  group_ehala: 'إحالة جماعية',
  rasd_slooki: 'رصد مخالفات سلوكية',
  tawid_darajat: 'تعويض درجات',
  rasd_tamayuz: 'رصد تمايز',
  ghiab_bidon_ozr: 'غياب بدون عذر',
  ghiab_ozr: 'غياب بعذر',
  tahood_hodoor: 'تعهد حضور',
  group_tahood: 'تعهد جماعي',
  iltizam_madrasi: 'التزام مدرسي',
  rasd_moalem: 'رصد معلم',
  high_risk: 'حالة عالية الخطورة',
  eblagh_etha: 'إبلاغ إيذاء',
  khota_tadeel: 'خطة تعديل سلوك',
  ehalat_absence: 'إحالة غياب',
  tawtheeq_tawasol: 'توثيق تواصل',
  mashajara: 'محضر مشاجرة',
};

// ===== دالة ملء حقل =====
function fillField(doc: Document, id: string, value: string | number | undefined, indicNum = false): void {
  const el = doc.getElementById(id);
  if (!el || value === undefined || value === null) return;
  let text = String(value);
  if (indicNum) text = toIndic(text);
  el.textContent = text;
}

// ===== دالة تعبئة جدول اللجنة =====
function fillCommitteeMembers(doc: Document, tableId: string, members?: { name: string; role: string }[]): void {
  if (!members || members.length === 0) return;
  const tbody = doc.getElementById(tableId);
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  members.forEach((m, i) => {
    if (i < rows.length) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length >= 3) {
        cells[1].textContent = m.name;
        cells[2].textContent = m.role;
      }
    }
  });
}

// ===== بناء صفوف فارغة =====
function emptyRows(count: number, cols: number): string {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += '<tr>';
    html += `<td class="indic-num">${toIndic(i + 1)}</td>`;
    for (let c = 1; c < cols; c++) html += '<td></td>';
    html += '</tr>';
  }
  return html;
}

// ===== توليد HTML القالب =====
function getTemplateHtml(formId: FormId): string {
  const H = `<div class="header-container"><img src="" class="header-logo" alt="الشعار"></div>`;

  switch (formId) {
    case 'ishar_wali_amr':
      return `<div class="page-container">${H}
  <div class="confidential-mark">(سري)</div>
  <div class="form-title">إشعار ولي أمر الطالب بمشكلة سلوكية</div>
  <div class="form-body">
  <div class="section-block align-right" style="margin-bottom:15px;">المكرم ولي أمر الطالب: <span class="data-field with-dots" id="studentName" style="min-width:60px;"></span> الصف: <span class="data-field with-dots" id="grade" style="min-width:40px;"></span> في يوم: <span class="data-field with-dots" id="violationDay" style="min-width:40px;"></span> الموافق: <span class="data-field with-dots indic-num" id="violationDate" style="min-width:60px;"></span> هـ</div>
  <div class="section-block">السلام عليكم ورحمة الله وبركاته،،</div>
  <div class="section-block align-right" style="line-height:1.6;">نشعركم بأن الطالب المذكور أعلاه قام
  بارتكاب مخالفة سلوكية من الدرجة ( <span class="data-field indic-num" id="violationDegree"
  style="font-weight:bold;"></span> )، وهي: <span class="data-field with-dots align-right"
  style="width: 80%; display:inline-block" id="violationText"></span></div>
  <div class="section-block" style="line-height:1.6;">وقد قررت إدارة المدرسة اتخاذ الإجراءات التالية حياله
  وفق ما ورد في قواعد السلوك والمواظبة:
  <div style="margin-right: 15px; margin-top: 5px;">
  <div style="margin-bottom: 5px; display:flex;"><span class="indic-num"
  style="min-width:20px;">١.</span> <span class="data-field with-dots align-right"
  style="flex:1;" id="proc_1"></span></div>
  <div style="margin-bottom: 5px; display:flex;"><span class="indic-num"
  style="min-width:20px;">٢.</span> <span class="data-field with-dots align-right"
  style="flex:1;" id="proc_2"></span></div>
  <div style="margin-bottom: 5px; display:flex;"><span class="indic-num"
  style="min-width:20px;">٣.</span> <span class="data-field with-dots align-right"
  style="flex:1;" id="proc_3"></span></div>
  </div>
  </div>
  <div class="section-block">لذا يرجى منكم المتابعة والتعاون مع المدرسة بما يسهم في انضباط سلوك ابنكم،
  وتفضلوا بقبول التحية.</div>
  <table class="footer-table">
  <tr>
  <td style="width:33%; text-align:center;">
  <div
  style="border: 2px dashed #ccc; width: 80px; height: 80px; margin: 0 auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12pt;">
  الختم</div>
  </td>
  <td style="width:33%;"></td>
  <td style="width:33%; text-align:center;">
  <div class="signature-block" style="display:inline-block; text-align:right;">
  <strong style="display: block; margin-bottom: 0.8em; text-align:center;">مدير
  المدرسة</strong>
  <div style="margin-bottom: 5px; white-space:nowrap;">الاسم: <span
  class="data-field with-dots" id="managerName"
  style="display:inline-block; min-width:150px; text-align:center;"></span></div>
  <div style="white-space:nowrap;">التوقيع: <span
  style="display:inline-block; border-bottom:1px dotted #000; min-width:150px;"></span>
  </div>
  </div>
  </td>
  </tr>
  </table>
  </div>
  <div class="cut-line">( قص من هنا وإعادة الجزء الأسفل )</div>
  <div style="margin-top: 15px;">
  <div class="form-title" style="text-decoration: underline; margin-top: 5px;">إيصال استلام إشعار</div>
  <div class="section-block" style="margin-bottom: 4mm;">أقر أنا ولي أمر الطالب: <span
  class="data-field with-dots" id="studentName_2"></span> بأنني استلمت الإشعار الخاص بالمخالفة
  السلوكية، وسأقوم بمتابعة ابني.</div>
  <div style="display: flex; justify-content: space-between; margin-top: 20px; font-weight: bold;">
  <div>الاسم: ........................</div>
  <div>التوقيع: ........................</div>
  <div>التاريخ: <span class="with-dots indic-num" style="min-width: 120px;"></span></div>
  </div>
  </div>
  </div>`;

    case 'tahood_slooki':
      return `<div class="page-container">${H}
  <div class="form-title">إقرار وتعهد سلوكي</div>
  <div class="form-body">
  <div class="section-block align-right" style="margin-bottom:10px;">أقر أنا الطالب: <span class="data-field with-dots" style="min-width:60px;" id="tahood_studentName"></span> بالصف: <span class="data-field with-dots" style="min-width:40px;" id="tahood_grade"></span> قمت في يوم: <span class="data-field with-dots" style="min-width:40px;" id="tahood_day"></span> الموافق: <span class="data-field with-dots indic-num" style="min-width:60px;" id="tahood_date"></span> هـ</div>
  <div class="section-block align-right">
  بارتكاب مخالفة سلوكية من الدرجة ( <strong><span class="data-field indic-num"
  id="tahood_degree"></span></strong> )، وهي: <span class="data-field with-dots align-right"
  style="width: 100%; display:inline-block" id="tahood_text"></span>
  </div>
  <div class="section-block"
  style="margin-top: 20px; font-weight: bold; text-align: justify; line-height:1.8;">
  وأتعهد بعدم تكرار هذه المخالفة أو أي مخالفة سلوكية أخرى مستقبلاً، والالتزام بالأنظمة المدرسية
  واحترام توجيهات المعلمين وإدارة المدرسة، وفي حال تكرار المخالفة أتحمل كافة الإجراءات النظامية
  المترتبة على ذلك.
  </div>
  <div class="section-block" style="text-align: center; margin-top: 15px;">وعلى ذلك جرى التوقيع والعلم.
  </div>
  <table class="footer-table" style="margin-top: 40px;">
  <tr>
  <td style="width:33%; text-align:center;">
  <div class="signature-block" style="display:inline-block; text-align:right;">
  <strong style="display: block; margin-bottom: 0.8em; text-align:center;">الطالب
  المقر</strong>
  <div style="margin-bottom: 5px; white-space:nowrap;">الاسم: <span
  class="data-field with-dots"
  style="display:inline-block; min-width:150px; text-align:center;"></span></div>
  <div style="white-space:nowrap;">التوقيع: <span
  style="display:inline-block; border-bottom:1px dotted #000; min-width:150px;"></span>
  </div>
  </div>
  </td>
  <td style="width:33%; text-align:center;">
  <div class="signature-block" style="display:inline-block; text-align:right;">
  <strong style="display: block; margin-bottom: 0.8em; text-align:center;">ولي أمر
  الطالب</strong>
  <div style="margin-bottom: 5px; white-space:nowrap;">الاسم: <span
  class="data-field with-dots"
  style="display:inline-block; min-width:150px; text-align:center;"></span></div>
  <div style="white-space:nowrap;">التوقيع: <span
  style="display:inline-block; border-bottom:1px dotted #000; min-width:150px;"></span>
  </div>
  </div>
  </td>
  <td style="width:33%; text-align:center;">
  <div class="signature-block" style="display:inline-block; text-align:right;">
  <strong style="display: block; margin-bottom: 0.8em; text-align:center;">مدير
  المدرسة</strong>
  <div style="margin-bottom: 5px; white-space:nowrap;">الاسم: <span
  class="data-field with-dots"
  style="display:inline-block; min-width:150px; text-align:center;"></span></div>
  <div style="white-space:nowrap;">التوقيع: <span
  style="display:inline-block; border-bottom:1px dotted #000; min-width:150px;"></span>
  </div>
  </div>
  </td>
  </tr>
  </table>
  </div>
  </div>`;

    case 'dawat_wali_amr':
      return `<div class="page-container">${H}
<div class="form-title">خطاب دعوة ولي أمر طالب</div>
<div class="form-body">
  <div class="section-block align-right" style="margin-bottom:10px;">المكرم ولي أمر الطالب: <span class="data-field with-dots" style="min-width:60px;" id="dawat_studentName"></span> بالصف: <span class="data-field with-dots" style="min-width:40px;" id="dawat_grade"></span></div>
  <div class="section-block">السلام عليكم ورحمة الله وبركاته،،</div>
  <div class="section-block align-right">نأمل منكم التكرم بالحضور إلى المدرسة في يوم: <span class="data-field with-dots" style="min-width:60px;" id="dawat_day"></span> الموافق: <span class="data-field with-dots indic-num" style="min-width:80px;" id="dawat_date"></span> هـ الساعة: <span class="data-field with-dots indic-num" style="min-width:40px;" id="dawat_time"></span> صباحاً.</div>
  <div class="section-block">وذلك لمقابلة: <span class="data-field with-dots" style="width:50%;" id="dawat_meeting"></span></div>
  <div class="section-block align-right">الهدف من الزيارة: <span class="data-field with-dots align-right" style="width:100%;display:inline-block;" id="dawat_visitReason"></span></div>
  <div class="section-block" style="margin-top:8mm;">شاكرين لكم تعاونكم وحرصكم على مصلحة ابنكم التعليمية والتربوية.</div>
  <table class="footer-table"><tr>
    <td style="width:33%;text-align:center;"><div style="border:2px dashed #ccc;width:80px;height:80px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12pt;">الختم</div></td>
    <td style="width:33%;"></td>
    <td style="width:33%;text-align:center;"><div class="signature-block" style="display:inline-block;text-align:right;"><strong style="display:block;margin-bottom:0.8em;text-align:center;">وكيل شؤون الطلاب</strong><div style="margin-bottom:5px;white-space:nowrap;">الاسم: <span class="data-field with-dots" id="dawat_deputyName" style="display:inline-block;min-width:200px;text-align:center;"></span></div><div style="white-space:nowrap;">التوقيع: <span style="display:inline-block;border-bottom:1px dotted #000;min-width:200px;"></span></div></div></td>
  </tr></table>
</div>
<div class="cut-line">( قص من هنا وإعادة الجزء الأسفل )</div>
<div style="margin-top:15px;">
  <div class="form-title" style="text-decoration:underline;margin-top:5px;">رد ولي الأمر</div>
  <div class="section-block"><span class="manual-checkbox"></span> اطلعت، وسأحضر في الموعد المحدد إن شاء الله.</div>
  <div class="section-block"><span class="manual-checkbox"></span> اطلعت، وأرغب بتغيير الموعد ليوم: <span class="with-dots" style="min-width:100px;"></span> الموافق: <span class="indic-num with-dots" style="min-width:120px;"></span> هـ</div>
  <div style="display:flex;justify-content:space-between;margin-top:20px;font-weight:bold;">
    <div style="white-space:nowrap;">الاسم: <span style="display:inline-block;border-bottom:1px dotted #000;min-width:180px;"></span></div>
    <div style="white-space:nowrap;">التوقيع: <span style="display:inline-block;border-bottom:1px dotted #000;min-width:180px;"></span></div>
    <div style="white-space:nowrap;">التاريخ: <span class="indic-num with-dots" style="min-width:120px;"></span> هـ</div>
  </div>
</div></div>`;

    case 'mahdar_dab_wakea':
      return `<div class="page-container">${H}
<div class="confidential-mark">(سري)</div>
<div class="form-title">محضر ضبط واقعة / مخالفة</div>
<div class="form-body">
  <div class="section-block align-right">إنه في يوم: <span class="data-field with-dots" style="min-width:40px;" id="mahdar_day"></span> الموافق: <span class="data-field with-dots indic-num" style="min-width:60px;" id="mahdar_date"></span> هـ تم ضبط الطالب: <span class="data-field with-dots" style="min-width:60px;" id="mahdar_studentName"></span> بالصف: <span class="data-field with-dots" style="min-width:40px;" id="mahdar_grade"></span></div>
  <div class="section-block align-right">بسبب قيامه بـ: <span class="data-field with-dots align-right" style="width:100%;display:inline-block;" id="mahdar_problem"></span></div>
  <div class="section-block align-right">مكان الضبط: <span class="data-field with-dots" style="min-width:60%;" id="mahdar_location"></span></div>
  <div class="section-block" style="border:1px solid #999;padding:10px;margin-top:10px;" id="mahdar_obs_box"><strong>نوع المشاهدة / المضبوطات:</strong><br>
    <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:20px;" id="mahdar_obs_list">
      <span><span class="manual-checkbox" id="mahdar_obs_0"></span> إفادة شاهد</span>
      <span><span class="manual-checkbox" id="mahdar_obs_1"></span> صور / فيديو</span>
      <span><span class="manual-checkbox" id="mahdar_obs_2"></span> أدوات مضبوطة</span>
      <span><span class="manual-checkbox" id="mahdar_obs_3"></span> تقرير طبي</span>
      <span><span class="manual-checkbox" id="mahdar_obs_4"></span> أخرى: <span class="data-field with-dots" style="min-width:100px;" id="mahdar_obs_other_text"></span></span>
    </div>
  </div>
  <div class="section-block" style="margin-top:15px;"><strong>شهود الواقعة:</strong>
    <table class="tracking-table"><thead><tr><th style="width:5%;">م</th><th style="width:35%;">الاسم</th><th style="width:25%;">الصفة / الوظيفة</th><th style="width:35%;">التوقيع</th></tr></thead>
    <tbody id="mahdar_witnesses_body">${emptyRows(2, 4)}</tbody></table>
  </div>
  <table class="footer-table" style="margin-top:20px;"><tr>
    <td style="width:33%;text-align:center;"><div class="signature-block" style="display:inline-block;text-align:right;"><strong style="display:block;margin-bottom:0.8em;text-align:center;">الطالب</strong><div style="margin-bottom:5px;white-space:nowrap;">الاسم: <span class="data-field with-dots" style="display:inline-block;min-width:150px;text-align:center;"></span></div><div style="white-space:nowrap;">التوقيع: <span style="display:inline-block;border-bottom:1px dotted #000;min-width:150px;"></span></div></div></td>
    <td style="width:33%;text-align:center;"><div class="signature-block" style="display:inline-block;text-align:right;"><strong style="display:block;margin-bottom:0.8em;text-align:center;">ولي الأمر (للعلم)</strong><div style="margin-bottom:5px;white-space:nowrap;">الاسم: <span class="data-field with-dots" style="display:inline-block;min-width:150px;text-align:center;"></span></div><div style="white-space:nowrap;">التوقيع: <span style="display:inline-block;border-bottom:1px dotted #000;min-width:150px;"></span></div></div></td>
    <td style="width:33%;text-align:center;"><div class="signature-block" style="display:inline-block;text-align:right;"><strong style="display:block;margin-bottom:0.8em;text-align:center;">مدير المدرسة</strong><div style="margin-bottom:5px;white-space:nowrap;">الاسم: <span class="data-field with-dots" style="display:inline-block;min-width:150px;text-align:center;"></span></div><div style="white-space:nowrap;">التوقيع: <span style="display:inline-block;border-bottom:1px dotted #000;min-width:150px;"></span></div></div></td>
  </tr></table>
</div></div>`;

    case 'mahdar_lajnah':
      return `<div class="page-container">${H}
<div class="form-title">محضر اجتماع لجنة التوجيه الطلابي<br><span style="font-size:14pt;font-weight:normal;">(لدراسة مخالفة سلوكية)</span></div>
<div class="form-body">
  <div class="section-block">إنه في يوم: <span class="data-field with-dots" style="min-width:80px;" id="lajnah_day"></span> الموافق: <span class="data-field with-dots indic-num" style="min-width:120px;" id="lajnah_date"></span> هـ عقدت لجنة التوجيه الطلابي اجتماعاً طارئاً برئاسة مدير المدرسة.</div>
  <div class="section-block align-right">وذلك للنظر في موضوع الطالب: <span class="data-field with-dots" style="min-width:250px;" id="lajnah_studentName"></span> بالصف: <span class="data-field with-dots" style="min-width:120px;" id="lajnah_grade"></span></div>
  <div class="sub-header">أولاً: وصف المخالفة / الحالة:</div>
  <div class="section-block align-right">قيام الطالب بارتكاب مخالفة من الدرجة (<span class="indic-num data-field with-dots" style="min-width:30px;" id="lajnah_degree"></span>)، وهي: <span class="data-field with-dots align-right" style="width:100%;display:inline-block;" id="lajnah_desc"></span></div>
  <div class="sub-header">ثانياً: الإجراءات التربوية المتخذة سابقاً:</div>
  <div class="section-block align-right">
    <div style="margin-bottom:5px;"><span class="indic-num">١.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_prev_1"></span></div>
    <div style="margin-bottom:5px;"><span class="indic-num">٢.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_prev_2"></span></div>
    <div style="margin-bottom:5px;"><span class="indic-num">٣.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_prev_3"></span></div>
  </div>
  <div class="sub-header">ثالثاً: توصيات وقرارات اللجنة:</div>
  <div class="section-block align-right">بعد دراسة الحالة والاطلاع على ملف الطالب، قررت اللجنة ما يلي:
    <div style="margin-top:5px;">
      <div style="margin-bottom:5px;"><span class="indic-num">١.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_rec_1"></span></div>
      <div style="margin-bottom:5px;"><span class="indic-num">٢.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_rec_2"></span></div>
      <div style="margin-bottom:5px;"><span class="indic-num">٣.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_rec_3"></span></div>
    </div>
  </div>
  <div class="sub-header">أعضاء اللجنة:</div>
  <table class="tracking-table"><thead><tr><th style="width:5%;">م</th><th style="width:35%;">الاسم</th><th style="width:25%;">العمل المكلف به</th><th style="width:35%;">التوقيع</th></tr></thead>
  <tbody id="lajnah_members_table">${emptyRows(7, 4)}</tbody></table>
</div></div>`;

    case 'mahdar_lajnah_absence':
      return `<div class="page-container">${H}
<div class="form-title">محضر اجتماع لجنة التوجيه الطلابي<br><span style="font-size:14pt;font-weight:normal;">(لدراسة حالة غياب طالب)</span></div>
<div class="form-body">
  <div class="section-block">إنه في يوم: <span class="data-field with-dots" style="min-width:80px;" id="lajnah_abs_day"></span> الموافق: <span class="data-field with-dots indic-num" style="min-width:120px;" id="lajnah_abs_date"></span> عقدت لجنة التوجيه الطلابي اجتماعاً طارئاً برئاسة مدير المدرسة.</div>
  <div class="section-block align-right">وذلك للنظر في موضوع الطالب: <span class="data-field with-dots" style="min-width:250px;" id="lajnah_abs_studentName"></span> بالصف: <span class="data-field with-dots" style="min-width:120px;" id="lajnah_abs_grade"></span></div>
  <div class="sub-header">أولاً: وصف الحالة:</div>
  <div class="section-block align-right">عدم انتظام الطالب في الحضور للمدرسة، ووصول غيابه إلى: <span class="data-field with-dots indic-num" id="lajnah_abs_unexcused" style="min-width:60px"></span> يوماً بدون عذر، و<span class="data-field with-dots indic-num" id="lajnah_abs_excused" style="min-width:60px"></span> يوماً بعذر.</div>
  <div class="sub-header">ثانياً: الإجراءات التربوية المتخذة سابقاً:</div>
  <div class="section-block align-right">
    <div style="margin-bottom:5px;"><span class="indic-num">١.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_abs_prev_1"></span></div>
    <div style="margin-bottom:5px;"><span class="indic-num">٢.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_abs_prev_2"></span></div>
    <div style="margin-bottom:5px;"><span class="indic-num">٣.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_abs_prev_3"></span></div>
  </div>
  <div class="sub-header">ثالثاً: توصيات وقرارات اللجنة:</div>
  <div class="section-block align-right">
    <div style="margin-bottom:5px;"><span class="indic-num">١.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_abs_rec_1"></span></div>
    <div style="margin-bottom:5px;"><span class="indic-num">٢.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_abs_rec_2"></span></div>
    <div style="margin-bottom:5px;"><span class="indic-num">٣.</span> <span class="data-field with-dots align-right" style="width:90%;" id="lajnah_abs_rec_3"></span></div>
  </div>
  <div class="sub-header">أعضاء اللجنة:</div>
  <table class="tracking-table"><thead><tr><th style="width:5%;">م</th><th style="width:35%;">الاسم</th><th style="width:25%;">العمل المكلف به</th><th style="width:35%;">التوقيع</th></tr></thead>
  <tbody id="lajnah_abs_members_table">${emptyRows(7, 4)}</tbody></table>
</div></div>`;

    case 'ehalat_talib':
      return `<div class="page-container referral-container">${H}
<div class="confidential-mark">(سري)</div>
<div class="form-title">نموذج إحالة طالب إلى الموجه الطلابي</div>
<div class="form-body">
  <div class="section-block"><strong>المكرم الموجه الطلابي بالمدرسة .. وفقكم الله</strong></div>
  <div class="section-block">السلام عليكم ورحمة الله وبركاته،،</div>
  <div class="section-block align-right">نحيل إليكم الطالب: <span class="data-field with-dots" style="min-width:250px;" id="ehala_studentName"></span> بالصف: <span class="data-field with-dots" style="min-width:120px;" id="ehala_grade"></span></div>
  <div class="section-block align-right">حيث لوحظ عليه: <span class="data-field with-dots align-right" style="width:100%;display:inline-block;" id="ehala_text"></span></div>
  <div class="section-block align-right">تاريخ المشكلة: <span class="data-field with-dots indic-num" style="min-width:250px;" id="ehala_date"></span> درجة المخالفة: <span class="data-field with-dots indic-num" style="min-width:120px;" id="ehala_degree"></span></div>
  <div class="section-block" style="margin-top:15px;">نأمل منكم دراسة حالة الطالب، واتخاذ الإجراءات التربوية والعلاجية المناسبة، وإفادتنا بما تم.</div>
  <table class="footer-table"><tr>
    <td><div style="border:2px dashed #ccc;width:80px;height:80px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;">الختم</div></td>
    <td></td>
    <td><div class="signature-block"><strong style="display:block;margin-bottom:0.8em;">وكيل شؤون الطلاب</strong><div style="margin-bottom:5px;">الاسم: <span class="data-field with-dots" id="ehala_deputyName" style="min-width:200px;"></span></div><div>التوقيع: <span class="with-dots" style="min-width:200px;"></span></div></div></td>
  </tr></table>
  <div class="internal-section">
    <div class="section-block" style="font-weight:bold;text-decoration:underline;">إفادة الموجه الطلابي (للاستخدام الداخلي):</div>
    <div class="section-block">تم الاطلاع على الحالة واتخاذ الإجراءات التالية:</div>
    <div class="feedback-box"></div>
    <div style="display:flex;justify-content:space-between;margin-top:20px;font-weight:bold;">
      <div>الاسم: <span class="data-field with-dots" id="ehala_counselorName" style="min-width:180px;"></span></div>
      <div>التوقيع: <span class="with-dots" style="min-width:180px;"></span></div>
      <div>التاريخ: <span class="indic-num with-dots" style="min-width:120px;"></span></div>
    </div>
  </div>
</div></div>`;

    case 'group_ehala':
      return `<div class="page-container">${H}
<div class="form-title">نموذج إحالة للموجه الطلابي</div>
<div class="form-body">
  <div class="section-block" style="text-align:center;">التاريخ: <span id="ge_date" class="data-field with-dots indic-num" style="min-width:120px;"></span></div>
  <div class="section-block align-right"><strong>المكرم الموجه الطلابي.. وفقكم الله</strong></div>
  <div class="section-block align-right">نحيل إليكم بيان بأسماء الطلاب الذين تجاوزوا حد الغياب المسموح، لمتابعة حالاتهم واتخاذ اللازم.</div>
  <table class="tracking-table"><thead><tr><th style="width:5%;">م</th><th style="width:22%;">اسم الطالب</th><th style="width:13%;">الصف</th><th style="width:10%;">بدون عذر</th><th style="width:10%;">بعذر</th><th style="width:40%;">ما تم حيال الطالب (من الموجه)</th></tr></thead>
  <tbody id="ge_table_body">${emptyRows(8, 6)}</tbody></table>
  <table class="footer-table"><tr><td style="width:100%;text-align:left;padding-left:30px;"><div style="display:inline-block;text-align:center;"><strong style="display:block;margin-bottom:0.5em;">وكيل شؤون الطلاب</strong><div style="margin-bottom:5px;">الاسم: <span id="ge_deputy" class="with-dots" style="min-width:150px;"></span></div><div>التوقيع: <span class="with-dots" style="min-width:150px;"></span></div></div></td></tr></table>
</div></div>`;

    case 'rasd_slooki':
      return `<div class="page-container">${H}
<div class="form-title">استمارة رصد المخالفات السلوكية (ملف الطالب)</div>
<div class="form-body">
  <div class="section-block align-right" style="margin-bottom:15px;">اسم الطالب: <span class="data-field with-dots" style="min-width:60px;" id="rasd_s_studentName"></span> الصف: <span class="data-field with-dots" style="min-width:40px;" id="rasd_s_grade"></span> الفصل: <span class="data-field with-dots" style="min-width:40px;" id="rasd_s_class"></span></div>
  <table class="tracking-table"><thead><tr><th style="width:5%;">م</th><th style="width:25%;">المخالفة</th><th style="width:10%;">الدرجة</th><th style="width:15%;">التاريخ</th><th style="width:45%;">الإجراء المتخذ</th></tr></thead>
  <tbody id="rs_table_body">${emptyRows(8, 5)}</tbody></table>
  <table class="footer-table"><tr><td style="width:100%;text-align:left;padding-left:30px;"><div style="display:inline-block;text-align:center;"><strong style="display:block;margin-bottom:0.5em;">وكيل شؤون الطلاب</strong><div style="margin-bottom:5px;">الاسم: <span id="rs_deputy" class="with-dots" style="min-width:150px;"></span></div><div>التوقيع: <span class="with-dots" style="min-width:150px;"></span></div></div></td></tr></table>
</div></div>`;

    case 'tawid_darajat':
      return `<div class="page-container">${H}
  <div class="form-title">استمارة فرص تعويض درجات السلوك الإيجابي</div>
  <div class="form-body">
  <div class="section-block align-right" style="margin-bottom:10px;">اسم الطالب: <span class="data-field with-dots" style="min-width:60px;" id="tawid_studentName"></span> الصف: <span class="data-field with-dots" style="min-width:40px;" id="tawid_grade"></span> الفصل: <span class="data-field with-dots" style="min-width:40px;" id="tawid_class"></span></div>
  <div
  style="border: 2px solid #333; padding: 10px; margin-bottom: 20px; background-color: #f9f9f9; border-radius: 5px;">
  <div style="font-weight: bold; text-decoration: underline; margin-bottom: 8px;">بيانات المخالفة
  السلوكية المراد تعويضها:</div>
  <table style="width: 100%; border: none;">
  <tr>
  <td style="border: none; padding: 5px; text-align: right;"><strong>المشكلة
  السلوكية:</strong> <span id="tawid_v_name" class="data-field with-dots"
  style="min-width: 200px;"></span></td>
  <td style="border: none; padding: 5px; text-align: right;"><strong>نوعها/درجتها:</strong>
  <span id="tawid_v_degree" class="data-field with-dots indic-num"
  style="min-width: 50px;"></span>
  </td>
  </tr>
  <tr>
  <td style="border: none; padding: 5px; text-align: right;"><strong>تاريخ وقوعها:</strong>
  <span id="tawid_v_date" class="data-field with-dots indic-num"
  style="min-width: 100px;"></span>
  </td>
  <td style="border: none; padding: 5px; text-align: right;"><strong>الدرجات
  المحسومة:</strong> <span id="tawid_v_points" class="data-field with-dots indic-num"
  style="min-width: 50px; color: #c0392b;"></span></td>
  </tr>
  </table>
  </div>
  <table class="tracking-table">
  <thead>
  <tr>
  <th style="width: 5%;">م</th>
  <th style="width: 45%;">فرص التعويض للدرجات المحسومة من السلوك</th>
  <th style="width: 15%;">مقدار درجات التعويض</th>
  <th style="width: 15%;">التاريخ</th>
  <th style="width: 20%;">الدرجات المكتسبة</th>
  </tr>
  </thead>
  <tbody>
  <tr>
  <td class="indic-num">١</td>
  <td style="text-align: right; padding-right: 5px;">انضباط الطالب وعدم غيابه دون عذر خلال
  الفصل الدراسي</td>
  <td class="indic-num">٣ درجات</td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٢</td>
  <td style="text-align: right; padding-right: 5px;">المحافظة على الهوية الوطنية (اللباس
  والمظهر العام، الالتزام بقيم الولاء)</td>
  <td class="indic-num">٣ درجات</td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٣</td>
  <td style="text-align: right; padding-right: 5px;">المشاركة في المبادرات والأعمال التطوعية
  داخل المدرسة</td>
  <td class="indic-num">٣ درجات</td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٤</td>
  <td style="text-align: right; padding-right: 5px;">المشاركة في الإذاعة والأنشطة المدرسية
  </td>
  <td class="indic-num">٣ درجات</td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٥</td>
  <td style="text-align: right; padding-right: 5px;">المحافظة على ممتلكات المدرسة</td>
  <td class="indic-num">درجتان</td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٦</td>
  <td style="text-align: right; padding-right: 5px;">التعاون مع الزملاء والمعلمين وإدارة
  المدرسة</td>
  <td class="indic-num">درجتان</td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٧</td>
  <td style="text-align: right; padding-right: 5px;">الالتحاق ببرامج ودورات في مجال التطوير
  الشخصي</td>
  <td class="indic-num">درجتان</td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٨</td>
  <td style="text-align: right; padding-right: 5px;">تقديم المقترحات التطويرية لصالح المجتمع
  المدرسي</td>
  <td class="indic-num">درجتان</td>
  <td></td>
  <td></td>
  </tr>
  </tbody>
  </table>
  <div class="section-block" style="margin-top: 10px; font-size: 12pt;">
  <strong>ملاحظة:</strong> إحضار الشواهد التي تثبت مشاركة الطالب من الجهات ذات العلاقة سواء داخل
  المدرسة أو خارجها.
  </div>
  <table class="footer-table" style="margin-top: 30px;">
  <tr>
  <td style="width: 33%;">
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.5em;">الطالب</strong>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 120px;"></span></div>
  </div>
  </td>
  <td style="width: 33%;">
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.5em;">الموجه الطلابي</strong>
  <div style="margin-bottom: 5px; white-space: nowrap;">
  الاسم: <span id="tawid_guide" class="with-dots" style="min-width: 150px;"></span>
  </div>
  <div style="white-space: nowrap;">
  التوقيع: <span class="with-dots" style="min-width: 120px;"></span>
  </div>
  </div>
  </td>
  <td style="width: 33%;">
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.5em;">وكيل شؤون الطلاب</strong>
  <div style="margin-bottom: 5px; white-space: nowrap;">
  الاسم: <span id="tawid_deputy" class="with-dots" style="min-width: 150px;"></span>
  </div>
  <div style="white-space: nowrap;">
  التوقيع: <span class="with-dots" style="min-width: 120px;"></span>
  </div>
  </div>
  </td>
  </tr>
  </table>
  </div>
  </div>`;

    case 'rasd_tamayuz':
      return `<div class="page-container">${H}
  <div class="form-title">سجل رصد السلوك المتميز والتعزيز</div>
  <div class="form-body">
  <div class="section-block align-right">اسم الطالب: <span class="data-field with-dots" style="min-width:250px;" id="rasd_studentName"></span> الصف: <span class="data-field with-dots" style="min-width:120px;" id="rasd_grade"></span></div>
  <table class="tracking-table">
  <thead>
  <tr>
  <th style="width: 40%;">السلوك الإيجابي</th>
  <th style="width: 15%;">التاريخ</th>
  <th style="width: 15%;">النقاط</th>
  <th style="width: 30%;">المعلم / المشرف</th>
  </tr>
  </thead>
  <tbody>
  <tr>
  <td style="height: 40px;"></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td style="height: 40px;"></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td style="height: 40px;"></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td style="height: 40px;"></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td style="height: 40px;"></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td style="height: 40px;"></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  </tbody>
  </table>
  <table class="footer-table">
  <tr>
  <td style="width: 33%;">
  <div
  style="border: 2px dashed #ccc; width: 80px; height: 80px; margin: 0 auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12pt;">
  الختم</div>
  </td>
  <td style="width: 33%;">
  <div class="signature-block"><strong style="display: block; margin-bottom: 0.8em;">وكيل شؤون
  الطلاب</strong>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  </div>
  </td>
  <td style="width: 33%;">
  <div class="signature-block"><strong style="display: block; margin-bottom: 0.8em;">مدير
  المدرسة</strong>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  </div>
  </td>
  </tr>
  </table>
  </div>
  </div>`;

    case 'ghiab_bidon_ozr':
      return `<div class="page-container">${H}
<div class="form-title">سجل متابعة غياب الطالب (بدون عذر)</div>
<div class="form-body">
  <div class="section-block align-right" style="margin-bottom:15px;">اسم الطالب: <span class="data-field with-dots" style="min-width:200px;" id="ghiab_no_studentName"></span> الصف: <span class="data-field with-dots indic-num" style="min-width:100px;" id="ghiab_no_grade"></span></div>
  <table class="tracking-table"><thead><tr><th style="width:5%;">م</th><th style="width:15%;">التاريخ</th><th style="width:10%;">اليوم</th><th style="width:35%;">الإجراء المتخذ</th><th style="width:35%;">ملاحظات</th></tr></thead>
  <tbody>${emptyRows(15, 5)}</tbody></table>
  <table class="footer-table"><tr><td style="width:100%;text-align:left;padding-left:30px;"><div style="display:inline-block;text-align:center;"><strong style="display:block;margin-bottom:0.5em;">وكيل شؤون الطلاب</strong><div style="margin-bottom:5px;">الاسم: <span id="ghiab_no_deputy" class="with-dots" style="min-width:150px;"></span></div><div>التوقيع: <span class="with-dots" style="min-width:150px;"></span></div></div></td></tr></table>
</div></div>`;

    case 'ghiab_ozr':
      return `<div class="page-container">${H}
<div class="form-title" style="margin-bottom:20px;">نموذج إجراءات الغياب بعذر</div>
<div class="form-body">
  <div class="section-block align-right" style="margin-bottom:15px;">اسم الطالب: <span class="data-field with-dots" style="min-width:200px;" id="ghiab_ozr_studentName"></span> الصف: <span class="data-field with-dots indic-num" style="min-width:100px;" id="ghiab_ozr_grade"></span></div>
  <table class="tracking-table"><thead><tr><th style="width:5%;">م</th><th style="width:15%;">التاريخ</th><th style="width:10%;">اليوم</th><th style="width:25%;">نوع العذر</th><th style="width:25%;">المرفقات</th><th style="width:20%;">ملاحظات</th></tr></thead>
  <tbody>${emptyRows(15, 6)}</tbody></table>
  <table class="footer-table"><tr><td style="width:100%;text-align:left;padding-left:30px;"><div style="display:inline-block;text-align:center;"><strong style="display:block;margin-bottom:0.5em;">وكيل شؤون الطلاب</strong><div style="margin-bottom:5px;">الاسم: <span id="ghiab_ozr_deputy" class="with-dots" style="min-width:150px;"></span></div><div>التوقيع: <span class="with-dots" style="min-width:150px;"></span></div></div></td></tr></table>
</div></div>`;

    case 'tahood_hodoor':
      return `<div class="page-container">${H}
  <div class="form-title">تعهد الالتزام بالحضور</div>
  <div class="form-body">
  <div class="section-block" style="text-align: justify; line-height: 1.8; margin-bottom: 20px;">
  أقر أنا الطالب: <span class="data-field with-dots" style="min-width: 60px; font-weight: bold;"
  id="tahood_h_studentName"></span>
  بالصف: <span class="data-field with-dots" style="min-width: 40px;" id="tahood_h_grade"></span>
  بأنني قد تغيّبت عن الدوام المدرسي خلال الفترة الماضية، وذلك على النحو التالي:
  </div>
  <div
  style="border: 2px solid #ccc; padding: 15px; margin: 25px 0; background-color: #f9f9f9; display: flex; justify-content: space-around; align-items: center;">
  <div>
  <strong>عدد أيام الغياب (بدون عذر):</strong>
  <span class="data-field indic-num" style="font-size: 16pt; color: #000; font-weight: bold;"
  id="tahood_h_unexcused"></span>
  </div>
  <div style="border-left: 2px solid #ccc; height: 30px;"></div>
  <div>
  <strong>عدد أيام الغياب (بعذر):</strong>
  <span class="data-field indic-num" style="font-size: 16pt; color: #000; font-weight: bold;"
  id="tahood_h_excused"></span>
  </div>
  </div>
  <div class="section-block"
  style="text-align: justify; line-height: 1.8; margin-top: 20px; margin-bottom: 50px;">
  وأتعهد بالالتزام بالخطة التربوية والعلاجية المقدمة لتحسين الحضور، وعدم تكرار الغياب مستقبلاً، والحرص
  على الانضباط المدرسي، وعلى ذلك جرى التوقيع.
  </div>
  <table class="footer-table" style="margin-top: 60px;">
  <tr>
  <td style="width: 33%;">
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.8em;">الطالب</strong>
  <div style="margin-bottom: 5px; white-space: nowrap;">الاسم: <span
  class="data-field with-dots" style="min-width: 150px;"
  id="tahood_h_sig_student"></span></div>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  </div>
  </td>
  <td style="width: 33%;">
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.8em;">ولي الأمر</strong>
  <div style="margin-bottom: 5px; white-space: nowrap;">الاسم: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  </div>
  </td>
  <td style="width: 33%;">
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.8em;">مدير المدرسة</strong>
  <div style="margin-bottom: 5px; white-space: nowrap;">الاسم: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  </div>
  </td>
  </tr>
  </table>
  </div>
  </div>`;

    case 'group_tahood':
      return `<div class="page-container">${H}
<div class="form-title">تعهد بعدم غياب والتزام بالحضور</div>
<div class="form-body">
  <div class="section-block" style="text-align:center;">التاريخ: <span id="gt_date" class="data-field with-dots indic-num" style="min-width:120px;"></span></div>
  <div class="section-block align-right">نحن الموقعون أدناه نتعهد بالالتزام بالحضور يومياً للمدرسة وعدم الغياب إلا لعذر قهري.</div>
  <table class="tracking-table"><thead><tr><th style="width:5%;">م</th><th style="width:25%;">اسم الطالب</th><th style="width:13%;">الصف</th><th style="width:10%;">بدون عذر</th><th style="width:10%;">بعذر</th><th style="width:20%;">توقيع الطالب</th><th style="width:17%;">توقيع ولي الأمر</th></tr></thead>
  <tbody id="gt_table_body">${emptyRows(10, 7)}</tbody></table>
  <table class="footer-table"><tr><td style="width:100%;text-align:left;padding-left:30px;"><div style="display:inline-block;text-align:center;"><strong style="display:block;margin-bottom:0.5em;">وكيل شؤون الطلاب</strong><div style="margin-bottom:5px;">الاسم: <span id="gt_deputy" class="with-dots" style="min-width:150px;"></span></div><div>التوقيع: <span class="with-dots" style="min-width:150px;"></span></div></div></td></tr></table>
</div></div>`;

    case 'iltizam_madrasi':
      return `<div class="page-container">${H}
<div class="form-title">نموذج الالتزام المدرسي</div>
<div class="form-body">
  <div style="border:2px solid #333;padding:15px;margin-bottom:30px;border-radius:8px;">
    <div style="font-weight:bold;text-decoration:underline;margin-bottom:15px;font-size:14pt;">خاص بالطالب:</div>
    <div class="section-block align-right" style="margin-bottom:15px;">الاسم: <span class="data-field with-dots" style="min-width:60px;border-bottom:1px solid #000;" id="iltizam_name"></span> الصف: <span class="data-field with-dots" style="min-width:40px;border-bottom:1px solid #000;" id="iltizam_grade"></span></div>
    <div class="section-block" style="text-align:justify;line-height:2;margin-bottom:20px;">
      نعم أنا الطالب الموضح اسمه وبياناته أعلاه. قد اطلعت على محتوى قواعد السلوك والمواظبة. وبناء عليه أتعهد أن ألتزم بالأنظمة والتعليمات الخاصة بقواعد السلوك والمواظبة.
    </div>
    <div style="display:flex;gap:30px;align-items:flex-end;">
      <div style="flex:1;">التوقيع: <span class="data-field with-dots" style="display:inline-block;width:70%;border-bottom:1px solid #000;min-height:10px;" id="iltizam_student_sign"></span></div>
      <div style="flex:1;">التاريخ: <span class="data-field indic-num" style="display:inline-block;width:70%;border-bottom:1px solid #000;text-align:center;" id="iltizam_date"></span></div>
    </div>
  </div>
  <div style="border:2px solid #333;padding:15px;border-radius:8px;">
    <div style="font-weight:bold;text-decoration:underline;margin-bottom:15px;font-size:14pt;">خاص بولي الأمر:</div>
    <div class="section-block" style="text-align:justify;line-height:2;margin-bottom:15px;">
      نعم أنا ولي أمر الطالب الموضح اسمه وبياناته أعلاه. قد اطلعت على محتوى قواعد السلوك والمواظبة. وبناء عليه أتعهد أن أتعاون مع إدارة المدرسة في سبيل مصلحة ابني، ليكون ملتزماً بالأنظمة والتعليمات الخاصة بقواعد السلوك والمواظبة، وأتحمل مسؤولية صحة أرقام التواصل التالية:
    </div>
    <div style="display:flex;gap:30px;margin-bottom:25px;">
      <div style="flex:1;">جوال (١): <span style="display:inline-block;width:70%;border-bottom:1px solid #000;height:20px;"></span></div>
      <div style="flex:1;">جوال (٢): <span style="display:inline-block;width:70%;border-bottom:1px solid #000;height:20px;"></span></div>
    </div>
    <div style="display:flex;gap:15px;align-items:center;">
      <div style="flex:1.5;white-space:nowrap;">اسم ولي الأمر: <span style="display:inline-block;width:60%;border-bottom:1px solid #000;height:20px;"></span></div>
      <div style="flex:1;white-space:nowrap;">التوقيع: <span style="display:inline-block;width:60%;border-bottom:1px solid #000;height:20px;"></span></div>
      <div style="flex:0.8;white-space:nowrap;">التاريخ: <span class="indic-num" style="display:inline-block;width:50%;border-bottom:1px solid #000;text-align:center;height:20px;"></span></div>
    </div>
  </div>
</div></div>`;

    case 'rasd_moalem':
      return `<div class="page-container">${H}
  <div class="form-title">سجل متابعة ورصد مخالفات الطلاب (للمعلم)</div>
  <div class="form-body">
  <div class="section-block align-right" style="margin-bottom:15px;">المادة: <span class="data-field with-dots" style="min-width:80px;" id="rasd_m_subject"></span> الصف: <span class="data-field with-dots" style="min-width:80px;" id="rasd_m_grade"></span> المعلم: <span class="data-field with-dots" style="min-width:100px;" id="rasd_m_teacher"></span></div>
  <table class="tracking-table">
  <thead>
  <tr>
  <th style="width: 5%;">م</th>
  <th style="width: 25%;">اسم الطالب</th>
  <th style="width: 20%;">المخالفة</th>
  <th style="width: 20%;">الإجراء المتخذ</th>
  <th style="width: 15%;">التاريخ</th>
  <th style="width: 15%;">توقيع الطالب</th>
  </tr>
  </thead>
  <tbody id="rasd_m_tbody">
  <tr>
  <td class="indic-num">١</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٢</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٣</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٤</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٥</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٦</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٧</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  <tr>
  <td class="indic-num">٨</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  </tr>
  </tbody>
  </table>
  <div class="section-block align-right" style="margin-top: 20px; font-size: 14pt;">
  <strong>ملاحظة:</strong> يتم تحويل الطالب للموجه الطلابي في حال تكرار المخالفة أو ارتكاب مخالفة
  تستوجب التدخل.
  </div>
  </div>
  </div>`;

    case 'high_risk':
      return `<div class="page-container">${H}
<div class="confidential-mark">(سري للغاية وعاجل)</div>
<div class="form-title">نموذج إبلاغ عن حالة عالية الخطورة</div>
<div class="form-body">
  <div class="section-block align-right">اسم الطالب: <span class="data-field with-dots" style="min-width:250px;" id="risk_studentName"></span> الصف الدراسي: <span class="data-field with-dots" style="min-width:120px;" id="risk_grade"></span></div>
  <div class="risk-box" style="margin-bottom:15px;" id="risk_types_box"><strong>نوع الخطر:</strong><br>
    <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:15px;font-size:15pt;" id="risk_types_list">
      <span><span class="manual-checkbox" id="risk_chk_0"></span> حيازة سلاح</span>
      <span><span class="manual-checkbox" id="risk_chk_1"></span> مخدرات</span>
      <span><span class="manual-checkbox" id="risk_chk_2"></span> تهديد بالعنف</span>
      <span><span class="manual-checkbox" id="risk_chk_3"></span> مضاربة جماعية</span>
      <span><span class="manual-checkbox" id="risk_chk_4"></span> تحرش</span>
      <span><span class="manual-checkbox" id="risk_chk_5"></span> أخرى: <span class="data-field with-dots" style="min-width:100px;" id="risk_other_text"></span></span>
    </div>
  </div>
  <div class="section-block" style="margin-bottom:15px;"><strong>وصف الحالة:</strong><br><span class="data-field with-dots" style="width:100%;margin-bottom:5px;" id="risk_desc"></span></div>
  <div class="section-block align-right" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px;margin-bottom:15px;">
    <div style="width:50%;">اسم راصد الحالة: <span class="data-field with-dots" style="width:60%;" id="risk_observer"></span></div>
    <div style="width:25%;">تاريخ الرصد: <span class="data-field with-dots indic-num" style="width:50%;" id="risk_date"></span></div>
    <div style="width:20%;">وقت الرصد: <span class="data-field with-dots indic-num" style="width:45%;" id="risk_time"></span></div>
  </div>
  <div class="section-block" style="margin-bottom:20px;"><strong>الإجراءات المتخذة مع الحالة:</strong><br>
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px;font-size:14pt;">
      <span><span class="manual-checkbox"></span> تبليغ إدارة التعليم.</span>
      <span><span class="manual-checkbox"></span> تبليغ الجهات الأمنية.</span>
      <span><span class="manual-checkbox"></span> تبليغ الحماية من العنف الأسري وحماية الطفل.</span>
      <span><span class="manual-checkbox"></span> تبليغ وزارة الصحة.</span>
      <span><span class="manual-checkbox"></span> التواصل مع الأسرة لإخطارها بوضع الحالة.</span>
      <span><span class="manual-checkbox"></span> عقد اجتماع طارئ للجنة التوجيه الطلابي لدراسة الحالة ووضع خطة لمعالجتها بالتكامل مع الجهات ذات العلاقة.</span>
      <span><span class="manual-checkbox"></span> رفع بلاغ عن الحالة في الأنظمة التقنية الخاصة بالبلاغات.</span>
    </div>
  </div>
  <div class="section-block" style="display:flex;justify-content:flex-end;padding-top:20px;border-top:1px solid #ddd;">
    <div style="text-align:center;min-width:250px;"><strong style="display:block;margin-bottom:12px;font-size:15pt;">مدير المدرسة</strong>
      <div style="margin-bottom:8px;text-align:right;">الاسم: <span class="data-field with-dots" style="min-width:180px;" id="risk_manager"></span></div>
      <div style="margin-bottom:8px;text-align:right;">التوقيع: <span class="with-dots" style="min-width:180px;"></span></div>
      <div style="text-align:right;">التاريخ: <span class="data-field with-dots indic-num" style="min-width:180px;" id="risk_manager_date"></span></div>
    </div>
  </div>
</div></div>`;

    case 'eblagh_etha':
      return `<div class="page-container">${H}
<div class="confidential-mark">(سري للغاية)</div>
<div class="form-title">نموذج رصد وإبلاغ عن حالة إيذاء (حماية)</div>
<div class="form-body">
  <div class="section-block align-right">التاريخ: <span class="data-field with-dots indic-num" style="min-width:120px;" id="eblagh_date"></span></div>
  <div class="info-box"><span class="box-title">أولاً: بيانات المُبَلِّغ (المدرسة):</span>
    <div class="section-block align-right">الاسم: <span class="data-field with-dots" style="min-width:60px;" id="eblagh_reporter"></span> صفته: <span class="data-field with-dots" style="min-width:60px;" id="eblagh_role"></span></div>
  </div>
  <div class="info-box"><span class="box-title">ثانياً: بيانات الضحية:</span>
    <div class="section-block align-right">الاسم: <span class="data-field with-dots" style="min-width:60px;" id="eblagh_victim_name"></span> الصف: <span class="data-field with-dots" style="min-width:40px;" id="eblagh_grade"></span></div>
  </div>
  <div class="section-block"><strong>ثالثاً: ملخص الحالة:</strong><br><span class="data-field with-dots" style="width:100%;margin-bottom:5px;" id="eblagh_summary"></span></div>
  <div class="section-block"><strong>رابعاً: الإجراءات المتخذة:</strong><br>
    <div style="margin-top:5px;margin-bottom:5px;"><span class="indic-num">١-</span> <span class="data-field with-dots" style="width:93%;" id="eblagh_proc_1"></span></div>
    <div style="margin-bottom:5px;"><span class="indic-num">٢-</span> <span class="data-field with-dots" style="width:93%;" id="eblagh_proc_2"></span></div>
    <div style="margin-bottom:10px;"><span class="indic-num">٣-</span> <span class="data-field with-dots" style="width:93%;" id="eblagh_proc_3"></span></div>
    <div style="margin-top:5px;"><span style="font-weight:bold;">تم التواصل مع مركز البلاغات 1919؟</span> <span style="margin-right:20px;"><span class="manual-checkbox"></span> نعم (رقم البلاغ: <span class="indic-num with-dots" style="min-width:80px;"></span>)</span><span style="margin-right:20px;"><span class="manual-checkbox"></span> لا</span></div>
  </div>
  <table class="footer-table"><tr>
    <td style="width:33%;"><div style="border:2px dashed #ccc;width:80px;height:80px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12pt;">الختم</div></td>
    <td style="width:33%;"><div class="signature-block"><strong style="display:block;margin-bottom:0.8em;">الموجه الطلابي</strong><div style="margin-bottom:5px;white-space:nowrap;">الاسم: <span class="data-field with-dots" style="min-width:120px;" id="eblagh_counselor"></span></div><div style="white-space:nowrap;">التوقيع: <span class="with-dots" style="min-width:120px;"></span></div></div></td>
    <td style="width:33%;"><div class="signature-block"><strong style="display:block;margin-bottom:0.8em;">مدير المدرسة</strong><div style="margin-bottom:5px;white-space:nowrap;">الاسم: <span class="data-field with-dots" style="min-width:120px;" id="eblagh_manager"></span></div><div style="white-space:nowrap;">التوقيع: <span class="with-dots" style="min-width:120px;"></span></div></div></td>
  </tr></table>
</div></div>`;

    case 'khota_tadeel':
      return `<div
  style="padding: 3mm 8mm; font-family: 'Traditional Arabic', 'Amiri', serif; font-size: 14pt; line-height: 1.35;">
  ${H}
  <div style="text-align: center; font-size: 17pt; font-weight: bold; margin-top: 3px; margin-bottom: 8px;">
  نموذج خطة تعديل السلوك</div>
  <div
  style="background-color: #eee; padding: 3px 8px; border: 1px solid #000; font-size: 13pt; font-weight: bold; margin-bottom: 5px; text-decoration: underline;">
  أولاً: البيانات الأولية:</div>
  <div class="section-block align-right" style="margin-bottom:2mm;">اسم الطالب: <span class="data-field with-dots" style="min-width:60px;" id="khota_studentName"></span> الصف: <span class="data-field with-dots" style="min-width:40px;" id="khota_grade"></span> الفصل: <span class="data-field with-dots" style="min-width:30px;" id="khota_class"></span></div>
  <div class="section-block align-right" style="margin-bottom:4mm;">تاريخ الميلاد: <span class="data-field with-dots" style="min-width:50px;" id="khota_dob"></span> العمر: <span class="data-field with-dots" style="min-width:30px;" id="khota_age"></span> تاريخ البداية: <span class="data-field with-dots" style="min-width:50px;" id="khota_start"></span> تاريخ النهاية: <span class="data-field with-dots" style="min-width:50px;" id="khota_end"></span></div>
  <div
  style="background-color: #eee; padding: 3px 8px; border: 1px solid #000; font-size: 13pt; font-weight: bold; margin-top: 5px; margin-bottom: 5px; text-decoration: underline;">
  ثانياً: تحديد المشكلة السلوكية:</div>
  <div style="margin-bottom: 3mm;">المشكلة السلوكية: <span class="data-field"
  style="min-width: 200px; display: inline-block; border-bottom: 1px dotted #999; text-align: center;" id="khota_problem"></span>
  درجتها: <span class="data-field"
  style="min-width: 45px; display: inline-block; border-bottom: 1px dotted #999; text-align: center;" id="khota_degree"></span>
  </div>
  <div style="margin-bottom: 3mm;">وصف المشكلة السلوكية: <span class="data-field"
  style="width: 65%; display: inline-block; border-bottom: 1px dotted #999; text-align: center;" id="khota_desc"></span>
  </div>
  <div style="margin-bottom: 2mm;">المظاهر السلوكية التي تبدو عند الطالب:</div>
  <div style="margin-bottom: 2mm; margin-right: 10px;"><span style="font-weight: bold;">١-</span> <span class="data-field"
  style="width: 92%; display: inline-block; border-bottom: 1px dotted #999; height: 20px;" id="khota_m1"></span>
  </div>
  <div style="margin-bottom: 4mm; margin-right: 10px;"><span style="font-weight: bold;">٢-</span> <span class="data-field"
  style="width: 92%; display: inline-block; border-bottom: 1px dotted #999; height: 20px;" id="khota_m2"></span>
  </div>
  <div
  style="background-color: #eee; padding: 3px 8px; border: 1px solid #000; font-size: 13pt; font-weight: bold; margin-top: 5px; margin-bottom: 5px; text-decoration: underline;">
  ثالثاً: قياس شدة أو تكرار السلوك:</div>
  <table
  style="width: 100%; border-collapse: collapse; font-size: 11pt; margin-top: 3px; margin-bottom: 5px;">
  <thead>
  <tr>
  <th rowspan="2"
  style="border: 1px solid #000; padding: 3px; width: 8%; background-color: #f2f2f2;">اليوم
  </th>
  <th rowspan="2"
  style="border: 1px solid #000; padding: 3px; width: 14%; background-color: #f2f2f2;">التاريخ
  </th>
  <th rowspan="2"
  style="border: 1px solid #000; padding: 3px; width: 14%; background-color: #f2f2f2;">فترة
  الملاحظة</th>
  <th colspan="5" style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">التكرار
  </th>
  <th rowspan="2"
  style="border: 1px solid #000; padding: 3px; width: 10%; background-color: #f2f2f2;">المجموع
  </th>
  </tr>
  <tr>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">١</th>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">٢</th>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">٣</th>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">٤</th>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">٥</th>
  </tr>
  </thead>
  <tbody>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">١</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">٢</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">٣</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">٤</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">٥</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  </tbody>
  </table>
  <div
  style="background-color: #eee; padding: 3px 8px; border: 1px solid #000; font-size: 13pt; font-weight: bold; margin-top: 5px; margin-bottom: 5px; text-decoration: underline;">
  رابعاً: تحديد وظيفة السلوك (التحليل):</div>
  <div style="margin-bottom: 4mm;">
  <div style="font-weight: bold;">المثيرات القبلية: <span style="font-weight: normal;">(الأسباب التي تسبق
  السلوك غير المرغوب):</span></div>
  <div style="width: 100%; border-bottom: 1px dotted #999; height: 22px;"></div>
  </div>
  <div style="margin-bottom: 4mm;">
  <div style="font-weight: bold;">المثيرات البعدية: <span style="font-weight: normal;">(ماذا يحدث بعد
  السلوك؟):</span></div>
  <div style="width: 100%; border-bottom: 1px dotted #999; height: 22px;"></div>
  </div>
  <div style="margin-bottom: 4mm;">
  <div style="font-weight: bold;">ما الذي يحققه الطالب من خلال السلوك؟</div>
  <div style="width: 100%; border-bottom: 1px dotted #999; height: 22px;"></div>
  </div>
  <div style="margin-bottom: 0;">
  <div style="font-weight: bold;">الإجراءات السابقة المستخدمة للحد من السلوك:</div>
  <div style="width: 100%; border-bottom: 1px dotted #999; height: 22px;"></div>
  </div>
  </div>
  <div style="page-break-before: always;"></div>
  <div
  style="padding: 3mm 8mm; font-family: 'Traditional Arabic', 'Amiri', serif; font-size: 14pt; line-height: 1.35;">
  <div class="header-container"
  style="border-bottom: 2px solid #000; padding-bottom: 3px; margin-bottom: 5px;"><img src=""
  class="header-logo" alt="الشعار"></div>
  <div style="text-align: center; font-size: 17pt; font-weight: bold; margin-top: 3px; margin-bottom: 8px;">
  تابع: خطة تعديل السلوك</div>
  <div
  style="background-color: #eee; padding: 3px 8px; border: 1px solid #000; font-size: 13pt; font-weight: bold; margin-bottom: 5px; text-decoration: underline;">
  خامساً: تصميم خطة تعديل السلوك:</div>
  <div style="margin-bottom: 4mm;">
  <div style="font-weight: bold;">تعريف السلوك المرغوب إكسابه للطالب إجرائياً:</div>
  <div style="width: 100%; border-bottom: 1px dotted #999; height: 22px;"></div>
  </div>
  <div style="margin-bottom: 3mm;">
  <div style="font-weight: bold;">الإجراءات المستخدمة للحد من السلوك غير المرغوب وتحقيق السلوك المرغوب:
  </div>
  </div>
  <div style="margin-right: 10px; line-height: 1.4;">
  <div style="margin-bottom: 3mm;"><span style="font-weight: bold;">١-</span> الإجراء الأول: <span
  style="width: 70%; display: inline-block; border-bottom: 1px dotted #999; height: 20px;"></span>
  </div>
  <div style="margin-bottom: 3mm;"><span style="font-weight: bold;">٢-</span> الإجراء الثاني: <span
  style="width: 70%; display: inline-block; border-bottom: 1px dotted #999; height: 20px;"></span>
  </div>
  <div style="margin-bottom: 3mm;"><span style="font-weight: bold;">٣-</span> الإجراء الثالث: <span
  style="width: 70%; display: inline-block; border-bottom: 1px dotted #999; height: 20px;"></span>
  </div>
  <div style="margin-bottom: 3mm;"><span style="font-weight: bold;">٤-</span> الإجراء الرابع: <span
  style="width: 70%; display: inline-block; border-bottom: 1px dotted #999; height: 20px;"></span>
  </div>
  <div style="margin-bottom: 3mm;"><span style="font-weight: bold;">٥-</span> الإجراء الخامس: <span
  style="width: 70%; display: inline-block; border-bottom: 1px dotted #999; height: 20px;"></span>
  </div>
  <div style="margin-bottom: 4mm;"><span style="font-weight: bold;">٦-</span> الإجراء السادس: <span
  style="width: 70%; display: inline-block; border-bottom: 1px dotted #999; height: 20px;"></span>
  </div>
  </div>
  <div style="margin-bottom: 3px; font-weight: bold;">متابعة السلوك (بعد التنفيذ):</div>
  <table
  style="width: 100%; border-collapse: collapse; font-size: 11pt; margin-top: 3px; margin-bottom: 5px;">
  <thead>
  <tr>
  <th rowspan="2"
  style="border: 1px solid #000; padding: 3px; width: 8%; background-color: #f2f2f2;">اليوم
  </th>
  <th rowspan="2"
  style="border: 1px solid #000; padding: 3px; width: 14%; background-color: #f2f2f2;">التاريخ
  </th>
  <th rowspan="2"
  style="border: 1px solid #000; padding: 3px; width: 14%; background-color: #f2f2f2;">فترة
  الملاحظة</th>
  <th colspan="5" style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">التكرار
  </th>
  <th rowspan="2"
  style="border: 1px solid #000; padding: 3px; width: 10%; background-color: #f2f2f2;">المجموع
  </th>
  </tr>
  <tr>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">١</th>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">٢</th>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">٣</th>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">٤</th>
  <th style="border: 1px solid #000; padding: 3px; background-color: #f2f2f2;">٥</th>
  </tr>
  </thead>
  <tbody>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">١</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">٢</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">٣</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">٤</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  <tr style="height: 22px;">
  <td style="border: 1px solid #000; text-align: center;">٥</td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  <td style="border: 1px solid #000;"></td>
  </tr>
  </tbody>
  </table>
  <div
  style="background-color: #eee; padding: 3px 8px; border: 1px solid #000; font-size: 13pt; font-weight: bold; margin-top: 3px; margin-bottom: 3px; text-decoration: underline;">
  سادساً: تقييم فاعلية الخطة أو البرنامج:</div>
  <div style="margin-bottom: 2mm;">رأي وكيل / وكيلة المدرسة: <span
  style="width: 65%; display: inline-block; border-bottom: 1px dotted #999; height: 18px;"></span>
  </div>
  <div style="margin-bottom: 2mm;">رأي معلم / معلمة الفصل: <span
  style="width: 67%; display: inline-block; border-bottom: 1px dotted #999; height: 18px;"></span>
  </div>
  <div style="margin-bottom: 3mm;">رأي ولي الأمر: <span
  style="width: 75%; display: inline-block; border-bottom: 1px dotted #999; height: 18px;"></span>
  </div>
  <div style="margin-bottom: 2mm; font-weight: bold;">القائم بتعديل السلوك (معلم / موجه طلابي):</div>
  <div style="margin-right: 20px; line-height: 1.3;">
  <div style="margin-bottom: 2mm;">الاسم: <span
  style="width: 160px; display: inline-block; border-bottom: 1px dotted #999; height: 18px;"></span>
  </div>
  <div style="margin-bottom: 2mm;">التوقيع: <span
  style="width: 160px; display: inline-block; border-bottom: 1px dotted #999; height: 18px;"></span>
  </div>
  <div>التاريخ: <span
  style="width: 110px; display: inline-block; border-bottom: 1px dotted #999; height: 18px;"></span>
  </div>
  </div>
  </div>`;

    case 'ehalat_absence':
      return `<div class="page-container referral-container">${H}
<div class="confidential-mark">(سري)</div>
<div class="form-title">نموذج إحالة طالب إلى الموجه الطلابي<br><span style="font-size:14pt;font-weight:normal;">(غياب وتأخر دراسي)</span></div>
<div class="form-body">
  <div class="section-block"><strong>المكرم الموجه الطلابي بالمدرسة .. وفقكم الله</strong></div>
  <div class="section-block">السلام عليكم ورحمة الله وبركاته،،</div>
  <div class="section-block align-right">نحيل إليكم الطالب: <span class="data-field with-dots" style="min-width:250px;" id="ehala_abs_studentName"></span> بالصف: <span class="data-field with-dots" style="min-width:120px;" id="ehala_abs_grade"></span></div>
  <div class="section-block align-right" style="margin-top:10px;">
    <strong>سبب الإحالة:</strong> تكرار غياب الطالب وتأثيره السلبي على مستواه الدراسي والسلوكي.
  </div>
  <div style="border:2px solid #ccc;padding:10px;margin:15px 0;background-color:#f9f9f9;display:flex;justify-content:space-around;">
    <div><strong>غياب بدون عذر:</strong> <span class="data-field indic-num" style="font-size:16pt;color:#000;" id="ehala_abs_unexcused"></span> أيام</div>
    <div style="border-right:1px solid #ccc;"></div>
    <div><strong>غياب بعذر:</strong> <span class="data-field indic-num" style="font-size:16pt;color:#000;" id="ehala_abs_excused"></span> أيام</div>
  </div>
  <div class="section-block" style="margin-top:15px;">نأمل منكم دراسة حالة الطالب، واتخاذ الإجراءات التربوية والعلاجية المناسبة، وإفادتنا بما تم.</div>
  <table class="footer-table"><tr>
    <td><div style="border:2px dashed #ccc;width:80px;height:80px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12pt;">الختم</div></td>
    <td></td>
    <td><div class="signature-block"><strong style="display:block;margin-bottom:0.8em;">وكيل شؤون الطلاب</strong><div style="margin-bottom:5px;white-space:nowrap;">الاسم: <span class="with-dots" style="min-width:200px;"></span></div><div style="white-space:nowrap;">التوقيع: <span class="with-dots" style="min-width:200px;"></span></div></div></td>
  </tr></table>
  <div class="internal-section">
    <div class="section-block" style="font-weight:bold;text-decoration:underline;">إفادة الموجه الطلابي (للاستخدام الداخلي):</div>
    <div class="section-block">تم الاطلاع على حالة الطالب واتخاذ الإجراءات التالية:</div>
    <div class="feedback-box" style="height:120px;"></div>
    <div style="display:flex;justify-content:space-between;margin-top:20px;font-weight:bold;">
      <div style="white-space:nowrap;">الاسم: <span class="with-dots" style="min-width:180px;"></span></div>
      <div style="white-space:nowrap;">التوقيع: <span class="with-dots" style="min-width:180px;"></span></div>
      <div style="white-space:nowrap;">التاريخ: <span class="indic-num with-dots" style="min-width:120px;"></span></div>
    </div>
  </div>
</div></div>`;

    case 'tawtheeq_tawasol':
      return `<div class="page-container">${H}
  <div class="form-title">نموذج توثيق التواصل مع ولي الأمر</div>
  <div class="form-body">
  <!-- بيانات الطالب -->
  <div class="section-block align-right">اسم الطالب: <span class="data-field with-dots" style="min-width:60px;" id="tawtheeq_studentName"></span> بالصف: <span class="data-field with-dots" style="min-width:40px;" id="tawtheeq_grade"></span> في يوم: <span class="data-field with-dots" style="min-width:40px;" id="tawtheeq_day"></span> الموافق: <span class="data-field with-dots indic-num" style="min-width:60px;" id="tawtheeq_date"></span></div>
  <!-- بيانات التواصل -->
  <table class="tracking-table" style="margin-top: 20px;">
  <thead>
  <tr>
  <th style="width: 25%;">نوع التواصل</th>
  <th style="width: 75%;">التفاصيل</th>
  </tr>
  </thead>
  <tbody>
  <tr style="height: 45px;">
  <td style="font-weight: bold; background-color: #f5f5f5;">نوع الإشعار</td>
  <td style="text-align: right; padding-right: 10px;" id="tawtheeq_contactType"></td>
  </tr>
  <tr style="height: 60px;">
  <td style="font-weight: bold; background-color: #f5f5f5;">سبب التواصل</td>
  <td style="text-align: right; padding-right: 10px;" id="tawtheeq_contactReason"></td>
  </tr>
  <tr style="height: 45px;">
  <td style="font-weight: bold; background-color: #f5f5f5;">وسيلة التواصل</td>
  <td>
  <div style="display: flex; gap: 25px; justify-content: center; padding: 5px;">
  <span><span class="manual-checkbox"></span> واتساب</span>
  <span><span class="manual-checkbox"></span> اتصال هاتفي</span>
  <span><span class="manual-checkbox"></span> حضور شخصي</span>
  <span><span class="manual-checkbox"></span> أخرى</span>
  </div>
  </td>
  </tr>
  <tr style="height: 45px;">
  <td style="font-weight: bold; background-color: #f5f5f5;">نتيجة التواصل</td>
  <td style="text-align: right; padding-right: 10px; font-weight: bold;"
  id="tawtheeq_contactResult"></td>
  </tr>
  </tbody>
  </table>
  <!-- ملاحظات -->
  <div class="section-block" style="margin-top: 20px;">
  <strong>ملاحظات:</strong>
  <div style="border: 1px solid #999; min-height: 80px; margin-top: 5px; padding: 8px;"
  id="tawtheeq_notes"></div>
  </div>
  <!-- التوقيعات -->
  <table class="footer-table" style="margin-top: 40px;">
  <tr>
  <td>
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.8em;">الموجه الطلابي</strong>
  <div style="margin-bottom: 5px; white-space: nowrap;">الاسم: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  </div>
  </td>
  <td>
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.8em;">ولي الأمر</strong>
  <div style="margin-bottom: 5px; white-space: nowrap;">الاسم: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  </div>
  </td>
  <td>
  <div class="signature-block">
  <strong style="display: block; margin-bottom: 0.8em;">مدير المدرسة</strong>
  <div style="margin-bottom: 5px; white-space: nowrap;">الاسم: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  <div style="white-space: nowrap;">التوقيع: <span class="with-dots"
  style="min-width: 150px;"></span></div>
  </div>
  </td>
  </tr>
  </table>
  </div>
  </div>
  </div>
  <!-- ===== نموذج 23: محضر إثبات واقعة (سلوك غير تربوي) ===== -->
  <div`;

    case 'mashajara':
      return `<div class="page-container">${H}
<div class="confidential-mark">(سري)</div>
<div class="form-title">محضر إثبات واقعة (سلوك غير تربوي)</div>
<div class="form-body">
  <div class="section-block" style="text-align:justify;line-height:1.8;">
    في يوم (<span class="data-field with-dots" style="min-width:40px;" id="mashajara_day"></span>) الموافق (<span class="data-field with-dots indic-num" style="min-width:60px;" id="mashajara_date"></span> هـ)، وعند الساعة (<span class="data-field with-dots" style="min-width:40px;" id="mashajara_time"></span>)، جرى تحرير هذا المحضر لإثبات واقعة مشاجرة بدنية حدثت في (<span class="data-field with-dots" style="min-width:80px;" id="mashajara_location"></span>) بين كلٍّ من:
  </div>
  <div id="mashajara_students_list"></div>
  <div class="section-block align-right" style="line-height:1.8;">
    وبحسب ما تم رصده وملاحظته، فقد بادر الطالب (<span class="data-field with-dots" style="min-width:60px;" id="mashajara_initiator"></span>) إلى القيام بالتالي:
  </div>
  <div class="section-block align-right" style="line-height:1.8;">
    <span class="data-field with-dots align-right" style="min-width:100px;" id="mashajara_desc"></span>، في سلوك يخالف الضوابط التربوية والتعليمية المعتمدة، مما أدى إلى نشوب مشاجرة بين <span id="mashajara_parties_word">الطرفين</span>.
  </div>
  <div class="section-block align-right" style="line-height:1.8;">وقد نتج عن هذه الواقعة ما يلي:</div>
  <div class="section-block align-right" style="line-height:1.8;">
    <strong>أولاً: الأضرار الجسدية</strong>
    <span class="data-field with-dots" style="width:100%;display:block;text-align:right;" id="mashajara_physical"></span>
  </div>
  <div class="section-block align-right" style="line-height:1.8;">
    <strong>ثانياً: الأضرار المادية</strong>
    <span class="data-field with-dots" style="width:100%;display:block;text-align:right;" id="mashajara_material"></span>
  </div>
  <div class="section-block" style="text-align:justify;line-height:1.8;margin-top:10px;">
    وعليه تم تدوين هذا المحضر لإثبات ما حدث، واستكمال الإجراءات النظامية وفق اللوائح والتعليمات المعتمدة.
  </div>
  <div class="section-block align-right" style="margin-top:20px;">اسم مُحرِّر المحضر: <span class="data-field with-dots" style="min-width:60px;" id="mashajara_author"></span> الصفة: <span class="data-field with-dots" style="min-width:60px;" id="mashajara_author_role"></span> التوقيع: <span class="with-dots" style="min-width:60px;"></span> التاريخ: <span class="data-field with-dots indic-num" style="min-width:60px;" id="mashajara_author_date"></span></div>
</div></div>`;

    default:
      return `<div class="page-container"><div class="form-title">نموذج غير معروف: ${escapeHtml(formId)}</div></div>`;
  }
}

// ===== تعبئة البيانات في المستند =====
function fillFormData(doc: Document, formId: FormId, data: PrintFormData): void {
  switch (formId) {
    case 'ishar_wali_amr':
      fillField(doc, 'studentName', data.studentName);
      fillField(doc, 'studentName_2', data.studentName);
      fillField(doc, 'grade', data.grade, true);
      fillField(doc, 'violationDay', data.violationDay);
      fillField(doc, 'violationDate', data.violationDate, true);
      fillField(doc, 'violationDegree', data.violationDegree, true);
      fillField(doc, 'violationText', '\u25CF ' + (data.violationText || ''));
      fillField(doc, 'managerName', data.managerName);
      if (data.procedures) {
        for (let i = 0; i < Math.min(data.procedures.length, 3); i++) {
          fillField(doc, 'proc_' + (i + 1), data.procedures[i]);
        }
      }
      break;

    case 'tahood_slooki':
      fillField(doc, 'tahood_studentName', data.studentName);
      fillField(doc, 'tahood_grade', data.grade, true);
      fillField(doc, 'tahood_day', data.violationDay);
      fillField(doc, 'tahood_date', data.violationDate, true);
      fillField(doc, 'tahood_degree', data.violationDegree, true);
      fillField(doc, 'tahood_text', '\u25CF ' + (data.violationText || ''));
      break;

    case 'dawat_wali_amr':
      fillField(doc, 'dawat_studentName', data.studentName);
      fillField(doc, 'dawat_grade', data.grade, true);
      fillField(doc, 'dawat_deputyName', data.deputyName);
      if (data.visitDay) fillField(doc, 'dawat_day', data.visitDay);
      if (data.visitDate) fillField(doc, 'dawat_date', data.visitDate, true);
      if (data.visitTime) fillField(doc, 'dawat_time', data.visitTime);
      if (data.visitMeeting) fillField(doc, 'dawat_meeting', data.visitMeeting);
      fillField(doc, 'dawat_visitReason', '\u25CF ' + (data.visitReason || 'لمناقشة المستوى السلوكي للطالب.'));
      break;

    case 'mahdar_dab_wakea':
      fillField(doc, 'mahdar_studentName', data.studentName);
      fillField(doc, 'mahdar_grade', data.grade, true);
      fillField(doc, 'mahdar_day', data.violationDay);
      fillField(doc, 'mahdar_date', data.violationDate, true);
      fillField(doc, 'mahdar_problem', '\u25CF ' + (data.violationText || ''));
      if (data.mahdarLocation) fillField(doc, 'mahdar_location', data.mahdarLocation);
      // ★ المشاهدات / المضبوطات — تفعيل ✓ بدل □
      if (data.mahdarObservations) {
        const obsLabels = ['إفادة شاهد', 'صور / فيديو', 'أدوات مضبوطة', 'تقرير طبي', 'أخرى'];
        data.mahdarObservations.forEach((obs) => {
          const idx = obsLabels.indexOf(obs);
          if (idx >= 0 && idx < 5) {
            const chk = doc.getElementById('mahdar_obs_' + idx);
            if (chk) chk.textContent = '\u2713';
          } else {
            // نوع غير معروف = "أخرى"
            const chk4 = doc.getElementById('mahdar_obs_4');
            if (chk4) chk4.textContent = '\u2713';
            fillField(doc, 'mahdar_obs_other_text', obs);
          }
        });
      }
      // ★ شهود الواقعة — ديناميكي
      if (data.mahdarWitnesses && data.mahdarWitnesses.length > 0) {
        const wtb = doc.getElementById('mahdar_witnesses_body');
        if (wtb) {
          wtb.innerHTML = '';
          data.mahdarWitnesses.forEach((w, i) => {
            const tr = doc.createElement('tr');
            tr.innerHTML = `<td class="indic-num">${toIndic(i + 1)}</td>`
              + `<td style="text-align:right;padding-right:5px;font-weight:bold;">${escapeHtml(w.name)}</td>`
              + `<td>${escapeHtml(w.role || '')}</td><td></td>`;
            wtb.appendChild(tr);
          });
        }
      }
      break;

    case 'mahdar_lajnah':
      fillField(doc, 'lajnah_studentName', data.studentName);
      fillField(doc, 'lajnah_grade', data.grade, true);
      fillField(doc, 'lajnah_day', data.violationDay);
      fillField(doc, 'lajnah_date', data.violationDate, true);
      fillField(doc, 'lajnah_degree', data.violationDegree, true);
      fillField(doc, 'lajnah_desc', '\u25CF ' + (data.violationText || ''));
      fillCommitteeMembers(doc, 'lajnah_members_table', data.committeeMembers);
      if (data.lajnahPrevProcedures) {
        const lines = data.lajnahPrevProcedures.split('\n').filter(l => l.trim());
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
          fillField(doc, 'lajnah_prev_' + (i + 1), lines[i].replace(/^[\u0660-\u0669\d]+[.)\-]\s*/, ''));
        }
      }
      if (data.lajnahRecommendations) {
        const lines = data.lajnahRecommendations.split('\n').filter(l => l.trim());
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
          fillField(doc, 'lajnah_rec_' + (i + 1), lines[i].replace(/^[\u0660-\u0669\d]+[.)\-]\s*/, ''));
        }
      }
      break;

    case 'mahdar_lajnah_absence':
      fillField(doc, 'lajnah_abs_studentName', data.studentName);
      fillField(doc, 'lajnah_abs_grade', data.grade, true);
      fillField(doc, 'lajnah_abs_day', data.violationDay);
      fillField(doc, 'lajnah_abs_date', data.violationDate, true);
      fillField(doc, 'lajnah_abs_unexcused', data.unexcusedDays, true);
      fillField(doc, 'lajnah_abs_excused', data.excusedDays, true);
      fillCommitteeMembers(doc, 'lajnah_abs_members_table', data.committeeMembers);
      if (data.lajnahPrevProcedures) {
        const lines = data.lajnahPrevProcedures.split('\n').filter(l => l.trim());
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
          fillField(doc, 'lajnah_abs_prev_' + (i + 1), lines[i].replace(/^[\u0660-\u0669\d]+[.)\-]\s*/, ''));
        }
      }
      if (data.lajnahRecommendations) {
        const lines = data.lajnahRecommendations.split('\n').filter(l => l.trim());
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
          fillField(doc, 'lajnah_abs_rec_' + (i + 1), lines[i].replace(/^[\u0660-\u0669\d]+[.)\-]\s*/, ''));
        }
      }
      break;

    case 'ehalat_talib':
      fillField(doc, 'ehala_studentName', data.studentName);
      fillField(doc, 'ehala_grade', data.grade, true);
      fillField(doc, 'ehala_text', '\u25CF ' + (data.violationText || ''));
      fillField(doc, 'ehala_date', data.violationDate || new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura'), true);
      fillField(doc, 'ehala_degree', data.violationDegree, true);
      if (data.deputyName) fillField(doc, 'ehala_deputyName', data.deputyName);
      if (data.counselorName) fillField(doc, 'ehala_counselorName', data.counselorName);
      break;

    case 'group_ehala': {
      const d = new Date();
      const dn = d.toLocaleDateString('ar-SA', { weekday: 'long' });
      const ds = data.violationDate || d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura');
      fillField(doc, 'ge_date', dn + ' ' + ds, true);
      if (data.deputyName) fillField(doc, 'ge_deputy', data.deputyName);
      if (data.studentsList && data.studentsList.length > 0) {
        const tbody = doc.getElementById('ge_table_body');
        if (tbody) {
          tbody.innerHTML = '';
          data.studentsList.forEach((s, i) => {
            const tr = doc.createElement('tr');
            tr.innerHTML = `<td class="indic-num">${toIndic(i + 1)}</td>`
              + `<td style="text-align:right;padding-right:5px;font-weight:bold;">${escapeHtml(shortenName(s.name))}</td>`
              + `<td>${escapeHtml(s.grade || '')}</td>`
              + `<td class="indic-num">${toIndic(s.unexcused || 0)}</td>`
              + `<td class="indic-num">${toIndic(s.excused || 0)}</td>`
              + `<td></td>`;
            tbody.appendChild(tr);
          });
        }
      }
      break;
    }

    case 'rasd_slooki':
      fillField(doc, 'rasd_s_studentName', data.studentName);
      fillField(doc, 'rasd_s_grade', data.grade, true);
      fillField(doc, 'rasd_s_class', data.class, true);
      if (data.deputyName) fillField(doc, 'rs_deputy', data.deputyName);
      if (data.violationsList && data.violationsList.length > 0) {
        const tbody = doc.getElementById('rs_table_body');
        if (tbody) {
          tbody.innerHTML = '';
          data.violationsList.forEach((v, i) => {
            const tr = doc.createElement('tr');
            tr.innerHTML = `<td class="indic-num">${toIndic(i + 1)}</td>`
              + `<td style="text-align:right;padding-right:5px;">${escapeHtml(v.description)}</td>`
              + `<td class="indic-num">${toIndic(v.degree)}</td>`
              + `<td class="indic-num">${toIndic(v.date)}</td>`
              + `<td style="text-align:right;padding-right:5px;">${escapeHtml(v.procedures)}</td>`;
            tbody.appendChild(tr);
          });
        }
      }
      break;

    case 'tawid_darajat':
      fillField(doc, 'tawid_studentName', data.studentName);
      fillField(doc, 'tawid_grade', data.grade, true);
      fillField(doc, 'tawid_class', data.class, true);
      if (data.violationInfo) {
        fillField(doc, 'tawid_v_name', data.violationInfo.name);
        fillField(doc, 'tawid_v_degree', data.violationInfo.degree, true);
        fillField(doc, 'tawid_v_date', data.violationInfo.date, true);
        fillField(doc, 'tawid_v_points', data.violationInfo.points, true);
      }
      if (data.counselorName) fillField(doc, 'tawid_guide', data.counselorName);
      if (data.deputyName) fillField(doc, 'tawid_deputy', data.deputyName);
      break;

    case 'rasd_tamayuz':
      fillField(doc, 'rasd_studentName', data.studentName);
      fillField(doc, 'rasd_grade', data.grade, true);
      break;

    case 'ghiab_bidon_ozr':
      fillField(doc, 'ghiab_no_studentName', data.studentName);
      fillField(doc, 'ghiab_no_grade', data.grade, true);
      if (data.deputyName) fillField(doc, 'ghiab_no_deputy', data.deputyName);
      break;

    case 'ghiab_ozr':
      fillField(doc, 'ghiab_ozr_studentName', data.studentName);
      fillField(doc, 'ghiab_ozr_grade', data.grade, true);
      if (data.deputyName) fillField(doc, 'ghiab_ozr_deputy', data.deputyName);
      break;

    case 'tahood_hodoor':
      fillField(doc, 'tahood_h_studentName', data.studentName);
      fillField(doc, 'tahood_h_grade', data.grade, true);
      fillField(doc, 'tahood_h_unexcused', data.unexcusedDays, true);
      fillField(doc, 'tahood_h_excused', data.excusedDays, true);
      fillField(doc, 'tahood_h_sig_student', data.studentName);
      break;

    case 'group_tahood': {
      const d = new Date();
      const dn = d.toLocaleDateString('ar-SA', { weekday: 'long' });
      const ds = data.violationDate || d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura');
      fillField(doc, 'gt_date', dn + ' ' + ds, true);
      if (data.deputyName) fillField(doc, 'gt_deputy', data.deputyName);
      if (data.studentsList && data.studentsList.length > 0) {
        const tbody = doc.getElementById('gt_table_body');
        if (tbody) {
          tbody.innerHTML = '';
          data.studentsList.forEach((s, i) => {
            const tr = doc.createElement('tr');
            tr.innerHTML = `<td class="indic-num">${toIndic(i + 1)}</td>`
              + `<td style="text-align:right;padding-right:5px;font-weight:bold;">${escapeHtml(shortenName(s.name))}</td>`
              + `<td>${escapeHtml(s.grade || '')}</td>`
              + `<td class="indic-num">${toIndic(s.unexcused || 0)}</td>`
              + `<td class="indic-num">${toIndic(s.excused || 0)}</td>`
              + `<td></td><td></td>`;
            tbody.appendChild(tr);
          });
        }
      }
      break;
    }

    case 'iltizam_madrasi':
      fillField(doc, 'iltizam_name', data.studentName);
      fillField(doc, 'iltizam_grade', data.grade, true);
      fillField(doc, 'iltizam_date', data.violationDate, true);
      fillField(doc, 'iltizam_student_sign', data.studentName);
      break;

    case 'rasd_moalem':
      if (data.subject) fillField(doc, 'rasd_m_subject', data.subject);
      if (data.grade) fillField(doc, 'rasd_m_grade', data.grade, true);
      if (data.teacherName) fillField(doc, 'rasd_m_teacher', data.teacherName);
      if (data.violations && data.violations.length > 0) {
        const tbody = doc.getElementById('rasd_m_tbody');
        if (tbody) {
          tbody.innerHTML = '';
          const maxRows = Math.max(data.violations.length, 8);
          for (let i = 0; i < maxRows; i++) {
            const tr = doc.createElement('tr');
            if (i < data.violations.length) {
              const v = data.violations[i];
              tr.innerHTML = `<td class="indic-num">${toIndic(i + 1)}</td>`
                + `<td style="text-align:right;padding-right:5px;font-weight:bold;">${escapeHtml(v.studentName || '')}</td>`
                + `<td style="text-align:right;padding-right:5px;">${escapeHtml(v.violation || '')}</td>`
                + `<td style="text-align:right;padding-right:5px;">${escapeHtml(v.action || '')}</td>`
                + `<td class="indic-num">${toIndic(v.date || '')}</td>`
                + `<td></td>`;
            } else {
              tr.innerHTML = `<td class="indic-num">${toIndic(i + 1)}</td><td></td><td></td><td></td><td></td><td></td>`;
            }
            tbody.appendChild(tr);
          }
        }
      }
      break;

    case 'high_risk':
      fillField(doc, 'risk_studentName', data.studentName);
      fillField(doc, 'risk_grade', data.grade, true);
      // ★ نوع الخطر — تفعيل ✓
      if (data.riskTypes) {
        const riskLabels = ['حيازة سلاح', 'مخدرات', 'تهديد بالعنف', 'مضاربة جماعية', 'تحرش'];
        data.riskTypes.forEach((rt) => {
          const idx = riskLabels.indexOf(rt);
          if (idx >= 0) {
            const chk = doc.getElementById('risk_chk_' + idx);
            if (chk) chk.textContent = '\u2713';
          } else {
            const chk5 = doc.getElementById('risk_chk_5');
            if (chk5) chk5.textContent = '\u2713';
            fillField(doc, 'risk_other_text', rt);
          }
        });
      }
      // ★ وصف الحالة
      if (data.riskDesc) fillField(doc, 'risk_desc', data.riskDesc);
      // ★ راصد الحالة
      if (data.riskObserver) fillField(doc, 'risk_observer', data.riskObserver);
      // ★ تاريخ ووقت الرصد
      if (data.riskDate) fillField(doc, 'risk_date', data.riskDate, true);
      if (data.riskTime) fillField(doc, 'risk_time', data.riskTime);
      // ★ اسم المدير
      if (data.managerName) {
        fillField(doc, 'risk_manager', data.managerName);
        fillField(doc, 'risk_manager_date', data.riskDate || '', true);
      }
      break;

    case 'eblagh_etha':
      fillField(doc, 'eblagh_victim_name', data.studentName);
      fillField(doc, 'eblagh_grade', data.grade, true);
      fillField(doc, 'eblagh_date', data.violationDate || new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura'), true);
      if (data.eblaghReporter) fillField(doc, 'eblagh_reporter', data.eblaghReporter);
      if (data.eblaghRole) fillField(doc, 'eblagh_role', data.eblaghRole);
      if (data.eblaghSummary) fillField(doc, 'eblagh_summary', data.eblaghSummary);
      if (data.eblaghProcedures) {
        for (let i = 0; i < Math.min(data.eblaghProcedures.length, 3); i++) {
          fillField(doc, 'eblagh_proc_' + (i + 1), data.eblaghProcedures[i]);
        }
      }
      if (data.counselorName) fillField(doc, 'eblagh_counselor', data.counselorName);
      if (data.managerName) fillField(doc, 'eblagh_manager', data.managerName);
      break;

    case 'khota_tadeel':
      fillField(doc, 'khota_studentName', data.studentName);
      fillField(doc, 'khota_grade', data.grade, true);
      fillField(doc, 'khota_class', data.class, true);
      if (data.khotaDob) fillField(doc, 'khota_dob', data.khotaDob, true);
      if (data.khotaAge) fillField(doc, 'khota_age', data.khotaAge, true);
      if (data.khotaStart) fillField(doc, 'khota_start', data.khotaStart, true);
      if (data.khotaEnd) fillField(doc, 'khota_end', data.khotaEnd, true);
      if (data.khotaProblem) fillField(doc, 'khota_problem', data.khotaProblem);
      if (data.khotaDegree) fillField(doc, 'khota_degree', data.khotaDegree, true);
      if (data.khotaDesc) fillField(doc, 'khota_desc', data.khotaDesc);
      if (data.khotaManifestations) {
        for (let i = 0; i < Math.min(data.khotaManifestations.length, 2); i++) {
          fillField(doc, 'khota_m' + (i + 1), data.khotaManifestations[i]);
        }
      }
      break;

    case 'ehalat_absence':
      fillField(doc, 'ehala_abs_studentName', data.studentName);
      fillField(doc, 'ehala_abs_grade', data.grade, true);
      fillField(doc, 'ehala_abs_unexcused', data.unexcusedDays, true);
      fillField(doc, 'ehala_abs_excused', data.excusedDays, true);
      break;

    case 'tawtheeq_tawasol':
      fillField(doc, 'tawtheeq_studentName', data.studentName);
      fillField(doc, 'tawtheeq_grade', data.grade, true);
      fillField(doc, 'tawtheeq_day', data.contactDay || data.violationDay);
      fillField(doc, 'tawtheeq_date', data.contactDate || data.violationDate, true);
      fillField(doc, 'tawtheeq_contactType', data.contactType);
      fillField(doc, 'tawtheeq_contactReason', data.contactReason);
      fillField(doc, 'tawtheeq_contactResult', data.contactResult || 'تم التواصل بنجاح');
      fillField(doc, 'tawtheeq_notes', data.contactNotes || data.notes || '');
      break;

    case 'mashajara':
      fillField(doc, 'mashajara_day', data.day);
      fillField(doc, 'mashajara_date', data.date, true);
      fillField(doc, 'mashajara_time', data.time, true);
      fillField(doc, 'mashajara_location', data.location);
      fillField(doc, 'mashajara_initiator', data.initiator);
      fillField(doc, 'mashajara_desc', data.description);
      // ★ الأضرار الجسدية (مصفوفة أو نص)
      if (Array.isArray(data.physicalDamage) && data.physicalDamage.length > 0) {
        const el = doc.getElementById('mashajara_physical');
        if (el) el.innerHTML = data.physicalDamage.map((d, i) => toIndic(i + 1) + '- ' + escapeHtml(d)).join('<br>');
      } else if (data.physicalDamage) {
        fillField(doc, 'mashajara_physical', data.physicalDamage as string);
      }
      // ★ الأضرار المادية (مصفوفة أو نص)
      if (Array.isArray(data.materialDamage) && data.materialDamage.length > 0) {
        const el = doc.getElementById('mashajara_material');
        if (el) el.innerHTML = data.materialDamage.map((d, i) => toIndic(i + 1) + '- ' + escapeHtml(d)).join('<br>');
      } else if (data.materialDamage) {
        fillField(doc, 'mashajara_material', data.materialDamage as string);
      }
      // ★ محرر/محررو المحضر (دعم متعدد) — مطابق للأصلي
      if (data.authors && data.authors.length > 0) {
        fillField(doc, 'mashajara_author', data.authors[0].name);
        fillField(doc, 'mashajara_author_role', data.authors[0].role);
        fillField(doc, 'mashajara_author_date', data.date, true);
        // إذا أكثر من محرر، إضافة بقية المحررين
        if (data.authors.length > 1) {
          const authEl = doc.getElementById('mashajara_author');
          const authContainer = authEl?.parentElement;
          if (authContainer) {
            for (let ai = 1; ai < data.authors.length; ai++) {
              const authDiv = doc.createElement('div');
              authDiv.className = 'section-block align-right';
              authDiv.style.marginTop = '5px';
              authDiv.innerHTML = 'اسم مُحرِّر المحضر: <span class="data-field with-dots" style="min-width:60px;">' + escapeHtml(data.authors[ai].name) + '</span> الصفة: <span class="data-field with-dots" style="min-width:60px;">' + escapeHtml(data.authors[ai].role || '') + '</span> التوقيع: <span class="with-dots" style="min-width:60px;"></span>';
              authContainer.parentNode?.insertBefore(authDiv, authContainer.nextSibling);
            }
          }
        }
      } else {
        fillField(doc, 'mashajara_author', data.authorName || '');
        fillField(doc, 'mashajara_author_role', data.authorRole || '');
        fillField(doc, 'mashajara_author_date', data.date, true);
      }
      // ★ قائمة الطلاب ديناميكياً (حتى 12 طالب) مع أعمدة حسب العدد — مطابق للأصلي
      {
        const sc = doc.getElementById('mashajara_students_list');
        if (sc && data.students && data.students.length > 0) {
          const cnt = data.students.length;
          const cols = cnt <= 3 ? 1 : (cnt <= 6 ? 2 : 3);
          const minN = cols === 1 ? '60px' : (cols === 2 ? '40px' : '30px');
          const minG = cols === 1 ? '40px' : (cols === 2 ? '25px' : '20px');
          const fs = cols === 3 ? 'font-size:12pt;' : '';
          let html = '<div style="display:flex;flex-wrap:wrap;gap:0;">';
          data.students.forEach((s) => {
            const w = cols === 1 ? '100%' : (cols === 2 ? '50%' : '33.33%');
            html += '<div style="width:' + w + ';box-sizing:border-box;padding:2px 5px 2px 0;' + fs + '">';
            html += 'الطالب: <span class="data-field with-dots" style="min-width:' + minN + ';">' + escapeHtml(s.name || '') + '</span> ';
            html += 'الصف: <span class="data-field with-dots" style="min-width:' + minG + ';">' + toIndic(escapeHtml(s.grade || '')) + '</span>';
            html += '</div>';
          });
          html += '</div>';
          sc.innerHTML = html;
          // الطرفين أو الأطراف حسب العدد
          const pw = doc.getElementById('mashajara_parties_word');
          if (pw) pw.innerText = cnt > 2 ? 'الأطراف' : 'الطرفين';
        }
      }
      break;
  }
}

// ===== جعل الحقول قابلة للتعديل + شريط الطباعة — مطابق للأصلي =====
function makeEditable(doc: Document): void {
  // ضبط حجم الخط أولاً
  adjustAllFields(doc);

  // جعل حقول البيانات قابلة للتعديل
  doc.querySelectorAll('.data-field').forEach((el) => {
    (el as HTMLElement).setAttribute('contenteditable', 'true');
    (el as HTMLElement).style.cursor = 'text';
    (el as HTMLElement).style.outline = 'none';
  });

  // ★ إضافة شريط تحكم للطباعة — مطابق للأصلي
  const bar = doc.createElement('div');
  bar.id = 'edit-toolbar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:Tajawal,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3);direction:rtl';
  bar.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px;font-weight:700">✏️ يمكنك النقر على أي حقل لتعديله قبل الطباعة</span></div>'
    + '<button onclick="document.getElementById(\'edit-toolbar\').style.display=\'none\';window.print()" style="padding:8px 24px;background:white;color:#4f46e5;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">🖨️ طباعة</button>';
  doc.body.insertBefore(bar, doc.body.firstChild);

  // إخفاء الشريط عند الطباعة
  const style = doc.createElement('style');
  style.textContent = '@media print { #edit-toolbar { display:none !important; } }';
  doc.head.appendChild(style);
}

// ===== الدالة الرئيسية: طباعة نموذج =====
export function printForm(formId: FormId, data: PrintFormData, settings: SchoolSettings): void {
  const templateHtml = getTemplateHtml(formId);
  const letterheadHtml = buildLetterheadHtml(settings);
  const css = getFormTemplateCSS();

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">`
    + `<title>${escapeHtml(FORM_NAMES[formId] || formId)}</title>`
    + `<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Traditional+Arabic&display=swap" rel="stylesheet">`
    + `<style>${css}</style></head><body>${templateHtml}</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();

  // تطبيق الكليشة على كل header-container
  win.document.querySelectorAll('.header-container').forEach((hc) => {
    if (settings.letterheadMode === 'text' || settings.letterheadMode === 'Text') {
      (hc as HTMLElement).style.border = 'none';
      (hc as HTMLElement).style.margin = '0';
      (hc as HTMLElement).style.padding = '0';
    }
    hc.innerHTML = letterheadHtml;
  });

  // تعبئة البيانات
  fillFormData(win.document, formId, data);

  // ضبط الخط + جعل الحقول قابلة للتعديل (بعد تأخير لضمان التحميل)
  setTimeout(() => {
    makeEditable(win.document);
  }, 300);
}
