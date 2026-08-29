import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  MonthlyAttendanceReportItem,
  StaffLeaveSummary,
  OfficeSettings,
  Staff,
  AttendanceRecord,
  LeaveRequest,
} from '../types';

export interface ExportMonthlyAttendanceOptions {
  month: number;
  year: number;
  data: MonthlyAttendanceReportItem[];
  department?: string;
  settings?: OfficeSettings | null;
  matrixData?: { [empId: string]: { [day: number]: string } };
  isMatrixMode?: boolean;
}

export interface ExportLeaveSummaryOptions {
  data: StaffLeaveSummary[];
  financialYear?: string;
  department?: string;
  settings?: OfficeSettings | null;
}

export interface ExportDailyAttendanceOptions {
  date: string;
  data: AttendanceRecord[];
  staffList: Staff[];
  department?: string;
  settings?: OfficeSettings | null;
}

export interface ExportDepartmentSummaryOptions {
  month: number;
  year: number;
  data: {
    department: string;
    staffCount: number;
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    avgPercentage: number;
  }[];
  settings?: OfficeSettings | null;
}

export interface ExportStaffLeaveCardOptions {
  staff: Staff;
  summary: StaffLeaveSummary;
  leaveRequests?: LeaveRequest[];
  attendance?: AttendanceRecord[];
  settings?: OfficeSettings | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Adds official Government / TANSIDCO letterhead and document metadata header
 */
function addGovernmentHeader(
  doc: jsPDF,
  formCode: string,
  formTitle: string,
  ruleSubtitle: string,
  periodText: string,
  department: string = 'All Departments',
  settings?: OfficeSettings | null
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Outer decorative government double-border
  doc.setDrawColor(30, 58, 138); // Royal Navy Blue (TANSIDCO brand)
  doc.setLineWidth(0.7);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  
  doc.setDrawColor(203, 213, 225); // Subtle inner border line
  doc.setLineWidth(0.3);
  doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19);

  // Top header background bar
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(10, 10, pageWidth - 20, 26, 'F');

  // Main Government / Undertaking Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 138);
  const officeTitle = settings?.officeName
    ? `${settings.officeName.toUpperCase()}`
    : 'TAMIL NADU SMALL INDUSTRIES DEVELOPMENT CORPORATION LIMITED (TANSIDCO)';
  doc.text(officeTitle, pageWidth / 2, 15, { align: 'center' });

  // Sub-header: Government Undertaking Tag
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('(A Government of Tamil Nadu Undertaking)', pageWidth / 2, 19, { align: 'center' });

  // Address
  const officeAddress = settings?.officeAddress || 'Thiru Vi Ka Industrial Estate, Guindy, Chennai - 600 032';
  doc.setFontSize(7.5);
  doc.text(officeAddress, pageWidth / 2, 23, { align: 'center' });

  // Official Form Title Badge
  doc.setFillColor(30, 58, 138);
  const bannerWidth = Math.min(pageWidth - 60, 190);
  doc.roundedRect(pageWidth / 2 - (bannerWidth / 2), 27.5, bannerWidth, 6.5, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`${formCode}: ${formTitle.toUpperCase()}`, pageWidth / 2, 31.8, { align: 'center' });

  // Metadata information row (Period, Department, Timestamp)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  doc.text(`Period / Date: ${periodText}`, 12, 39);
  doc.text(`Dept: ${department === 'all' || !department ? 'All Corporate Departments' : department}`, pageWidth / 2, 39, { align: 'center' });
  
  const genDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const genTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  doc.text(`Generated: ${genDate} ${genTime}`, pageWidth - 12, 39, { align: 'right' });

  // Thin separator rule
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(12, 41.5, pageWidth - 12, 41.5);
}

/**
 * Adds the statutory 4-tier signature verification section required in government audit registers
 */
