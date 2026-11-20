import React, { useEffect } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import { GameMode, MapId } from '../game/types';

interface TitleScreenProps {
  mode: GameMode;
  mapId: MapId;
  muted: boolean;
  onSelectMode: (mode: GameMode) => void;
  onSelectMap: (map: MapId) => void;
  onToggleMute: () => void;
  onStart: () => void;
}

const MODES: Array<{ id: GameMode; label: string; hint: string }> = [
  { id: 'deathmatch', label: 'Deathmatch', hint: 'Todos contra todos · 15 abates' },
  { id: 'tdm', label: 'Team Deathmatch', hint: 'Azul vs Laranja · 20 abates' },
  { id: 'cueca-king', label: 'Cueca King', hint: 'Última cueca na cabeça vence' },
];

const MAPS: Array<{ id: MapId; label: string }> = [
  { id: 'canteiro', label: 'Canteiro' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'base', label: 'Base Militar' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  mode,
  mapId,
  muted,
  onSelectMode,
  onSelectMap,
  onToggleMute,
  onStart,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 pointer-events-none">
      {/* Top right audio toggle */}
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto" />
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Ativar som' : 'Silenciar som'}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e1b2e]/90 border border-white/15 text-[#fff8f0] hover:bg-[#2b2640] active:scale-95 transition-transform"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Left-aligned clean editorial lockup over calm scrim so 3D arena stays visible */}
      <div className="max-w-md rounded-2xl bg-[#1e1b2e]/88 border border-white/12 p-5 sm:p-6 shadow-2xl pointer-events-auto">
        {/* Bespoke inline SVG Title Lockup */}
        <div className="flex items-center gap-3.5">
          <div className="shrink-0">
            <svg width="64" height="54" viewBox="0 0 112 92" fill="none" aria-hidden="true">
              <path
                d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 42 Z"
                fill="#fff8f0"
                stroke="#f43f5e"
                strokeWidth="6"
                strokeLinejoin="round"
              />
              <rect x="11" y="14" width="90" height="14" rx="4" fill="#facc15" />
              <circle cx="42" cy="44" r="5" fill="#38bdf8" />
              <circle cx="70" cy="44" r="5" fill="#fb7185" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#fff8f0] leading-none">
              Cueca Strike
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#cbd5e1]">
              Tático isométrico de cabeçudos e cuecas voadoras
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="mt-5">
          <div className="text-xs font-semibold text-[#94a3b8] mb-1.5">Modo de Jogo</div>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#13111c] p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMode(m.id)}
                className={`min-h-[40px] rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                  mode === m.id
                    ? 'bg-[#f43f5e] text-white'
                    : 'text-[#cbd5e1] hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[#fde047]">{activeMode.hint}</p>
        </div>

        {/* Map selector */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-[#94a3b8] mb-1.5">Mapa</div>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#13111c] p-1">
            {MAPS.map((mp) => (
              <button
                key={mp.id}
                type="button"
                onClick={() => onSelectMap(mp.id)}
                className={`min-h-[40px] rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                  mapId === mp.id
                    ? 'bg-[#38bdf8] text-[#0f172a]'
                    : 'text-[#cbd5e1] hover:text-white'
                }`}
              >
                {mp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Play CTA */}
        <button
          type="button"
          onClick={onStart}
          className="mt-5 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#facc15] px-6 py-3 font-display text-lg font-bold text-[#1e1b2e] hover:bg-[#fde047] active:scale-[0.98] transition-transform shadow-lg"
        >
          <Play className="h-5 w-5 fill-current" />
          Jogar Agora
        </button>

        {/* Single flat control-hint line */}
        <p className="mt-3 text-center text-[11px] text-[#94a3b8]">
          WASD Mover · Mouse Mirar/Atirar · 1-3 Armas · R Recarregar · Espaço Pular
        </p>
      </div>

      <div />
    </div>
  );
};
