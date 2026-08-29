import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, UserCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TansidcoLogo } from './TansidcoLogo';

interface LockScreenProps {
  mode: 'login' | 'locked';
}

export const LockScreen: React.FC<LockScreenProps> = ({ mode }) => {
  const { user, login, unlockApp, settings } = useAuth();
  const [username, setUsername] = useState(mode === 'locked' ? user?.username || 'admin' : 'admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'locked') {
        const success = await unlockApp(password);
        if (!success) {
          setError('Invalid password. Please try again.');
        }
      } else {
        await login(username, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Office Seal / Logo */}
        <div className="flex flex-col items-center justify-center">
          <TansidcoLogo size="xl" showText={false} />
          {mode === 'locked' && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Session Locked</span>
            </div>
          )}
        </div>

        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          {settings?.officeName || 'Staff Attendance & Leave System'}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          {mode === 'locked'
            ? 'Application locked for security. Enter password to resume.'
            : 'Secure Administrator Portal (Offline & Local Wi-Fi Ready)'}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm sm:rounded-xl border border-slate-200 sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === 'login' ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Username
                </label>
                <div className="mt-1.5">
                  <input
                    id="login-username-input"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full rounded-md border border-slate-300 px-3.5 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:text-sm"
                    placeholder="e.g. admin"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-3 rounded border border-slate-200 flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">{user?.name || 'Administrator'}</div>
                  <div className="text-[11px] text-slate-500">User: {user?.username || 'admin'}</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                {mode === 'locked' ? 'Admin Password' : 'Password'}
              </label>
              <div className="mt-1.5">
                <input
                  id="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-slate-300 px-3.5 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:text-sm"
                  placeholder="Enter administrator password"
                  autoFocus={mode === 'locked'}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {error}
              </div>
            )}

            <div>
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 transition"
              >
                {isLoading ? (
                  <span>Verifying credentials...</span>
                ) : (
                  <>
                    <span>{mode === 'locked' ? 'Unlock Application' : 'Sign In as Administrator'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Credentials Reminder */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-2">
            <div className="text-[11px] text-slate-500">
              Default administrator credentials: <span className="font-mono font-semibold text-slate-700">admin</span> /{' '}
              <span className="font-mono font-semibold text-slate-700">admin123</span>
            </div>
            <button
              type="button"
              id="autofill-credentials-btn"
              onClick={() => {
                setUsername('admin');
                setPassword('admin123');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition cursor-pointer"
            >
              <span>Auto-fill Admin Credentials</span>
            </button>
            <div className="text-[10px] text-slate-400">
              Passwords are salted and securely hashed with bcrypt. You can update your password in Settings.
            </div>
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500">
          <div className="flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% Offline</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Local Database</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Wi-Fi Network</span>
          </div>
        </div>
      </div>
    </div>
  );
};
