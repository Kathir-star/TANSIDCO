import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  Users,
  Building,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Table,
  FileText,
  FileDown,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Staff, AttendanceRecord, MonthlyAttendanceReportItem, StaffLeaveSummary } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  exportMonthlyAttendancePDF,
  exportMonthlyMatrixPDF,
  exportLeaveSummaryPDF,
  exportDailyAttendancePDF,
  exportDepartmentSummaryPDF,
} from '../utils/pdfExport';
import Papa from 'papaparse';

interface ReportsProps {
  onSelectStaff: (staff: Staff) => void;
}

export const Reports: React.FC<ReportsProps> = ({ onSelectStaff }) => {
  const { showToast, settings } = useAuth();
  const [reportType, setReportType] = useState<
    'daily' | 'monthly_summary' | 'monthly_register' | 'leave_balance' | 'department_summary'
  >('monthly_summary');

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data states
  const [monthlyData, setMonthlyData] = useState<MonthlyAttendanceReportItem[]>([]);
  const [dailyData, setDailyData] = useState<AttendanceRecord[]>([]);
  const [allBalances, setAllBalances] = useState<StaffLeaveSummary[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [matrixData, setMatrixData] = useState<{ [empId: string]: { [day: number]: string } }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const [staffData] = await Promise.all([api.getStaffList(true)]);
      setStaffList(staffData);

      if (reportType === 'monthly_summary' || reportType === 'monthly_register') {
        const mData = await api.getMonthlyReport(selectedYear, selectedMonth);
        setMonthlyData(mData);

        // Fetch matrix for month
        const startDay = 1;
        const totalDaysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const monthStr = String(selectedMonth).padStart(2, '0');

        const matrix: { [empId: string]: { [day: number]: string } } = {};
        for (const item of mData) {
          const empAttendance = await api.getAttendanceForStaff(item.employeeId);
          const empMonthAtt = empAttendance.filter((a) => a.date.startsWith(`${selectedYear}-${monthStr}`));
          matrix[item.employeeId] = {};
          empMonthAtt.forEach((rec) => {
            const dayNum = parseInt(rec.date.split('-')[2], 10);
            let code = 'P';
            if (rec.status === 'absent') code = 'A';
            else if (rec.status === 'casual_leave') code = 'CL';
            else if (rec.status === 'earn_leave') code = 'EL';
            else if (rec.status === 'medical_leave') code = 'ML';
            else if (rec.status === 'other_leave') code = 'OL';
            else if (rec.status === 'half_day') code = 'HD';
            else if (rec.status === 'holiday') code = 'H';
            else if (rec.status === 'weekly_off') code = 'WO';
            matrix[item.employeeId][dayNum] = code;
          });
        }
        setMatrixData(matrix);
      } else if (reportType === 'daily') {
        const dData = await api.getAttendanceForDate(selectedDate);
        setDailyData(dData);
      } else if (reportType === 'leave_balance' || reportType === 'department_summary') {
        const balances = await api.getAllStaffLeaveBalances();
        setAllBalances(balances);
        const mData = await api.getMonthlyReport(selectedYear, selectedMonth);
        setMonthlyData(mData);
      }
    } catch (err) {
      showToast('error', 'Failed to generate report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, selectedMonth, selectedYear, selectedDate]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [staffList]);

  // Export CSV
  const handleExportCSV = () => {
    let csvRows: any[] = [];
    const dateFormatted = `${monthNames[selectedMonth - 1]}_${selectedYear}`;

    if (reportType === 'monthly_summary') {
      csvRows = filteredMonthlyData.map((item) => ({
        'Serial No': item.serialNo,
        'Employee ID': item.employeeId,
        'Full Name': item.fullName,
        Department: item.department,
        Designation: item.designation,
        'Working Days': item.totalWorkingDays,
        'Present Days': item.presentDays,
        'Absent Days': item.absentDays,
        'Leave Days': item.leaveDays,
        'Half Days': item.halfDays,
        'Attendance Pct': `${item.attendancePercentage}%`,
      }));
    } else if (reportType === 'daily') {
      csvRows = filteredDailyData.map((d) => {
        const staff = staffList.find((s) => s.employeeId === d.employeeId);
        return {
          Date: d.date,
          'Employee ID': d.employeeId,
          'Full Name': staff?.fullName || '',
          Department: staff?.department || '',
          Status: d.status.toUpperCase(),
          Notes: d.notes || '',
        };
      });
    } else if (reportType === 'leave_balance') {
      csvRows = filteredLeaveBalanceData.map((b) => {
        const obj: any = {
          'Employee ID': b.employeeId,
          'Full Name': b.fullName,
          Department: b.department,
          'Total Allowed': b.totalAllowed,
          'Total Taken': b.totalUsed,
          'Total Remaining': b.totalRemaining,
        };
        b.categories.forEach((cat) => {
          obj[`${cat.categoryName} Allowed`] = cat.allowed;
          obj[`${cat.categoryName} Used`] = cat.used;
          obj[`${cat.categoryName} Remaining`] = cat.remaining;
        });
        return obj;
      });
    } else if (reportType === 'department_summary') {
      csvRows = departmentSummaryStats.map((d) => ({
        Department: d.department,
        'Staff Count': d.staffCount,
        'Total Present': d.presentCount,
        'Total Absent': d.absentCount,
        'Total Leave': d.leaveCount,
        'Average Attendance %': `${d.avgPercentage}%`,
      }));
    }

    const csvString = Papa.unparse(csvRows);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}_report_${dateFormatted}.csv`;
    link.click();
    showToast('success', `Exported ${csvRows.length} rows to CSV.`);
  };

  // Export to Formatted Government PDF
  const handleExportPDF = (overrideType?: 'monthly' | 'leave' | 'matrix' | 'daily' | 'department') => {
    setIsExportingPDF(true);
    try {
      const type =
        overrideType ||
        (reportType === 'leave_balance'
          ? 'leave'
          : reportType === 'monthly_register'
          ? 'matrix'
          : reportType === 'daily'
          ? 'daily'
          : reportType === 'department_summary'
          ? 'department'
          : 'monthly');

      if (type === 'monthly') {
        if (filteredMonthlyData.length === 0) {
          showToast('error', 'No monthly attendance data available to export.');
          return;
        }
        exportMonthlyAttendancePDF({
          month: selectedMonth,
          year: selectedYear,
          data: filteredMonthlyData,
          department: selectedDepartment,
          settings,
        });
        showToast(
          'success',
          `Form-II: Monthly Attendance Register PDF generated (${monthNames[selectedMonth - 1]} ${selectedYear}).`,
          'PDF Downloaded'
        );
      } else if (type === 'matrix') {
        if (filteredMonthlyData.length === 0) {
          showToast('error', 'No monthly matrix data available to export.');
          return;
        }
        exportMonthlyMatrixPDF({
          month: selectedMonth,
          year: selectedYear,
          data: filteredMonthlyData,
          matrixData,
          department: selectedDepartment,
          settings,
        });
        showToast(
          'success',
          `Form-II (B): Detailed Daily Muster Roll Matrix PDF generated.`,
          'PDF Downloaded'
        );
      } else if (type === 'leave') {
        if (filteredLeaveBalanceData.length === 0) {
          showToast('error', 'No leave summary data available to export.');
          return;
        }
        exportLeaveSummaryPDF({
          data: filteredLeaveBalanceData,
          financialYear: settings?.financialYear || '2026-2027',
          department: selectedDepartment,
          settings,
        });
        showToast(
          'success',
          `Form-IV: Statutory Annual Leave Summary & Balances PDF generated.`,
          'PDF Downloaded'
        );
      } else if (type === 'daily') {
        if (filteredDailyData.length === 0) {
          showToast('error', `No attendance logs found for date ${selectedDate}.`);
          return;
        }
        exportDailyAttendancePDF({
          date: selectedDate,
          data: filteredDailyData,
          staffList,
          department: selectedDepartment,
          settings,
        });
        showToast(
          'success',
          `Form-I: Daily Attendance Muster PDF generated for ${selectedDate}.`,
          'PDF Downloaded'
        );
      } else if (type === 'department') {
        if (departmentSummaryStats.length === 0) {
          showToast('error', 'No department breakdown data available.');
          return;
        }
        exportDepartmentSummaryPDF({
          month: selectedMonth,
          year: selectedYear,
          data: departmentSummaryStats,
          settings,
        });
        showToast(
          'success',
          `Form-V: Department Attendance & Turnout Summary PDF generated.`,
          'PDF Downloaded'
        );
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate PDF document.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Filtered monthly data
  const filteredMonthlyData = useMemo(() => {
    return monthlyData.filter((item) => {
      if (selectedDepartment !== 'all' && item.department !== selectedDepartment) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.employeeId.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        item.designation.toLowerCase().includes(q)
      );
    });
  }, [monthlyData, selectedDepartment, searchQuery]);

  // Filtered daily data
  const filteredDailyData = useMemo(() => {
    return dailyData.filter((d) => {
      const staff = staffList.find((s) => s.employeeId === d.employeeId);
      if (!staff) return false;
      if (selectedDepartment !== 'all' && staff.department !== selectedDepartment) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        staff.fullName.toLowerCase().includes(q) ||
        staff.employeeId.toLowerCase().includes(q) ||
        staff.department.toLowerCase().includes(q)
      );
    });
  }, [dailyData, staffList, selectedDepartment, searchQuery]);

  // Filtered leave balance data
  const filteredLeaveBalanceData = useMemo(() => {
    return allBalances.filter((b) => {
      if (selectedDepartment !== 'all' && b.department !== selectedDepartment) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        b.fullName.toLowerCase().includes(q) ||
        b.employeeId.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q)
      );
    });
  }, [allBalances, selectedDepartment, searchQuery]);

  // Department summary calculations
  const departmentSummaryStats = useMemo(() => {
    const map: { [dept: string]: { staffCount: number; present: number; absent: number; leave: number; pctSum: number } } = {};

    monthlyData.forEach((item) => {
      const dept = item.department || 'General';
      if (!map[dept]) {
        map[dept] = { staffCount: 0, present: 0, absent: 0, leave: 0, pctSum: 0 };
      }
      map[dept].staffCount++;
      map[dept].present += item.presentDays;
      map[dept].absent += item.absentDays;
      map[dept].leave += item.leaveDays;
      map[dept].pctSum += item.attendancePercentage;
    });

    return Object.entries(map).map(([dept, val]) => ({
      department: dept,
      staffCount: val.staffCount,
      presentCount: val.present,
      absentCount: val.absent,
      leaveCount: val.leave,
      avgPercentage: val.staffCount > 0 ? Math.round(val.pctSum / val.staffCount) : 0,
    }));
  }, [monthlyData]);

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="space-y-4 animate-in fade-in duration-200 print:space-y-2">
      {/* Top Header & Navigation */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <span>Attendance & Leave Reports</span>
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>TN Govt Formats</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready monthly registers, individual staff balance sheets, and statutory Form-II / Form-IV export.
          </p>
        </div>

        {/* Quick Government PDF Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="export-form2-pdf-btn"
            onClick={() => handleExportPDF('monthly')}
            disabled={isExportingPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            title="Download Form-II: Monthly Attendance Register PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Form-II Monthly Attendance (PDF)</span>
          </button>

          <button
            id="export-form2b-pdf-btn"
            onClick={() => handleExportPDF('matrix')}
            disabled={isExportingPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            title="Download Form-II (B): Detailed Daily Muster Roll Matrix (Landscape) PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Form-II (B) Muster Grid (PDF)</span>
          </button>

          <button
            id="export-form4-pdf-btn"
            onClick={() => handleExportPDF('leave')}
            disabled={isExportingPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            title="Download Form-IV: Statutory Annual Leave Balance & Utilization Register PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Form-IV Leave Summary (PDF)</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            id="tab-monthly-summary"
            onClick={() => setReportType('monthly_summary')}
            className={`px-3 py-1.5 rounded-md transition ${
              reportType === 'monthly_summary'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Summary (Form-II)
          </button>
          <button
            id="tab-monthly-register"
            onClick={() => setReportType('monthly_register')}
            className={`px-3 py-1.5 rounded-md transition ${
              reportType === 'monthly_register'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            31-Day Muster Matrix
          </button>
          <button
            id="tab-daily-sheet"
            onClick={() => setReportType('daily')}
            className={`px-3 py-1.5 rounded-md transition ${
              reportType === 'daily'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily Log Sheet
          </button>
          <button
            id="tab-leave-balance"
            onClick={() => setReportType('leave_balance')}
            className={`px-3 py-1.5 rounded-md transition ${
              reportType === 'leave_balance'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Leave Balances (Form-IV)
          </button>
          <button
            id="tab-dept-summary"
            onClick={() => setReportType('department_summary')}
            className={`px-3 py-1.5 rounded-md transition ${
              reportType === 'department_summary'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Department Breakdown
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>FY {settings?.financialYear || '2026-2027'} Cycle</span>
        </div>
      </div>

      {/* Filter and Date Controls Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between print:hidden">
        {/* Month/Year or Date Pickers */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {reportType === 'daily' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Period:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-slate-500">Dept:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-xs bg-white text-slate-800"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search & Export Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="relative w-full md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in report..."
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded border border-slate-300"
            />
          </div>

          <button
            id="toolbar-export-pdf-btn"
            onClick={() => handleExportPDF()}
            disabled={isExportingPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            title="Download formatted Government Audit PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{isExportingPDF ? 'Generating...' : 'Export PDF'}</span>
          </button>

          <button
            id="toolbar-export-csv-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 transition cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            id="toolbar-print-btn"
            onClick={() => window.print()}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition shadow cursor-pointer"
            title="Print Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Official Print Header (Visible on print) */}
      <div className="hidden print:block text-center border-b pb-3 mb-4">
        <h1 className="text-xl font-bold">{settings?.officeName || 'Staff Attendance System'}</h1>
        <h2 className="text-sm font-semibold capitalize mt-0.5">
          {reportType.replace('_', ' ')} — {reportType === 'daily' ? selectedDate : `${monthNames[selectedMonth - 1]} ${selectedYear}`}
        </h2>
        <div className="text-xs text-slate-500 mt-0.5">
          Generated on: {new Date().toLocaleString()} • Department: {selectedDepartment}
        </div>
      </div>

      {/* Report Content Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Generating report...</div>
        ) : (
          <>
            {/* 1. Monthly Summary Report */}
            {reportType === 'monthly_summary' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center">S.No</th>
                      <th className="py-3 px-3 w-28">Emp ID</th>
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-center">Working Days</th>
                      <th className="py-3 px-3 text-center text-emerald-700">Present</th>
                      <th className="py-3 px-3 text-center text-rose-700">Absent</th>
                      <th className="py-3 px-3 text-center text-blue-700">Leave</th>
                      <th className="py-3 px-3 text-center text-amber-700">Half Day</th>
                      <th className="py-3 px-3 text-center text-indigo-700 font-bold">Turnout %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMonthlyData.map((item, idx) => {
                      const staff = staffList.find((s) => s.employeeId === item.employeeId);
                      return (
                        <tr key={item.employeeId} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-3 text-center font-mono text-slate-500">
                            {item.serialNo || idx + 1}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {item.employeeId}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {staff ? (
                              <button
                                onClick={() => onSelectStaff(staff)}
                                className="hover:text-blue-600 hover:underline text-left print:pointer-events-none"
                              >
                                {item.fullName}
                              </button>
                            ) : (
                              item.fullName
                            )}
                            <div className="text-[10px] text-slate-400 font-normal">
                              {item.designation}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700">{item.department}</td>
                          <td className="py-3 px-3 text-center font-medium">{item.totalWorkingDays}</td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-700">
                            {item.presentDays}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-rose-700">
                            {item.absentDays}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-blue-700">
                            {item.leaveDays}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-amber-700">
                            {item.halfDays}
                          </td>
                          <td className="py-3 px-3 text-center font-extrabold text-indigo-700">
                            {item.attendancePercentage}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. Monthly Matrix Register Grid (1 to 31) */}
            {reportType === 'monthly_register' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] text-slate-700 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[9px] font-semibold">
                    <tr>
                      <th className="py-2.5 px-2 w-8 text-center border-r">#</th>
                      <th className="py-2.5 px-2 w-20 border-r">ID</th>
                      <th className="py-2.5 px-3 w-40 border-r">Name</th>
                      {daysArray.map((d) => (
                        <th key={d} className="py-2 px-1 text-center w-6 border-r text-[9px]">
                          {d}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center text-emerald-700 font-bold border-r">P</th>
                      <th className="py-2.5 px-2 text-center text-rose-700 font-bold">A</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMonthlyData.map((item, idx) => (
                      <tr key={item.employeeId} className="hover:bg-slate-50">
                        <td className="py-2 px-2 text-center font-mono text-slate-400 border-r">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2 font-mono font-bold text-slate-800 border-r">
                          {item.employeeId}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900 border-r truncate max-w-[140px]">
                          {item.fullName}
                        </td>
                        {daysArray.map((d) => {
                          const code = matrixData[item.employeeId]?.[d] || '—';
                          let cellBg = '';
                          if (code === 'P') cellBg = 'text-emerald-700 font-bold';
                          else if (code === 'A') cellBg = 'bg-rose-100 text-rose-800 font-bold';
                          else if (['CL', 'ML', 'OL'].includes(code)) cellBg = 'bg-blue-100 text-blue-800 font-semibold';
                          else if (code === 'HD') cellBg = 'bg-amber-100 text-amber-800 font-semibold';
                          else if (code === 'WO') cellBg = 'bg-slate-100 text-slate-400';
                          else if (code === 'H') cellBg = 'bg-teal-100 text-teal-800 font-bold';

                          return (
                            <td key={d} className={`py-1 px-1 text-center border-r text-[10px] ${cellBg}`}>
                              {code}
                            </td>
                          );
                        })}
                        <td className="py-2 px-2 text-center font-bold text-emerald-700 border-r">
                          {item.presentDays}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-rose-700">
                          {item.absentDays}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Daily Attendance Sheet */}
            {reportType === 'daily' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center">S.No</th>
                      <th className="py-3 px-3 w-28">Emp ID</th>
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Remarks / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDailyData.map((rec, idx) => {
                      const staff = staffList.find((s) => s.employeeId === rec.employeeId);
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 text-center font-mono text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {rec.employeeId}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {staff?.fullName || rec.employeeId}
                          </td>
                          <td className="py-3 px-3 text-slate-600">{staff?.department}</td>
                          <td className="py-3 px-3 font-bold uppercase">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                rec.status === 'present'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rec.status === 'absent'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {rec.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">{rec.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. Annual Leave Balance Sheet */}
            {reportType === 'leave_balance' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-3 w-28">Emp ID</th>
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-center">Casual (Used/Bal)</th>
                      <th className="py-3 px-3 text-center">Medical (Used/Bal)</th>
                      <th className="py-3 px-3 text-center">Other (Used/Bal)</th>
                      <th className="py-3 px-3 text-center text-rose-700 font-bold">Total Taken</th>
                      <th className="py-3 px-3 text-center text-emerald-700 font-extrabold">Total Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeaveBalanceData.map((bal) => {
                      const cl = bal.categories.find((c) => c.categoryId === 'casual_leave');
                      const ml = bal.categories.find((c) => c.categoryId === 'medical_leave');
                      const ol = bal.categories.find((c) => c.categoryId === 'other_leave');

                      return (
                        <tr key={bal.employeeId} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {bal.employeeId}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{bal.fullName}</td>
                          <td className="py-3 px-3 text-slate-600">{bal.department}</td>
                          <td className="py-3 px-3 text-center font-mono">
                            {cl?.used || 0} / <strong className="text-emerald-700">{cl?.remaining || 0}</strong>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {ml?.used || 0} / <strong className="text-emerald-700">{ml?.remaining || 0}</strong>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {ol?.used || 0} / <strong className="text-emerald-700">{ol?.remaining || 0}</strong>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-rose-700">
                            {bal.totalUsed} days
                          </td>
                          <td className="py-3 px-3 text-center font-extrabold text-emerald-700">
                            {bal.totalRemaining} days
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. Department Breakdown */}
            {reportType === 'department_summary' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Department Name</th>
                      <th className="py-3 px-3 text-center">Staff Count</th>
                      <th className="py-3 px-3 text-center text-emerald-700 font-bold">Total Present Days</th>
                      <th className="py-3 px-3 text-center text-rose-700 font-bold">Total Absent Days</th>
                      <th className="py-3 px-3 text-center text-blue-700 font-semibold">Total Leave Days</th>
                      <th className="py-3 px-4 text-center text-indigo-700 font-extrabold">Department Turnout %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departmentSummaryStats.map((d) => (
                      <tr key={d.department} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{d.department}</td>
                        <td className="py-3.5 px-3 text-center font-medium">{d.staffCount} staff</td>
                        <td className="py-3.5 px-3 text-center font-bold text-emerald-700">{d.presentCount}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-rose-700">{d.absentCount}</td>
                        <td className="py-3.5 px-3 text-center font-semibold text-blue-700">{d.leaveCount}</td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-indigo-700 text-sm">
                          {d.avgPercentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
