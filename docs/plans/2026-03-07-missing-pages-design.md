# Missing Pages Design - School Behavior System

## Overview
8 gaps from GAS migration requiring new React pages and utilities.

## Pages to Build

### 1. GuardDisplayPage (`/guard?token=X`)
- Public, token-based auth
- Stage tabs, permission cards, exit confirmation button
- APIs: GET /api/permissions, PUT /api/permissions/{id}/confirm

### 2. WakeelFormPage (`/wakeel-form?token=X`)
- Public, token-based auth, 6 tabs
- Violations, Absence, Positive, Notes, Permission, Tardiness
- Reuses VIOLATIONS/POSITIVE/NOTES static data from TeacherFormPage
- APIs: staff-input/verify, staff-input/students, teacher-input/submit, permissions/batch, tardiness/batch

### 3. CounselorFormPage (`/counselor-form?token=X`)
- Public, token-based auth, 3 tabs (subset of Wakeel)
- Permission, Notes, Positive Behavior
- Purple theme

### 4. AuditLogPage (`/audit-log`)
- Protected (JWT), violations history with filters
- Dual view: cards (grouped by student) + table
- Print forms: pledge, parent notification, committee report
- APIs: GET /api/violations with filters

### 5. AdminTardinessPage (`/admin-tardiness?token=X`)
- Public, token-based auth
- Stage/Grade selection, student checkboxes, bulk submit
- APIs: staff-input/students, tardiness/batch

### 6. Hijri Date Utility (`utils/hijriDate.ts`)
- formatHijri() with Intl API fallback
- Apply to PositiveBehaviorPage, DashboardPage, all pages missing fallback

### 7. NoorPage Enhancement
- Add stats cards, 5 tabs, pending records, documentation status
- No Chrome extension bridge (export/copy instead)

### 8. Extension API
- Already complete (ExtensionController verified)

## Shared Components (extracted from WakeelForm)
- StudentSelector: stage>grade>class cascading + student list + search + chips
- ItemList: searchable list with checkboxes and colored badges
- BottomActionBar: fixed submit + log button

## Routes to Add (App.tsx)
- /guard, /wakeel-form, /counselor-form, /admin-tardiness (public)
- /audit-log (protected)

## Implementation Order
1. hijriDate.ts utility (foundation)
2. GuardDisplayPage + guardApi.ts
3. AdminTardinessPage (simplest form)
4. WakeelFormPage (most complex, extracts shared components)
5. CounselorFormPage (reuses Wakeel components)
6. AuditLogPage
7. NoorPage enhancement
8. Hijri fixes across existing pages
