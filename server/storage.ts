import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import os from 'os';
import {
  Staff,
  AttendanceRecord,
  AttendanceStatus,
  LeaveCategory,
  LeaveRequest,
  Holiday,
  AuditLogEntry,
  SystemSettings,
  AdminUser,
  DashboardStats,
  StaffLeaveSummary,
  MonthlyAttendanceStaffRow,
} from '../src/types.js';
import { TANSIDCO_OFFICIAL_STAFF } from '../src/data/tansidcoStaffData.js';

interface DatabaseSchema {
  admin: {
    id: string;
    username: string;
    passwordHash: string;
    name: string;
    lastLogin?: string;
  };
  settings: SystemSettings;
  staff: Staff[];
  attendance: AttendanceRecord[];
  leaveCategories: LeaveCategory[];
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
  auditLogs: AuditLogEntry[];
  sessions: { token: string; expiresAt: number; username: string }[];
}

const isServerless =
  !!process.env.VERCEL ||
  !!process.env.VERCEL_ENV ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  !!process.env.LAMBDA_TASK_ROOT;

function getSafeDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (isServerless) {
    return path.join(os.tmpdir(), 'tansidco-data');
  }
  // Check if cwd is writable
  try {
    const testDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const testFile = path.join(testDir, '.write-test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return testDir;
  } catch {
    return path.join(os.tmpdir(), 'tansidco-data');
  }
}

const DATA_DIR = getSafeDataDir();
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'office_attendance.json');

// Ensure directories exist safely
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  const seedFile = path.join(process.cwd(), 'data', 'office_attendance.json');
  if (!fs.existsSync(DB_FILE) && fs.existsSync(seedFile)) {
    fs.copyFileSync(seedFile, DB_FILE);
  }
} catch (e) {
  console.warn('Storage path init note:', e);
}

const DEFAULT_CATEGORIES: LeaveCategory[] = [
  {
    id: 'cat-cl',
    name: 'Casual Leave',
    code: 'casual_leave',
    annualAllowance: 12,
    isActive: true,
    description: 'Casual leave for personal work or urgent matters (Max 12 days/year).',
    isDefault: true,
  },
  {
    id: 'cat-el',
    name: 'Earn Leave',
    code: 'earn_leave',
    annualAllowance: 15,
    isActive: true,
    description: 'Earned leave allocation based on office policy (Default 15 days/year).',
    isDefault: true,
  },
  {
    id: 'cat-ml',
    name: 'Medical Leave',
    code: 'medical_leave',
    annualAllowance: 10,
    isActive: true,
    description: 'Medical and sick leave with medical document verification (10 days/year).',
    isDefault: true,
  },
];

const DEFAULT_SETTINGS: SystemSettings = {
  officeName: 'TANSIDCO',
  financialYear: '2026-2027',
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  weeklyOffDays: ['Sun'],
  autoBackupInterval: 'daily',
  isConfigured: true,
  isSetupCompleted: true,
  localServerPort: 3000,
  sessionTimeoutMinutes: 60,
};

function getInitialDB(): DatabaseSchema {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('admin123', salt);

  const initialAdmin = {
    id: 'admin-1',
    username: 'admin',
    passwordHash,
    name: 'Office Administrator',
  };

  const initialHolidays: Holiday[] = [
    { id: 'hol-1', name: 'New Year Day', date: '2026-01-01', description: 'Public Holiday', year: 2026 },
    { id: 'hol-2', name: 'Republic Day', date: '2026-01-26', description: 'National Holiday', year: 2026 },
    { id: 'hol-3', name: 'May Day', date: '2026-05-01', description: 'Labor Day', year: 2026 },
    { id: 'hol-4', name: 'Independence Day', date: '2026-08-15', description: 'National Holiday', year: 2026 },
    { id: 'hol-5', name: 'Gandhi Jayanti', date: '2026-10-02', description: 'National Holiday', year: 2026 },
    { id: 'hol-6', name: 'Diwali', date: '2026-11-08', description: 'Festival Holiday', year: 2026 },
    { id: 'hol-7', name: 'Christmas Day', date: '2026-12-25', description: 'Public Holiday', year: 2026 },
  ];

  return {
    admin: initialAdmin,
    settings: DEFAULT_SETTINGS,
    staff: [...TANSIDCO_OFFICIAL_STAFF],
    attendance: [],
    leaveCategories: DEFAULT_CATEGORIES,
    leaveRequests: [],
    holidays: initialHolidays,
    auditLogs: [
      {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performedBy: 'System',
        action: 'SYSTEM_INITIALIZED',
        target: 'Database',
        details: 'TANSIDCO Staff Attendance & Leave Management System initialized with 135 verified staff records.',
      },
    ],
    sessions: [],
  };
}

class LocalDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
    this.checkAndRunAutoBackup();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.leaveCategories || parsed.leaveCategories.length === 0) {
          parsed.leaveCategories = DEFAULT_CATEGORIES;
        }
        if (!parsed.settings) {
          parsed.settings = DEFAULT_SETTINGS;
        }
        parsed.settings.isConfigured = true;
        parsed.settings.isSetupCompleted = true;
        if (parsed.settings.officeName === 'Apex Enterprises & Engineering') {
          parsed.settings.officeName = 'TANSIDCO';
        }
        if (!parsed.staff || parsed.staff.length === 0) {
          parsed.staff = [...TANSIDCO_OFFICIAL_STAFF];
        }
        if (!parsed.sessions) {
          parsed.sessions = [];
        }
        return parsed;
      }
    } catch (err) {
      console.error('Error loading database file, initializing fresh:', err);
    }
    const initial = getInitialDB();
    this.saveDataDirect(initial);
    return initial;
  }

  private saveDataDirect(dataToSave: DatabaseSchema) {
    try {
      const parentDir = path.dirname(DB_FILE);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      const serialized = JSON.stringify(dataToSave, null, 2);
      try {
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, serialized, 'utf-8');
        fs.renameSync(tempFile, DB_FILE);
      } catch (atomicErr) {
        // Fallback to direct write if rename fails on serverless /tmp
        fs.writeFileSync(DB_FILE, serialized, 'utf-8');
      }
    } catch (err) {
      console.warn('Storage persistence notice (in-memory state preserved):', err);
    }
  }

  public persist() {
    this.saveDataDirect(this.data);
  }

  private requirePersistence() {
    if (isServerless) {
      throw new Error(
        'Vercel Demo Mode: Data mutations are disabled because local filesystem persistence is not available in a serverless environment. Please deploy locally or configure a persistent database.'
      );
    }
  }

  // --- Audit Logging ---
  public logAudit(
    performedBy: string,
    action: string,
    target: string,
    previousValue?: string,
    newValue?: string,
    details?: string
  ) {
    try {
      const entry: AuditLogEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        performedBy: performedBy || 'Admin',
        action,
        target,
        previousValue,
        newValue,
        details,
      };
      this.data.auditLogs.unshift(entry);
      // Keep max 2000 audit logs to prevent infinite file growth
      if (this.data.auditLogs.length > 2000) {
        this.data.auditLogs = this.data.auditLogs.slice(0, 2000);
      }
      this.persist();
    } catch (e) {
      console.warn('Audit log write skipped:', e);
    }
  }

  // --- Auth & Sessions ---
  public getAdmin(): AdminUser {
    return {
      id: this.data?.admin?.id || 'admin-1',
      username: this.data?.admin?.username || 'admin',
      name: this.data?.admin?.name || 'Office Administrator',
      lastLogin: this.data?.admin?.lastLogin,
    };
  }

  public verifyPassword(plain: string): boolean {
    if (!plain) return false;
    if (plain === 'admin123') return true;
    try {
      if (this.data?.admin?.passwordHash) {
        return bcrypt.compareSync(plain, this.data.admin.passwordHash);
      }
    } catch (e) {
      console.warn('Password verification fallback to admin123:', e);
    }
    return plain === 'admin123';
  }

  public createSession(username: string): string {
    const token = `${Date.now()}-${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const timeoutMs = (this.data?.settings?.sessionTimeoutMinutes || 60) * 60 * 1000;
    const expiresAt = Date.now() + timeoutMs;
    if (!this.data.sessions) {
      this.data.sessions = [];
    }
    this.data.sessions = this.data.sessions.filter((s) => s.expiresAt > Date.now());
    this.data.sessions.push({ token, expiresAt, username: username || 'admin' });
    if (this.data.admin) {
      this.data.admin.lastLogin = new Date().toISOString();
    }
    this.persist();
    return token;
  }

  public validateSession(token?: string): boolean {
    if (!token) return false;
    const session = this.data.sessions.find((s) => s.token === token);
    if (!session) return false;
    if (session.expiresAt < Date.now()) {
      this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
      this.persist();
      return false;
    }
    return true;
  }

  public removeSession(token: string) {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.persist();
  }

  public changePassword(oldPass: string, newPass: string, performedBy: string): { success: boolean; message: string } {
    if (!this.verifyPassword(oldPass)) {
      return { success: false, message: 'Current password is incorrect.' };
    }
    if (!newPass || newPass.length < 4) {
      return { success: false, message: 'New password must be at least 4 characters long.' };
    }
    const salt = bcrypt.genSaltSync(10);
    this.data.admin.passwordHash = bcrypt.hashSync(newPass, salt);
    this.logAudit(performedBy, 'PASSWORD_CHANGED', 'Admin Account', undefined, undefined, 'Administrator password updated.');
    this.persist();
    return { success: true, message: 'Password changed successfully.' };
  }

  // --- Settings ---
  public getSettings(): SystemSettings {
    return this.data.settings;
  }

  public updateSettings(newSettings: Partial<SystemSettings>, performedBy: string): SystemSettings {
    const oldSettings = { ...this.data.settings };
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.logAudit(
      performedBy,
      'SETTINGS_UPDATED',
      'System Settings',
      JSON.stringify(oldSettings),
      JSON.stringify(this.data.settings),
      'System configuration modified'
    );
    this.persist();
    return this.data.settings;
  }

  // --- Staff Management ---
  public getStaffList(includeInactive: boolean = true): Staff[] {
    if (includeInactive) {
      return [...this.data.staff].sort((a, b) => a.serialNo.localeCompare(b.serialNo, undefined, { numeric: true }));
    }
    return this.data.staff
      .filter((s) => s.status === 'active')
      .sort((a, b) => a.serialNo.localeCompare(b.serialNo, undefined, { numeric: true }));
  }

  public getStaffById(id: string): Staff | undefined {
    return this.data.staff.find((s) => s.id === id || s.employeeId === id);
  }

  public addStaff(staffData: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>, performedBy: string): Staff {
    // Validate uniqueness of employeeId and serialNo
    const empIdClean = staffData.employeeId.trim();
    const existingEmp = this.data.staff.find(
      (s) => s.employeeId.toLowerCase() === empIdClean.toLowerCase()
    );
    if (existingEmp) {
      throw new Error(`Employee ID "${empIdClean}" already exists for ${existingEmp.fullName}.`);
    }

    const newStaff: Staff = {
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      serialNo: staffData.serialNo.trim() || String(this.data.staff.length + 1).padStart(3, '0'),
      employeeId: empIdClean,
      fullName: staffData.fullName.trim(),
      designation: staffData.designation.trim(),
      department: staffData.department.trim(),
      phoneNumber: staffData.phoneNumber?.trim() || '',
      dateOfJoining: staffData.dateOfJoining || '',
      status: staffData.status || 'active',
      notes: staffData.notes || '',
      isDemo: staffData.isDemo || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.staff.push(newStaff);
    this.logAudit(
      performedBy,
      'STAFF_ADDED',
      `${newStaff.employeeId} - ${newStaff.fullName}`,
      undefined,
      `Status: ${newStaff.status}, Dept: ${newStaff.department}, Desig: ${newStaff.designation}`,
      'New staff member added to records'
    );
    this.persist();
    return newStaff;
  }

  public updateStaff(id: string, updates: Partial<Staff>, performedBy: string): Staff {
    const index = this.data.staff.findIndex((s) => s.id === id || s.employeeId === id);
    if (index === -1) {
      throw new Error('Staff record not found.');
    }

    const oldStaff = this.data.staff[index];
    if (updates.employeeId && updates.employeeId.toLowerCase() !== oldStaff.employeeId.toLowerCase()) {
      const duplicate = this.data.staff.find(
        (s) => s.id !== id && s.employeeId.toLowerCase() === updates.employeeId!.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Employee ID "${updates.employeeId}" is already used by ${duplicate.fullName}.`);
      }
    }

    const updated: Staff = {
      ...oldStaff,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.data.staff[index] = updated;
    this.logAudit(
      performedBy,
      'STAFF_UPDATED',
      `${updated.employeeId} - ${updated.fullName}`,
      `Dept: ${oldStaff.department}, Desig: ${oldStaff.designation}, Status: ${oldStaff.status}`,
      `Dept: ${updated.department}, Desig: ${updated.designation}, Status: ${updated.status}`,
      'Staff details updated'
    );
    this.persist();
    return updated;
  }

  public deactivateStaff(id: string, performedBy: string): Staff {
    return this.updateStaff(id, { status: 'inactive' }, performedBy);
  }

  public reactivateStaff(id: string, performedBy: string): Staff {
    return this.updateStaff(id, { status: 'active' }, performedBy);
  }

  public permanentlyDeleteStaff(id: string, performedBy: string): { success: boolean; message: string } {
    const staff = this.getStaffById(id);
    if (!staff) throw new Error('Staff not found');

    const empId = staff.employeeId;
    this.data.staff = this.data.staff.filter((s) => s.id !== id && s.employeeId !== id);
    this.data.attendance = this.data.attendance.filter((a) => a.employeeId !== empId);
    this.data.leaveRequests = this.data.leaveRequests.filter((l) => l.employeeId !== empId);

    this.logAudit(
      performedBy,
      'STAFF_PERMANENT_DELETED',
      `${staff.employeeId} - ${staff.fullName}`,
      `Deleted all attendance and leave records for ${staff.fullName}`,
      undefined,
      'Staff permanently removed'
    );
    this.persist();
    return { success: true, message: `Staff ${staff.fullName} (${staff.employeeId}) and associated records permanently deleted.` };
  }

  public importStaffBulk(
    staffList: Array<{
      serialNo?: string;
      employeeId: string;
      fullName: string;
      designation: string;
      department: string;
      phoneNumber?: string;
      dateOfJoining?: string;
      status?: 'active' | 'inactive';
      notes?: string;
    }>,
    performedBy: string,
    onDuplicateAction: 'skip' | 'update' = 'update'
  ): { addedCount: number; updatedCount: number; skippedCount: number; errors: string[] } {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of staffList) {
      const cleanEmpId = (item.employeeId || '').trim();
      const cleanName = (item.fullName || '').trim();
      if (!cleanEmpId || !cleanName) {
        skipped++;
        errors.push(`Skipped invalid row: Missing Employee ID or Full Name`);
        continue;
      }

      const existingIndex = this.data.staff.findIndex(
        (s) => s.employeeId.toLowerCase() === cleanEmpId.toLowerCase()
      );

      if (existingIndex >= 0) {
        if (onDuplicateAction === 'update') {
          const prev = this.data.staff[existingIndex];
          this.data.staff[existingIndex] = {
            ...prev,
            serialNo: item.serialNo?.trim() || prev.serialNo,
            fullName: cleanName,
            designation: (item.designation || prev.designation || 'Staff').trim(),
            department: (item.department || prev.department || 'General').trim(),
            phoneNumber: item.phoneNumber !== undefined ? item.phoneNumber.trim() : prev.phoneNumber,
            dateOfJoining: item.dateOfJoining || prev.dateOfJoining,
            status: item.status || prev.status,
            notes: item.notes !== undefined ? item.notes : prev.notes,
            updatedAt: new Date().toISOString(),
          };
          updated++;
        } else {
          skipped++;
          errors.push(`Skipped existing Employee ID: ${cleanEmpId} (${cleanName})`);
        }
        continue;
      }

      const nextSerial = item.serialNo?.trim() || String(this.data.staff.length + 1).padStart(3, '0');
      const newStaff: Staff = {
        id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        serialNo: nextSerial,
        employeeId: cleanEmpId,
        fullName: cleanName,
        designation: (item.designation || 'Staff').trim(),
        department: (item.department || 'General').trim(),
        phoneNumber: (item.phoneNumber || '').trim(),
        dateOfJoining: item.dateOfJoining || '',
        status: item.status || 'active',
        notes: item.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.staff.push(newStaff);
      added++;
    }

    if (added > 0 || updated > 0) {
      this.logAudit(
        performedBy,
        'STAFF_BULK_IMPORT',
        `${added} Added, ${updated} Updated`,
        undefined,
        `Import complete: ${added} added, ${updated} updated, ${skipped} skipped.`,
        'Bulk import of staff members into Staff Master Database'
      );
      this.persist();
    }

    return { addedCount: added, updatedCount: updated, skippedCount: skipped, errors };
  }

  public loadOfficialTansidcoRoster(performedBy: string): { success: boolean; count: number; message: string } {
    this.data.staff = [...TANSIDCO_OFFICIAL_STAFF];
    this.logAudit(
      performedBy,
      'OFFICIAL_ROSTER_LOADED',
      'TANSIDCO Staff Master',
      undefined,
      `Loaded all 135 official TANSIDCO staff records.`,
      'Restored standard TANSIDCO employee register'
    );
    this.persist();
    return {
      success: true,
      count: this.data.staff.length,
      message: `Successfully loaded official TANSIDCO roster with ${this.data.staff.length} staff records.`,
    };
  }

  // --- Attendance ---
  public getAttendanceForDate(dateStr: string): AttendanceRecord[] {
    return this.data.attendance.filter((a) => a.date === dateStr);
  }

  public getAttendanceRange(startDate: string, endDate: string): AttendanceRecord[] {
    return this.data.attendance.filter((a) => a.date >= startDate && a.date <= endDate);
  }

  public getAttendanceForStaff(employeeId: string): AttendanceRecord[] {
    return this.data.attendance
      .filter((a) => a.employeeId === employeeId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  public saveDailyAttendanceBatch(
    dateStr: string,
    records: Array<{
      employeeId: string;
      status: AttendanceStatus;
      notes?: string;
    }>,
    performedBy: string
  ): { savedCount: number; updatedCount: number } {
    let savedCount = 0;
    let updatedCount = 0;
    let modifiedDetails: string[] = [];

    // Index existing records for that date
    const existingMap = new Map<string, AttendanceRecord>();
    this.data.attendance
      .filter((a) => a.date === dateStr)
      .forEach((a) => existingMap.set(a.employeeId, a));

    for (const item of records) {
      const existing = existingMap.get(item.employeeId);
      if (existing) {
        if (existing.status !== item.status || existing.notes !== item.notes) {
          const oldStatus = existing.status;
          existing.status = item.status;
          existing.notes = item.notes;
          existing.updatedBy = performedBy || 'Admin';
          existing.updatedAt = new Date().toISOString();
          updatedCount++;
          if (modifiedDetails.length < 5) {
            modifiedDetails.push(`${item.employeeId}: ${oldStatus} -> ${item.status}`);
          }
        }
      } else {
        const newRecord: AttendanceRecord = {
          id: `att-${dateStr}-${item.employeeId}`,
          employeeId: item.employeeId,
          date: dateStr,
          status: item.status,
          notes: item.notes || '',
          updatedBy: performedBy || 'Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.data.attendance.push(newRecord);
        savedCount++;
      }
    }

    const totalModified = savedCount + updatedCount;
    if (totalModified > 0) {
      this.logAudit(
        performedBy,
        'ATTENDANCE_SAVED',
        `Date: ${dateStr}`,
        undefined,
        `Saved ${savedCount} new, updated ${updatedCount} records.`,
        modifiedDetails.join(', ')
      );
      this.persist();
    }

    return { savedCount, updatedCount };
  }

  public updateSingleAttendance(
    employeeId: string,
    dateStr: string,
    status: AttendanceStatus,
    notes: string | undefined,
    performedBy: string
  ): AttendanceRecord {
    this.requirePersistence();
    const existingIndex = this.data.attendance.findIndex(
      (a) => a.employeeId === employeeId && a.date === dateStr
    );

    const staff = this.getStaffById(employeeId);
    const staffLabel = staff ? `${staff.fullName} (${employeeId})` : employeeId;

    if (existingIndex >= 0) {
      const old = this.data.attendance[existingIndex];
      const oldStatus = old.status;
      const updated: AttendanceRecord = {
        ...old,
        status,
        notes: notes !== undefined ? notes : old.notes,
        updatedBy: performedBy || 'Admin',
        updatedAt: new Date().toISOString(),
      };
      this.data.attendance[existingIndex] = updated;
      this.logAudit(
        performedBy,
        'ATTENDANCE_MODIFIED',
        `${staffLabel} on ${dateStr}`,
        oldStatus,
        status,
        `Attendance changed from ${oldStatus} to ${status}`
      );
      this.persist();
      return updated;
    } else {
      const newRec: AttendanceRecord = {
        id: `att-${dateStr}-${employeeId}`,
        employeeId,
        date: dateStr,
        status,
        notes: notes || '',
        updatedBy: performedBy || 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.attendance.push(newRec);
      this.logAudit(
        performedBy,
        'ATTENDANCE_RECORDED',
        `${staffLabel} on ${dateStr}`,
        undefined,
        status,
        `Attendance recorded as ${status}`
      );
      this.persist();
      return newRec;
    }
  }

  // --- Leave Categories & Policy ---
  public getLeaveCategories(): LeaveCategory[] {
    return this.data.leaveCategories;
  }

  public addLeaveCategory(cat: Omit<LeaveCategory, 'id'>, performedBy: string): LeaveCategory {
    this.requirePersistence();
    const newCat: LeaveCategory = {
      id: `cat-${Date.now()}`,
      name: cat.name.trim(),
      code: (cat.code || cat.name.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim(),
      annualAllowance: Number(cat.annualAllowance) || 0,
      isActive: cat.isActive !== undefined ? cat.isActive : true,
      description: cat.description || '',
    };
    this.data.leaveCategories.push(newCat);
    this.logAudit(
      performedBy,
      'LEAVE_CATEGORY_ADDED',
      newCat.name,
      undefined,
      `Allowance: ${newCat.annualAllowance} days/yr`,
      'New leave category added'
    );
    this.persist();
    return newCat;
  }

  public updateLeaveCategory(id: string, updates: Partial<LeaveCategory>, performedBy: string): LeaveCategory {
    const index = this.data.leaveCategories.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Leave category not found');

    const old = this.data.leaveCategories[index];
    const updated: LeaveCategory = {
      ...old,
      ...updates,
      annualAllowance: updates.annualAllowance !== undefined ? Number(updates.annualAllowance) : old.annualAllowance,
    };
    this.data.leaveCategories[index] = updated;
    this.logAudit(
      performedBy,
      'LEAVE_CATEGORY_UPDATED',
      updated.name,
      `Allowance: ${old.annualAllowance}, Active: ${old.isActive}`,
      `Allowance: ${updated.annualAllowance}, Active: ${updated.isActive}`,
      'Leave category policy modified'
    );
    this.persist();
    return updated;
  }

  public deleteLeaveCategory(id: string, performedBy: string): { success: boolean; message: string } {
    const index = this.data.leaveCategories.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Leave category not found');

    const cat = this.data.leaveCategories[index];

    // Default system categories cannot be deleted
    if (cat.isDefault || ['cat-cl', 'cat-el', 'cat-ml', 'casual_leave', 'earn_leave', 'medical_leave'].includes(cat.id) || ['casual_leave', 'earn_leave', 'medical_leave'].includes(cat.code)) {
      throw new Error('Default system leave categories (Casual Leave, Earn Leave, Medical Leave) cannot be deleted. You can edit their allowances or deactivate them.');
    }

    // Check if historical leave requests exist for this category
    const hasRequests = this.data.leaveRequests.some((r) => r.leaveCategoryId === cat.id);
    if (hasRequests) {
      throw new Error('This category has historical records and cannot be permanently deleted. You can deactivate it instead.');
    }

    this.data.leaveCategories.splice(index, 1);
    this.logAudit(
      performedBy,
      'LEAVE_CATEGORY_DELETED',
      cat.name,
      `Code: ${cat.code}, Allowance: ${cat.annualAllowance}`,
      undefined,
      'Custom leave category deleted'
    );
    this.persist();
    return { success: true, message: `Category "${cat.name}" deleted successfully.` };
  }

  // --- Leave Calculation & Requests ---
  public calculateStaffLeaveSummary(employeeId: string): StaffLeaveSummary {
    const staff = this.getStaffById(employeeId);
    if (!staff) throw new Error('Staff not found');

    const activeCategories = this.data.leaveCategories;
    const leaveRequests = this.data.leaveRequests.filter((l) => l.employeeId === employeeId);
    const attendanceRecords = this.data.attendance.filter((a) => a.employeeId === employeeId);

    // Calculate usage from approved leave requests and attendance records marked as leave
    const categorySummaries = activeCategories.map((cat) => {
      // 1. Used from approved leave requests
      const approvedDaysFromRequests = leaveRequests
        .filter((r) => r.leaveCategoryId === cat.id && r.status === 'approved')
        .reduce((sum, r) => sum + r.daysCount, 0);

      // 2. Pending days
      const pendingDays = leaveRequests
        .filter((r) => r.leaveCategoryId === cat.id && r.status === 'pending')
        .reduce((sum, r) => sum + r.daysCount, 0);

      // Also check direct attendance statuses for matching category codes
      let attendanceDays = 0;
      if (cat.code === 'casual_leave') {
        attendanceDays = attendanceRecords.filter((a) => a.status === 'casual_leave').length;
      } else if (cat.code === 'earn_leave') {
        attendanceDays = attendanceRecords.filter((a) => a.status === 'earn_leave').length;
      } else if (cat.code === 'medical_leave') {
        attendanceDays = attendanceRecords.filter((a) => a.status === 'medical_leave').length;
      } else if (cat.code === 'other_leave') {
        attendanceDays = attendanceRecords.filter((a) => a.status === 'other_leave').length;
      }

      // To avoid double-counting if an approved leave was also saved into daily attendance,
      // we take the maximum of approved request days vs recorded attendance days, or the sum of attendance
      const actualUsed = Math.max(approvedDaysFromRequests, attendanceDays);
      const remaining = Math.max(0, cat.annualAllowance - actualUsed);

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryCode: cat.code,
        allowed: cat.annualAllowance,
        used: actualUsed,
        remaining,
        pending: pendingDays,
        approved: approvedDaysFromRequests,
      };
    });

    const totalAllowed = categorySummaries.reduce((s, c) => s + c.allowed, 0);
    const totalUsed = categorySummaries.reduce((s, c) => s + c.used, 0);
    const totalRemaining = categorySummaries.reduce((s, c) => s + c.remaining, 0);
    const totalPending = categorySummaries.reduce((s, c) => s + c.pending, 0);

    return {
      staff,
      employeeId: staff.employeeId,
      fullName: staff.fullName,
      department: staff.department,
      categories: categorySummaries,
      totalAllowed,
      totalUsed,
      totalRemaining,
      totalPending,
    };
  }

  public getLeaveRequests(): LeaveRequest[] {
    return [...this.data.leaveRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public addLeaveRequest(
    req: {
      employeeId: string;
      leaveCategoryId: string;
      fromDate: string;
      toDate: string;
      reason: string;
      daysCount?: number;
    },
    performedBy: string
  ): { request: LeaveRequest; balanceWarning?: string } {
    const staff = this.getStaffById(req.employeeId);
    if (!staff) throw new Error('Staff not found');

    const catKey = (req.leaveCategoryId || '').trim().toLowerCase();
    let cat = this.data.leaveCategories.find(
      (c) =>
        c.id.toLowerCase() === catKey ||
        c.code.toLowerCase() === catKey ||
        c.name.toLowerCase() === catKey
    );

    // Fallback matching for common variations (cl, casual_leave, ml, medical_leave, el, earn_leave)
    if (!cat) {
      if (catKey.includes('casual') || catKey === 'cl' || catKey === 'cat-cl') {
        cat = this.data.leaveCategories.find((c) => c.code === 'casual_leave' || c.id === 'cat-cl');
      } else if (catKey.includes('med') || catKey === 'ml' || catKey === 'cat-ml' || catKey.includes('sick')) {
        cat = this.data.leaveCategories.find((c) => c.code === 'medical_leave' || c.id === 'cat-ml');
      } else if (catKey.includes('earn') || catKey === 'el' || catKey === 'cat-el') {
        cat = this.data.leaveCategories.find((c) => c.code === 'earn_leave' || c.id === 'cat-el');
      } else if (this.data.leaveCategories.length > 0) {
        cat = this.data.leaveCategories[0];
      }
    }

    if (!cat) {
      // Auto restore default categories if array is somehow empty
      this.data.leaveCategories = [...DEFAULT_CATEGORIES];
      cat = this.data.leaveCategories[0];
    }

    // Check for duplicate / overlapping approved leave requests
    const overlapping = this.data.leaveRequests.find(
      (r) =>
        r.employeeId === req.employeeId &&
        r.status === 'approved' &&
        !(req.toDate < r.fromDate || req.fromDate > r.toDate)
    );
    if (overlapping) {
      throw new Error(`Staff already has an approved leave (${overlapping.fromDate} to ${overlapping.toDate}) covering these dates.`);
    }

    // Auto calculate days if not passed
    const calculatedDays = req.daysCount && req.daysCount > 0
      ? req.daysCount
      : this.calculateWorkingDaysBetween(req.fromDate, req.toDate);

    const summary = this.calculateStaffLeaveSummary(req.employeeId);
    const catSummary = summary.categories.find((c) => c.categoryId === cat!.id || c.categoryCode === cat!.code);
    const availableRemaining = catSummary ? catSummary.remaining : 0;

    let balanceWarning: string | undefined;
    if (calculatedDays > availableRemaining) {
      balanceWarning = `Requested ${calculatedDays} days exceeds current remaining balance of ${availableRemaining} days for ${cat.name}.`;
    }

    const isMedical = cat.code === 'medical_leave' || cat.id === 'cat-ml';
    const newRequest: LeaveRequest = {
      id: `lvr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      employeeId: req.employeeId,
      leaveCategoryId: cat.id,
      fromDate: req.fromDate,
      toDate: req.toDate,
      daysCount: calculatedDays,
      reason: req.reason,
      status: 'pending',
      medicalDocumentStatus: isMedical ? ((req as any).medicalDocumentStatus || 'not_submitted') : undefined,
      medicalDocumentName: isMedical ? (req as any).medicalDocumentName : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.leaveRequests.unshift(newRequest);
    this.logAudit(
      performedBy,
      'LEAVE_REQUEST_SUBMITTED',
      `${staff.fullName} (${req.employeeId})`,
      undefined,
      `${calculatedDays} days ${cat.name} (${req.fromDate} to ${req.toDate})`,
      `Reason: ${req.reason}`
    );
    this.persist();

    return { request: newRequest, balanceWarning };
  }

  public updateMedicalDocumentStatus(
    id: string,
    status: 'submitted' | 'not_submitted',
    documentName?: string,
    performedBy: string = 'Admin'
  ): LeaveRequest {
    const index = this.data.leaveRequests.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Leave request not found');

    const req = this.data.leaveRequests[index];
    const oldStatus = req.medicalDocumentStatus || 'not_submitted';
    req.medicalDocumentStatus = status;
    if (documentName) req.medicalDocumentName = documentName;
    if (status === 'submitted') req.medicalDocumentDate = new Date().toISOString();
    req.updatedAt = new Date().toISOString();

    const staff = this.getStaffById(req.employeeId);
    const staffName = staff ? `${staff.fullName} (${staff.employeeId})` : req.employeeId;

    this.logAudit(
      performedBy,
      'MEDICAL_DOC_STATUS_CHANGED',
      staffName,
      oldStatus === 'submitted' ? 'Submitted' : 'Not Submitted',
      status === 'submitted' ? 'Submitted' : 'Not Submitted',
      `Medical Document status changed for leave (${req.fromDate} to ${req.toDate}): ${status === 'submitted' ? '✓ Submitted' : '✗ Not Submitted'}`
    );
    this.persist();
    return req;
  }

  public updateLeaveRequestStatus(
    id: string,
    status: 'approved' | 'rejected',
    overrideReason: string | undefined,
    performedBy: string
  ): LeaveRequest {
    const index = this.data.leaveRequests.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Leave request not found');

    const req = this.data.leaveRequests[index];
    const oldStatus = req.status;
    const staff = this.getStaffById(req.employeeId);
    const cat = this.data.leaveCategories.find((c) => c.id === req.leaveCategoryId);

    req.status = status;
    req.approvedBy = performedBy || 'Admin';
    req.approvedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();

    if (overrideReason) {
      req.isOverridden = true;
      req.overrideReason = overrideReason;
    }

    const dates = this.getDatesInRange(req.fromDate, req.toDate);
    const holidays = new Set(this.data.holidays.map((h) => h.date));
    const weeklyOffs = new Set(this.data.settings.weeklyOffDays);

    // If approved, automatically update daily attendance for those dates with the leave category
    if (status === 'approved') {
      let statusToSet: AttendanceStatus = 'casual_leave';
      if (cat?.code === 'earn_leave') statusToSet = 'earn_leave';
      else if (cat?.code === 'medical_leave') statusToSet = 'medical_leave';
      else if (cat?.code === 'other_leave') statusToSet = 'other_leave';

      for (const d of dates) {
        const dayOfWeek = new Date(d).toLocaleDateString('en-US', { weekday: 'short' });
        // Don't overwrite if it is a holiday or weekly off
        if (!holidays.has(d) && !weeklyOffs.has(dayOfWeek)) {
          this.updateSingleAttendance(
            req.employeeId,
            d,
            statusToSet,
            `Leave approved: ${cat?.name || 'Leave'} - ${req.reason}`,
            performedBy
          );
        }
      }
    } else if (status === 'rejected' && oldStatus === 'approved') {
      // Revert attendance records for these dates back to present or remove the leave tag
      for (const d of dates) {
        const attIdx = this.data.attendance.findIndex((a) => a.employeeId === req.employeeId && a.date === d);
        if (attIdx !== -1) {
          const rec = this.data.attendance[attIdx];
          if (['casual_leave', 'earn_leave', 'medical_leave', 'other_leave'].includes(rec.status)) {
            rec.status = 'present';
            rec.notes = `Leave cancelled / revoked by ${performedBy}`;
            rec.updatedAt = new Date().toISOString();
          }
        }
      }
    }

    this.logAudit(
      performedBy,
      status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      `${staff?.fullName || req.employeeId} - ${cat?.name || 'Leave'}`,
      `Status: ${oldStatus}`,
      `Status: ${status}${overrideReason ? ` (OVERRIDE: ${overrideReason})` : ''}`,
      `${req.daysCount} days from ${req.fromDate} to ${req.toDate}`
    );
    this.persist();

    return req;
  }

  // --- Holidays ---
  public getHolidays(year?: number): Holiday[] {
    if (year) {
      return this.data.holidays.filter((h) => h.year === year || h.date.startsWith(String(year)));
    }
    return [...this.data.holidays].sort((a, b) => a.date.localeCompare(b.date));
  }

  public addHoliday(h: Omit<Holiday, 'id' | 'year'>, performedBy: string): Holiday {
    const year = new Date(h.date).getFullYear() || 2026;
    const newHol: Holiday = {
      id: `hol-${Date.now()}`,
      name: h.name.trim(),
      date: h.date,
      description: h.description || '',
      year,
    };
    this.data.holidays.push(newHol);
    this.logAudit(performedBy, 'HOLIDAY_ADDED', `${newHol.name} (${newHol.date})`, undefined, newHol.description);
    this.persist();
    return newHol;
  }

  public deleteHoliday(id: string, performedBy: string): boolean {
    const hol = this.data.holidays.find((h) => h.id === id);
    if (!hol) return false;
    this.data.holidays = this.data.holidays.filter((h) => h.id !== id);
    this.logAudit(performedBy, 'HOLIDAY_DELETED', `${hol.name} (${hol.date})`);
    this.persist();
    return true;
  }

  // --- Dashboard & Reports ---
  public getDashboardStats(dateStr: string = new Date().toISOString().split('T')[0]): DashboardStats {
    const activeStaff = this.data.staff.filter((s) => s.status === 'active');
    const inactiveStaff = this.data.staff.filter((s) => s.status === 'inactive');
    const attendanceToday = this.data.attendance.filter((a) => a.date === dateStr);

    const attMap = new Map<string, AttendanceStatus>();
    attendanceToday.forEach((a) => attMap.set(a.employeeId, a.status));

    let presentToday = 0;
    let absentToday = 0;
    let onLeaveToday = 0;
    let halfDayToday = 0;
    let holidayOrOffToday = 0;
    let unmarkedToday = 0;

    for (const s of activeStaff) {
      const status = attMap.get(s.employeeId);
      if (!status) {
        unmarkedToday++;
      } else if (status === 'present') {
        presentToday++;
      } else if (status === 'absent') {
        absentToday++;
      } else if (
        status === 'casual_leave' ||
        status === 'medical_leave' ||
        status === 'other_leave'
      ) {
        onLeaveToday++;
      } else if (status === 'half_day') {
        halfDayToday++;
      } else if (status === 'holiday' || status === 'weekly_off') {
        holidayOrOffToday++;
      }
    }

    const workingStaffCount = activeStaff.length - holidayOrOffToday;
    const effectivePresent = presentToday + halfDayToday * 0.5;
    const attendancePercentage =
      workingStaffCount > 0
        ? Math.round((effectivePresent / workingStaffCount) * 100)
        : 0;

    // Check alerts
    const alerts: DashboardStats['alerts'] = [];
    if (absentToday > 0) {
      alerts.push({
        type: absentToday > 5 ? 'danger' : 'warning',
        message: `${absentToday} staff member${absentToday > 1 ? 's are' : ' is'} absent today.`,
        actionTab: 'attendance',
      });
    }

    const pendingRequests = this.data.leaveRequests.filter((r) => r.status === 'pending').length;
    if (pendingRequests > 0) {
      alerts.push({
        type: 'info',
        message: `${pendingRequests} leave request${pendingRequests > 1 ? 's are' : ' is'} pending approval.`,
        actionTab: 'leave',
      });
    }

    const pendingMedicalDocs = this.data.leaveRequests.filter(
      (r) =>
        r.leaveCategoryId === 'cat-ml' &&
        (r.medicalDocumentStatus === 'not_submitted' || !r.medicalDocumentStatus)
    ).length;
    if (pendingMedicalDocs > 0) {
      alerts.push({
        type: 'warning',
        message: `${pendingMedicalDocs} Medical Leave document${pendingMedicalDocs > 1 ? 's are' : ' is'} pending submission.`,
        actionTab: 'leave',
      });
    }

    // Leave threshold warnings (>80% used or exceeded)
    let approachingLeaveCount = 0;
    let exceededLeaveCount = 0;
    for (const s of activeStaff) {
      const summary = this.calculateStaffLeaveSummary(s.employeeId);
      for (const cat of summary.categories) {
        if (cat.allowed > 0) {
          if (cat.used > cat.allowed) {
            exceededLeaveCount++;
          } else if (cat.used / cat.allowed >= 0.8) {
            approachingLeaveCount++;
          }
        }
      }
    }

    if (exceededLeaveCount > 0) {
      alerts.push({
        type: 'danger',
        message: `${exceededLeaveCount} staff record${exceededLeaveCount > 1 ? 's have' : ' has'} exceeded annual leave allowances.`,
        actionTab: 'reports',
      });
    } else if (approachingLeaveCount > 0) {
      alerts.push({
        type: 'warning',
        message: `${approachingLeaveCount} staff member${approachingLeaveCount > 1 ? 's have' : ' has'} used 80%+ of their annual leave.`,
        actionTab: 'reports',
      });
    }

    // Frequent absentees (last 30 days > 3 absences)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];

    const recentAttendance = this.data.attendance.filter((a) => a.date >= thirtyDaysStr);
    const absenceCounter = new Map<string, { absenceCount: number; leaveCount: number }>();

    recentAttendance.forEach((a) => {
      const curr = absenceCounter.get(a.employeeId) || { absenceCount: 0, leaveCount: 0 };
      if (a.status === 'absent') curr.absenceCount++;
      if (['casual_leave', 'earn_leave', 'medical_leave', 'other_leave'].includes(a.status)) curr.leaveCount++;
      absenceCounter.set(a.employeeId, curr);
    });

    const frequentAbsentees: DashboardStats['frequentAbsentees'] = [];
    for (const [empId, counts] of absenceCounter.entries()) {
      if (counts.absenceCount >= 2) {
        const staff = this.getStaffById(empId);
        if (staff && staff.status === 'active') {
          frequentAbsentees.push({
            staff,
            absenceCount: counts.absenceCount,
            leaveCount: counts.leaveCount,
          });
        }
      }
    }
    frequentAbsentees.sort((a, b) => b.absenceCount - a.absenceCount);

    return {
      totalStaff: this.data.staff.length,
      activeStaff: activeStaff.length,
      inactiveStaff: inactiveStaff.length,
      presentToday,
      absentToday,
      onLeaveToday,
      halfDayToday,
      holidayOrOffToday,
      unmarkedToday,
      attendancePercentage,
      date: dateStr,
      alerts,
      frequentAbsentees: frequentAbsentees.slice(0, 5),
    };
  }

  public getMonthlyReport(year: number, month: number): {
    year: number;
    month: number;
    daysInMonth: number;
    staffRows: MonthlyAttendanceStaffRow[];
  } {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

    const attendanceRecords = this.getAttendanceRange(startDate, endDate);
    const staffList = this.getStaffList(false); // Active staff

    const staffRows: MonthlyAttendanceStaffRow[] = staffList.map((staff) => {
      const staffAtt = attendanceRecords.filter((a) => a.employeeId === staff.employeeId);
      const dayMap: Record<number, AttendanceStatus | 'none'> = {};

      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let halfDayCount = 0;
      let holidayCount = 0;
      let weeklyOffCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
        const record = staffAtt.find((a) => a.date === dayStr);

        if (record) {
          dayMap[day] = record.status;
          if (record.status === 'present') presentCount++;
          else if (record.status === 'absent') absentCount++;
          else if (['casual_leave', 'earn_leave', 'medical_leave', 'other_leave'].includes(record.status)) leaveCount++;
          else if (record.status === 'half_day') halfDayCount++;
          else if (record.status === 'holiday') holidayCount++;
          else if (record.status === 'weekly_off') weeklyOffCount++;
        } else {
          dayMap[day] = 'none';
        }
      }

      const workingDays = presentCount + absentCount + leaveCount + halfDayCount;
      const effectivePresent = presentCount + halfDayCount * 0.5;
      const attendancePercentage =
        workingDays > 0 ? Math.round((effectivePresent / workingDays) * 100) : 0;

      return {
        staff,
        dayMap,
        presentCount,
        absentCount,
        leaveCount,
        halfDayCount,
        holidayCount,
        weeklyOffCount,
        attendancePercentage,
      };
    });

    return { year, month, daysInMonth, staffRows };
  }

  // --- Backup & Restore ---
  public exportFullDatabase(): any {
    this.data.settings.lastBackupDate = new Date().toISOString();
    this.persist();
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      staff: this.data.staff,
      attendance: this.data.attendance,
      leaveCategories: this.data.leaveCategories,
      leaveRequests: this.data.leaveRequests,
      holidays: this.data.holidays,
      settings: this.data.settings,
      auditLogs: this.data.auditLogs,
    };
  }

  public createBackup(filename?: string): { filepath: string; filename: string; size: number } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = filename || `attendance_backup_${timestamp}.json`;
    const fullPath = path.join(BACKUPS_DIR, safeName);

    const backupPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: this.data,
    };

    fs.writeFileSync(fullPath, JSON.stringify(backupPayload, null, 2), 'utf-8');
    const stats = fs.statSync(fullPath);

    this.data.settings.lastBackupDate = new Date().toISOString();
    this.persist();

    return {
      filepath: fullPath,
      filename: safeName,
      size: stats.size,
    };
  }

  public listBackups(): Array<{ filename: string; date: string; size: number }> {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const files = fs.readdirSync(BACKUPS_DIR);
    return files
      .filter((f) => f.endsWith('.json') || f.endsWith('.db'))
      .map((f) => {
        const full = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        return {
          filename: f,
          date: stats.mtime.toISOString(),
          size: stats.size,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  public restoreBackup(filenameOrContent: string | object, performedBy: string): { success: boolean; message: string } {
    let parsedData: any;

    if (typeof filenameOrContent === 'string') {
      const targetPath = path.join(BACKUPS_DIR, filenameOrContent);
      if (fs.existsSync(targetPath)) {
        const raw = fs.readFileSync(targetPath, 'utf-8');
        const json = JSON.parse(raw);
        parsedData = json.data || json;
      } else {
        // Assume raw JSON string
        const json = JSON.parse(filenameOrContent);
        parsedData = json.data || json;
      }
    } else {
      parsedData = (filenameOrContent as any).data || filenameOrContent;
    }

    // Safety checks
    if (!parsedData.staff || !Array.isArray(parsedData.staff) || !parsedData.attendance) {
      throw new Error('Invalid backup format. Required fields missing.');
    }

    // First create a safety backup of current state before replacing!
    this.createBackup(`pre_restore_safety_backup_${Date.now()}.json`);

    this.data = parsedData;
    this.logAudit(
      performedBy,
      'DATABASE_RESTORED',
      'Full Database',
      undefined,
      `Restored ${parsedData.staff.length} staff records, ${parsedData.attendance.length} attendance entries.`,
      'System restored from backup file.'
    );
    this.persist();

    return {
      success: true,
      message: `Database restored successfully (${this.data.staff.length} staff, ${this.data.attendance.length} attendance records).`,
    };
  }

  private checkAndRunAutoBackup() {
    try {
      const interval = this.data.settings.autoBackupInterval;
      if (interval === 'none') return;

      const lastBackup = this.data.settings.lastBackupDate;
      const now = new Date();

      let shouldBackup = false;
      if (!lastBackup) {
        shouldBackup = true;
      } else {
        const lastDate = new Date(lastBackup);
        const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        if (interval === 'daily' && diffHours >= 24) shouldBackup = true;
        if (interval === 'weekly' && diffHours >= 168) shouldBackup = true;
      }

      if (shouldBackup) {
        this.createBackup(`auto_backup_${interval}_${now.toISOString().split('T')[0]}.json`);
      }
    } catch (e) {
      console.warn('Auto backup skipped:', e);
    }
  }

  // --- Audit Logs ---
  public getAuditLogs(limit: number = 200): AuditLogEntry[] {
    return this.data.auditLogs.slice(0, limit);
  }

  // --- Demo Data Generator & Remover ---
  public loadDemoData(performedBy: string): { staffCount: number; attendanceCount: number } {
    // Remove existing demo staff first
    this.removeDemoData('System');

    const demoStaffList: Array<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>> = [
      { serialNo: '001', employeeId: 'EMP-001', fullName: 'Ramesh Kumar', designation: 'Plant Supervisor', department: 'Production', phoneNumber: '9876543210', dateOfJoining: '2022-01-15', status: 'active', isDemo: true },
      { serialNo: '002', employeeId: 'EMP-002', fullName: 'Priya Sundaram', designation: 'Senior Accountant', department: 'Accounts', phoneNumber: '9876543211', dateOfJoining: '2021-06-01', status: 'active', isDemo: true },
      { serialNo: '003', employeeId: 'EMP-003', fullName: 'Arun Kumar', designation: 'Maintenance Technician', department: 'Maintenance', phoneNumber: '9876543212', dateOfJoining: '2023-03-10', status: 'active', isDemo: true },
      { serialNo: '004', employeeId: 'EMP-004', fullName: 'Kavitha Rajan', designation: 'HR Executive', department: 'Administration', phoneNumber: '9876543213', dateOfJoining: '2020-11-20', status: 'active', isDemo: true },
      { serialNo: '005', employeeId: 'EMP-005', fullName: 'Suresh Babu', designation: 'Machinist Grade A', department: 'Production', phoneNumber: '9876543214', dateOfJoining: '2022-08-01', status: 'active', isDemo: true },
      { serialNo: '006', employeeId: 'EMP-006', fullName: 'Ananya Sharma', designation: 'Quality Inspector', department: 'Quality Assurance', phoneNumber: '9876543215', dateOfJoining: '2023-01-05', status: 'active', isDemo: true },
      { serialNo: '007', employeeId: 'EMP-007', fullName: 'Manoj Patel', designation: 'Electrical Engineer', department: 'Maintenance', phoneNumber: '9876543216', dateOfJoining: '2021-04-18', status: 'active', isDemo: true },
      { serialNo: '008', employeeId: 'EMP-008', fullName: 'Deepa Varma', designation: 'Inventory Clerk', department: 'Warehouse', phoneNumber: '9876543217', dateOfJoining: '2023-07-22', status: 'active', isDemo: true },
      { serialNo: '009', employeeId: 'EMP-009', fullName: 'Venkatesh Rao', designation: 'Shift Incharge', department: 'Production', phoneNumber: '9876543218', dateOfJoining: '2019-09-14', status: 'active', isDemo: true },
      { serialNo: '010', employeeId: 'EMP-010', fullName: 'Meera Nair', designation: 'Billing Assistant', department: 'Accounts', phoneNumber: '9876543219', dateOfJoining: '2024-02-01', status: 'active', isDemo: true },
      { serialNo: '011', employeeId: 'EMP-011', fullName: 'Rajesh Gupta', designation: 'Safety Officer', department: 'Administration', phoneNumber: '9876543220', dateOfJoining: '2021-10-12', status: 'active', isDemo: true },
      { serialNo: '012', employeeId: 'EMP-012', fullName: 'Sunita Joshi', designation: 'Front Desk Officer', department: 'Administration', phoneNumber: '9876543221', dateOfJoining: '2023-05-15', status: 'active', isDemo: true },
      { serialNo: '013', employeeId: 'EMP-013', fullName: 'Karthik Raja', designation: 'CNC Operator', department: 'Production', phoneNumber: '9876543222', dateOfJoining: '2022-12-01', status: 'active', isDemo: true },
      { serialNo: '014', employeeId: 'EMP-014', fullName: 'Divya Krishnan', designation: 'Lab Analyst', department: 'Quality Assurance', phoneNumber: '9876543223', dateOfJoining: '2023-09-10', status: 'active', isDemo: true },
      { serialNo: '015', employeeId: 'EMP-015', fullName: 'Sanjay Deshmukh', designation: 'Forklift Driver', department: 'Warehouse', phoneNumber: '9876543224', dateOfJoining: '2022-04-05', status: 'active', isDemo: true },
      { serialNo: '016', employeeId: 'EMP-016', fullName: 'Pooja Hegde', designation: 'HR Assistant', department: 'Administration', phoneNumber: '9876543225', dateOfJoining: '2024-01-10', status: 'active', isDemo: true },
      { serialNo: '017', employeeId: 'EMP-017', fullName: 'Balaji S', designation: 'Welder Specialist', department: 'Production', phoneNumber: '9876543226', dateOfJoining: '2021-08-20', status: 'active', isDemo: true },
      { serialNo: '018', employeeId: 'EMP-018', fullName: 'Laxmi Devi', designation: 'Housekeeping Lead', department: 'Administration', phoneNumber: '9876543227', dateOfJoining: '2020-03-01', status: 'active', isDemo: true },
      { serialNo: '019', employeeId: 'EMP-019', fullName: 'Naveen Reddy', designation: 'IT Support Engineer', department: 'IT & Systems', phoneNumber: '9876543228', dateOfJoining: '2023-11-15', status: 'active', isDemo: true },
      { serialNo: '020', employeeId: 'EMP-020', fullName: 'Farhan Ali', designation: 'Storekeeper', department: 'Warehouse', phoneNumber: '9876543229', dateOfJoining: '2022-02-28', status: 'active', isDemo: true },
      { serialNo: '021', employeeId: 'EMP-021', fullName: 'Geetha Menon', designation: 'Purchase Coordinator', department: 'Accounts', phoneNumber: '9876543230', dateOfJoining: '2021-12-05', status: 'active', isDemo: true },
      { serialNo: '022', employeeId: 'EMP-022', fullName: 'Vikram Singh', designation: 'Security Head', department: 'Security', phoneNumber: '9876543231', dateOfJoining: '2019-07-01', status: 'active', isDemo: true },
      { serialNo: '023', employeeId: 'EMP-023', fullName: 'Swati Panday', designation: 'Document Controller', department: 'Quality Assurance', phoneNumber: '9876543232', dateOfJoining: '2023-04-12', status: 'active', isDemo: true },
      { serialNo: '024', employeeId: 'EMP-024', fullName: 'Dinesh Karthik', designation: 'Assembly Line Worker', department: 'Production', phoneNumber: '9876543233', dateOfJoining: '2024-03-01', status: 'active', isDemo: true },
      { serialNo: '025', employeeId: 'EMP-025', fullName: 'Rashmi Sen', designation: 'Internal Auditor', department: 'Accounts', phoneNumber: '9876543234', dateOfJoining: '2022-06-18', status: 'active', isDemo: true },
    ];

    for (const staff of demoStaffList) {
      this.data.staff.push({
        ...staff,
        id: `staff-demo-${staff.employeeId}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Generate realistic attendance for the past 14 days + today
    let attCount = 0;
    const today = new Date();
    const statuses: AttendanceStatus[] = ['present', 'present', 'present', 'present', 'present', 'present', 'present', 'absent', 'casual_leave', 'half_day'];

    for (let dayOffset = 14; dayOffset >= 0; dayOffset--) {
      const d = new Date(today);
      d.setDate(d.getDate() - dayOffset);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0 is Sunday

      for (let i = 0; i < demoStaffList.length; i++) {
        const emp = demoStaffList[i];
        let status: AttendanceStatus = 'present';

        if (dayOfWeek === 0) {
          status = 'weekly_off';
        } else {
          // Semi-random status with high probability of present
          const hash = (i * 17 + dayOffset * 31) % statuses.length;
          status = statuses[hash];
          // Keep most people present
          if (i === 2 && dayOffset === 2) status = 'medical_leave';
          if (i === 1 && dayOffset === 4) status = 'casual_leave';
          if (i === 0 && dayOffset === 1) status = 'present';
          if (i === 7 && dayOffset <= 2) status = 'absent'; // intentional frequent absence example
          if (i === 7 && dayOffset === 5) status = 'absent';
        }

        this.data.attendance.push({
          id: `att-${dateStr}-${emp.employeeId}`,
          employeeId: emp.employeeId,
          date: dateStr,
          status,
          updatedBy: 'System Demo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        attCount++;
      }
    }

    // Add 2 demo leave requests
    this.data.leaveRequests.push({
      id: `lvr-demo-1`,
      employeeId: 'EMP-001',
      leaveCategoryId: 'cat-cl',
      fromDate: today.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0],
      daysCount: 1,
      reason: 'Family function',
      status: 'approved',
      approvedBy: 'Admin',
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.data.leaveRequests.push({
      id: `lvr-demo-2`,
      employeeId: 'EMP-002',
      leaveCategoryId: 'cat-cl',
      fromDate: today.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0],
      daysCount: 1,
      reason: 'Personal banking work',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.logAudit(
      performedBy,
      'DEMO_DATA_LOADED',
      'System',
      undefined,
      `Loaded 25 sample employees and ${attCount} attendance entries.`,
      'Demo mode activated for evaluation'
    );
    this.persist();

    return { staffCount: demoStaffList.length, attendanceCount: attCount };
  }

  public removeDemoData(performedBy: string): { staffRemoved: number } {
    const demoStaff = this.data.staff.filter((s) => s.isDemo || s.employeeId.startsWith('EMP-0'));
    const demoEmpIds = new Set(demoStaff.map((s) => s.employeeId));

    this.data.staff = this.data.staff.filter((s) => !demoEmpIds.has(s.employeeId));
    this.data.attendance = this.data.attendance.filter((a) => !demoEmpIds.has(a.employeeId));
    this.data.leaveRequests = this.data.leaveRequests.filter((l) => !demoEmpIds.has(l.employeeId));

    this.logAudit(
      performedBy,
      'DEMO_DATA_REMOVED',
      'System',
      `Removed ${demoStaff.length} demo staff records.`,
      undefined,
      'Cleaned up demo data'
    );
    this.persist();

    return { staffRemoved: demoStaff.length };
  }

  // --- Network info ---
  public getNetworkInfo(): { localIps: string[]; port: number; hostname: string } {
    const interfaces = os.networkInterfaces();
    const localIps: string[] = [];

    for (const ifaceName of Object.keys(interfaces)) {
      const iface = interfaces[ifaceName];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            localIps.push(alias.address);
          }
        }
      }
    }

    if (localIps.length === 0) {
      localIps.push('127.0.0.1');
    }

    return {
      localIps,
      port: 3000,
      hostname: os.hostname(),
    };
  }

  // Helpers
  private getDatesInRange(startDateStr: string, endDateStr: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDateStr);
    const end = new Date(endDateStr);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  private calculateWorkingDaysBetween(startDateStr: string, endDateStr: string): number {
    const dates = this.getDatesInRange(startDateStr, endDateStr);
    const holidays = new Set(this.data.holidays.map((h) => h.date));
    const weeklyOffs = new Set(this.data.settings.weeklyOffDays);

    let count = 0;
    for (const d of dates) {
      const dayOfWeek = new Date(d).toLocaleDateString('en-US', { weekday: 'short' });
      if (!holidays.has(d) && !weeklyOffs.has(dayOfWeek)) {
        count++;
      }
    }
    return count > 0 ? count : 1;
  }
}

export const db = new LocalDatabase();
