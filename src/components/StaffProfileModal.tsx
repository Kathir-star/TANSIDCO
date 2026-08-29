import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Calendar,
  Building,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Palmtree,
  Percent,
  History,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  FileDown,
} from 'lucide-react';
import { Staff, AttendanceRecord, StaffLeaveSummary, LeaveRequest } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { exportIndividualStaffLeaveCardPDF } from '../utils/pdfExport';

interface StaffProfileModalProps {
  staff: Staff | null;
  onClose: () => void;
}

export const StaffProfileModal: React.FC<StaffProfileModalProps> = ({ staff, onClose }) => {
  const { showToast, settings } = useAuth();
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [leaveSummary, setLeaveSummary] = useState<StaffLeaveSummary | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (!staff) return;

    const loadProfileData = async () => {
      setIsLoading(true);
      try {
        const [attData, leaveData, allReqs] = await Promise.all([
          api.getAttendanceForStaff(staff.employeeId),
          api.getStaffLeaveBalance(staff.employeeId),
          api.getLeaveRequests(),
        ]);
        setAttendanceList(attData);
        setLeaveSummary(leaveData);
        setLeaveRequests(allReqs.filter((r) => r.employeeId === staff.employeeId));
      } catch (err) {
        showToast('error', 'Failed to load employee details.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, [staff, showToast]);

  if (!staff) return null;

  // Filter attendance for the selected month/year
  const monthStr = String(selectedMonth).padStart(2, '0');
  const filteredAttendance = attendanceList.filter((a) =>
    a.date.startsWith(`${selectedYear}-${monthStr}`)
  );

  // Overall attendance counts
  let presentTotal = 0;
  let absentTotal = 0;
  let leaveTotal = 0;
  let halfDayTotal = 0;

  attendanceList.forEach((a) => {
    if (a.status === 'present') presentTotal++;
    else if (a.status === 'absent') absentTotal++;
    else if (['casual_leave', 'earn_leave', 'medical_leave', 'other_leave'].includes(a.status)) leaveTotal++;
    else if (a.status === 'half_day') halfDayTotal++;
  });

  const totalWorkingDays = presentTotal + absentTotal + leaveTotal + halfDayTotal;
  const effectivePresent = presentTotal + halfDayTotal * 0.5;
  const attendancePct = totalWorkingDays > 0 ? Math.round((effectivePresent / totalWorkingDays) * 100) : 0;

  const handleExportPDF = () => {
    if (!staff || !leaveSummary) {
      showToast('error', 'Profile data is not ready to export.');
      return;
    }
    try {
      exportIndividualStaffLeaveCardPDF({
        staff,
        summary: leaveSummary,
        leaveRequests,
        attendance: attendanceList,
        settings,
      });
      showToast('success', `Form-VI: Staff Leave Card PDF generated for ${staff.fullName}.`, 'PDF Downloaded');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate PDF.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">Present</span>;
      case 'absent':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">Absent</span>;
      case 'casual_leave':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">Casual Leave</span>;
      case 'earn_leave':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">Earn Leave</span>;
      case 'medical_leave':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800">Medical Leave</span>;
      case 'other_leave':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">Other Leave</span>;
      case 'half_day':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">Half Day</span>;
      case 'holiday':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800">Holiday</span>;
      case 'weekly_off':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">Weekly Off</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none print:p-0">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
              {staff.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">{staff.fullName}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    staff.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {staff.status.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span className="font-mono font-bold text-slate-700">{staff.employeeId}</span>
                <span>•</span>
                <span>{staff.designation}</span>
                <span>•</span>
                <span>{staff.department}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              title="Download Form-VI: Staff Leave Card PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Leave Card (PDF)</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Print Employee Profile Sheet"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading employee history...</div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <div className="text-slate-400 uppercase text-[10px] font-semibold">Serial Number</div>
                <div className="font-mono font-bold text-slate-800 mt-0.5">{staff.serialNo || '—'}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase text-[10px] font-semibold">Phone Number</div>
                <div className="font-mono text-slate-800 mt-0.5">{staff.phoneNumber || '—'}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase text-[10px] font-semibold">Date of Joining</div>
                <div className="text-slate-800 mt-0.5">{staff.dateOfJoining || '—'}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase text-[10px] font-semibold">Department</div>
                <div className="text-slate-800 mt-0.5 font-medium">{staff.department}</div>
              </div>
            </div>

            {/* Attendance Performance Metrics */}
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                Overall Attendance Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div className="text-[11px] text-slate-500">Working Days</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{totalWorkingDays}</div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div className="text-[11px] text-emerald-700">Present</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">{presentTotal}</div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div className="text-[11px] text-rose-700">Absent</div>
                  <div className="text-xl font-bold text-rose-700 mt-1">{absentTotal}</div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div className="text-[11px] text-amber-700">Half Day</div>
                  <div className="text-xl font-bold text-amber-700 mt-1">{halfDayTotal}</div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div className="text-[11px] text-indigo-700">Turnout %</div>
                  <div className="text-xl font-bold text-indigo-700 mt-1">{attendancePct}%</div>
                </div>
              </div>
            </div>

            {/* Leave Balance Ledger Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                Annual Leave Balances
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {leaveSummary?.categories.map((cat) => (
                  <div
                    key={cat.categoryId}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>{cat.categoryName}</span>
                      <span className="text-[11px] font-mono text-slate-500">{cat.allowed}d / yr</span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Used:</span>
                        <span className="font-semibold text-rose-600">{cat.used} days</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Remaining:</span>
                        <span className="font-bold text-emerald-700">{cat.remaining} days</span>
                      </div>
                      {cat.pending > 0 && (
                        <div className="flex justify-between text-amber-700 font-medium">
                          <span>Pending Approval:</span>
                          <span>{cat.pending} days</span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cat.used > cat.allowed
                            ? 'bg-rose-600'
                            : cat.used / cat.allowed >= 0.8
                            ? 'bg-amber-500'
                            : 'bg-blue-600'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((cat.used / (cat.allowed || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chronological History Log */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-400" />
                  <span>Chronological History Log</span>
                </h4>

                {/* Month Picker */}
                <div className="flex items-center gap-2 text-xs">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December',
                    ].map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                {filteredAttendance.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    No attendance records for {selectedMonth}/{selectedYear}.
                  </div>
                ) : (
                  filteredAttendance.map((rec) => (
                    <div key={rec.id} className="p-2.5 flex items-center justify-between hover:bg-white transition">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-slate-700">{rec.date}</span>
                        {getStatusBadge(rec.status)}
                      </div>
                      <div className="text-[11px] text-slate-400 text-right">
                        {rec.notes ? <span>{rec.notes} • </span> : null}
                        <span>by {rec.updatedBy}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
