import { CuecaTier } from './types';

const DAILY_STORAGE_KEY = 'cueca_strike_daily_v1';
const EQUIPPED_CUECA_KEY = 'cueca_strike_equipped_cueca_v1';

export type ChallengeMetric =
  | 'pistol_headshots'
  | 'rifle_kills'
  | 'grenade_hits'
  | 'total_headshots'
  | 'repair_success'
  | 'bonus_pickups'
  | 'trampoline_bounces';

export interface ExclusiveCuecaDef extends CuecaTier {
  id: string;
  unlockHint: string;
}

export const EXCLUSIVE_CUECAS: ExclusiveCuecaDef[] = [
  {
    id: 'melancia-turbo',
    level: 101,
    name: 'Melancia Turbinada',
    rarity: 'Exclusiva',
    minScore: 0,
    primaryColor: '#fb7185',
    secondaryColor: '#16a34a',
    accentColor: '#1e1b2e',
    pattern: 'watermelon',
    unlockHint: 'Acertar 5 cabeças com a pistola',
  },
  {
    id: 'tigre-dourado',
    level: 102,
    name: 'Tigre Selvagem',
    rarity: 'Exclusiva',
    minScore: 0,
    primaryColor: '#fb923c',
    secondaryColor: '#1e1b2e',
    accentColor: '#facc15',
    pattern: 'tiger',
    unlockHint: 'Eliminar 8 inimigos com o rifle',
  },
  {
    id: 'pizza-calabresa',
    level: 103,
    name: 'Pizza Calabresa',
    rarity: 'Exclusiva',
    minScore: 0,
    primaryColor: '#fde047',
    secondaryColor: '#d97706',
    accentColor: '#ef4444',
    pattern: 'pizza',
    unlockHint: 'Acertar 4 inimigos com granadas',
  },
  {
    id: 'cyber-arco-iris',
    level: 104,
    name: 'Arco-Íris Neon',
    rarity: 'Exclusiva',
    minScore: 0,
    primaryColor: '#f43f5e',
    secondaryColor: '#22d3ee',
    accentColor: '#facc15',
    emissiveHex: 0x22d3ee,
    pattern: 'rainbow',
    unlockHint: 'Fazer 7 headshots no total',
  },
  {
    id: 'vaca-malhada',
    level: 105,
    name: 'Vaquinha Malhada',
    rarity: 'Exclusiva',
    minScore: 0,
    primaryColor: '#ffffff',
    secondaryColor: '#f472b6',
    accentColor: '#1e293b',
    pattern: 'cow',
    unlockHint: 'Costurar a cueca ou usar trampolins',
  },
];

export interface DailyChallengeTemplate {
  id: string;
  metric: ChallengeMetric;
  title: string;
  description: string;
  target: number;
  rewardCuecaId: string;
  bonusPoints: number;
}

const CHALLENGE_POOL: DailyChallengeTemplate[] = [
  {
    id: 'daily-pistol-hs',
    metric: 'pistol_headshots',
    title: 'Pistoleiro de Cabeçudos',
    description: 'Acertar 5 cabeças com a pistola',
    target: 5,
    rewardCuecaId: 'melancia-turbo',
    bonusPoints: 150,
  },
  {
    id: 'daily-rifle-kills',
    metric: 'rifle_kills',
    title: 'Rajada Elástica',
    description: 'Eliminar 8 inimigos com o rifle Boing-47',
    target: 8,
    rewardCuecaId: 'tigre-dourado',
    bonusPoints: 160,
  },
  {
    id: 'daily-grenade-hits',
    metric: 'grenade_hits',
    title: 'Chuva de Borracha',
    description: 'Acertar 4 inimigos com granadas elásticas',
    target: 4,
    rewardCuecaId: 'pizza-calabresa',
    bonusPoints: 150,
  },
  {
    id: 'daily-any-hs',
    metric: 'total_headshots',
    title: 'Arranca-Cuecas Supremo',
    description: 'Fazer 7 headshots com qualquer arma',
    target: 7,
    rewardCuecaId: 'cyber-arco-iris',
    bonusPoints: 200,
  },
  {
    id: 'daily-repair',
    metric: 'repair_success',
    title: 'Costureiro Veloz',
    description: 'Costurar sua cueca 2 vezes no minigame',
    target: 2,
    rewardCuecaId: 'vaca-malhada',
    bonusPoints: 150,
  },
  {
    id: 'daily-bonuses',
    metric: 'bonus_pickups',
    title: 'Caçador de Bônus',
    description: 'Coletar 5 objetos de bônus no mapa',
    target: 5,
    rewardCuecaId: 'pizza-calabresa',
    bonusPoints: 130,
  },
  {
    id: 'daily-trampolines',
    metric: 'trampoline_bounces',
    title: 'Acrobata do Piso',
    description: 'Saltar 5 vezes nos trampolins ocultos',
    target: 5,
    rewardCuecaId: 'vaca-malhada',
    bonusPoints: 130,
  },
];

export interface DailyChallengeProgress {
  template: DailyChallengeTemplate;
  rewardCueca: ExclusiveCuecaDef;
  progress: number;
  completed: boolean;
}

