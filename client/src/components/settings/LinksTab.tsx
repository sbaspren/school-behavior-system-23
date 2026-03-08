import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usersApi } from '../../api/users';
import { teachersApi } from '../../api/teachers';
import { showSuccess, showError } from '../shared/Toast';

interface PersonLink {
  id: number;
  name: string;
  role: string;
  mobile: string;
  tokenLink: string;
  assignedClasses: string;
  type: 'admin' | 'teacher';
}

const LinksTab: React.FC = () => {
  const [persons, setPersons] = useState<PersonLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'teachers' | 'admins' | 'linked' | 'not-linked'>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [confirmAction, setConfirmAction] = useState<{
    title: string; message: string; color: string; onConfirm: () => void;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, teachersRes] = await Promise.all([
        usersApi.getAll(),
        teachersApi.getAll(),
      ]);

      const all: PersonLink[] = [];

      if (usersRes.data?.data) {
        usersRes.data.data.forEach((u: any) => {
          all.push({
            id: u.id,
            name: u.name,
            role: u.permissions || u.role || '',
            mobile: u.mobile || '',
            tokenLink: u.tokenLink || '',
            assignedClasses: u.scopeValue || '',
            type: 'admin',
          });
        });
      }

      if (teachersRes.data?.data) {
        teachersRes.data.data.forEach((t: any) => {
          all.push({
            id: t.id,
            name: t.name,
            role: 'معلم',
            mobile: t.mobile || '',
            tokenLink: t.tokenLink || '',
            assignedClasses: t.assignedClasses || '',
            type: 'teacher',
          });
        });
      }

      setPersons(all);
      setSelectedIds(new Set());
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const teachers = useMemo(() => persons.filter((p) => p.type === 'teacher'), [persons]);
  const admins = useMemo(() => persons.filter((p) => p.type === 'admin'), [persons]);
  const linkedTeachers = teachers.filter((t) => !!t.tokenLink).length;
  const linkedAdmins = admins.filter((a) => !!a.tokenLink).length;

  const filteredPersons = useMemo(() => {
    let list = persons;
    if (filter === 'teachers') list = teachers;
    else if (filter === 'admins') list = admins;
    else if (filter === 'linked') list = persons.filter((p) => !!p.tokenLink);
    else if (filter === 'not-linked') list = persons.filter((p) => !p.tokenLink);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.mobile.includes(q));
    }
    return list;
  }, [persons, teachers, admins, filter, search]);

  const filteredTeachers = filteredPersons.filter((p) => p.type === 'teacher');
  const filteredAdmins = filteredPersons.filter((p) => p.type === 'admin');

  const copyLink = (person: PersonLink) => {
    const url = `${window.location.origin}/form/${person.tokenLink}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(person.id);
      showSuccess(`تم نسخ رابط ${person.name}`);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // ★ إرسال الرابط عبر واتساب — مطابق للأصلي sendLinkToPersonDirect
  const sendViaWhatsApp = (person: PersonLink) => {
    if (!person.tokenLink) { showError('أنشئ الرابط أولاً'); return; }
    if (!person.mobile) { showError(`لا يوجد جوال لـ ${person.name}`); return; }

    const url = `${window.location.origin}/form/${person.tokenLink}`;
    // تحويل الجوال إلى تنسيق دولي (05XXXXXXXX → 9665XXXXXXXX)
    let mobile = person.mobile.replace(/\s|-/g, '');
    if (mobile.startsWith('0')) mobile = '966' + mobile.slice(1);
    else if (mobile.startsWith('+')) mobile = mobile.slice(1);

    const msg = encodeURIComponent(`مرحباً ${person.name}،\nهذا رابط نموذج الإدخال الخاص بك:\n${url}`);
    window.open(`https://wa.me/${mobile}?text=${msg}`, '_blank');
  };

  const createLink = async (person: PersonLink) => {
    try {
      const api = person.type === 'teacher' ? teachersApi : usersApi;
      const res = await api.createLink(person.id);
      if (res.data?.success) {
        showSuccess(`تم إنشاء رابط ${person.name}`);
        loadData();
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
  };

  const removeLink = async (person: PersonLink) => {
    try {
      const api = person.type === 'teacher' ? teachersApi : usersApi;
      const res = await api.removeLink(person.id);
      if (res.data?.success) {
        showSuccess(`تم إلغاء ربط ${person.name}`);
        loadData();
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
  };

  const createAllLinks = async (type: 'teacher' | 'admin') => {
    setBulkCreating(true);
    try {
      const api = type === 'teacher' ? teachersApi : usersApi;
      const res = await api.createAllLinks();
      if (res.data?.success) {
        const d = res.data.data;
        showSuccess(`تم إنشاء ${d.created} رابط جديد`);
        loadData();
      } else showError(res.data?.message || 'خطأ');
    } catch { showError('خطأ في الاتصال'); }
    finally { setBulkCreating(false); }
  };

  const createSelectedLinks = async () => {
    const selected = persons.filter((p) => selectedIds.has(`${p.type}_${p.id}`) && !p.tokenLink);
    if (selected.length === 0) { showError('لم يتم تحديد أحد'); return; }

    setBulkCreating(true);
    setBulkProgress({ done: 0, total: selected.length });

    let done = 0;
    let failed = 0;
    for (const person of selected) {
      try {
        const api = person.type === 'teacher' ? teachersApi : usersApi;
        const res = await api.createLink(person.id);
        if (!res.data?.success) failed++;
      } catch { failed++; }
      done++;
      setBulkProgress({ done, total: selected.length });
    }

    setBulkCreating(false);
    setSelectedIds(new Set());
    const msg = `تم إنشاء ${done - failed} رابط` + (failed > 0 ? ` (فشل ${failed})` : '');
    if (failed > 0) showError(msg); else showSuccess(msg);
    loadData();
  };

  const toggleSelect = (person: PersonLink) => {
    const key = `${person.type}_${person.id}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = (type: 'teacher' | 'admin') => {
    const unlinked = persons.filter((p) => p.type === type && !p.tokenLink);
    const keys = unlinked.map((p) => `${p.type}_${p.id}`);
    const allSelected = keys.every((k) => selectedIds.has(k));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div className="spinner" />
        <p style={{ color: '#666', marginTop: '16px' }}>جاري تحميل بيانات الروابط...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <span style={{ color: '#6366f1' }}>🔗</span>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>إدارة روابط النماذج</h3>
      </div>

      {/* Info Box */}
      <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '16px', border: '1px solid #bfdbfe', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1e40af' }}>ما هي روابط النماذج؟</p>
        <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#1e40af' }}>
          روابط فريدة لكل شخص تمكنه من إدخال البيانات عبر الجوال. كل رابط جديد يلغي القديم تلقائياً.
        </p>
        <div style={{ fontSize: '12px', color: '#3b82f6' }}>
          <div><strong>المعلمين:</strong> غياب، مخالفات، ملاحظات تربوية، سلوك متمايز</div>
          <div><strong>الإداريين:</strong> تأخر، استئذان</div>
          <div><strong>الحارس:</strong> عرض المستأذنين</div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث..."
          style={{ flex: 1, height: '40px', padding: '0 16px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }}
        />
        <select
          value={filter} onChange={(e) => setFilter(e.target.value as any)}
          style={{ height: '40px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', background: '#fff', fontSize: '14px' }}
        >
          <option value="all">الكل</option>
          <option value="teachers">المعلمين</option>
          <option value="admins">الإداريين</option>
          <option value="linked">المربوطين</option>
          <option value="not-linked">غير المربوطين</option>
        </select>
      </div>

      {/* Bulk Progress */}
      {bulkCreating && (
        <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: '#15803d' }}>جاري إنشاء الروابط...</span>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>{bulkProgress.done}/{bulkProgress.total}</span>
          </div>
          <div style={{ background: '#dcfce7', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              width: bulkProgress.total > 0 ? `${(bulkProgress.done / bulkProgress.total) * 100}%` : '0%',
              height: '100%', background: '#22c55e', borderRadius: '8px', transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Teachers Section */}
      {(filter === 'all' || filter === 'teachers' || filter === 'linked' || filter === 'not-linked') && filteredTeachers.length > 0 && (
        <PersonSection
          title="روابط المعلمين"
          icon="👨‍🏫"
          gradientFrom="#eef2ff" gradientTo="#e0e7ff"
          total={teachers.length} linked={linkedTeachers}
          persons={filteredTeachers}
          selectedIds={selectedIds}
          copiedId={copiedId}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={() => toggleSelectAll('teacher')}
          onCopy={copyLink}
          onSendWhatsApp={sendViaWhatsApp}
          onCreate={(p) => createLink(p)}
          onRemove={(p) => setConfirmAction({
            title: 'إلغاء الربط',
            message: `هل تريد إلغاء ربط "${p.name}"؟ سيتم حذف الرابط ولن يتمكن من الوصول للنموذج`,
            color: '#dc2626',
            onConfirm: () => { removeLink(p); setConfirmAction(null); },
          })}
          onCreateAll={() => setConfirmAction({
            title: 'إنشاء روابط للجميع',
            message: `سيتم إنشاء روابط جديدة لجميع المعلمين غير المربوطين`,
            color: '#16a34a',
            onConfirm: () => { createAllLinks('teacher'); setConfirmAction(null); },
          })}
          disabled={bulkCreating}
        />
      )}

      {/* Admins Section */}
      {(filter === 'all' || filter === 'admins' || filter === 'linked' || filter === 'not-linked') && filteredAdmins.length > 0 && (
        <PersonSection
          title="روابط الهيئة الإدارية"
          icon="🏛️"
          gradientFrom="#fffbeb" gradientTo="#fef3c7"
          total={admins.length} linked={linkedAdmins}
          persons={filteredAdmins}
          selectedIds={selectedIds}
          copiedId={copiedId}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={() => toggleSelectAll('admin')}
          onCopy={copyLink}
          onSendWhatsApp={sendViaWhatsApp}
          onCreate={(p) => createLink(p)}
          onRemove={(p) => setConfirmAction({
            title: 'إلغاء الربط',
            message: `هل تريد إلغاء ربط "${p.name}"؟`,
            color: '#dc2626',
            onConfirm: () => { removeLink(p); setConfirmAction(null); },
          })}
          onCreateAll={() => setConfirmAction({
            title: 'إنشاء روابط للجميع',
            message: `سيتم إنشاء روابط جديدة لجميع الإداريين غير المربوطين`,
            color: '#16a34a',
            onConfirm: () => { createAllLinks('admin'); setConfirmAction(null); },
          })}
          disabled={bulkCreating}
        />
      )}

      {/* Selected bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#4f46e5', color: '#fff', padding: '12px 24px', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(79,70,229,0.4)', display: 'flex', alignItems: 'center', gap: '16px',
          zIndex: 40, fontWeight: 700,
        }}>
          <span>{selectedIds.size} محدد</span>
          <button onClick={createSelectedLinks} disabled={bulkCreating} style={{
            padding: '8px 20px', background: '#fff', color: '#4f46e5', borderRadius: '8px',
            fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '14px',
          }}>
            إنشاء للمحددين
          </button>
          <button onClick={() => setSelectedIds(new Set())} style={{
            padding: '8px 12px', background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px',
            border: 'none', cursor: 'pointer', fontSize: '14px',
          }}>
            إلغاء
          </button>
        </div>
      )}

      {/* Empty state */}
      {filteredPersons.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px' }}>🔗</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا توجد نتائج</p>
          <p style={{ fontSize: '14px' }}>أضف أعضاء في الهيئة الإدارية أو المعلمين أولاً</p>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>{confirmAction.title}</h3>
            <p style={{ margin: '0 0 24px', color: '#4b5563', fontSize: '14px' }}>{confirmAction.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => setConfirmAction(null)} style={{ padding: '8px 20px', color: '#4b5563', background: '#f3f4f6', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: 700 }}>إلغاء</button>
              <button onClick={confirmAction.onConfirm} style={{ padding: '8px 24px', background: confirmAction.color, color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>تأكيد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Person Section (Teachers / Admins)
// ============================================================
interface PersonSectionProps {
  title: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  total: number;
  linked: number;
  persons: PersonLink[];
  selectedIds: Set<string>;
  copiedId: number | null;
  onToggleSelect: (p: PersonLink) => void;
  onToggleSelectAll: () => void;
  onCopy: (p: PersonLink) => void;
  onSendWhatsApp: (p: PersonLink) => void;
  onCreate: (p: PersonLink) => void;
  onRemove: (p: PersonLink) => void;
  onCreateAll: () => void;
  disabled: boolean;
}

const PersonSection: React.FC<PersonSectionProps> = ({
  title, icon, gradientFrom, gradientTo, total, linked,
  persons, selectedIds, copiedId,
  onToggleSelect, onToggleSelectAll, onCopy, onSendWhatsApp, onCreate, onRemove, onCreateAll, disabled,
}) => {
  const unlinked = persons.filter((p) => !p.tokenLink);
  const type = persons[0]?.type || 'teacher';
  const allUnlinkedSelected = unlinked.length > 0 && unlinked.every((p) => selectedIds.has(`${p.type}_${p.id}`));

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '24px' }}>
      {/* Section Header */}
      <div style={{ background: `linear-gradient(to left, ${gradientFrom}, ${gradientTo})`, padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{icon}</span>
            <h4 style={{ margin: 0, fontWeight: 700, color: '#1f2937' }}>{title}</h4>
            <span style={{ padding: '2px 8px', background: type === 'teacher' ? '#e0e7ff' : '#fef3c7', color: type === 'teacher' ? '#4338ca' : '#92400e', fontSize: '12px', borderRadius: '9999px', fontWeight: 700 }}>{total}</span>
            <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#15803d', fontSize: '12px', borderRadius: '9999px', fontWeight: 700 }}>{linked} مفعّل</span>
          </div>
          <button onClick={onCreateAll} disabled={disabled} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            background: '#16a34a', color: '#fff', borderRadius: '8px', fontSize: '14px',
            fontWeight: 700, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
          }}>
            ⚡ إنشاء للجميع
          </button>
        </div>
      </div>

      {/* Select All */}
      {unlinked.length > 1 && (
        <div style={{ padding: '8px 20px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#6b7280' }}>
            <input type="checkbox" checked={allUnlinkedSelected} onChange={onToggleSelectAll} />
            تحديد الكل غير المربوطين
          </label>
        </div>
      )}

      {/* Person Cards */}
      <div style={{ padding: '12px', maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {persons.map((person) => {
          const isLinked = !!person.tokenLink;
          const isSelected = selectedIds.has(`${person.type}_${person.id}`);
          const isCopied = copiedId === person.id;

          return (
            <div key={`${person.type}_${person.id}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: '#fff', borderRadius: '10px',
              border: `1px solid ${isLinked ? '#bbf7d0' : '#e5e7eb'}`,
              borderRight: isLinked ? '4px solid #22c55e' : undefined,
              transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {!isLinked && (
                  <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(person)} />
                )}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: getPersonBg(person), display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px',
                }}>
                  {getPersonIcon(person)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1f2937' }}>{person.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{person.mobile || 'بدون جوال'}</div>
                  {person.role && person.type === 'admin' && (
                    <div style={{ fontSize: '11px', color: '#6366f1' }}>{person.role}</div>
                  )}
                  {isLinked && (
                    <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>✓ مربوط</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isLinked ? (
                  <>
                    <button onClick={() => onCopy(person)} style={{
                      padding: '8px 14px', background: isCopied ? '#dcfce7' : '#eef2ff',
                      color: isCopied ? '#15803d' : '#4338ca',
                      borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '13px',
                    }}>
                      {isCopied ? '✓ تم' : '📋 نسخ'}
                    </button>
                    {/* ★ زر واتساب — مطابق للأصلي sendLinkToPersonDirect */}
                    <button onClick={() => onSendWhatsApp(person)} title={person.mobile ? `إرسال لـ ${person.mobile}` : 'لا يوجد جوال'} style={{
                      padding: '8px 14px', background: person.mobile ? '#dcfce7' : '#f3f4f6',
                      color: person.mobile ? '#15803d' : '#9ca3af',
                      borderRadius: '8px', fontWeight: 700, border: 'none',
                      cursor: person.mobile ? 'pointer' : 'not-allowed', fontSize: '13px',
                    }}>
                      📱 واتساب
                    </button>
                    <button onClick={() => onRemove(person)} style={{
                      padding: '8px 14px', background: '#fef2f2', color: '#dc2626',
                      borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '13px',
                    }}>
                      🔗 إلغاء
                    </button>
                  </>
                ) : (
                  <button onClick={() => onCreate(person)} disabled={disabled} style={{
                    padding: '8px 16px', background: '#4f46e5', color: '#fff',
                    borderRadius: '8px', fontWeight: 700, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '13px', opacity: disabled ? 0.6 : 1,
                  }}>
                    🔗 إنشاء
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function getPersonIcon(person: PersonLink): string {
  if (person.type === 'teacher') return '👨‍🏫';
  const role = person.role || '';
  if (role.includes('حارس')) return '🛡️';
  if (role.includes('موجه')) return '🧠';
  if (role.includes('مدير')) return '👑';
  return '👤';
}

function getPersonBg(person: PersonLink): string {
  if (person.type === 'teacher') return '#e0e7ff';
  const role = person.role || '';
  if (role.includes('حارس')) return '#d1fae5';
  if (role.includes('موجه')) return '#dbeafe';
  if (role.includes('مدير')) return '#f3e8ff';
  return '#fef3c7';
}

export default LinksTab;
