# بروتوكول التحقق من نقل النظام 100%
# Migration Verification Protocol v1.0

> هذا البروتوكول يضمن نقل كل ملف ووظيفة وستايل من نظام GAS الأصلي إلى نظام React + ASP.NET الجديد

---

## المرحلة 1: التحقق من الملفات (File Coverage)

### 1.1 ملفات السيرفر (Server GS → API Controllers)

| # | ملف GAS الأصلي | Controller المقابل | الحالة | ملاحظات |
|---|---------------|-------------------|--------|---------|
| 1 | Server_Settings.gs | SettingsController.cs | | |
| 2 | Server_Users.gs | UsersController.cs | | |
| 3 | Server_Data.gs | StudentsController.cs + TeachersController.cs + SubjectsController.cs | | |
| 4 | Server_Actions.gs | ViolationsController.cs + PositiveBehaviorController.cs | | |
| 5 | Server_Absence.gs | AbsenceController.cs | | |
| 6 | Server_Absence_Daily.gs | AbsenceController.cs (daily endpoints) | | |
| 7 | Server_Attendance.gs | TardinessController.cs | | |
| 8 | Server_Communication.gs | CommunicationController.cs | | |
| 9 | Server_Dashboard.gs | DashboardController.cs | | |
| 10 | Server_EducationalNotes.gs | EducationalNotesController.cs | | |
| 11 | Server_ParentExcuse.gs | ParentExcuseController.cs | | |
| 12 | Server_Print.gs | (print handled client-side) | | |
| 13 | Server_SMS.gs | SmsController.cs | | |
| 14 | Server_StaffInput.gs | StaffInputController.cs | | |
| 15 | Server_TeacherInput.gs | TeacherInputController.cs | | |
| 16 | Server_Templates.gs | TemplatesController.cs | | |
| 17 | Server_WhatsApp.gs | WhatsAppController.cs | | |
| 18 | Server_Academic.gs | AcademicController.cs | | |
| 19 | Server_Extension.gs | ExtensionController.cs | | |
| 20 | Server noor.gs / NoorAPI.gs | NoorController.cs | | |
| 21 | AuditDatabase.gs | AuditLogController.cs | | |
| 22 | Config.gs | appsettings.json + Domain entities | | |
| 23 | Main.gs | AuthController.cs | | |
| 24 | SeedData.gs | EF Migrations / Seed | | |
| 25 | SyncToApp_UPDATED.gs | ExtensionController.cs | | |

### 1.2 ملفات العميل (HTML/JS → React Pages)

