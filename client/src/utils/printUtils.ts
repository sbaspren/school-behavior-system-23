// ===== أدوات الطباعة المشتركة =====

/** تحويل الأرقام إلى أرقام عربية (هندية) */
export function toIndic(n: string | number): string {
  return String(n).replace(/[0-9]/g, (d) => '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'[parseInt(d)]);
}

/** حماية من XSS */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** اختصار الاسم: الأول + الثاني + الأخير */
export function shortenName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 3) return fullName;
  return `${parts[0]} ${parts[1]} ${parts[parts.length - 1]}`;
}

/** تنسيق الصف والفصل */
export function formatClass(grade: string, cls: string, stage?: string): string {
  const ORDINALS: Record<string, string> = {
    'الأول': '١', 'الثاني': '٢', 'الثالث': '٣',
    'الرابع': '٤', 'الخامس': '٥', 'السادس': '٦',
  };
  const g = ORDINALS[grade] || grade || '';
  const STAGE_ABBR: Record<string, string> = { 'متوسط': 'م', 'ثانوي': 'ث', 'ابتدائي': 'ب', 'طفولة مبكرة': 'ط' };
  const s = stage ? (STAGE_ABBR[stage] || '') : '';
  const classLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
  const cNum = parseInt(String(cls).replace(/[^0-9٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String('\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d))));
  const c = (cNum >= 1 && cNum <= classLetters.length) ? classLetters[cNum - 1] : cls;
  return `${g}/${s}${c}`;
}

/** فتح نافذة طباعة بمحتوى HTML */
export function openPrintWindow(html: string): Window | null {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.print(); }, 300);
  return win;
}

/** بناء HTML الكليشة (ترويسة المدرسة) */
export function buildLetterheadHtml(settings: {
  letterheadMode: string;
  letterheadImageUrl?: string;
  schoolName?: string;
  eduAdmin?: string;
  eduDept?: string;
}): string {
  if (settings.letterheadMode === 'Image' && settings.letterheadImageUrl) {
    return `<div style="text-align:center;margin-bottom:10px"><img src="${escapeHtml(settings.letterheadImageUrl)}" style="max-width:100%;max-height:150px" alt="ترويسة"></div>`;
  }
  const lines: string[] = [];
  if (settings.eduAdmin) lines.push(escapeHtml(settings.eduAdmin));
  if (settings.eduDept) lines.push(escapeHtml(settings.eduDept));
  if (settings.schoolName) lines.push(`<strong style="font-size:18pt">${escapeHtml(settings.schoolName)}</strong>`);
  if (lines.length === 0) return '';
  return `<div style="text-align:center;margin-bottom:10px;line-height:1.6;font-size:14pt">${lines.join('<br>')}</div>`;
}

/** CSS مشترك لصفحات الطباعة A4 */
export function getSharedPrintCSS(): string {
  return `@page{size:A4 portrait;margin:0}
body{margin:0;padding:10mm 12mm;font-family:'Traditional Arabic','Amiri',serif;font-size:16pt;line-height:1.2;direction:rtl;background:white;color:#000;box-sizing:border-box}
.main-table{width:100%;max-width:100%;margin:0 auto;border-collapse:collapse}
.main-table thead{display:table-header-group}
.main-table tfoot{display:table-footer-group}
.header-cell{border:none;padding:0}
.form-title{text-align:center;font-size:19pt;font-weight:bold;font-family:'Amiri',serif;color:#000;margin:5mm 0 3mm;line-height:1.4}
.form-subtitle{text-align:center;font-size:14pt;color:#444;margin-bottom:2mm}
.form-date{text-align:center;font-size:12pt;color:#666;margin-bottom:4mm}
.col-header{border:1px solid #000;padding:4px 5px;text-align:center;vertical-align:middle;background:#f2f2f2;font-weight:bold;font-size:13pt}
.data-cell{border:1px solid #000;padding:4px 5px;text-align:center;vertical-align:middle;font-size:13pt}
.name-cell{border:1px solid #000;padding:4px 8px 4px 5px;text-align:right;font-weight:bold;white-space:nowrap;font-size:13pt}
.detail-cell{border:1px solid #000;padding:4px 8px 4px 5px;text-align:right;font-size:12pt}
.sep-row td{background:#e0e0e0;height:3px;padding:0!important;border-left:none;border-right:none;border-top:1px solid #000;border-bottom:1px solid #000}
.footer-block{page-break-inside:avoid;padding:20px 0 0}
.footer-flex{display:flex;justify-content:space-between;font-weight:bold;font-size:14pt}
.with-dots{border-bottom:1px dotted #999;display:inline-block;min-width:150px;min-height:22px}
@media print{body{background:white;-webkit-print-color-adjust:exact}.main-table{page-break-inside:auto}.main-table tr{page-break-inside:avoid}}`;
}

/** CSS القوالب الرسمية (النماذج A4) */
export function getFormTemplateCSS(): string {
  return `@page{size:A4;margin:15mm 12mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Traditional Arabic','Amiri',serif;font-size:15pt;line-height:1.6;direction:rtl;color:#000;background:white}
.page-container{width:100%;max-width:190mm;margin:0 auto;padding:10mm;position:relative;page-break-after:always}
.header-container{text-align:center;margin-bottom:10px}
.header-logo{max-width:100%;max-height:120px}
.form-title{text-align:center;font-size:18pt;font-weight:bold;margin:10px 0 15px;line-height:1.4}
.form-body{padding:0 5mm}
.section-block{margin-bottom:12px;line-height:1.8;text-align:justify}
.align-right{text-align:right}
.sub-header{font-weight:bold;font-size:14pt;margin:15px 0 8px;text-decoration:underline}
.data-field{display:inline;font-weight:bold}
.data-field.with-dots{border-bottom:2px dotted #666;min-width:80px;display:inline-block;text-align:center;padding:0 5px}
.indic-num{direction:ltr;unicode-bidi:bidi-override}
.tracking-table{width:100%;border-collapse:collapse;margin:10px 0}
.tracking-table th,.tracking-table td{border:1.5px solid #333;padding:6px 8px;text-align:center;font-size:13pt}
.tracking-table th{background:#f0f0f0;font-weight:bold}
.footer-table{width:100%;border:none;margin-top:25px}
.footer-table td{border:none;padding:10px;vertical-align:top}
.signature-block{display:inline-block;text-align:right}
.confidential-mark{position:absolute;top:15mm;left:15mm;color:#c00;font-weight:bold;font-size:14pt;border:2px solid #c00;padding:3px 10px;border-radius:4px}
.internal-section{border-top:2px dashed #999;margin-top:25px;padding-top:15px}
.feedback-box{border:1.5px solid #333;min-height:100px;margin:10px 0;padding:8px}
.print-toolbar{position:fixed;top:0;left:0;right:0;background:#333;color:#fff;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Tahoma,sans-serif;font-size:12pt}
.print-toolbar button{background:#4CAF50;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:12pt;font-family:Tahoma}
.print-toolbar button:hover{background:#45a049}
@media print{.print-toolbar{display:none!important}.page-container{margin:0;padding:0}}`;
}

/** الحصول على التاريخ الهجري والميلادي واليوم */
export function getTodayDates(): { hijri: string; miladi: string; dayName: string } {
  const today = new Date();
  const hijri = today.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
  const miladi = today.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
  const dayName = today.toLocaleDateString('ar-SA', { weekday: 'long' });
  return { hijri, miladi, dayName };
}

/** استخراج الوقت من نص */
export function extractTime(val: string | undefined): string {
  if (!val) return '-';
  const match = String(val).match(/(\d{1,2}:\d{2})/);
  return match ? match[1] : '-';
}

// ====================================================================
// دوال منقولة من Config.gs — تنظيف واكتشاف الصفوف والمراحل
// ====================================================================

/** تنظيف اسم الصف — إزالة لواحق نور وتوحيد التسمية */
export function cleanGradeName(grade: string): string {
  if (!grade) return '';
  let s = String(grade).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  // حذف لواحق نور
  s = s.replace(/\s*(قسم عام|السنة المشتركة|نظام عام|المسار العام)/g, '').trim();
  // توحيد أسماء المراحل
  s = s.replace(/(^|\s)المتوسط(\s|$)/g, '$1متوسط$2');
  s = s.replace(/(^|\s)الثانوي(\s|$)/g, '$1ثانوي$2');
  s = s.replace(/(^|\s)الابتدائي(\s|$)/g, '$1ابتدائي$2');
  return s.replace(/\s+/g, ' ').trim();
}

/** اكتشاف المرحلة من اسم الصف */
export function detectStageFromGrade(grade: string): string {
  if (!grade) return '';
  if (grade.includes('ثانو')) return 'ثانوي';
  if (grade.includes('متوسط')) return 'متوسط';
  if (grade.includes('ابتدا')) return 'ابتدائي';
  if (grade.includes('طفولة') || grade.includes('روضة')) return 'طفولة مبكرة';
  return '';
}

/** تحويل الأرقام العربية (هندية) إلى غربية */
export function arabicToWesternNumerals(str: string): string {
  if (!str) return '';
  const map: Record<string, string> = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  let result = String(str);
  for (const k in map) result = result.split(k).join(map[k]);
  // إزالة "هـ" والمسافات الزائدة وحروف Unicode غير المرئية
  result = result.replace(/\s*هـ\s*/g, '').replace(/[\u200e\u200f\u200b\u200c\u200d\u2066\u2067\u2068\u2069\u061c]/g, '').trim();
  return result;
}

/** تطبيع النص العربي — إزالة الترقيم وتوحيد الحروف للمطابقة */
export function normalizeArabicForMatch(text: string): string {
  if (!text) return '';
  return text.trim()
    .replace(/[.،,؛:!؟\u200c\u200d]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/** الترتيب حسب الصف ثم الاسم */
export function sortByClass<T>(records: T[], nameField: keyof T, gradeField: keyof T, classField: keyof T): T[] {
  return [...records].sort((a, b) => {
    const ga = String(a[gradeField] || ''), gb = String(b[gradeField] || '');
    const ca = String(a[classField] || ''), cb = String(b[classField] || '');
    const na = String(a[nameField] || ''), nb = String(b[nameField] || '');
    return ga.localeCompare(gb, 'ar') || ca.localeCompare(cb, 'ar') || na.localeCompare(nb, 'ar');
  });
}