function addGovernmentSignatures(doc: jsPDF, finalY: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Ensure signatures fit comfortably; if near bottom of page, create a fresh page
  let y = finalY + 10;
  if (y + 32 > pageHeight - 18) {
    doc.addPage();
    y = 22;
  }

  // Statutory Certification Clause
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    '* Certified that the entries in this register have been duly examined and tallied against official muster logs and sanctioned leave orders under Tamil Nadu Fundamental Rules.',
    12,
    y
  );

  y += 9;
  const colWidth = (pageWidth - 24) / 4;

  const signatures = [
    { title: 'PREPARED BY', role: 'Establishment Assistant' },
    { title: 'CHECKED BY', role: 'Superintendent / Section Officer' },
    { title: 'VERIFIED BY', role: 'Manager (HR & Administration)' },
    { title: 'APPROVED BY', role: 'General Manager / MD' },
  ];

  signatures.forEach((sig, index) => {
    const x = 12 + colWidth * index + colWidth / 2;
    
    // Signature Line
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(x - 22, y + 10, x + 22, y + 10);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.title, x, y + 14, { align: 'center' });

    // Designation / Role
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sig.role, x, y + 18, { align: 'center' });
    doc.text('Date: ____________', x, y + 22, { align: 'center' });
  });
}

/**
 * Adds page numbering and document audit disclaimer to all pages
 */
function addFooterToAllPages(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);

    // Left: System disclaimer
    doc.text('TANSIDCO Statutory Audit Record • Staff Attendance & Leave Management System', 12, pageHeight - 11);
    // Right: Page count
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 12, pageHeight - 11, { align: 'right' });
  }
}

