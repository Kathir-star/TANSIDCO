import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Palmtree,
  FileSpreadsheet,
  Database,
  Settings,
  Lock,
  LogOut,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { TansidcoLogo } from './TansidcoLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  onOpenServerGuide?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  onOpenServerGuide,
}) => {
  const { settings, logout, lockApp, isOffline, showToast } = useAuth();
  const [networkInfo, setNetworkInfo] = useState<{ localIp: string; port: number; networkUrl: string } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const updateSyncBadge = () => {
      const pending = api.getPendingSyncRecords();
      setPendingSyncCount(pending.length);
    };
    updateSyncBadge();
    const interval = setInterval(updateSyncBadge, 3000);

    api.getNetworkInfo()
      .then((net) => setNetworkInfo(net))
      .catch(() => {});

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
    { id: 'staff', label: 'Staff Directory', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, badge: 'Daily' },
    { id: 'leave', label: 'Leave Management', icon: CalendarDays },
    { id: 'holidays', label: 'Holidays', icon: Palmtree },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <TansidcoLogo size="sm" showText={false} />
          <div className="min-w-0">
            <span className="font-bold text-white text-base tracking-tight block leading-tight truncate">
              {settings?.officeName || 'TANSIDCO'}
            </span>
            <span className="text-[10px] text-blue-300 font-medium block truncate">
              Staff Attendance & Leave
            </span>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-grow py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => handleSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-6 py-3 transition-colors text-sm font-medium ${
                isActive
                  ? 'bg-slate-800 text-white border-l-4 border-blue-500 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center">
                <Icon
                  className={`w-5 h-5 mr-3 transition-opacity ${
                    isActive ? 'text-blue-400 opacity-100' : 'opacity-80'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Local Server & Actions Section */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        {/* Local Server IP Badge */}
        <div
          onClick={onOpenServerGuide}
          className="bg-slate-800/60 hover:bg-slate-800 rounded-lg p-3 text-xs border border-slate-700/50 cursor-pointer transition"
          title="Click to view Local Wi-Fi connection info"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="uppercase tracking-wider font-semibold text-[10px] text-slate-400">
              Local Server
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                isOffline
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
              }`}
            />
          </div>
          <p className="text-slate-300 font-mono text-[11px] truncate">
            {networkInfo ? `${networkInfo.localIp}:${networkInfo.port}` : 'localhost:3000'}
          </p>
        </div>

        {/* Sync Indicator if pending records exist */}
        {pendingSyncCount > 0 && (
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-blue-900/60 border border-blue-700 text-blue-200 text-xs font-semibold hover:bg-blue-800/80 transition"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Pending Sync</span>
            </div>
            <span className="px-1.5 py-0.2 rounded bg-blue-700 text-white text-[11px] font-bold">
              {pendingSyncCount}
            </span>
          </button>
        )}

        {/* System Action Controls */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
          <button
            id="sidebar-lock-btn"
            onClick={lockApp}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-slate-800 hover:text-slate-200 transition"
            title="Lock application screen"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>

          <button
            id="sidebar-logout-btn"
            onClick={logout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-slate-800 hover:text-rose-400 transition"
            title="Logout administrator"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex-col border-r border-slate-800 shrink-0 h-screen sticky top-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-72 bg-slate-900 z-50 lg:hidden transform transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
