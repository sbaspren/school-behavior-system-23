import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { parentExcuseApi, ParentExcuseRow } from '../api/parentExcuse';
import { settingsApi, StageConfigData } from '../api/settings';
import { showSuccess, showError } from '../components/shared/Toast';
import { SETTINGS_STAGES } from '../utils/constants';

const STATUS_OPTIONS = ['معلق', 'مقبول', 'مرفوض'];
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'معلق': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'مقبول': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'مرفوض': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

const ParentExcusePage: React.FC = () => {
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [currentStage, setCurrentStage] = useState('');
  const [excuses, setExcuses] = useState<ParentExcuseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('معلق');
  const [selectedExcuse, setSelectedExcuse] = useState<ParentExcuseRow | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const enabledStages = useMemo(() =>
    stages.filter(s => s.isEnabled && s.grades.some(g => g.isEnabled && g.classCount > 0)),
    [stages]
  );

  useEffect(() => {
    settingsApi.getStructure().then(res => {
      if (res.data?.data?.stages) {
        const st = Array.isArray(res.data.data.stages) ? res.data.data.stages : [];
        setStages(st);
        const enabled = st.filter((s: StageConfigData) => s.isEnabled && s.grades.some((g: { isEnabled: boolean; classCount: number }) => g.isEnabled && g.classCount > 0));
        if (enabled.length > 0) setCurrentStage(enabled[0].stage);
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!currentStage) return;
    setLoading(true);
    try {
      const res = await parentExcuseApi.getAll(currentStage, statusFilter || undefined);
      if (res.data?.data) setExcuses(res.data.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [currentStage, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const pendingCount = useMemo(() => excuses.filter(e => e.status === 'معلق').length, [excuses]);

  const handleAction = useCallback(async (id: number, status: string) => {
    setActionLoading(true);
    try {
      await parentExcuseApi.updateStatus(id, status, actionNotes);
      showSuccess(status === 'مقبول' ? 'تم قبول العذر' : 'تم رفض العذر');
      setSelectedExcuse(null);
      setActionNotes('');
      loadData();
    } catch { showError('فشل التحديث'); }
    finally { setActionLoading(false); }
  }, [actionNotes, loadData]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('هل تريد حذف هذا العذر نهائيا؟')) return;
    try {
      await parentExcuseApi.delete(id);
      showSuccess('تم الحذف');
      setSelectedExcuse(null);
      loadData();
    } catch { showError('فشل الحذف'); }
  }, [loadData]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
            <span className="material-symbols-outlined text-3xl text-purple-600">mail</span>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">أعذار أولياء الأمور</h2>
            <div className="flex gap-2 items-center mt-1">
              {enabledStages.map(s => {
                const info = SETTINGS_STAGES.find(x => x.id === s.stage);
                return (
                  <button key={s.stage} onClick={() => setCurrentStage(s.stage)}
                    className={`text-xs px-3 py-1 rounded-full font-bold transition-all ${currentStage === s.stage
                      ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {info?.name || s.stage}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-xs text-gray-500">معلق</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-bold text-purple-600">{excuses.length}</div>
            <div className="text-xs text-gray-500">اجمالي</div>
          </div>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setStatusFilter('')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!statusFilter ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          الكل
        </button>
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusFilter === s ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8">
          <span className="material-symbols-outlined animate-spin text-purple-500 text-4xl">sync</span>
          <p className="text-gray-500 mt-2">جاري التحميل...</p>
        </div>
      )}

      {!loading && excuses.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300">inbox</span>
          <p className="text-gray-400 mt-3 text-lg">لا توجد أعذار {statusFilter || ''}</p>
        </div>
      )}

      {!loading && excuses.length > 0 && (
        <div className="space-y-3">
          {excuses.map(excuse => {
            const sc = STATUS_COLORS[excuse.status] || STATUS_COLORS['معلق'];
            return (
              <div key={excuse.id} onClick={() => setSelectedExcuse(excuse)}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${excuse.status === 'معلق' ? 'border-amber-200 border-r-4 border-r-amber-400' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-purple-400">person</span>
                    <div>
                      <span className="font-bold text-gray-800">{excuse.studentName}</span>
                      <span className="text-xs text-gray-400 mr-2">{excuse.grade} / فصل {excuse.class}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text} border ${sc.border}`}>
                    {excuse.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{excuse.excuseText}</p>
                <div className="flex gap-4 text-xs text-gray-400">
                  {excuse.absenceDate && <span>تاريخ الغياب: {excuse.absenceDate}</span>}
                  <span>تاريخ التقديم: {formatDate(excuse.submittedAt)}</span>
                  {excuse.attachments !== 'لا' && (
                    <span className="text-green-600 font-bold">مرفقات</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedExcuse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedExcuse(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="p-5 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900">{selectedExcuse.studentName}</h3>
                  <p className="text-sm text-gray-500">{selectedExcuse.grade} / فصل {selectedExcuse.class} | رقم: {selectedExcuse.studentNumber}</p>
                </div>
                <button onClick={() => setSelectedExcuse(null)} className="text-gray-400 hover:text-gray-600">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-500">الحالة:</span>
                {(() => {
                  const sc = STATUS_COLORS[selectedExcuse.status] || STATUS_COLORS['معلق'];
                  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text} border ${sc.border}`}>{selectedExcuse.status}</span>;
                })()}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400">تاريخ الغياب</div>
                  <div className="font-bold text-gray-800">{selectedExcuse.absenceDate || '-'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400">تاريخ التقديم</div>
                  <div className="font-bold text-gray-800">{formatDate(selectedExcuse.submittedAt)}</div>
                </div>
              </div>

              {/* Excuse text */}
              <div>
                <div className="text-sm font-bold text-gray-500 mb-2">نص العذر:</div>
                <div className="bg-purple-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed border border-purple-100">
                  {selectedExcuse.excuseText}
                </div>
              </div>

              {/* Attachments */}
              {selectedExcuse.attachments !== 'لا' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="material-symbols-outlined text-green-500">attachment</span>
                  <span className="text-sm font-bold text-green-700">{selectedExcuse.attachments}</span>
                </div>
              )}

              {/* School notes */}
              {selectedExcuse.schoolNotes && (
                <div>
                  <div className="text-sm font-bold text-gray-500 mb-2">ملاحظات المدرسة:</div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">{selectedExcuse.schoolNotes}</div>
                </div>
              )}

              {/* Action area (only for pending) */}
              {selectedExcuse.status === 'معلق' && (
                <div className="border-t pt-4">
                  <div className="text-sm font-bold text-gray-500 mb-2">ملاحظات (اختياري):</div>
                  <textarea value={actionNotes} onChange={e => setActionNotes(e.target.value)}
                    placeholder="اكتب ملاحظة للسجل..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20 focus:ring-2 focus:ring-purple-300 focus:border-purple-400" />
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => handleAction(selectedExcuse.id, 'مقبول')} disabled={actionLoading}
                      className="flex-1 bg-green-500 text-white px-4 py-3 rounded-lg font-bold hover:bg-green-600 transition-all disabled:opacity-50">
                      قبول العذر
                    </button>
                    <button onClick={() => handleAction(selectedExcuse.id, 'مرفوض')} disabled={actionLoading}
                      className="flex-1 bg-red-500 text-white px-4 py-3 rounded-lg font-bold hover:bg-red-600 transition-all disabled:opacity-50">
                      رفض العذر
                    </button>
                  </div>
                </div>
              )}

              {/* Delete button */}
              <button onClick={() => handleDelete(selectedExcuse.id)}
                className="w-full border border-red-200 text-red-500 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition-all">
                حذف العذر نهائيا
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentExcusePage;
