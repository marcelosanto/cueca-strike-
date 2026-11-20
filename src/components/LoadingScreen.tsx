import React from 'react';

export const LoadingScreen: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1e1b2e] text-[#fff8f0]">
      <div className="animate-cueca-sway mb-6">
        <svg
          width="112"
          height="92"
          viewBox="0 0 112 92"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 42 Z"
            fill="#fff8f0"
            stroke="#fb7185"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <rect x="11" y="14" width="90" height="14" rx="4" fill="#38bdf8" />
          <line x1="14" y1="21" x2="98" y2="21" stroke="#fff8f0" strokeWidth="2.5" strokeDasharray="6 4" />
        </svg>
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-[#fff8f0]">
        Vestindo os capacetes...
      </h2>
      <p className="mt-2 text-sm text-[#cbd5e1]">
        Preparando arena 3D e elásticos táticos
      </p>
    </div>
  );
};
