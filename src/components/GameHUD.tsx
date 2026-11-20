import React from 'react';
import { Pause, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot, WEAPONS, WeaponSlot } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  isTouchDevice: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSwitchWeapon: (slot: WeaponSlot) => void;
  onReload: () => void;
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  isTouchDevice,
  onToggleMute,
  onPause,
  onSwitchWeapon,
  onReload,
}) => {
  if (hud.phase === 'title') return null;

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const frayThreads = Math.round(((100 - hpPct) / 100) * 6);
  const half = hud.arenaHalfSize || 18;

  const toMapX = (wx: number) => 56 + (wx / half) * 40;
  const toMapY = (wz: number) => 44 + (wz / half) * 32;

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between"
      style={{
        paddingTop: 'max(10px, env(safe-area-inset-top))',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(12px, env(safe-area-inset-left))',
        paddingRight: 'max(12px, env(safe-area-inset-right))',
      }}
    >
      {/* TOP BAR: Cueca Minimap (left) | Score & Timer (center) | Killfeed + Mute/Pause (right) */}
      <div className="flex items-start justify-between gap-2">
        {/* Cueca-shaped SVG Minimap */}
        <div className="flex flex-col items-center">
          <svg
            width={isTouchDevice ? 84 : 112}
            height={isTouchDevice ? 68 : 92}
            viewBox="0 0 112 92"
            className="drop-shadow-lg"
            aria-label="Minimapa em formato de cueca"
          >
            <defs>
              <clipPath id="cueca-minimap-clip">
                <path d="M12 16 H100 L94 44 C82 48 72 60 68 80 H44 C40 60 30 48 18 44 Z" />
              </clipPath>
            </defs>

            {/* Cueca backing */}
            <path
              d="M12 16 H100 L94 44 C82 48 72 60 68 80 H44 C40 60 30 48 18 44 Z"
              fill="#1e1b2e"
              fillOpacity="0.88"
            />

            {/* Arena walls & actors clipped inside cueca silhouette */}
            <g clipPath="url(#cueca-minimap-clip)">
              {hud.minimapWalls.map((w, idx) => {
                const mw = Math.max(3, (w.w / half) * 40);
                const md = Math.max(3, (w.d / half) * 32);
                return (
                  <rect
                    key={idx}
                    x={toMapX(w.x) - mw / 2}
                    y={toMapY(w.z) - md / 2}
                    width={mw}
                    height={md}
                    rx="1"
                    fill="#475569"
                  />
                );
              })}
              {hud.minimapActors.map((a) => {
                if (!a.alive) return null;
                const fill = a.isPlayer
                  ? '#facc15'
                  : hud.mode === 'tdm'
                    ? a.team === 'blue'
                      ? '#38bdf8'
                      : '#fb923c'
                    : '#f43f5e';
                return (
                  <circle
                    key={a.id}
                    cx={toMapX(a.x)}
                    cy={toMapY(a.z)}
                    r={a.isPlayer ? 4.2 : 3}
                    fill={fill}
                    stroke="#1e1b2e"
                    strokeWidth="1.2"
                  />
                );
              })}
            </g>

            {/* Elastic waistband & outline */}
            <path
              d="M12 16 H100 L94 44 C82 48 72 60 68 80 H44 C40 60 30 48 18 44 Z"
              fill="none"
              stroke={hud.cuecaTier.secondaryColor}
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <rect x="11" y="13" width="90" height="9" rx="3" fill={hud.cuecaTier.secondaryColor} />
          </svg>
        </div>

        {/* Center Match Score & Timer */}
        <div className="flex items-center gap-3 rounded-xl bg-[#1e1b2e]/90 border border-white/12 px-3.5 py-1.5 shadow-lg">
          {hud.mode === 'tdm' ? (
            <div className="flex items-center gap-2 font-mono-num text-sm sm:text-base font-bold">
              <span className="text-[#38bdf8]">{hud.blueScore}</span>
              <span className="text-white/40">:</span>
              <span className="text-[#fb923c]">{hud.orangeScore}</span>
            </div>
          ) : hud.mode === 'cueca-king' ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#fde047]">
              <span>Rodada {hud.roundNumber}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{hud.aliveCuecasCount} cuecas</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#fff8f0]">
              <span className="font-mono-num text-[#facc15]">{hud.kills}</span>
              <span className="text-[#94a3b8]">/ 15 abates</span>
            </div>
          )}

          <span className="text-white/20" aria-hidden="true">
            |
          </span>
          <span className="font-mono-num text-sm sm:text-base font-bold text-[#fff8f0]">
            {formatTimer(hud.timerSeconds)}
          </span>
        </div>

        {/* Right: Utility Buttons + Flying Cueca Killfeed */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Ativar som' : 'Silenciar som'}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e1b2e]/90 border border-white/15 text-[#fff8f0] active:scale-95 transition-transform"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Pausar jogo"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e1b2e]/90 border border-white/15 text-[#fff8f0] active:scale-95 transition-transform"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>

          {/* Flying Cueca Killfeed */}
          <div className="flex flex-col items-end gap-1 max-w-[240px]">
            {hud.killfeed.map((k) => (
              <div
                key={k.id}
                className="animate-killfeed-item flex items-center gap-1.5 rounded-lg bg-[#1e1b2e]/88 border border-white/10 px-2.5 py-1 text-[11px] sm:text-xs text-[#fff8f0] shadow"
              >
                <span className="font-semibold text-[#facc15] truncate max-w-[78px]">
                  {k.killerName}
                </span>
                {k.headshot ? (
                  <svg
                    width="18"
                    height="15"
                    viewBox="0 0 112 92"
                    className="animate-cueca-icon shrink-0"
                    aria-label="Headshot cueca voadora"
                  >
                    <path
                      d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 42 Z"
                      fill="#fff8f0"
                      stroke={k.cuecaColor}
                      strokeWidth="9"
                    />
                    <rect x="11" y="14" width="90" height="14" fill={k.cuecaColor} />
                  </svg>
                ) : (
                  <span className="text-[#94a3b8]">→</span>
                )}
                <span className="truncate max-w-[78px] text-[#e2e8f0]">
                  {k.victimName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER FEEDBACK: Hitmarker, Toast Banner, Respawn / Round Over */}
      {hud.phase === 'playing' && hud.playerAlive && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative h-5 w-5 flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-[#f43f5e] ring-2 ring-white/80" />
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center pointer-events-none">
        {hud.hitMarkerTimer > 0 && (
          <div
            className={`font-display text-sm font-bold tracking-wider ${hud.hitMarkerHeadshot ? 'text-[#facc15] scale-125' : 'text-white'
              }`}
          >
            {hud.hitMarkerHeadshot ? '✕ BOING! HEADSHOT' : '✕'}
          </div>
        )}

        {hud.bannerToast && (
          <div
            className={`mt-2 rounded-xl px-4 py-1.5 font-display text-sm sm:text-base font-bold shadow-lg ${hud.bannerToast.tone === 'gold'
                ? 'bg-[#facc15] text-[#1e1b2e]'
                : hud.bannerToast.tone === 'mint'
                  ? 'bg-[#22c55e] text-[#052e16]'
                  : 'bg-[#f43f5e] text-white'
              }`}
          >
            {hud.bannerToast.text}
          </div>
        )}

        {hud.phase === 'round-over' && (
          <div className="mt-2 rounded-2xl bg-[#1e1b2e]/95 border-2 border-[#facc15] px-6 py-3 text-center shadow-2xl">
            <div className="font-display text-xl font-bold text-[#facc15]">
              {hud.roundWinnerText}
            </div>
            <div className="mt-1 text-xs text-[#cbd5e1]">
              Próxima rodada em instantes...
            </div>
          </div>
        )}

        {hud.phase === 'playing' && !hud.playerAlive && (
          <div className="mt-2 rounded-xl bg-[#1e1b2e]/90 border border-white/15 px-4 py-2 text-center">
            <div className="font-display text-base font-bold text-[#fb7185]">
              {hud.mode === 'cueca-king'
                ? 'Sua cueca voou! Aguardando fim da rodada...'
                : `Renascendo em ${hud.respawnTimer}s...`}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR: Unraveling Cueca Health Bar (left) + Weapon Selector (center/desktop) */}
      <div className="flex items-end justify-between gap-2">
        {/* Unraveling Calcinha / Cueca Health Bar */}
        <div
          className={`flex items-center gap-2.5 rounded-xl bg-[#1e1b2e]/90 border border-white/12 px-3 py-2 shadow-lg ${isTouchDevice ? 'mb-[138px]' : ''
            }`}
        >
          <svg
            width={isTouchDevice ? 46 : 60}
            height={isTouchDevice ? 40 : 50}
            viewBox="0 0 112 96"
            aria-label="Vida em formato de cueca"
          >
            <defs>
              <clipPath id="hp-cueca-clip">
                <path d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 44 Z" />
              </clipPath>
            </defs>
            <path
              d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 44 Z"
              fill="#334155"
            />
            <g clipPath="url(#hp-cueca-clip)">
              <rect
                x="0"
                y={16 + ((100 - hpPct) / 100) * 64}
                width="112"
                height="80"
                fill={hpPct > 35 ? '#fb7185' : '#ef4444'}
              />
            </g>
            <path
              d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 44 Z"
              fill="none"
              stroke={hud.hasCueca ? hud.cuecaTier.secondaryColor : '#94a3b8'}
              strokeWidth="5"
              strokeDasharray={hud.hasCueca ? undefined : '7 5'}
              strokeLinejoin="round"
            />
            <rect
              x="11"
              y="13"
              width="90"
              height="10"
              rx="3"
              fill={hud.hasCueca ? hud.cuecaTier.secondaryColor : '#64748b'}
            />
            {/* Unraveling dangling yarn threads as damage increases */}
            {Array.from({ length: frayThreads }).map((_, i) => (
              <path
                key={i}
                d={`M ${36 + i * 8} 76 Q ${32 + i * 8} 86 ${38 + i * 8} 93`}
                stroke="#fda4af"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </svg>

          <div className="leading-tight">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono-num text-lg sm:text-xl font-bold text-[#fff8f0]">
                {hud.hp}
              </span>
              <span className="text-[11px] text-[#94a3b8]">HP</span>
            </div>
            <div className="text-[11px] font-semibold text-[#fde047] whitespace-nowrap">
              {hud.hasCueca ? hud.cuecaTier.name : 'Careca (Sem Cueca!)'}
            </div>
          </div>
        </div>

        {/* Desktop Weapon & Ammo Bar (mobile puts these neatly above joystick) */}
        {!isTouchDevice && (
          <div className="flex items-center gap-2 rounded-xl bg-[#1e1b2e]/90 border border-white/12 p-1.5 shadow-lg pointer-events-auto">
            {([1, 2, 3] as WeaponSlot[]).map((slot) => {
              const w = WEAPONS[slot];
              const active = hud.weaponSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onSwitchWeapon(slot)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${active
                      ? 'bg-[#facc15] text-[#1e1b2e]'
                      : 'text-[#cbd5e1] hover:bg-white/10'
                    }`}
                >
                  <span className="font-mono-num opacity-75">{slot}</span>
                  <span>{w.shortName}</span>
                  <span className="font-mono-num font-bold">
                    {hud.ammo[slot]}/{w.magSize}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onReload}
              className="rounded-lg bg-white/10 px-2.5 py-1.5 font-mono-num text-xs font-semibold text-[#fff8f0] hover:bg-white/20"
            >
              {hud.reloading
                ? `${Math.round(hud.reloadProgress * 100)}%`
                : 'R'}
            </button>
          </div>
        )}

        {/* Right spacer for clean balance on desktop */}
        <div className="hidden sm:block w-28 text-right">
          <div className="inline-block rounded-xl bg-[#1e1b2e]/85 border border-white/10 px-3 py-1.5 text-right">
            <div className="font-mono-num text-sm font-bold text-[#fff8f0]">
              {hud.score} pts
            </div>
            <div className="text-[11px] text-[#94a3b8]">
              {hud.headshots} headshots
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
