import React from 'react';

interface RutaTrackLogoProps {
  variant?: 'badge' | 'compact' | 'hero';
  className?: string;
}

export const RutaTrackLogo: React.FC<RutaTrackLogoProps> = ({
  variant = 'compact',
  className = '',
}) => {
  if (variant === 'badge') {
    return (
      <img
        src="/icon.svg"
        alt="RutaTrack Logo"
        referrerPolicy="no-referrer"
        className={`rounded-2xl shadow-md select-none ${className}`}
      />
    );
  }

  if (variant === 'hero') {
    return (
      <div className={`flex items-center gap-3.5 ${className}`}>
        <img
          src="/icon.svg"
          alt="RutaTrack"
          referrerPolicy="no-referrer"
          className="w-14 h-14 rounded-2xl shadow-lg border border-sky-400/30 shrink-0"
        />
        <div className="min-w-0">
          <div className="text-2xl font-extrabold tracking-tight leading-none">
            <span className="text-white">Ruta</span>
            <span className="text-[#00A8FF]">Track</span>
          </div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-sky-200/90 mt-1 uppercase truncate">
            CAMIONES | CISTERNAS | TRANSPORTE
          </p>
        </div>
      </div>
    );
  }

  // Default compact header mark
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/icon.svg"
        alt="RutaTrack"
        referrerPolicy="no-referrer"
        className="w-9 h-9 rounded-xl shadow-sm border border-sky-400/25 shrink-0"
      />
      <span className="text-lg font-extrabold tracking-tight leading-none whitespace-nowrap">
        <span className="text-white">Ruta</span>
        <span className="text-[#00A8FF]">Track</span>
      </span>
    </div>
  );
};
