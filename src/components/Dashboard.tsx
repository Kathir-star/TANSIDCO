import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  CalendarDays,
  Clock,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Database,
  FileSpreadsheet,
  Download,
  CalendarCheck,
  Building2,
  Upload,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { DashboardStats, Staff, AttendanceRecord } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TansidcoLogo } from './TansidcoLogo';
import { StaffImportModal } from './StaffImportModal';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onSelectStaff: (staff: Staff) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectStaff }) => {
  const { showToast, settings } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [recentExceptions, setRecentExceptions] = useState<
    Array<{ staff: Staff; status: string; notes?: string }>
  >([]);
  const [leavePendingCount, setLeavePendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [dashData, staffData, todayRecords, leaveRecords] = await Promise.all([
        api.getDashboardStats(todayStr),
        api.getStaffList(true),
        api.getAttendanceForDate(todayStr).catch(() => [] as AttendanceRecord[]),
        api.getLeaveRecords().catch(() => []),
      ]);

      setStats(dashData);
      setStaffList(staffData);

      // Count pending leave requests
      const pendingLeaves = leaveRecords.filter((l) => l.status === 'pending').length;
      setLeavePendingCount(pendingLeaves);

      // Build recent attendance exceptions (absent, leaves, half day)
      const staffMap = new Map(staffData.map((s) => [s.employeeId, s]));
      const exceptions: Array<{ staff: Staff; status: string; notes?: string }> = [];

      todayRecords.forEach((rec) => {
        if (rec.status !== 'present' && rec.status !== 'weekly_off' && rec.status !== 'holiday') {
          const st = staffMap.get(rec.employeeId);
          if (st) {
            exceptions.push({ staff: st, status: rec.status, notes: rec.notes });
          }
        }
      });

      setRecentExceptions(exceptions.slice(0, 10));
    } catch (err: any) {
      showToast('error', 'Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleLoadOfficialRoster = async () => {
    setIsLoadingRoster(true);
    try {
      const res = await api.loadTansidcoRoster();
      showToast('success', res.message, 'Roster Loaded');
      loadStats();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load official roster.');
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const handleQuickBackup = async () => {
    setIsBackingUp(true);
    try {
      const data = await api.exportBackup();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `tansidco_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast('success', 'Database backup created and downloaded.', 'Backup Saved');
    } catch (err: any) {
      showToast('error', 'Failed to generate quick backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'absent':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold uppercase tracking-wider">
            Absent
          </span>
        );
      case 'half_day':
        return (
          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold uppercase tracking-wider">
            Half Day
          </span>
        );
      case 'medical_leave':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase tracking-wider">
            Medical Leave
          </span>
        );
      case 'casual_leave':
        return (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold uppercase tracking-wider">
            Casual Leave
          </span>
        );
      case 'other_leave':
        return (
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold uppercase tracking-wider">
            Earn / Special
          </span>
        );
      case 'present':
        return (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold uppercase tracking-wider">
            Present
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  const totalStaffCount = stats?.totalStaff ?? staffList.length;
  const activeStaffCount = stats?.activeStaff ?? staffList.filter((s) => s.status === 'active').length;
  const presentCount = stats?.presentToday ?? 0;
  const onLeaveOrAbsentCount =
    (stats?.absentToday || 0) + (stats?.onLeaveToday || 0) + (stats?.halfDayToday || 0);
  const attendancePercentage = stats?.attendancePercentage ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* TANSIDCO Official Master Banner & Single Source of Truth Control */}
      <div className="bg-linear-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <TansidcoLogo size="lg" showText={false} />
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {settings?.officeName || 'TANSIDCO'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Staff Master: Single Source of Truth
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Tamil Nadu Small Industries Development Corporation Limited • Attendance & Leave Management for 200–300 staff members.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            id="dash-import-staff-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Staff Data</span>
          </button>

          <button
            id="dash-load-roster-btn"
            onClick={handleLoadOfficialRoster}
            disabled={isLoadingRoster}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Reload official verified TANSIDCO staff database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoster ? 'animate-spin' : ''}`} />
            <span>Reset Official Roster</span>
          </button>

          <button
            id="dash-mark-attendance-btn"
            onClick={() => onNavigate('attendance')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Mark Daily Attendance</span>
          </button>
        </div>
      </div>

      {/* 1. Top Section: 4 Key Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Active Staff */}
        <div
          onClick={() => onNavigate('staff')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer hover:border-blue-300 transition"
        >
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Total Staff Master</span>
              <Users className="w-4 h-4 text-slate-400" />
            </p>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              {totalStaffCount}
            </h2>
          </div>
          <p className="text-blue-600 text-xs font-semibold mt-3 flex items-center justify-between">
            <span>{activeStaffCount} Active in Master</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </p>
        </div>

        {/* Present Today */}
        <div
          onClick={() => onNavigate('attendance')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer hover:border-emerald-300 transition"
        >
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Present Today</span>
              <UserCheck className="w-4 h-4 text-emerald-500" />
            </p>
            <h2 className="text-3xl font-bold text-emerald-600 tracking-tight">
              {presentCount}
            </h2>
          </div>
          <p className="text-slate-500 text-xs font-medium mt-3">
            {attendancePercentage}% Attendance rate
          </p>
        </div>

        {/* On Leave / Absent */}
        <div
          onClick={() => onNavigate('attendance')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer hover:border-orange-300 transition"
        >
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>On Leave / Absent</span>
              <UserX className="w-4 h-4 text-orange-500" />
            </p>
            <h2 className="text-3xl font-bold text-orange-500 tracking-tight">
              {onLeaveOrAbsentCount}
            </h2>
          </div>
          <p className="text-slate-500 text-xs font-medium mt-3">
            {stats?.onLeaveToday || 0} on leave • {stats?.absentToday || 0} absent
          </p>
        </div>

        {/* Pending Requests */}
        <div
          onClick={() => onNavigate('leave')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer hover:border-rose-300 transition"
        >
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Pending Requests</span>
              <CalendarDays className="w-4 h-4 text-rose-500" />
            </p>
            <h2 className="text-3xl font-bold text-rose-500 tracking-tight">
              {String(leavePendingCount || 0).padStart(2, '0')}
            </h2>
          </div>
          <p className="text-rose-600 text-xs font-medium mt-3">
            {leavePendingCount > 0 ? 'Needs immediate review' : 'All leave applications up to date'}
          </p>
        </div>
      </section>

      {/* 2. Main Two-Column Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width): Recent Attendance Exceptions Table */}
        <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Today's Attendance Exceptions</span>
            </h3>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-blue-600 text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Take Attendance</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-grow overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    S.No & ID
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Staff Name
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Designation / Dept
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      <p className="text-sm font-semibold text-slate-700">No attendance exceptions logged today</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Use "Take Attendance" or "Mark Daily Attendance" to record muster roll entries.
                      </p>
                    </td>
                  </tr>
                ) : (
                  recentExceptions.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => onSelectStaff(item.staff)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm font-mono text-slate-800">
                        <span className="font-bold text-blue-700 mr-2">{item.staff.serialNo}</span>
                        <span className="text-slate-500">({item.staff.employeeId})</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {item.staff.fullName}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <div className="font-medium text-slate-700">{item.staff.designation}</div>
                        <div className="text-xs text-slate-400">{item.staff.department}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(item.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (1/3 width): System Status + Monthly Summary */}
        <div className="flex flex-col gap-6">
          {/* System Status Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Offline Master Database</span>
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Source of Truth</span>
                <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Staff Master
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Active Roster</span>
                <span className="text-sm font-semibold text-slate-800">
                  {totalStaffCount} Verified Records
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Financial Cycle</span>
                <span className="text-sm font-semibold text-slate-700">
                  {settings?.financialYear || '2026-2027'}
                </span>
              </div>

              <div className="h-px bg-slate-100" />

              <button
                onClick={() => onNavigate('reports')}
                className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                Generate Monthly Roster Report
              </button>
              <button
                disabled={isBackingUp}
                onClick={handleQuickBackup}
                className="w-full py-2.5 bg-slate-100 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isBackingUp ? 'Creating Backup...' : 'Backup Database Now'}
              </button>
            </div>
          </div>

          {/* Monthly Summary Royal Blue Card */}
          <div className="bg-blue-600 p-6 rounded-xl text-white shadow-lg shadow-blue-600/20 flex flex-col justify-between min-h-[200px]">
            <div>
              <h3 className="font-bold text-base mb-1">Leave Balance Overview</h3>
              <p className="text-blue-100 text-xs">
                Casual, Earn & Medical Leave Policy (TANSIDCO)
              </p>
            </div>

            <div className="my-5">
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span>Annual Leave Allocation</span>
                <span>Active 3-Tier Policy</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mt-3">
                <div className="bg-blue-700/60 p-2 rounded-lg">
                  <span className="text-[10px] text-blue-200 block">CL</span>
                  <span className="text-sm font-bold text-white">12 Days</span>
                </div>
                <div className="bg-blue-700/60 p-2 rounded-lg">
                  <span className="text-[10px] text-blue-200 block">EL</span>
                  <span className="text-sm font-bold text-white">15 Days</span>
                </div>
                <div className="bg-blue-700/60 p-2 rounded-lg">
                  <span className="text-[10px] text-blue-200 block">ML</span>
                  <span className="text-sm font-bold text-white">10 Days</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-blue-100 italic font-light">
              "Automatic balance deductions and audit logging active on all leave requests."
            </p>
          </div>
        </div>
      </section>

      {/* 3. Alerts Section */}
      {stats?.alerts && stats.alerts.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Attendance & Policy Alerts</span>
            </h3>
            <span className="text-xs text-slate-400">
              {stats.alerts.length} active notice(s)
            </span>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {stats.alerts.map((alert, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      alert.type === 'danger'
                        ? 'bg-rose-500 ring-4 ring-rose-100'
                        : alert.type === 'warning'
                        ? 'bg-amber-500 ring-4 ring-amber-100'
                        : 'bg-blue-500 ring-4 ring-blue-100'
                    }`}
                  />
                  <span className="text-slate-700 font-medium">{alert.message}</span>
                </div>

                {alert.actionTab && (
                  <button
                    onClick={() => onNavigate(alert.actionTab!)}
                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>Review</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Import Modal */}
      <StaffImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          loadStats();
          showToast('success', 'Staff roster updated in database.', 'Import Successful');
        }}
        existingStaffList={staffList}
      />
    </div>
  );
};
