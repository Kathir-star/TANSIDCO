import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { OFFICIAL_TANSIDCO_LOGO_SRC } from './TansidcoLogo';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Initializing TANSIDCO Attendance Portal...',
  subMessage = 'Tamil Nadu Small Industries Development Corporation Limited',
}) => {
  const [progress, setProgress] = useState(15);
  const [statusStep, setStatusStep] = useState('Verifying local ledger security...');

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setProgress(45);
      setStatusStep('Loading staff registers & official policies...');
    }, 400);

    const timer2 = setTimeout(() => {
      setProgress(85);
      setStatusStep('Connecting to secure office server...');
    }, 900);

    const timer3 = setTimeout(() => {
      setProgress(100);
      setStatusStep('Portal ready. Launching session...');
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div
      id="tansidco-starting-loading-screen"
      className="min-h-screen w-full bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden select-none"
    >
      {/* Background Decorative Ambient Radial Lights */}
      <div className="absolute w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none -top-32 -left-32 animate-pulse" />
      <div className="absolute w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-3xl pointer-events-none -bottom-32 -right-32 animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center max-w-md w-full text-center"
      >
        {/* Animated Central Logo Container */}
        <div className="relative mb-6">
          {/* Animated Glow Rings */}
          <motion.div
            animate={{
              scale: [1, 1.12, 1],
              opacity: [0.35, 0.65, 0.35],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -inset-4 bg-linear-to-tr from-cyan-400 via-blue-500 to-amber-300 rounded-full blur-lg"
          />

          <motion.div
            initial={{ scale: 0.8, rotate: -4 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="relative bg-white p-3 sm:p-4 rounded-3xl shadow-2xl border-2 border-cyan-400/40 backdrop-blur-md"
          >
            <img
              src={OFFICIAL_TANSIDCO_LOGO_SRC}
              alt="Official TANSIDCO Logo"
              className="w-28 h-28 sm:w-36 sm:h-36 object-contain rounded-2xl drop-shadow-md"
              loading="eager"
            />
          </motion.div>
        </div>

        {/* Official Headings */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase font-sans">
            TANSIDCO
          </h1>
          <p className="text-xs sm:text-sm font-medium text-cyan-300 tracking-wide mt-1 max-w-sm px-2">
            {subMessage}
          </p>
        </motion.div>

        {/* Security Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-950/80 border border-blue-700/60 rounded-full text-[11px] font-semibold text-blue-200 mt-4 shadow-inner"
        >
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Official Staff Attendance & Leave Portal</span>
        </motion.div>

        {/* Progress Bar */}
        <div className="w-full mt-8 bg-slate-800/90 rounded-full h-2.5 p-0.5 border border-slate-700/60 shadow-inner overflow-hidden">
          <motion.div
            className="bg-linear-to-r from-cyan-400 via-blue-500 to-indigo-500 h-full rounded-full shadow-sm"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Real-time Status */}
        <div className="flex items-center justify-between w-full mt-3 text-[11px] text-slate-300 font-medium">
          <span className="flex items-center gap-1.5 truncate">
            {progress === 100 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            )}
            <span className="truncate">{statusStep}</span>
          </span>
          <span className="font-mono text-cyan-400 font-bold ml-2 shrink-0">{progress}%</span>
        </div>

        {/* Footer Authority Info */}
        <div className="mt-10 text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
          Government of Tamil Nadu • Secure Enterprise Intranet
        </div>
      </motion.div>
    </div>
  );
};
