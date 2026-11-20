import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { LoadingScreen } from './components/LoadingScreen';
import { MatchModal } from './components/MatchModal';
import { MobileControls } from './components/MobileControls';
import { RepairMinigame } from './components/RepairMinigame';
import { TitleScreen } from './components/TitleScreen';
import { soundEngine } from './game/audio';
import { CuecaGameEngine } from './game/engine';
import {
  isFullscreenActive,
  requestMobileFullscreen,
  supportsFullscreen,
  toggleMobileFullscreen,
} from './utils/fullscreen';
import {
  CHARACTERS,
  CharacterId,
  CUECA_TIERS,
  Difficulty,
  EmoteId,
  GameMode,
  HudSnapshot,
  MapId,
  WeaponSlot,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  mode: 'deathmatch',
  mapId: 'canteiro',
  difficulty: 'normal',
  selectedCharacter: CHARACTERS[0],
  hp: 100,
  maxHp: 100,
  hasCueca: true,
  playerCuecaInPlay: true,
  cuecaDamaged: false,
  cuecaTier: CUECA_TIERS[0],
  nextCuecaTier: CUECA_TIERS[1],
  careerScore: 0,
  score: 0,
  kills: 0,
  deaths: 0,
  headshots: 0,
  weaponSlot: 2,
  ammo: { 1: 12, 2: 30, 3: 2 },
  reloading: false,
  reloadProgress: 0,
  timerSeconds: 150,
  blueScore: 0,
  orangeScore: 0,
  roundNumber: 1,
  roundWinsPlayer: 0,
  roundWinnerText: '',
  aliveCuecasCount: 6,
  airborneCuecasCount: 0,
  totalFightersCount: 6,
  minimapActors: [],
  minimapWalls: [],
  arenaHalfSize: 44,
  killfeed: [],
  repair: {
    active: false,
    timeRemaining: 0,
    totalTime: 3.0,
    sequence: [0, 1, 2],
    progress: 0,
    wrongShake: 0,
  },
  bannerToast: null,
  leaderboard: [],
  hitMarkerTimer: 0,
  hitMarkerHeadshot: false,
  playerAlive: true,
  respawnTimer: 0,
  activeBuffs: {
    speedTimer: 0,
    damageTimer: 0,
    shieldTimer: 0,
    slipTimer: 0,
  },
  killCam: {
    active: false,
    killerName: '',
    killerRole: '',
    killerFaction: 'villains',
    killerCuecaName: '',
    killerCuecaColor: '#ffffff',
    killerCuecaAccent: '#60a5fa',
    weaponName: 'Boing-47',
    headshot: false,
    timeRemaining: 0,
    totalTime: 2.6,
  },
  dailyChallenges: [],
  unlockedExclusiveCuecaIds: [],
  equippedExclusiveCuecaId: null,
  emoteCooldown: 0,
  activeEmote: null,
};

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CuecaGameEngine | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<GameMode>('deathmatch');
  const [selectedMap, setSelectedMap] = useState<MapId>('canteiro');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(CHARACTERS[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canFullscreen = supportsFullscreen();

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(isFullscreenActive());
    };
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(coarse || (hasTouch && window.innerWidth < 1100));
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const engine = new CuecaGameEngine(
      el,
      (snapshot) => setHud(snapshot),
      () => setLoading(false)
    );
    engineRef.current = engine;

    const canvas = el.querySelector('canvas');
    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    canvas?.addEventListener('webglcontextlost', onContextLost);

    return () => {
      canvas?.removeEventListener('webglcontextlost', onContextLost);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSelectMode = useCallback(
    (mode: GameMode) => {
      setSelectedMode(mode);
      engineRef.current?.previewMapOnTitle(selectedMap, mode, selectedCharacter, difficulty);
    },
    [selectedMap, selectedCharacter, difficulty]
  );

  const handleSelectMap = useCallback(
    (mapId: MapId) => {
      setSelectedMap(mapId);
      engineRef.current?.previewMapOnTitle(mapId, selectedMode, selectedCharacter, difficulty);
    },
    [selectedMode, selectedCharacter, difficulty]
  );

  const handleSelectCharacter = useCallback(
    (charId: CharacterId) => {
      setSelectedCharacter(charId);
      engineRef.current?.previewMapOnTitle(selectedMap, selectedMode, charId, difficulty);
    },
    [selectedMap, selectedMode, difficulty]
  );

  const handleSelectDifficulty = useCallback(
    (diff: Difficulty) => {
      setDifficulty(diff);
      engineRef.current?.previewMapOnTitle(selectedMap, selectedMode, selectedCharacter, diff);
    },
    [selectedMap, selectedMode, selectedCharacter]
  );

  const handleToggleFullscreen = useCallback(() => {
    void toggleMobileFullscreen();
  }, []);

  const handleStart = useCallback(() => {
    if (isTouchDevice) {
      void requestMobileFullscreen();
    }
    engineRef.current?.startMatch(selectedMap, selectedMode, selectedCharacter, difficulty);
  }, [isTouchDevice, selectedMap, selectedMode, selectedCharacter, difficulty]);

  const handleEquipCueca = useCallback((cuecaId: string | null) => {
    engineRef.current?.equipExclusiveCueca(cuecaId);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handlePause = useCallback(() => engineRef.current?.pauseGame(), []);
  const handleResume = useCallback(() => {
    if (isTouchDevice) {
      void requestMobileFullscreen();
    }
    engineRef.current?.resumeGame();
  }, [isTouchDevice]);
  const handleMainMenu = useCallback(() => engineRef.current?.returnToTitle(), []);
  const handleSwitchWeapon = useCallback(
    (slot: WeaponSlot) => engineRef.current?.switchWeapon(slot),
    []
  );
  const handleReload = useCallback(() => engineRef.current?.triggerReload(), []);
  const handleJump = useCallback(() => engineRef.current?.triggerJump(), []);
  const handleMobileMove = useCallback(
    (x: number, y: number) => engineRef.current?.setMobileMove(x, y),
    []
  );
  const handleMobileAim = useCallback(
    (dx: number, dy: number) => engineRef.current?.setMobileAim(dx, dy),
    []
  );
  const handleMobileFire = useCallback(
    (held: boolean) => engineRef.current?.setMobileFire(held),
    []
  );
  const handleRepairNode = useCallback(
    (idx: number) => engineRef.current?.submitRepairNode(idx),
    []
  );
  const handleSkipKillCam = useCallback(() => engineRef.current?.skipKillCam(), []);
  const handleTriggerEmote = useCallback(
    (emote: EmoteId) => engineRef.current?.triggerEmote(emote),
    []
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1e1b2e]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={containerRef} className="fixed inset-0 h-full w-full" />

      <LoadingScreen visible={loading} />

      {!loading && hud.phase === 'title' && (
        <TitleScreen
          mode={selectedMode}
          mapId={selectedMap}
          characterId={selectedCharacter}
          difficulty={difficulty}
          muted={muted}
          canFullscreen={canFullscreen}
          isFullscreen={isFullscreen}
          currentTier={hud.cuecaTier}
          nextTier={hud.nextCuecaTier}
          careerScore={hud.careerScore}
          dailyChallenges={hud.dailyChallenges}
          unlockedExclusiveCuecaIds={hud.unlockedExclusiveCuecaIds}
          equippedExclusiveCuecaId={hud.equippedExclusiveCuecaId}
          onSelectMode={handleSelectMode}
          onSelectMap={handleSelectMap}
          onSelectCharacter={handleSelectCharacter}
          onSelectDifficulty={handleSelectDifficulty}
          onEquipCueca={handleEquipCueca}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onStart={handleStart}
        />
      )}

      {!loading && hud.phase !== 'title' && (
        <>
          <GameHUD
            hud={hud}
            muted={muted}
            isTouchDevice={isTouchDevice}
            canFullscreen={canFullscreen}
            isFullscreen={isFullscreen}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={handleToggleFullscreen}
            onPause={handlePause}
            onSwitchWeapon={handleSwitchWeapon}
            onReload={handleReload}
            onSkipKillCam={handleSkipKillCam}
            onTriggerEmote={handleTriggerEmote}
          />

          <RepairMinigame
            repair={hud.repair}
            isTouchDevice={isTouchDevice}
            onSubmitNode={handleRepairNode}
          />

          <MobileControls
            visible={isTouchDevice && hud.phase === 'playing' && hud.playerAlive}
            hud={hud}
            canFullscreen={canFullscreen}
            isFullscreen={isFullscreen}
            onMove={handleMobileMove}
            onAim={handleMobileAim}
            onFire={handleMobileFire}
            onJump={handleJump}
            onSwitchWeapon={handleSwitchWeapon}
            onReload={handleReload}
            onTriggerEmote={handleTriggerEmote}
            onToggleFullscreen={handleToggleFullscreen}
          />

          <MatchModal
            hud={hud}
            onResume={handleResume}
            onRestart={handleStart}
            onMainMenu={handleMainMenu}
          />
        </>
      )}
    </div>
  );
}