| # | ملف GAS الأصلي | صفحة React المقابلة | الحالة | ملاحظات |
|---|---------------|---------------------|--------|---------|
| 1 | index.html (Dashboard) | DashboardPage.tsx | | |
| 2 | JS_Violations.html | ViolationsPage.tsx | | |
| 3 | JS_PositiveBehavior.html | PositiveBehaviorPage.tsx | | |
| 4 | JS_Tardiness.html / JS_Attendance.html | TardinessPage.tsx | | |
| 5 | JS_Absence.html | AbsencePage.tsx | | |
| 6 | JS_Permissions.html | PermissionsPage.tsx | | |
| 7 | JS_EducationalNotes.html | EducationalNotesPage.tsx | | |
| 8 | JS_Communication.html | CommunicationPage.tsx | | |
| 9 | JS_WhatsApp.html | WhatsAppPage.tsx | | |
| 10 | JS_Settings.html | SettingsPage.tsx | | |
| 11 | JS_Noor.html | NoorPage.tsx | | |
| 12 | JS_Academic.html | AcademicPage.tsx | | |
| 13 | JS_Reports.html | ReportsPage.tsx | | |
| 14 | JS_Dashboard.html | DashboardPage.tsx | | |
| 15 | JS_History.html | AuditLogPage.tsx | | |
| 16 | JS_GeneralForms.html | GeneralFormsPage.tsx | | |
| 17 | JS_Print.html / JS_PrintShared.html | (inline print in each page) | | |
| 18 | JS_Compensation.html | (merged into ViolationsPage) | | |
| 19 | TeacherInputForm.html | TeacherFormPage.tsx | | |
| 20 | StaffInputForm.html | StaffFormPage.tsx | | |
| 21 | GuardDisplay.html | GuardDisplayPage.tsx | | |
| 22 | WakeelForm.html | WakeelFormPage.tsx | | |
| 23 | CounselorForm.html | CounselorFormPage.tsx | | |
| 24 | AdminTardinessForm.html | AdminTardinessPage.tsx | | |
| 25 | ParentExcuseForm.html | ParentExcusePage.tsx | | |
| 26 | CSS_Styles.html | App.css | | |
| 27 | PrintTemplates_Engine.html | utils/printUtils.ts | | |
| 28 | PrintTemplates_Forms.html | utils/printUtils.ts | | |
| 29 | JS_Core.html | api/*.ts + utils/*.ts | | |

---

## المرحلة 2: التحقق من الوظائف (Function-by-Function)

### طريقة التحقق:
لكل ملف GAS أصلي، استخرج كل `google.script.run` call وتأكد من وجود endpoint مقابل.

### 2.1 قائمة الوظائف الإلزامية

#### الإعدادات (Settings)
- [ ] `getSchoolSettings()` → GET /api/settings
- [ ] `saveSchoolSettings(data)` → PUT /api/settings
- [ ] `getStageConfig()` → GET /api/settings/stages
- [ ] `saveStageConfig(data)` → PUT /api/settings/stages
- [ ] `getUsers()` → GET /api/users
- [ ] `createUser(data)` → POST /api/users
- [ ] `updateUser(id, data)` → PUT /api/users/{id}
- [ ] `deleteUser(id)` → DELETE /api/users/{id}
- [ ] `getTokenLinks()` → GET /api/auth/links
- [ ] `generateTokenLink(role)` → POST /api/auth/links

#### المخالفات (Violations)
- [ ] `getViolations(filters)` → GET /api/violations
- [ ] `saveViolation(data)` → POST /api/violations
- [ ] `updateViolation(id, data)` → PUT /api/violations/{id}
- [ ] `deleteViolation(id)` → DELETE /api/violations/{id}
- [ ] `getViolationRules()` → GET /api/rules
- [ ] `saveBatchViolations(data)` → POST /api/violations/batch
- [ ] `getCompensationEligible()` → GET /api/violations/compensation-eligible

#### السلوك الإيجابي (Positive Behavior)
- [ ] `getPositiveBehaviors(filters)` → GET /api/positive-behavior
- [ ] `savePositiveBehavior(data)` → POST /api/positive-behavior
- [ ] `deletePositiveBehavior(id)` → DELETE /api/positive-behavior/{id}
- [ ] `compensateViolation(data)` → POST /api/positive-behavior/compensation

#### التأخر (Tardiness)
- [ ] `getTardinessRecords(filters)` → GET /api/tardiness
- [ ] `saveTardiness(data)` → POST /api/tardiness
- [ ] `deleteTardiness(id)` → DELETE /api/tardiness/{id}
- [ ] `getSentBatchTardiness()` → GET /api/tardiness/sent-batch

#### الغياب (Absence)
- [ ] `getAbsenceRecords(filters)` → GET /api/absence
- [ ] `saveAbsence(data)` → POST /api/absence
- [ ] `deleteAbsence(id)` → DELETE /api/absence/{id}
- [ ] `getDailyAbsence(date)` → GET /api/absence/daily
- [ ] `saveDailyAbsence(data)` → POST /api/absence/daily

#### الاستئذان (Permissions)
- [ ] `getPermissions(filters)` → GET /api/permissions
- [ ] `savePermission(data)` → POST /api/permissions
- [ ] `deletePermission(id)` → DELETE /api/permissions/{id}
- [ ] `getSentBatchPermissions()` → GET /api/permissions/sent-batch

#### الملاحظات التربوية (Educational Notes)
- [ ] `getEducationalNotes(filters)` → GET /api/educational-notes
- [ ] `saveEducationalNote(data)` → POST /api/educational-notes
- [ ] `deleteEducationalNote(id)` → DELETE /api/educational-notes/{id}
- [ ] `getSentBatchNotes()` → GET /api/educational-notes/sent-batch

#### لوحة التحكم (Dashboard)
- [ ] `getDashboardStats()` → GET /api/dashboard/stats
- [ ] `getDashboardCharts()` → GET /api/dashboard/charts

#### التواصل (Communication)
- [ ] `getCommunicationLog(filters)` → GET /api/communication
- [ ] `saveCommunicationRecord(data)` → POST /api/communication

#### الواتساب (WhatsApp)
- [ ] `getWhatsAppConfig()` → GET /api/whatsapp/config
- [ ] `saveWhatsAppConfig(data)` → PUT /api/whatsapp/config
- [ ] `sendWhatsAppMessage(data)` → POST /api/whatsapp/send
- [ ] `getWhatsAppLog()` → GET /api/whatsapp/log

#### نور (Noor)
- [ ] `getNoorStatus()` → GET /api/noor/status
- [ ] `processNoorFile(file)` → POST /api/noor/import
- [ ] `syncToNoor(data)` → POST /api/noor/sync

#### التحصيل الدراسي (Academic)
- [ ] `getAcademicData(filters)` → GET /api/academic
- [ ] `saveAcademicRecord(data)` → POST /api/academic

#### التقارير (Reports)
- [ ] `getReport(type, filters)` → GET /api/reports/{type}

#### النماذج العامة (General Forms)
- [ ] `getFormTemplates()` → GET /api/templates
- [ ] `saveFormTemplate(data)` → POST /api/templates
- [ ] `deleteFormTemplate(id)` → DELETE /api/templates/{id}

#### أعذار أولياء الأمور (Parent Excuse)
- [ ] `getExcuses(filters)` → GET /api/parent-excuse
- [ ] `submitExcuse(data)` → POST /api/parent-excuse
- [ ] `approveExcuse(id)` → PUT /api/parent-excuse/{id}/approve

#### إدخال المعلم (Teacher Input)
- [ ] `getTeacherFormConfig(token)` → GET /api/teacher-input/config
- [ ] `submitTeacherInput(data)` → POST /api/teacher-input

#### إدخال الموظفين (Staff Input)
- [ ] `getStaffFormConfig(token)` → GET /api/staff-input/config
- [ ] `submitStaffInput(data)` → POST /api/staff-input

#### سجل التدقيق (Audit Log)
- [ ] `getAuditLog(filters)` → GET /api/audit-log

#### البيانات الأساسية (Master Data)
- [ ] `getStudents()` → GET /api/students
- [ ] `getTeachers()` → GET /api/teachers
- [ ] `getSubjects()` → GET /api/subjects

---

## المرحلة 3: التحقق من التصميم (CSS/Style)

### 3.1 مقارنة CSS_Styles.html vs App.css

| # | القسم | الأصلي (سطور) | الجديد | مطابق؟ |
|---|------|--------------|--------|--------|
| 1 | متغيرات التصميم | 43 سطر | App.css :root | [ ] |
| 2 | الأساس (body, selection, scrollbar) | 10 أسطر | App.css body + rules | [ ] |
| 3 | الشريط الجانبي | 40 سطر | Sidebar.tsx inline + App.css | [ ] |
| 4 | الهيدر العلوي | 25 سطر | App.tsx inline | [ ] |
| 5 | البطاقات (.form-card) | 8 أسطر | App.css .form-card | [ ] |
| 6 | الجداول (.sht) | 20 سطر | App.css .data-table/.sht | [ ] |
| 7 | الأزرار | 3 أسطر | App.css button | [ ] |
| 8 | حقول الإدخال (1.5px) | 10 أسطر | App.css input | [ ] |
| 9 | النوافذ المنبثقة | 5 أسطر | App.css .animate-modal-in | [ ] |
| 10 | الإشعارات | 5 أسطر | App.css #toast-notification | [ ] |
| 11 | درجات المخالفات | 5 أسطر | App.css .bg-degree-* | [ ] |
| 12 | أنيميشن | 8 أسطر | App.css @keyframes | [ ] |
| 13 | عدد الغياب (.cnt-*) | 3 أسطر | App.css .cnt-* | [ ] |
| 14 | التفاعل (focus, disabled) | 4 أسطر | App.css | [ ] |
| 15 | ألوان الأقسام (.sec-*) | 6 أسطر | App.css .sec-* | [ ] |
| 16 | بانر البطل (.page-hero) | 15 سطر | App.css .page-hero | [ ] |
| 17 | فلتر نور (.noor-filter-*) | 6 أسطر | App.css .noor-filter-* | [ ] |
| 18 | تبويبات (.tabs-bar) | 8 أسطر | App.css .tabs-bar | [ ] |
| 19 | شريط الإجراءات (.action-bar) | 10 أسطر | App.css .action-bar | [ ] |
| 20 | قائمة منسدلة (.dropdown-*) | 6 أسطر | App.css .dropdown-* | [ ] |
| 21 | تحميل هيكلي (.skeleton) | 5 أسطر | App.css .skeleton | [ ] |
| 22 | حالة فارغة (.empty-state) | 5 أسطر | App.css .empty-state | [ ] |
| 23 | الطباعة (@media print) | 12 سطر | App.css @media print | [ ] |
| 24 | متجاوب (@media 768px) | 8 أسطر | App.css @media | [ ] |

### 3.2 خطوط الصفحات

| نوع الصفحة | الخط المتوقع | التحقق |
|-----------|-------------|--------|
| صفحات محمية (Dashboard, Settings...) | Cairo, IBM Plex Sans Arabic | [ ] |
| صفحات عامة (TeacherForm, StaffForm...) | Segoe UI, Tahoma, Arial | [ ] |
| قوالب الطباعة | Tahoma, IBM Plex Sans Arabic, Arial | [ ] |

---

## المرحلة 4: التحقق من البيانات (Data Flow)

### 4.1 مخطط البيانات لكل كيان

لكل entity في النظام، تحقق من:
- [ ] **Entity Model** — Domain class يطابق أعمدة Google Sheet
- [ ] **DB Migration** — جدول MariaDB مُنشأ بالأعمدة الصحيحة
- [ ] **API Endpoint** — Controller يقبل ويرجع نفس البيانات
- [ ] **Frontend API call** — axios call يرسل/يستقبل البيانات بشكل صحيح
- [ ] **UI Display** — البيانات تظهر بنفس الشكل في الواجهة

### 4.2 الكيانات الإلزامية

| # | الكيان | Domain | Migration | API | Frontend | UI |
|---|-------|--------|-----------|-----|----------|-----|
| 1 | Student | [ ] | [ ] | [ ] | [ ] | [ ] |
| 2 | Teacher | [ ] | [ ] | [ ] | [ ] | [ ] |
| 3 | Violation | [ ] | [ ] | [ ] | [ ] | [ ] |
| 4 | ViolationRule | [ ] | [ ] | [ ] | [ ] | [ ] |
| 5 | PositiveBehavior | [ ] | [ ] | [ ] | [ ] | [ ] |
| 6 | Tardiness | [ ] | [ ] | [ ] | [ ] | [ ] |
| 7 | Absence | [ ] | [ ] | [ ] | [ ] | [ ] |
| 8 | Permission | [ ] | [ ] | [ ] | [ ] | [ ] |
| 9 | EducationalNote | [ ] | [ ] | [ ] | [ ] | [ ] |
| 10 | Communication | [ ] | [ ] | [ ] | [ ] | [ ] |
| 11 | WhatsAppConfig | [ ] | [ ] | [ ] | [ ] | [ ] |
| 12 | AuditLog | [ ] | [ ] | [ ] | [ ] | [ ] |
| 13 | SchoolSettings | [ ] | [ ] | [ ] | [ ] | [ ] |
| 14 | User | [ ] | [ ] | [ ] | [ ] | [ ] |
| 15 | TokenLink | [ ] | [ ] | [ ] | [ ] | [ ] |
| 16 | MessageTemplate | [ ] | [ ] | [ ] | [ ] | [ ] |
| 17 | Subject | [ ] | [ ] | [ ] | [ ] | [ ] |
| 18 | ParentExcuse | [ ] | [ ] | [ ] | [ ] | [ ] |

---

## المرحلة 5: التحقق من الطباعة (Print Templates)

لكل قالب طباعة في النظام الأصلي، تحقق من:

| # | القالب | الأصلي (PrintTemplates) | الجديد (printUtils) | مطابق؟ |
|---|-------|------------------------|---------------------|--------|
| 1 | تقرير المخالفات | [ ] | [ ] | [ ] |
| 2 | تقرير السلوك الإيجابي | [ ] | [ ] | [ ] |
| 3 | تقرير التأخر | [ ] | [ ] | [ ] |
| 4 | تقرير الغياب | [ ] | [ ] | [ ] |
| 5 | تقرير الاستئذان | [ ] | [ ] | [ ] |
| 6 | تقرير الملاحظات | [ ] | [ ] | [ ] |
| 7 | تقرير شامل للطالب | [ ] | [ ] | [ ] |
| 8 | تعهد / إقرار | [ ] | [ ] | [ ] |
| 9 | كشف حضور | [ ] | [ ] | [ ] |
| 10 | خطاب رسمي | [ ] | [ ] | [ ] |

---

## المرحلة 6: الاختبار التكاملي (E2E Testing)

### 6.1 سيناريوهات الاختبار

| # | السيناريو | الخطوات | النتيجة المتوقعة | ناجح؟ |
|---|----------|---------|-----------------|--------|
| 1 | تسجيل الدخول | إدخال 0500000000 + admin123 | دخول للوحة التحكم | [ ] |
| 2 | إضافة مخالفة | اختيار طالب → اختيار مخالفة → حفظ | تظهر في الجدول | [ ] |
| 3 | إضافة سلوك إيجابي | اختيار طالب → إضافة سلوك → حفظ | تظهر في الجدول | [ ] |
| 4 | تسجيل تأخر | اختيار طالب → وقت → حفظ | يظهر في السجل | [ ] |
| 5 | تسجيل غياب | اختيار طلاب → تاريخ → حفظ | تظهر في السجل | [ ] |
| 6 | إضافة استئذان | طالب → سبب → حفظ | تظهر في السجل | [ ] |
| 7 | طباعة تقرير | فتح أي تقرير → طباعة | PDF صحيح | [ ] |
| 8 | إدخال معلم (رابط) | فتح /form?token=xxx | النموذج يعمل | [ ] |
| 9 | إدخال موظف (رابط) | فتح /staff-form?token=xxx | النموذج يعمل | [ ] |
| 10 | شاشة الحارس | فتح /guard?token=xxx | تظهر الاستئذانات | [ ] |
| 11 | نموذج الوكيل | فتح /wakeel-form?token=xxx | النموذج يعمل | [ ] |
| 12 | نموذج المرشد | فتح /counselor-form?token=xxx | النموذج يعمل | [ ] |
| 13 | الإعدادات | تعديل اسم المدرسة → حفظ | القيمة تحفظ | [ ] |
| 14 | الواتساب | إرسال رسالة تجريبية | ترسل بنجاح | [ ] |
| 15 | لوحة التحكم | فتح الصفحة الرئيسية | إحصائيات صحيحة | [ ] |

### 6.2 اختبار الأجهزة

| الجهاز | المتصفح | يعمل؟ |
|--------|---------|-------|
| Desktop (1920x1080) | Chrome | [ ] |
| Desktop (1920x1080) | Firefox | [ ] |
| Tablet (768px) | Chrome | [ ] |
| Mobile (375px) | Chrome | [ ] |

---

## المرحلة 7: التحقق من التكامل (Integration)

| # | التكامل | الأصلي | الجديد | مطابق؟ |
|---|--------|--------|--------|--------|
| 1 | JWT Auth | Cookie-based | JWT Bearer | [ ] |
| 2 | Token Links | ScriptApp.getUrl() | /api/auth/links | [ ] |
| 3 | التاريخ الهجري | getHijriDate_() | getTodayDates() | [ ] |
| 4 | استيراد نور CSV | processNoorAbsenceFile() | NoorController | [ ] |
| 5 | مزامنة خارجية | Server_Extension.gs | ExtensionController | [ ] |
| 6 | إرسال SMS | Server_SMS.gs | SmsController | [ ] |

---

## كيفية استخدام هذا البروتوكول

### الخطوة 1: التحقق التلقائي
```bash
# تشغيل الخادم
cd d:/SchoolBehaviorSystem
PATH="$HOME/.dotnet:$PATH" DOTNET_ROOT="$HOME/.dotnet" dotnet run --project src/API/SchoolBehaviorSystem.API.csproj

# في terminal آخر - تشغيل الواجهة
cd d:/SchoolBehaviorSystem/client
npm start

# تشغيل MariaDB
"C:/Program Files/MariaDB 12.2/bin/mysqld.exe" --console
```

### الخطوة 2: المراجعة اليدوية
1. افتح كل ملف GAS أصلي
2. استخرج كل الوظائف (functions)
3. تأكد من وجود endpoint مقابل في API
4. تأكد من أن الـ React page يستدعي هذا الـ endpoint
5. تأكد من أن الواجهة تعرض نفس البيانات

### الخطوة 3: المقارنة البصرية
1. افتح النظام الأصلي (GAS) في متصفح
2. افتح النظام الجديد في متصفح آخر
3. قارن كل صفحة جنباً إلى جنب:
   - نفس الألوان؟
   - نفس التخطيط؟
   - نفس الخطوط؟
   - نفس الأزرار والحقول؟
   - نفس سلوك الطباعة؟

### الخطوة 4: التحقق من البيانات
1. أدخل بيانات تجريبية في النظام القديم
2. أدخل نفس البيانات في النظام الجديد
3. قارن المخرجات (تقارير، طباعة، إحصائيات)

---

## ملاحظات مهمة

1. **الأولوية**: المراحل مرتبة حسب الأهمية - ابدأ من 1 ولا تنتقل للتالية حتى تكتمل السابقة
2. **التوثيق**: سجل كل فرق تجده في ملف منفصل مع الحل المقترح
3. **عدم الإضافة**: لا تضف ميزات جديدة - فقط انقل الموجود
4. **الاختبار**: كل وظيفة يجب اختبارها بـ: إضافة، تعديل، حذف، عرض، طباعة
5. **الخطوط**: محمي = Cairo | عام = Segoe UI | طباعة = Tahoma
