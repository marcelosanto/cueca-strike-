import React from 'react';
import { RepairMinigameState } from '../game/types';

interface RepairMinigameProps {
  repair: RepairMinigameState;
  isTouchDevice: boolean;
  onSubmitNode: (nodeIndex: number) => void;
}

const NODES = [
  { id: 0, keyLabel: 'Q', name: 'Azul', color: '#38bdf8', symbol: '✦' },
  { id: 1, keyLabel: 'E', name: 'Rosa', color: '#fb7185', symbol: '★' },
  { id: 2, keyLabel: 'F', name: 'Ouro', color: '#facc15', symbol: '◆' },
];

export const RepairMinigame: React.FC<RepairMinigameProps> = ({
  repair,
  isTouchDevice,
  onSubmitNode,
}) => {
  if (!repair.active) return null;

  const pct = Math.max(0, Math.min(100, (repair.timeRemaining / repair.totalTime) * 100));

  return (
    <div
      className={`fixed left-1/2 top-16 sm:top-20 z-30 -translate-x-1/2 pointer-events-auto w-[min(360px,90vw)] rounded-2xl bg-[#1e1b2e]/95 border-2 border-[#facc15] p-3.5 shadow-2xl transition-transform ${
        repair.wrongShake > 0 ? 'translate-x-[calc(-50%+6px)]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            🧵
          </span>
          <span className="font-display text-sm sm:text-base font-bold text-[#fff8f0]">
            Costurar Cueca!
          </span>
        </div>
        <span className="font-mono-num text-sm font-bold text-[#facc15]">
          {repair.timeRemaining.toFixed(1)}s
        </span>
      </div>

      {/* Countdown progress bar */}
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-[#facc15] transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Target 3-stitch pattern sequence */}
      <div className="mt-2.5 flex items-center justify-center gap-2">
        {repair.sequence.map((nodeIdx, stepIdx) => {
          const node = NODES[nodeIdx];
          const done = stepIdx < repair.progress;
          const active = stepIdx === repair.progress;
          return (
            <div
              key={`${stepIdx}-${nodeIdx}`}
              className={`flex h-9 w-12 items-center justify-center rounded-lg border-2 font-display text-sm font-bold transition-transform ${
                done
                  ? 'border-[#22c55e] bg-[#22c55e]/25 text-[#86efac] scale-95'
                  : active
                    ? 'border-white bg-white/15 text-white scale-105'
                    : 'border-white/20 bg-white/5 text-white/50'
              }`}
            >
              <span style={{ color: done ? '#86efac' : node.color }}>
                {done ? '✓' : node.symbol}
              </span>
              {!isTouchDevice && !done && (
                <span className="ml-1 font-mono-num text-[11px]">{node.keyLabel}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tactile >=48px stitch buttons (works on both mobile touch & desktop click) */}
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {NODES.map((node) => {
          const expected = repair.sequence[repair.progress] === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onSubmitNode(node.id);
              }}
              className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl border-2 font-display font-bold active:scale-95 transition-transform ${
                expected
                  ? 'border-white bg-[#2c2644] text-white shadow-md'
                  : 'border-white/15 bg-[#151221] text-white/75'
              }`}
            >
              <span className="text-lg leading-none" style={{ color: node.color }}>
                {node.symbol}
              </span>
              <span className="mt-0.5 text-[11px]">
                {isTouchDevice ? node.name : `${node.keyLabel} · ${node.name}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
