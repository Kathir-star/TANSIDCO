import React, { useState } from 'react';

export interface TansidcoLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  showText?: boolean;
  textColor?: 'light' | 'dark';
  orientation?: 'horizontal' | 'vertical';
  subtitle?: string;
  imgClassName?: string;
}

export const OFFICIAL_TANSIDCO_LOGO_SRC = '/tansidco-logo.png';
export const FALLBACK_TANSIDCO_LOGO_SRC = '/tansidco-logo.svg';

export const TansidcoLogo: React.FC<TansidcoLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  textColor = 'dark',
  orientation = 'horizontal',
  subtitle,
  imgClassName = '',
}) => {
  const [hasImgError, setHasImgError] = useState(false);

  const sizeMap = {
    xs: { icon: 24, title: 'text-xs', sub: 'text-[8px]' },
    sm: { icon: 34, title: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 46, title: 'text-base', sub: 'text-[10px]' },
    lg: { icon: 60, title: 'text-lg', sub: 'text-xs' },
    xl: { icon: 76, title: 'text-xl', sub: 'text-xs' },
    '2xl': { icon: 96, title: 'text-2xl', sub: 'text-sm' },
    hero: { icon: 128, title: 'text-3xl', sub: 'text-sm' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // The official TANSIDCO emblem loaded from local public asset
  const SidcoEmblem = (
    <div
      className="relative shrink-0 select-none flex items-center justify-center transition-transform hover:scale-105"
      style={{ width: currentSize.icon, height: currentSize.icon }}
    >
      {!hasImgError ? (
        <img
          src={OFFICIAL_TANSIDCO_LOGO_SRC}
          alt="Official TANSIDCO Logo"
          className={`w-full h-full object-contain drop-shadow-md rounded-full bg-white p-0.5 border border-slate-100 ${imgClassName}`}
          onError={() => setHasImgError(true)}
          loading="eager"
        />
      ) : (
        <img
          src={FALLBACK_TANSIDCO_LOGO_SRC}
          alt="TANSIDCO Logo"
          className={`w-full h-full object-contain ${imgClassName}`}
        />
      )}
    </div>
  );

  if (!showText) {
    return <div className={`inline-flex items-center justify-center ${className}`}>{SidcoEmblem}</div>;
  }

  return (
    <div
      className={`inline-flex items-center gap-3 ${
        orientation === 'vertical' ? 'flex-col text-center' : 'flex-row text-left'
      } ${className}`}
    >
      {SidcoEmblem}
      <div className="flex flex-col justify-center min-w-0">
        <span
          className={`font-black tracking-tight leading-tight uppercase font-sans ${currentSize.title} ${
            textColor === 'light' ? 'text-white' : 'text-slate-900'
          }`}
        >
          TANSIDCO
        </span>
        <span
          className={`font-semibold tracking-normal leading-snug truncate ${currentSize.sub} ${
            textColor === 'light' ? 'text-blue-200' : 'text-slate-500'
          }`}
        >
          {subtitle || 'Tamil Nadu Small Industries Development Corporation Ltd.'}
        </span>
      </div>
    </div>
  );
};
