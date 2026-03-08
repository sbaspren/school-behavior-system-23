# سجل جلسات النقل

## الجلسة 1: Server_TeacherInput.gs → TeacherInputController.cs
**التاريخ:** 2026-03-08
**الملف الأصلي:** Server_TeacherInput.gs (2,040 سطر، 44 دالة)
**النتيجة:** 1,689 سطر C# (1,451 controller + 221 background service + 17 entity)

### الملفات المعدلة:
| الملف | التغيير |
|-------|--------|
| `src/API/Controllers/TeacherInputController.cs` | 395 → 1,451 سطر (15 endpoint + 18 helper) |
| `src/Infrastructure/Services/TeacherDataBakeService.cs` | **جديد** — Background Service للخبز |
| `src/Domain/Entities/LinkedPerson.cs` | **جديد** — مطابق لشيت روابط_المعلمين |
| `src/Infrastructure/Data/AppDbContext.cs` | إضافة LinkedPersons DbSet |
| `src/API/Program.cs` | تسجيل TeacherDataBakeService |

### الـ Endpoints (15):
| Method | Route | المصدر |
|--------|-------|--------|
| GET | public/verify | buildTeacherPageData_ + getTeacherPageData_ |
| POST | public/submit | submitTeacherForm (مع noAbsence + notify + log) |
| GET | public/class-students | getClassStudents |
| GET | public/teacher-by-token | getTeacherByToken |
| GET | classes/available | getAvailableClasses |
| POST | links/teacher/{id} | createTeacherLink |
| POST | links/teacher/by-phone | createTeacherLinkByPhone_ |
| POST | links/user/{id} | createUserLink |
| POST | links/user/by-phone | createUserLinkByPhone_ |
| POST | links/teachers/all | createAllTeachersLinks |
| POST | links/users/all | createAllUsersLinks |
| DELETE | links/person | removeLinkForPerson |
| GET | links/data | getLinksTabData |
| POST | links/send | sendLinkToPersonWithStage |
| POST | links/send-bulk | bulkSendLinks |

### ⚠️ يحتاج migration:
```bash
dotnet ef migrations add AddLinkedPersons
dotnet ef database update
```
