import express from 'express';
import { db } from './storage';

export function createExpressApp() {
  const app = express();

  // Middlewares
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logger & CORS for local office network access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Auth helper middleware
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !db.validateSession(token)) {
      return res.status(401).json({ error: 'Unauthorized. Please login again.' });
    }
    next();
  };

  const getUsernameFromReq = (req: express.Request): string => {
    return 'Admin';
  };

  // --- API Routes ---

  // Health check & Network info
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      app: 'Staff Attendance & Leave Management System',
    });
  });

  app.get('/api/network/info', (req, res) => {
    const netInfo = db.getNetworkInfo();
    res.json(netInfo);
  });

  // Authentication
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const admin = db.getAdmin();
    if (username.trim().toLowerCase() !== admin.username.toLowerCase() || !db.verifyPassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = db.createSession(admin.username);
    db.logAudit(admin.username, 'LOGIN_SUCCESS', 'Admin Auth', undefined, undefined, 'Administrator logged in.');

    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !db.validateSession(token)) {
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }
    const admin = db.getAdmin();
    res.json({
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        lastLogin: admin.lastLogin,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      db.removeSession(token);
    }
    res.json({ success: true });
  });

  app.post('/api/auth/change-password', authMiddleware, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const username = getUsernameFromReq(req);
    const result = db.changePassword(oldPassword, newPassword, username);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    res.json(result);
  });

  // First time setup
  app.post('/api/setup', (req, res) => {
    try {
      const { officeName, adminPassword, leaveCategories, workingDays, weeklyOffDays, initialStaff } = req.body;

      if (officeName) {
        db.updateSettings({ officeName, workingDays, weeklyOffDays, isSetupCompleted: true }, 'Setup Wizard');
      }

      if (adminPassword && adminPassword.length >= 4) {
        db.changePassword('admin123', adminPassword, 'Setup Wizard');
      }

      if (leaveCategories && Array.isArray(leaveCategories)) {
        for (const cat of leaveCategories) {
          if (cat.id) {
            db.updateLeaveCategory(cat.id, cat, 'Setup Wizard');
          } else {
            db.addLeaveCategory(cat, 'Setup Wizard');
          }
        }
      }

      if (initialStaff && Array.isArray(initialStaff) && initialStaff.length > 0) {
        db.importStaffBulk(initialStaff, 'Setup Wizard');
      }

      res.json({ success: true, message: 'Setup completed successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Setup failed' });
    }
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    res.json(db.getSettings());
  });

  app.put('/api/settings', authMiddleware, (req, res) => {
    const username = getUsernameFromReq(req);
    const updated = db.updateSettings(req.body, username);
    res.json(updated);
  });

  // Staff Management
  app.get('/api/staff', (req, res) => {
    const includeInactive = req.query.includeInactive !== 'false';
    res.json(db.getStaffList(includeInactive));
  });

  app.get('/api/staff/:id', (req, res) => {
    const staff = db.getStaffById(req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });
    res.json(staff);
  });

  app.post('/api/staff', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const newStaff = db.addStaff(req.body, username);
      res.status(201).json(newStaff);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to add staff' });
    }
  });

  app.put('/api/staff/:id', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const updated = db.updateStaff(req.params.id, req.body, username);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update staff' });
    }
  });

  app.post('/api/staff/:id/deactivate', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const updated = db.deactivateStaff(req.params.id, username);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/staff/:id/reactivate', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const updated = db.reactivateStaff(req.params.id, username);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/staff/:id/permanent', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const result = db.permanentlyDeleteStaff(req.params.id, username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/staff/bulk-import', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const { staffList, onDuplicateAction } = req.body;
      if (!Array.isArray(staffList)) {
        return res.status(400).json({ error: 'staffList array is required' });
      }
      const result = db.importStaffBulk(staffList, username, onDuplicateAction || 'update');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Import failed' });
    }
  });

  app.post('/api/staff/load-tansidco-roster', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const result = db.loadOfficialTansidcoRoster(username);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load official roster' });
    }
  });

  // Daily Attendance
  app.get('/api/attendance', (req, res) => {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    res.json(db.getAttendanceForDate(dateStr));
  });

  app.get('/api/attendance/range', (req, res) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query params are required' });
    }
    res.json(db.getAttendanceRange(startDate, endDate));
  });

  app.get('/api/attendance/staff/:employeeId', (req, res) => {
    res.json(db.getAttendanceForStaff(req.params.employeeId));
  });

  app.post('/api/attendance/batch', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const { date, records } = req.body;
      if (!date || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Date and records array are required' });
      }
      const result = db.saveDailyAttendanceBatch(date, records, username);
      res.json({
        success: true,
        message: `Attendance saved successfully for ${records.length} staff members on ${date}.`,
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save attendance' });
    }
  });

  app.put('/api/attendance/single', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const { employeeId, date, status, notes } = req.body;
      if (!employeeId || !date || !status) {
        return res.status(400).json({ error: 'employeeId, date, and status are required' });
      }
      const updated = db.updateSingleAttendance(employeeId, date, status, notes, username);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Leave Categories
  app.get('/api/leave-categories', (req, res) => {
    res.json(db.getLeaveCategories());
  });

  app.post('/api/leave-categories', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const newCat = db.addLeaveCategory(req.body, username);
      res.status(201).json(newCat);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/leave-categories/:id', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const updated = db.updateLeaveCategory(req.params.id, req.body, username);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/leave-categories/:id', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const result = db.deleteLeaveCategory(req.params.id, username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Leave Requests & Balances
  app.get('/api/leave-requests', (req, res) => {
    res.json(db.getLeaveRequests());
  });

  app.get('/api/leave-balance/:employeeId', (req, res) => {
    try {
      const summary = db.calculateStaffLeaveSummary(req.params.employeeId);
      res.json(summary);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/leave-requests', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const result = db.addLeaveRequest(req.body, username);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/leave-requests/:id/status', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const { status, overrideReason } = req.body;
      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved or rejected' });
      }
      const updated = db.updateLeaveRequestStatus(req.params.id, status, overrideReason, username);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/leave-requests/:id/medical-doc', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const { status, documentName } = req.body;
      if (!status || !['submitted', 'not_submitted'].includes(status)) {
        return res.status(400).json({ error: 'Status must be submitted or not_submitted' });
      }
      const updated = db.updateMedicalDocumentStatus(req.params.id, status, documentName, username);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Holidays
  app.get('/api/holidays', (req, res) => {
    const year = req.query.year ? Number(req.query.year) : undefined;
    res.json(db.getHolidays(year));
  });

  app.post('/api/holidays', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const newHol = db.addHoliday(req.body, username);
      res.status(201).json(newHol);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/holidays/:id', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const success = db.deleteHoliday(req.params.id, username);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dashboard & Reports
  app.get('/api/dashboard', (req, res) => {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    res.json(db.getDashboardStats(dateStr));
  });

  app.get('/api/reports/monthly', (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    res.json(db.getMonthlyReport(year, month));
  });

  app.get('/api/reports/leave-balances', (req, res) => {
    const staffList = db.getStaffList(false);
    const summaries = staffList.map((s) => db.calculateStaffLeaveSummary(s.employeeId));
    res.json(summaries);
  });

  // Audit Logs
  app.get('/api/audit-logs', authMiddleware, (req, res) => {
    const limit = Number(req.query.limit) || 200;
    res.json(db.getAuditLogs(limit));
  });

  // Backup & Restore
  app.get('/api/backup/export', authMiddleware, (req, res) => {
    try {
      const fullData = db.exportFullDatabase();
      res.json(fullData);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to export backup' });
    }
  });

  app.get('/api/backup/list', authMiddleware, (req, res) => {
    res.json(db.listBackups());
  });

  app.post('/api/backup/create', authMiddleware, (req, res) => {
    try {
      const result = db.createBackup(req.body?.filename);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create backup' });
    }
  });

  app.post('/api/backup/restore', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const { backupFileName } = req.body;
      if (!backupFileName) {
        return res.status(400).json({ error: 'backupFileName is required' });
      }
      const result = db.restoreBackup(backupFileName, username);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore backup' });
    }
  });

  app.post('/api/backup/upload-restore', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const { jsonData } = req.body;
      if (!jsonData) {
        return res.status(400).json({ error: 'jsonData is required' });
      }
      const result = db.restoreBackup(jsonData, username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid backup data' });
    }
  });

  // Offline Sync Queue Endpoint
  app.post('/api/sync/batch', authMiddleware, (req, res) => {
    try {
      const username = getUsernameFromReq(req);
      const { records } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: 'records array is required' });
      }

      let syncedCount = 0;
      for (const item of records) {
        if (item.type === 'attendance') {
          db.updateSingleAttendance(
            item.data.employeeId,
            item.data.date,
            item.data.status,
            item.data.notes,
            `${username} (Synced)`
          );
          syncedCount++;
        } else if (item.type === 'staff' && item.action === 'insert') {
          try {
            db.addStaff(item.data, `${username} (Synced)`);
            syncedCount++;
          } catch (e) {
            // Already exists or invalid
          }
        }
      }

      res.json({
        success: true,
        syncedCount,
        message: `Successfully synchronized ${syncedCount} offline records.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
