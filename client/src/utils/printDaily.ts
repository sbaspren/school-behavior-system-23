// ===== طباعة الكشوف اليومية (6 أنواع) =====
import {
  toIndic, escapeHtml, formatClass, openPrintWindow,
  buildLetterheadHtml, getSharedPrintCSS, getTodayDates, extractTime, sortByClass,
} from './printUtils';

interface SchoolSettings {
  letterheadMode: string;
  letterheadImageUrl?: string;
  schoolName?: string;
  eduAdmin?: string;
  eduDept?: string;
}

// ===== تكوين كل نوع كشف =====

interface DailyConfig {
  titlePrefix: string;
  totalLabel: string;
  nameField: string;
  gradeField: string;
  classField: string;
  colCount: number;
  headers: string;
  buildRow: (rec: Record<string, unknown>, i: number, g: { grade: string; cls: string }, stage?: string) => string;
}

function getField(rec: Record<string, unknown>, name: string): string {
  if (rec[name] !== undefined && rec[name] !== null) return String(rec[name]);
  const alt = name.replace(/ /g, '_');
  if (rec[alt] !== undefined && rec[alt] !== null) return String(rec[alt]);
  return '';
}

const DAILY_CONFIGS: Record<string, DailyConfig> = {
  violations: {
    titlePrefix: 'سجل المخالفات السلوكية ليوم ',
    totalLabel: 'مخالفة',
    nameField: 'studentName',
    gradeField: 'grade',
    classField: 'className',
    colCount: 7,
    headers:
      '<th class="col-header" style="width:5%">م</th>'
      + '<th class="col-header" style="width:28%">اسم الطالب</th>'
      + '<th class="col-header" style="width:10%">الصف</th>'
      + '<th class="col-header" style="width:25%">المخالفة</th>'
      + '<th class="col-header" style="width:5%">د</th>'
      + '<th class="col-header" style="width:20%">الإجراءات</th>'
      + '<th class="col-header" style="width:7%">التواصل</th>',
    buildRow: (rec, i, g) => {
      const isSent = rec.isSent === true;
      return `<td class="data-cell">${toIndic(i + 1)}</td>`
        + `<td class="name-cell">${escapeHtml(getField(rec, 'studentName') || '-')}</td>`
        + `<td class="data-cell">${formatClass(g.grade, g.cls)}</td>`
        + `<td class="detail-cell">${escapeHtml(getField(rec, 'description') || '-')}</td>`
        + `<td class="data-cell">${toIndic(getField(rec, 'degree') || '-')}</td>`
        + `<td class="detail-cell">${escapeHtml(getField(rec, 'procedures') || '-')}</td>`
        + `<td class="data-cell" style="color:${isSent ? 'green' : '#999'};font-weight:bold">${isSent ? 'تم' : '-'}</td>`;
    },
  },

  absence: {
    titlePrefix: 'كشف الغياب اليومي ليوم ',
    totalLabel: 'طالب',
    nameField: 'studentName',
    gradeField: 'grade',
    classField: 'className',
    colCount: 6,
    headers:
      '<th class="col-header" style="width:5%">م</th>'
      + '<th class="col-header" style="width:28%">اسم الطالب</th>'
      + '<th class="col-header" style="width:10%">الصف</th>'
      + '<th class="col-header" style="width:15%">المسجّل</th>'
      + '<th class="col-header" style="width:15%">العذر</th>'
      + '<th class="col-header" style="width:7%">التواصل</th>',
    buildRow: (rec, i, g) => {
      let teacher = getField(rec, 'recordedBy') || '-';
      if (teacher === '-' || teacher === 'مدير_النظام' || teacher === 'يدوي') teacher = 'الوكيل';
      const isSent = rec.isSent === true;
      return `<td class="data-cell">${toIndic(i + 1)}</td>`
        + `<td class="name-cell">${escapeHtml(getField(rec, 'studentName') || '-')}</td>`
        + `<td class="data-cell">${formatClass(g.grade, g.cls)}</td>`
        + `<td class="data-cell">${escapeHtml(teacher)}</td>`
        + `<td class="data-cell">${escapeHtml(getField(rec, 'excuseType') || '-')}</td>`
        + `<td class="data-cell" style="color:${isSent ? 'green' : '#999'};font-weight:bold">${isSent ? 'تم' : '-'}</td>`;
    },
  },

  tardiness: {
    titlePrefix: 'سجل المتأخرين ليوم ',
    totalLabel: 'متأخر',
    nameField: 'studentName',
    gradeField: 'grade',
    classField: 'className',
    colCount: 7,
    headers:
      '<th class="col-header" style="width:5%">م</th>'
      + '<th class="col-header" style="width:28%">اسم الطالب</th>'
      + '<th class="col-header" style="width:10%">الصف</th>'
      + '<th class="col-header" style="width:15%">نوع التأخر</th>'
      + '<th class="col-header" style="width:8%">الحصة</th>'
      + '<th class="col-header" style="width:12%">الوقت</th>'
      + '<th class="col-header" style="width:7%">التواصل</th>',
    buildRow: (rec, i, g) => {
      const isSent = rec.isSent === true;
      return `<td class="data-cell">${toIndic(i + 1)}</td>`
        + `<td class="name-cell">${escapeHtml(getField(rec, 'studentName') || '-')}</td>`
        + `<td class="data-cell">${formatClass(g.grade, g.cls)}</td>`
        + `<td class="data-cell">${escapeHtml(getField(rec, 'tardinessType') || 'صباحي')}</td>`
        + `<td class="data-cell">${toIndic(getField(rec, 'period') || '-')}</td>`
        + `<td class="data-cell">${toIndic(extractTime(getField(rec, 'recordedAt')))}</td>`
        + `<td class="data-cell" style="color:${isSent ? 'green' : '#999'};font-weight:bold">${isSent ? 'تم' : '-'}</td>`;
    },
  },

  permissions: {
    titlePrefix: 'سجل المستأذنين ليوم ',
    totalLabel: 'مستأذن',
    nameField: 'studentName',
    gradeField: 'grade',
    classField: 'className',
    colCount: 8,
    headers:
      '<th class="col-header" style="width:5%">م</th>'
      + '<th class="col-header" style="width:25%">اسم الطالب</th>'
      + '<th class="col-header" style="width:10%">الصف</th>'
      + '<th class="col-header" style="width:10%">وقت الخروج</th>'
      + '<th class="col-header" style="width:18%">السبب</th>'
      + '<th class="col-header" style="width:12%">المستلم</th>'
      + '<th class="col-header" style="width:10%">التأكيد</th>'
      + '<th class="col-header" style="width:7%">التواصل</th>',
    buildRow: (rec, i, g) => {
      const isSent = rec.isSent === true;
      const confirmTime = getField(rec, 'confirmTime');
      return `<td class="data-cell">${toIndic(i + 1)}</td>`
        + `<td class="name-cell">${escapeHtml(getField(rec, 'studentName') || '-')}</td>`
        + `<td class="data-cell">${formatClass(g.grade, g.cls)}</td>`
        + `<td class="data-cell">${toIndic(getField(rec, 'exitTime') || '-')}</td>`
        + `<td class="detail-cell">${escapeHtml(getField(rec, 'reason') || '-')}</td>`
        + `<td class="data-cell">${escapeHtml(getField(rec, 'receiver') || '-')}</td>`
        + `<td class="data-cell" style="font-size:11pt">${confirmTime ? 'خرج ' + toIndic(confirmTime) : 'معلق'}</td>`
        + `<td class="data-cell" style="color:${isSent ? 'green' : '#999'};font-weight:bold">${isSent ? 'تم' : '-'}</td>`;
    },
  },

  notes: {
    titlePrefix: 'سجل الملاحظات التربوية ليوم ',
    totalLabel: 'ملاحظة',
    nameField: 'studentName',
    gradeField: 'grade',
    classField: 'className',
    colCount: 7,
    headers:
      '<th class="col-header" style="width:5%">م</th>'
      + '<th class="col-header" style="width:25%">اسم الطالب</th>'
      + '<th class="col-header" style="width:10%">الصف</th>'
      + '<th class="col-header" style="width:12%">نوع الملاحظة</th>'
      + '<th class="col-header" style="width:25%">التفاصيل</th>'
      + '<th class="col-header" style="width:13%">المسجّل</th>'
      + '<th class="col-header" style="width:7%">التواصل</th>',
    buildRow: (rec, i, g) => {
      const isSent = rec.isSent === true;
      return `<td class="data-cell">${toIndic(i + 1)}</td>`
        + `<td class="name-cell">${escapeHtml(getField(rec, 'studentName') || '-')}</td>`
        + `<td class="data-cell">${formatClass(g.grade, g.cls)}</td>`
        + `<td class="data-cell">${escapeHtml(getField(rec, 'noteType') || '-')}</td>`
        + `<td class="detail-cell">${escapeHtml(getField(rec, 'details') || '-')}</td>`
        + `<td class="data-cell">${escapeHtml(getField(rec, 'teacherName') || getField(rec, 'recordedBy') || '-')}</td>`
        + `<td class="data-cell" style="color:${isSent ? 'green' : '#999'};font-weight:bold">${isSent ? 'تم' : '-'}</td>`;
    },
  },

  communication: {
    titlePrefix: 'سجل التواصل مع أولياء الأمور',
    totalLabel: 'رسالة',
    nameField: 'studentName',
    gradeField: 'grade',
    classField: 'className',
    colCount: 7,
    headers:
      '<th class="col-header" style="width:5%">م</th>'
      + '<th class="col-header" style="width:12%">التاريخ</th>'
      + '<th class="col-header" style="width:24%">اسم الطالب</th>'
      + '<th class="col-header" style="width:10%">الصف</th>'
      + '<th class="col-header" style="width:14%">الجوال</th>'
      + '<th class="col-header" style="width:18%">النوع</th>'
      + '<th class="col-header" style="width:7%">الحالة</th>',
    buildRow: (rec, i, g) => {
      const statusDone = String(rec.sendStatus || '').indexOf('sent') >= 0;
      return `<td class="data-cell">${toIndic(i + 1)}</td>`
        + `<td class="data-cell">${toIndic(getField(rec, 'hijriDate') || getField(rec, 'miladiDate') || '')}</td>`
        + `<td class="name-cell">${escapeHtml(getField(rec, 'studentName') || '-')}</td>`
        + `<td class="data-cell">${formatClass(g.grade, g.cls)}</td>`
        + `<td class="data-cell" style="direction:ltr;font-size:11pt">${escapeHtml(getField(rec, 'mobile') || '')}</td>`
        + `<td class="data-cell">${escapeHtml(getField(rec, 'messageType') || '')}</td>`
        + `<td class="data-cell" style="color:${statusDone ? 'green' : '#999'};font-weight:bold">${statusDone ? '\u2713' : '\u2717'}</td>`;
    },
  },
};

