import React, { useState, useEffect } from 'react';
import {
  Palmtree,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  Info,
  CalendarDays,
} from 'lucide-react';
import { Holiday } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const HolidaysManagement: React.FC = () => {
  const { showToast } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadHolidays = async (year: number) => {
    setIsLoading(true);
    try {
      const data = await api.getHolidays(year);
      setHolidays(data);
    } catch (err) {
      showToast('error', 'Failed to load holiday list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays(selectedYear);
  }, [selectedYear]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) {
      showToast('error', 'Date and Holiday Name are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.addHoliday({ date, name, description });
      showToast('success', `Holiday "${name}" added.`);
      setIsAddModalOpen(false);
      setName('');
      setDescription('');
      loadHolidays(selectedYear);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string, holidayName: string) => {
    if (!window.confirm(`Delete holiday "${holidayName}"?`)) return;
    try {
      await api.deleteHoliday(id);
      showToast('success', `Holiday "${holidayName}" removed.`);
      loadHolidays(selectedYear);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete holiday.');
    }
  };

  const handlePopulateStandardHolidays = async () => {
    const standardHolidays = [
      { date: `${selectedYear}-01-01`, name: "New Year's Day", description: 'Official Holiday' },
      { date: `${selectedYear}-01-26`, name: 'Republic Day', description: 'National Gazetted Holiday' },
      { date: `${selectedYear}-05-01`, name: 'May Day / Labour Day', description: 'Workers Holiday' },
      { date: `${selectedYear}-08-15`, name: 'Independence Day', description: 'National Gazetted Holiday' },
      { date: `${selectedYear}-10-02`, name: 'Gandhi Jayanti', description: 'National Holiday' },
      { date: `${selectedYear}-12-25`, name: 'Christmas Day', description: 'Official Holiday' },
    ];

    try {
      for (const h of standardHolidays) {
        if (!holidays.some((existing) => existing.date === h.date)) {
          await api.addHoliday(h);
        }
      }
      showToast('success', 'Populated standard office holidays.');
      loadHolidays(selectedYear);
    } catch (err: any) {
      showToast('error', 'Failed to pre-populate holidays.');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-blue-600" />
            <span>Office Holiday Calendar</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {holidays.length} Holidays in {selectedYear}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Declared holidays automatically protect staff attendance from unexcused absence deductions.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-800"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Holiday</span>
          </button>
        </div>
      </div>

      {/* Info & Fast Populate Bar */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-teal-900">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            Holidays declared here will be visibly highlighted on the Daily Attendance sheet and excluded from leave balances.
          </span>
        </div>
        <button
          onClick={handlePopulateStandardHolidays}
          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-teal-300 hover:bg-teal-100 rounded text-xs font-semibold text-teal-900 transition shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>Add Standard Holidays</span>
        </button>
      </div>

      {/* Holiday List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading holidays...</div>
        ) : holidays.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No holidays declared for {selectedYear}. Click "Add Holiday" or "Add Standard Holidays".
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {holidays.map((holiday) => {
              const d = new Date(holiday.date);
              const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });

              return (
                <div
                  key={holiday.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-teal-50 border border-teal-200 flex flex-col items-center justify-center text-teal-900">
                      <span className="text-[10px] uppercase font-bold text-teal-600">
                        {d.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-base font-extrabold leading-none">{d.getDate()}</span>
                    </div>

                    <div>
                      <div className="font-bold text-sm text-slate-900">{holiday.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{holiday.date}</span>
                        <span>•</span>
                        <span>{dayOfWeek}</span>
                        {holiday.description && (
                          <>
                            <span>•</span>
                            <span className="italic">{holiday.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteHoliday(holiday.id, holiday.name)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Holiday"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Holiday Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <span>Add Declared Holiday</span>
            </h3>

            <form onSubmit={handleAddHoliday} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">Holiday Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">Holiday Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Independence Day, Annual Founder's Day..."
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">Description / Note</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Office Closed / Gazetted Holiday"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
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
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
