export type GameMode = 'deathmatch' | 'tdm' | 'cueca-king';
export type MapId = 'canteiro' | 'mercado' | 'base';
export type WeaponSlot = 1 | 2 | 3;
export type TeamId = 'blue' | 'orange' | 'none';
export type Difficulty = 'easy' | 'normal';
export type Faction = 'heroes' | 'villains';
export type EmoteId = 'thumbs-up' | 'cueca' | 'gg' | 'laugh';

export const EMOTES: Array<{ id: EmoteId; label: string; key: string; color: string }> = [
  { id: 'thumbs-up', label: 'Joinha', key: 'Z', color: '#facc15' },
  { id: 'cueca', label: 'Cueca!', key: 'X', color: '#38bdf8' },
  { id: 'gg', label: 'GG!', key: 'V', color: '#22c55e' },
  { id: 'laugh', label: 'Haha!', key: 'B', color: '#fb7185' },
];

export type CharacterId =
  | 'capitao-elastico'
  | 'relampago-cueca'
  | 'bombeiro-tanga'
  | 'samba-ninja'
  | 'doutor-careca'
  | 'barao-fedido'
  | 'meia-noite-cyborg'
  | 'rei-banana';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  faction: Faction;
  role: string;
  perkLabel: string;
  suitColor: number;
  vestColor: number;
  accentColor: string;
  skinTone: number;
  accessory:
  | 'cape-hero'
  | 'speed-visor'
  | 'fire-tank'
  | 'ninja-band'
  | 'mad-goggles'
  | 'devil-horns'
  | 'cyber-eye'
  | 'banana-king';
  stats: {
    maxHpBonus: number;
    speedMult: number;
    reloadMult: number;
    fireRateMult: number;
    headshotMultBonus: number;
    extraGrenade: number;
    slipResist: boolean;
  };
}

export const CHARACTERS: CharacterDef[] = [
  // 4 HEROES
  {
    id: 'capitao-elastico',
    name: 'Capitão Elástico',
    faction: 'heroes',
    role: 'Tanque Heroico',
    perkLabel: '+15 HP máx',
    suitColor: 0x2563eb,
    vestColor: 0x1e3a8a,
    accentColor: '#38bdf8',
    skinTone: 0xffd6b8,
    accessory: 'cape-hero',
    stats: {
      maxHpBonus: 15,
      speedMult: 1,
      reloadMult: 1,
      fireRateMult: 1,
      headshotMultBonus: 0,
      extraGrenade: 0,
      slipResist: false,
    },
  },
  {
    id: 'relampago-cueca',
    name: 'Relâmpago Cueca',
    faction: 'heroes',
    role: 'Velocista',
    perkLabel: '+10% velocidade',
    suitColor: 0x06b6d4,
    vestColor: 0x0e7490,
    accentColor: '#22d3ee',
    skinTone: 0xf7c19b,
    accessory: 'speed-visor',
    stats: {
      maxHpBonus: 0,
      speedMult: 1.1,
      reloadMult: 1,
      fireRateMult: 1,
      headshotMultBonus: 0,
      extraGrenade: 0,
      slipResist: false,
    },
  },
  {
    id: 'bombeiro-tanga',
    name: 'Bombeiro Tanga',
    faction: 'heroes',
    role: 'Demolição',
    perkLabel: '+1 Granada extra',
    suitColor: 0xef4444,
    vestColor: 0x991b1b,
    accentColor: '#facc15',
    skinTone: 0xe8a87c,
    accessory: 'fire-tank',
    stats: {
      maxHpBonus: 0,
      speedMult: 1,
      reloadMult: 1,
      fireRateMult: 1,
      headshotMultBonus: 0,
      extraGrenade: 1,
      slipResist: false,
    },
  },
  {
    id: 'samba-ninja',
    name: 'Samba Ninja',
    faction: 'heroes',
    role: 'Ágil',
    perkLabel: 'Recarga 20% rápida',
    suitColor: 0x10b981,
    vestColor: 0x065f46,
    accentColor: '#34d399',
    skinTone: 0xc6865c,
    accessory: 'ninja-band',
    stats: {
      maxHpBonus: 0,
      speedMult: 1.04,
      reloadMult: 0.8,
      fireRateMult: 1,
      headshotMultBonus: 0,
      extraGrenade: 0,
      slipResist: false,
    },
  },
  // 4 VILLAINS
  {
    id: 'doutor-careca',
    name: 'Doutor Careca',
    faction: 'villains',
    role: 'Atirador Maluco',
    perkLabel: '+15% dano headshot',
    suitColor: 0x7c3aed,
    vestColor: 0x4c1d95,
    accentColor: '#c084fc',
    skinTone: 0xffe0cc,
    accessory: 'mad-goggles',
    stats: {
      maxHpBonus: 0,
      speedMult: 1,
      reloadMult: 1,
      fireRateMult: 1,
      headshotMultBonus: 0.15,
      extraGrenade: 0,
      slipResist: false,
    },
  },
  {
    id: 'barao-fedido',
    name: 'Barão Fedido',
    faction: 'villains',
    role: 'Brutamontes',
    perkLabel: '+15 HP máx',
    suitColor: 0xbe123c,
    vestColor: 0x881337,
    accentColor: '#fb7185',
    skinTone: 0xf7c19b,
    accessory: 'devil-horns',
    stats: {
      maxHpBonus: 15,
      speedMult: 1,
      reloadMult: 1,
      fireRateMult: 1,
      headshotMultBonus: 0,
      extraGrenade: 0,
      slipResist: false,
    },
  },
  {
    id: 'meia-noite-cyborg',
    name: 'Cyborg Sunga',
    faction: 'villains',
    role: 'Cadência Alta',
    perkLabel: '+12% cadência de tiro',
    suitColor: 0x475569,
    vestColor: 0x1e293b,
    accentColor: '#f43f5e',
    skinTone: 0xe8a87c,
    accessory: 'cyber-eye',
    stats: {
      maxHpBonus: 0,
      speedMult: 1,
      reloadMult: 1,
      fireRateMult: 1.12,
      headshotMultBonus: 0,
      extraGrenade: 0,
      slipResist: false,
    },
  },
  {
    id: 'rei-banana',
    name: 'Rei Banana',
    faction: 'villains',
    role: 'Malandro',
    perkLabel: 'Não escorrega + vel.',
    suitColor: 0xeab308,
    vestColor: 0x854d0e,
    accentColor: '#fef08a',
    skinTone: 0xffd6b8,
    accessory: 'banana-king',
    stats: {
      maxHpBonus: 0,
      speedMult: 1.07,
      reloadMult: 1,
      fireRateMult: 1,
      headshotMultBonus: 0,
      extraGrenade: 0,
      slipResist: true,
    },
  },
];

