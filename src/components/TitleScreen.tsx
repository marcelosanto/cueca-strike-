import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Play, Shield, Flame, Trophy, Lock, Check } from 'lucide-react';
import { EXCLUSIVE_CUECAS } from '../game/dailyChallenges';
import {
  CHARACTERS,
  CharacterId,
  CuecaTier,
  Difficulty,
  Faction,
  GameMode,
  HudSnapshot,
  MapId,
} from '../game/types';

interface TitleScreenProps {
  mode: GameMode;
  mapId: MapId;
  characterId: CharacterId;
  difficulty: Difficulty;
  muted: boolean;
  currentTier: CuecaTier;
  nextTier: CuecaTier | null;
  careerScore: number;
  dailyChallenges: HudSnapshot['dailyChallenges'];
  unlockedExclusiveCuecaIds: string[];
  equippedExclusiveCuecaId: string | null;
  onSelectMode: (mode: GameMode) => void;
  onSelectMap: (map: MapId) => void;
  onSelectCharacter: (id: CharacterId) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onEquipCueca: (cuecaId: string | null) => void;
  onToggleMute: () => void;
  onStart: () => void;
}

const MODES: Array<{ id: GameMode; label: string; hint: string }> = [
  { id: 'deathmatch', label: 'Deathmatch', hint: 'Todos contra todos · 15 abates' },
  { id: 'tdm', label: 'Team Deathmatch', hint: 'Heróis vs Vilões · 20 abates' },
  { id: 'cueca-king', label: 'Cueca King', hint: 'Última cueca intacta ou ainda no ar vence!' },
];

