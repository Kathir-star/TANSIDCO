import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Palmtree,
  FileSpreadsheet,
  Database,
  History,
  Settings,
  Lock,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Smartphone,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenQuickSearch: () => void;
  onOpenServerGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickSearch,
  onOpenServerGuide,
}) => {
  const { user, settings, logout, lockApp, isOffline, showToast } = useAuth();
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [networkInfo, setNetworkInfo] = useState<{ localIps: string[]; port: number } | null>(null);

  useEffect(() => {
    const updateSyncBadge = () => {
      const pending = api.getPendingSyncRecords();
      setPendingSyncCount(pending.length);
    };
    updateSyncBadge();
    const interval = setInterval(updateSyncBadge, 3000);

    api.getNetworkInfo().then(setNetworkInfo).catch(() => {});

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const count = await api.autoSyncPending();
      const pending = api.getPendingSyncRecords();
      setPendingSyncCount(pending.length);
      if (count > 0) {
        showToast('success', `Synchronized ${count} records successfully.`, 'Sync Complete');
      } else {
        showToast('info', 'All records are up to date.', 'In Sync');
      }
    } catch {
      showToast('error', 'Unable to reach local server.', 'Sync Failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Daily Attendance', icon: CalendarCheck, badge: 'Daily' },
    { id: 'staff', label: 'Staff Directory', icon: Users },
    { id: 'leave', label: 'Leave Requests', icon: CalendarDays },
    { id: 'holidays', label: 'Holidays', icon: Palmtree },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'audit', label: 'Audit Log', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm print:hidden">
      {/* Top Banner / System Title & Status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 border-b border-slate-800/80">
          {/* Office Name & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm sm:text-base leading-tight tracking-tight text-white flex items-center gap-2">
                <span>{settings?.officeName || 'Staff Attendance System'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-normal border border-slate-700">
                  {settings?.financialYear || '2026-27'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Offline-First Local Attendance Management
              </div>
            </div>
          </div>

          {/* Quick Search & Server Connection Status */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick Staff Search trigger */}
            <button
              id="nav-quick-search-btn"
              onClick={onOpenQuickSearch}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs border border-slate-700 transition"
              title="Quick find staff (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search staff...</span>
              <kbd className="text-[10px] bg-slate-900 px-1 py-0.5 rounded text-slate-400 border border-slate-750">
                /
              </kbd>
            </button>

            {/* Local Server Wi-Fi & Offline Mode Status */}
            <button
              id="nav-server-info-btn"
              onClick={onOpenServerGuide}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition ${
                isOffline
                  ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                  : 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
              }`}
              title="Click for Local Wi-Fi & Multi-device connection details"
            >
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline font-medium">Offline Mode</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline font-medium">Local Server Host</span>
                  {networkInfo?.localIps?.[0] && (
                    <span className="hidden lg:inline text-[10px] text-emerald-400/80 font-mono">
                      ({networkInfo.localIps[0]}:{networkInfo.port})
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Pending Sync Indicator */}
            {pendingSyncCount > 0 && (
              <button
                id="nav-sync-btn"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-900/80 border border-blue-700 text-blue-200 hover:bg-blue-800 text-xs transition"
                title={`${pendingSyncCount} offline records pending sync`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="font-semibold">{pendingSyncCount}</span>
                <span className="hidden sm:inline text-[11px]">Sync</span>
              </button>
            )}

            {/* Android / LAN Guide Button */}
            <button
              id="nav-mobile-guide-btn"
              onClick={onOpenServerGuide}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              title="Multi-device & Android Mobile connection instructions"
            >
              <Smartphone className="w-4 h-4" />
            </button>

            {/* Lock Application */}
            <button
              id="nav-lock-btn"
              onClick={lockApp}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              title="Lock application screen"
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Logout */}
            <button
              id="nav-logout-btn"
              onClick={logout}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs transition"
              title="Logout administrator"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Bottom Horizontal Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded whitespace-nowrap transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-blue-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
