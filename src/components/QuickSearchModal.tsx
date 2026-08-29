import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, ArrowRight, Phone, Building } from 'lucide-react';
import { Staff } from '../types';
import { api } from '../services/api';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStaff: (staff: Staff) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectStaff,
}) => {
  const [query, setQuery] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api.getStaffList(true)
        .then((list) => setStaffList(list))
        .finally(() => setIsLoading(false));
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global keydown shortcut "/" or "Escape"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isOpen && (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
        e.preventDefault();
        // Trigger modal open handled by parent
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = staffList.filter((s) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.employeeId.toLowerCase().includes(q) ||
      s.serialNo.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.designation.toLowerCase().includes(q)
    );
  }).slice(0, 15);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search staff by ID (e.g. EMP-001), name, or department..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-slate-600 font-medium transition"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-slate-100 p-2 text-sm flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading staff database...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No staff members found matching "{query}"
            </div>
          ) : (
            filtered.map((staff) => (
              <div
                key={staff.id}
                onClick={() => {
                  onSelectStaff(staff);
                  onClose();
                }}
                className="p-3 rounded-lg hover:bg-blue-50/60 cursor-pointer flex items-center justify-between transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                    {staff.serialNo || staff.employeeId.slice(-2)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span>{staff.fullName}</span>
                      <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                        {staff.employeeId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{staff.designation}</span>
                      <span>•</span>
                      <span>{staff.department}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition">
                  <span>View Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
          <span>{filtered.length} staff record(s)</span>
          <span className="font-mono">Press Esc to close</span>
        </div>
      </div>
    </div>
  );
};