// ===== بناء صفحة الكشف اليومي =====
function buildDailyPage(opts: {
  title: string;
  subtitle?: string;
  dateText: string;
  colCount: number;
  headers: string;
  rows: string;
  total: string;
  letterheadHtml: string;
}): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">`
    + `<title>${opts.title}</title>`
    + `<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">`
    + `<style>${getSharedPrintCSS()}</style></head><body>`
    + `<table class="main-table"><thead>`
    + `<tr><td colspan="${opts.colCount}" class="header-cell">`
    + opts.letterheadHtml
    + `<div class="form-title">${opts.title}</div>`
    + (opts.subtitle ? `<div class="form-subtitle">${opts.subtitle}</div>` : '')
    + `<div class="form-date">${opts.dateText}</div>`
    + `</td></tr>`
    + `<tr>${opts.headers}</tr>`
    + `</thead>`
    + `<tbody>${opts.rows}</tbody></table>`
    + `<div class="footer-block"><div class="footer-flex">`
    + `<div>المجموع: ${opts.total}</div>`
    + `<div style="text-align:center"><strong>وكيل شؤون الطلاب</strong><br><span class="with-dots"></span></div>`
    + `</div></div>`
    + `</body></html>`;
}

// ===== الدالة الرئيسية =====
export type DailyReportType = 'violations' | 'absence' | 'tardiness' | 'permissions' | 'notes' | 'communication';

