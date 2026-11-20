export type GameMode = 'deathmatch' | 'tdm' | 'cueca-king';
export type MapId = 'canteiro' | 'mercado' | 'base';
export type WeaponSlot = 1 | 2 | 3;
export type TeamId = 'blue' | 'orange' | 'none';

export interface CuecaTier {
  level: number;
  name: string;
  rarity: string;
  minScore: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  emissiveHex?: number;
  hasCrown?: boolean;
  pattern: 'classic' | 'striped' | 'tropical' | 'neon' | 'cosmic' | 'royal';
}

export const CUECA_TIERS: CuecaTier[] = [
  {
    level: 1,
    name: 'Algodão Simples',
    rarity: 'Comum',
    minScore: 0,
    primaryColor: '#ffffff',
    secondaryColor: '#60a5fa',
    accentColor: '#dbeafe',
    pattern: 'classic',
  },
  {
    level: 2,
    name: 'Listrada Náutica',
    rarity: 'Incomum',
    minScore: 100,
    primaryColor: '#fff1f2',
    secondaryColor: '#fb7185',
    accentColor: '#0ea5e9',
    pattern: 'striped',
  },
  {
    level: 3,
    name: 'Salada de Frutas',
    rarity: 'Rara',
    minScore: 250,
    primaryColor: '#fef08a',
    secondaryColor: '#22c55e',
    accentColor: '#ef4444',
    pattern: 'tropical',
  },
  {
    level: 4,
    name: 'Neon Synthwave',
    rarity: 'Épica',
    minScore: 450,
    primaryColor: '#2e1065',
    secondaryColor: '#f43f5e',
    accentColor: '#22d3ee',
    emissiveHex: 0x22d3ee,
    pattern: 'neon',
  },
  {
    level: 5,
    name: 'Galáxia Cósmica',
    rarity: 'Lendária',
    minScore: 700,
    primaryColor: '#1e1b4b',
    secondaryColor: '#a855f7',
    accentColor: '#fde047',
    emissiveHex: 0xa855f7,
    pattern: 'cosmic',
  },
  {
    level: 6,
    name: 'Coroa Dourada',
    rarity: 'Mítica',
    minScore: 1000,
    primaryColor: '#facc15',
    secondaryColor: '#b45309',
    accentColor: '#fef9c3',
    emissiveHex: 0xfacc15,
    hasCrown: true,
    pattern: 'royal',
  },
];

export interface WeaponDef {
  slot: WeaponSlot;
  id: 'pistol' | 'rifle' | 'grenade';
  name: string;
  shortName: string;
  damage: number;
  headshotMult: number;
  fireRate: number;
  magSize: number;
  reloadTime: number;
  spread: number;
  projectileSpeed: number;
  range: number;
  automatic: boolean;
  color: string;
}

export const WEAPONS: Record<WeaponSlot, WeaponDef> = {
  1: {
    slot: 1,
    id: 'pistol',
    name: 'Puff-9 Tática',
    shortName: 'Pistola',
    damage: 24,
    headshotMult: 2.3,
    fireRate: 4.5,
    magSize: 12,
    reloadTime: 1.15,
    spread: 0.025,
    projectileSpeed: 48,
    range: 34,
    automatic: false,
    color: '#38bdf8',
  },
  2: {
    slot: 2,
    id: 'rifle',
    name: 'Boing-47',
    shortName: 'Rifle',
    damage: 18,
    headshotMult: 2.1,
    fireRate: 8.5,
    magSize: 30,
    reloadTime: 1.75,
    spread: 0.055,
    projectileSpeed: 54,
    range: 38,
    automatic: true,
    color: '#fb923c',
  },
  3: {
    slot: 3,
    id: 'grenade',
    name: 'Granada Elástica',
    shortName: 'Granada',
    damage: 78,
    headshotMult: 1.4,
    fireRate: 0.9,
    magSize: 2,
    reloadTime: 2.6,
    spread: 0.01,
    projectileSpeed: 20,
    range: 24,
    automatic: false,
    color: '#f43f5e',
  },
};

export interface MapObstacle {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind: 'crate' | 'barrier' | 'pipe' | 'awning' | 'bunker' | 'fountain' | 'wall';
  color?: string;
}

export interface MinimapActor {
  id: string;
  x: number;
  z: number;
  team: TeamId;
  isPlayer: boolean;
  hasCueca: boolean;
  alive: boolean;
}

export interface KillFeedEntry {
  id: number;
  killerName: string;
  victimName: string;
  weaponId: 'pistol' | 'rifle' | 'grenade';
  headshot: boolean;
  cuecaColor: string;
  timestamp: number;
}

export interface RepairMinigameState {
  active: boolean;
  timeRemaining: number;
  totalTime: number;
  sequence: number[];
  progress: number;
  wrongShake: number;
}

export interface ScoreEntry {
  id: string;
  name: string;
  team: TeamId;
  kills: number;
  deaths: number;
  headshots: number;
  score: number;
  tier: CuecaTier;
  hasCueca: boolean;
  isPlayer: boolean;
}

export interface HudSnapshot {
  phase: 'title' | 'playing' | 'paused' | 'round-over' | 'match-over';
  mode: GameMode;
  mapId: MapId;
  hp: number;
  maxHp: number;
  hasCueca: boolean;
  playerCuecaInPlay: boolean;
  cuecaDamaged: boolean;
  cuecaTier: CuecaTier;
  nextCuecaTier: CuecaTier | null;
  careerScore: number;
  score: number;
  kills: number;
  deaths: number;
  headshots: number;
  weaponSlot: WeaponSlot;
  ammo: Record<WeaponSlot, number>;
  reloading: boolean;
  reloadProgress: number;
  timerSeconds: number;
  blueScore: number;
  orangeScore: number;
  roundNumber: number;
  roundWinsPlayer: number;
  roundWinnerText: string;
  aliveCuecasCount: number;
  airborneCuecasCount: number;
  totalFightersCount: number;
  minimapActors: MinimapActor[];
  minimapWalls: Array<{ x: number; z: number; w: number; d: number }>;
  arenaHalfSize: number;
  killfeed: KillFeedEntry[];
  repair: RepairMinigameState;
  bannerToast: { text: string; tone: 'gold' | 'pink' | 'mint' } | null;
  leaderboard: ScoreEntry[];
  hitMarkerTimer: number;
  hitMarkerHeadshot: boolean;
  playerAlive: boolean;
  respawnTimer: number;
}

export function getCuecaTierForScore(score: number): CuecaTier {
  let current = CUECA_TIERS[0];
  for (const tier of CUECA_TIERS) {
    if (score >= tier.minScore) {
      current = tier;
    }
  }
  return current;
}

export function getNextCuecaTier(score: number): CuecaTier | null {
  for (const tier of CUECA_TIERS) {
    if (score < tier.minScore) {
      return tier;
    }
  }
  return null;
}
