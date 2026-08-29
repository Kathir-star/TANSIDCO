export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'casual_leave'
  | 'earn_leave'
  | 'medical_leave'
  | 'other_leave'
  | 'half_day'
  | 'holiday'
  | 'weekly_off';

export interface Staff {
  id: string;
  serialNo: string; // e.g. "001", "002"
  serialNumber?: string; // Alternate alias for serialNo
  employeeId: string; // e.g. "EMP-001" or "948"
  fullName: string;
  designation: string;
  department: string;
  phoneNumber?: string;
  phone?: string; // Alternate alias for phoneNumber
  dateOfJoining?: string;
  status: 'active' | 'inactive';
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveCategory {
  id: string;
  name: string;
  code: string; // 'casual_leave', 'earn_leave', 'medical_leave', 'other_leave'
  annualAllowance: number;
  isActive: boolean;
  description?: string;
  isDefault?: boolean;
}

export type LeaveCategoryConfig = LeaveCategory;

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveCategoryId: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  daysCount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  medicalDocumentStatus?: 'submitted' | 'not_submitted';
  medicalDocumentName?: string;
  medicalDocumentDate?: string;
  isOverridden?: boolean;
  overrideReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  category: string;
  categoryName?: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  medicalDocumentStatus?: 'submitted' | 'not_submitted';
  medicalDocumentName?: string;
  medicalDocumentDate?: string;
  createdAt?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  description?: string;
  year?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  performedBy: string;
  action: string;
  target: string;
  previousValue?: string;
  newValue?: string;
  details?: string;
  username?: string; // alias
}

export interface AuditLog {
  id: string;
  timestamp: string;
  performedBy?: string;
  username?: string;
  action: string;
  target?: string;
  details?: string;
}

export interface SystemSettings {
  officeName: string;
  officeAddress?: string;
  financialYear: string;
  workingDays: string[];
  weeklyOffDays: string[];
  autoBackupInterval?: 'daily' | 'weekly' | 'none';
  lastBackupDate?: string;
  isConfigured?: boolean;
  isSetupCompleted?: boolean;
  localServerPort?: number;
  serverIp?: string;
  sessionTimeoutMinutes?: number;
}

export type AppSettings = SystemSettings;
export type OfficeSettings = SystemSettings;

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  lastLogin?: string;
}

export interface LeaveBalanceSummary {
  categoryId: string;
  categoryName: string;
  categoryCode: string;
  allowed: number;
  used: number;
  remaining: number;
  pending: number;
  approved: number;
}

export interface StaffLeaveSummary {
  staff?: Staff;
  employeeId: string;
  fullName: string;
  department: string;
  categories: LeaveBalanceSummary[];
  totalAllowed: number;
  totalUsed: number;
  totalRemaining: number;
  totalPending: number;
}

export interface StaffAttendanceSummary {
  totalWorkingDays: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  halfDayCount: number;
  holidayCount: number;
  weeklyOffCount: number;
  attendancePercentage: number;
}

export interface MonthlyAttendanceStaffRow {
  staff: Staff;
  dayMap: Record<number, AttendanceStatus | 'none'>;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  halfDayCount: number;
  holidayCount: number;
  weeklyOffCount: number;
  attendancePercentage: number;
}

export interface MonthlyAttendanceReportItem {
  serialNo?: string;
  employeeId: string;
  fullName: string;
  department: string;
  designation: string;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  halfDays: number;
  attendancePercentage: number;
}

export interface DashboardStats {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  halfDayToday: number;
  holidayOrOffToday: number;
  unmarkedToday: number;
  attendancePercentage: number;
  date: string;
  alerts: {
    type: 'warning' | 'info' | 'danger';
    message: string;
    actionTab?: string;
  }[];
  frequentAbsentees: {
    staff: Staff;
    absenceCount: number;
    leaveCount: number;
  }[];
}

export interface PendingSyncRecord {
  id: string;
  type: 'attendance' | 'leave_request' | 'staff';
  action: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

export interface ImportHistoryRecord {
  id: string;
  importDate: string;
  importTime: string;
  importedBy: string;
  originalFileName: string;
  fileType: string;
  totalRowsDetected: number;
  validRecordsCount: number;
  updatedRecordsCount: number;
  rejectedRecordsCount: number;
  serialNumbersCorrectedCount: number;
  status: 'completed' | 'cancelled' | 'failed';
  notes?: string;
}

export interface StaffImportRowValidation {
  rowIndex: number;
  originalSerialNo?: string;
  correctedSerialNo: string;
  employeeId: string;
  fullName: string;
  designation: string;
  department: string;
  phoneNumber?: string;
  dateOfJoining?: string;
  status?: 'active' | 'inactive';
  isValid: boolean;
  isExisting: boolean;
  existingStaffName?: string;
  errors: string[];
  warnings: string[];
}

export interface StaffImportValidationResult {
  fileName: string;
  totalRecordsDetected: number;
  validRecordsCount: number;
  possibleDuplicatesCount: number;
  existingInDbCount: number;
  missingEmployeeIdCount: number;
  missingNameCount: number;
  serialNumbersCorrectedCount: number;
  rows: StaffImportRowValidation[];
}
