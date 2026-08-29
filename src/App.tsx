import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LockScreen } from './components/LockScreen';
import { Dashboard } from './components/Dashboard';
import { DailyAttendance } from './components/DailyAttendance';
import { StaffManagement } from './components/StaffManagement';
import { LeaveManagement } from './components/LeaveManagement';
import { HolidaysManagement } from './components/HolidaysManagement';
import { Reports } from './components/Reports';
import { BackupRestore } from './components/BackupRestore';
import { SettingsPage } from './components/SettingsPage';
import { StaffProfileModal } from './components/StaffProfileModal';
import { QuickSearchModal } from './components/QuickSearchModal';
import { LoadingScreen } from './components/LoadingScreen';
import { Staff } from './types';

const MainAppContent: React.FC = () => {
  const { user, isLocked, settings, isLoading, toasts, removeToast } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedStaffForModal, setSelectedStaffForModal] = useState<Staff | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState<boolean>(false);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Check if logged out or screen locked
  if (!user) {
    return <LockScreen mode="login" />;
  }

  if (isLocked) {
    return <LockScreen mode="locked" />;
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans text-slate-900">
      {/* 1. Left Sidebar Navigation (Professional Polish) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        onOpenServerGuide={() => setActiveTab('settings')}
      />

      {/* 2. Main Content Workspace */}
      <div className="flex-grow flex flex-col min-w-0 min-h-screen bg-slate-50">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
          onNavigateAttendance={() => setActiveTab('attendance')}
        />

        {/* Viewport Content */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectStaff={(staff) => setSelectedStaffForModal(staff)}
            />
          )}

          {activeTab === 'attendance' && (
            <DailyAttendance onSelectStaff={(staff) => setSelectedStaffForModal(staff)} />
          )}

          {activeTab === 'staff' && (
            <StaffManagement onSelectStaff={(staff) => setSelectedStaffForModal(staff)} />
          )}

          {activeTab === 'leave' && (
            <LeaveManagement onSelectStaff={(staff) => setSelectedStaffForModal(staff)} />
          )}

          {activeTab === 'holidays' && <HolidaysManagement />}

          {activeTab === 'reports' && (
            <Reports onSelectStaff={(staff) => setSelectedStaffForModal(staff)} />
          )}

          {activeTab === 'backup' && <BackupRestore />}

          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Quick Search Staff Modal */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onSelectStaff={(staff) => setSelectedStaffForModal(staff)}
      />

      {/* Staff Profile & History Ledger Modal */}
      {selectedStaffForModal && (
        <StaffProfileModal
          staff={selectedStaffForModal}
          onClose={() => setSelectedStaffForModal(null)}
        />
      )}

      {/* Global Toast Notifications Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs flex justify-between items-start gap-3 cursor-pointer transition transform translate-y-0 ${
              toast.type === 'success'
                ? 'bg-slate-900 text-slate-100 border-emerald-500/50'
                : toast.type === 'error'
                ? 'bg-slate-900 text-slate-100 border-rose-500/50'
                : toast.type === 'warning'
                ? 'bg-slate-900 text-slate-100 border-amber-500/50'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            <div>
              {toast.title && <div className="font-bold mb-0.5 text-white">{toast.title}</div>}
              <div className="text-slate-300">{toast.message}</div>
            </div>
            <button className="text-slate-400 hover:text-white font-bold text-xs">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
