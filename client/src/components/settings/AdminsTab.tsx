import React, { useState, useEffect, useCallback } from 'react';
import { usersApi, UserData } from '../../api/users';
import { settingsApi, StageConfigData } from '../../api/settings';
import { showSuccess, showError } from '../shared/Toast';
import { ADMIN_ROLES, ROLE_INTERFACE_DESC, ADMIN_ROLE_TO_SYSTEM_ROLE, SETTINGS_STAGES, CLASS_LETTERS } from '../../utils/constants';

interface AdminUser {
  id: number;
  name: string;
  role: string;
  mobile: string;
  email: string;
  permissions: string;
  scopeType: string;
  scopeValue: string;
  isActive: boolean;
  tokenLink: string;
}

const AdminsTab: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stages, setStages] = useState<StageConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, stagesRes] = await Promise.all([
        usersApi.getAll(),
        settingsApi.getStructure(),
      ]);
      if (usersRes.data?.data) setUsers(usersRes.data.data);
      if (stagesRes.data?.data?.stages) setStages(Array.isArray(stagesRes.data.data.stages) ? stagesRes.data.data.stages : []);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await usersApi.delete(confirmDelete.id);
      if (res.data?.success) {
        showSuccess('تم الحذف بنجاح');
        setConfirmDelete(null);
        loadData();
      } else {
        showError(res.data?.message || 'خطأ');
      }
    } catch {
      showError('خطأ في الاتصال');
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#6366f1' }}>👤</span>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>الهيئة الإدارية</h3>
          <span style={{ padding: '2px 8px', background: '#f3f4f6', color: '#4b5563', fontSize: '14px', borderRadius: '9999px' }}>{users.length}</span>
        </div>
        <button onClick={() => { setEditingUser(null); setModalOpen(true); }} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px', background: '#4f46e5', color: '#fff',
          borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer',
        }}>
          ➕ إضافة عضو
        </button>
      </div>

      {/* Table or Empty */}
      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>👥</p>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>لا يوجد أعضاء مسجلين</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الدور</th>
                <th>الجوال</th>
                <th>الواجهة</th>
                <th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 700, color: '#1f2937' }}>{user.name}</td>
                  <td style={{ fontSize: '14px', color: '#4b5563' }}>{user.permissions || user.role}</td>
                  <td style={{ fontSize: '14px', color: '#4b5563' }}>{user.mobile || '-'}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px', background: '#eef2ff', color: '#4f46e5',
                      fontSize: '12px', borderRadius: '9999px', fontWeight: 700,
                    }}>
                      {ROLE_INTERFACE_DESC[user.permissions] || 'غير محدد'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => { setEditingUser(user); setModalOpen(true); }} style={{
                      padding: '6px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px',
                    }}>
                      ✏️
                    </button>
                    <button onClick={() => setConfirmDelete(user)} style={{
                      padding: '6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px',
                    }}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <AdminModal
          user={editingUser}
          stages={stages}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadData(); }}
        />
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <ConfirmModal
          title="تأكيد الحذف"
          message={`هل أنت متأكد من حذف "${confirmDelete.name}"؟`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

// ============================================================
// Admin Modal (Add/Edit)
// ============================================================
interface AdminModalProps {
  user: AdminUser | null;
  stages: StageConfigData[];
  onClose: () => void;
  onSaved: () => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ user, stages, onClose, onSaved }) => {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState(user?.permissions || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [email, setEmail] = useState(user?.email || '');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(() => {
    if (user?.scopeValue) return user.scopeValue.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  });
  const [saving, setSaving] = useState(false);

  // Build available classes from structure
  const availableClasses = buildClassesList(stages);
  const selectAll = availableClasses.length > 0 && selectedClasses.length === availableClasses.length;

  const toggleClass = (classKey: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classKey) ? prev.filter((c) => c !== classKey) : [...prev, classKey]
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(availableClasses.map((c) => c.key));
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !role || !mobile.trim()) {
      showError('يرجى ملء الحقول المطلوبة');
      return;
    }
    if (!/^05\d{8}$/.test(mobile.trim())) {
      showError('رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05');
      return;
    }

    setSaving(true);
    const systemRole = ADMIN_ROLE_TO_SYSTEM_ROLE[role] || 'Staff';
    const data: UserData = {
      name: name.trim(),
      role: systemRole,
      mobile: mobile.trim(),
      email: email.trim(),
      permissions: role, // Store the Arabic role name in permissions
      scopeType: selectedClasses.length > 0 ? 'classes' : 'all',
      scopeValue: selectedClasses.join(','),
    };

    try {
      const res = isEdit
        ? await usersApi.update(user!.id, data)
        : await usersApi.add(data);
      if (res.data?.success) {
        showSuccess('تم الحفظ بنجاح');
        onSaved();
      } else {
        showError(res.data?.message || 'خطأ في الحفظ');
      }
    } catch {
      showError('خطأ في الاتصال');
    } finally {
      setSaving(false);
    }
  };

  const interfaceDesc = ROLE_INTERFACE_DESC[role];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)',
      backdropFilter: 'blur(4px)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', background: 'linear-gradient(to left, #eef2ff, #faf5ff)',
          borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>
            {isEdit ? 'تعديل عضو' : 'إضافة عضو جديد'}
          </h3>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', color: '#9ca3af', fontSize: '18px' }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Name + Role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>الاسم *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>الدور *</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', background: '#fff', boxSizing: 'border-box' }}>
                <option value="">اختر</option>
                {ADMIN_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile + Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>الجوال *</label>
              <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05XXXXXXXX"
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '4px' }}>البريد</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', height: '44px', padding: '0 12px', border: '2px solid #d1d5db', borderRadius: '12px', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Classes */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 700, color: '#4b5563' }}>الفصول المسندة</label>
              {availableClasses.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                  <span style={{ fontSize: '14px', color: '#4f46e5', fontWeight: 700 }}>تحديد الكل</span>
                </label>
              )}
            </div>
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', maxHeight: '160px', overflowY: 'auto' }}>
              {availableClasses.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', margin: 0 }}>
                  لم يتم إعداد هيكل المدرسة
                </p>
              ) : (
                <ClassesGrid
                  classes={availableClasses}
                  stages={stages}
                  selectedClasses={selectedClasses}
                  onToggle={toggleClass}
                />
              )}
            </div>
          </div>

          {/* Role Interface Desc */}
          {interfaceDesc && (
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>واجهة الدور</label>
              <div style={{
                background: '#eef2ff', borderRadius: '12px', padding: '16px', border: '1px solid #c7d2fe',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <span>🖥️</span>
                <span style={{ fontSize: '14px', color: '#4338ca', fontWeight: 500 }}>{interfaceDesc}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none',
            cursor: 'pointer', borderRadius: '8px', fontWeight: 500,
          }}>
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 24px', background: '#4f46e5', color: '#fff',
            borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ' : 'إضافة'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Classes Grid
// ============================================================
interface ClassItem {
  key: string;
  label: string;
  stageId: string;
}

interface ClassesGridProps {
  classes: ClassItem[];
  stages: StageConfigData[];
  selectedClasses: string[];
  onToggle: (key: string) => void;
}

const ClassesGrid: React.FC<ClassesGridProps> = ({ classes, stages, selectedClasses, onToggle }) => {
  // Group by stage
  const grouped: Record<string, ClassItem[]> = {};
  classes.forEach((c) => {
    if (!grouped[c.stageId]) grouped[c.stageId] = [];
    grouped[c.stageId].push(c);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Object.entries(grouped).map(([stageId, items]) => {
        const stageInfo = SETTINGS_STAGES.find((s) => s.id === stageId);
        return (
          <div key={stageId} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
            <div style={{ fontWeight: 700, color: '#4f46e5', marginBottom: '8px', fontSize: '14px' }}>
              {stageInfo?.name || stageId}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {items.map((item) => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer', borderRadius: '4px' }}>
                  <input type="checkbox" checked={selectedClasses.includes(item.key)} onChange={() => onToggle(item.key)} />
                  <span style={{ fontSize: '14px' }}>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// Confirm Modal
// ============================================================
interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)',
    backdropFilter: 'blur(4px)', zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
  }}>
    <div style={{
      background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      width: '100%', maxWidth: '400px', padding: '24px',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>{title}</h3>
      <p style={{ margin: '0 0 24px', color: '#4b5563' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} style={{
          padding: '8px 16px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px',
        }}>
          إلغاء
        </button>
        <button onClick={onConfirm} style={{
          padding: '8px 24px', background: '#dc2626', color: '#fff',
          borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer',
        }}>
          حذف
        </button>
      </div>
    </div>
  </div>
);

// ============================================================
// Helpers
// ============================================================
function buildClassesList(stages: StageConfigData[]): ClassItem[] {
  const result: ClassItem[] = [];
  stages.forEach((stage) => {
    if (!stage.isEnabled) return;
    stage.grades.forEach((grade) => {
      if (!grade.isEnabled || grade.classCount === 0) return;
      CLASS_LETTERS.slice(0, grade.classCount).forEach((letter) => {
        const key = `${grade.gradeName}_${stage.stage}_${letter}`;
        result.push({
          key,
          label: `${grade.gradeName} (${letter})`,
          stageId: stage.stage,
        });
      });
    });
  });
  return result;
}

export default AdminsTab;
