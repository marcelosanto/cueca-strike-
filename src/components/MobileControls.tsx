import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, RotateCw, ArrowUp } from 'lucide-react';
import { HudSnapshot, WEAPONS, WeaponSlot } from '../game/types';

interface MobileControlsProps {
  visible: boolean;
  hud: HudSnapshot;
  onMove: (x: number, y: number) => void;
  onAim: (dx: number, dy: number) => void;
  onFire: (held: boolean) => void;
  onJump: () => void;
  onSwitchWeapon: (slot: WeaponSlot) => void;
  onReload: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  visible,
  hud,
  onMove,
  onAim,
  onFire,
  onJump,
  onSwitchWeapon,
  onReload,
}) => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyPointerId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });

  const aimPointerId = useRef<number | null>(null);
  const aimAnchor = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const check = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 900);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!visible) return null;

  const maxRadius = 38;

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoy(e.clientX, e.clientY);
  };

  const updateJoy = (cx: number, cy: number) => {
    const dx = cx - joyCenter.current.x;
    const dy = cy - joyCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    setJoyOffset({ x: ox, y: oy });
    onMove(ox / maxRadius, -oy / maxRadius);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    updateJoy(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    setJoyOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const handleAimDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    aimPointerId.current = e.pointerId;
    aimAnchor.current = { x: e.clientX, y: e.clientY };
  };

  const handleAimMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (aimPointerId.current !== e.pointerId) return;
    const dx = e.clientX - aimAnchor.current.x;
    const dy = e.clientY - aimAnchor.current.y;
    if (Math.hypot(dx, dy) > 8) {
      onAim(dx, -dy);
    }
  };

  const handleAimUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (aimPointerId.current === e.pointerId) {
      aimPointerId.current = null;
    }
  };

  return (
    <>
      {/* Portrait -> Landscape Lock Overlay */}
      {isPortrait && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1e1b2e] p-6 text-center text-[#fff8f0]">
          <div className="animate-phone-rotate mb-5 rounded-2xl border-4 border-[#facc15] p-4">
            <div className="h-14 w-8 rounded-md bg-[#facc15]/20 border border-[#facc15]" />
          </div>
          <h2 className="font-display text-2xl font-bold">Gire o celular</h2>
          <p className="mt-2 max-w-xs text-sm text-[#cbd5e1]">
            Cueca Strike roda em modo paisagem para você mirar e desviar das cuecas com folga!
          </p>
        </div>
      )}

      {/* Landscape Touch Overlay */}
      <div
        className="fixed inset-0 z-20 pointer-events-none"
        style={{
          paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
          paddingLeft: 'max(14px, env(safe-area-inset-left))',
          paddingRight: 'max(14px, env(safe-area-inset-right))',
          paddingTop: 'max(14px, env(safe-area-inset-top))',
        }}
      >
        {/* Right-half Drag-to-Aim zone */}
        <div
          onPointerDown={handleAimDown}
          onPointerMove={handleAimMove}
          onPointerUp={handleAimUp}
          onPointerCancel={handleAimUp}
          className="fixed right-0 top-14 bottom-0 w-1/2 pointer-events-auto"
          aria-label="Área de mira"
        />

        {/* Weapon 1/2/3 & Reload above Joystick (min 44x44px) */}
        <div
          className="fixed flex items-center gap-1.5 pointer-events-auto"
          style={{
            left: 'max(16px, env(safe-area-inset-left))',
            bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 114px)',
          }}
        >
          {([1, 2, 3] as WeaponSlot[]).map((slot) => {
            const active = hud.weaponSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSwitchWeapon(slot);
                }}
                className={`flex h-11 min-w-[44px] flex-col items-center justify-center rounded-xl border px-2 font-mono-num text-xs font-bold active:scale-90 active:opacity-80 transition-transform ${
                  active
                    ? 'border-[#facc15] bg-[#facc15] text-[#1e1b2e]'
                    : 'border-white/20 bg-[#1e1b2e]/85 text-[#fff8f0]'
                }`}
              >
                <span>{slot}</span>
                <span className="text-[9px] leading-none">
                  {hud.ammo[slot]}/{WEAPONS[slot].magSize}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onReload();
            }}
            aria-label="Recarregar"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-[#1e1b2e]/85 text-[#fff8f0] active:scale-90 active:opacity-80 transition-transform"
          >
            <RotateCw className={`h-4 w-4 ${hud.reloading ? 'animate-spin text-[#facc15]' : ''}`} />
          </button>
        </div>

        {/* Virtual Joystick (Bottom-Left) */}
        <div
          onPointerDown={handleJoyDown}
          onPointerMove={handleJoyMove}
          onPointerUp={handleJoyUp}
          onPointerCancel={handleJoyUp}
          className="fixed flex h-[104px] w-[104px] items-center justify-center rounded-full border-2 border-white/25 bg-[#1e1b2e]/55 pointer-events-auto"
          style={{
            left: 'max(18px, env(safe-area-inset-left))',
            bottom: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          <div
            className="h-11 w-11 rounded-full bg-[#facc15] border-2 border-white shadow-md"
            style={{
              transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`,
            }}
          />
        </div>

        {/* Jump Button (Top-Right below Pause/Mute) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onJump();
          }}
          aria-label="Pular"
          className="fixed flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white/25 bg-[#38bdf8]/90 text-[#0f172a] shadow-lg pointer-events-auto active:scale-90 active:opacity-80 transition-transform"
          style={{
            right: 'max(16px, env(safe-area-inset-right))',
            top: 'calc(max(12px, env(safe-area-inset-top)) + 56px)',
          }}
        >
          <ArrowUp className="h-6 w-6 stroke-[2.5]" />
        </button>

        {/* Fixed Fire Button (Bottom-Right) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onFire(true);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onFire(false);
          }}
          onPointerCancel={() => onFire(false)}
          aria-label="Atirar"
          className="fixed flex h-[68px] w-[68px] items-center justify-center rounded-full border-4 border-white bg-[#f43f5e] text-white shadow-xl pointer-events-auto active:scale-90 active:opacity-85 transition-transform"
          style={{
            right: 'max(20px, env(safe-area-inset-right))',
            bottom: 'max(18px, env(safe-area-inset-bottom))',
          }}
        >
          <Crosshair className="h-7 w-7" />
        </button>
      </div>
    </>
  );
};