// ------------------------------------------------------------------------------------------------
// 1. FORM-II: Monthly Attendance Register (Summary Format)
// ------------------------------------------------------------------------------------------------
export function exportMonthlyAttendancePDF({
  month,
  year,
  data,
  department = 'all',
  settings,
}: ExportMonthlyAttendanceOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const monthName = MONTH_NAMES[month - 1];
  const periodText = `${monthName} ${year} • Financial Cycle: ${settings?.financialYear || '2026-2027'}`;

  addGovernmentHeader(
    doc,
    'FORM-II',
    'Monthly Attendance Register & Muster Summary',
    'Official Corporation Muster Roll under Tamil Nadu Factory & Establishment Rules',
    periodText,
    department,
    settings
  );

  // Totals calculations
  const totalStaff = data.length;
  const totalPresent = data.reduce((acc, curr) => acc + curr.presentDays, 0);
  const totalAbsent = data.reduce((acc, curr) => acc + curr.absentDays, 0);
  const totalLeave = data.reduce((acc, curr) => acc + curr.leaveDays, 0);
  const totalHalf = data.reduce((acc, curr) => acc + curr.halfDays, 0);
  const avgTurnout = totalStaff > 0 ? Math.round(data.reduce((acc, curr) => acc + curr.attendancePercentage, 0) / totalStaff) : 0;
  const totalWorkingDays = data[0]?.totalWorkingDays || 26;

  // Render KPI Summary Block
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, 43, doc.internal.pageSize.getWidth() - 24, 11, 1, 1, 'FD');
  doc.setDrawColor(226, 232, 240);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const kpiY = 49.5;
  const kpiSpacing = (doc.internal.pageSize.getWidth() - 24) / 5;
  
  doc.text(`Total Staff: `, 15, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalStaff}`, 30, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Working Days: `, 15 + kpiSpacing, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalWorkingDays}`, 34 + kpiSpacing, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Present: `, 15 + kpiSpacing * 2, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // Green
  doc.text(`${totalPresent}`, 33 + kpiSpacing * 2, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Absent: `, 15 + kpiSpacing * 3, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28); // Red
  doc.text(`${totalAbsent}`, 32 + kpiSpacing * 3, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Avg Turnout: `, 15 + kpiSpacing * 4, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138); // Blue
  doc.text(`${avgTurnout}%`, 32 + kpiSpacing * 4, kpiY);

  // Prepare table rows
  const tableRows = data.map((item, index) => [
    item.serialNo || String(index + 1).padStart(3, '0'),
    item.employeeId,
    item.fullName,
    item.designation || 'Staff',
    item.department || 'General',
    item.totalWorkingDays.toString(),
    item.presentDays.toString(),
    item.absentDays.toString(),
    item.leaveDays.toString(),
    item.halfDays.toString(),
    `${item.attendancePercentage}%`,
  ]);

  // Grand Total Row
  tableRows.push([
    'TOTAL',
    `Count: ${totalStaff}`,
    'CORPORATION MUSTER TOTAL',
    '—',
    '—',
    totalWorkingDays.toString(),
    totalPresent.toString(),
    totalAbsent.toString(),
    totalLeave.toString(),
    totalHalf.toString(),
    `${avgTurnout}%`,
  ]);

  autoTable(doc, {
    startY: 56,
    margin: { left: 12, right: 12, top: 44, bottom: 20 },
    head: [[
      'S.No',
      'Emp ID',
      'Employee Name',
      'Designation',
      'Department',
      'Work Days',
      'Present',
      'Absent',
      'Leave',
      'Half Day',
      'Turnout %'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      valign: 'middle',
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 38, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 30 },
      4: { halign: 'left', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 12, fontStyle: 'bold', textColor: [22, 101, 52] },
      7: { halign: 'center', cellWidth: 12, fontStyle: 'bold', textColor: [185, 28, 28] },
      8: { halign: 'center', cellWidth: 12, fontStyle: 'bold', textColor: [29, 78, 216] },
      9: { halign: 'center', cellWidth: 12, fontStyle: 'bold', textColor: [180, 83, 9] },
      10: { halign: 'center', cellWidth: 14, fontStyle: 'bold', textColor: [67, 56, 202] },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (dataCell) => {
      // Highlight summary row
      if (dataCell.row.index === tableRows.length - 1) {
        dataCell.cell.styles.fillColor = [226, 232, 240];
        dataCell.cell.styles.fontStyle = 'bold';
        dataCell.cell.styles.textColor = [15, 23, 42];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  addGovernmentSignatures(doc, finalY);
  addFooterToAllPages(doc);

  const safeFileName = `TANSIDCO_Form_II_Monthly_Attendance_${monthName}_${year}.pdf`;
  doc.save(safeFileName);
}

// ------------------------------------------------------------------------------------------------
// 2. FORM-II (B): 31-Day Daily Muster Roll Matrix (Landscape Format)
// ------------------------------------------------------------------------------------------------
export function exportMonthlyMatrixPDF({
  month,
  year,
  data,
  matrixData = {},
  department = 'all',
  settings,
}: ExportMonthlyAttendanceOptions): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const monthName = MONTH_NAMES[month - 1];
  const daysInMonth = new Date(year, month, 0).getDate();
  const periodText = `${monthName} ${year} • 31-Day Daily Muster Grid`;

  addGovernmentHeader(
    doc,
    'FORM-II (B)',
    'Daily Attendance Muster Roll Register',
    'Detailed Daily Attendance Tracking Matrix under Tamil Nadu Government Standards',
    periodText,
    department,
    settings
  );

  // Legend Bar
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const legendText = 'Legend: P = Present | A = Absent | CL = Casual Leave | EL = Earn Leave | ML = Medical Leave | OL = Other Leave | HD = Half Day | WO = Weekly Off | H = Public Holiday';
  doc.text(legendText, 12, 43.5);

  // Construct table headers
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  const head = [['S.N', 'ID', 'Employee Name', 'Dept', ...dayHeaders, 'P', 'A', 'L', 'HD', '%']];

  // Construct rows
  const tableRows = data.map((item, index) => {
    const empMatrix = matrixData[item.employeeId] || {};
    const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      return empMatrix[dayNum] || 'P';
    });

    return [
      item.serialNo || String(index + 1).padStart(3, '0'),
      item.employeeId,
      item.fullName,
      item.department || 'Gen',
      ...dayCells,
      item.presentDays.toString(),
      item.absentDays.toString(),
      item.leaveDays.toString(),
      item.halfDays.toString(),
      `${item.attendancePercentage}%`,
    ];
  });

  autoTable(doc, {
    startY: 45.5,
    margin: { left: 10, right: 10, top: 44, bottom: 20 },
    head,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 6,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 5.5,
      textColor: [30, 41, 59],
      halign: 'center',
      valign: 'middle',
      cellPadding: 0.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 11, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 32, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 16 },
      // Summary columns at end
      [4 + daysInMonth]: { halign: 'center', cellWidth: 7, fontStyle: 'bold', textColor: [22, 101, 52] },
      [5 + daysInMonth]: { halign: 'center', cellWidth: 7, fontStyle: 'bold', textColor: [185, 28, 28] },
      [6 + daysInMonth]: { halign: 'center', cellWidth: 7, fontStyle: 'bold', textColor: [29, 78, 216] },
      [7 + daysInMonth]: { halign: 'center', cellWidth: 7, fontStyle: 'bold', textColor: [180, 83, 9] },
      [8 + daysInMonth]: { halign: 'center', cellWidth: 8, fontStyle: 'bold', textColor: [67, 56, 202] },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (cellData) => {
      // Color-code attendance codes
      const val = cellData.cell.text[0];
      if (val === 'A') {
        cellData.cell.styles.fillColor = [254, 226, 226];
        cellData.cell.styles.textColor = [185, 28, 28];
        cellData.cell.styles.fontStyle = 'bold';
      } else if (['CL', 'ML', 'EL', 'OL', 'L'].includes(val)) {
        cellData.cell.styles.fillColor = [219, 234, 254];
        cellData.cell.styles.textColor = [29, 78, 216];
        cellData.cell.styles.fontStyle = 'bold';
      } else if (val === 'HD') {
        cellData.cell.styles.fillColor = [254, 243, 199];
        cellData.cell.styles.textColor = [180, 83, 9];
      } else if (val === 'WO' || val === 'H') {
        cellData.cell.styles.fillColor = [241, 245, 249];
        cellData.cell.styles.textColor = [100, 116, 139];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 140;
  addGovernmentSignatures(doc, finalY);
  addFooterToAllPages(doc);

  const safeFileName = `TANSIDCO_Form_II_B_Muster_Matrix_${monthName}_${year}.pdf`;
  doc.save(safeFileName);
}

// ------------------------------------------------------------------------------------------------
// 3. FORM-IV: Statutory Annual Leave Balance & Utilization Register
// ------------------------------------------------------------------------------------------------
export function exportLeaveSummaryPDF({
  data,
  financialYear = '2026-2027',
  department = 'all',
  settings,
}: ExportLeaveSummaryOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const periodText = `Financial Cycle: ${financialYear || settings?.financialYear || '2026-2027'}`;

  addGovernmentHeader(
    doc,
    'FORM-IV',
    'Annual Leave Balance & Utilization Register',
    'Statutory Leave Account under Tamil Nadu Fundamental Rules 81 & 82',
    periodText,
    department,
    settings
  );

  // Totals calculations
  const totalStaff = data.length;
  let totalClUsed = 0, totalClBal = 0;
  let totalElUsed = 0, totalElBal = 0;
  let totalMlUsed = 0, totalMlBal = 0;
  let totalOlUsed = 0, totalOlBal = 0;
  let totalAvailed = 0, totalRemaining = 0;

  const tableRows = data.map((b, index) => {
    const cl = b.categories.find((c) => c.categoryId === 'casual_leave' || c.categoryCode === 'casual_leave');
    const el = b.categories.find((c) => c.categoryId === 'earn_leave' || c.categoryCode === 'earn_leave');
    const ml = b.categories.find((c) => c.categoryId === 'medical_leave' || c.categoryCode === 'medical_leave');
    const ol = b.categories.find((c) => c.categoryId === 'other_leave' || c.categoryCode === 'other_leave');

    const clUsed = cl?.used || 0;
    const clBal = cl?.remaining || 0;
    const elUsed = el?.used || 0;
    const elBal = el?.remaining || 0;
    const mlUsed = ml?.used || 0;
    const mlBal = ml?.remaining || 0;
    const olUsed = ol?.used || 0;
    const olBal = ol?.remaining || 0;

    totalClUsed += clUsed;
    totalClBal += clBal;
    totalElUsed += elUsed;
    totalElBal += elBal;
    totalMlUsed += mlUsed;
    totalMlBal += mlBal;
    totalOlUsed += olUsed;
    totalOlBal += olBal;
    totalAvailed += b.totalUsed;
    totalRemaining += b.totalRemaining;

    return [
      b.staff?.serialNumber || b.staff?.serialNo || String(index + 1).padStart(3, '0'),
      b.employeeId,
      b.fullName,
      b.department || 'General',
      `${clUsed} / ${clBal}`,
      `${elUsed} / ${elBal}`,
      `${mlUsed} / ${mlBal}`,
      `${olUsed} / ${olBal}`,
      `${b.totalUsed} d`,
      `${b.totalRemaining} d`,
    ];
  });

  // KPI Summary Banner
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, 43, doc.internal.pageSize.getWidth() - 24, 11, 1, 1, 'FD');
  doc.setDrawColor(226, 232, 240);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const kpiY = 49.5;
  const kpiSpacing = (doc.internal.pageSize.getWidth() - 24) / 4;

  doc.text(`Staff Strength: `, 15, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalStaff}`, 35, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Sanctioned: `, 15 + kpiSpacing, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(`${totalAvailed} days`, 39 + kpiSpacing, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Net Balance: `, 15 + kpiSpacing * 2, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(`${totalRemaining} days`, 40 + kpiSpacing * 2, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Policy Quota: `, 15 + kpiSpacing * 3, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(`CL: 12d | EL: 15d`, 34 + kpiSpacing * 3, kpiY);

  // Append Grand Total Row
  tableRows.push([
    'TOTAL',
    `Staff: ${totalStaff}`,
    'CORPORATION CUMULATIVE BALANCE',
    '—',
    `${totalClUsed} / ${totalClBal}`,
    `${totalElUsed} / ${totalElBal}`,
    `${totalMlUsed} / ${totalMlBal}`,
    `${totalOlUsed} / ${totalOlBal}`,
    `${totalAvailed} d`,
    `${totalRemaining} d`,
  ]);

  autoTable(doc, {
    startY: 56,
    margin: { left: 12, right: 12, top: 44, bottom: 20 },
    head: [[
      'S.No',
      'Emp ID',
      'Employee Name',
      'Department',
      'Casual (CL)\nUsed / Bal',
      'Earn (EL)\nUsed / Bal',
      'Medical (ML)\nUsed / Bal',
      'Other Leave\nUsed / Bal',
      'Total\nTaken',
      'Net\nBalance'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      valign: 'middle',
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 38, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 24 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 15, fontStyle: 'bold', textColor: [185, 28, 28] },
      9: { halign: 'center', cellWidth: 15, fontStyle: 'bold', textColor: [22, 101, 52] },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (dataCell) => {
      // Highlight summary row
      if (dataCell.row.index === tableRows.length - 1) {
        dataCell.cell.styles.fillColor = [226, 232, 240];
        dataCell.cell.styles.fontStyle = 'bold';
        dataCell.cell.styles.textColor = [15, 23, 42];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  addGovernmentSignatures(doc, finalY);
  addFooterToAllPages(doc);

  const safeFileName = `TANSIDCO_Form_IV_Leave_Summary_${financialYear.replace('/', '-')}.pdf`;
  doc.save(safeFileName);
}

// ------------------------------------------------------------------------------------------------
// 4. FORM-I: Daily Attendance Log Register (For Daily Log Tab)
// ------------------------------------------------------------------------------------------------
export function exportDailyAttendancePDF({
  date,
  data,
  staffList,
  department = 'all',
  settings,
}: ExportDailyAttendanceOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const dateFormatted = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  addGovernmentHeader(
    doc,
    'FORM-I',
    'Daily Attendance Muster Roll Register',
    'Official Daily Log Sheet under Tamil Nadu State Government Rules',
    dateFormatted,
    department,
    settings
  );

  // Filter if department specified
  const filteredData = data.filter((d) => {
    const s = staffList.find((st) => st.employeeId === d.employeeId);
    if (!s) return false;
    if (department !== 'all' && s.department !== department) return false;
    return true;
  });

  const total = filteredData.length;
  const present = filteredData.filter((d) => d.status === 'present').length;
  const absent = filteredData.filter((d) => d.status === 'absent').length;
  const onLeave = filteredData.filter((d) => ['casual_leave', 'earn_leave', 'medical_leave', 'other_leave'].includes(d.status)).length;
  const halfDay = filteredData.filter((d) => d.status === 'half_day').length;
  const turnoutPct = total > 0 ? Math.round(((present + halfDay * 0.5) / total) * 100) : 0;

  // KPI Summary Bar
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, 43, doc.internal.pageSize.getWidth() - 24, 11, 1, 1, 'FD');
  doc.setDrawColor(226, 232, 240);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const kpiY = 49.5;
  const kpiSpacing = (doc.internal.pageSize.getWidth() - 24) / 5;

  doc.text(`Total Staff: `, 15, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${total}`, 30, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Present: `, 15 + kpiSpacing, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(`${present}`, 27 + kpiSpacing, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Absent: `, 15 + kpiSpacing * 2, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(`${absent}`, 26 + kpiSpacing * 2, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`On Leave: `, 15 + kpiSpacing * 3, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text(`${onLeave}`, 28 + kpiSpacing * 3, kpiY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Daily Turnout: `, 15 + kpiSpacing * 4, kpiY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(`${turnoutPct}%`, 33 + kpiSpacing * 4, kpiY);

  // Table rows
  const tableRows = filteredData.map((d, index) => {
    const s = staffList.find((st) => st.employeeId === d.employeeId);
    let statusDisplay = d.status.toUpperCase().replace('_', ' ');
    if (d.status === 'casual_leave') statusDisplay = 'CASUAL LEAVE (CL)';
    else if (d.status === 'earn_leave') statusDisplay = 'EARNED LEAVE (EL)';
    else if (d.status === 'medical_leave') statusDisplay = 'MEDICAL LEAVE (ML)';
    else if (d.status === 'other_leave') statusDisplay = 'OTHER LEAVE (OL)';

    return [
      s?.serialNumber || s?.serialNo || String(index + 1).padStart(3, '0'),
      d.employeeId,
      s?.fullName || d.employeeId,
      s?.designation || 'Staff',
      s?.department || 'General',
      statusDisplay,
      d.notes || '—',
    ];
  });

  autoTable(doc, {
    startY: 56,
    margin: { left: 12, right: 12, top: 44, bottom: 20 },
    head: [[
      'S.No',
      'Emp ID',
      'Employee Name',
      'Designation',
      'Department',
      'Attendance Status',
      'Remarks / Sanction Notes'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      valign: 'middle',
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 32 },
      4: { halign: 'left', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 32, fontStyle: 'bold' },
      6: { halign: 'left', cellWidth: 26 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (dataCell) => {
      if (dataCell.column.index === 5) {
        const text = dataCell.cell.text[0] || '';
        if (text.includes('PRESENT')) {
          dataCell.cell.styles.textColor = [22, 101, 52];
        } else if (text.includes('ABSENT')) {
          dataCell.cell.styles.textColor = [185, 28, 28];
        } else if (text.includes('LEAVE')) {
          dataCell.cell.styles.textColor = [29, 78, 216];
        } else if (text.includes('HALF')) {
          dataCell.cell.styles.textColor = [180, 83, 9];
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  addGovernmentSignatures(doc, finalY);
  addFooterToAllPages(doc);

  const safeFileName = `TANSIDCO_Form_I_Daily_Attendance_${date}.pdf`;
  doc.save(safeFileName);
}

// ------------------------------------------------------------------------------------------------
// 5. FORM-V: Departmental Attendance Breakdown Register
// ------------------------------------------------------------------------------------------------
export function exportDepartmentSummaryPDF({
  month,
  year,
  data,
  settings,
}: ExportDepartmentSummaryOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const monthName = MONTH_NAMES[month - 1];
  const periodText = `${monthName} ${year} • Departmental Muster Audit`;

  addGovernmentHeader(
    doc,
    'FORM-V',
    'Departmental Attendance & Turnout Summary',
    'Executive Corporate Muster Breakdown by Department',
    periodText,
    'All Corporate Departments',
    settings
  );

  const totalStaff = data.reduce((acc, d) => acc + d.staffCount, 0);
  const totalPresent = data.reduce((acc, d) => acc + d.presentCount, 0);
  const totalAbsent = data.reduce((acc, d) => acc + d.absentCount, 0);
  const totalLeave = data.reduce((acc, d) => acc + d.leaveCount, 0);
  const avgTurnout = data.length > 0 ? Math.round(data.reduce((acc, d) => acc + d.avgPercentage, 0) / data.length) : 0;

  const tableRows = data.map((d, index) => [
    String(index + 1).padStart(2, '0'),
    d.department,
    `${d.staffCount} Officers / Staff`,
    d.presentCount.toString(),
    d.absentCount.toString(),
    d.leaveCount.toString(),
    `${d.avgPercentage}%`,
    d.avgPercentage >= 90 ? 'EXCELLENT' : d.avgPercentage >= 75 ? 'SATISFACTORY' : 'ATTENTION REQ',
  ]);

  tableRows.push([
    'TOTAL',
    'CORPORATE MUSTER TOTAL',
    `${totalStaff} Officers / Staff`,
    totalPresent.toString(),
    totalAbsent.toString(),
    totalLeave.toString(),
    `${avgTurnout}%`,
    'OVERALL MUSTER',
  ]);

  autoTable(doc, {
    startY: 46,
    margin: { left: 12, right: 12, top: 44, bottom: 20 },
    head: [[
      'S.No',
      'Department Name',
      'Sanctioned Strength',
      'Present Days',
      'Absent Days',
      'Leave Days',
      'Turnout %',
      'Audit Rating'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      valign: 'middle',
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 20, fontStyle: 'bold', textColor: [22, 101, 52] },
      4: { halign: 'center', cellWidth: 20, fontStyle: 'bold', textColor: [185, 28, 28] },
      5: { halign: 'center', cellWidth: 20, fontStyle: 'bold', textColor: [29, 78, 216] },
      6: { halign: 'center', cellWidth: 18, fontStyle: 'bold', textColor: [67, 56, 202] },
      7: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (dataCell) => {
      if (dataCell.row.index === tableRows.length - 1) {
        dataCell.cell.styles.fillColor = [226, 232, 240];
        dataCell.cell.styles.fontStyle = 'bold';
        dataCell.cell.styles.textColor = [15, 23, 42];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  addGovernmentSignatures(doc, finalY);
  addFooterToAllPages(doc);

  const safeFileName = `TANSIDCO_Form_V_Departmental_Summary_${monthName}_${year}.pdf`;
  doc.save(safeFileName);
}

// ------------------------------------------------------------------------------------------------
// 6. FORM-VI: Individual Staff Service Leave Card (Service Book Extract)
// ------------------------------------------------------------------------------------------------
export function exportIndividualStaffLeaveCardPDF({
  staff,
  summary,
  leaveRequests = [],
  settings,
}: ExportStaffLeaveCardOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const periodText = `Financial Cycle: ${settings?.financialYear || '2026-2027'} • Service Register Record`;

  addGovernmentHeader(
    doc,
    'FORM-VI',
    'Individual Staff Leave Card & Service Extract',
    'Statutory Service Book Leave Ledger under Tamil Nadu Fundamental Rules',
    periodText,
    staff.department || 'General',
    settings
  );

  // Staff Bio-data Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, 43, doc.internal.pageSize.getWidth() - 24, 20, 1, 1, 'FD');
  doc.setDrawColor(226, 232, 240);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text(`${staff.fullName.toUpperCase()} (${staff.employeeId})`, 16, 48.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Designation: ${staff.designation || 'Staff'}`, 16, 54);
  doc.text(`Department: ${staff.department || 'General'}`, 16, 59);

  doc.text(`Date of Joining: ${staff.dateOfJoining || '—'}`, 100, 54);
  doc.text(`Status: ${staff.status.toUpperCase()}`, 100, 59);

  doc.text(`Contact: ${staff.phoneNumber || staff.phone || '—'}`, 150, 54);
  doc.text(`Muster S.No: ${staff.serialNumber || staff.serialNo || '—'}`, 150, 59);

  // Category Balances Table
  const catRows = summary.categories.map((c) => [
    c.categoryName,
    `${c.allowed} days`,
    `${c.used} days`,
    `${c.remaining} days`,
    `${Math.round((c.remaining / (c.allowed || 1)) * 100)}%`,
  ]);

  catRows.push([
    'TOTAL CUMULATIVE LEAVE',
    `${summary.totalAllowed} days`,
    `${summary.totalUsed} days`,
    `${summary.totalRemaining} days`,
    `${Math.round((summary.totalRemaining / (summary.totalAllowed || 1)) * 100)}%`,
  ]);

  autoTable(doc, {
    startY: 66,
    margin: { left: 12, right: 12, top: 44, bottom: 20 },
    head: [[
      'Leave Category',
      'Annual Quota',
      'Sanctioned / Used',
      'Available Balance',
      'Balance Pct'
    ]],
    body: catRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      halign: 'center',
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      2: { fontStyle: 'bold', textColor: [185, 28, 28] },
      3: { fontStyle: 'bold', textColor: [22, 101, 52] },
    },
    didParseCell: (cell) => {
      if (cell.row.index === catRows.length - 1) {
        cell.cell.styles.fillColor = [226, 232, 240];
        cell.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // Leave Requests History Table
  let nextY = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  doc.text('SANCTIONED LEAVE APPLICATIONS & SANCTION ORDERS', 12, nextY);

  const empRequests = leaveRequests.filter((r) => r.employeeId === staff.employeeId);
  const reqRows = empRequests.map((r, i) => [
    String(i + 1),
    r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '—',
    r.leaveCategoryId.toUpperCase().replace('_', ' '),
    `${r.fromDate} to ${r.toDate}`,
    `${r.daysCount} days`,
    r.status.toUpperCase(),
    r.medicalDocumentStatus === 'submitted' ? 'YES (Verified)' : 'NO / N.A.',
    r.reason || 'Personal / Official',
  ]);

  if (reqRows.length === 0) {
    reqRows.push(['1', '—', 'No leave applications recorded in current cycle', '—', '0 d', '—', '—', '—']);
  }

  autoTable(doc, {
    startY: nextY + 2,
    margin: { left: 12, right: 12, top: 44, bottom: 20 },
    head: [[
      '#',
      'Applied Date',
      'Leave Type',
      'Duration (From - To)',
      'Days',
      'Status',
      'Med Cert',
      'Reason'
    ]],
    body: reqRows,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 6.5,
      textColor: [30, 41, 59],
      cellPadding: 1,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'left', cellWidth: 26, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 32 },
      4: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'left', cellWidth: 42 },
    },
    didParseCell: (cell) => {
      if (cell.column.index === 5) {
        const txt = cell.cell.text[0];
        if (txt === 'APPROVED') cell.cell.styles.textColor = [22, 101, 52];
        else if (txt === 'REJECTED') cell.cell.styles.textColor = [185, 28, 28];
        else if (txt === 'PENDING') cell.cell.styles.textColor = [180, 83, 9];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  addGovernmentSignatures(doc, finalY);
  addFooterToAllPages(doc);

  const safeFileName = `TANSIDCO_Staff_Leave_Card_${staff.employeeId}_${staff.fullName.replace(/\s+/g, '_')}.pdf`;
  doc.save(safeFileName);
}
