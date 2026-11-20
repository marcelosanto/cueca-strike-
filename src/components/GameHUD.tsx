import React from 'react';
import { Pause, Volume2, VolumeX, Zap, Flame, ShieldCheck, Trophy, Check, Video, SkipForward, ThumbsUp, Smile } from 'lucide-react';
import { EMOTES, EmoteId, HudSnapshot, WEAPONS, WeaponSlot } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  isTouchDevice: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSwitchWeapon: (slot: WeaponSlot) => void;
  onReload: () => void;
  onSkipKillCam: () => void;
  onTriggerEmote: (emote: EmoteId) => void;
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
  onSkipKillCam,
  onTriggerEmote,
}) => {
  if (hud.phase === 'title') return null;

  const killCamActive = hud.phase === 'playing' && !hud.playerAlive && hud.killCam.active;
  const killCamProgress = killCamActive
    ? Math.max(
      0,
      Math.min(100, (hud.killCam.timeRemaining / Math.max(0.1, hud.killCam.totalTime)) * 100)
    )
    : 0;

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const frayThreads = Math.round(((100 - hpPct) / 100) * 6);
  const half = hud.arenaHalfSize || 44;

  const toMapX = (wx: number) => 56 + (wx / half) * 40;
  const toMapY = (wz: number) => 44 + (wz / half) * 32;

  const tierPct = hud.nextCuecaTier
    ? Math.min(
      100,
      Math.max(
        0,
        ((hud.score - hud.cuecaTier.minScore) /
          Math.max(1, hud.nextCuecaTier.minScore - hud.cuecaTier.minScore)) *
        100
      )
    )
    : 100;

  const { speedTimer, damageTimer, shieldTimer, slipTimer } = hud.activeBuffs;

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
      {/* TOP BAR */}
      <div className="flex items-start justify-between gap-2">
        {/* Cueca-shaped SVG Minimap + Compact Daily Challenges Tracker */}
        <div className="flex flex-col items-start gap-1.5">
          <svg
            width={isTouchDevice ? 88 : 118}
            height={isTouchDevice ? 72 : 96}
            viewBox="0 0 112 92"
            className="drop-shadow-lg"
            aria-label="Minimapa em formato de cueca"
          >
            <defs>
              <clipPath id="cueca-minimap-clip">
                <path d="M12 16 H100 L94 44 C82 48 72 60 68 80 H44 C40 60 30 48 18 44 Z" />
              </clipPath>
            </defs>

            <path
              d="M12 16 H100 L94 44 C82 48 72 60 68 80 H44 C40 60 30 48 18 44 Z"
              fill="#1e1b2e"
              fillOpacity="0.9"
            />

            <g clipPath="url(#cueca-minimap-clip)">
              {hud.minimapWalls.map((w, idx) => {
                const mw = Math.max(2, (w.w / half) * 40);
                const md = Math.max(2, (w.d / half) * 32);
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
                    r={a.isPlayer ? 3.8 : 2.6}
                    fill={fill}
                    stroke="#1e1b2e"
                    strokeWidth="1"
                  />
                );
              })}
            </g>

            <path
              d="M12 16 H100 L94 44 C82 48 72 60 68 80 H44 C40 60 30 48 18 44 Z"
              fill="none"
              stroke={hud.cuecaTier.secondaryColor}
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <rect x="11" y="13" width="90" height="9" rx="3" fill={hud.cuecaTier.secondaryColor} />
          </svg>

          {!isTouchDevice && hud.dailyChallenges.length > 0 && (
            <div className="hidden md:flex flex-col gap-1 w-[212px] rounded-xl bg-[#1e1b2e]/88 border border-white/10 px-2.5 py-2 shadow">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#fde047]">
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  Desafios Diários
                </span>
                <span className="font-mono-num">
                  {hud.dailyChallenges.filter((c) => c.completed).length}/{hud.dailyChallenges.length}
                </span>
              </div>
              {hud.dailyChallenges.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-[10px]">
                  <span
                    className={`truncate ${c.completed ? 'text-[#4ade80] line-through' : 'text-[#e2e8f0]'
                      }`}
                  >
                    {c.description}
                  </span>
                  <span className="font-mono-num shrink-0 font-semibold text-[#fde047]">
                    {c.completed ? (
                      <Check className="h-3 w-3 text-[#4ade80]" />
                    ) : (
                      `${c.progress}/${c.target}`
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
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
              <span>R{hud.roundNumber}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{hud.aliveCuecasCount} intactas</span>
              {hud.airborneCuecasCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-[#fb7185]">
                    {hud.airborneCuecasCount} no ar
                  </span>
                </>
              )}
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
          <span className="hidden sm:inline text-[11px] text-[#94a3b8]">
            · {hud.difficulty === 'easy' ? 'Fácil' : 'Normal'}
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

      {/* CENTER FEEDBACK */}
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

        {hud.phase === 'playing' &&
          hud.mode === 'cueca-king' &&
          hud.playerAlive &&
          !hud.hasCueca &&
          hud.playerCuecaInPlay && (
            <div className="mt-2 rounded-xl bg-[#f43f5e]/92 px-4 py-1.5 font-display text-xs sm:text-sm font-bold text-white shadow-lg">
              Sua cueca está NO AR! Enquanto não tocar o chão, você continua no jogo!
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

        {hud.phase === 'playing' && !hud.playerAlive && !killCamActive && (
          <div className="mt-2 rounded-xl bg-[#1e1b2e]/90 border border-white/15 px-4 py-2 text-center">
            <div className="font-display text-base font-bold text-[#fb7185]">
              {hud.mode === 'cueca-king'
                ? 'Sua cueca caiu no chão! Aguardando fim da rodada...'
                : `Eliminado — renascendo em ${hud.respawnTimer}s...`}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="flex items-end justify-between gap-2">
        {/* Health + Active Buffs */}
        <div className={`flex flex-col gap-1.5 ${isTouchDevice ? 'mb-[138px]' : ''}`}>
          {(speedTimer > 0 || damageTimer > 0 || shieldTimer > 0 || slipTimer > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {speedTimer > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-[#083344]/95 border border-[#22d3ee]/40 px-2 py-1 text-[11px] font-semibold text-[#67e8f9] font-mono-num">
                  <Zap className="h-3 w-3" />
                  <span>{Math.ceil(speedTimer)}s</span>
                </div>
              )}
              {damageTimer > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-[#431407]/95 border border-[#f97316]/40 px-2 py-1 text-[11px] font-semibold text-[#fdba74] font-mono-num">
                  <Flame className="h-3 w-3" />
                  <span>{Math.ceil(damageTimer)}s</span>
                </div>
              )}
              {shieldTimer > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-[#1e1b4b]/95 border border-[#818cf8]/40 px-2 py-1 text-[11px] font-semibold text-[#c7d2fe] font-mono-num">
                  <ShieldCheck className="h-3 w-3" />
                  <span>{Math.ceil(shieldTimer)}s</span>
                </div>
              )}
              {slipTimer > 0 && (
                <div className="rounded-lg bg-[#422006]/95 border border-[#facc15]/50 px-2 py-1 text-[11px] font-bold text-[#fde047]">
                  Escorregando!
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5 rounded-xl bg-[#1e1b2e]/90 border border-white/12 px-3 py-2 shadow-lg">
            <svg
              width={isTouchDevice ? 46 : 58}
              height={isTouchDevice ? 40 : 48}
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

            <div className="leading-tight min-w-[126px]">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono-num text-lg sm:text-xl font-bold text-[#fff8f0]">
                  {hud.hp}
                </span>
                <span className="text-[11px] text-[#94a3b8]">HP · {hud.selectedCharacter.name}</span>
              </div>
              <div className="text-[11px] font-semibold text-[#fde047] whitespace-nowrap">
                {hud.hasCueca
                  ? `${hud.cuecaTier.name} (${hud.cuecaTier.rarity})`
                  : hud.playerCuecaInPlay
                    ? 'Cueca no Ar!'
                    : 'Careca (Sem Cueca!)'}
              </div>
              {hud.nextCuecaTier && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-[#38bdf8]"
                    style={{ width: `${tierPct}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Weapon, Emotes & Ammo Bar */}
        {!isTouchDevice && (
          <div className="flex flex-col items-center gap-1.5">
            {hud.playerAlive && !hud.repair.active && hud.phase === 'playing' && (
              <div className="flex items-center gap-1.5 rounded-xl bg-[#1e1b2e]/90 border border-white/12 px-2 py-1 shadow-lg pointer-events-auto">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8] px-1">
                  Emotes
                </span>
                {EMOTES.map((em) => {
                  const isActive = hud.activeEmote === em.id;
                  const onCooldown = hud.emoteCooldown > 0 && !isActive;
                  return (
                    <button
                      key={em.id}
                      type="button"
                      disabled={hud.emoteCooldown > 0}
                      onClick={() => onTriggerEmote(em.id)}
                      title={`${em.label} (${em.key})`}
                      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition-transform active:scale-95 whitespace-nowrap ${isActive
                          ? 'bg-[#facc15] text-[#1e1b2e] ring-2 ring-white/60'
                          : onCooldown
                            ? 'bg-white/5 text-[#94a3b8]/60 cursor-not-allowed'
                            : 'bg-white/10 text-[#fff8f0] hover:bg-white/20'
                        }`}
                    >
                      <span className="font-mono-num text-[10px] opacity-75">{em.key}</span>
                      {em.id === 'thumbs-up' && <ThumbsUp className="h-3.5 w-3.5" />}
                      {em.id === 'cueca' && (
                        <svg width="15" height="12" viewBox="0 0 112 92" aria-hidden="true">
                          <path
                            d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 42 Z"
                            fill={isActive ? '#1e1b2e' : '#f43f5e'}
                            stroke={isActive ? '#1e1b2e' : '#fff8f0'}
                            strokeWidth="8"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      {em.id === 'gg' && (
                        <span className="font-display text-[11px] font-bold">GG</span>
                      )}
                      {em.id === 'laugh' && <Smile className="h-3.5 w-3.5" />}
                      <span className="hidden lg:inline">{em.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl bg-[#1e1b2e]/90 border border-white/12 p-1.5 shadow-lg pointer-events-auto">
              {([1, 2, 3] as WeaponSlot[]).map((slot) => {
                const w = WEAPONS[slot];
                const maxAmmo = w.magSize + (slot === 3 ? hud.selectedCharacter.stats.extraGrenade : 0);
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
                      {hud.ammo[slot]}/{maxAmmo}
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
            <div className="text-[10px] text-[#cbd5e1]/80">
              Câmera segue mira · Q/E Ajuste · C Centralizar · Z/X/V/B Emotes
            </div>
          </div>
        )}

        {/* Right Score Counter */}
        <div className="hidden sm:block w-32 text-right">
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

      {/* CINEMATIC ENEMY-POV KILL CAM OVERLAY */}
      {killCamActive && (
        <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between">
          {/* Top Cinema Letterbox Bar */}
          <div
            className="flex items-center justify-between bg-[#09080f]/95 border-b border-[#f43f5e]/50 px-4 sm:px-6 py-2.5 shadow-2xl"
            style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f43f5e] text-white">
                <Video className="h-4 w-4" />
              </span>
              <div>
                <div className="font-display text-xs sm:text-sm font-bold tracking-wider text-[#f43f5e] uppercase">
                  Kill Cam · Visão do Inimigo
                </div>
                <div className="text-[10px] sm:text-xs text-[#cbd5e1]">
                  {hud.killCam.headshot ? 'Headshot! Sua cueca saiu voando!' : 'Eliminado em combate'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="hidden sm:inline font-mono-num text-xs text-[#94a3b8]">
                {hud.mode === 'cueca-king'
                  ? `${Math.ceil(hud.killCam.timeRemaining)}s`
                  : `Renascer em ${hud.respawnTimer}s`}
              </span>
              <button
                type="button"
                onClick={onSkipKillCam}
                className="flex min-h-[38px] items-center gap-1.5 rounded-lg bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#fff8f0] hover:bg-white/20 active:scale-95 transition-transform whitespace-nowrap"
              >
                <SkipForward className="h-3.5 w-3.5" />
                <span>Pular</span>
              </button>
            </div>
          </div>

          {/* Subtle corner viewfinder framing */}
          <div className="flex-1 relative mx-4 my-3 hidden sm:block">
            <div className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-[#f43f5e]/70" />
            <div className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-[#f43f5e]/70" />
            <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-[#f43f5e]/70" />
            <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-[#f43f5e]/70" />
          </div>

          {/* Bottom Cinema Letterbox Bar */}
          <div
            className="relative bg-[#09080f]/95 border-t border-white/15 px-4 sm:px-6 py-3 shadow-2xl"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
              <div
                className="h-full bg-[#f43f5e] transition-none"
                style={{ width: `${killCamProgress}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <svg
                  width={isTouchDevice ? 38 : 48}
                  height={isTouchDevice ? 32 : 40}
                  viewBox="0 0 112 92"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 42 Z"
                    fill={hud.killCam.killerCuecaColor}
                    stroke={hud.killCam.killerCuecaAccent}
                    strokeWidth="7"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="11"
                    y="14"
                    width="90"
                    height="14"
                    rx="4"
                    fill={hud.killCam.killerCuecaAccent}
                  />
                </svg>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase tracking-wide text-[#94a3b8]">
                      Eliminado por
                    </span>
                    <span className="font-display text-base sm:text-lg font-bold text-[#facc15] truncate">
                      {hud.killCam.killerName}
                    </span>
                    {hud.killCam.headshot && (
                      <span className="rounded bg-[#f43f5e] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                        Headshot
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#cbd5e1] truncate">
                    {hud.killCam.killerRole} · Arma: <span className="text-[#fff8f0] font-semibold">{hud.killCam.weaponName}</span> · Cueca: <span className="text-[#fde047]">{hud.killCam.killerCuecaName}</span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
                <span className="text-[11px] text-[#94a3b8]">
                  {hud.mode === 'cueca-king' ? 'Modo Cueca King' : 'Espaço para pular'}
                </span>
                <span className="font-mono-num text-sm font-bold text-[#fff8f0]">
                  {hud.mode === 'cueca-king'
                    ? 'Aguardando rodada'
                    : `Renascendo em ${hud.respawnTimer}s`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
