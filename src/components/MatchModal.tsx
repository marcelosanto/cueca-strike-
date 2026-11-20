import React from 'react';
import { RotateCcw, Home, Play } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface MatchModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const MatchModal: React.FC<MatchModalProps> = ({
  hud,
  onResume,
  onRestart,
  onMainMenu,
}) => {
  if (hud.phase !== 'paused' && hud.phase !== 'match-over') return null;

  const isPaused = hud.phase === 'paused';
  const topWinner = hud.leaderboard[0];
  const playerWon =
    hud.mode === 'tdm'
      ? hud.blueScore >= hud.orangeScore
      : hud.mode === 'cueca-king'
        ? hud.roundWinsPlayer >= 2
        : topWinner?.isPlayer;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#13111c]/82 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#1e1b2e] border border-white/15 p-5 sm:p-6 shadow-2xl text-[#fff8f0]">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-center">
          {isPaused
            ? 'Jogo Pausado'
            : playerWon
              ? 'Rei das Cuecas!'
              : 'Fim de Partida!'}
        </h2>
        <p className="mt-1 text-center text-xs sm:text-sm text-[#cbd5e1]">
          {isPaused
            ? 'Respire fundo e ajeite o elástico.'
            : `Cueca final: ${hud.cuecaTier.name} · ${hud.headshots} headshots`}
        </p>

        {/* Scoreboard */}
        <div className="mt-4 rounded-xl bg-[#13111c] p-3">
          <div className="grid grid-cols-12 text-[11px] font-semibold text-[#94a3b8] pb-1.5 border-b border-white/10">
            <span className="col-span-5">Lutador</span>
            <span className="col-span-3 text-center">Cueca</span>
            <span className="col-span-2 text-right">Abates</span>
            <span className="col-span-2 text-right">Pts</span>
          </div>
          <div className="divide-y divide-white/5">
            {hud.leaderboard.map((row) => (
              <div
                key={row.id}
                className={`grid grid-cols-12 items-center py-1.5 text-xs ${
                  row.isPlayer ? 'text-[#facc15] font-bold' : 'text-[#e2e8f0]'
                }`}
              >
                <span className="col-span-5 truncate">{row.name}</span>
                <span className="col-span-3 text-center text-[11px] truncate">
                  {row.tier.name.split(' ')[0]}
                </span>
                <span className="col-span-2 text-right font-mono-num">{row.kills}</span>
                <span className="col-span-2 text-right font-mono-num">{row.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2.5">
          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#facc15] font-display text-base font-bold text-[#1e1b2e] hover:bg-[#fde047]"
            >
              <Play className="h-4 w-4 fill-current" />
              Continuar
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onRestart}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#38bdf8] font-display text-sm font-bold text-[#0f172a] hover:bg-[#7dd3fc]"
            >
              <RotateCcw className="h-4 w-4" />
              Jogar de Novo
            </button>
            <button
              type="button"
              onClick={onMainMenu}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white/10 font-display text-sm font-bold text-[#fff8f0] hover:bg-white/20"
            >
              <Home className="h-4 w-4" />
              Menu Inicial
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
