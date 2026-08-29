import React, { useState } from 'react';

interface TansidcoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: 'light' | 'dark';
  orientation?: 'horizontal' | 'vertical';
}

export const TANSIDCO_LOGO_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9V9zlzgBdveQJQ6NogBBbuAAKpYCtXb1H0ZzaMjBvEg&s=10';
export const TANSIDCO_LOGO_FALLBACK = '/tansidco-logo.svg';

export const TansidcoLogo: React.FC<TansidcoLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  textColor = 'dark',
  orientation = 'horizontal',
}) => {
  const [imgSrc, setImgSrc] = useState<string>(TANSIDCO_LOGO_URL);
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    if (imgSrc === TANSIDCO_LOGO_URL) {
      // Try local fallback SVG
      setImgSrc(TANSIDCO_LOGO_FALLBACK);
    } else {
      // Both failed, render vector SVG
      setImageError(true);
    }
  };

  const sizeMap = {
    sm: { icon: 32, title: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 44, title: 'text-base', sub: 'text-[10px]' },
    lg: { icon: 56, title: 'text-xl', sub: 'text-xs' },
    xl: { icon: 72, title: 'text-2xl', sub: 'text-sm' },
  };

  const current = sizeMap[size];

  return (
    <div
      className={`inline-flex items-center gap-3 select-none ${
        orientation === 'vertical' ? 'flex-col text-center' : 'flex-row'
      } ${className}`}
    >
      {/* Official TANSIDCO Logo Image */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl bg-white p-1 shadow-sm border border-slate-200 overflow-hidden"
        style={{ width: current.icon, height: current.icon }}
      >
        {!imageError ? (
          <img
            src={imgSrc}
            alt="TANSIDCO Official Logo"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        ) : (
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full text-blue-900"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Industrial Gear Cogwheel */}
            <circle cx="50" cy="50" r="44" stroke="#D97706" strokeWidth="3" strokeDasharray="6 2" opacity="0.9" />
            <circle cx="50" cy="50" r="39" fill="#1E3A8A" />
            <circle cx="50" cy="50" r="34" stroke="#FCD34D" strokeWidth="1.5" />
            <path
              d="M32 66 L32 50 L42 56 L42 46 L52 52 L52 42 L62 48 L62 66 Z"
              fill="#F3F4F6"
              opacity="0.95"
            />
            <circle cx="50" cy="62" r="11" fill="#1E40AF" stroke="#FCD34D" strokeWidth="2" />
            <circle cx="50" cy="62" r="4" fill="#FCD34D" />
          </svg>
        )}
      </div>

      {/* TANSIDCO Text Branding */}
      {showText && (
        <div className={orientation === 'vertical' ? 'mt-1' : ''}>
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-wider uppercase leading-tight font-serif ${
                current.title
              } ${textColor === 'light' ? 'text-white' : 'text-slate-900'}`}
            >
              TANSIDCO
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
              Govt. of TN
            </span>
          </div>
          <span
            className={`block font-medium truncate ${current.sub} ${
              textColor === 'light' ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            Staff Attendance & Leave Management System
          </span>
          <span
            className={`block text-[8px] uppercase tracking-wider ${
              textColor === 'light' ? 'text-slate-400' : 'text-slate-400'
            }`}
          >
            Tamil Nadu Small Industries Development Corp. Ltd.
          </span>
        </div>
      )}
    </div>
  );
};
