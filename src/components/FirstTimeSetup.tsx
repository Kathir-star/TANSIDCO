import React, { useState } from 'react';
import {
  Building2,
  KeyRound,
  CalendarCheck,
  Palmtree,
  Users,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Papa from 'papaparse';

interface FirstTimeSetupProps {
  onComplete: () => void;
}

export const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ onComplete }) => {
  const { showToast, refreshSettings } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Admin
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('admin123');

  // Step 2: Office Info
  const [officeName, setOfficeName] = useState('Apex Enterprises & Engineering');
  const [financialYear, setFinancialYear] = useState('2026-2027');

  // Step 3: Leave Categories
  const [leaveCategories, setLeaveCategories] = useState([
    { name: 'Casual Leave', code: 'casual_leave', annualAllowance: 12, isActive: true },
    { name: 'Medical Leave', code: 'medical_leave', annualAllowance: 10, isActive: true },
    { name: 'Other Leave', code: 'other_leave', annualAllowance: 3, isActive: true },
  ]);

  // Step 4: Working Days & Weekly Off
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [workingDays, setWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [weeklyOffDays, setWeeklyOffDays] = useState(['Sun']);

  // Step 5: Initial Staff
  const [staffMode, setStaffMode] = useState<'demo' | 'csv' | 'manual' | 'later'>('demo');
  const [manualStaff, setManualStaff] = useState<any[]>([
    { serialNo: '001', employeeId: 'EMP-001', fullName: 'Ramesh Kumar', designation: 'Supervisor', department: 'Production' },
    { serialNo: '002', employeeId: 'EMP-002', fullName: 'Priya S', designation: 'Assistant', department: 'Accounts' },
    { serialNo: '003', employeeId: 'EMP-003', fullName: 'Arun Kumar', designation: 'Technician', department: 'Maintenance' },
  ]);
  const [csvStaff, setCsvStaff] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map((row: any, idx: number) => ({
          serialNo: row['Serial No'] || row['S.No'] || row['serialNo'] || String(idx + 1).padStart(3, '0'),
          employeeId: row['Employee ID'] || row['Emp ID'] || row['employeeId'] || `EMP-${String(idx + 1).padStart(3, '0')}`,
          fullName: row['Full Name'] || row['Name'] || row['fullName'] || '',
          designation: row['Designation'] || row['Role'] || row['designation'] || 'Staff',
          department: row['Department'] || row['Dept'] || row['department'] || 'General',
          phoneNumber: row['Phone'] || row['phoneNumber'] || '',
          dateOfJoining: row['Date of Joining'] || row['Joining Date'] || '',
          status: 'active',
        })).filter((s) => s.fullName.trim() !== '');

        setCsvStaff(parsed);
        showToast('success', `Parsed ${parsed.length} staff records from CSV.`);
      },
      error: () => {
        showToast('error', 'Failed to parse CSV file.');
      },
    });
  };

  const handleToggleDay = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
      if (!weeklyOffDays.includes(day)) {
        setWeeklyOffDays([...weeklyOffDays, day]);
      }
    } else {
      setWorkingDays([...workingDays, day]);
      setWeeklyOffDays(weeklyOffDays.filter((d) => d !== day));
    }
  };

  const handleFinish = async () => {
    if (adminPassword !== adminPasswordConfirm) {
      showToast('error', 'Passwords do not match.');
      setCurrentStep(1);
      return;
    }
    if (!officeName.trim()) {
      showToast('error', 'Office Name is required.');
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      let initialStaffPayload: any[] = [];
      if (staffMode === 'csv' && csvStaff.length > 0) {
        initialStaffPayload = csvStaff;
      } else if (staffMode === 'manual') {
        initialStaffPayload = manualStaff.filter((s) => s.fullName.trim() && s.employeeId.trim());
      }

      await api.completeSetup({
        officeName,
        financialYear,
        adminPassword: adminPassword !== 'admin123' ? adminPassword : undefined,
        leaveCategories,
        workingDays,
        weeklyOffDays,
        initialStaff: initialStaffPayload,
      });

      if (staffMode === 'demo') {
        await api.loadDemoData();
      }

      await refreshSettings();
      showToast('success', 'Office Attendance setup completed successfully!', 'Welcome');
      onComplete();
    } catch (err: any) {
      showToast('error', err.message || 'Setup submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Admin Account', icon: KeyRound },
    { num: 2, title: 'Office Details', icon: Building2 },
    { num: 3, title: 'Leave Categories', icon: Palmtree },
    { num: 4, title: 'Working Days', icon: CalendarCheck },
    { num: 5, title: 'Staff Roster', icon: Users },
    { num: 6, title: 'Complete', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center font-bold text-white">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Welcome to Staff Attendance Management</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Complete this quick 5-minute initial setup to configure your office attendance parameters.
              </p>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="grid grid-cols-6 gap-2 mt-6 pt-4 border-t border-slate-800">
            {steps.map((s) => {
              const Icon = s.icon;
              const isPast = currentStep > s.num;
              const isCurrent = currentStep === s.num;
              return (
                <div key={s.num} className="flex flex-col items-center text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? '✓' : s.num}
                  </div>
                  <span className={`text-[10px] mt-1 hidden sm:block ${isCurrent ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 sm:p-8">
          {/* STEP 1: Admin Account */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <span>Step 1: Administrator Account</span>
              </h3>
              <p className="text-xs text-slate-500">
                The administrator manages daily attendance, staff records, approvals, and system backups.
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Username</label>
                  <input
                    type="text"
                    disabled
                    value="admin"
                    className="mt-1 block w-full rounded border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                  <span className="text-[11px] text-slate-400">Primary administrator username is fixed as "admin".</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase">Password</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase">Confirm Password</label>
                    <input
                      type="password"
                      value={adminPasswordConfirm}
                      onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                      className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Office Details */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>Step 2: Office Name & Financial Year</span>
              </h3>
              <p className="text-xs text-slate-500">
                This office name appears on reports, daily attendance sheets, and export documents.
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Office / Company Name</label>
                  <input
                    type="text"
                    required
                    value={officeName}
                    onChange={(e) => setOfficeName(e.target.value)}
                    placeholder="e.g. Apex Enterprises & Engineering Ltd."
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Financial / Leave Year</label>
                  <input
                    type="text"
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                    placeholder="e.g. 2026-2027"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Leave Categories */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Palmtree className="w-5 h-5 text-blue-600" />
                <span>Step 3: Leave Categories & Annual Allowances</span>
              </h3>
              <p className="text-xs text-slate-500">
                Set annual quotas per category. These can also be modified in Settings at any time.
              </p>

              <div className="space-y-3 pt-2">
                {leaveCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-slate-800">{cat.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{cat.code}</div>
                    </div>
                    <div className="w-32">
                      <label className="text-[10px] font-semibold uppercase text-slate-500 block">Annual Allowance</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={cat.annualAllowance}
                          onChange={(e) => {
                            const updated = [...leaveCategories];
                            updated[idx].annualAllowance = Number(e.target.value);
                            setLeaveCategories(updated);
                          }}
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-center font-bold"
                        />
                        <span className="text-xs text-slate-600">days/yr</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Working Days */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-blue-600" />
                <span>Step 4: Working Days & Weekly Offs</span>
              </h3>
              <p className="text-xs text-slate-500">
                Select your regular weekly office schedule. Weekly offs are automatically excluded from leave deductions.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {allDays.map((day) => {
                  const isWorking = workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`p-3 rounded-lg border text-center transition ${
                        isWorking
                          ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-sm'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="font-bold text-sm">{day}</div>
                      <div className="text-[11px] mt-0.5">
                        {isWorking ? '✓ Working Day' : 'Weekly Off'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: Staff Roster */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>Step 5: Staff Roster</span>
              </h3>
              <p className="text-xs text-slate-500">
                Choose how you want to start populating your office staff directory (approx. 200–300 staff supported).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStaffMode('demo')}
                  className={`p-4 rounded-lg border text-left transition ${
                    staffMode === 'demo'
                      ? 'bg-blue-50 border-blue-600 text-blue-950 ring-1 ring-blue-600'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-sm">Demo Sample Data</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Load 25 realistic sample employees across departments for testing.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStaffMode('csv')}
                  className={`p-4 rounded-lg border text-left transition ${
                    staffMode === 'csv'
                      ? 'bg-blue-50 border-blue-600 text-blue-950 ring-1 ring-blue-600'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-sm">Import CSV / Excel</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Upload an existing spreadsheet of your employees.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStaffMode('manual')}
                  className={`p-4 rounded-lg border text-left transition ${
                    staffMode === 'manual'
                      ? 'bg-blue-50 border-blue-600 text-blue-950 ring-1 ring-blue-600'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-sm">Add Manually</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Start with a few key employees and add more later.
                  </div>
                </button>
              </div>

              {/* CSV Upload Section */}
              {staffMode === 'csv' && (
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center bg-slate-50">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <label className="cursor-pointer font-medium text-sm text-blue-600 hover:underline">
                    <span>Click to select CSV file</span>
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {csvFileName && (
                    <div className="text-xs text-emerald-700 font-semibold mt-2">
                      Selected: {csvFileName} ({csvStaff.length} valid rows found)
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    Columns: S.No, Employee ID, Full Name, Designation, Department, Phone
                  </p>
                </div>
              )}

              {/* Manual Staff preview */}
              {staffMode === 'manual' && (
                <div className="border border-slate-200 rounded overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 flex justify-between items-center">
                    <span>Initial Staff ({manualStaff.length})</span>
                    <button
                      type="button"
                      onClick={() =>
                        setManualStaff([
                          ...manualStaff,
                          {
                            serialNo: String(manualStaff.length + 1).padStart(3, '0'),
                            employeeId: `EMP-${String(manualStaff.length + 1).padStart(3, '0')}`,
                            fullName: '',
                            designation: 'Staff',
                            department: 'Production',
                          },
                        ])
                      }
                      className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Row
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                    {manualStaff.map((st, i) => (
                      <div key={i} className="flex gap-2 items-center text-xs">
                        <input
                          type="text"
                          value={st.employeeId}
                          onChange={(e) => {
                            const copy = [...manualStaff];
                            copy[i].employeeId = e.target.value;
                            setManualStaff(copy);
                          }}
                          placeholder="ID"
                          className="w-20 border rounded px-1.5 py-1"
                        />
                        <input
                          type="text"
                          value={st.fullName}
                          onChange={(e) => {
                            const copy = [...manualStaff];
                            copy[i].fullName = e.target.value;
                            setManualStaff(copy);
                          }}
                          placeholder="Full Name"
                          className="flex-1 border rounded px-1.5 py-1"
                        />
                        <input
                          type="text"
                          value={st.department}
                          onChange={(e) => {
                            const copy = [...manualStaff];
                            copy[i].department = e.target.value;
                            setManualStaff(copy);
                          }}
                          placeholder="Dept"
                          className="w-24 border rounded px-1.5 py-1"
                        />
                        <button
                          type="button"
                          onClick={() => setManualStaff(manualStaff.filter((_, idx) => idx !== i))}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Summary & Finish */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Setup Ready to Finalize</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Your office attendance configuration is ready. Clicking below will initialize the local database and launch your Dashboard.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Office Name:</span>
                  <span className="font-semibold text-slate-800">{officeName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Financial Year:</span>
                  <span className="font-semibold text-slate-800">{financialYear}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Working Schedule:</span>
                  <span className="font-semibold text-slate-800">
                    {workingDays.join(', ')} ({weeklyOffDays.join(', ')} Off)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Staff Mode:</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {staffMode === 'demo' ? 'Demo Dataset (25 sample staff)' : staffMode}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Action Navigation */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>
            ) : (
              <div />
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinish}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow transition disabled:opacity-50"
              >
                {isSubmitting ? 'Saving Configuration...' : 'Finish Setup & Open Dashboard'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
