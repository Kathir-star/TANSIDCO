import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Palmtree,
  Save,
  Search,
  Filter,
  Check,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Info,
  CalendarDays,
} from 'lucide-react';
import { Staff, AttendanceRecord, AttendanceStatus, Holiday } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DailyAttendanceProps {
  onSelectStaff: (staff: Staff) => void;
}

export const DailyAttendance: React.FC<DailyAttendanceProps> = ({ onSelectStaff }) => {
  const { showToast, settings } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, { status: AttendanceStatus; notes: string }>>(new Map());
  const [initialAttendanceMap, setInitialAttendanceMap] = useState<Map<string, { status: AttendanceStatus; notes: string }>>(new Map());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

  // Load staff, holidays, and attendance for selected date
  const loadData = async (dateStr: string) => {
    setIsLoading(true);
    try {
      const [staffData, attData, holData] = await Promise.all([
        api.getStaffList(false), // only active staff
        api.getAttendanceForDate(dateStr),
        api.getHolidays(new Date(dateStr).getFullYear()),
      ]);

      setStaffList(staffData);
      setHolidays(holData);

      const map = new Map<string, { status: AttendanceStatus; notes: string }>();
      attData.forEach((rec) => {
        map.set(rec.employeeId, { status: rec.status, notes: rec.notes || '' });
      });

      setAttendanceMap(new Map(map));
      setInitialAttendanceMap(new Map(map));
      setLastSavedMessage(null);
    } catch (err: any) {
      showToast('error', 'Failed to load attendance records for selected date.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  // Check if selected date is a holiday or weekly off
  const dateObj = new Date(selectedDate);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const isWeeklyOff = settings?.weeklyOffDays?.includes(dayName) || dayName === 'Sun';
  const matchingHoliday = holidays.find((h) => h.date === selectedDate);

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [staffList]);

  // Track unsaved changes
  const unsavedCount = useMemo(() => {
    let count = 0;
    for (const staff of staffList) {
      const current = attendanceMap.get(staff.employeeId);
      const initial = initialAttendanceMap.get(staff.employeeId);
      if (!current && !initial) continue;
      if (!current || !initial || current.status !== initial.status || current.notes !== initial.notes) {
        count++;
      }
    }
    return count;
  }, [staffList, attendanceMap, initialAttendanceMap]);

  // Quick action: Mark All Present
  const handleMarkAllPresent = () => {
    const nextMap = new Map<string, { status: AttendanceStatus; notes: string }>(attendanceMap);
    let updatedCount = 0;
    staffList.forEach((staff) => {
      const curr = nextMap.get(staff.employeeId);
      // If currently unmarked or absent, set to present
      if (!curr || curr.status === 'absent') {
        nextMap.set(staff.employeeId, { status: 'present', notes: curr?.notes || '' });
        updatedCount++;
      }
    });
    setAttendanceMap(nextMap);
    showToast('info', `Marked ${updatedCount} staff as Present. Click "Save Attendance" to commit.`, 'Batch Update');
  };

  // Quick action: Mark All Holiday or Weekly Off
  const handleMarkAllHolidayOrOff = (statusToSet: 'holiday' | 'weekly_off') => {
    const nextMap = new Map<string, { status: AttendanceStatus; notes: string }>(attendanceMap);
    staffList.forEach((staff) => {
      nextMap.set(staff.employeeId, {
        status: statusToSet,
        notes: matchingHoliday?.name || (statusToSet === 'weekly_off' ? 'Weekly Off Day' : ''),
      });
    });
    setAttendanceMap(nextMap);
    showToast('info', `Marked all ${staffList.length} staff as ${statusToSet === 'holiday' ? 'Holiday' : 'Weekly Off'}.`, 'Batch Update');
  };

  // Single staff status change
  const handleSetStatus = (employeeId: string, status: AttendanceStatus) => {
    const nextMap = new Map<string, { status: AttendanceStatus; notes: string }>(attendanceMap);
    const existing = nextMap.get(employeeId);
    nextMap.set(employeeId, { status, notes: existing?.notes || '' });
    setAttendanceMap(nextMap);
  };

  // Save all attendance batch
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const recordsToSave: Array<{ employeeId: string; status: AttendanceStatus; notes?: string }> = [];

      staffList.forEach((staff) => {
        const att = attendanceMap.get(staff.employeeId);
        if (att) {
          recordsToSave.push({
            employeeId: staff.employeeId,
            status: att.status,
            notes: att.notes,
          });
        }
      });

      if (recordsToSave.length === 0) {
        showToast('warning', 'No attendance entries to save.');
        setIsSaving(false);
        return;
      }

      const res = await api.saveAttendanceBatch(selectedDate, recordsToSave);
      setInitialAttendanceMap(new Map(attendanceMap));
      const msg = `Attendance saved successfully for ${recordsToSave.length} staff on ${selectedDate}.`;
      setLastSavedMessage(msg);
      showToast('success', msg, 'Saved Successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  // Date step helpers
  const handleDateStep = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Filtered and searched staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        staff.fullName.toLowerCase().includes(q) ||
        staff.employeeId.toLowerCase().includes(q) ||
        staff.serialNo.toLowerCase().includes(q) ||
        staff.department.toLowerCase().includes(q) ||
        staff.designation.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Department filter
      if (selectedDepartment !== 'all' && staff.department !== selectedDepartment) {
        return false;
      }

      // Status filter
      const att = attendanceMap.get(staff.employeeId);
      const status = att ? att.status : 'unmarked';

      if (statusFilter === 'all') return true;
      if (statusFilter === 'unmarked') return !att;
      if (statusFilter === 'leave') {
        return ['casual_leave', 'medical_leave', 'other_leave'].includes(status);
      }
      return status === statusFilter;
    });
  }, [staffList, searchQuery, selectedDepartment, statusFilter, attendanceMap]);

  // Counts for quick filter pills
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let halfDay = 0;
    let holiday = 0;
    let weeklyOff = 0;
    let unmarked = 0;

    staffList.forEach((s) => {
      const att = attendanceMap.get(s.employeeId);
      if (!att) {
        unmarked++;
      } else if (att.status === 'present') present++;
      else if (att.status === 'absent') absent++;
      else if (['casual_leave', 'earn_leave', 'medical_leave', 'other_leave'].includes(att.status)) leave++;
      else if (att.status === 'half_day') halfDay++;
      else if (att.status === 'holiday') holiday++;
      else if (att.status === 'weekly_off') weeklyOff++;
    });

    return {
      all: staffList.length,
      present,
      absent,
      leave,
      halfDay,
      holiday,
      weeklyOff,
      unmarked,
    };
  }, [staffList, attendanceMap]);

  const statusOptions: Array<{ key: AttendanceStatus; label: string; short: string; color: string; activeColor: string }> = [
    { key: 'present', label: 'Present', short: 'P', color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200', activeColor: 'bg-emerald-600 text-white border-emerald-600' },
    { key: 'absent', label: 'Absent', short: 'A', color: 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200', activeColor: 'bg-rose-600 text-white border-rose-600' },
    { key: 'casual_leave', label: 'Casual Leave', short: 'CL', color: 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200', activeColor: 'bg-blue-600 text-white border-blue-600' },
    { key: 'earn_leave', label: 'Earn Leave', short: 'EL', color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200', activeColor: 'bg-indigo-600 text-white border-indigo-600' },
    { key: 'medical_leave', label: 'Medical Leave', short: 'ML', color: 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200', activeColor: 'bg-purple-600 text-white border-purple-600' },
    { key: 'half_day', label: 'Half Day', short: 'HD', color: 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200', activeColor: 'bg-amber-600 text-white border-amber-600' },
    { key: 'weekly_off', label: 'Weekly Off', short: 'WO', color: 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300', activeColor: 'bg-slate-700 text-white border-slate-700' },
    { key: 'holiday', label: 'Holiday', short: 'H', color: 'text-teal-700 bg-teal-50 hover:bg-teal-100 border-teal-200', activeColor: 'bg-teal-600 text-white border-teal-600' },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-20">
      {/* Top Date Selection & Fast Batch Action Header */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date Picker Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
              <button
                id="att-prev-day-btn"
                onClick={() => handleDateStep(-1)}
                className="p-2 hover:bg-slate-100 rounded text-slate-600 transition"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 px-3 py-1">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <input
                  id="att-date-picker"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="text-sm font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
                />
              </div>

              <button
                id="att-next-day-btn"
                onClick={() => handleDateStep(1)}
                className="p-2 hover:bg-slate-100 rounded text-slate-600 transition"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              id="att-today-btn"
              onClick={handleSetToday}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
            >
              Today
            </button>

            {/* Holiday / Weekly Off Indicator */}
            {matchingHoliday && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-100 border border-teal-300 text-teal-800 text-xs font-semibold">
                <Palmtree className="w-3.5 h-3.5" /> Holiday: {matchingHoliday.name}
              </span>
            )}
            {isWeeklyOff && !matchingHoliday && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5" /> Weekly Off ({dayName})
              </span>
            )}
          </div>

          {/* Quick Mark All Buttons & Sticky Save */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="att-mark-all-present-btn"
              onClick={handleMarkAllPresent}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold transition shadow-sm"
              title="Quickly set all staff to Present (then tweak exceptions)"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Mark All Present</span>
            </button>

            {matchingHoliday && (
              <button
                onClick={() => handleMarkAllHolidayOrOff('holiday')}
                className="px-3 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-800 rounded-lg text-xs font-semibold transition"
              >
                Set All Holiday
              </button>
            )}

            {isWeeklyOff && (
              <button
                onClick={() => handleMarkAllHolidayOrOff('weekly_off')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition"
              >
                Set All Weekly Off
              </button>
            )}

            <button
              id="att-save-btn"
              disabled={isSaving}
              onClick={handleSaveAttendance}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-white transition shadow ${
                unsavedCount > 0
                  ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-400 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Records...' : `Save Attendance (${staffList.length})`}</span>
            </button>
          </div>
        </div>

        {/* Confirmation banner after save */}
        {lastSavedMessage && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{lastSavedMessage}</span>
          </div>
        )}

        {/* Unsaved changes notice */}
        {unsavedCount > 0 && !lastSavedMessage && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{unsavedCount} unsaved modification(s)</strong>. Click "Save Attendance" to store records.
              </span>
            </div>
            <button
              onClick={() => setAttendanceMap(new Map(initialAttendanceMap))}
              className="text-amber-800 hover:text-amber-950 underline font-semibold"
            >
              Discard Changes
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="att-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, Name, Dept... (/)"
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-500">Dept:</span>
            <select
              id="att-dept-filter"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white text-slate-800 focus:border-blue-600"
            >
              <option value="all">All Departments ({staffList.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept} ({staffList.filter((s) => s.department === dept).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex space-x-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none text-xs border-t border-slate-100">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Staff ({counts.all})
          </button>
          <button
            onClick={() => setStatusFilter('present')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'present'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Present ({counts.present})
          </button>
          <button
            onClick={() => setStatusFilter('absent')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'absent'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            Absent ({counts.absent})
          </button>
          <button
            onClick={() => setStatusFilter('leave')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'leave'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            On Leave ({counts.leave})
          </button>
          <button
            onClick={() => setStatusFilter('half_day')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'half_day'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Half Day ({counts.halfDay})
          </button>
          {counts.unmarked > 0 && (
            <button
              onClick={() => setStatusFilter('unmarked')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === 'unmarked'
                  ? 'bg-rose-700 text-white ring-2 ring-rose-300'
                  : 'bg-rose-100 text-rose-900 hover:bg-rose-200'
              }`}
            >
              ⚠ Unmarked ({counts.unmarked})
            </button>
          )}
        </div>
      </div>

      {/* Staff Attendance Table (Desktop) and Cards (Mobile) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading attendance records for {selectedDate}...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No staff records matching current filter ({statusFilter !== 'all' ? statusFilter : 'search'}).
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">S.No</th>
                    <th className="py-3 px-3 w-28">Emp ID</th>
                    <th className="py-3 px-3">Employee Name</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Designation</th>
                    <th className="py-3 px-4 text-center">Attendance Status Selection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((staff, idx) => {
                    const current = attendanceMap.get(staff.employeeId);
                    const currentStatus = current ? current.status : undefined;

                    return (
                      <tr
                        key={staff.id}
                        id={`att-row-${staff.employeeId}`}
                        className={`hover:bg-slate-50/80 transition ${
                          !currentStatus
                            ? 'bg-amber-50/30'
                            : currentStatus === 'absent'
                            ? 'bg-rose-50/20'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-mono text-slate-500">
                          {staff.serialNo || String(idx + 1).padStart(3, '0')}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                          {staff.employeeId}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900">
                          <button
                            onClick={() => onSelectStaff(staff)}
                            className="hover:text-blue-600 hover:underline text-left"
                            title="Click to view full staff profile & leave history"
                          >
                            {staff.fullName}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{staff.department}</td>
                        <td className="py-3 px-3 text-slate-500">{staff.designation}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {statusOptions.map((opt) => {
                              const isSelected = currentStatus === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  id={`att-btn-${staff.employeeId}-${opt.key}`}
                                  type="button"
                                  onClick={() => handleSetStatus(staff.employeeId, opt.key)}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                                    isSelected
                                      ? opt.activeColor
                                      : opt.color
                                  }`}
                                  title={`Mark as ${opt.label}`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredStaff.map((staff, idx) => {
                const current = attendanceMap.get(staff.employeeId);
                const currentStatus = current ? current.status : undefined;

                return (
                  <div
                    key={staff.id}
                    className={`p-3.5 space-y-2.5 ${
                      !currentStatus ? 'bg-amber-50/40' : currentStatus === 'absent' ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm text-slate-900">
                          <button
                            onClick={() => onSelectStaff(staff)}
                            className="hover:text-blue-600 underline text-left"
                          >
                            {staff.fullName}
                          </button>
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono font-semibold text-slate-700">{staff.employeeId}</span> • {staff.department} • {staff.designation}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        #{staff.serialNo || idx + 1}
                      </span>
                    </div>

                    {/* Quick Button Grid */}
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {statusOptions.slice(0, 4).map((opt) => {
                        const isSelected = currentStatus === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => handleSetStatus(staff.employeeId, opt.key)}
                            className={`py-1.5 rounded text-xs font-semibold border text-center transition ${
                              isSelected ? opt.activeColor : opt.color
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {statusOptions.slice(4).map((opt) => {
                        const isSelected = currentStatus === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => handleSetStatus(staff.employeeId, opt.key)}
                            className={`py-1.5 rounded text-xs font-semibold border text-center transition ${
                              isSelected ? opt.activeColor : opt.color
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Floating Bottom Sticky Save Bar for Quick Confirmation */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-xl w-full px-4 print:hidden pointer-events-none">
        <div className="pointer-events-auto bg-slate-900 text-white rounded-xl p-3 shadow-2xl border border-slate-700 flex items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-semibold text-slate-200">
              {unsavedCount > 0 ? `${unsavedCount} Unsaved Changes` : 'All records in sync'}
            </div>
            <div className="text-[11px] text-slate-400">
              {counts.present} Present • {counts.absent} Absent • {counts.leave} Leave • {counts.unmarked} Unmarked
            </div>
          </div>

          <button
            id="att-sticky-save-btn"
            disabled={isSaving}
            onClick={handleSaveAttendance}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
