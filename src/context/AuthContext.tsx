import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AdminUser, SystemSettings } from '../types';
import { api } from '../services/api';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

interface AuthContextType {
  user: AdminUser | null;
  settings: SystemSettings | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  isOffline: boolean;
  toasts: ToastMessage[];
  login: (username: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  lockApp: () => void;
  unlockApp: (pass: string) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_TANSIDCO_SETTINGS: SystemSettings = {
  officeName: 'TANSIDCO',
  financialYear: '2026-2027',
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  weeklyOffDays: ['Sun'],
  autoBackupInterval: 'daily',
  isConfigured: true,
  isSetupCompleted: true,
  localServerPort: 3000,
  sessionTimeoutMinutes: 60,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_TANSIDCO_SETTINGS);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string, title?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshSettings();
      const token = api.getToken();
      if (token) {
        const me = await api.getMe();
        setUser(me.user);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshSettings]);

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setUser(null);
      showToast('error', 'Session expired. Please login again.', 'Logged Out');
    };

    const handleOnline = () => {
      setIsOffline(false);
      showToast('success', 'Connected to Local Office Server.', 'Online');
    };

    const handleOffline = () => {
      setIsOffline(true);
      showToast('warning', 'Running in Offline Mode. Changes queued locally.', 'Offline Mode');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkAuth, showToast]);

  // Session activity tracker for auto-lock
  useEffect(() => {
    if (!isAuthenticated || isLocked) return;

    let timeoutId: any;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      const minutes = settings?.sessionTimeoutMinutes || 60;
      timeoutId = setTimeout(() => {
        setIsLocked(true);
        showToast('info', 'Application locked due to inactivity.', 'Security Lock');
      }, minutes * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [isAuthenticated, isLocked, settings?.sessionTimeoutMinutes, showToast]);

  const login = async (username: string, pass: string) => {
    const res = await api.login(username, pass);
    setUser(res.user);
    setIsAuthenticated(true);
    setIsLocked(false);
    showToast('success', `Welcome back, ${res.user.name}`, 'Login Successful');
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setIsAuthenticated(false);
    setIsLocked(false);
    showToast('info', 'You have been logged out safely.', 'Logged Out');
  };

  const lockApp = () => {
    setIsLocked(true);
    showToast('info', 'Application locked.', 'Locked');
  };

  const unlockApp = async (password: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await api.login(user.username, password);
      if (res.token) {
        setIsLocked(false);
        showToast('success', 'Application unlocked.', 'Welcome Back');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        isAuthenticated,
        isLocked,
        isLoading,
        isOffline,
        toasts,
        login,
        logout,
        lockApp,
        unlockApp,
        refreshSettings,
        showToast,
        removeToast,
      }}
    >
      {children}
      {/* Toast Notification Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            id={toast.id}
            className={`pointer-events-auto flex items-start justify-between p-3.5 rounded-lg border shadow-lg transition-all transform animate-in fade-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : toast.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div>
              {toast.title && <div className="font-semibold text-sm leading-snug">{toast.title}</div>}
              <div className="text-xs leading-relaxed mt-0.5">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 text-slate-400 hover:text-slate-700 text-xs font-bold leading-none p-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