export function printDailyReport(
  type: DailyReportType,
  records: Record<string, unknown>[],
  settings: SchoolSettings,
  stage?: string,
): void {
  if (!records || records.length === 0) return;

  const config = DAILY_CONFIGS[type];
  if (!config) return;

  const STAGE_NAMES: Record<string, string> = {
    'متوسط': 'المرحلة المتوسطة',
    'ثانوي': 'المرحلة الثانوية',
    'ابتدائي': 'المرحلة الابتدائية',
    'طفولة مبكرة': 'مرحلة الطفولة المبكرة',
  };
  const stageName = stage ? (STAGE_NAMES[stage] || stage) : '';

  const { hijri, miladi, dayName } = getTodayDates();

  const sorted = sortByClass(
    records,
    config.nameField as keyof Record<string, unknown>,
    config.gradeField as keyof Record<string, unknown>,
    config.classField as keyof Record<string, unknown>,
  );

  let rows = '';
  let lastKey = '';
  sorted.forEach((rec, i) => {
    const grade = getField(rec, config.gradeField);
    const cls = getField(rec, config.classField);
    const key = `${grade}|${cls}`;
    if (key !== lastKey && i > 0) {
      rows += `<tr class="sep-row"><td colspan="${config.colCount}"></td></tr>`;
    }
    lastKey = key;
    rows += `<tr>${config.buildRow(rec, i, { grade, cls }, stage)}</tr>`;
  });

  let title = config.titlePrefix;
  if (type !== 'communication') title += dayName;

  let dateText: string;
  if (type === 'communication') {
    dateText = `${hijri} | عدد الرسائل: ${toIndic(records.length)}`;
  } else {
    dateText = `${hijri} \u00A0الموافق\u00A0 ${miladi} م`;
  }

  const html = buildDailyPage({
    title,
    subtitle: stageName,
    dateText,
    colCount: config.colCount,
    headers: config.headers,
    rows,
    total: `${toIndic(records.length)} ${config.totalLabel}`,
    letterheadHtml: buildLetterheadHtml(settings),
  });

  openPrintWindow(html);
}
