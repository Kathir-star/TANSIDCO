import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  FileSpreadsheet,
  AlertTriangle,
  ArrowUpDown,
  MoreVertical,
  Phone,
  Calendar,
  Building,
  RefreshCw,
} from 'lucide-react';
import { Staff } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StaffImportModal } from './StaffImportModal';
import Papa from 'papaparse';

interface StaffManagementProps {
  onSelectStaff: (staff: Staff) => void;
}

export const StaffManagement: React.FC<StaffManagementProps> = ({ onSelectStaff }) => {
  const { showToast } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sortBy, setSortBy] = useState<'serialNo' | 'fullName' | 'department' | 'employeeId'>('serialNo');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deleteConfirmStaff, setDeleteConfirmStaff] = useState<Staff | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    serialNo: '',
    employeeId: '',
    fullName: '',
    designation: '',
    department: 'Production',
    phoneNumber: '',
    dateOfJoining: '',
    status: 'active' as 'active' | 'inactive',
    notes: '',
  });

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const list = await api.getStaffList(true);
      setStaffList(list);
    } catch (err) {
      showToast('error', 'Failed to load staff directory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>(['Production', 'Accounts', 'Maintenance', 'Administration', 'Quality Assurance', 'Warehouse', 'IT & Systems']);
    staffList.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [staffList]);

  // Open add modal
  const handleOpenAdd = () => {
    const nextSerial = String(staffList.length + 1).padStart(3, '0');
    const nextEmpId = `EMP-${String(staffList.length + 1).padStart(3, '0')}`;
    setFormData({
      serialNo: nextSerial,
      employeeId: nextEmpId,
      fullName: '',
      designation: '',
      department: 'Production',
      phoneNumber: '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      status: 'active',
      notes: '',
    });
    setEditingStaff(null);
    setIsAddModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (staff: Staff, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingStaff(staff);
    setFormData({
      serialNo: staff.serialNo,
      employeeId: staff.employeeId,
      fullName: staff.fullName,
      designation: staff.designation,
      department: staff.department,
      phoneNumber: staff.phoneNumber || '',
      dateOfJoining: staff.dateOfJoining || '',
      status: staff.status,
      notes: staff.notes || '',
    });
    setIsAddModalOpen(true);
  };

  // Submit add or edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.employeeId.trim()) {
      showToast('error', 'Employee ID and Full Name are required.');
      return;
    }

    try {
      if (editingStaff) {
        await api.updateStaff(editingStaff.id, formData);
        showToast('success', `Staff ${formData.fullName} updated successfully.`);
      } else {
        await api.addStaff(formData);
        showToast('success', `Staff ${formData.fullName} added successfully.`);
      }
      setIsAddModalOpen(false);
      loadStaff();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save staff record.');
    }
  };

  // Toggle active/inactive
  const handleToggleStatus = async (staff: Staff, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (staff.status === 'active') {
        await api.deactivateStaff(staff.id);
        showToast('info', `Staff ${staff.fullName} deactivated.`);
      } else {
        await api.reactivateStaff(staff.id);
        showToast('success', `Staff ${staff.fullName} reactivated.`);
      }
      loadStaff();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to toggle status.');
    }
  };

  // Permanent Delete
  const handlePermanentDelete = async () => {
    if (!deleteConfirmStaff) return;
    try {
      const res = await api.permanentlyDeleteStaff(deleteConfirmStaff.id);
      showToast('success', res.message, 'Deleted');
      setDeleteConfirmStaff(null);
      loadStaff();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete staff member.');
    }
  };

  // Load official TANSIDCO roster
  const handleLoadOfficialRoster = async () => {
    setIsLoadingRoster(true);
    try {
      const res = await api.loadTansidcoRoster();
      showToast('success', res.message, 'Roster Loaded');
      loadStaff();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load official roster.');
    } finally {
      setIsLoadingRoster(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const csvData = staffList.map((s) => ({
      'Serial No': s.serialNo,
      'Employee ID': s.employeeId,
      'Full Name': s.fullName,
      Designation: s.designation,
      Department: s.department,
      'Phone Number': s.phoneNumber || '',
      'Date of Joining': s.dateOfJoining || '',
      Status: s.status,
      Notes: s.notes || '',
    }));

    const csvString = Papa.unparse(csvData);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `staff_directory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('success', `Exported ${staffList.length} staff records to CSV.`);
  };

  // Download Sample Template CSV
  const handleDownloadSampleTemplate = () => {
    const sample = [
      {
        'Serial No': '001',
        'Employee ID': 'EMP-001',
        'Full Name': 'Ramesh Kumar',
        Designation: 'Supervisor',
        Department: 'Production',
        'Phone Number': '9876543210',
        'Date of Joining': '2023-01-15',
        Status: 'active',
      },
      {
        'Serial No': '002',
        'Employee ID': 'EMP-002',
        'Full Name': 'Priya S',
        Designation: 'Assistant',
        Department: 'Accounts',
        'Phone Number': '9876543211',
        'Date of Joining': '2023-02-01',
        Status: 'active',
      },
    ];
    const csvString = Papa.unparse(sample);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'staff_import_sample_template.csv';
    link.click();
  };

  // Handle CSV Import File
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsed = results.data
          .map((row: any, idx: number) => ({
            serialNo: row['Serial No'] || row['S.No'] || row['serialNo'] || String(idx + 1).padStart(3, '0'),
            employeeId: row['Employee ID'] || row['Emp ID'] || row['employeeId'] || '',
            fullName: row['Full Name'] || row['Name'] || row['fullName'] || '',
            designation: row['Designation'] || row['Role'] || row['designation'] || 'Staff',
            department: row['Department'] || row['Dept'] || row['department'] || 'General',
            phoneNumber: row['Phone Number'] || row['Phone'] || row['phoneNumber'] || '',
            dateOfJoining: row['Date of Joining'] || row['Joining Date'] || '',
            status: (row['Status'] || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
            notes: row['Notes'] || '',
          }))
          .filter((s) => s.fullName.trim() !== '' && s.employeeId.trim() !== '');

        if (parsed.length === 0) {
          showToast('error', 'No valid rows found in CSV. Please verify column headers.');
          return;
        }

        try {
          const res = await api.bulkImportStaff(parsed);
          showToast(
            'success',
            `Imported ${res.addedCount} staff members. ${res.skippedCount > 0 ? `(${res.skippedCount} skipped)` : ''}`,
            'Import Complete'
          );
          setIsImportModalOpen(false);
          loadStaff();
        } catch (err: any) {
          showToast('error', err.message || 'Import failed.');
        }
      },
      error: () => {
        showToast('error', 'Failed to read CSV file.');
      },
    });
  };

  // Filter and sort list
  const filteredAndSortedStaff = useMemo(() => {
    return staffList
      .filter((s) => {
        // Status filter
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;

        // Department filter
        if (departmentFilter !== 'all' && s.department !== departmentFilter) return false;

        // Search query
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.employeeId.toLowerCase().includes(q) ||
          s.serialNo.toLowerCase().includes(q) ||
          s.designation.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q) ||
          (s.phoneNumber && s.phoneNumber.includes(q))
        );
      })
      .sort((a, b) => {
        let valA = a[sortBy] || '';
        let valB = b[sortBy] || '';
        if (sortBy === 'serialNo') {
          return sortAsc
            ? valA.localeCompare(valB, undefined, { numeric: true })
            : valB.localeCompare(valA, undefined, { numeric: true });
        }
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
  }, [staffList, searchQuery, departmentFilter, statusFilter, sortBy, sortAsc]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header with Title and Actions */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Staff Directory</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {staffList.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage employee profiles, designations, contact numbers, and status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            id="staff-load-roster-btn"
            onClick={handleLoadOfficialRoster}
            disabled={isLoadingRoster}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            title="Reload verified 135-staff TANSIDCO roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoster ? 'animate-spin' : ''}`} />
            <span>Reset Official Roster</span>
          </button>

          <button
            id="staff-export-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            title="Export staff roster to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            id="staff-import-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition"
            title="Import multiple staff from Excel (.xlsx) or CSV"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Staff Data</span>
          </button>

          <button
            id="staff-add-new-btn"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="staff-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, Name, Phone... (/)"
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Dept:</span>
            <select
              id="staff-dept-filter"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Status:</span>
            <select
              id="staff-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-slate-800"
            >
              <option value="active">Active Staff Only</option>
              <option value="inactive">Inactive Staff Only</option>
              <option value="all">All Statuses</option>
            </select>
          </div>

          {/* Sort By */}
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="p-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
            title={`Sort Order: ${sortAsc ? 'Ascending' : 'Descending'}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Staff Table (Desktop) / Cards (Mobile) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading staff roster...</div>
        ) : filteredAndSortedStaff.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No employees found matching the filters.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-3 w-14 text-center cursor-pointer" onClick={() => setSortBy('serialNo')}>
                      S.No
                    </th>
                    <th className="py-3 px-3 w-28 cursor-pointer" onClick={() => setSortBy('employeeId')}>
                      Emp ID
                    </th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => setSortBy('fullName')}>
                      Full Name
                    </th>
                    <th className="py-3 px-3 cursor-pointer" onClick={() => setSortBy('department')}>
                      Department
                    </th>
                    <th className="py-3 px-3">Designation</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Joining Date</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedStaff.map((staff, idx) => (
                    <tr
                      key={staff.id}
                      id={`staff-row-${staff.employeeId}`}
                      onClick={() => onSelectStaff(staff)}
                      className={`hover:bg-blue-50/40 cursor-pointer transition ${
                        staff.status === 'inactive' ? 'bg-slate-50/60 opacity-70' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-500">
                        {staff.serialNo || String(idx + 1).padStart(3, '0')}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {staff.employeeId}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{staff.fullName}</span>
                          {staff.isDemo && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-medium">
                              Demo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{staff.department}</td>
                      <td className="py-3 px-3 text-slate-600">{staff.designation}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {staff.phoneNumber || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {staff.dateOfJoining || '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            staff.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {staff.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            id={`staff-edit-${staff.employeeId}`}
                            onClick={(e) => handleOpenEdit(staff, e)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                            title="Edit Staff Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`staff-toggle-${staff.employeeId}`}
                            onClick={(e) => handleToggleStatus(staff, e)}
                            className={`p-1.5 rounded ${
                              staff.status === 'active'
                                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={staff.status === 'active' ? 'Deactivate Staff' : 'Reactivate Staff'}
                          >
                            {staff.status === 'active' ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            id={`staff-delete-${staff.employeeId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmStaff(staff);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Permanently Delete Staff Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredAndSortedStaff.map((staff, idx) => (
                <div
                  key={staff.id}
                  onClick={() => onSelectStaff(staff)}
                  className="p-4 space-y-2 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <span>{staff.fullName}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            staff.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {staff.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono font-semibold text-slate-700">{staff.employeeId}</span> • {staff.department} • {staff.designation}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      #{staff.serialNo || idx + 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <div>{staff.phoneNumber || 'No phone'}</div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleOpenEdit(staff, e)}
                        className="p-1 text-blue-600 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleToggleStatus(staff, e)}
                        className="p-1 text-slate-600 font-medium"
                      >
                        {staff.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              {editingStaff ? 'Edit Staff Details' : 'Add New Staff Member'}
            </h3>

            <form onSubmit={handleSubmitForm} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Serial No / S.No</label>
                  <input
                    type="text"
                    required
                    value={formData.serialNo}
                    onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono"
                    placeholder="e.g. 001"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono"
                    placeholder="e.g. EMP-001"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Department</label>
                  <input
                    type="text"
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                    placeholder="e.g. Production"
                    list="dept-options"
                  />
                  <datalist id="dept-options">
                    {departments.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Designation</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                    placeholder="e.g. Supervisor"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono"
                    placeholder="e.g. 9876543210"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Date of Joining</label>
                  <input
                    type="date"
                    value={formData.dateOfJoining}
                    onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  placeholder="Additional administrative notes..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow"
                >
                  {editingStaff ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advanced Staff Import Modal */}
      <StaffImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          loadStaff();
          showToast('success', 'Staff roster updated in database.', 'Import Successful');
        }}
        existingStaffList={staffList}
      />

      {/* Double Confirmation Modal for Permanent Delete */}
      {deleteConfirmStaff && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-rose-200 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold">Confirm Permanent Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to permanently delete <strong>{deleteConfirmStaff.fullName} ({deleteConfirmStaff.employeeId})</strong>?
              <br />
              <span className="text-rose-700 font-semibold">
                Warning: This will permanently erase all associated historical attendance records and leave history.
              </span>
            </p>
            <p className="text-[11px] text-slate-500 mt-2">
              Note: To preserve historical records while preventing new entries, choose "Deactivate" instead.
            </p>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteConfirmStaff(null)}
                className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow"
              >
                Confirm Permanent Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