interface StoredDailyState {
  dateKey: string;
  challengeIds: string[];
  progressById: Record<string, number>;
  completedById: Record<string, boolean>;
  unlockedCuecaIds: string[];
}

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pickDailyChallengeIds(dateKey: string): string[] {
  // Always include the signature pistol headshots challenge as #1, plus 2 deterministic rotating challenges
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const rest = CHALLENGE_POOL.slice(1);
  const idxA = hash % rest.length;
  const idxB = (idxA + 1 + ((hash >> 3) % (rest.length - 1))) % rest.length;
  return [CHALLENGE_POOL[0].id, rest[idxA].id, rest[idxB].id];
}

export class DailyChallengeManager {
  private state: StoredDailyState;
  private equippedExclusiveId: string | null;

  constructor() {
    this.state = this.loadState();
    this.equippedExclusiveId = this.loadEquippedCuecaId();
  }

  private loadState(): StoredDailyState {
    const today = getTodayDateKey();
    let unlockedCuecaIds: string[] = [];

    try {
      const raw = localStorage.getItem(DAILY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDailyState;
        if (Array.isArray(parsed.unlockedCuecaIds)) {
          unlockedCuecaIds = parsed.unlockedCuecaIds;
        }
        if (parsed.dateKey === today && Array.isArray(parsed.challengeIds) && parsed.challengeIds.length === 3) {
          return {
            dateKey: today,
            challengeIds: parsed.challengeIds,
            progressById: parsed.progressById ?? {},
            completedById: parsed.completedById ?? {},
            unlockedCuecaIds,
          };
        }
      }
    } catch {
      // ignore malformed storage
    }

    const fresh: StoredDailyState = {
      dateKey: today,
      challengeIds: pickDailyChallengeIds(today),
      progressById: {},
      completedById: {},
      unlockedCuecaIds,
    };
    this.saveState(fresh);
    return fresh;
  }

  private saveState(state = this.state): void {
    try {
      localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }

  private loadEquippedCuecaId(): string | null {
    try {
      const val = localStorage.getItem(EQUIPPED_CUECA_KEY);
      if (val && this.state.unlockedCuecaIds.includes(val)) {
        return val;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public getChallenges(): DailyChallengeProgress[] {
    return this.state.challengeIds
      .map((id) => CHALLENGE_POOL.find((c) => c.id === id) ?? CHALLENGE_POOL[0])
      .map((template) => {
        const rewardCueca =
          EXCLUSIVE_CUECAS.find((c) => c.id === template.rewardCuecaId) ?? EXCLUSIVE_CUECAS[0];
        const progress = Math.min(
          template.target,
          this.state.progressById[template.id] ?? 0
        );
        const completed = Boolean(this.state.completedById[template.id]);
        return { template, rewardCueca, progress, completed };
      });
  }

  public getUnlockedCuecaIds(): string[] {
    return [...this.state.unlockedCuecaIds];
  }

  public getEquippedCueca(): ExclusiveCuecaDef | null {
    if (!this.equippedExclusiveId) return null;
    if (!this.state.unlockedCuecaIds.includes(this.equippedExclusiveId)) return null;
    return EXCLUSIVE_CUECAS.find((c) => c.id === this.equippedExclusiveId) ?? null;
  }

  public getEquippedCuecaId(): string | null {
    return this.getEquippedCueca()?.id ?? null;
  }

  public setEquippedCuecaId(cuecaId: string | null): void {
    if (cuecaId && !this.state.unlockedCuecaIds.includes(cuecaId)) return;
    this.equippedExclusiveId = cuecaId;
    try {
      if (cuecaId) localStorage.setItem(EQUIPPED_CUECA_KEY, cuecaId);
      else localStorage.removeItem(EQUIPPED_CUECA_KEY);
    } catch {
      // ignore
    }
  }

  public recordMetric(
    metric: ChallengeMetric,
    amount = 1
  ): Array<{ challenge: DailyChallengeTemplate; rewardCueca: ExclusiveCuecaDef }> {
    const today = getTodayDateKey();
    if (this.state.dateKey !== today) {
      this.state = this.loadState();
    }

    const newlyCompleted: Array<{
      challenge: DailyChallengeTemplate;
      rewardCueca: ExclusiveCuecaDef;
    }> = [];

    let changed = false;
    for (const id of this.state.challengeIds) {
      const tpl = CHALLENGE_POOL.find((c) => c.id === id);
      if (!tpl || tpl.metric !== metric) continue;
      if (this.state.completedById[id]) continue;

      const nextVal = Math.min(tpl.target, (this.state.progressById[id] ?? 0) + amount);
      if (nextVal !== (this.state.progressById[id] ?? 0)) {
        this.state.progressById[id] = nextVal;
        changed = true;
      }

      if (nextVal >= tpl.target) {
        this.state.completedById[id] = true;
        if (!this.state.unlockedCuecaIds.includes(tpl.rewardCuecaId)) {
          this.state.unlockedCuecaIds.push(tpl.rewardCuecaId);
        }
        // Auto-equip newly unlocked exclusive cueca so player sees it immediately!
        this.equippedExclusiveId = tpl.rewardCuecaId;
        try {
          localStorage.setItem(EQUIPPED_CUECA_KEY, tpl.rewardCuecaId);
        } catch {
          // ignore
        }
        const rewardCueca =
          EXCLUSIVE_CUECAS.find((c) => c.id === tpl.rewardCuecaId) ?? EXCLUSIVE_CUECAS[0];
        newlyCompleted.push({ challenge: tpl, rewardCueca });
        changed = true;
      }
    }

    if (changed) {
      this.saveState();
    }
    return newlyCompleted;
  }
}