export function getCharacterById(id: CharacterId): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export type HazardType = 'banana' | 'trampoline';

export interface MapHazardDef {
  x: number;
  z: number;
  type: HazardType;
}

export type BonusType = 'heal' | 'speed' | 'damage' | 'shield';

export interface MapBonusSpawn {
  x: number;
  z: number;
  type: BonusType;
}

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
  pattern:
  | 'classic'
  | 'striped'
  | 'tropical'
  | 'neon'
  | 'cosmic'
  | 'royal'
  | 'watermelon'
  | 'tiger'
  | 'pizza'
  | 'rainbow'
  | 'cow';
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

export interface ActiveBuffsSnapshot {
  speedTimer: number;
  damageTimer: number;
  shieldTimer: number;
  slipTimer: number;
}

export interface KillCamSnapshot {
  active: boolean;
  killerName: string;
  killerRole: string;
  killerFaction: Faction;
  killerCuecaName: string;
  killerCuecaColor: string;
  killerCuecaAccent: string;
  weaponName: string;
  headshot: boolean;
  timeRemaining: number;
  totalTime: number;
}

export interface HudSnapshot {
  phase: 'title' | 'playing' | 'paused' | 'round-over' | 'match-over';
  mode: GameMode;
  mapId: MapId;
  difficulty: Difficulty;
  selectedCharacter: CharacterDef;
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
  activeBuffs: ActiveBuffsSnapshot;
  killCam: KillCamSnapshot;
  emoteCooldown: number;
  activeEmote: EmoteId | null;
  dailyChallenges: Array<{
    id: string;
    title: string;
    description: string;
    progress: number;
    target: number;
    completed: boolean;
    rewardCuecaId: string;
    rewardCuecaName: string;
    rewardCuecaColor: string;
    rewardCuecaAccent: string;
  }>;
  unlockedExclusiveCuecaIds: string[];
  equippedExclusiveCuecaId: string | null;
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
