import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { violationsApi, ViolationData, RepetitionInfo } from '../api/violations';
import { positiveBehaviorApi } from '../api/positiveBehavior';
import { studentsApi } from '../api/students';
import { settingsApi, StageConfigData } from '../api/settings';
import { whatsappApi } from '../api/whatsapp';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';

const DEGREE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'الأولى', color: '#15803d', bg: '#dcfce7' },
  2: { label: 'الثانية', color: '#ca8a04', bg: '#fef9c3' },
  3: { label: 'الثالثة', color: '#ea580c', bg: '#ffedd5' },
  4: { label: 'الرابعة', color: '#dc2626', bg: '#fee2e2' },
  5: { label: 'الخامسة', color: '#7c2d12', bg: '#fecaca' },
};

const TYPE_LABELS: Record<string, string> = {
  InPerson: 'حضوري',
  Digital: 'رقمي',
  Educational: 'هيئة تعليمية',
};

// Required forms detection from procedures text (matches GAS getRequiredForms_)
type FormId = 'tahood_slooki' | 'ishar_wali_amr' | 'dawat_wali_amr' | 'ehalat_talib' | 'mahdar_lajnah' | 'mahdar_dab_wakea' | 'tawid_darajat';

const FORM_PATTERNS: { id: FormId; pattern: RegExp }[] = [
  { id: 'dawat_wali_amr', pattern: /دعوة.*ولي|ولي.*أمر.*حضور/ },
  { id: 'tahood_slooki', pattern: /تعهد/ },
  { id: 'ishar_wali_amr', pattern: /إشعار.*ولي|إنذار.*بالنقل|إنذار.*كتاب/ },
  { id: 'ehalat_talib', pattern: /إحالة|تحويل.*للموجه|تحويل.*الموجه|تحويل.*لجنة.*التوجيه/ },
  { id: 'mahdar_lajnah', pattern: /لجنة.*التوجيه|اجتماع.*للجنة|عقد.*اجتماع/ },
  { id: 'mahdar_dab_wakea', pattern: /محضر.*ضبط|تدوين.*محضر/ },
  { id: 'tawid_darajat', pattern: /فرص.*التعويض|فرص.*تعويض|تمكين.*فرص/ },
];

const getRequiredForms = (procedures: string): Set<FormId> => {
  if (!procedures) return new Set();
  const forms = new Set<FormId>();
  for (const { id, pattern } of FORM_PATTERNS) {
    if (pattern.test(procedures)) forms.add(id);
  }
  return forms;
};

interface ViolationRow {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  grade: string;
  className: string;
  stage: string;
  violationCode: string;
  description: string;
  type: string;
  degree: number;
  hijriDate: string;
  miladiDate: string;
  deduction: number;
  procedures: string;
  recordedBy: string;
  recordedAt: string;
  isSent: boolean;
  notes: string;
}

interface StudentOption {
  id: number;
  studentNumber: string;
  name: string;
  stage: string;
  grade: string;
  className: string;
}

type TabType = 'today' | 'approved' | 'positive' | 'compensation' | 'reports';

const ViolationsPage: React.FC = () => {
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('__all__');
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [modalOpen, setModalOpen] = useState(false);

  const enabledStages = useMemo(() =>
    stages.filter((s) => s.isEnabled && s.grades.some((g) => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        violationsApi.getAll(),
        settingsApi.getStructure(),
      ]);
      if (vRes.data?.data) setViolations(vRes.data.data);
      if (sRes.data?.data?.stages) setStages(Array.isArray(sRes.data.data.stages) ? sRes.data.data.stages : []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredByStage = useMemo(() => {
    if (stageFilter === '__all__') return violations;
    const stageId = SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter;
    return violations.filter((v) => v.stage === stageId);
  }, [violations, stageFilter]);

  // Stats
  const todayDate = new Date().toISOString().split('T')[0];
  const todayViolations = useMemo(() =>
    filteredByStage.filter((v) => v.miladiDate === todayDate || v.recordedAt?.startsWith(todayDate)),
    [filteredByStage, todayDate]
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div className="spinner" />
        <p style={{ color: '#666', marginTop: '16px' }}>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111' }}>المخالفات السلوكية</h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>تسجيل ومتابعة المخالفات والإجراءات</p>
          </div>
        </div>
        <button onClick={() => setModalOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', background: '#dc2626', color: '#fff',
          borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(220,38,38,0.3)',
        }}>
          ➕ تسجيل مخالفة
        </button>
      </div>

      {/* Hero Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="إجمالي المخالفات" value={filteredByStage.length} color="#4f46e5" />
        <StatCard label="إجمالي الحسم" value={filteredByStage.reduce((s, v) => s + v.deduction, 0)} color="#dc2626" />
        <StatCard label="مخالفات اليوم" value={todayViolations.length} color="#0891b2" />
        <StatCard label="تم الإرسال" value={filteredByStage.filter((v) => v.isSent).length} color="#15803d" />
        <StatCard label="لم يُرسل" value={filteredByStage.filter((v) => !v.isSent).length} color="#ea580c" />
      </div>

      {/* Stage Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#6b7280' }}>المرحلة:</span>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
          <FilterBtn label="الكل" count={violations.length} active={stageFilter === '__all__'} onClick={() => setStageFilter('__all__')} />
          {enabledStages.map((stage) => {
            const info = SETTINGS_STAGES.find((s) => s.id === stage.stage);
            const count = violations.filter((v) => v.stage === stage.stage).length;
            return <FilterBtn key={stage.stage} label={info?.name || stage.stage} count={count} active={stageFilter === (info?.name || stage.stage)} onClick={() => setStageFilter(info?.name || stage.stage)} />;
          })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '10px', padding: '4px', marginBottom: '16px' }}>
        {[
          { id: 'today' as TabType, label: 'اليوم', icon: '📅' },
          { id: 'approved' as TabType, label: 'السجل التراكمي', icon: '📋' },
          { id: 'positive' as TabType, label: 'السلوك المتمايز', icon: '⭐' },
          { id: 'compensation' as TabType, label: 'درجات التعويض', icon: '🏆' },
          { id: 'reports' as TabType, label: 'التقارير', icon: '📊' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '10px 16px', borderRadius: '8px',
            background: activeTab === tab.id ? '#fff' : 'transparent',
            color: activeTab === tab.id ? '#dc2626' : '#6b7280',
            fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer',
            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'today' && (
        <TodayTab violations={todayViolations} allViolations={filteredByStage} onRefresh={loadData} stageFilter={stageFilter} />
      )}
      {activeTab === 'approved' && (
        <ApprovedTab violations={filteredByStage} onRefresh={loadData} />
      )}
      {activeTab === 'positive' && (
        <PositiveTab stageFilter={stageFilter} />
      )}
      {activeTab === 'compensation' && (
        <CompensationTab violations={filteredByStage} stageFilter={stageFilter} />
      )}
      {activeTab === 'reports' && (
        <ReportsTab violations={filteredByStage} stageFilter={stageFilter} />
      )}

      {/* Add Modal */}
      {modalOpen && (
        <AddViolationModal
          stages={stages}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadData(); }}
        />
      )}
    </div>
  );
};

