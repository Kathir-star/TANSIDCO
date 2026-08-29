import React, { useState, useEffect } from 'react';
import {
  Search,
  CalendarCheck,
  Menu,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenQuickSearch: () => void;
  onNavigateAttendance: () => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenQuickSearch,
  onNavigateAttendance,
  activeTab,
}) => {
  const { settings } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      );
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs select-none">
      {/* Left side: Mobile menu toggle + Global Quick Search */}
      <div className="flex items-center gap-3 sm:gap-4 w-full max-w-md">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={onOpenQuickSearch}
          className="flex items-center gap-3 w-full bg-slate-50 hover:bg-slate-100/80 text-slate-400 hover:text-slate-600 px-3.5 py-2 rounded-lg border border-slate-200/80 cursor-pointer transition text-sm"
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs sm:text-sm text-slate-500 truncate">
            Quick search staff by ID, Name or Department...
          </span>
          <kbd className="hidden sm:inline-block ml-auto text-[10px] bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded shadow-2xs font-mono font-semibold">
            /
          </kbd>
        </div>
      </div>

      {/* Right side: Live Date & Time + Action Button */}
      <div className="flex items-center gap-4 sm:gap-6 pl-4 shrink-0">
        {/* Date & Time Widget */}
        <div className="text-right hidden sm:block">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {currentDate || 'August 28, 2026'}
          </p>
          <p className="text-sm font-bold text-slate-900 leading-tight">
            {currentTime || '09:00 AM'}
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden sm:block" />

        {/* Primary Call to Action */}
        <button
          id="header-mark-attendance-btn"
          onClick={onNavigateAttendance}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs"
        >
          <CalendarCheck className="w-4 h-4" />
          <span className="hidden xs:inline">Mark Today's Attendance</span>
          <span className="xs:hidden">Attendance</span>
        </button>
      </div>
    </header>
  );
};
