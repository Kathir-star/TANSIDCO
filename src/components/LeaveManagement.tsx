import React, { useState, useEffect, useMemo } from 'react';
import {
  Palmtree,
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  User,
  Check,
  X,
  Sparkles,
  FileCheck2,
  FileWarning,
  Briefcase,
  Activity,
  HeartPulse,
  Info,
} from 'lucide-react';
import { LeaveRecord, Staff, StaffLeaveSummary, LeaveCategoryConfig } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface LeaveManagementProps {
  onSelectStaff: (staff: Staff) => void;
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ onSelectStaff }) => {
  const { showToast, settings } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [categories, setCategories] = useState<LeaveCategoryConfig[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [medicalDocFilter, setMedicalDocFilter] = useState<'all' | 'pending_doc' | 'submitted_doc'>('all');

  // Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('casual_leave');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [calculatedDays, setCalculatedDays] = useState<number>(1);
  const [medicalDocStatus, setMedicalDocStatus] = useState<'submitted' | 'not_submitted'>('not_submitted');
  const [medicalDocName, setMedicalDocName] = useState<string>('');
  const [currentStaffBalance, setCurrentStaffBalance] = useState<StaffLeaveSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leavesData, staffData, catData] = await Promise.all([
        api.getLeaveRecords(),
        api.getStaffList(false),
        api.getLeaveCategories(),
      ]);
      setLeaves(leavesData);
      setStaffList(staffData);
      setCategories(catData);
      if (staffData.length > 0 && !selectedStaffId) {
        setSelectedStaffId(staffData[0].employeeId);
      }
      if (catData.length > 0) {
        setSelectedCategory((prev) => {
          const match = catData.find((c) => c.id === prev || c.code === prev);
          return match ? match.id : catData[0].id;
        });
      }
    } catch (err) {
      showToast('error', 'Failed to load leave records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch balance when selectedStaff changes in apply modal
  useEffect(() => {
    if (!selectedStaffId) return;
    const fetchBalance = async () => {
      try {
        const bal = await api.getStaffLeaveBalance(selectedStaffId);
        setCurrentStaffBalance(bal);
      } catch (e) {
        console.error(e);
      }
    };
    fetchBalance();
  }, [selectedStaffId]);

  // Recalculate working days whenever dates change
  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      setCalculatedDays(0);
      return;
    }

    let count = 0;
    const cur = new Date(start);
    const weeklyOffs = settings?.weeklyOffDays || ['Sun'];

    while (cur <= end) {
      const dayName = cur.toLocaleDateString('en-US', { weekday: 'short' });
      if (!weeklyOffs.includes(dayName)) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    setCalculatedDays(count);
  }, [startDate, endDate, settings]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      showToast('error', 'Please select an employee.');
      return;
    }
    if (calculatedDays <= 0) {
      showToast('error', 'End Date must be on or after Start Date with at least 1 working day.');
      return;
    }

    // Check balance
    const activeCatBalance = currentStaffBalance?.categories.find(
      (c) =>
        c.categoryId === selectedCategory ||
        c.categoryCode === selectedCategory ||
        (c as any).code === selectedCategory
    );
    if (activeCatBalance && activeCatBalance.remaining < calculatedDays) {
      const proceed = window.confirm(
        `Warning: Staff has only ${activeCatBalance.remaining} days remaining in ${activeCatBalance.categoryName}, but requested ${calculatedDays} days. Record this as unauthorized or negative leave?`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    try {
      await api.applyLeave({
        employeeId: selectedStaffId,
        category: selectedCategory,
        startDate,
        endDate,
        reason,
        daysCount: calculatedDays,
        medicalDocumentStatus:
          selectedCategory === 'medical_leave' || selectedCategory === 'cat-ml'
            ? medicalDocStatus
            : undefined,
        medicalDocumentName:
          selectedCategory === 'medical_leave' || selectedCategory === 'cat-ml'
            ? medicalDocName
            : undefined,
      });

      showToast('success', 'Leave application recorded successfully.');
      setIsApplyModalOpen(false);
      setReason('');
      setMedicalDocName('');
      setMedicalDocStatus('not_submitted');
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to submit leave.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (leaveId: string, status: 'approved' | 'rejected') => {
    try {
      await api.updateLeaveStatus(leaveId, status);
      showToast('success', `Leave marked as ${status}. Attendance synchronized.`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || `Failed to update status.`);
    }
  };

  const handleToggleMedicalDoc = async (leave: LeaveRecord) => {
    const newStatus = leave.medicalDocumentStatus === 'submitted' ? 'not_submitted' : 'submitted';
    try {
      await api.updateMedicalDocumentStatus(
        leave.id,
        newStatus,
        newStatus === 'submitted' ? 'Medical Certificate Verified' : undefined
      );
      showToast(
        'success',
        `Medical document marked as ${newStatus === 'submitted' ? 'Submitted' : 'Pending'}.`
      );
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update medical document status.');
    }
  };

  // Category counts
  const casualCount = useMemo(
    () => leaves.filter((l) => l.category === 'casual_leave' || l.category === 'cat-cl').length,
    [leaves]
  );
  const earnCount = useMemo(
    () => leaves.filter((l) => l.category === 'earn_leave' || l.category === 'cat-el').length,
    [leaves]
  );
  const medicalCount = useMemo(
    () => leaves.filter((l) => l.category === 'medical_leave' || l.category === 'cat-ml').length,
    [leaves]
  );
  const pendingMedicalDocsCount = useMemo(
    () =>
      leaves.filter(
        (l) =>
          (l.category === 'medical_leave' || l.category === 'cat-ml') &&
          (l.medicalDocumentStatus === 'not_submitted' || !l.medicalDocumentStatus)
      ).length,
    [leaves]
  );

  // Filter leaves
  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      if (statusFilter !== 'all' && leave.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && leave.category !== categoryFilter) return false;

      if (medicalDocFilter === 'pending_doc') {
        const isMed = leave.category === 'medical_leave' || leave.category === 'cat-ml';
        if (!isMed || leave.medicalDocumentStatus === 'submitted') return false;
      } else if (medicalDocFilter === 'submitted_doc') {
        const isMed = leave.category === 'medical_leave' || leave.category === 'cat-ml';
        if (!isMed || leave.medicalDocumentStatus !== 'submitted') return false;
      }

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const staff = staffList.find((s) => s.employeeId === leave.employeeId);
      const name = staff?.fullName.toLowerCase() || '';
      return (
        leave.employeeId.toLowerCase().includes(q) ||
        name.includes(q) ||
        leave.reason.toLowerCase().includes(q)
      );
    });
  }, [leaves, statusFilter, categoryFilter, medicalDocFilter, searchQuery, staffList]);

  // Selected category balance stats for modal
  const selectedCatBalance = currentStaffBalance?.categories.find(
    (c) =>
      c.categoryId === selectedCategory ||
      c.categoryCode === selectedCategory ||
      (c as any).code === selectedCategory
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 3 Prominent Leave Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Casual Leave */}
        <div
          onClick={() => {
            setCategoryFilter(categoryFilter === 'casual_leave' || categoryFilter === 'cat-cl' ? 'all' : 'casual_leave');
            setMedicalDocFilter('all');
          }}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            categoryFilter === 'casual_leave' || categoryFilter === 'cat-cl'
              ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-300 shadow-sm'
              : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Casual Leave</h3>
                <p className="text-[11px] text-slate-500 font-medium">12 Days / Year Standard</p>
              </div>
            </div>
            <span className="text-xl font-bold text-blue-700">{casualCount}</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2.5">
            Routine planned leave for personal matters with remaining balance enforcement.
          </p>
        </div>

        {/* 2. Earn Leave */}
        <div
          onClick={() => {
            setCategoryFilter(categoryFilter === 'earn_leave' || categoryFilter === 'cat-el' ? 'all' : 'earn_leave');
            setMedicalDocFilter('all');
          }}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            categoryFilter === 'earn_leave' || categoryFilter === 'cat-el'
              ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-300 shadow-sm'
              : 'bg-white border-slate-200 hover:border-indigo-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                <Palmtree className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Earn Leave</h3>
                <p className="text-[11px] text-slate-500 font-medium">15 Days / Year Accrued</p>
              </div>
            </div>
            <span className="text-xl font-bold text-indigo-700">{earnCount}</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2.5">
            Annual vacation & earned privilege quota with carry-forward capability.
          </p>
        </div>

        {/* 3. Medical Leave with Doc Status Tracker */}
        <div
          onClick={() => {
            setCategoryFilter(categoryFilter === 'medical_leave' || categoryFilter === 'cat-ml' ? 'all' : 'medical_leave');
          }}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            categoryFilter === 'medical_leave' || categoryFilter === 'cat-ml'
              ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-300 shadow-sm'
              : 'bg-white border-slate-200 hover:border-purple-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Medical Leave</h3>
                <p className="text-[11px] text-slate-500 font-medium">Doc Verification Required</p>
              </div>
            </div>
            <span className="text-xl font-bold text-purple-700">{medicalCount}</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-600">Pending Certificates:</span>
            {pendingMedicalDocsCount > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCategoryFilter('all');
                  setMedicalDocFilter('pending_doc');
                }}
                className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-bold hover:bg-amber-200 flex items-center gap-1"
              >
                <FileWarning className="w-3 h-3" />
                {pendingMedicalDocsCount} Pending
              </button>
            ) : (
              <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                <FileCheck2 className="w-3 h-3" /> All Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-blue-600" />
            <span>Leave Applications & Quota Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {leaves.length} Total Records
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record leave requests, check live remaining balance, track doctor certificates, and sync attendance.
          </p>
        </div>

        <button
          id="leave-record-btn"
          onClick={() => {
            setSelectedCategory('casual_leave');
            setMedicalDocStatus('not_submitted');
            setIsApplyModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Record Leave Request</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="leave-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, Name, Reason..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              id="leave-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Approval Only</option>
              <option value="approved">Approved Only</option>
              <option value="rejected">Rejected Only</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Type:</span>
            <select
              id="leave-cat-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
            >
              <option value="all">All Leave Types</option>
              <option value="casual_leave">Casual Leave (12d)</option>
              <option value="earn_leave">Earn Leave (15d)</option>
              <option value="medical_leave">Medical Leave</option>
              <option value="other_leave">Other Leave</option>
            </select>
          </div>

          {/* Medical Doc Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Medical Doc:</span>
            <select
              id="leave-med-filter"
              value={medicalDocFilter}
              onChange={(e) => setMedicalDocFilter(e.target.value as any)}
              className="text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
            >
              <option value="all">All Document States</option>
              <option value="pending_doc">Pending Doctor Certificate</option>
              <option value="submitted_doc">Certificate Verified</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leave Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading leave records...</div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No leave records found matching current criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 w-28">Emp ID</th>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-3">Leave Type</th>
                  <th className="py-3 px-3">Duration (Dates)</th>
                  <th className="py-3 px-3 text-center">Days</th>
                  <th className="py-3 px-4">Medical Certificate</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeaves.map((leave) => {
                  const staff = staffList.find((s) => s.employeeId === leave.employeeId);
                  const isPending = leave.status === 'pending';
                  const isMedical =
                    leave.category === 'medical_leave' ||
                    leave.category === 'cat-ml' ||
                    leave.categoryName?.toLowerCase().includes('medical');

                  return (
                    <tr
                      key={leave.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isPending ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {leave.employeeId}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {staff ? (
                          <button
                            onClick={() => onSelectStaff(staff)}
                            className="hover:text-blue-600 hover:underline text-left font-bold"
                          >
                            {staff.fullName}
                          </button>
                        ) : (
                          leave.employeeId
                        )}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {staff?.department} • {staff?.designation}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            leave.category === 'casual_leave' || leave.category === 'cat-cl'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : leave.category === 'earn_leave' || leave.category === 'cat-el'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : isMedical
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {leave.categoryName || leave.category.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {leave.startDate} → {leave.endDate}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'}
                      </td>
                      {/* Medical Document Status Column */}
                      <td className="py-3 px-4">
                        {isMedical ? (
                          <div className="flex items-center gap-2">
                            {leave.medicalDocumentStatus === 'submitted' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Submitted</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Not Submitted</span>
                              </span>
                            )}
                            <button
                              onClick={() => handleToggleMedicalDoc(leave)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium"
                              title="Toggle document status"
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {leave.reason || '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            leave.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : leave.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {leave.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {leave.status !== 'approved' && (
                            <button
                              id={`leave-approve-${leave.id}`}
                              onClick={() => handleUpdateStatus(leave.id, 'approved')}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold rounded flex items-center gap-1 transition text-xs"
                              title="Approve Leave"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                          {leave.status !== 'rejected' && (
                            <button
                              id={`leave-reject-${leave.id}`}
                              onClick={() => handleUpdateStatus(leave.id, 'rejected')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold rounded flex items-center gap-1 transition text-xs"
                              title="Reject Leave"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record / Apply Leave Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-blue-600" />
              <span>Record Staff Leave</span>
            </h3>

            <form onSubmit={handleApplyLeave} className="space-y-4 mt-4 text-xs">
              {/* Employee selection */}
              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                  Select Employee *
                </label>
                <select
                  id="leave-employee-select"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-semibold"
                  required
                >
                  {staffList.map((s) => (
                    <option key={s.employeeId} value={s.employeeId}>
                      {s.employeeId} — {s.fullName} ({s.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Type */}
              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                  Leave Category *
                </label>
                <select
                  id="leave-category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c.id || c.code} value={c.id || c.code}>
                      {c.name} ({c.annualAllowance}d quota)
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Leave Balance Preview Card */}
              {selectedCatBalance && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-blue-950">
                      Current Balance for {selectedCatBalance.categoryName}:
                    </span>
                    <div className="text-[11px] text-blue-800 mt-0.5">
                      Allowed: {selectedCatBalance.allowed}d • Used: {selectedCatBalance.used}d
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-900">
                      {selectedCatBalance.remaining} days
                    </span>
                    <div className="text-[10px] text-blue-700">Remaining</div>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Working Days Calculated Banner */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Calculated Working Days:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
                </span>
              </div>

              {/* Conditional Medical Document Status Field for Medical Leave */}
              {(selectedCategory === 'medical_leave' ||
                selectedCategory === 'cat-ml' ||
                selectedCategory.toLowerCase().includes('medical')) && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-purple-900 flex items-center gap-1.5 text-xs">
                      <HeartPulse className="w-4 h-4 text-purple-700" />
                      <span>Doctor Certificate / Medical Document</span>
                    </label>
                    <select
                      value={medicalDocStatus}
                      onChange={(e) => setMedicalDocStatus(e.target.value as any)}
                      className="rounded border border-purple-300 px-2 py-1 text-xs font-semibold bg-white text-purple-900"
                    >
                      <option value="not_submitted">✗ Not Submitted (Pending)</option>
                      <option value="submitted">✓ Submitted & Verified</option>
                    </select>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={medicalDocName}
                      onChange={(e) => setMedicalDocName(e.target.value)}
                      placeholder="Doctor's name, clinic receipt, or certificate notes (optional)..."
                      className="w-full rounded border border-purple-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">
                  Reason / Remarks
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  placeholder="e.g. Fever & prescribed rest, Family function, Urgent personal work..."
                  required
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Submit Leave Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
