import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Layers,
  ArrowRight,
  Info,
  RefreshCw,
  Building2,
  X,
  FileText,
  Copy,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Staff, StaffImportRowValidation, StaffImportValidationResult } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TANSIDCO_OFFICIAL_STAFF } from '../data/tansidcoStaffData';

interface StaffImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  existingStaffList: Staff[];
}

export const StaffImportModal: React.FC<StaffImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingStaffList,
}) => {
  const { showToast, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [rawTextPaste, setRawTextPaste] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');

  // Preview & Validation Data
  const [validationResult, setValidationResult] = useState<StaffImportValidationResult | null>(null);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'errors' | 'duplicates'>('all');
  const [onDuplicateAction, setOnDuplicateAction] = useState<'skip' | 'update'>('update');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  // --- Normalization & Extraction Helpers ---
  const findColumnValue = (row: Record<string, any>, possibleKeys: string[]): string => {
    const keys = Object.keys(row);
    for (const key of keys) {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const pk of possibleKeys) {
        const cleanPk = pk.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanKey === cleanPk || cleanKey.includes(cleanPk)) {
          const val = row[key];
          if (val !== undefined && val !== null) {
            return String(val).trim();
          }
        }
      }
    }
    return '';
  };

  const processExtractedRows = (rows: any[], sourceFileName: string) => {
    if (!rows || rows.length === 0) {
      showToast('error', 'No rows found in the selected file or text.');
      return;
    }

    const existingEmpMap = new Map<string, Staff>();
    existingStaffList.forEach((s) => {
      existingEmpMap.set(s.employeeId.trim().toLowerCase(), s);
    });

    const fileEmpIds = new Set<string>();
    const validatedRows: StaffImportRowValidation[] = [];

    let missingEmpIdCount = 0;
    let missingNameCount = 0;
    let possibleDupCount = 0;
    let existingInDbCount = 0;
    let validCount = 0;

    rows.forEach((row, idx) => {
      // 1. Extract columns preserving exact strings
      const originalSerial = findColumnValue(row, ['slno', 'sno', 'sl', 'serialno', 'serial', '1']);
      const empId = findColumnValue(row, ['epfno', 'epfacno', 'epf', 'employeeid', 'empid', 'staffid', 'empcode', '2']);
      const fullName = findColumnValue(row, ['nameofthestaff', 'nameoftheemployee', 'staffname', 'employeename', 'fullname', 'name', '3']);
      const designation = findColumnValue(row, ['designation', 'role', 'post', 'cadre', 'desig', '4']);
      const department = findColumnValue(row, ['department', 'dept', 'section', 'wing', 'branch']);
      const phone = findColumnValue(row, ['phonenumber', 'phone', 'mobile', 'contact', 'contactno']);
      const dateOfJoining = findColumnValue(row, ['dateofjoining', 'joiningdate', 'doj', 'appointmentdate']);
      const statusRaw = findColumnValue(row, ['status']);

      // 2. Sequential serial number correction (001, 002, 003...)
      const correctedSerialNo = String(idx + 1).padStart(3, '0');

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!empId) {
        errors.push('Missing Employee ID / EPF No.');
        missingEmpIdCount++;
      }
      if (!fullName) {
        errors.push('Missing Staff Name.');
        missingNameCount++;
      }

      // Check for duplicate in file
      if (empId) {
        const cleanId = empId.toLowerCase();
        if (fileEmpIds.has(cleanId)) {
          errors.push(`Duplicate Employee ID "${empId}" found multiple times in this file.`);
          possibleDupCount++;
        } else {
          fileEmpIds.add(cleanId);
        }
      }

      // Check if already in DB
      let isExisting = false;
      let existingStaffName = '';
      if (empId && existingEmpMap.has(empId.toLowerCase())) {
        isExisting = true;
        existingStaffName = existingEmpMap.get(empId.toLowerCase())?.fullName || '';
        existingInDbCount++;
        warnings.push(`Matches existing database record: ${existingStaffName}`);
      }

      if (!designation) {
        warnings.push('Designation not specified (defaulting to Staff).');
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;

      validatedRows.push({
        rowIndex: idx + 1,
        originalSerialNo: originalSerial || undefined,
        correctedSerialNo,
        employeeId: empId,
        fullName,
        designation: designation || 'Staff',
        department: department || 'General',
        phoneNumber: phone || '',
        dateOfJoining: dateOfJoining || '',
        status: statusRaw.toLowerCase() === 'inactive' ? 'inactive' : 'active',
        isValid,
        isExisting,
        existingStaffName,
        errors,
        warnings,
      });
    });

    const result: StaffImportValidationResult = {
      fileName: sourceFileName,
      totalRecordsDetected: rows.length,
      validRecordsCount: validCount,
      possibleDuplicatesCount: possibleDupCount,
      existingInDbCount,
      missingEmployeeIdCount: missingEmpIdCount,
      missingNameCount: missingNameCount,
      serialNumbersCorrectedCount: rows.length,
      rows: validatedRows,
    };

    setFileName(sourceFileName);
    setValidationResult(result);
    setImportStep('preview');
  };

  // --- Handle File Upload (Excel or CSV) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          processExtractedRows(json, file.name);
        } catch (err: any) {
          showToast('error', `Failed to parse Excel file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (fileExt === 'csv' || fileExt === 'txt') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processExtractedRows(results.data, file.name);
        },
        error: (err) => {
          showToast('error', `Failed to parse CSV file: ${err.message}`);
        },
      });
    } else {
      showToast('error', 'Unsupported file type. Please upload an Excel (.xlsx, .xls) or CSV file.');
    }
  };

  // --- Handle Paste Text ---
  const handlePasteProcess = () => {
    if (!rawTextPaste.trim()) {
      showToast('error', 'Please paste table text or CSV rows.');
      return;
    }

    Papa.parse(rawTextPaste.trim(), {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          showToast('error', 'No structured rows recognized in pasted text.');
          return;
        }
        processExtractedRows(results.data, 'Pasted Data.csv');
      },
      error: (err) => {
        showToast('error', `Failed to parse text: ${err.message}`);
      },
    });
  };

  // --- Load Official TANSIDCO Dataset ---
  const handleLoadOfficialTansidco = () => {
    processExtractedRows(
      TANSIDCO_OFFICIAL_STAFF.map((s, idx) => ({
        'Sl. No.': s.serialNo,
        'EPF No.': s.employeeId,
        'Name of the Staff': s.fullName,
        'Designation': s.designation,
        'Department': s.department,
        'Phone Number': s.phoneNumber,
        'Date of Joining': s.dateOfJoining,
        'Status': s.status,
      })),
      'TANSIDCO_Official_Staff_Roster.xlsx'
    );
  };

  // --- Download Sample Template ---
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'Sl. No.': '1',
        'EPF No.': '814',
        'Name of the Staff': 'M. Babu',
        'Designation': 'DGM',
        'Department': 'Administration',
        'Phone Number': '+91 94440 10814',
        'Date of Joining': '2010-04-15',
        'Status': 'active',
      },
      {
        'Sl. No.': '2',
        'EPF No.': '815',
        'Name of the Staff': 'V. Saravanabava',
        'Designation': 'DGM',
        'Department': 'Engineering',
        'Phone Number': '+91 94440 10815',
        'Date of Joining': '2010-05-20',
        'Status': 'active',
      },
      {
        'Sl. No.': '3',
        'EPF No.': '829',
        'Name of the Staff': 'S.Vimala',
        'Designation': 'DGM',
        'Department': 'Finance & Accounts',
        'Phone Number': '+91 94440 10829',
        'Date of Joining': '2011-01-10',
        'Status': 'active',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'StaffMaster');
    XLSX.writeFile(wb, 'TANSIDCO_Staff_Import_Template.xlsx');
    showToast('success', 'Sample import template downloaded.');
  };

  // --- Confirm and Commit Import ---
  const handleConfirmImport = async () => {
    if (!validationResult) return;

    const validRowsToImport = validationResult.rows.filter((r) => r.isValid);
    if (validRowsToImport.length === 0) {
      showToast('error', 'No valid records available for import.');
      return;
    }

    setIsProcessing(true);
    try {
      const payload = validRowsToImport.map((r) => ({
        serialNo: r.correctedSerialNo,
        employeeId: r.employeeId,
        fullName: r.fullName,
        designation: r.designation,
        department: r.department,
        phoneNumber: r.phoneNumber,
        dateOfJoining: r.dateOfJoining,
        status: r.status,
      }));

      const res = await api.bulkImportStaff(payload, onDuplicateAction);

      showToast(
        'success',
        `Successfully imported ${res.addedCount} staff members (${res.updatedCount || 0} updated, ${res.skippedCount || 0} skipped).`,
        'Staff Master Updated'
      );
      onImportSuccess();
      onClose();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to complete staff data import.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter preview rows
  const displayedRows = validationResult?.rows.filter((r) => {
    if (filterView === 'valid') return r.isValid;
    if (filterView === 'errors') return !r.isValid;
    if (filterView === 'duplicates') return r.isExisting || r.errors.some((e) => e.includes('Duplicate'));
    return true;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                <span>Staff Master Data Import</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  TANSIDCO Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact data extraction, sequential serial number correction & single-source-of-truth validation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {importStep === 'upload' ? (
            <div className="space-y-6">
              {/* Presets & Official Roster Shortcut */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-600 text-white shadow-sm shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-950">Official TANSIDCO Staff Register (135 Records)</h4>
                    <p className="text-xs text-blue-800 mt-0.5">
                      Instantly load the exact pre-verified staff roster from the corporation registers (EPF 814 M. Babu, 815 V. Saravanabava, etc.).
                    </p>
                  </div>
                </div>
                <button
                  id="load-tansidco-official-roster-btn"
                  onClick={handleLoadOfficialTansidco}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-2 whitespace-nowrap transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Load Official Roster</span>
                </button>
              </div>

              {/* Upload Tabs: File vs Paste */}
              <div className="flex items-center border-b border-slate-200 gap-6">
                <button
                  onClick={() => setActiveTab('file')}
                  className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
                    activeTab === 'file'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Excel / CSV File</span>
                </button>
                <button
                  onClick={() => setActiveTab('paste')}
                  className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
                    activeTab === 'paste'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                  <span>Paste Structured Table Text</span>
                </button>
              </div>

              {activeTab === 'file' ? (
                /* Drag & Drop File Zone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv, .txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4 group-hover:scale-105 transition shadow-sm">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    Click to browse or drag and drop your staff file
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mt-1">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV files. Columns are automatically mapped (Sl. No, EPF No, Staff Name, Designation, Department, Phone).
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-200 text-slate-700">
                      Excel / CSV / Spreadsheets
                    </span>
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      Auto S.No Correction
                    </span>
                  </div>
                </div>
              ) : (
                /* Paste Text Zone */
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Paste CSV or Tab-Delimited Staff Table:
                  </label>
                  <textarea
                    rows={8}
                    value={rawTextPaste}
                    onChange={(e) => setRawTextPaste(e.target.value)}
                    placeholder="S.No, EPF No, Name of the Staff, Designation, Department&#10;1, 814, M. Babu, DGM, Administration&#10;2, 815, V. Saravanabava, DGM, Technical&#10;3, 829, S.Vimala, DGM, Finance & Accounts"
                    className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                  <button
                    onClick={handlePasteProcess}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow transition"
                  >
                    Process Pasted Text
                  </button>
                </div>
              )}

              {/* Rules & Guidelines */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Exact Data Preservation</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Employee IDs, full names, designations, and departments are preserved exactly without spelling alterations.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Sequential Serial Correction</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Messy or duplicate serial numbers in raw files are automatically standardized to sequential 3-digit keys (001, 002, 003...).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>Sample Template</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Download pre-structured TANSIDCO Excel template.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 text-left underline flex items-center gap-1"
                  >
                    Download Excel Template
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: PREVIEW & VALIDATION SUMMARY */
            <div className="space-y-5">
              {/* Top Summary Banner */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="font-bold text-base text-white">{validationResult?.fileName}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Review structural checks and duplicate handling options before confirming database write.
                    </p>
                  </div>

                  {/* Duplicate Handling Selector */}
                  <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 flex items-center gap-3">
                    <span className="text-xs text-slate-300 font-semibold whitespace-nowrap">If Employee ID Exists:</span>
                    <select
                      value={onDuplicateAction}
                      onChange={(e) => setOnDuplicateAction(e.target.value as any)}
                      className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2.5 py-1 border border-slate-600 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="update">Update Existing Staff Details (Keep History)</option>
                      <option value="skip">Skip Existing Records</option>
                    </select>
                  </div>
                </div>

                {/* 5 Statistic Metric Blocks */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-800">
                  <div className="bg-slate-800/80 p-3 rounded-xl">
                    <span className="text-[11px] text-slate-400 font-medium block">Total Detected</span>
                    <span className="text-xl font-bold text-white mt-0.5 block">
                      {validationResult?.totalRecordsDetected}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl">
                    <span className="text-[11px] text-emerald-400 font-medium block">Valid & Ready</span>
                    <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
                      {validationResult?.validRecordsCount}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl">
                    <span className="text-[11px] text-amber-400 font-medium block">Existing in DB</span>
                    <span className="text-xl font-bold text-amber-400 mt-0.5 block">
                      {validationResult?.existingInDbCount}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl">
                    <span className="text-[11px] text-rose-400 font-medium block">Problem Rows</span>
                    <span className="text-xl font-bold text-rose-400 mt-0.5 block">
                      {(validationResult?.totalRecordsDetected || 0) - (validationResult?.validRecordsCount || 0)}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl">
                    <span className="text-[11px] text-blue-400 font-medium block">S.No Standardized</span>
                    <span className="text-xl font-bold text-blue-400 mt-0.5 block">
                      {validationResult?.serialNumbersCorrectedCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filter Tabs for Preview Table */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterView('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterView === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Records ({validationResult?.rows.length})
                  </button>
                  <button
                    onClick={() => setFilterView('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterView === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Valid Records ({validationResult?.validRecordsCount})
                  </button>
                  <button
                    onClick={() => setFilterView('duplicates')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterView === 'duplicates'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Existing / Duplicates ({validationResult?.existingInDbCount})
                  </button>
                  <button
                    onClick={() => setFilterView('errors')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterView === 'errors'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                    }`}
                  >
                    Errors / Problems (
                    {(validationResult?.totalRecordsDetected || 0) - (validationResult?.validRecordsCount || 0)})
                  </button>
                </div>

                <button
                  onClick={() => {
                    setImportStep('upload');
                    setValidationResult(null);
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                >
                  Choose different file
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 uppercase text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Row</th>
                      <th className="py-2.5 px-3 w-16 text-center">S.No</th>
                      <th className="py-2.5 px-3 w-28">EPF / Emp ID</th>
                      <th className="py-2.5 px-4">Staff Name</th>
                      <th className="py-2.5 px-3">Designation</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-4">Validation Status & Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {displayedRows.map((r) => (
                      <tr
                        key={r.rowIndex}
                        className={`hover:bg-slate-50 transition ${
                          !r.isValid ? 'bg-rose-50/50' : r.isExisting ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">{r.rowIndex}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">
                          {r.correctedSerialNo}
                          {r.originalSerialNo && r.originalSerialNo !== r.correctedSerialNo && (
                            <span className="block text-[9px] text-slate-400 font-normal line-through">
                              orig: {r.originalSerialNo}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {r.employeeId || <span className="text-rose-600 italic">Missing ID</span>}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {r.fullName || <span className="text-rose-600 italic">Missing Name</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{r.designation}</td>
                        <td className="py-2.5 px-3 text-slate-600">{r.department}</td>
                        <td className="py-2.5 px-4">
                          {r.errors.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-[11px]">
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{r.errors.join('; ')}</span>
                            </div>
                          ) : r.isExisting ? (
                            <div className="flex items-center gap-1.5 text-amber-700 font-medium text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Existing Staff ({onDuplicateAction === 'update' ? 'Will update details' : 'Will skip'})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Ready to insert</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {importStep === 'preview' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setImportStep('upload');
                  setValidationResult(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl transition"
              >
                Cancel Import
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600 font-medium">
                  Ready to import <strong className="text-slate-900">{validationResult?.validRecordsCount}</strong>{' '}
                  records
                </span>
                <button
                  type="button"
                  id="confirm-staff-import-btn"
                  onClick={handleConfirmImport}
                  disabled={isProcessing || (validationResult?.validRecordsCount || 0) === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Writing to Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Import</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