const MAPS: Array<{ id: MapId; label: string }> = [
  { id: 'canteiro', label: 'Canteiro' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'base', label: 'Base Militar' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  mode,
  mapId,
  characterId,
  difficulty,
  muted,
  currentTier,
  nextTier,
  careerScore,
  dailyChallenges,
  unlockedExclusiveCuecaIds,
  equippedExclusiveCuecaId,
  onSelectMode,
  onSelectMap,
  onSelectCharacter,
  onSelectDifficulty,
  onEquipCueca,
  onToggleMute,
  onStart,
}) => {
  const initialFaction =
    CHARACTERS.find((c) => c.id === characterId)?.faction ?? 'heroes';
  const [factionTab, setFactionTab] = useState<Faction>(initialFaction);
  const [panelTab, setPanelTab] = useState<'play' | 'daily'>('play');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'BUTTON') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  const activeMode = MODES.find((m) => m.id === mode)!;
  const roster = CHARACTERS.filter((c) => c.faction === factionTab);
  const completedDailyCount = dailyChallenges.filter((c) => c.completed).length;
  const progressPct = nextTier
    ? Math.min(
      100,
      Math.max(
        0,
        ((careerScore - currentTier.minScore) /
          Math.max(1, nextTier.minScore - currentTier.minScore)) *
        100
      )
    )
    : 100;

  const handleFactionSwitch = (faction: Faction) => {
    setFactionTab(faction);
    const current = CHARACTERS.find((c) => c.id === characterId);
    if (current?.faction !== faction) {
      const first = CHARACTERS.find((c) => c.faction === faction);
      if (first) onSelectCharacter(first.id);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-6 pointer-events-none overflow-y-auto">
      {/* Top right audio toggle */}
      <div className="flex items-start justify-end">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Ativar som' : 'Silenciar som'}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e1b2e]/92 border border-white/15 text-[#fff8f0] hover:bg-[#2b2640] active:scale-95 transition-transform"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Main Command Panel */}
      <div className="my-auto max-w-xl rounded-2xl bg-[#1e1b2e]/92 border border-white/12 p-4 sm:p-6 shadow-2xl pointer-events-auto">
        {/* Title Lockup */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <svg width="54" height="46" viewBox="0 0 112 92" fill="none" aria-hidden="true">
                <path
                  d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 42 Z"
                  fill={currentTier.primaryColor}
                  stroke={currentTier.secondaryColor}
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <rect x="11" y="14" width="90" height="14" rx="4" fill={currentTier.secondaryColor} />
                <circle cx="42" cy="44" r="5" fill={currentTier.accentColor} />
                <circle cx="70" cy="44" r="5" fill={currentTier.accentColor} />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#fff8f0] leading-none">
                Cueca Strike
              </h1>
              <p className="mt-1 text-xs text-[#cbd5e1]">
                Cabeçudos, cuecas voadoras, cascas de banana e trampolins ocultos
              </p>
            </div>
          </div>

          <div className="hidden sm:block text-right shrink-0">
            <div className="text-xs font-semibold text-[#fde047]">{currentTier.name}</div>
            <div className="font-mono-num text-[11px] text-[#94a3b8]">
              {equippedExclusiveCuecaId
                ? 'Cueca Exclusiva'
                : nextTier
                  ? `${careerScore}/${nextTier.minScore} pts`
                  : 'Nível Máximo'}
            </div>
          </div>
        </div>

        {/* Career progress bar */}
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#facc15]"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Main Panel Tabs: Jogar | Desafios Diários */}
        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-[#13111c] p-1">
          <button
            type="button"
            onClick={() => setPanelTab('play')}
            className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${panelTab === 'play'
                ? 'bg-[#38bdf8] text-[#0f172a]'
                : 'text-[#cbd5e1] hover:text-white'
              }`}
          >
            <Play className="h-3.5 w-3.5" />
            Partida
          </button>
          <button
            type="button"
            onClick={() => setPanelTab('daily')}
            className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${panelTab === 'daily'
                ? 'bg-[#facc15] text-[#1e1b2e]'
                : 'text-[#cbd5e1] hover:text-white'
              }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Desafios Diários</span>
            <span className="font-mono-num opacity-80">({completedDailyCount}/3)</span>
          </button>
        </div>

        {panelTab === 'play' ? (
          <>
            {/* Heroes vs Villains Character Selector (4 + 4) */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-[#94a3b8]">
                  Escolha seu Personagem
                </span>
                <div className="flex items-center gap-1 rounded-lg bg-[#13111c] p-0.5">
                  <button
                    type="button"
                    onClick={() => handleFactionSwitch('heroes')}
                    className={`flex items-center gap-1.5 min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${factionTab === 'heroes'
                        ? 'bg-[#38bdf8] text-[#0f172a]'
                        : 'text-[#cbd5e1] hover:text-white'
                      }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Heróis (4)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFactionSwitch('villains')}
                    className={`flex items-center gap-1.5 min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${factionTab === 'villains'
                        ? 'bg-[#f43f5e] text-white'
                        : 'text-[#cbd5e1] hover:text-white'
                      }`}
                  >
                    <Flame className="h-3.5 w-3.5" />
                    Vilões (4)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {roster.map((char) => {
                  const selected = characterId === char.id;
                  const hexColor = `#${char.suitColor.toString(16).padStart(6, '0')}`;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => onSelectCharacter(char.id)}
                      className={`flex flex-col items-start rounded-xl border p-2 text-left transition-colors min-h-[64px] ${selected
                          ? 'border-[#facc15] bg-[#2a2540]'
                          : 'border-white/10 bg-[#13111c] hover:border-white/25'
                        }`}
                    >
                      <div className="flex w-full items-center gap-1.5">
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-sm border border-white/30"
                          style={{ backgroundColor: hexColor }}
                        />
                        <span className="text-xs font-bold text-[#fff8f0] truncate">
                          {char.name}
                        </span>
                      </div>
                      <span className="mt-1 text-[10px] text-[#94a3b8] truncate w-full">
                        {char.role}
                      </span>
                      <span className="mt-0.5 text-[10px] font-semibold text-[#fde047] truncate w-full">
                        {char.perkLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode selector */}
            <div className="mt-3.5">
              <div className="text-xs font-semibold text-[#94a3b8] mb-1">Modo de Jogo</div>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#13111c] p-1">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMode(m.id)}
                    className={`min-h-[38px] rounded-lg px-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap truncate ${mode === m.id
                        ? 'bg-[#f43f5e] text-white'
                        : 'text-[#cbd5e1] hover:text-white'
                      }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-[#fde047]">{activeMode.hint}</p>
            </div>

            {/* Map & Difficulty Grid */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-7">
                <div className="text-xs font-semibold text-[#94a3b8] mb-1">Mapa (CS 1.6)</div>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#13111c] p-1">
                  {MAPS.map((mp) => (
                    <button
                      key={mp.id}
                      type="button"
                      onClick={() => onSelectMap(mp.id)}
                      className={`min-h-[38px] rounded-lg px-1.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap truncate ${mapId === mp.id
                          ? 'bg-[#38bdf8] text-[#0f172a]'
                          : 'text-[#cbd5e1] hover:text-white'
                        }`}
                    >
                      {mp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-5">
                <div className="text-xs font-semibold text-[#94a3b8] mb-1">Dificuldade</div>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#13111c] p-1">
                  <button
                    type="button"
                    onClick={() => onSelectDifficulty('easy')}
                    className={`min-h-[38px] rounded-lg px-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${difficulty === 'easy'
                        ? 'bg-[#22c55e] text-[#052e16]'
                        : 'text-[#cbd5e1] hover:text-white'
                      }`}
                  >
                    Fácil
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectDifficulty('normal')}
                    className={`min-h-[38px] rounded-lg px-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${difficulty === 'normal'
                        ? 'bg-[#facc15] text-[#1e1b2e]'
                        : 'text-[#cbd5e1] hover:text-white'
                      }`}
                  >
                    Normal
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3.5 space-y-3">
            {/* Today's 3 Daily Challenges */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#94a3b8]">
                  Metas de Hoje (Recompensam Cuecas Exclusivas)
                </span>
                <span className="font-mono-num text-[11px] text-[#fde047]">
                  {completedDailyCount}/3 completas
                </span>
              </div>
              <div className="space-y-1.5">
                {dailyChallenges.map((ch) => {
                  const pct = Math.min(100, Math.round((ch.progress / Math.max(1, ch.target)) * 100));
                  return (
                    <div
                      key={ch.id}
                      className={`rounded-xl border p-2.5 ${ch.completed
                          ? 'border-[#22c55e]/50 bg-[#052e16]/45'
                          : 'border-white/10 bg-[#13111c]'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {ch.completed && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-[#4ade80]" />
                            )}
                            <span className="text-xs font-bold text-[#fff8f0] truncate">
                              {ch.description}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-[#94a3b8]">
                            Recompensa: <span className="text-[#fde047] font-semibold">{ch.rewardCuecaName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <svg width="26" height="22" viewBox="0 0 112 92" aria-hidden="true">
                            <path
                              d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 42 Z"
                              fill={ch.rewardCuecaColor}
                              stroke={ch.rewardCuecaAccent}
                              strokeWidth="7"
                              strokeLinejoin="round"
                            />
                            <rect x="11" y="14" width="90" height="14" rx="4" fill={ch.rewardCuecaAccent} />
                          </svg>
                          <span className="font-mono-num text-xs font-bold text-[#fff8f0] w-10 text-right">
                            {ch.progress}/{ch.target}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${ch.completed ? 'bg-[#22c55e]' : 'bg-[#38bdf8]'
                            }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Exclusive Cosmetic Cueca Locker */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-[#94a3b8]">
                  Armário de Cuecas Cosméticas
                </span>
                <button
                  type="button"
                  onClick={() => onEquipCueca(null)}
                  className={`min-h-[30px] rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${equippedExclusiveCuecaId === null
                      ? 'bg-[#38bdf8] text-[#0f172a]'
                      : 'bg-[#13111c] text-[#cbd5e1] border border-white/10 hover:text-white'
                    }`}
                >
                  Progressão Padrão
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {EXCLUSIVE_CUECAS.map((cueca) => {
                  const unlocked = unlockedExclusiveCuecaIds.includes(cueca.id);
                  const equipped = equippedExclusiveCuecaId === cueca.id;
                  return (
                    <button
                      key={cueca.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onEquipCueca(equipped ? null : cueca.id)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-colors min-h-[54px] ${equipped
                          ? 'border-[#facc15] bg-[#2a2540]'
                          : unlocked
                            ? 'border-white/15 bg-[#13111c] hover:border-white/30'
                            : 'border-white/5 bg-[#13111c]/60 opacity-60 cursor-not-allowed'
                        }`}
                    >
                      <svg width="28" height="24" viewBox="0 0 112 92" className="shrink-0" aria-hidden="true">
                        <path
                          d="M12 16 H100 L94 42 C82 46 72 58 68 78 H44 C40 58 30 46 18 42 Z"
                          fill={cueca.primaryColor}
                          stroke={cueca.secondaryColor}
                          strokeWidth="7"
                          strokeLinejoin="round"
                        />
                        <rect x="11" y="14" width="90" height="14" rx="4" fill={cueca.secondaryColor} />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          {!unlocked && <Lock className="h-3 w-3 shrink-0 text-[#94a3b8]" />}
                          <span className="text-[11px] font-bold text-[#fff8f0] truncate">
                            {cueca.name}
                          </span>
                        </div>
                        <div className="text-[10px] truncate text-[#94a3b8]">
                          {equipped
                            ? 'Equipada'
                            : unlocked
                              ? 'Toque para equipar'
                              : cueca.unlockHint}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Primary Play CTA */}
        <button
          type="button"
          onClick={onStart}
          className="mt-4 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#facc15] px-6 py-3 font-display text-lg font-bold text-[#1e1b2e] hover:bg-[#fde047] active:scale-[0.98] transition-transform shadow-lg"
        >
          <Play className="h-5 w-5 fill-current" />
          Jogar Agora
        </button>

        <p className="mt-2.5 text-center text-[11px] text-[#94a3b8]">
          WASD Mover · Mouse Mirar · 1-3 Armas · Q/E Ajuste câmera · C Centralizar · Z/X/V/B Emotes
        </p>
      </div>

      <div />
    </div>
  );
};
