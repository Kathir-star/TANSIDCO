import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  History,
  FileJson,
  CheckCircle,
  FileCheck,
  HardDrive,
} from 'lucide-react';
import { AuditLog } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const BackupRestore: React.FC = () => {
  const { showToast, refreshSettings } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  const loadAudit = async () => {
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const handleDownloadBackup = async () => {
    setIsLoading(true);
    try {
      const data = await api.exportBackup();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `staff_attendance_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast('success', 'Backup database file downloaded successfully.', 'Backup Created');
      loadAudit();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate backup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Warning: Restoring will overwrite all existing staff, attendance, and leave records with the contents of this file. Do you wish to continue?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backupData = JSON.parse(text);

        if (!backupData.staff || !backupData.attendance) {
          throw new Error('Invalid backup file format: Missing staff or attendance arrays.');
        }

        setIsRestoring(true);
        const res = await api.restoreBackup(backupData);
        await refreshSettings();
        setRestoreStatus(res.message);
        showToast('success', res.message, 'Database Restored');
        loadAudit();
      } catch (err: any) {
        showToast('error', err.message || 'Failed to restore database from file.');
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <span>Data Backup, Restore & Security Ledger</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Download full offline snapshots to USB flash drives or local hard disks. Keep your office data completely secure and independent of any cloud provider.
        </p>
      </div>

      {/* Backup and Restore Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Create Backup */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Create Database Backup</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Generates a single self-contained JSON snapshot containing all employee rosters, historical daily attendance records, leave balances, declared holidays, and audit logs.
            </p>
          </div>

          <div className="pt-2">
            <button
              id="backup-download-btn"
              disabled={isLoading}
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isLoading ? 'Creating snapshot...' : 'Download Full Backup (.json)'}</span>
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Recommended: Save a weekly backup copy to a local drive.
            </p>
          </div>
        </div>

        {/* Restore Backup */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Restore from Backup File</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Restore your office attendance system on a new computer or recover from an accidental data loss by uploading a previously downloaded backup JSON file.
            </p>
          </div>

          <div className="pt-2">
            <label
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition cursor-pointer ${
                isRestoring ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{isRestoring ? 'Restoring data...' : 'Select Backup File to Restore'}</span>
              <input
                id="backup-upload-input"
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-rose-500 text-center mt-2">
              Warning: Restoring will overwrite existing records.
            </p>
          </div>
        </div>
      </div>

      {restoreStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{restoreStatus}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>Administrative Audit Log</span>
          </h3>
          <span className="text-xs text-slate-400">{auditLogs.length} logged events</span>
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
          {auditLogs.length === 0 ? (
            <div className="py-6 text-center text-slate-400">No audit logs recorded yet.</div>
          ) : (
            auditLogs.slice(0, 50).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{log.action}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{log.details}</div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <div>{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="font-mono">by {log.username}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