// ============================================================
// Today Tab - مخالفات اليوم
// ============================================================
const TodayTab: React.FC<{
  violations: ViolationRow[];
  allViolations: ViolationRow[];
  onRefresh: () => void;
  stageFilter: string;
}> = ({ violations, allViolations, onRefresh, stageFilter }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [degreeFilter, setDegreeFilter] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<ViolationRow | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [messageModal, setMessageModal] = useState<ViolationRow | null>(null);
  const [messageText, setMessageText] = useState('');

  const filtered = useMemo(() => {
    let list = violations;
    if (degreeFilter > 0) list = list.filter((v) => v.degree === degreeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((v) =>
        v.studentName.toLowerCase().includes(q) ||
        v.studentNumber.includes(q) ||
        v.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [violations, degreeFilter, search]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((v) => v.id)));
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await violationsApi.delete(confirmDelete.id);
      if (res.data?.success) { showSuccess('تم حذف المخالفة'); setConfirmDelete(null); onRefresh(); }
      else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
  };

  const handleSendWhatsApp = async (v: ViolationRow) => {
    setSendingId(v.id);
    try {
      const res = await violationsApi.sendWhatsApp(v.id);
      if (res.data?.data?.success) { showSuccess('تم إرسال الرسالة'); onRefresh(); }
      else showError(res.data?.message || 'فشل الإرسال');
    } catch { showError('خطأ في الاتصال'); }
    finally { setSendingId(null); }
  };

  const handleSendBulk = async () => {
    if (selected.size === 0) { showError('لم يتم تحديد أي مخالفة'); return; }
    try {
      const res = await violationsApi.sendWhatsAppBulk(Array.from(selected));
      if (res.data?.data) {
        const d = res.data.data;
        showSuccess(`تم إرسال ${d.sentCount} من ${d.total} | فشل: ${d.failedCount}`);
        setSelected(new Set());
        onRefresh();
      }
    } catch { showError('خطأ في الإرسال الجماعي'); }
  };

  const handleDeleteBulk = async () => {
    if (selected.size === 0) return;
    try {
      const res = await violationsApi.deleteBulk(Array.from(selected));
      if (res.data?.data) {
        showSuccess(`تم حذف ${res.data.data.deletedCount} مخالفة`);
        setSelected(new Set());
        onRefresh();
      }
    } catch { showError('خطأ في الحذف الجماعي'); }
  };

  const handleSendWithMessage = async () => {
    if (!messageModal) return;
    setSendingId(messageModal.id);
    try {
      const res = await violationsApi.sendWhatsApp(messageModal.id, { message: messageText });
      if (res.data?.data?.success) { showSuccess('تم إرسال الرسالة'); setMessageModal(null); onRefresh(); }
      else showError(res.data?.message || 'فشل الإرسال');
    } catch { showError('خطأ في الاتصال'); }
    finally { setSendingId(null); }
  };

  const openMessageEditor = (v: ViolationRow) => {
    setMessageText(
      `المكرم ولي أمر الطالب / ${v.studentName}\n` +
      `السلام عليكم ورحمة الله وبركاته\n` +
      `نود إبلاغكم بتسجيل مخالفة سلوكية بحق ابنكم:\n` +
      `المخالفة: ${v.description}\n` +
      `الدرجة: ${v.degree}\n` +
      `الحسم: ${v.deduction} درجة\n` +
      `التاريخ: ${v.hijriDate}\n` +
      `نأمل التواصل مع المدرسة لمتابعة الموضوع.`
    );
    setMessageModal(v);
  };

  const [dawatModal, setDawatModal] = useState<ViolationRow | null>(null);

  type FormType = 'تعهد' | 'إشعار' | 'محضر' | 'إحالة' | 'ضبط واقعة' | 'تعويض' | 'توثيق تواصل';

  const handlePrint = (v: ViolationRow, formType: FormType) => {
    const degreeInfo = DEGREE_LABELS[v.degree] || DEGREE_LABELS[1];
    const pw = window.open('', '_blank');
    if (!pw) return;

    const FORM_TITLES: Record<FormType, string> = {
      'تعهد': 'نموذج تعهد طالب',
      'إشعار': 'إشعار ولي أمر',
      'محضر': 'محضر مخالفة سلوكية',
      'إحالة': 'نموذج إحالة طالب',
      'ضبط واقعة': 'محضر ضبط واقعة',
      'تعويض': 'نموذج فرص تعويض الدرجات',
      'توثيق تواصل': 'توثيق تواصل مع ولي الأمر',
    };

    const FORM_BODY: Record<FormType, string> = {
      'تعهد': '<p style="margin-top:30px">أتعهد أنا الطالب المذكور أعلاه بعدم تكرار هذه المخالفة والالتزام بأنظمة المدرسة.</p>',
      'إشعار': '<p style="margin-top:30px">المكرم ولي أمر الطالب المذكور أعلاه، نود إبلاغكم بالمخالفة المسجلة ونأمل التواصل مع المدرسة.</p>',
      'محضر': '<p style="margin-top:30px">تم استدعاء الطالب والتحقيق معه بشأن المخالفة المذكورة أعلاه، وأقر بصحة ما نُسب إليه.</p>',
      'إحالة': '<p style="margin-top:30px">بناءً على تكرار المخالفات السلوكية، يُحال الطالب المذكور أعلاه إلى الجهة المختصة لاتخاذ الإجراءات اللازمة.</p><div style="margin-top:20px"><label style="font-weight:700">الجهة المحال إليها:</label><div style="border-bottom:1px solid #999;margin-top:10px;height:25px"></div></div>',
      'ضبط واقعة': '<div style="margin-top:30px"><label style="font-weight:700">تفاصيل الواقعة:</label><div style="border:1px solid #ccc;border-radius:8px;min-height:80px;padding:10px;margin-top:8px">' + (v.notes || v.description) + '</div></div><div style="margin-top:16px"><label style="font-weight:700">الشهود:</label><div style="border-bottom:1px solid #999;margin-top:10px;height:25px"></div></div>',
      'تعويض': '<div style="margin-top:30px"><p>يُمنح الطالب المذكور أعلاه فرصة لتعويض الدرجات المحسومة وفق الآليات التالية:</p><table style="margin-top:12px"><tr><th>آلية التعويض</th><th>الدرجات المستردة</th><th>ملاحظات</th></tr><tr><td style="height:30px"></td><td></td><td></td></tr><tr><td style="height:30px"></td><td></td><td></td></tr></table></div>',
      'توثيق تواصل': '<div style="margin-top:30px"><table><tr><th style="width:30%">طريقة التواصل</th><td>☐ هاتف  ☐ حضوري  ☐ واتساب  ☐ أخرى</td></tr><tr><th>نتيجة التواصل</th><td style="height:40px"></td></tr><tr><th>التوصيات</th><td style="height:40px"></td></tr></table></div>',
    };

    pw.document.write(`<html dir="rtl"><head><title>${FORM_TITLES[formType]}</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:40px;direction:rtl}h2{text-align:center;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:10px;text-align:right}th{background:#f0f0f0}.signature{margin-top:60px;display:flex;justify-content:space-between}.signature div{text-align:center;width:30%}.signature div span{display:block;margin-top:40px;border-top:1px solid #333;padding-top:5px}@media print{body{padding:20px}}</style></head><body>
      <h2>${FORM_TITLES[formType]}</h2>
      <table>
        <tr><th>اسم الطالب</th><td>${v.studentName}</td><th>رقم الطالب</th><td>${v.studentNumber}</td></tr>
        <tr><th>الصف</th><td>${v.grade}</td><th>الفصل</th><td>${v.className}</td></tr>
        <tr><th>المخالفة</th><td colspan="3">${v.description}</td></tr>
        <tr><th>الدرجة</th><td>${degreeInfo.label}</td><th>الحسم</th><td>${v.deduction} درجة</td></tr>
        <tr><th>الإجراءات</th><td colspan="3">${v.procedures}</td></tr>
        <tr><th>التاريخ</th><td>${v.hijriDate}</td><th>الملاحظات</th><td>${v.notes || '-'}</td></tr>
      </table>
      ${FORM_BODY[formType]}
      <div class="signature">
        <div>الطالب<span>التوقيع</span></div>
        <div>ولي الأمر<span>التوقيع</span></div>
        <div>وكيل شؤون الطلاب<span>التوقيع</span></div>
      </div>
      </body></html>`);
    pw.document.close();
    pw.print();
  };

  const handleExport = async () => {
    try {
      const stage = stageFilter !== '__all__' ? (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter) : undefined;
      const res = await violationsApi.exportCsv(stage);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'violations.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { showError('خطأ في التصدير'); }
  };

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الطالب..."
          style={{ flex: 1, minWidth: '200px', height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }} />
        <select value={degreeFilter} onChange={(e) => setDegreeFilter(Number(e.target.value))}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value={0}>كل الدرجات</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>الدرجة {DEGREE_LABELS[d].label}</option>
          ))}
        </select>
        <button onClick={handleExport} style={{ height: '38px', padding: '0 16px', background: '#059669', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
          📥 تصدير CSV
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#eff6ff', borderRadius: '10px', marginBottom: '12px', border: '1px solid #bfdbfe' }}>
          <span style={{ fontWeight: 700, color: '#1e40af' }}>تم تحديد {selected.size} مخالفة</span>
          <div style={{ flex: 1 }} />
          <button onClick={handleSendBulk} style={{ padding: '6px 16px', background: '#25d366', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
            📱 إرسال واتساب
          </button>
          <button onClick={handleDeleteBulk} style={{ padding: '6px 16px', background: '#dc2626', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
            🗑️ حذف المحدد
          </button>
          <button onClick={() => setSelected(new Set())} style={{ padding: '6px 12px', background: '#e5e7eb', color: '#374151', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
            إلغاء التحديد
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}>⚠️</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد مخالفات لهذا اليوم</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll} />
                  </th>
                  <th>الطالب</th>
                  <th>المخالفة</th>
                  <th>الدرجة</th>
                  <th>الحسم</th>
                  <th>الإرسال</th>
                  <th style={{ textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const degreeInfo = DEGREE_LABELS[v.degree] || DEGREE_LABELS[1];
                  return (
                    <tr key={v.id} style={{ background: selected.has(v.id) ? '#eff6ff' : undefined }}>
                      <td>
                        <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#1f2937' }}>{v.studentName}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{v.grade} ({v.className})</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '14px', color: '#374151' }}>{v.description || v.violationCode}</div>
                        {v.procedures && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{v.procedures}</div>}
                      </td>
                      <td>
                        <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, background: degreeInfo.bg, color: degreeInfo.color }}>
                          {degreeInfo.label}
                        </span>
                      </td>
                      <td>
                        {v.deduction > 0 ? (
                          <span style={{ fontWeight: 700, color: '#dc2626' }}>-{v.deduction}</span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td>
                        {v.isSent ? (
                          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>تم</span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>لم يُرسل</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {(() => {
                          const reqForms = getRequiredForms(v.procedures);
                          const hl = (formId: FormId) => reqForms.has(formId) ? { background: '#fef3c7', borderRadius: '6px', boxShadow: '0 0 0 2px #f59e0b' } : {};
                          return (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <ActionBtn icon="📱" title="إرسال واتساب" color="#25d366" onClick={() => handleSendWhatsApp(v)} disabled={sendingId === v.id} />
                              <ActionBtn icon="✏️" title="تعديل الرسالة" color="#3b82f6" onClick={() => openMessageEditor(v)} />
                              <span style={hl('tahood_slooki')}><ActionBtn icon="📄" title="تعهد سلوكي" color="#6366f1" onClick={() => handlePrint(v, 'تعهد')} /></span>
                              <span style={hl('ishar_wali_amr')}><ActionBtn icon="📢" title="إشعار ولي أمر" color="#3b82f6" onClick={() => handlePrint(v, 'إشعار')} /></span>
                              <span style={hl('dawat_wali_amr')}><ActionBtn icon="📨" title="دعوة ولي أمر" color="#d97706" onClick={() => setDawatModal(v)} /></span>
                              <span style={hl('mahdar_lajnah')}><ActionBtn icon="👥" title="محضر لجنة" color="#dc2626" onClick={() => handlePrint(v, 'محضر')} /></span>
                              <span style={hl('ehalat_talib')}><ActionBtn icon="📤" title="إحالة طالب" color="#7c3aed" onClick={() => handlePrint(v, 'إحالة')} /></span>
                              <span style={hl('mahdar_dab_wakea')}><ActionBtn icon="📝" title="ضبط واقعة" color="#6b7280" onClick={() => handlePrint(v, 'ضبط واقعة')} /></span>
                              <span style={hl('tawid_darajat')}><ActionBtn icon="🏆" title="فرص تعويض" color="#0d9488" onClick={() => handlePrint(v, 'تعويض')} /></span>
                              <ActionBtn icon="📞" title="توثيق تواصل" color="#15803d" onClick={() => handlePrint(v, 'توثيق تواصل')} />
                              <ActionBtn icon="🗑️" title="حذف" color="#dc2626" onClick={() => setConfirmDelete(v)} />
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <ConfirmModal
          title="تأكيد حذف المخالفة"
          message={`هل أنت متأكد من حذف مخالفة "${confirmDelete.description}" للطالب ${confirmDelete.studentName}؟`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Parent Meeting Modal (دعوة ولي أمر) */}
      {dawatModal && (
        <DawatModal violation={dawatModal} onClose={() => setDawatModal(null)} />
      )}

      {/* Message Editor Modal */}
      {messageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '500px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>تعديل رسالة الواتساب</h3>
            <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280' }}>الطالب: {messageModal.studentName}</p>
            <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={8}
              style={{ width: '100%', padding: '12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setMessageModal(null)} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
              <button onClick={handleSendWithMessage} disabled={sendingId === messageModal.id} style={{
                padding: '8px 24px', background: '#25d366', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer',
              }}>
                {sendingId === messageModal.id ? 'جاري الإرسال...' : '📱 إرسال'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================================
// Approved Tab - السجل التراكمي
// ============================================================
const ApprovedTab: React.FC<{
  violations: ViolationRow[];
  onRefresh: () => void;
}> = ({ violations, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [degreeFilter, setDegreeFilter] = useState(0);
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [detailStudent, setDetailStudent] = useState<{ studentId: number; studentName: string } | null>(null);

  // Filtered flat list (for print)
  const allFilteredRecords = useMemo(() => {
    let list = violations;
    if (degreeFilter > 0) list = list.filter((v) => v.degree === degreeFilter);
    if (gradeFilter) list = list.filter((v) => v.grade === gradeFilter);
    if (classFilter) list = list.filter((v) => v.className === classFilter);
    if (dateFrom) list = list.filter((v) => v.hijriDate >= dateFrom);
    if (dateTo) list = list.filter((v) => v.hijriDate <= dateTo);
    if (search) { const q = search.toLowerCase(); list = list.filter((v) => v.studentName.toLowerCase().includes(q) || v.studentNumber.includes(q)); }
    return list.sort((a, b) => `${a.grade}${a.className}`.localeCompare(`${b.grade}${b.className}`));
  }, [violations, degreeFilter, gradeFilter, classFilter, dateFrom, dateTo, search]);

  // Group by student
  const studentGroups = useMemo(() => {
    const groups = new Map<number, { student: ViolationRow; violations: ViolationRow[] }>();
    for (const v of allFilteredRecords) {
      if (!groups.has(v.studentId)) groups.set(v.studentId, { student: v, violations: [] });
      groups.get(v.studentId)!.violations.push(v);
    }
    return Array.from(groups.values()).sort((a, b) => b.violations.length - a.violations.length);
  }, [allFilteredRecords]);

  const grades = useMemo(() => Array.from(new Set(violations.map((v) => v.grade))).sort(), [violations]);
  const classes = useMemo(() => Array.from(new Set(violations.filter((v) => !gradeFilter || v.grade === gradeFilter).map((v) => v.className))).sort(), [violations, gradeFilter]);

  const handlePrintArchive = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    let prevClass = '';
    const rows = allFilteredRecords.map((r, i) => {
      const deg = DEGREE_LABELS[r.degree] || DEGREE_LABELS[1];
      const classKey = `${r.grade} (${r.className})`;
      let separator = '';
      if (classKey !== prevClass) { prevClass = classKey; separator = `<tr style="background:#f0f0f0;font-weight:700"><td colspan="8">${classKey}</td></tr>`; }
      return `${separator}<tr><td>${i + 1}</td><td>${r.studentName}</td><td>${r.studentNumber}</td><td>${r.description}</td><td>${deg.label}</td><td>${r.deduction}</td><td>${r.hijriDate}</td><td>${r.isSent ? 'نعم' : 'لا'}</td></tr>`;
    }).join('');
    const dateRange = dateFrom || dateTo ? `<p style="text-align:center">الفترة: ${dateFrom || '...'} إلى ${dateTo || '...'}</p>` : '';
    pw.document.write(`<html dir="rtl"><head><title>سجل المخالفات التراكمي</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#e5e7eb}h2{text-align:center}@media print{body{padding:15px}}</style></head>
      <body><h2>سجل المخالفات التراكمي</h2>${dateRange}<p style="text-align:center">عدد السجلات: ${allFilteredRecords.length} | عدد الطلاب: ${studentGroups.length}</p>
      <table><thead><tr><th>#</th><th>الطالب</th><th>الرقم</th><th>المخالفة</th><th>الدرجة</th><th>الحسم</th><th>التاريخ</th><th>إرسال</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    pw.document.close(); pw.print();
  };

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الطالب..."
          style={{ flex: 1, minWidth: '200px', height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }} />
        <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setClassFilter(''); }}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الصفوف</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الفصول</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={degreeFilter} onChange={(e) => setDegreeFilter(Number(e.target.value))}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value={0}>كل الدرجات</option>
          {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>الدرجة {DEGREE_LABELS[d].label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setViewMode('cards')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === 'cards' ? '#fff' : 'transparent', color: viewMode === 'cards' ? '#dc2626' : '#6b7280', fontWeight: 700, fontSize: '13px' }}>🎴 بطاقات</button>
          <button onClick={() => setViewMode('table')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? '#dc2626' : '#6b7280', fontWeight: 700, fontSize: '13px' }}>📋 جدول</button>
        </div>
        <button onClick={handlePrintArchive} style={{ height: '38px', padding: '0 16px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>🖨️ طباعة</button>
      </div>

      {/* Date range filter */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>الفترة:</span>
        <input type="text" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="من تاريخ (هجري)"
          style={{ height: '34px', padding: '0 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px', width: '140px' }} />
        <input type="text" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="إلى تاريخ (هجري)"
          style={{ height: '34px', padding: '0 10px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '13px', width: '140px' }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            style={{ height: '34px', padding: '0 12px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>مسح</button>
        )}
      </div>

      {studentGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}>📋</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد مخالفات تراكمية</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {studentGroups.map(({ student, violations: vList }) => {
            const totalDeduction = vList.reduce((s, v) => s + v.deduction, 0);
            const behaviorScore = Math.max(0, 100 - totalDeduction);
            const scoreColor = behaviorScore >= 80 ? '#15803d' : behaviorScore >= 60 ? '#ca8a04' : behaviorScore >= 40 ? '#ea580c' : '#dc2626';
            return (
              <div key={student.studentId} onClick={() => setDetailStudent({ studentId: student.studentId, studentName: student.studentName })}
                style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#1f2937' }}>{student.studentName}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{student.grade} ({student.className})</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: scoreColor }}>{behaviorScore}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>درجة السلوك</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '12px', background: '#f3f4f6', color: '#4b5563' }}>
                    {vList.length} مخالفة
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '12px', background: '#fee2e2', color: '#dc2626' }}>
                    حسم: {totalDeduction}
                  </span>
                  {[1, 2, 3, 4, 5].map((d) => {
                    const count = vList.filter((v) => v.degree === d).length;
                    if (count === 0) return null;
                    const info = DEGREE_LABELS[d];
                    return (
                      <span key={d} style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '12px', background: info.bg, color: info.color }}>
                        د{d}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>الصف</th>
                  <th>عدد المخالفات</th>
                  <th>الحسم</th>
                  <th>درجة السلوك</th>
                  <th>توزيع الدرجات</th>
                  <th style={{ textAlign: 'center' }}>تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {studentGroups.map(({ student, violations: vList }) => {
                  const totalDeduction = vList.reduce((s, v) => s + v.deduction, 0);
                  const behaviorScore = Math.max(0, 100 - totalDeduction);
                  const scoreColor = behaviorScore >= 80 ? '#15803d' : behaviorScore >= 60 ? '#ca8a04' : behaviorScore >= 40 ? '#ea580c' : '#dc2626';
                  return (
                    <tr key={student.studentId}>
                      <td style={{ fontWeight: 700 }}>{student.studentName}</td>
                      <td>{student.grade} ({student.className})</td>
                      <td style={{ fontWeight: 700 }}>{vList.length}</td>
                      <td style={{ fontWeight: 700, color: '#dc2626' }}>-{totalDeduction}</td>
                      <td><span style={{ fontWeight: 800, color: scoreColor }}>{behaviorScore}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1, 2, 3, 4, 5].map((d) => {
                            const count = vList.filter((v) => v.degree === d).length;
                            if (count === 0) return null;
                            const info = DEGREE_LABELS[d];
                            return <span key={d} style={{ padding: '2px 6px', borderRadius: '100px', fontSize: '11px', background: info.bg, color: info.color }}>د{d}:{count}</span>;
                          })}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => setDetailStudent({ studentId: student.studentId, studentName: student.studentName })}
                          style={{ padding: '4px 12px', background: '#eef2ff', color: '#4f46e5', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                          عرض
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {detailStudent && (
        <StudentDetailModal
          studentId={detailStudent.studentId}
          studentName={detailStudent.studentName}
          violations={violations.filter((v) => v.studentId === detailStudent.studentId)}
          onClose={() => setDetailStudent(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
};

// ============================================================
// Student Detail Modal
// ============================================================
const StudentDetailModal: React.FC<{
  studentId: number;
  studentName: string;
  violations: ViolationRow[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({ studentName, violations, onClose, onRefresh }) => {
  const totalDeduction = violations.reduce((s, v) => s + v.deduction, 0);
  const behaviorScore = Math.max(0, 100 - totalDeduction);

  const handleSendAll = async () => {
    const unsent = violations.filter((v) => !v.isSent);
    if (unsent.length === 0) { showError('جميع المخالفات تم إرسالها'); return; }
    try {
      const res = await violationsApi.sendWhatsAppBulk(unsent.map((v) => v.id));
      if (res.data?.data) {
        showSuccess(`تم إرسال ${res.data.data.sentCount} رسالة`);
        onRefresh();
      }
    } catch { showError('خطأ'); }
  };

  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const rows = violations.map((v) => {
      const deg = DEGREE_LABELS[v.degree] || DEGREE_LABELS[1];
      return `<tr><td>${v.hijriDate}</td><td>${v.description}</td><td>${deg.label}</td><td>${v.deduction}</td><td>${v.procedures}</td><td>${v.isSent ? 'نعم' : 'لا'}</td></tr>`;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl"><head><title>سجل مخالفات - ${studentName}</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f0f0f0}h2{text-align:center}@media print{body{padding:15px}}</style></head>
      <body><h2>سجل المخالفات السلوكية</h2>
      <p><strong>الطالب:</strong> ${studentName} | <strong>درجة السلوك:</strong> ${behaviorScore} | <strong>إجمالي الحسم:</strong> ${totalDeduction}</p>
      <table><thead><tr><th>التاريخ</th><th>المخالفة</th><th>الدرجة</th><th>الحسم</th><th>الإجراءات</th><th>إرسال</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #fef2f2, #fee2e2)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{studentName}</h3>
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '14px' }}>
              <span>المخالفات: <strong>{violations.length}</strong></span>
              <span>الحسم: <strong style={{ color: '#dc2626' }}>{totalDeduction}</strong></span>
              <span>السلوك: <strong style={{ color: behaviorScore >= 60 ? '#15803d' : '#dc2626' }}>{behaviorScore}</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={handleSendAll} style={{ padding: '6px 12px', background: '#25d366', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>📱 إرسال الكل</button>
            <button onClick={handlePrintAll} style={{ padding: '6px 12px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>🖨️ طباعة</button>
            <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Degree Summary */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((d) => {
              const count = violations.filter((v) => v.degree === d).length;
              const info = DEGREE_LABELS[d];
              return (
                <div key={d} style={{ padding: '8px 16px', borderRadius: '8px', background: count > 0 ? info.bg : '#f9fafb', border: `1px solid ${count > 0 ? info.color + '40' : '#e5e7eb'}`, textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: count > 0 ? info.color : '#d1d5db' }}>{count}</div>
                  <div style={{ fontSize: '12px', color: count > 0 ? info.color : '#9ca3af' }}>الدرجة {info.label}</div>
                </div>
              );
            })}
          </div>

          {/* Records */}
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المخالفة</th>
                <th>الدرجة</th>
                <th>الحسم</th>
                <th>الإجراءات</th>
                <th>الإرسال</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => {
                const deg = DEGREE_LABELS[v.degree] || DEGREE_LABELS[1];
                return (
                  <tr key={v.id}>
                    <td style={{ fontSize: '13px' }}>{v.hijriDate}</td>
                    <td>{v.description}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: deg.bg, color: deg.color }}>{deg.label}</span></td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>{v.deduction > 0 ? `-${v.deduction}` : '-'}</td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>{v.procedures}</td>
                    <td>{v.isSent ? <span style={{ color: '#15803d' }}>✅</span> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Positive Behavior Tab - السلوك المتمايز
// ============================================================
interface PosRecord {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string;
  grade: string;
  className: string;
  stage: string;
  behaviorType: string;
  degree: string;
  details: string;
  hijriDate: string;
  recordedBy: string;
  recordedAt: string;
  isSent: boolean;
}

const BADGE_LEVELS = [
  { min: 10, label: 'متميز', color: '#059669', bg: '#d1fae5', border: '#34d399' },
  { min: 5, label: 'جيد جداً', color: '#0d9488', bg: '#ccfbf1', border: '#5eead4' },
  { min: 3, label: 'جيد', color: '#0891b2', bg: '#cffafe', border: '#67e8f9' },
  { min: 1, label: 'بداية', color: '#3b82f6', bg: '#dbeafe', border: '#93c5fd' },
];

const getBadge = (count: number) => BADGE_LEVELS.find((b) => count >= b.min) || BADGE_LEVELS[BADGE_LEVELS.length - 1];

const PositiveTab: React.FC<{ stageFilter: string }> = ({ stageFilter }) => {
  const [records, setRecords] = useState<PosRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [detailStudent, setDetailStudent] = useState<{ id: number; name: string; records: PosRecord[] } | null>(null);

  useEffect(() => {
    setLoading(true);
    const stage = stageFilter === '__all__' ? undefined : (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter);
    positiveBehaviorApi.getAll(stage ? { stage } : undefined)
      .then((res) => { if (res.data?.data) setRecords(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stageFilter]);

  const filtered = useMemo(() => {
    let list = records;
    if (gradeFilter) list = list.filter((r) => r.grade === gradeFilter);
    if (classFilter) list = list.filter((r) => r.className === classFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.studentName.toLowerCase().includes(q) || r.studentNumber.includes(q));
    }
    return list;
  }, [records, gradeFilter, classFilter, search]);

  const studentGroups = useMemo(() => {
    const groups = new Map<number, { student: PosRecord; records: PosRecord[] }>();
    for (const r of filtered) {
      if (!groups.has(r.studentId)) groups.set(r.studentId, { student: r, records: [] });
      groups.get(r.studentId)!.records.push(r);
    }
    return Array.from(groups.values()).sort((a, b) =>
      `${a.student.grade}${a.student.className}`.localeCompare(`${b.student.grade}${b.student.className}`) || a.student.studentName.localeCompare(b.student.studentName, 'ar')
    );
  }, [filtered]);

  const grades = useMemo(() => Array.from(new Set(records.map((r) => r.grade))).sort(), [records]);
  const classes = useMemo(() => Array.from(new Set(records.filter((r) => !gradeFilter || r.grade === gradeFilter).map((r) => r.className))).sort(), [records, gradeFilter]);

  const totalDegrees = useMemo(() => {
    let sum = 0;
    for (const r of filtered) { const n = parseFloat(r.degree); if (!isNaN(n)) sum += n; }
    return sum;
  }, [filtered]);

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>;

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <StatCard label="إجمالي السجلات" value={filtered.length} color="#059669" />
        <StatCard label="عدد الطلاب" value={studentGroups.length} color="#0891b2" />
        <StatCard label="إجمالي الدرجات" value={totalDegrees} color="#7c3aed" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الطالب..."
          style={{ flex: 1, minWidth: '200px', height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }} />
        <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setClassFilter(''); }}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الصفوف</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          style={{ height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff' }}>
          <option value="">كل الفصول</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setViewMode('cards')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === 'cards' ? '#fff' : 'transparent', color: viewMode === 'cards' ? '#059669' : '#6b7280', fontWeight: 700, fontSize: '13px' }}>🎴 بطاقات</button>
          <button onClick={() => setViewMode('table')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? '#059669' : '#6b7280', fontWeight: 700, fontSize: '13px' }}>📋 جدول</button>
        </div>
      </div>

      {studentGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}>⭐</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد سجلات سلوك متمايز</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {studentGroups.map(({ student, records: recs }) => {
            const badge = getBadge(recs.length);
            const totalDeg = recs.reduce((s, r) => { const n = parseFloat(r.degree); return s + (isNaN(n) ? 0 : n); }, 0);
            return (
              <div key={student.studentId}
                onClick={() => setDetailStudent({ id: student.studentId, name: student.studentName, records: recs })}
                style={{
                  background: '#fff', borderRadius: '12px', border: `2px solid ${badge.border}`,
                  padding: '16px', cursor: 'pointer', transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#1f2937' }}>{student.studentName}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{student.grade} ({student.className})</div>
                  </div>
                  <span style={{
                    padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                  }}>{badge.label}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '12px', background: '#f0fdf4', color: '#059669' }}>
                    {recs.length} سلوك
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '12px', background: '#f5f3ff', color: '#7c3aed' }}>
                    الدرجات: {totalDeg}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>الطالب</th><th>الصف</th><th>السلوك المتمايز</th><th>الدرجة</th><th>المعلم</th><th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700, color: '#6b7280' }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{r.studentName}</td>
                    <td>{r.grade} ({r.className})</td>
                    <td>{r.behaviorType}</td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>
                        {r.degree}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: '#6b7280' }}>{r.recordedBy}</td>
                    <td style={{ fontSize: '13px' }}>{r.hijriDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '700px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>⭐ {detailStudent.name}</h3>
                <div style={{ fontSize: '14px', color: '#065f46', marginTop: '4px' }}>{detailStudent.records.length} سلوك متمايز</div>
              </div>
              <button onClick={() => setDetailStudent(null)} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              <table className="data-table">
                <thead><tr><th>السلوك</th><th>الدرجة</th><th>المعلم</th><th>التاريخ</th></tr></thead>
                <tbody>
                  {detailStudent.records.map((r) => (
                    <tr key={r.id}>
                      <td>{r.behaviorType}{r.details ? ` - ${r.details}` : ''}</td>
                      <td><span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>{r.degree}</span></td>
                      <td style={{ fontSize: '13px', color: '#6b7280' }}>{r.recordedBy}</td>
                      <td style={{ fontSize: '13px' }}>{r.hijriDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================================
// Compensation Tab - درجات التعويض
// ============================================================
const COMPENSATION_BEHAVIORS = [
  { label: 'الانضباط وعدم الغياب بدون عذر', code: '189' },
  { label: 'التعاون مع الزملاء والمعلمين وإدارة المدرسة', code: '1201017' },
  { label: 'خدمة المجتمع خارج المدرسة', code: '1601194' },
  { label: 'تقديم نشاط حواري', code: '1601195' },
  { label: 'المشاركة في حملة توعوية', code: '1601196' },
  { label: 'تقديم قصة نجاح', code: '1601197' },
  { label: 'الالتحاق ببرنامج أو دورة', code: '1601198' },
  { label: 'أنشطة مهارات التواصل', code: '1601199' },
  { label: 'مهارات القيادة والمسؤولية', code: '1601200' },
  { label: 'أنشطة المهارات الرقمية', code: '1601201' },
  { label: 'مهارات إدارة الوقت', code: '1601202' },
  { label: 'كتابة رسالة شكر', code: '1601203' },
  { label: 'تقديم إذاعة مدرسية', code: '1601204' },
  { label: 'اقتراح لتحسين المدرسة', code: '1601205' },
  { label: 'أخرى (بتوصية اللجنة)', code: '1601207' },
];

const CompensationTab: React.FC<{
  violations: ViolationRow[];
  stageFilter: string;
}> = ({ violations, stageFilter }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'compensated'>('all');
  const [posRecords, setPosRecords] = useState<PosRecord[]>([]);
  const [loadingPos, setLoadingPos] = useState(true);
  const [compensateModal, setCompensateModal] = useState<ViolationRow | null>(null);
  const [selectedBehavior, setSelectedBehavior] = useState(COMPENSATION_BEHAVIORS[0].label);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingPos(true);
    const stage = stageFilter === '__all__' ? undefined : (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter);
    positiveBehaviorApi.getAll(stage ? { stage } : undefined)
      .then((res) => { if (res.data?.data) setPosRecords(res.data.data); })
      .catch(() => {})
      .finally(() => setLoadingPos(false));
  }, [stageFilter]);

  // Only violations with deduction > 0
  const eligibleViolations = useMemo(() => violations.filter((v) => v.deduction > 0), [violations]);

  // Count compensation records per student
  const compensationCountByStudent = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of posRecords) {
      counts.set(r.studentId, (counts.get(r.studentId) || 0) + 1);
    }
    return counts;
  }, [posRecords]);

  // Track which violations are compensated (by order: each positive behavior compensates one violation)
  const compensatedSet = useMemo(() => {
    const set = new Set<number>();
    // Group violations by student, sorted by date
    const byStudent = new Map<number, ViolationRow[]>();
    for (const v of eligibleViolations) {
      if (!byStudent.has(v.studentId)) byStudent.set(v.studentId, []);
      byStudent.get(v.studentId)!.push(v);
    }
    Array.from(byStudent.entries()).forEach(([studentId, vList]) => {
      const compCount = compensationCountByStudent.get(studentId) || 0;
      const sorted = [...vList].sort((a, b) => a.hijriDate.localeCompare(b.hijriDate));
      for (let i = 0; i < Math.min(compCount, sorted.length); i++) {
        set.add(sorted[i].id);
      }
    });
    return set;
  }, [eligibleViolations, compensationCountByStudent]);

  const filtered = useMemo(() => {
    let list = eligibleViolations;
    if (statusFilter === 'pending') list = list.filter((v) => !compensatedSet.has(v.id));
    if (statusFilter === 'compensated') list = list.filter((v) => compensatedSet.has(v.id));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((v) => v.studentName.toLowerCase().includes(q) || v.studentNumber.includes(q));
    }
    return list;
  }, [eligibleViolations, compensatedSet, statusFilter, search]);

  const pendingCount = eligibleViolations.filter((v) => !compensatedSet.has(v.id)).length;
  const compensatedCount = eligibleViolations.filter((v) => compensatedSet.has(v.id)).length;
  const totalPoints = eligibleViolations.reduce((s, v) => s + v.deduction, 0);

  const handleCompensate = async () => {
    if (!compensateModal) return;
    setSaving(true);
    try {
      const res = await positiveBehaviorApi.add({
        studentId: compensateModal.studentId,
        behaviorType: selectedBehavior,
        degree: String(compensateModal.deduction),
        details: `تعويض عن مخالفة: ${compensateModal.description}`,
      });
      if (res.data?.success) {
        showSuccess('تم تسجيل التعويض بنجاح');
        setCompensateModal(null);
        // Reload positive records
        const stage = stageFilter === '__all__' ? undefined : (SETTINGS_STAGES.find((s) => s.name === stageFilter)?.id || stageFilter);
        const reload = await positiveBehaviorApi.getAll(stage ? { stage } : undefined);
        if (reload.data?.data) setPosRecords(reload.data.data);
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
    finally { setSaving(false); }
  };

  if (loadingPos) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>;

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <StatCard label="مخالفات بحسم" value={eligibleViolations.length} color="#4f46e5" />
        <StatCard label="إجمالي النقاط" value={totalPoints} color="#dc2626" />
        <StatCard label="بانتظار التعويض" value={pendingCount} color="#ea580c" />
        <StatCard label="تم التعويض" value={compensatedCount} color="#059669" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الطالب..."
          style={{ flex: 1, minWidth: '200px', height: '38px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px' }} />
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
          {[
            { id: 'all' as const, label: 'الكل' },
            { id: 'pending' as const, label: 'بانتظار' },
            { id: 'compensated' as const, label: 'تم التعويض' },
          ].map((f) => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: statusFilter === f.id ? '#fff' : 'transparent',
              color: statusFilter === f.id ? '#4f46e5' : '#6b7280', fontWeight: 700, fontSize: '13px',
              boxShadow: statusFilter === f.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
        عرض {filtered.length} من {eligibleViolations.length}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}>🏆</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد مخالفات قابلة للتعويض</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>الطالب</th><th>الصف/الفصل</th><th>المخالفة</th><th>الدرجة</th><th>الحسم</th><th>التاريخ</th><th>الحالة</th><th style={{ textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => {
                  const deg = DEGREE_LABELS[v.degree] || DEGREE_LABELS[1];
                  const isComp = compensatedSet.has(v.id);
                  return (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 700, color: '#6b7280' }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{v.studentName}</td>
                      <td>{v.grade} ({v.className})</td>
                      <td style={{ fontSize: '13px' }}>{v.description}</td>
                      <td><span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: deg.bg, color: deg.color }}>{deg.label}</span></td>
                      <td style={{ fontWeight: 700, color: '#dc2626' }}>-{v.deduction}</td>
                      <td style={{ fontSize: '13px' }}>{v.hijriDate}</td>
                      <td>
                        {isComp ? (
                          <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>تم التعويض</span>
                        ) : (
                          <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: '#ffedd5', color: '#ea580c' }}>بانتظار</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isComp ? (
                          <span style={{ color: '#9ca3af' }}>--</span>
                        ) : (
                          <button onClick={() => { setCompensateModal(v); setSelectedBehavior(COMPENSATION_BEHAVIORS[0].label); }}
                            style={{ padding: '4px 12px', background: '#d1fae5', color: '#059669', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                            تعويض
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compensate Modal */}
      {compensateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '500px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>🏆</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#065f46' }}>تعويض درجات</div>
                <div style={{ fontSize: '12px', color: '#047857' }}>{compensateModal.studentName} — {compensateModal.description}</div>
              </div>
              <button onClick={() => setCompensateModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#065f46' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '13px', color: '#991b1b' }}>المخالفة: <strong>{compensateModal.description}</strong></div>
                <div style={{ fontSize: '13px', color: '#991b1b' }}>الحسم: <strong>{compensateModal.deduction} درجة</strong></div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>السلوك التعويضي</label>
                <select value={selectedBehavior} onChange={(e) => setSelectedBehavior(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#f9fafb' }}>
                  {COMPENSATION_BEHAVIORS.map((b) => <option key={b.code} value={b.label}>{b.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: '16px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setCompensateModal(null)} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
              <button onClick={handleCompensate} disabled={saving} style={{
                padding: '8px 24px', background: '#059669', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              }}>{saving ? 'جاري الحفظ...' : '✓ تسجيل التعويض'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================================
// Reports Tab - التقارير
// ============================================================
const ReportsTab: React.FC<{
  violations: ViolationRow[];
  stageFilter: string;
}> = ({ violations, stageFilter }) => {
  const totalDeduction = violations.reduce((s, v) => s + v.deduction, 0);

  // Top students
  const topStudents = useMemo(() => {
    const groups = new Map<number, { name: string; grade: string; cls: string; count: number; deduction: number }>();
    for (const v of violations) {
      const g = groups.get(v.studentId) || { name: v.studentName, grade: v.grade, cls: v.className, count: 0, deduction: 0 };
      g.count++;
      g.deduction += v.deduction;
      groups.set(v.studentId, g);
    }
    return Array.from(groups.entries())
      .map(([id, g]) => ({ id, ...g, score: Math.max(0, 100 - g.deduction) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [violations]);

  // By class
  const byClass = useMemo(() => {
    const groups = new Map<string, number>();
    for (const v of violations) {
      const key = `${v.grade} (${v.className})`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    return Array.from(groups.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [violations]);

  // By degree
  const byDegree = useMemo(() =>
    [1, 2, 3, 4, 5].map((d) => ({
      degree: d,
      label: DEGREE_LABELS[d].label,
      count: violations.filter((v) => v.degree === d).length,
      deduction: violations.filter((v) => v.degree === d).reduce((s, v) => s + v.deduction, 0),
      color: DEGREE_LABELS[d].color,
      bg: DEGREE_LABELS[d].bg,
    })),
    [violations]
  );

  const maxByClass = Math.max(...byClass.map((c) => c.count), 1);

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const degreeRows = byDegree.map((d) => `<tr><td>${d.label}</td><td>${d.count}</td><td>${d.deduction}</td></tr>`).join('');
    const classRows = byClass.slice(0, 15).map((c) => `<tr><td>${c.name}</td><td>${c.count}</td></tr>`).join('');
    const studentRows = topStudents.map((s, i) => `<tr><td>${i + 1}</td><td>${s.name}</td><td>${s.grade} (${s.cls})</td><td>${s.count}</td><td>${s.deduction}</td><td>${s.score}</td></tr>`).join('');

    printWindow.document.write(`
      <html dir="rtl"><head><title>تقرير المخالفات</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:8px;text-align:right}th{background:#f0f0f0}h2,h3{text-align:center}@media print{body{padding:15px}}</style></head>
      <body><h2>تقرير المخالفات السلوكية</h2>
      <p style="text-align:center">إجمالي المخالفات: <strong>${violations.length}</strong> | إجمالي الحسم: <strong>${totalDeduction}</strong></p>
      <h3>التوزيع حسب الدرجة</h3>
      <table><thead><tr><th>الدرجة</th><th>العدد</th><th>الحسم</th></tr></thead><tbody>${degreeRows}</tbody></table>
      <h3>التوزيع حسب الفصل</h3>
      <table><thead><tr><th>الفصل</th><th>العدد</th></tr></thead><tbody>${classRows}</tbody></table>
      <h3>أكثر الطلاب مخالفات</h3>
      <table><thead><tr><th>#</th><th>الطالب</th><th>الصف</th><th>المخالفات</th><th>الحسم</th><th>السلوك</th></tr></thead><tbody>${studentRows}</tbody></table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={handlePrintReport} style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
          🖨️ طباعة التقرير
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="إجمالي المخالفات" value={violations.length} color="#4f46e5" />
        <StatCard label="إجمالي الحسم" value={totalDeduction} color="#dc2626" />
        {byDegree.filter((d) => d.count > 0).map((d) => (
          <StatCard key={d.degree} label={`الدرجة ${d.label}`} value={d.count} color={d.color} />
        ))}
      </div>

      {/* By Degree - bars */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>توزيع المخالفات حسب الدرجة</h4>
        {byDegree.map((d) => (
          <div key={d.degree} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ width: '70px', fontSize: '13px', fontWeight: 700, color: d.color }}>{d.label}</span>
            <div style={{ flex: 1, height: '24px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max((d.count / Math.max(...byDegree.map((x) => x.count), 1)) * 100, d.count > 0 ? 5 : 0)}%`, height: '100%', background: d.color, borderRadius: '6px', transition: 'width 0.5s' }} />
            </div>
            <span style={{ width: '40px', fontSize: '14px', fontWeight: 700, textAlign: 'left' }}>{d.count}</span>
          </div>
        ))}
      </div>

      {/* By Class - bars */}
      {byClass.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>المخالفات حسب الفصل</h4>
          {byClass.slice(0, 10).map((c) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <span style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#4b5563' }}>{c.name}</span>
              <div style={{ flex: 1, height: '20px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${(c.count / maxByClass) * 100}%`, height: '100%', background: '#6366f1', borderRadius: '6px' }} />
              </div>
              <span style={{ width: '30px', fontSize: '13px', fontWeight: 700, textAlign: 'left' }}>{c.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Students */}
      {topStudents.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>أكثر الطلاب مخالفات</h4>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الطالب</th>
                <th>الصف</th>
                <th>المخالفات</th>
                <th>الحسم</th>
                <th>السلوك</th>
              </tr>
            </thead>
            <tbody>
              {topStudents.map((s, i) => {
                const scoreColor = s.score >= 80 ? '#15803d' : s.score >= 60 ? '#ca8a04' : '#dc2626';
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700, color: '#6b7280' }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{s.name}</td>
                    <td>{s.grade} ({s.cls})</td>
                    <td style={{ fontWeight: 700 }}>{s.count}</td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>-{s.deduction}</td>
                    <td><span style={{ fontWeight: 800, color: scoreColor }}>{s.score}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// ============================================================
// Parent Meeting Modal (دعوة ولي أمر)
// ============================================================
const MEETING_TIMES = ['٧:٣٠ صباحاً', '٨:٠٠ صباحاً', '٨:٣٠ صباحاً', '٩:٠٠ صباحاً', '٩:٣٠ صباحاً', '١٠:٠٠ صباحاً', '١٠:٣٠ صباحاً', '١١:٠٠ صباحاً', '١١:٣٠ صباحاً', '١٢:٠٠ ظهراً'];
const MEETING_WITH = ['إدارة المدرسة', 'وكيل المدرسة', 'الموجه الطلابي'];
const DAY_NAMES_DAWAT = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

const DawatModal: React.FC<{ violation: ViolationRow; onClose: () => void }> = ({ violation, onClose }) => {
  // Default to next working day
  const getNextWorkday = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  };
  const nextDay = getNextWorkday();
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const [day, setDay] = useState(dayNames[nextDay.getDay()]);
  const [date, setDate] = useState(nextDay.toISOString().split('T')[0]);
  const [time, setTime] = useState('٩:٠٠ صباحاً');
  const [meetingWith, setMeetingWith] = useState('وكيل المدرسة');
  const [reason, setReason] = useState('لمناقشة المستوى السلوكي للطالب');

  const getHijriDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }) + ' هـ';
    } catch { return ''; }
  };

  const handlePrint = () => {
    const hijri = getHijriDate(date);
    const degreeInfo = DEGREE_LABELS[violation.degree] || DEGREE_LABELS[1];
    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(`<html dir="rtl"><head><title>دعوة ولي أمر</title>
      <style>body{font-family:Tahoma,'IBM Plex Sans Arabic',Arial;padding:40px;direction:rtl}h2{text-align:center;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #333;padding:10px;text-align:right}th{background:#f0f0f0}.signature{margin-top:60px;display:flex;justify-content:space-between}.signature div{text-align:center;width:30%}.signature div span{display:block;margin-top:40px;border-top:1px solid #333;padding-top:5px}@media print{body{padding:20px}}</style></head><body>
      <h2>دعوة ولي أمر طالب</h2>
      <p style="text-align:center;font-size:16px">المكرم ولي أمر الطالب / <strong>${violation.studentName}</strong></p>
      <p style="text-align:center">السلام عليكم ورحمة الله وبركاته</p>
      <p>يسرنا دعوتكم لزيارة المدرسة وذلك للأسباب التالية:</p>
      <table>
        <tr><th>اسم الطالب</th><td>${violation.studentName}</td><th>رقم الطالب</th><td>${violation.studentNumber}</td></tr>
        <tr><th>الصف</th><td>${violation.grade}</td><th>الفصل</th><td>${violation.className}</td></tr>
        <tr><th>المخالفة</th><td colspan="3">${violation.description}</td></tr>
        <tr><th>الدرجة</th><td>${degreeInfo.label}</td><th>الحسم</th><td>${violation.deduction} درجة</td></tr>
      </table>
      <table>
        <tr><th>يوم الزيارة</th><td>${day}</td><th>التاريخ</th><td>${hijri}</td></tr>
        <tr><th>الساعة</th><td>${time}</td><th>لمقابلة</th><td>${meetingWith}</td></tr>
        <tr><th>الهدف من الزيارة</th><td colspan="3">${reason}</td></tr>
      </table>
      <p style="margin-top:20px">نأمل الحضور في الموعد المحدد، ولكم جزيل الشكر والتقدير.</p>
      <div class="signature">
        <div>ولي الأمر<span>التوقيع</span></div>
        <div>وكيل شؤون الطلاب<span>التوقيع</span></div>
        <div>مدير المدرسة<span>التوقيع</span></div>
      </div>
      </body></html>`);
    pw.document.close();
    pw.print();
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '480px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>📨</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>دعوة ولي أمر طالب</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}>{violation.studentName} — {violation.grade}/{violation.className}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px', display: 'block' }}>اليوم</label>
              <select value={day} onChange={(e) => setDay(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#f9fafb' }}>
                {DAY_NAMES_DAWAT.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px', display: 'block' }}>التاريخ</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#f9fafb', boxSizing: 'border-box' }} />
              <div style={{ fontSize: '13px', color: '#059669', fontWeight: 700, marginTop: '4px', textAlign: 'center' }}>{getHijriDate(date)}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px', display: 'block' }}>الساعة</label>
              <select value={time} onChange={(e) => setTime(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#f9fafb' }}>
                {MEETING_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px', display: 'block' }}>وذلك لمقابلة</label>
              <select value={meetingWith} onChange={(e) => setMeetingWith(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#f9fafb' }}>
                {MEETING_WITH.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px', display: 'block' }}>الهدف من الزيارة</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#f9fafb', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ padding: '16px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
          <button onClick={handlePrint} style={{ padding: '8px 24px', background: '#d97706', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>🖨️ طباعة الدعوة</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Shared Components
// ============================================================
const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{
    background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  }}>
    <span style={{ fontSize: '24px', fontWeight: 800, color }}>{value}</span>
    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
  </div>
);

const FilterBtn: React.FC<{ label: string; count: number; active: boolean; onClick: () => void }> = ({ label, count, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '6px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
    background: active ? '#fff' : 'transparent',
    color: active ? '#dc2626' : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    border: 'none', cursor: 'pointer',
  }}>
    {label} <span style={{ fontSize: '12px', color: active ? '#ef4444' : '#9ca3af' }}>({count})</span>
  </button>
);

const ActionBtn: React.FC<{ icon: string; title: string; color: string; onClick: () => void; disabled?: boolean }> = ({ icon, title, color, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} title={title} style={{
    padding: '4px 6px', background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '14px', opacity: disabled ? 0.5 : 1,
  }}>
    {icon}
  </button>
);

const ConfirmModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void }> = ({ title, message, onConfirm, onCancel }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '400px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: '0 0 24px', color: '#4b5563' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={onConfirm} style={{ padding: '8px 24px', background: '#dc2626', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>تأكيد</button>
      </div>
    </div>
  </div>
);

// ============================================================
// Add Violation Modal
// ============================================================
interface AddViolationModalProps {
  stages: StageConfigData[];
  onClose: () => void;
  onSaved: () => void;
}

const AddViolationModal: React.FC<AddViolationModalProps> = ({ stages, onClose, onSaved }) => {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [degree, setDegree] = useState(1);
  const [description, setDescription] = useState('');
  const [violationType, setViolationType] = useState('InPerson');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [repInfo, setRepInfo] = useState<RepetitionInfo | null>(null);
  const [violationTypes, setViolationTypes] = useState<{ id: number; code: string; description: string; degree: number }[]>([]);

  useEffect(() => {
    Promise.all([
      studentsApi.getAll(),
      violationsApi.getTypes(),
    ]).then(([sRes, tRes]) => {
      if (sRes.data?.data) setStudents(sRes.data.data);
      if (tRes.data?.data) setViolationTypes(tRes.data.data);
    });
  }, []);

  useEffect(() => {
    if (!selectedStudent) { setRepInfo(null); return; }
    violationsApi.getRepetition(selectedStudent.id, degree).then((res) => {
      if (res.data?.data) setRepInfo(res.data.data);
    });
  }, [selectedStudent, degree]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return students.slice(0, 20);
    const q = studentSearch.toLowerCase();
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) || s.studentNumber.includes(q)
    ).slice(0, 20);
  }, [students, studentSearch]);

  const filteredViolTypes = useMemo(() =>
    violationTypes.filter((t) => t.degree === degree),
    [violationTypes, degree]
  );

  const handleSave = async () => {
    if (!selectedStudent) { showError('يرجى اختيار الطالب'); return; }
    if (!description.trim()) { showError('وصف المخالفة مطلوب'); return; }

    setSaving(true);
    const data: ViolationData = {
      studentId: selectedStudent.id,
      description: description.trim(),
      type: violationType,
      degree,
      notes: notes.trim(),
    };

    try {
      const res = await violationsApi.add(data);
      if (res.data?.success) {
        const result = res.data.data;
        showSuccess(`تم تسجيل المخالفة - التكرار: ${result?.repetition || ''} | الحسم: ${result?.deduction || 0}`);
        onSaved();
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', background: 'linear-gradient(to left, #fef2f2, #fee2e2)', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>تسجيل مخالفة سلوكية</h3>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Student Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>اختر الطالب *</label>
            {selectedStudent ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0',
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#15803d' }}>{selectedStudent.name}</span>
                  <span style={{ fontSize: '13px', color: '#6b7280', marginRight: '8px' }}>
                    {selectedStudent.grade} ({selectedStudent.className})
                  </span>
                </div>
                <button onClick={() => setSelectedStudent(null)} style={{ padding: '4px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                  تغيير
                </button>
              </div>
            ) : (
              <>
                <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الطالب..."
                  style={{ width: '100%', height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px' }} />
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  {filteredStudents.map((s) => (
                    <div key={s.id} onClick={() => setSelectedStudent(s)} style={{
                      padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{s.grade} ({s.className})</span>
                    </div>
                  ))}
                  {filteredStudents.length === 0 && (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>لا توجد نتائج</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Degree */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>درجة المخالفة *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((d) => {
                const info = DEGREE_LABELS[d];
                const isActive = degree === d;
                return (
                  <button key={d} onClick={() => setDegree(d)} style={{
                    flex: 1, padding: '10px 8px', borderRadius: '8px',
                    background: isActive ? info.bg : '#f9fafb',
                    color: isActive ? info.color : '#6b7280',
                    border: isActive ? `2px solid ${info.color}` : '1px solid #e5e7eb',
                    fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                  }}>
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Repetition Info */}
          {repInfo && (
            <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px 16px', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: '#6b7280' }}>التكرار: </span>
                  <span style={{ fontWeight: 700, color: '#1e40af' }}>{repInfo.nextRepetition}</span>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>الحسم التلقائي: </span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>{repInfo.deduction} درجة</span>
                </div>
              </div>
              {repInfo.procedures.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>الإجراءات:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {repInfo.procedures.map((p, i) => (
                      <span key={i} style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', fontSize: '12px', borderRadius: '4px' }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Violation Type Selector */}
          {filteredViolTypes.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>نص المخالفة (من القائمة)</label>
              <select onChange={(e) => { if (e.target.value) setDescription(e.target.value); }}
                style={{ width: '100%', height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', background: '#fff', boxSizing: 'border-box' }}>
                <option value="">اختر من القائمة...</option>
                {filteredViolTypes.map((t) => (
                  <option key={t.id} value={t.description}>{t.code} - {t.description}</option>
                ))}
              </select>
            </div>
          )}

          {/* Type */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>نوع المخالفة</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <button key={key} onClick={() => setViolationType(key)} style={{
                  flex: 1, padding: '8px', borderRadius: '8px',
                  background: violationType === key ? '#eef2ff' : '#f9fafb',
                  color: violationType === key ? '#4338ca' : '#6b7280',
                  border: violationType === key ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                  fontWeight: 600, cursor: 'pointer', fontSize: '13px',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>وصف المخالفة *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="وصف المخالفة..."
              style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>ملاحظات</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية (اختياري)"
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 24px', background: '#dc2626', color: '#fff',
            borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'جاري التسجيل...' : 'تسجيل المخالفة'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViolationsPage;
