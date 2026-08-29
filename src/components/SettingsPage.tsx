import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  KeyRound,
  Palmtree,
  CalendarCheck,
  Wifi,
  Save,
  Trash2,
  Plus,
  RotateCcw,
  Sparkles,
  CheckCircle,
  Smartphone,
  Laptop,
  Edit2,
  Check,
  X,
  AlertTriangle,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { AppSettings, LeaveCategoryConfig } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { settings, refreshSettings, showToast } = useAuth();

  const [officeName, setOfficeName] = useState(settings?.officeName || '');
  const [financialYear, setFinancialYear] = useState(settings?.financialYear || '2026-2027');
  const [workingDays, setWorkingDays] = useState<string[]>(settings?.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [weeklyOffDays, setWeeklyOffDays] = useState<string[]>(settings?.weeklyOffDays || ['Sun']);
  const [leaveCategories, setLeaveCategories] = useState<LeaveCategoryConfig[]>([]);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LeaveCategoryConfig | null>(null);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catAllowance, setCatAllowance] = useState<number>(12);
  const [catDescription, setCatDescription] = useState('');
  const [catIsActive, setCatIsActive] = useState<boolean>(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Delete Category Confirmation Modal State
  const [deleteCatTarget, setDeleteCatTarget] = useState<LeaveCategoryConfig | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Network info
  const [networkInfo, setNetworkInfo] = useState<{ localIp: string; port: number; networkUrl: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const fetchCategories = async () => {
    try {
      const cats = await api.getLeaveCategories();
      setLeaveCategories(cats);
    } catch (e) {
      console.error('Failed to fetch leave categories', e);
    }
  };

  useEffect(() => {
    if (settings) {
      setOfficeName(settings.officeName);
      setFinancialYear(settings.financialYear);
      setWorkingDays(settings.workingDays);
      setWeeklyOffDays(settings.weeklyOffDays);
    }

    const fetchExtra = async () => {
      try {
        const [cats, net] = await Promise.all([
          api.getLeaveCategories(),
          api.getNetworkInfo(),
        ]);
        setLeaveCategories(cats);
        setNetworkInfo(net);
      } catch (e) {
        console.error(e);
      }
    };
    fetchExtra();
  }, [settings]);

  const handleToggleDay = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
      if (!weeklyOffDays.includes(day)) {
        setWeeklyOffDays([...weeklyOffDays, day]);
      }
    } else {
      setWorkingDays([...workingDays, day]);
      setWeeklyOffDays(weeklyOffDays.filter((d) => d !== day));
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings({
        officeName,
        financialYear,
        workingDays,
        weeklyOffDays,
      });

      await refreshSettings();
      showToast('success', 'Office settings updated successfully.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open modal for new category
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatCode('');
    setCatAllowance(12);
    setCatDescription('');
    setCatIsActive(true);
    setIsCategoryModalOpen(true);
  };

  // Open modal for editing existing category
  const handleOpenEditCategory = (cat: LeaveCategoryConfig) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatCode(cat.code || cat.id);
    setCatAllowance(cat.annualAllowance);
    setCatDescription(cat.description || '');
    setCatIsActive(cat.isActive !== false);
    setIsCategoryModalOpen(true);
  };

  // Submit Add or Edit Category
  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast('error', 'Category Name is required.');
      return;
    }
    const allowanceNum = Number(catAllowance);
    if (isNaN(allowanceNum) || allowanceNum < 0) {
      showToast('error', 'Please specify a valid non-negative allowance.');
      return;
    }

    const generatedCode = (catCode.trim() || catName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));

    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        await api.updateLeaveCategory(editingCategory.id, {
          name: catName.trim(),
          code: generatedCode,
          annualAllowance: allowanceNum,
          description: catDescription.trim(),
          isActive: catIsActive,
        });
        showToast('success', `${catName.trim()} category updated successfully.`, 'Category Saved');
      } else {
        await api.addLeaveCategory({
          name: catName.trim(),
          code: generatedCode,
          annualAllowance: allowanceNum,
          description: catDescription.trim(),
          isActive: catIsActive,
        });
        showToast('success', `${catName.trim()} category created successfully.`, 'Category Added');
      }

      setIsCategoryModalOpen(false);
      await fetchCategories();
      await refreshSettings();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save category.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Toggle category active status
  const handleToggleCategoryActive = async (cat: LeaveCategoryConfig) => {
    try {
      const nextActive = !cat.isActive;
      await api.updateLeaveCategory(cat.id, { isActive: nextActive });
      showToast('info', `${cat.name} marked as ${nextActive ? 'Active' : 'Inactive'}.`);
      await fetchCategories();
      await refreshSettings();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update category status.');
    }
  };

  // Confirm delete category
  const handleConfirmDeleteCategory = async () => {
    if (!deleteCatTarget) return;
    setIsDeletingCategory(true);
    try {
      const res = await api.deleteLeaveCategory(deleteCatTarget.id);
      showToast('success', res.message, 'Category Deleted');
      setDeleteCatTarget(null);
      await fetchCategories();
      await refreshSettings();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete category.');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('error', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 4) {
      showToast('error', 'Password must be at least 4 characters long.');
      return;
    }

    setIsChangingPass(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      showToast('success', 'Admin password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to change password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleLoadDemoData = async () => {
    if (!window.confirm('Load 25 sample employees and 30 days of test attendance? This is great for testing features.')) {
      return;
    }
    try {
      const res = await api.loadDemoData();
      showToast('success', res.message, 'Sample Data Loaded');
      await refreshSettings();
      await fetchCategories();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load demo data.');
    }
  };

  const isDefaultCategory = (cat: LeaveCategoryConfig) => {
    return (
      cat.isDefault ||
      ['cat-cl', 'cat-el', 'cat-ml', 'casual_leave', 'earn_leave', 'medical_leave'].includes(cat.id) ||
      ['casual_leave', 'earn_leave', 'medical_leave'].includes(cat.code)
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <span>System Settings & Configuration</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure office identity, annual leave quotas, working schedules, and LAN local server sharing.
        </p>
      </div>

      {/* 1. Office Info & Schedule */}
      <form onSubmit={handleSaveGeneral} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-blue-600" />
            <span>Office Profile & Financial Year</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 uppercase text-[10px]">Office / Company Name</label>
              <input
                id="settings-office-name"
                type="text"
                required
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 uppercase text-[10px]">Financial / Leave Cycle Year</label>
              <input
                id="settings-financial-year"
                type="text"
                required
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Working Days Configuration */}
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            <span>Weekly Working Schedule & Off Days</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Toggle your office working days. Days marked as "Weekly Off" are automatically excluded from leave deductions.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 mt-3">
            {allDays.map((day) => {
              const isWorking = workingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  id={`toggle-day-${day}`}
                  onClick={() => handleToggleDay(day)}
                  className={`p-2.5 rounded-lg border text-center text-xs transition ${
                    isWorking
                      ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold'
                      : 'bg-slate-100 border-slate-200 text-slate-400 font-medium'
                  }`}
                >
                  <div>{day}</div>
                  <div className="text-[10px] mt-0.5">{isWorking ? 'Working' : 'Off'}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            id="settings-save-btn"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Settings...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* 2. Leave Category Quotas & Policy Management */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-blue-600" />
              <span>Leave Categories & Policy Quotas</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard Tamil Nadu government office allowances: Casual Leave (12d), Earn Leave (15d), Medical Leave.
            </p>
          </div>

          <button
            type="button"
            id="settings-add-category-btn"
            onClick={handleOpenAddCategory}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </button>
        </div>

        {/* Category List */}
        <div className="space-y-3 pt-1">
          {leaveCategories.map((cat) => {
            const isDef = isDefaultCategory(cat);
            return (
              <div
                key={cat.id || cat.code}
                id={`category-item-${cat.code}`}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border transition ${
                  cat.isActive !== false
                    ? 'bg-slate-50/80 border-slate-200'
                    : 'bg-slate-100/60 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      cat.code.includes('casual')
                        ? 'bg-blue-100 text-blue-800'
                        : cat.code.includes('earn')
                        ? 'bg-indigo-100 text-indigo-800'
                        : cat.code.includes('medical')
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat.code.includes('casual')
                      ? 'CL'
                      : cat.code.includes('earn')
                      ? 'EL'
                      : cat.code.includes('med')
                      ? 'ML'
                      : 'LV'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{cat.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 font-mono text-slate-600">
                        {cat.code}
                      </span>
                      {isDef && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                          Standard Policy
                        </span>
                      )}
                      {cat.isActive === false && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                          Deactivated
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{cat.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{cat.annualAllowance}</span>
                    <span className="text-xs text-slate-500 ml-1">days / yr</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Edit button */}
                    <button
                      type="button"
                      id={`edit-category-${cat.code}`}
                      onClick={() => handleOpenEditCategory(cat)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded border border-transparent hover:border-slate-300 transition"
                      title="Edit Category Details & Allowance"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Toggle Active status */}
                    <button
                      type="button"
                      id={`toggle-category-${cat.code}`}
                      onClick={() => handleToggleCategoryActive(cat)}
                      className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                        cat.isActive !== false
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                      }`}
                      title={cat.isActive !== false ? 'Deactivate this category' : 'Activate this category'}
                    >
                      {cat.isActive !== false ? 'Active' : 'Inactive'}
                    </button>

                    {/* Delete button (for non-default) */}
                    {!isDef ? (
                      <button
                        type="button"
                        id={`delete-category-${cat.code}`}
                        onClick={() => setDeleteCatTarget(cat)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200 transition"
                        title="Delete custom category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span
                        className="p-1.5 text-slate-300 cursor-not-allowed"
                        title="Standard policy categories cannot be deleted"
                      >
                        <Trash2 className="w-3.5 h-3.5 opacity-30" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-blue-600" />
              <span>{editingCategory ? 'Edit Leave Category' : 'Add New Leave Category'}</span>
            </h3>

            <form onSubmit={handleSubmitCategory} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                  Category Display Name *
                </label>
                <input
                  id="category-modal-name"
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!editingCategory && !catCode) {
                      setCatCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    }
                  }}
                  placeholder="e.g. Special Casual Leave, Paternity Leave"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-semibold focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                    Short Code / Identifier
                  </label>
                  <input
                    id="category-modal-code"
                    type="text"
                    value={catCode}
                    disabled={!!editingCategory && isDefaultCategory(editingCategory)}
                    onChange={(e) => setCatCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. special_cl"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono disabled:bg-slate-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                    Annual Allowance (Days/Yr) *
                  </label>
                  <input
                    id="category-modal-allowance"
                    type="number"
                    min="0"
                    max="365"
                    required
                    value={catAllowance}
                    onChange={(e) => setCatAllowance(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-bold text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                  Policy Description / Usage Guidelines
                </label>
                <textarea
                  id="category-modal-desc"
                  rows={2}
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  placeholder="e.g. Allowed for gazetted personal obligations with department approval..."
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <input
                  type="checkbox"
                  id="category-modal-active"
                  checked={catIsActive}
                  onChange={(e) => setCatIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="category-modal-active" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Active Category (Available for staff leave requests)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="category-modal-save-btn"
                  disabled={isSavingCategory}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingCategory ? 'Saving...' : 'Save Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Dialog */}
      {deleteCatTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-100">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Leave Category?</h3>
                <p className="text-xs text-slate-500">Confirm permanent removal of custom leave type</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">"{deleteCatTarget.name}"</strong>?
              If any staff have historical leave applications under this category, deletion will be blocked to safeguard records.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCatTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-category-btn"
                disabled={isDeletingCategory}
                onClick={handleConfirmDeleteCategory}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow transition disabled:opacity-50"
              >
                {isDeletingCategory ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Admin Password Change */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span>Change Administrator Password</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 uppercase text-[10px]">Current Password</label>
            <input
              id="settings-curr-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 uppercase text-[10px]">New Password</label>
            <input
              id="settings-new-password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 uppercase text-[10px]">Confirm New Password</label>
            <input
              id="settings-confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Repeat new password"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            id="settings-update-password-btn"
            disabled={isChangingPass}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition disabled:opacity-50"
          >
            {isChangingPass ? 'Updating...' : 'Update Admin Password'}
          </button>
        </div>
      </form>

      {/* 4. Local Wi-Fi / LAN Network Sharing Guide */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Wifi className="w-4 h-4 text-blue-600" />
          <span>Local Wi-Fi Network & Multi-Device Access</span>
        </h3>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900">Host Server Mode:</span>
              <p className="text-slate-500 text-[11px] mt-0.5">
                This applet is running on the local host. Other devices (supervisors, tablets, Android phones) connected to the same office Wi-Fi network can access the system.
              </p>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-300 rounded font-mono text-xs flex justify-between items-center">
            <span className="text-slate-600">Local LAN Address:</span>
            <span className="font-bold text-blue-700">
              http://localhost:{networkInfo?.port || 3000}
            </span>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-slate-400" />
            <span>Works natively on Android Chrome/Firefox and Desktop browsers without requiring internet connection.</span>
          </div>
        </div>
      </div>

      {/* 5. Demo Data & Reset */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Sample Demo Data</span>
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Load 25 realistic sample staff members with pre-populated attendance records for evaluation.
          </p>
        </div>

        <button
          onClick={handleLoadDemoData}
          id="settings-load-demo-btn"
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-800 transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Load 25 Demo Staff</span>
        </button>
      </div>
    </div>
  );
};

