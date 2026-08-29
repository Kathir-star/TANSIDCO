import {
  Staff,
  AttendanceRecord,
  AttendanceStatus,
  LeaveCategory,
  LeaveRequest,
  LeaveRecord,
  Holiday,
  AuditLog,
  AuditLogEntry,
  SystemSettings,
  AdminUser,
  DashboardStats,
  StaffLeaveSummary,
  MonthlyAttendanceReportItem,
  PendingSyncRecord,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '') + '/api';

class ApiService {
  private token: string | null = null;
  private isOffline: boolean = !navigator.onLine;
  private pendingSyncKey = 'attendance_pending_sync_queue_v1';

  constructor() {
    this.token = localStorage.getItem('attendance_auth_token');
    window.addEventListener('online', () => {
      this.isOffline = false;
      this.autoSyncPending();
    });
    window.addEventListener('offline', () => {
      this.isOffline = true;
    });
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('attendance_auth_token', token);
    } else {
      localStorage.removeItem('attendance_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getIsOffline(): boolean {
    return this.isOffline || !navigator.onLine;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });

      if (res.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('Unauthorized. Please log in.');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      if (!navigator.onLine || err.message === 'Failed to fetch') {
        this.isOffline = true;
      }
      throw err;
    }
  }

  // --- Offline Sync Queue ---
  public getPendingSyncRecords(): PendingSyncRecord[] {
    try {
      const raw = localStorage.getItem(this.pendingSyncKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public queuePendingRecord(record: Omit<PendingSyncRecord, 'id' | 'timestamp'>) {
    const records = this.getPendingSyncRecords();
    records.push({
      ...record,
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(this.pendingSyncKey, JSON.stringify(records));
  }

  public clearPendingSyncRecords() {
    localStorage.removeItem(this.pendingSyncKey);
  }

  public async autoSyncPending(): Promise<number> {
    const pending = this.getPendingSyncRecords();
    if (pending.length === 0) return 0;

    try {
      const res = await this.request<{ success: boolean; syncedCount: number }>('/sync/batch', {
        method: 'POST',
        body: JSON.stringify({ records: pending }),
      });
      if (res.success) {
        this.clearPendingSyncRecords();
        localStorage.setItem('attendance_last_sync_time', new Date().toISOString());
        return res.syncedCount;
      }
    } catch (err) {
      console.warn('Auto sync failed (offline or server unreachable):', err);
    }
    return 0;
  }

  public getLastSyncTime(): string | null {
    return localStorage.getItem('attendance_last_sync_time');
  }

  // --- Auth APIs ---
  public async login(username: string, password: string): Promise<{ token: string; user: AdminUser }> {
    const res = await this.request<{ token: string; user: AdminUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(res.token);
    return res;
  }

  public async getMe(): Promise<{ user: AdminUser }> {
    return this.request<{ user: AdminUser }>('/auth/me');
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  public async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  }

  public async completeSetup(setupData: any): Promise<{ success: boolean; message: string }> {
    return this.request('/setup', {
      method: 'POST',
      body: JSON.stringify(setupData),
    });
  }

  // --- Settings & Network ---
  public async getSettings(): Promise<SystemSettings> {
    const settings = await this.request<SystemSettings>('/settings');
    return {
      ...settings,
      isConfigured: settings.isSetupCompleted !== false,
    };
  }

  public async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    return this.request<SystemSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  public async getNetworkInfo(): Promise<{ localIp: string; port: number; networkUrl: string }> {
    const res = await this.request<{ localIps: string[]; port: number; hostname: string }>('/network/info');
    const primaryIp = res.localIps?.[0] || 'localhost';
    return {
      localIp: primaryIp,
      port: res.port || 3000,
      networkUrl: `http://${primaryIp}:${res.port || 3000}`,
    };
  }

  // --- Staff APIs ---
  public async getStaffList(includeInactive: boolean = true): Promise<Staff[]> {
    return this.request<Staff[]>(`/staff?includeInactive=${includeInactive}`);
  }

  public async getStaffById(id: string): Promise<Staff> {
    return this.request<Staff>(`/staff/${id}`);
  }

  public async addStaff(staffData: Partial<Staff>): Promise<Staff> {
    return this.request<Staff>('/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
  }

  public async updateStaff(id: string, updates: Partial<Staff>): Promise<Staff> {
    return this.request<Staff>(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public async deactivateStaff(id: string): Promise<Staff> {
    return this.request<Staff>(`/staff/${id}/deactivate`, { method: 'POST' });
  }

  public async reactivateStaff(id: string): Promise<Staff> {
    return this.request<Staff>(`/staff/${id}/reactivate`, { method: 'POST' });
  }

  public async permanentlyDeleteStaff(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/staff/${id}/permanent`, { method: 'DELETE' });
  }

  public async bulkImportStaff(
    staffList: any[],
    onDuplicateAction: 'skip' | 'update' = 'update'
  ): Promise<{ addedCount: number; updatedCount?: number; skippedCount: number; errors: string[] }> {
    return this.request('/staff/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ staffList, onDuplicateAction }),
    });
  }

  public async loadTansidcoRoster(): Promise<{ success: boolean; count: number; message: string }> {
    return this.request('/staff/load-tansidco-roster', {
      method: 'POST',
    });
  }

  // --- Attendance APIs ---
  public async getAttendanceForDate(dateStr: string): Promise<AttendanceRecord[]> {
    return this.request<AttendanceRecord[]>(`/attendance?date=${dateStr}`);
  }

  public async getAttendanceRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
    return this.request<AttendanceRecord[]>(`/attendance/range?startDate=${startDate}&endDate=${endDate}`);
  }

  public async getAttendanceForStaff(employeeId: string): Promise<AttendanceRecord[]> {
    return this.request<AttendanceRecord[]>(`/attendance/staff/${employeeId}`);
  }

  public async saveAttendanceBatch(
    date: string,
    records: Array<{ employeeId: string; status: AttendanceStatus; notes?: string }>
  ): Promise<{ success: boolean; message: string; savedCount: number; updatedCount: number }> {
    return this.request('/attendance/batch', {
      method: 'POST',
      body: JSON.stringify({ date, records }),
    });
  }

  public async updateSingleAttendance(
    employeeId: string,
    date: string,
    status: AttendanceStatus,
    notes?: string
  ): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>('/attendance/single', {
      method: 'PUT',
      body: JSON.stringify({ employeeId, date, status, notes }),
    });
  }

  // --- Leave APIs ---
  public async getLeaveCategories(): Promise<LeaveCategory[]> {
    return this.request<LeaveCategory[]>('/leave-categories');
  }

  public async addLeaveCategory(category: Omit<LeaveCategory, 'id'>): Promise<LeaveCategory> {
    return this.request<LeaveCategory>('/leave-categories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
  }

  public async updateLeaveCategory(id: string, updates: Partial<LeaveCategory>): Promise<LeaveCategory> {
    return this.request<LeaveCategory>(`/leave-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public async deleteLeaveCategory(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/leave-categories/${id}`, {
      method: 'DELETE',
    });
  }

  public async updateLeaveCategories(categories: LeaveCategory[]): Promise<void> {
    for (const cat of categories) {
      if (cat.id) {
        await this.request(`/leave-categories/${cat.id}`, {
          method: 'PUT',
          body: JSON.stringify(cat),
        });
      } else {
        await this.request('/leave-categories', {
          method: 'POST',
          body: JSON.stringify(cat),
        });
      }
    }
  }

  public async getLeaveRecords(): Promise<LeaveRecord[]> {
    const raw = await this.request<LeaveRequest[]>('/leave-requests');
    const categories = await this.getLeaveCategories();
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    return raw.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      category: r.leaveCategoryId,
      categoryName: catMap.get(r.leaveCategoryId) || r.leaveCategoryId,
      startDate: r.fromDate,
      endDate: r.toDate,
      daysCount: r.daysCount,
      reason: r.reason,
      status: r.status,
      medicalDocumentStatus: r.medicalDocumentStatus,
      medicalDocumentName: r.medicalDocumentName,
      medicalDocumentDate: r.medicalDocumentDate,
      createdAt: r.createdAt,
    }));
  }

  public async getLeaveRequests(): Promise<LeaveRequest[]> {
    return this.request<LeaveRequest[]>('/leave-requests');
  }

  public async applyLeave(data: {
    employeeId: string;
    category: string;
    startDate: string;
    endDate: string;
    reason: string;
    daysCount: number;
    medicalDocumentStatus?: 'submitted' | 'not_submitted';
    medicalDocumentName?: string;
  }): Promise<{ request: LeaveRequest; balanceWarning?: string }> {
    return this.request('/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: data.employeeId,
        leaveCategoryId: data.category,
        fromDate: data.startDate,
        toDate: data.endDate,
        reason: data.reason,
        daysCount: data.daysCount,
        medicalDocumentStatus: data.medicalDocumentStatus,
        medicalDocumentName: data.medicalDocumentName,
      }),
    });
  }

  public async updateLeaveStatus(
    id: string,
    status: 'approved' | 'rejected',
    overrideReason?: string
  ): Promise<LeaveRequest> {
    return this.request(`/leave-requests/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, overrideReason }),
    });
  }

  public async updateMedicalDocumentStatus(
    id: string,
    status: 'submitted' | 'not_submitted',
    documentName?: string
  ): Promise<LeaveRequest> {
    return this.request(`/leave-requests/${id}/medical-doc`, {
      method: 'PUT',
      body: JSON.stringify({ status, documentName }),
    });
  }

  public async getStaffLeaveBalance(employeeId: string): Promise<StaffLeaveSummary> {
    const raw = await this.request<any>(`/leave-balance/${employeeId}`);
    return {
      employeeId: raw.staff?.employeeId || employeeId,
      fullName: raw.staff?.fullName || '',
      department: raw.staff?.department || '',
      categories: raw.categories || [],
      totalAllowed: raw.totalAllowed || 0,
      totalUsed: raw.totalUsed || 0,
      totalRemaining: raw.totalRemaining || 0,
      totalPending: raw.totalPending || 0,
      staff: raw.staff,
    };
  }

  public async getAllStaffLeaveBalances(): Promise<StaffLeaveSummary[]> {
    const raw = await this.request<any[]>('/reports/leave-balances');
    return raw.map((item) => ({
      employeeId: item.staff?.employeeId || '',
      fullName: item.staff?.fullName || '',
      department: item.staff?.department || '',
      categories: item.categories || [],
      totalAllowed: item.totalAllowed || 0,
      totalUsed: item.totalUsed || 0,
      totalRemaining: item.totalRemaining || 0,
      totalPending: item.totalPending || 0,
      staff: item.staff,
    }));
  }

  // --- Holidays ---
  public async getHolidays(year?: number): Promise<Holiday[]> {
    return this.request<Holiday[]>(`/holidays${year ? `?year=${year}` : ''}`);
  }

  public async addHoliday(holiday: Omit<Holiday, 'id'>): Promise<Holiday> {
    return this.request<Holiday>('/holidays', {
      method: 'POST',
      body: JSON.stringify(holiday),
    });
  }

  public async deleteHoliday(id: string): Promise<{ success: boolean }> {
    return this.request(`/holidays/${id}`, { method: 'DELETE' });
  }

  // --- Dashboard & Reports ---
  public async getDashboardStats(dateStr?: string): Promise<DashboardStats> {
    return this.request<DashboardStats>(`/dashboard${dateStr ? `?date=${dateStr}` : ''}`);
  }

  public async getMonthlyReport(
    year: number,
    month: number
  ): Promise<MonthlyAttendanceReportItem[]> {
    const res = await this.request<{
      year: number;
      month: number;
      daysInMonth: number;
      staffRows: any[];
    }>(`/reports/monthly?year=${year}&month=${month}`);

    return (res.staffRows || []).map((row) => ({
      serialNo: row.staff?.serialNo,
      employeeId: row.staff?.employeeId,
      fullName: row.staff?.fullName,
      department: row.staff?.department,
      designation: row.staff?.designation,
      totalWorkingDays:
        row.presentCount + row.absentCount + row.leaveCount + row.halfDayCount,
      presentDays: row.presentCount,
      absentDays: row.absentCount,
      leaveDays: row.leaveCount,
      halfDays: row.halfDayCount,
      attendancePercentage: row.attendancePercentage,
    }));
  }

  // --- Audit Logs ---
  public async getAuditLogs(limit: number = 200): Promise<AuditLog[]> {
    const raw = await this.request<AuditLogEntry[]>(`/audit-logs?limit=${limit}`);
    return raw.map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      username: l.performedBy || (l as any).username || 'Admin',
      action: l.action,
      target: l.target,
      details: l.details,
    }));
  }

  // --- Backup & Restore ---
  public async exportBackup(): Promise<any> {
    return this.request<any>('/backup/export');
  }

  public async restoreBackup(content: any): Promise<{ success: boolean; message: string }> {
    return this.request('/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // --- Demo Controls ---
  public async loadDemoData(): Promise<{ success: boolean; message: string }> {
    return this.request('/demo/load', { method: 'POST' });
  }

  public async removeDemoData(): Promise<{ success: boolean; message: string }> {
    return this.request('/demo/remove', { method: 'POST' });
  }
}

export const api = new ApiService();
