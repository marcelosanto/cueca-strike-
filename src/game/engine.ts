import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from './audio';
import {
  CharacterRig,
  createBigHeadCharacter,
  createFlyingCuecaProp,
} from './character';
import { ArenaCollider, buildMapScene, MapBuildResult } from './maps';
import { ChallengeMetric, DailyChallengeManager } from './dailyChallenges';
import {
  BonusType,
  CHARACTERS,
  CharacterDef,
  CharacterId,
  CuecaTier,
  Difficulty,
  EmoteId,
  Faction,
  GameMode,
  getCharacterById,
  getCuecaTierForScore,
  getNextCuecaTier,
  HudSnapshot,
  KillFeedEntry,
  MapId,
  RepairMinigameState,
  ScoreEntry,
  TeamId,
  WEAPONS,
  WeaponSlot,
} from './types';

const CAREER_SCORE_KEY = 'cueca_strike_career_score_v1';

interface Fighter {
  id: string;
  name: string;
  isPlayer: boolean;
  team: TeamId;
  charDef: CharacterDef;
  rig: CharacterRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  hasCueca: boolean;
  cuecaInPlay: boolean;
  cuecaDamaged: boolean;
  cuecaGraceTimer: number;
  score: number;
  kills: number;
  deaths: number;
  headshots: number;
  tier: CuecaTier;
  weaponSlot: WeaponSlot;
  ammo: Record<WeaponSlot, number>;
  reloading: boolean;
  reloadTimer: number;
  fireCooldown: number;
  onGround: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  hitFlashTimer: number;
  walkPhase: number;
  squashY: number;
  // Hazards & Bonus buffs
  slipTimer: number;
  slipVelX: number;
  slipVelZ: number;
  speedBuffTimer: number;
  damageBuffTimer: number;
  shieldBuffTimer: number;
  // Bot AI fields
  aiTargetPos: THREE.Vector3;
  aiThinkTimer: number;
  aiStrafeDir: number;
  aiLastPos: THREE.Vector3;
  aiStuckTimer: number;
  aiState: 'engage' | 'seek_cover' | 'reload_cover' | 'flank';
  aiUnderFireTimer: number;
  aiThreatPos: THREE.Vector3;
  aiHideTimer: number;
  // Emotes & social AI replies
  emoteTimer: number;
  emoteCooldown: number;
  activeEmote: EmoteId | null;
  aiPendingEmote: EmoteId | null;
  aiEmoteReplyTimer: number;
  // Kill cam tracking
  lastAttackerId: string | null;
  lastWeaponId: 'pistol' | 'rifle' | 'grenade';
}

interface Bullet {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ownerId: string;
  ownerTeam: TeamId;
  weaponId: 'pistol' | 'rifle';
  damage: number;
  headshotMult: number;
  life: number;
}

interface Grenade {
  mesh: THREE.Group;
  ringMesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ownerId: string;
  ownerTeam: TeamId;
  damageMult: number;
  fuse: number;
}

interface FlyingCueca {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  ownerId?: string;
  bounces: number;
  gravity: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface BonusPickupInstance {
  type: BonusType;
  x: number;
  z: number;
  group: THREE.Group;
  coreGroup: THREE.Group;
  active: boolean;
  respawnTimer: number;
  disposables: Array<{ dispose: () => void }>;
}

// Reusable math objects (zero GC inside animation loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.25);
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();

function buildBonusPickupProp(
  type: BonusType,
  x: number,
  z: number
): BonusPickupInstance {
  const disposables: Array<{ dispose: () => void }> = [];
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const colorMap: Record<BonusType, number> = {
    heal: 0x22c55e,
    speed: 0x22d3ee,
    damage: 0xf97316,
    shield: 0x818cf8,
  };
  const col = colorMap[type];

  const ringGeo = new THREE.RingGeometry(0.68, 0.86, 20);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: col,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.04;
  group.add(ring);

  const coreGroup = new THREE.Group();
  coreGroup.position.y = 0.85;
  group.add(coreGroup);

  const coreMat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.25,
    roughness: 0.2,
  });

  if (type === 'heal') {
    const boxGeo = new THREE.BoxGeometry(0.68, 0.56, 0.26);
    const crossH = new THREE.BoxGeometry(0.38, 0.12, 0.3);
    const crossV = new THREE.BoxGeometry(0.12, 0.38, 0.3);
    coreGroup.add(
      new THREE.Mesh(boxGeo, coreMat),
      new THREE.Mesh(crossH, accentMat),
      new THREE.Mesh(crossV, accentMat)
    );
    disposables.push(boxGeo, crossH, crossV);
  } else if (type === 'speed') {
    const bolt1Geo = new THREE.ConeGeometry(0.24, 0.56, 6);
    const b1 = new THREE.Mesh(bolt1Geo, coreMat);
    b1.position.y = 0.16;
    b1.rotation.z = -0.35;
    const b2 = new THREE.Mesh(bolt1Geo, accentMat);
    b2.position.y = -0.14;
    b2.rotation.z = Math.PI - 0.35;
    coreGroup.add(b1, b2);
    disposables.push(bolt1Geo);
  } else if (type === 'damage') {
    const octGeo = new THREE.OctahedronGeometry(0.36, 0);
    const haloGeo = new THREE.TorusGeometry(0.46, 0.05, 8, 16);
    const oct = new THREE.Mesh(octGeo, coreMat);
    const halo = new THREE.Mesh(haloGeo, accentMat);
    halo.rotation.x = Math.PI / 3;
    coreGroup.add(oct, halo);
    disposables.push(octGeo, haloGeo);
  } else {
    const shieldGeo = new THREE.CylinderGeometry(0.36, 0.2, 0.56, 6);
    const rimGeo = new THREE.TorusGeometry(0.42, 0.06, 8, 16);
    rimGeo.rotateX(Math.PI / 2);
    coreGroup.add(new THREE.Mesh(shieldGeo, coreMat), new THREE.Mesh(rimGeo, accentMat));
    disposables.push(shieldGeo, rimGeo);
  }

  disposables.push(ringGeo, ringMat, coreMat, accentMat);

  return {
    type,
    x,
    z,
    group,
    coreGroup,
    active: true,
    respawnTimer: 0,
    disposables,
  };
}

export class CuecaGameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;

  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  private mapBuild: MapBuildResult | null = null;
  private currentMapId: MapId = 'canteiro';
  private currentMode: GameMode = 'deathmatch';
  private currentCharacterId: CharacterId = CHARACTERS[0].id;
  private currentDifficulty: Difficulty = 'normal';
  private phase: HudSnapshot['phase'] = 'title';

  private fighters: Fighter[] = [];
  private bullets: Bullet[] = [];
  private grenades: Grenade[] = [];
  private flyingCuecas: FlyingCueca[] = [];
  private particles: Particle[] = [];
  private bonusPickups: BonusPickupInstance[] = [];
  private killfeed: KillFeedEntry[] = [];
  private killfeedSeq = 1;

  private keys = new Set<string>();
  private mouseFireHeld = false;
  private mobileFireHeld = false;
  private pointerNdc = new THREE.Vector2(0, 0.18);
  private hasPointerMoved = false;
  private mouseAimWorld = new THREE.Vector3(0, 1.25, 0);
  private mobileMoveVec = new THREE.Vector2(0, 0);
  private mobileAimVec = new THREE.Vector2(0, 1);
  private usingMobileAim = false;

  // Behind-the-player chase camera heading (yaw camera looks toward)
  private cameraYaw = Math.PI;
  private cameraInitSnap = true;

  private keyLight!: THREE.DirectionalLight;
  private aimRingMesh: THREE.Mesh;
  private aimLineMesh: THREE.Line;
  private aimLineGeo: THREE.BufferGeometry;

  private bulletGeo: THREE.SphereGeometry;
  private particleGeo: THREE.BoxGeometry;

  private hitstopTimer = 0;
  private shakeTrauma = 0;
  private hitMarkerTimer = 0;
  private hitMarkerHeadshot = false;
  private bannerToast: HudSnapshot['bannerToast'] = null;
  private bannerTimer = 0;

  private matchTimer = 150;
  private blueScore = 0;
  private orangeScore = 0;
  private roundNumber = 1;
  private roundWinsPlayer = 0;
  private roundOverTimer = 0;
  private roundWinnerText = '';
  private grenadeRegenTimer = 0;
  private careerScore = (() => {
    try {
      return Number(localStorage.getItem(CAREER_SCORE_KEY) || '0') || 0;
    } catch {
      return 0;
    }
  })();
  private dailyChallenges = new DailyChallengeManager();

  private repair: RepairMinigameState = {
    active: false,
    timeRemaining: 0,
    totalTime: 3.0,
    sequence: [0, 1, 2],
    progress: 0,
    wrongShake: 0,
  };

  private killCam = {
    active: false,
    killerId: '',
    killerName: '',
    killerRole: '',
    killerFaction: 'villains' as Faction,
    killerCuecaName: '',
    killerCuecaColor: '#ffffff',
    killerCuecaAccent: '#60a5fa',
    weaponName: 'Boing-47',
    headshot: false,
    deathPos: new THREE.Vector3(),
    killerPosAtKill: new THREE.Vector3(),
    killerYawAtKill: 0,
    timeRemaining: 0,
    totalTime: 2.6,
    slowMoRemaining: 0,
  };

  private hudAccumulator = 0;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onReady: () => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onReady: () => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onReady = onReady;

    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.maxAnisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();

    const aspect = Math.max(0.5, container.clientWidth / Math.max(1, container.clientHeight));
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.4, 240);
    this.camera.position.set(0, 5.4, 46);
    this.camera.lookAt(0, 1.35, 30);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xfff1dc, 0x6b4c3b, 0.85);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4d6, 1.55);
    keyLight.position.set(18, 28, 12);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -26;
    keyLight.shadow.camera.right = 26;
    keyLight.shadow.camera.top = 26;
    keyLight.shadow.camera.bottom = -26;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 72;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);
    this.scene.add(keyLight.target);
    this.keyLight = keyLight;

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    rimLight.position.set(-18, 12, -16);
    this.scene.add(rimLight);

    const ringGeo = new THREE.RingGeometry(0.32, 0.45, 20);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.aimRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.aimRingMesh.position.y = 0.06;
    this.scene.add(this.aimRingMesh);

    this.aimLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.4,
    });
    this.aimLineMesh = new THREE.Line(this.aimLineGeo, lineMat);
    this.scene.add(this.aimLineMesh);

    this.bulletGeo = new THREE.SphereGeometry(0.14, 8, 8);
    this.particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);

    this.loadScenario('canteiro', 'deathmatch', 'title', this.currentCharacterId, this.currentDifficulty);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud();
    this.onReady();
    this.clock.start();
    this.loop();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    const canvas = this.renderer.domElement;
    window.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);

    const canvas = this.renderer.domElement;
    window.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.mouseFireHeld = false;
    this.mobileFireHeld = false;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    soundEngine.unlock();
    this.keys.add(e.code);

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing') {
        this.pauseGame();
      } else if (this.phase === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    const player = this.getPlayer();
    if (!player) return;

    if (this.repair.active) {
      if (e.code === 'KeyQ') this.submitRepairNode(0);
      else if (e.code === 'KeyE') this.submitRepairNode(1);
      else if (e.code === 'KeyF') this.submitRepairNode(2);
      return;
    }

    if (e.code === 'KeyC' && player.alive) {
      // Snap camera behind player's facing direction
      this.cameraYaw = player.yaw;
    }

    if (!player.alive || player.hp <= 0) {
      if (this.killCam.active && e.code === 'Space') {
        e.preventDefault();
        this.skipKillCam();
      }
      return;
    }

    if (e.code === 'Digit1') this.switchWeapon(1);
    else if (e.code === 'Digit2') this.switchWeapon(2);
    else if (e.code === 'Digit3') this.switchWeapon(3);
    else if (e.code === 'KeyR') this.triggerReload();
    else if (e.code === 'KeyZ') this.triggerEmote('thumbs-up');
    else if (e.code === 'KeyX') this.triggerEmote('cueca');
    else if (e.code === 'KeyV') this.triggerEmote('gg');
    else if (e.code === 'KeyB') this.triggerEmote('laugh');
    else if (e.code === 'KeyG') {
      this.switchWeapon(3);
      this.tryFire(player);
    } else if (e.code === 'Space') {
      e.preventDefault();
      player.jumpBufferTimer = 0.14;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    this.usingMobileAim = false;
    this.hasPointerMoved = true;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.refreshMouseAimWorld();
  };

  private refreshMouseAimWorld(): void {
    if (!this.hasPointerMoved) return;
    _raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = _raycaster.ray.intersectPlane(_aimPlane, this.mouseAimWorld);
    if (!hit) {
      // If pointer is above horizon, project far forward along ray direction
      const p = this.getPlayer();
      const dir = _raycaster.ray.direction;
      if (p) {
        this.mouseAimWorld.set(
          p.pos.x + dir.x * 24,
          1.25,
          p.pos.z + dir.z * 24
        );
      }
    }
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    soundEngine.unlock();
    if (this.phase !== 'playing') return;

    const player = this.getPlayer();
    if (!player || !player.alive || player.hp <= 0) {
      this.mouseFireHeld = false;
      return;
    }

    this.handlePointerMove(e);
    const dx = this.mouseAimWorld.x - player.pos.x;
    const dz = this.mouseAimWorld.z - player.pos.z;
    if (dx * dx + dz * dz > 0.04) {
      player.yaw = Math.atan2(dx, dz);
    }

    if (e.button === 0) {
      this.mouseFireHeld = true;
      this.tryFire(player);
    } else if (e.button === 2) {
      const prev = player.weaponSlot;
      this.switchWeapon(3);
      this.tryFire(player);
      if (player.ammo[3] === 0) this.switchWeapon(prev);
    }
  };

  private handlePointerUp = (): void => {
    this.mouseFireHeld = false;
  };

  // Public API for React UI & Mobile Controls
  public startMatch(
    mapId: MapId,
    mode: GameMode,
    characterId: CharacterId = this.currentCharacterId,
    difficulty: Difficulty = this.currentDifficulty
  ): void {
    soundEngine.unlock();
    soundEngine.startMusic();
    this.loadScenario(mapId, mode, 'playing', characterId, difficulty);
  }

  public previewMapOnTitle(
    mapId: MapId,
    mode: GameMode,
    characterId: CharacterId = this.currentCharacterId,
    difficulty: Difficulty = this.currentDifficulty
  ): void {
    if (this.phase === 'title') {
      this.loadScenario(mapId, mode, 'title', characterId, difficulty);
    }
  }

  public pauseGame(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.keys.clear();
      this.mouseFireHeld = false;
      this.mobileFireHeld = false;
      this.emitHud();
    }
  }

  public resumeGame(): void {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.clock.getDelta();
      this.emitHud();
    }
  }

  public returnToTitle(): void {
    this.mouseFireHeld = false;
    this.mobileFireHeld = false;
    this.loadScenario(
      this.currentMapId,
      this.currentMode,
      'title',
      this.currentCharacterId,
      this.currentDifficulty
    );
  }

  public switchWeapon(slot: WeaponSlot): void {
    const p = this.getPlayer();
    if (!p || !p.alive || p.hp <= 0 || p.weaponSlot === slot) return;
    p.weaponSlot = slot;
    p.reloading = false;
    p.reloadTimer = 0;
    p.rig.setWeapon(slot);
    this.emitHud();
  }

  public triggerReload(): void {
    const p = this.getPlayer();
    if (!p || !p.alive || p.hp <= 0 || p.reloading) return;
    const w = WEAPONS[p.weaponSlot];
    if (p.ammo[p.weaponSlot] >= w.magSize) return;
    p.reloading = true;
    p.reloadTimer = w.reloadTime * p.charDef.stats.reloadMult;
    soundEngine.playReload();
    this.emitHud();
  }

  public triggerJump(): void {
    const p = this.getPlayer();
    if (p && p.alive && p.hp > 0) {
      p.jumpBufferTimer = 0.14;
    }
  }

  public triggerEmote(emote: EmoteId): void {
    if (this.phase !== 'playing' || this.repair.active) return;
    const p = this.getPlayer();
    if (!p || !p.alive || p.hp <= 0 || p.emoteCooldown > 0) return;

    this.applyFighterEmote(p, emote, 2.2);
    p.emoteCooldown = 2.5;
    soundEngine.playEmote(emote);

    // Nearby teammates or relaxed rivals socially react with an emote!
    for (const bot of this.fighters) {
      if (bot.isPlayer || !bot.alive || bot.aiUnderFireTimer > 0) continue;
      if (bot.pos.distanceTo(p.pos) > 20) continue;
      const isAlly = this.currentMode === 'tdm' && bot.team === p.team;
      const chance = isAlly ? 0.78 : emote === 'laugh' ? 0.45 : 0.35;
      if (Math.random() < chance) {
        bot.aiPendingEmote =
          emote === 'laugh' && !isAlly
            ? 'laugh'
            : emote === 'cueca'
              ? 'cueca'
              : Math.random() < 0.55
                ? 'thumbs-up'
                : 'gg';
        bot.aiEmoteReplyTimer = 0.35 + Math.random() * 0.65;
      }
    }
    this.emitHud();
  }

  private applyFighterEmote(f: Fighter, emote: EmoteId, duration = 2.1): void {
    f.activeEmote = emote;
    f.emoteTimer = duration;
    f.rig.setEmote(emote, this.maxAnisotropy);
  }

  public setMobileMove(x: number, y: number): void {
    this.mobileMoveVec.set(x, y);
  }

  public setMobileAim(dx: number, dy: number): void {
    if (Math.hypot(dx, dy) > 0.08) {
      this.usingMobileAim = true;
      this.mobileAimVec.set(dx, dy).normalize();
    }
  }

  public setMobileFire(held: boolean): void {
    soundEngine.unlock();
    const p = this.getPlayer();
    if (!p || !p.alive || p.hp <= 0 || this.phase !== 'playing') {
      this.mobileFireHeld = false;
      return;
    }
    this.mobileFireHeld = held;
    if (held) {
      this.tryFire(p);
    }
  }

  public equipExclusiveCueca(cuecaId: string | null): void {
    this.dailyChallenges.setEquippedCuecaId(cuecaId);
    const player = this.getPlayer();
    if (player) {
      const equipped = this.dailyChallenges.getEquippedCueca();
      const tier = equipped ?? getCuecaTierForScore(this.careerScore);
      player.tier = tier;
      player.rig.setCuecaTier(tier, player.team, this.maxAnisotropy);
    }
    this.emitHud();
  }

  public skipKillCam(): void {
    if (!this.killCam.active) return;
    this.clearKillCam();
    this.emitHud();
  }

  private clearKillCam(): void {
    this.killCam.active = false;
    this.killCam.timeRemaining = 0;
    this.killCam.slowMoRemaining = 0;
    if (this.camera.fov !== 48) {
      this.camera.fov = 48;
      this.camera.updateProjectionMatrix();
    }
  }

  private startKillCam(
    attacker: Fighter | undefined,
    victim: Fighter,
    isHeadshot: boolean,
    weaponId: 'pistol' | 'rifle' | 'grenade'
  ): void {
    if (!victim.isPlayer || !attacker || attacker.id === victim.id || this.phase !== 'playing') {
      return;
    }
    const duration = this.currentMode === 'cueca-king' ? 3.0 : 2.6;
    const weaponSlot: WeaponSlot = weaponId === 'pistol' ? 1 : weaponId === 'rifle' ? 2 : 3;

    this.killCam.active = true;
    this.killCam.killerId = attacker.id;
    this.killCam.killerName = attacker.name;
    this.killCam.killerRole = attacker.charDef.role;
    this.killCam.killerFaction = attacker.charDef.faction;
    this.killCam.killerCuecaName = attacker.tier.name;
    this.killCam.killerCuecaColor = attacker.tier.primaryColor;
    this.killCam.killerCuecaAccent = attacker.tier.secondaryColor;
    this.killCam.weaponName = WEAPONS[weaponSlot].name;
    this.killCam.headshot = isHeadshot;
    this.killCam.deathPos.copy(victim.pos);
    this.killCam.killerPosAtKill.copy(attacker.pos);
    this.killCam.killerYawAtKill = attacker.yaw;
    this.killCam.timeRemaining = duration;
    this.killCam.totalTime = duration;
    this.killCam.slowMoRemaining = 0.72;
    this.hitstopTimer = 0;
    this.cameraInitSnap = true;
    soundEngine.playKillCam();
  }

  public submitRepairNode(nodeIndex: number): void {
    if (!this.repair.active || this.phase !== 'playing') return;
    const p = this.getPlayer();
    if (!p || !p.alive || p.hp <= 0) return;

    const expected = this.repair.sequence[this.repair.progress];
    if (nodeIndex === expected) {
      soundEngine.playStitchTick(this.repair.progress);
      this.repair.progress += 1;
      if (this.repair.progress >= this.repair.sequence.length) {
        this.repair.active = false;
        p.cuecaDamaged = false;
        p.hasCueca = true;
        p.cuecaGraceTimer = 4.0;
        p.rig.setCuecaState(true, false);
        this.spawnConfetti(p.pos.x, 1.9, p.pos.z, 0x22c55e, 14);
        soundEngine.playTierUp();
        this.showBanner('Cueca Costurada! Capacete salvo!', 'mint');
        this.recordDailyMetric('repair_success', 1);
      }
    } else {
      this.repair.wrongShake = 0.22;
      soundEngine.playBodyHit();
    }
    this.emitHud();
  }

  private recordDailyMetric(metric: ChallengeMetric, amount = 1): void {
    if (this.phase !== 'playing') return;
    const completed = this.dailyChallenges.recordMetric(metric, amount);
    if (completed.length === 0) return;

    const player = this.getPlayer();
    for (const item of completed) {
      this.careerScore += item.challenge.bonusPoints;
      if (player) {
        player.score += item.challenge.bonusPoints;
        player.tier = item.rewardCueca;
        player.rig.setCuecaTier(item.rewardCueca, player.team, this.maxAnisotropy);
        this.spawnConfetti(player.pos.x, 2.0, player.pos.z, 0xfacc15, 22);
      }
      try {
        localStorage.setItem(CAREER_SCORE_KEY, String(this.careerScore));
      } catch {
        // ignore
      }
      soundEngine.playTierUp();
      this.showBanner(
        `Desafio Completo! Desbloqueou: ${item.rewardCueca.name} (+${item.challenge.bonusPoints} pts)`,
        'gold'
      );
    }
  }

  private showBanner(text: string, tone: 'gold' | 'pink' | 'mint'): void {
    this.bannerToast = { text, tone };
    this.bannerTimer = 2.4;
  }

  private clearDynamicEntities(): void {
    for (const f of this.fighters) {
      this.scene.remove(f.rig.root);
      f.rig.dispose();
    }
    this.fighters = [];

    for (const b of this.bullets) {
      this.scene.remove(b.mesh);
      (b.mesh.material as THREE.Material).dispose();
    }
    this.bullets = [];

    for (const g of this.grenades) {
      this.scene.remove(g.mesh);
      this.scene.remove(g.ringMesh);
    }
    this.grenades = [];

    for (const fc of this.flyingCuecas) {
      this.scene.remove(fc.mesh);
      fc.mesh.userData.dispose?.();
    }
    this.flyingCuecas = [];

    for (const pt of this.particles) {
      this.scene.remove(pt.mesh);
      (pt.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];

    for (const bp of this.bonusPickups) {
      this.scene.remove(bp.group);
      for (const d of bp.disposables) d.dispose();
    }
    this.bonusPickups = [];
  }

  private loadScenario(
    mapId: MapId,
    mode: GameMode,
    targetPhase: HudSnapshot['phase'],
    characterId: CharacterId,
    difficulty: Difficulty
  ): void {
    this.currentMapId = mapId;
    this.currentMode = mode;
    this.currentCharacterId = characterId;
    this.currentDifficulty = difficulty;
    this.phase = targetPhase;
    this.mouseFireHeld = false;
    this.mobileFireHeld = false;

    this.clearDynamicEntities();

    if (this.mapBuild) {
      this.scene.remove(this.mapBuild.group);
      for (const d of this.mapBuild.disposables) d.dispose();
    }

    this.mapBuild = buildMapScene(mapId, this.maxAnisotropy);
    this.scene.add(this.mapBuild.group);
    this.scene.background = new THREE.Color(this.mapBuild.skyColor);
    this.scene.fog = new THREE.FogExp2(this.mapBuild.skyColor, this.mapBuild.fogDensity);

    // Spawn scattered bonus pickups across the map
    for (const bSpawn of this.mapBuild.bonusSpawns) {
      const pickup = buildBonusPickupProp(bSpawn.type, bSpawn.x, bSpawn.z);
      this.scene.add(pickup.group);
      this.bonusPickups.push(pickup);
    }

    this.killfeed = [];
    this.matchTimer = mode === 'cueca-king' ? 75 : 150;
    this.blueScore = 0;
    this.orangeScore = 0;
    this.roundNumber = 1;
    this.roundWinsPlayer = 0;
    this.roundOverTimer = 0;
    this.roundWinnerText = '';
    this.bannerToast = null;
    this.repair.active = false;
    this.clearKillCam();
    this.hitstopTimer = 0;
    this.shakeTrauma = 0;
    this.cameraInitSnap = true;

    this.spawnAllFighters();

    const p = this.getPlayer();
    if (p) {
      this.alignCameraBehind(p);
      this.updateCamera(1);
    }
    this.emitHud();
  }

  private alignCameraBehind(p: Fighter): void {
    // Orient camera behind player facing toward arena center (0, 0)
    const dirX = -p.pos.x;
    const dirZ = -p.pos.z;
    if (dirX * dirX + dirZ * dirZ > 0.25) {
      this.cameraYaw = Math.atan2(dirX, dirZ);
      p.yaw = this.cameraYaw;
    } else {
      this.cameraYaw = Math.PI;
      p.yaw = Math.PI;
    }
    this.cameraInitSnap = true;
  }

  private spawnAllFighters(): void {
    if (!this.mapBuild) return;
    const isTdm = this.currentMode === 'tdm';
    const playerChar = getCharacterById(this.currentCharacterId);
    const heroes = CHARACTERS.filter((c) => c.faction === 'heroes');
    const villains = CHARACTERS.filter((c) => c.faction === 'villains');
    const others = CHARACTERS.filter((c) => c.id !== playerChar.id);

    const total = 6;
    for (let i = 0; i < total; i++) {
      const isPlayer = i === 0;
      const team: TeamId = isTdm ? (i < 3 ? 'blue' : 'orange') : 'none';

      let charDef: CharacterDef;
      if (isPlayer) {
        charDef = playerChar;
      } else if (isTdm) {
        const allyRoster = playerChar.faction === 'heroes' ? heroes : villains;
        const enemyRoster = playerChar.faction === 'heroes' ? villains : heroes;
        if (team === 'blue') {
          const filtered = allyRoster.filter((c) => c.id !== playerChar.id);
          charDef = filtered[(i - 1) % filtered.length] ?? allyRoster[i % allyRoster.length];
        } else {
          charDef = enemyRoster[(i - 3) % enemyRoster.length];
        }
      } else {
        charDef = others[(i - 1) % others.length];
      }

      const spawn = this.pickSafeSpawn(team, isPlayer ? 'player' : `bot-${i}`);
      const tier = isPlayer
        ? (this.dailyChallenges.getEquippedCueca() ?? getCuecaTierForScore(this.careerScore))
        : getCuecaTierForScore(i * 95);
      const rig = createBigHeadCharacter(team, tier, charDef, this.maxAnisotropy);
      rig.root.position.copy(spawn);
      this.scene.add(rig.root);

      const maxHp = 100 + charDef.stats.maxHpBonus;
      const fighter: Fighter = {
        id: isPlayer ? 'player' : `bot-${i}`,
        name: isPlayer ? charDef.name : charDef.name,
        isPlayer,
        team,
        charDef,
        rig,
        pos: spawn.clone(),
        vel: new THREE.Vector3(),
        yaw: 0,
        hp: maxHp,
        maxHp,
        alive: true,
        respawnTimer: 0,
        hasCueca: true,
        cuecaInPlay: true,
        cuecaDamaged: false,
        cuecaGraceTimer: 0,
        score: isPlayer ? this.careerScore : i * 95,
        kills: 0,
        deaths: 0,
        headshots: 0,
        tier,
        weaponSlot: isPlayer ? 2 : i % 2 === 0 ? 2 : 1,
        ammo: {
          1: WEAPONS[1].magSize,
          2: WEAPONS[2].magSize,
          3: WEAPONS[3].magSize + charDef.stats.extraGrenade,
        },
        reloading: false,
        reloadTimer: 0,
        fireCooldown: 0,
        onGround: true,
        coyoteTimer: 0,
        jumpBufferTimer: 0,
        hitFlashTimer: 0,
        walkPhase: i * 1.3,
        squashY: 1,
        slipTimer: 0,
        slipVelX: 0,
        slipVelZ: 0,
        speedBuffTimer: 0,
        damageBuffTimer: 0,
        shieldBuffTimer: 0,
        aiTargetPos: spawn.clone(),
        aiThinkTimer: 0.25 + Math.random() * 0.4,
        aiStrafeDir: Math.random() > 0.5 ? 1 : -1,
        aiLastPos: spawn.clone(),
        aiStuckTimer: 0,
        aiState: 'engage',
        aiUnderFireTimer: 0,
        aiThreatPos: spawn.clone(),
        aiHideTimer: 0,
        emoteTimer: 0,
        emoteCooldown: 0,
        activeEmote: null,
        aiPendingEmote: null,
        aiEmoteReplyTimer: 0,
        lastAttackerId: null,
        lastWeaponId: 'rifle',
      };
      rig.setWeapon(fighter.weaponSlot);
      this.fighters.push(fighter);
    }
  }

  private getPlayer(): Fighter | undefined {
    return this.fighters[0];
  }

  private pickSafeSpawn(team: TeamId, excludeId: string): THREE.Vector3 {
    if (!this.mapBuild) return new THREE.Vector3();
    const pool =
      this.currentMode === 'tdm'
        ? team === 'blue'
          ? this.mapBuild.spawnPoints.blue
          : this.mapBuild.spawnPoints.orange
        : this.mapBuild.spawnPoints.ffa;

    const aliveOthers = this.fighters.filter((f) => f.id !== excludeId && f.alive);
    if (aliveOthers.length === 0) {
      return pool[Math.floor(Math.random() * pool.length)].clone();
    }

    const scored = pool.map((sp) => {
      let minDist = Infinity;
      let exposedCount = 0;
      for (const other of aliveOthers) {
        const d = sp.distanceTo(other.pos);
        if (d < minDist) minDist = d;
        const isEnemy = this.currentMode !== 'tdm' || other.team !== team;
        if (isEnemy && d < 24 && this.hasLineOfSight(sp, other.pos)) {
          exposedCount += 1;
        }
      }
      return { sp, minDist, exposedCount };
    });

    let safe = scored.filter((s) => s.minDist >= 10 && s.exposedCount === 0);
    if (safe.length === 0) safe = scored.filter((s) => s.minDist >= 8);
    if (safe.length === 0) {
      scored.sort((a, b) => b.minDist - a.minDist);
      return scored[0].sp.clone();
    }
    return safe[Math.floor(Math.random() * safe.length)].sp.clone();
  }

  private resetRoundForCuecaKing(): void {
    if (!this.mapBuild) return;
    this.roundNumber += 1;
    this.matchTimer = 75;
    this.repair.active = false;
    this.mouseFireHeld = false;
    this.mobileFireHeld = false;

    this.fighters.forEach((f) => {
      f.alive = false;
    });
    this.fighters.forEach((f) => {
      const spawn = this.pickSafeSpawn(f.team, f.id);
      f.pos.copy(spawn);
      f.vel.set(0, 0, 0);
      f.hp = f.maxHp;
      f.alive = true;
      f.hasCueca = true;
      f.cuecaInPlay = true;
      f.cuecaDamaged = false;
      f.cuecaGraceTimer = 0;
      f.slipTimer = 0;
      f.speedBuffTimer = 0;
      f.damageBuffTimer = 0;
      f.shieldBuffTimer = 0;
      f.reloading = false;
      f.lastAttackerId = null;
      f.aiState = 'engage';
      f.aiUnderFireTimer = 0;
      f.aiHideTimer = 0;
      f.emoteTimer = 0;
      f.emoteCooldown = 0;
      f.activeEmote = null;
      f.aiPendingEmote = null;
      f.rig.setEmote(null);
      f.ammo = {
        1: WEAPONS[1].magSize,
        2: WEAPONS[2].magSize,
        3: WEAPONS[3].magSize + f.charDef.stats.extraGrenade,
      };
      f.rig.root.visible = true;
      f.rig.root.position.copy(f.pos);
      f.rig.setCuecaState(true, false);
      f.rig.setShieldActive(false);
      if (f.isPlayer) {
        this.clearKillCam();
        this.alignCameraBehind(f);
      }
    });
    this.showBanner(`Rodada ${this.roundNumber} — Última Cueca no Ar Vence!`, 'gold');
    this.emitHud();
  }

  private loop = (): void => {
    if (this.disposed) return;
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    this.stepSimulation(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.loop);
    } else {
      this.frameId = requestAnimationFrame(this.loop);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(dt: number): void {
    if (this.phase === 'title') {
      const t = this.clock.elapsedTime * 0.18;
      this.camera.position.set(Math.cos(t) * 34, 21, Math.sin(t) * 34);
      this.camera.lookAt(0, 1.2, 0);
      this.aimRingMesh.visible = false;
      this.aimLineMesh.visible = false;
      for (let i = 0; i < this.fighters.length; i++) {
        this.stepBotAI(this.fighters[i], dt, true);
        this.stepFighterPhysics(this.fighters[i], dt);
      }
      this.stepHazards(dt);
      this.stepBonusPickups(dt);
      this.stepProjectiles(dt);
      this.stepFlyingProps(dt);
      return;
    }

    if (this.phase === 'paused' || this.phase === 'match-over') {
      return;
    }

    if (this.phase === 'round-over') {
      this.mouseFireHeld = false;
      this.mobileFireHeld = false;
      this.stepFlyingProps(dt);
      this.updateCamera(dt);
      this.roundOverTimer -= dt;
      if (this.roundOverTimer <= 0) {
        if (this.roundWinsPlayer >= 2 || this.roundNumber >= 5) {
          this.phase = 'match-over';
          this.emitHud();
        } else {
          this.phase = 'playing';
          this.resetRoundForCuecaKing();
        }
      }
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateCamera(dt);
      return;
    }

    this.matchTimer = Math.max(0, this.matchTimer - dt);
    if (this.matchTimer <= 0) {
      this.mouseFireHeld = false;
      this.mobileFireHeld = false;
      if (this.currentMode === 'cueca-king') {
        this.endCuecaKingRound('Tempo esgotado!');
      } else {
        this.phase = 'match-over';
        this.emitHud();
      }
      return;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerToast = null;
    }
    if (this.hitMarkerTimer > 0) this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);

    if (this.repair.active) {
      this.repair.timeRemaining -= dt;
      if (this.repair.wrongShake > 0) this.repair.wrongShake = Math.max(0, this.repair.wrongShake - dt);
      if (this.repair.timeRemaining <= 0) {
        this.failRepairMinigame();
      }
    }

    if (this.currentMode === 'cueca-king') {
      this.grenadeRegenTimer += dt;
      if (this.grenadeRegenTimer >= 6.5) {
        this.grenadeRegenTimer = 0;
        for (const f of this.fighters) {
          if (f.alive && f.ammo[3] < WEAPONS[3].magSize + f.charDef.stats.extraGrenade) {
            f.ammo[3] += 1;
          }
        }
      }
    }

    // Camera Q/E manual orbit when not stitching cueca
    if (!this.repair.active) {
      const camTurn = (this.keys.has('KeyQ') ? 1 : 0) - (this.keys.has('KeyE') ? 1 : 0);
      if (camTurn !== 0) {
        this.cameraYaw += camTurn * dt * 2.4;
      }
    }

    let simDt = dt;
    if (this.killCam.active) {
      this.killCam.timeRemaining = Math.max(0, this.killCam.timeRemaining - dt);
      if (this.killCam.slowMoRemaining > 0) {
        this.killCam.slowMoRemaining = Math.max(0, this.killCam.slowMoRemaining - dt);
        simDt = dt * 0.35;
      }
      if (this.killCam.timeRemaining <= 0) {
        this.clearKillCam();
      }
    }

    for (const f of this.fighters) {
      if (!f.alive) {
        if (this.currentMode !== 'cueca-king') {
          f.respawnTimer -= dt;
          if (f.respawnTimer <= 0) {
            this.respawnFighter(f);
          }
        }
        continue;
      }

      if (f.isPlayer) {
        this.stepPlayerInput(f, simDt);
      } else {
        this.stepBotAI(f, simDt, false);
      }
      this.stepFighterPhysics(f, simDt);
    }

    this.stepHazards(simDt);
    this.stepBonusPickups(simDt);
    this.stepProjectiles(simDt);
    this.stepFlyingProps(simDt);
    this.updateCamera(dt);
    this.updateAimVisuals();

    this.hudAccumulator += dt;
    if (this.hudAccumulator >= 0.06) {
      this.hudAccumulator = 0;
      this.emitHud();
    }
  }

  private failRepairMinigame(): void {
    this.repair.active = false;
    this.repair.timeRemaining = 0;
    const p = this.getPlayer();
    if (!p) return;
    p.cuecaDamaged = false;
    p.hasCueca = false;
    p.rig.setCuecaState(false, false);
    this.spawnFlyingCueca(p.pos, p.tier, p.team, p.id);
    soundEngine.playRipFail();
    soundEngine.playBoingHeadshot();

    if (this.currentMode === 'cueca-king') {
      p.cuecaInPlay = true;
      this.showBanner('Cueca no Ar! Enquanto não cair, você segue no jogo!', 'pink');
    } else {
      this.showBanner('Cueca Destruída! Ficou Careca!', 'pink');
    }
    this.emitHud();
  }

  private stepPlayerInput(p: Fighter, dt: number): void {
    if (!p.alive || p.hp <= 0) {
      this.mouseFireHeld = false;
      this.mobileFireHeld = false;
      return;
    }

    const moveX =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.mobileMoveVec.x;
    const moveY =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
      this.mobileMoveVec.y;

    // Camera-aligned movement basis so W always moves forward away from camera!
    _camForward.set(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    _camRight.set(-Math.cos(this.cameraYaw), 0, Math.sin(this.cameraYaw));

    _v1.set(0, 0, 0);
    _v1.addScaledVector(_camRight, moveX);
    _v1.addScaledVector(_camForward, moveY);
    if (_v1.lengthSq() > 1) _v1.normalize();

    const panicBoost = this.currentMode === 'cueca-king' && !p.hasCueca && p.cuecaInPlay ? 1.24 : 1.0;
    const speedBuff = p.speedBuffTimer > 0 ? 1.38 : 1.0;
    const speed = 7.6 * p.charDef.stats.speedMult * panicBoost * speedBuff;

    if (p.slipTimer > 0) {
      // Uncontrollable banana peel slide with minimal steering!
      p.vel.x = THREE.MathUtils.damp(p.vel.x, p.slipVelX + _v1.x * 2.2, 4.5, dt);
      p.vel.z = THREE.MathUtils.damp(p.vel.z, p.slipVelZ + _v1.z * 2.2, 4.5, dt);
    } else {
      const accel = p.onGround ? 19 : 9.5;
      p.vel.x = THREE.MathUtils.damp(p.vel.x, _v1.x * speed, accel, dt);
      p.vel.z = THREE.MathUtils.damp(p.vel.z, _v1.z * speed, accel, dt);
    }

    if (this.usingMobileAim) {
      _v2.set(0, 0, 0)
        .addScaledVector(_camRight, this.mobileAimVec.x)
        .addScaledVector(_camForward, this.mobileAimVec.y);
      p.yaw = Math.atan2(_v2.x, _v2.z);

      let diff = p.yaw - this.cameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const chaseRate = this.mobileFireHeld ? 1.8 : 3.4;
      this.cameraYaw += diff * Math.min(1, dt * chaseRate);
    } else {
      this.refreshMouseAimWorld();
      if (this.hasPointerMoved) {
        const dx = this.mouseAimWorld.x - p.pos.x;
        const dz = this.mouseAimWorld.z - p.pos.z;
        if (dx * dx + dz * dz > 0.08) {
          p.yaw = Math.atan2(dx, dz);
        }

        const deadzoneX = this.mouseFireHeld ? 0.38 : 0.2;
        if (Math.abs(this.pointerNdc.x) > deadzoneX) {
          const edgeFactor = (Math.abs(this.pointerNdc.x) - deadzoneX) / (1 - deadzoneX);
          this.cameraYaw -= Math.sign(this.pointerNdc.x) * edgeFactor * 2.55 * dt;
        }
        if (this.pointerNdc.y < -0.34 && !this.mouseFireHeld) {
          let diff = p.yaw - this.cameraYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turnDir =
            Math.abs(diff) > 2.95 ? (this.pointerNdc.x >= 0 ? -1 : 1) : Math.sign(diff);
          this.cameraYaw += turnDir * Math.min(Math.abs(diff), 2.5 * dt);
        }
      } else if (_v1.lengthSq() > 0.04) {
        const moveYaw = Math.atan2(_v1.x, _v1.z);
        let pDiff = moveYaw - p.yaw;
        while (pDiff > Math.PI) pDiff -= Math.PI * 2;
        while (pDiff < -Math.PI) pDiff += Math.PI * 2;
        p.yaw += pDiff * Math.min(1, dt * 10);

        let cDiff = p.yaw - this.cameraYaw;
        while (cDiff > Math.PI) cDiff -= Math.PI * 2;
        while (cDiff < -Math.PI) cDiff += Math.PI * 2;
        this.cameraYaw += cDiff * Math.min(1, dt * 3.0);
      }
    }

    if (this.mouseFireHeld || this.mobileFireHeld) {
      if (WEAPONS[p.weaponSlot].automatic) {
        this.tryFire(p);
      }
    }
  }

  private stepHazards(dt: number): void {
    if (!this.mapBuild) return;
    for (const h of this.mapBuild.hazards) {
      if (h.cooldown > 0) h.cooldown = Math.max(0, h.cooldown - dt);

      if (h.type === 'trampoline' && h.tileTop && h.springCoil) {
        if (h.triggerAnim > 0) {
          h.triggerAnim = Math.max(0, h.triggerAnim - dt * 2.3);
          const lift = Math.sin(h.triggerAnim * Math.PI);
          h.tileTop.position.y = 0.032 + lift * 0.72;
          h.springCoil.scale.y = 0.05 + lift * 1.4;
          h.springCoil.position.y = 0.02 + lift * 0.36;
        } else {
          h.tileTop.position.y = 0.032;
          h.springCoil.scale.y = 0.05;
        }
      } else if (h.type === 'banana') {
        if (h.triggerAnim > 0) {
          h.triggerAnim = Math.max(0, h.triggerAnim - dt * 2.5);
          const s = 1 + Math.sin(h.triggerAnim * Math.PI) * 0.25;
          h.group.scale.set(s, 0.75, s);
        } else {
          h.group.scale.set(1, 1, 1);
        }
      }

      if (h.cooldown > 0) continue;

      for (const f of this.fighters) {
        if (!f.alive || f.pos.y > 0.48) continue;
        const dx = f.pos.x - h.x;
        const dz = f.pos.z - h.z;

        if (h.type === 'banana') {
          if (f.slipTimer <= 0 && !f.charDef.stats.slipResist && Math.hypot(dx, dz) < 1.05) {
            f.slipTimer = 1.15;
            const speed = Math.hypot(f.vel.x, f.vel.z);
            if (speed > 0.6) {
              f.slipVelX = (f.vel.x / speed) * 13.0;
              f.slipVelZ = (f.vel.z / speed) * 13.0;
            } else {
              f.slipVelX = Math.sin(f.yaw) * 13.0;
              f.slipVelZ = Math.cos(f.yaw) * 13.0;
            }
            h.cooldown = 1.8;
            h.triggerAnim = 1;
            this.spawnConfetti(h.x, 0.45, h.z, 0xfacc15, 9);
            if (f.isPlayer || f.pos.distanceTo(this.getPlayer()?.pos ?? f.pos) < 18) {
              soundEngine.playSlip();
            }
            if (f.isPlayer && this.phase === 'playing') {
              this.showBanner('Escorregou na Casca de Banana!', 'gold');
            }
            break;
          }
        } else if (h.type === 'trampoline') {
          if (Math.abs(dx) < 1.15 && Math.abs(dz) < 1.15 && f.vel.y <= 1.5) {
            f.vel.y = 16.8;
            f.onGround = false;
            f.coyoteTimer = 0;
            f.squashY = 1.38;
            f.vel.x *= 1.28;
            f.vel.z *= 1.28;
            h.cooldown = 0.7;
            h.triggerAnim = 1;
            this.spawnConfetti(h.x, 0.5, h.z, 0xf97316, 12);
            if (f.isPlayer || f.pos.distanceTo(this.getPlayer()?.pos ?? f.pos) < 18) {
              soundEngine.playTrampoline();
            }
            if (f.isPlayer && this.phase === 'playing') {
              this.showBanner('Trampolim Oculto! BOING!', 'mint');
              this.recordDailyMetric('trampoline_bounces', 1);
            }
            break;
          }
        }
      }
    }
  }

  private stepBonusPickups(dt: number): void {
    const t = this.clock.elapsedTime;
    for (let i = 0; i < this.bonusPickups.length; i++) {
      const bp = this.bonusPickups[i];
      if (!bp.active) {
        bp.respawnTimer -= dt;
        if (bp.respawnTimer <= 0) {
          bp.active = true;
          bp.group.visible = true;
          this.spawnConfetti(bp.x, 0.9, bp.z, 0xffffff, 6);
        }
        continue;
      }

      bp.coreGroup.rotation.y += dt * 2.2;
      bp.coreGroup.position.y = 0.85 + Math.sin(t * 3.1 + i * 1.1) * 0.16;

      for (const f of this.fighters) {
        if (!f.alive || f.pos.y > 1.8) continue;
        const distSq = (f.pos.x - bp.x) ** 2 + (f.pos.z - bp.z) ** 2;
        if (distSq <= 1.85) {
          bp.active = false;
          bp.respawnTimer = 15;
          bp.group.visible = false;
          this.applyBonusPickup(f, bp.type);
          break;
        }
      }
    }
  }

  private applyBonusPickup(f: Fighter, type: BonusType): void {
    if (f.isPlayer) soundEngine.playPickup();

    if (type === 'heal') {
      f.hp = Math.min(f.maxHp, f.hp + 45);
      if (!f.hasCueca || f.cuecaDamaged) {
        f.hasCueca = true;
        f.cuecaDamaged = false;
        f.cuecaInPlay = true;
        f.rig.setCuecaState(true, false);
        if (f.isPlayer) this.repair.active = false;
      }
      this.spawnConfetti(f.pos.x, 1.3, f.pos.z, 0x22c55e, 12);
      if (f.isPlayer && this.phase === 'playing') {
        this.showBanner('Bônus: +45 HP & Cueca Nova!', 'mint');
      }
    } else if (type === 'speed') {
      f.speedBuffTimer = 8.0;
      this.spawnConfetti(f.pos.x, 1.2, f.pos.z, 0x22d3ee, 12);
      if (f.isPlayer && this.phase === 'playing') {
        this.showBanner('Bônus: Turbo Elástico (8s)!', 'gold');
      }
    } else if (type === 'damage') {
      f.damageBuffTimer = 8.0;
      f.ammo[f.weaponSlot] = WEAPONS[f.weaponSlot].magSize + (f.weaponSlot === 3 ? f.charDef.stats.extraGrenade : 0);
      f.reloading = false;
      this.spawnConfetti(f.pos.x, 1.3, f.pos.z, 0xf97316, 12);
      if (f.isPlayer && this.phase === 'playing') {
        this.showBanner('Bônus: Fúria Tática +45% Dano (8s)!', 'pink');
      }
    } else if (type === 'shield') {
      f.shieldBuffTimer = 10.0;
      f.rig.setShieldActive(true);
      const maxG = WEAPONS[3].magSize + f.charDef.stats.extraGrenade + 1;
      f.ammo[3] = Math.min(maxG, f.ammo[3] + 1);
      this.spawnConfetti(f.pos.x, 1.3, f.pos.z, 0x818cf8, 12);
      if (f.isPlayer && this.phase === 'playing') {
        this.showBanner('Bônus: Escudo + Granada Extra (10s)!', 'gold');
      }
    }

    if (f.isPlayer && this.phase === 'playing') {
      this.recordDailyMetric('bonus_pickups', 1);
    }
  }

  private isBlockedAt(x: number, z: number, radius = 0.7): boolean {
    if (!this.mapBuild) return false;
    const half = this.mapBuild.arenaHalfSize - radius;
    if (Math.abs(x) > half || Math.abs(z) > half) return true;
    for (const c of this.mapBuild.colliders) {
      if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
        return true;
      }
    }
    return false;
  }

  private findCoverPosition(botPos: THREE.Vector3, threatPos: THREE.Vector3): THREE.Vector3 | null {
    if (!this.mapBuild) return null;
    const half = this.mapBuild.arenaHalfSize - 1.2;
    const distBotToThreat = botPos.distanceTo(threatPos);
    let bestSpot: THREE.Vector3 | null = null;
    let bestScore = Infinity;

    for (const c of this.mapBuild.colliders) {
      if (c.height <= 1.2) continue;
      const cx = (c.minX + c.maxX) * 0.5;
      const cz = (c.minZ + c.maxZ) * 0.5;
      if (Math.hypot(cx - botPos.x, cz - botPos.z) > 25) continue;

      const candidates: Array<[number, number]> = [
        [cx, c.minZ - 1.15],
        [cx, c.maxZ + 1.15],
        [c.minX - 1.15, cz],
        [c.maxX + 1.15, cz],
      ];

      for (const [px, pz] of candidates) {
        if (Math.abs(px) > half || Math.abs(pz) > half) continue;
        if (this.isBlockedAt(px, pz, 0.55)) continue;

        const candidate = new THREE.Vector3(px, 0, pz);
        // Must actually block line of sight from the shooter!
        if (this.hasLineOfSight(candidate, threatPos)) continue;

        const dBot = botPos.distanceTo(candidate);
        const dThreat = candidate.distanceTo(threatPos);
        // Prefer nearby cover that does NOT require walking closer to the shooter
        const closerPenalty = dThreat < distBotToThreat - 1.5 ? 10 : 0;
        const score = dBot + closerPenalty;
        if (score < bestScore) {
          bestScore = score;
          bestSpot = candidate;
        }
      }
    }

    return bestSpot;
  }

  private assignBotCover(bot: Fighter, threatPos: THREE.Vector3, state: 'seek_cover' | 'reload_cover'): void {
    bot.aiState = state;
    const cover = this.findCoverPosition(bot.pos, threatPos);
    if (cover) {
      bot.aiTargetPos.copy(cover);
    } else {
      // Fallback: strafe diagonally away from threat
      _v2.subVectors(bot.pos, threatPos);
      _v2.y = 0;
      if (_v2.lengthSq() < 0.01) _v2.set(1, 0, 0);
      _v2.normalize();
      bot.aiTargetPos.set(
        bot.pos.x + _v2.x * 7 + _v2.z * bot.aiStrafeDir * 6,
        0,
        bot.pos.z + _v2.z * 7 - _v2.x * bot.aiStrafeDir * 6
      );
    }
    bot.aiHideTimer = state === 'reload_cover' ? 1.2 : 0.85 + Math.random() * 0.45;
  }

  private stepBotAI(bot: Fighter, dt: number, titleDemo: boolean): void {
    const isEasy = this.currentDifficulty === 'easy';
    if (bot.aiUnderFireTimer > 0) bot.aiUnderFireTimer = Math.max(0, bot.aiUnderFireTimer - dt);
    if (bot.aiHideTimer > 0) bot.aiHideTimer = Math.max(0, bot.aiHideTimer - dt);

    let nearest: Fighter | null = null;
    let bestDistSq = Infinity;
    let nearestVisible: Fighter | null = null;
    let bestVisibleDistSq = Infinity;

    for (const other of this.fighters) {
      if (other.id === bot.id || !other.alive) continue;
      if (this.currentMode === 'tdm' && other.team === bot.team) continue;
      const dSq = bot.pos.distanceToSquared(other.pos);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        nearest = other;
      }
      if (dSq < 1150 && dSq < bestVisibleDistSq && this.hasLineOfSight(bot.pos, other.pos)) {
        bestVisibleDistSq = dSq;
        nearestVisible = other;
      }
    }

    const activeTarget = nearestVisible || nearest;
    const hasLosToTarget = activeTarget ? this.hasLineOfSight(bot.pos, activeTarget.pos) : false;

    // Immediately scramble behind cover if reloading in view of an enemy!
    if (!titleDemo && bot.reloading && activeTarget) {
      if (bot.aiState !== 'reload_cover' || (hasLosToTarget && bot.pos.distanceToSquared(bot.aiTargetPos) < 2.5)) {
        this.assignBotCover(bot, activeTarget.pos, 'reload_cover');
      }
    } else if (bot.aiState === 'reload_cover' && !bot.reloading) {
      bot.aiState = 'engage';
      bot.aiThinkTimer = 0;
    }

    bot.aiStuckTimer += dt;
    if (bot.aiStuckTimer >= 0.65) {
      const moved = bot.pos.distanceTo(bot.aiLastPos);
      bot.aiLastPos.copy(bot.pos);
      bot.aiStuckTimer = 0;
      if (moved < 0.75 && this.mapBuild && this.mapBuild.waypoints.length > 0) {
        const wp =
          this.mapBuild.waypoints[Math.floor(Math.random() * this.mapBuild.waypoints.length)];
        bot.aiTargetPos.copy(wp);
        bot.aiStrafeDir = -bot.aiStrafeDir;
        if (bot.onGround) bot.jumpBufferTimer = 0.12;
      }
    }

    bot.aiThinkTimer -= dt;
    if (bot.aiThinkTimer <= 0 || bot.pos.distanceToSquared(bot.aiTargetPos) < 3.2) {
      bot.aiThinkTimer = (isEasy ? 0.85 : 0.48) + Math.random() * 0.55;
      if (Math.random() < 0.55) bot.aiStrafeDir = -bot.aiStrafeDir;

      if (activeTarget) {
        const distToTarget = activeTarget.pos.distanceTo(bot.pos);
        const threatPos = bot.aiUnderFireTimer > 0 ? bot.aiThreatPos : activeTarget.pos;
        const needsCover =
          !titleDemo &&
          (bot.reloading ||
            (bot.aiUnderFireTimer > 0 && (bot.hp < 78 || hasLosToTarget)) ||
            bot.hp < 38);

        if (needsCover) {
          if (hasLosToTarget) {
            this.assignBotCover(
              bot,
              threatPos,
              bot.reloading ? 'reload_cover' : 'seek_cover'
            );
          } else if (bot.aiHideTimer > 0 || bot.reloading) {
            // Safely hidden behind obstacle while reloading/recovering
            bot.aiTargetPos.copy(bot.pos);
          } else {
            // Peek back out after brief recovery in cover
            bot.aiState = 'flank';
            const angle = Math.atan2(activeTarget.pos.x - bot.pos.x, activeTarget.pos.z - bot.pos.z) + bot.aiStrafeDir * 0.85;
            bot.aiTargetPos.set(
              bot.pos.x + Math.sin(angle) * 6,
              0,
              bot.pos.z + Math.cos(angle) * 6
            );
          }
        } else if (hasLosToTarget) {
          bot.aiState = 'engage';
          if (distToTarget < 7.0) {
            // Backpedal & strafe instead of walking nose-to-nose into the player!
            _v2.subVectors(bot.pos, activeTarget.pos).normalize();
            bot.aiTargetPos.set(
              bot.pos.x + _v2.x * 6 + _v2.z * bot.aiStrafeDir * 5,
              0,
              bot.pos.z + _v2.z * 6 - _v2.x * bot.aiStrafeDir * 5
            );
          } else if (distToTarget > 16.5) {
            // Diagonal flank advance rather than dead-straight charge!
            const toX = activeTarget.pos.x - bot.pos.x;
            const toZ = activeTarget.pos.z - bot.pos.z;
            const baseYaw = Math.atan2(toX, toZ) + bot.aiStrafeDir * 0.65;
            bot.aiTargetPos.set(
              bot.pos.x + Math.sin(baseYaw) * 9,
              0,
              bot.pos.z + Math.cos(baseYaw) * 9
            );
          } else {
            // Optimal combat range: hold angle and strafe around cover
            const perpX = -(activeTarget.pos.z - bot.pos.z) / Math.max(1, distToTarget);
            const perpZ = (activeTarget.pos.x - bot.pos.x) / Math.max(1, distToTarget);
            bot.aiTargetPos.set(
              bot.pos.x + perpX * bot.aiStrafeDir * 5,
              0,
              bot.pos.z + perpZ * bot.aiStrafeDir * 5
            );
          }
        } else if (this.mapBuild && this.mapBuild.waypoints.length > 0) {
          bot.aiState = 'flank';
          let bestWp: THREE.Vector3 | null = null;
          let bestScore = Infinity;
          for (const wp of this.mapBuild.waypoints) {
            const dFromBot = bot.pos.distanceTo(wp);
            if (dFromBot < 3) continue;
            if (!this.hasLineOfSight(bot.pos, wp)) continue;
            const score = wp.distanceTo(activeTarget.pos) + dFromBot * 0.35;
            if (score < bestScore) {
              bestScore = score;
              bestWp = wp;
            }
          }
          if (bestWp) {
            bot.aiTargetPos.copy(bestWp);
          } else {
            bot.aiTargetPos.copy(activeTarget.pos);
          }
        }
      }
    }

    _v1.subVectors(bot.aiTargetPos, bot.pos);
    _v1.y = 0;
    const distToGoal = _v1.length();
    if (distToGoal > 0.85) {
      _v1.divideScalar(distToGoal);
    } else {
      _v1.set(0, 0, 0);
    }

    if (activeTarget) {
      const dist = activeTarget.pos.distanceTo(bot.pos);
      const projSpeed = WEAPONS[bot.weaponSlot].projectileSpeed;
      const leadT = isEasy ? 0.1 : Math.min(0.45, dist / Math.max(10, projSpeed));
      const aimX = activeTarget.pos.x + activeTarget.vel.x * leadT - bot.pos.x;
      const aimZ = activeTarget.pos.z + activeTarget.vel.z * leadT - bot.pos.z;
      const targetYaw = Math.atan2(aimX, aimZ);

      let diff = targetYaw - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.yaw += diff * Math.min(1, dt * (isEasy ? 6 : 11));

      if (hasLosToTarget && dist < 24 && bot.aiState === 'engage') {
        const perpX = -aimZ / Math.max(1, Math.hypot(aimX, aimZ));
        const perpZ = aimX / Math.max(1, Math.hypot(aimX, aimZ));
        _v1.x += perpX * bot.aiStrafeDir * (isEasy ? 0.55 : 0.85);
        _v1.z += perpZ * bot.aiStrafeDir * (isEasy ? 0.55 : 0.85);
      }

      if (!titleDemo && dist < 30 && bot.fireCooldown <= 0 && !bot.reloading) {
        if (hasLosToTarget && Math.abs(diff) < 0.35) {
          if (dist < 8 && bot.ammo[1] > 0 && bot.weaponSlot !== 1) {
            bot.weaponSlot = 1;
            bot.rig.setWeapon(1);
          } else if (dist >= 8 && bot.ammo[2] > 0 && bot.weaponSlot !== 2) {
            bot.weaponSlot = 2;
            bot.rig.setWeapon(2);
          }
          if (!isEasy || Math.random() < 0.6) {
            this.tryFire(bot);
            if (isEasy) bot.fireCooldown *= 1.55;
          }
        } else if (
          !isEasy &&
          !hasLosToTarget &&
          dist > 6 &&
          dist < 17 &&
          bot.ammo[3] > 0 &&
          Math.random() < 0.04
        ) {
          const prev = bot.weaponSlot;
          bot.weaponSlot = 3;
          bot.rig.setWeapon(3);
          this.tryFire(bot);
          bot.weaponSlot = prev;
          bot.rig.setWeapon(prev);
        }
      }
    }

    if (_v1.lengthSq() > 0.01) {
      _v1.normalize();
      const lookX = bot.pos.x + _v1.x * 1.45;
      const lookZ = bot.pos.z + _v1.z * 1.45;
      if (this.isBlockedAt(lookX, lookZ, 0.65)) {
        const leftX = -_v1.z;
        const leftZ = _v1.x;
        if (!this.isBlockedAt(bot.pos.x + leftX * 1.45, bot.pos.z + leftZ * 1.45, 0.65)) {
          _v1.set(leftX, 0, leftZ);
        } else {
          _v1.set(-leftX, 0, -leftZ);
        }
      }
    }

    const panicBoost = this.currentMode === 'cueca-king' && !bot.hasCueca && bot.cuecaInPlay ? 1.2 : 1.0;
    const coverHustle =
      bot.aiState === 'seek_cover' || bot.aiState === 'reload_cover' ? 1.12 : 1.0;
    const speedBuff = bot.speedBuffTimer > 0 ? 1.35 : 1.0;
    const diffMult = isEasy ? 0.82 : 1.0;
    const botSpeed =
      6.2 * bot.charDef.stats.speedMult * panicBoost * coverHustle * speedBuff * diffMult;

    if (bot.slipTimer > 0) {
      bot.vel.x = THREE.MathUtils.damp(bot.vel.x, bot.slipVelX, 4, dt);
      bot.vel.z = THREE.MathUtils.damp(bot.vel.z, bot.slipVelZ, 4, dt);
    } else {
      bot.vel.x = THREE.MathUtils.damp(bot.vel.x, _v1.x * botSpeed, 12, dt);
      bot.vel.z = THREE.MathUtils.damp(bot.vel.z, _v1.z * botSpeed, 12, dt);
    }
  }

  private hasLineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    if (!this.mapBuild) return true;
    const dist = a.distanceTo(b);
    const steps = Math.max(6, Math.ceil(dist / 1.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = THREE.MathUtils.lerp(a.x, b.x, t);
      const pz = THREE.MathUtils.lerp(a.z, b.z, t);
      for (const c of this.mapBuild.colliders) {
        if (px >= c.minX && px <= c.maxX && pz >= c.minZ && pz <= c.maxZ && c.height > 1.2) {
          return false;
        }
      }
    }
    return true;
  }

  private stepFighterPhysics(f: Fighter, dt: number): void {
    if (f.fireCooldown > 0) f.fireCooldown -= dt;
    if (f.cuecaGraceTimer > 0) f.cuecaGraceTimer -= dt;
    if (f.slipTimer > 0) f.slipTimer = Math.max(0, f.slipTimer - dt);
    if (f.speedBuffTimer > 0) f.speedBuffTimer = Math.max(0, f.speedBuffTimer - dt);
    if (f.damageBuffTimer > 0) f.damageBuffTimer = Math.max(0, f.damageBuffTimer - dt);
    if (f.shieldBuffTimer > 0) {
      f.shieldBuffTimer = Math.max(0, f.shieldBuffTimer - dt);
      if (f.shieldBuffTimer <= 0) f.rig.setShieldActive(false);
    }
    if (f.hitFlashTimer > 0) {
      f.hitFlashTimer -= dt;
      if (f.hitFlashTimer <= 0) f.rig.setHitFlash(false);
    }

    if (f.reloading) {
      f.reloadTimer -= dt;
      if (f.reloadTimer <= 0) {
        f.reloading = false;
        f.ammo[f.weaponSlot] = WEAPONS[f.weaponSlot].magSize;
      }
    }

    if (f.onGround) {
      f.coyoteTimer = 0.12;
    } else {
      f.coyoteTimer = Math.max(0, f.coyoteTimer - dt);
    }
    if (f.jumpBufferTimer > 0) {
      f.jumpBufferTimer -= dt;
      if (f.coyoteTimer > 0) {
        f.vel.y = 8.4;
        f.onGround = false;
        f.coyoteTimer = 0;
        f.jumpBufferTimer = 0;
        f.squashY = 1.22;
        if (f.isPlayer) soundEngine.playJump();
      }
    }

    f.vel.y -= 24 * dt;

    const radius = 0.5;
    const halfArena = (this.mapBuild?.arenaHalfSize ?? 44) - radius;

    f.pos.x = THREE.MathUtils.clamp(f.pos.x + f.vel.x * dt, -halfArena, halfArena);
    this.resolveCollidersX(f, radius);

    f.pos.z = THREE.MathUtils.clamp(f.pos.z + f.vel.z * dt, -halfArena, halfArena);
    this.resolveCollidersZ(f, radius);

    f.pos.y += f.vel.y * dt;
    if (f.pos.y <= 0) {
      if (!f.onGround && f.vel.y < -3) {
        f.squashY = 0.82;
      }
      f.pos.y = 0;
      f.vel.y = 0;
      f.onGround = true;
    }

    f.squashY = THREE.MathUtils.damp(f.squashY, 1, 14, dt);
    const invXZ = 1 / Math.sqrt(Math.max(0.5, f.squashY));
    f.rig.bodyPivot.scale.set(invXZ, f.squashY, invXZ);

    const horizSpeed = Math.hypot(f.vel.x, f.vel.z);
    f.walkPhase += horizSpeed * dt * 2.2;
    const bob = horizSpeed > 0.4 && f.onGround ? Math.abs(Math.sin(f.walkPhase)) * 0.09 : 0;
    f.rig.bodyPivot.position.y = bob;
    f.rig.leftFoot.position.z = 0.04 + Math.sin(f.walkPhase) * 0.14 * Math.min(1, horizSpeed / 5);
    f.rig.rightFoot.position.z = 0.04 - Math.sin(f.walkPhase) * 0.14 * Math.min(1, horizSpeed / 5);

    // Comical banana-slip tilt & cape flutter!
    if (f.slipTimer > 0) {
      f.rig.bodyPivot.rotation.z = Math.sin(this.clock.elapsedTime * 20) * 0.42;
      f.rig.bodyPivot.rotation.x = -0.25;
    } else {
      f.rig.bodyPivot.rotation.z = THREE.MathUtils.damp(f.rig.bodyPivot.rotation.z, 0, 14, dt);
      f.rig.bodyPivot.rotation.x = THREE.MathUtils.damp(f.rig.bodyPivot.rotation.x, 0, 14, dt);
    }

    if (f.rig.capeMesh) {
      f.rig.capeMesh.rotation.x = 0.24 + Math.min(0.55, horizSpeed * 0.06) + Math.sin(this.clock.elapsedTime * 11) * 0.08;
    }

    const wobbleAmp = f.cuecaDamaged ? 0.38 : 0.06 + Math.min(0.14, horizSpeed * 0.018);
    const wobbleSpeed = f.cuecaDamaged ? 24 : 7;
    const t = this.clock.elapsedTime * wobbleSpeed + f.walkPhase * 0.5;
    f.rig.cuecaHelmet.rotation.z = Math.sin(t) * wobbleAmp;
    f.rig.cuecaHelmet.rotation.x = Math.cos(t * 0.85) * wobbleAmp * 0.65 - Math.min(0.15, horizSpeed * 0.015);
    f.rig.cuecaLeftFlap.rotation.z = 0.35 + Math.sin(t * 1.4) * 0.25;
    f.rig.cuecaRightFlap.rotation.z = -0.35 - Math.sin(t * 1.4) * 0.25;

    if (f.emoteCooldown > 0) f.emoteCooldown = Math.max(0, f.emoteCooldown - dt);
    if (f.aiPendingEmote) {
      f.aiEmoteReplyTimer -= dt;
      if (f.aiEmoteReplyTimer <= 0) {
        const reply = f.aiPendingEmote;
        f.aiPendingEmote = null;
        this.applyFighterEmote(f, reply, 1.9);
      }
    }
    if (f.emoteTimer > 0) {
      f.emoteTimer = Math.max(0, f.emoteTimer - dt);
      const pulse = this.clock.elapsedTime;
      f.rig.emoteSprite.position.y = 2.75 + Math.sin(pulse * 7.5) * 0.12;
      const pop = 1.35 + Math.sin(pulse * 10) * 0.08;
      f.rig.emoteSprite.scale.set(pop, pop, 1);
      f.rig.headGroup.rotation.z = Math.sin(pulse * 12) * 0.16;
      if (f.emoteTimer <= 0) {
        f.activeEmote = null;
        f.rig.setEmote(null);
        f.rig.headGroup.rotation.z = 0;
      }
    }

    f.rig.root.position.set(f.pos.x, 0, f.pos.z);
    f.rig.bodyPivot.position.y += f.pos.y;
    f.rig.shadowMesh.scale.setScalar(Math.max(0.45, 1 - f.pos.y * 0.12));
    f.rig.root.rotation.y = f.yaw;
  }

  private resolveCollidersX(f: Fighter, r: number): void {
    if (!this.mapBuild) return;
    for (const c of this.mapBuild.colliders) {
      if (f.pos.y >= c.height) continue;
      if (f.pos.z + r > c.minZ && f.pos.z - r < c.maxZ) {
        if (f.pos.x + r > c.minX && f.pos.x - r < c.maxX) {
          const distLeft = Math.abs(f.pos.x - c.minX);
          const distRight = Math.abs(c.maxX - f.pos.x);
          f.pos.x = distLeft < distRight ? c.minX - r : c.maxX + r;
          f.vel.x = 0;
          f.slipVelX = -f.slipVelX * 0.5;
        }
      }
    }
  }

  private resolveCollidersZ(f: Fighter, r: number): void {
    if (!this.mapBuild) return;
    for (const c of this.mapBuild.colliders) {
      if (f.pos.y >= c.height) continue;
      if (f.pos.x + r > c.minX && f.pos.x - r < c.maxX) {
        if (f.pos.z + r > c.minZ && f.pos.z - r < c.maxZ) {
          const distFront = Math.abs(f.pos.z - c.minZ);
          const distBack = Math.abs(c.maxZ - f.pos.z);
          f.pos.z = distFront < distBack ? c.minZ - r : c.maxZ + r;
          f.vel.z = 0;
          f.slipVelZ = -f.slipVelZ * 0.5;
        }
      }
    }
  }

  private tryFire(f: Fighter): void {
    if (
      (this.phase !== 'playing' && this.phase !== 'title') ||
      !f.alive ||
      f.hp <= 0 ||
      f.reloading ||
      f.fireCooldown > 0
    ) {
      return;
    }

    const weapon = WEAPONS[f.weaponSlot];
    if (f.ammo[f.weaponSlot] <= 0) {
      f.reloading = true;
      f.reloadTimer = weapon.reloadTime * f.charDef.stats.reloadMult;
      if (f.isPlayer) soundEngine.playReload();
      else this.assignBotCover(f, f.aiThreatPos, 'reload_cover');
      return;
    }

    f.ammo[f.weaponSlot] -= 1;
    const rateBoost = (f.damageBuffTimer > 0 ? 1.25 : 1.0) * f.charDef.stats.fireRateMult;
    f.fireCooldown = 1 / (weapon.fireRate * rateBoost);

    if (f.ammo[f.weaponSlot] === 0 && f.weaponSlot !== 3) {
      f.reloading = true;
      f.reloadTimer = weapon.reloadTime * f.charDef.stats.reloadMult;
      if (f.isPlayer) soundEngine.playReload();
      else this.assignBotCover(f, f.aiThreatPos, 'reload_cover');
    }

    const dirX = Math.sin(f.yaw);
    const dirZ = Math.cos(f.yaw);
    const dmgMult = f.damageBuffTimer > 0 ? 1.45 : 1.0;

    if (weapon.id === 'grenade') {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.35 })
      );
      grp.add(body);
      const pos = new THREE.Vector3(
        f.pos.x + dirX * 0.8,
        f.pos.y + 1.15,
        f.pos.z + dirZ * 0.8
      );
      grp.position.copy(pos);
      this.scene.add(grp);

      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 2.9, 24),
        new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(pos.x, 0.05, pos.z);
      this.scene.add(ringMesh);

      this.grenades.push({
        mesh: grp,
        ringMesh,
        pos,
        vel: new THREE.Vector3(dirX * 14, 7.2, dirZ * 14),
        ownerId: f.id,
        ownerTeam: f.team,
        damageMult: dmgMult,
        fuse: 1.15,
      });
      if (f.isPlayer) soundEngine.playJump();
      return;
    }

    const botSpreadScale = this.currentDifficulty === 'easy' ? 3.8 : 2.1;
    const spread = (Math.random() - 0.5) * weapon.spread * (f.isPlayer ? 1 : botSpreadScale);
    const angle = f.yaw + spread;
    const vx = Math.sin(angle) * weapon.projectileSpeed;
    const vz = Math.cos(angle) * weapon.projectileSpeed;

    const bulletMat = new THREE.MeshBasicMaterial({
      color:
        f.damageBuffTimer > 0
          ? 0xf97316
          : weapon.id === 'pistol'
            ? 0x38bdf8
            : 0xfacc15,
    });
    const mesh = new THREE.Mesh(this.bulletGeo, bulletMat);
    const pos = new THREE.Vector3(
      f.pos.x + Math.sin(f.yaw) * 0.75,
      f.pos.y + 1.28,
      f.pos.z + Math.cos(f.yaw) * 0.75
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);

    this.bullets.push({
      mesh,
      pos,
      vel: new THREE.Vector3(vx, 0, vz),
      ownerId: f.id,
      ownerTeam: f.team,
      weaponId: weapon.id as 'pistol' | 'rifle',
      damage: weapon.damage * dmgMult,
      headshotMult: weapon.headshotMult + f.charDef.stats.headshotMultBonus,
      life: weapon.range / weapon.projectileSpeed,
    });

    if (f.isPlayer) {
      soundEngine.playPuff(weapon.id === 'rifle');
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.08);
    }
  }

  private stepProjectiles(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);

      let remove = b.life <= 0;
      if (!remove && this.mapBuild) {
        const half = this.mapBuild.arenaHalfSize;
        if (Math.abs(b.pos.x) > half || Math.abs(b.pos.z) > half) remove = true;
        for (const c of this.mapBuild.colliders) {
          if (
            b.pos.y <= c.height &&
            b.pos.x >= c.minX &&
            b.pos.x <= c.maxX &&
            b.pos.z >= c.minZ &&
            b.pos.z <= c.maxZ
          ) {
            this.spawnConfetti(b.pos.x, b.pos.y, b.pos.z, 0xfef08a, 4);
            remove = true;
            break;
          }
        }
      }

      if (!remove) {
        for (const target of this.fighters) {
          if (!target.alive || target.id === b.ownerId) continue;
          if (this.currentMode === 'tdm' && target.team === b.ownerTeam) continue;

          const dx = b.pos.x - target.pos.x;
          const dz = b.pos.z - target.pos.z;
          const distXZ = Math.hypot(dx, dz);

          const headCenterY = target.pos.y + 1.46;
          const distToHead = Math.hypot(dx, b.pos.y - headCenterY, dz);
          const isHeadshot = distToHead <= 0.66;
          const isBodyHit =
            distXZ <= 0.48 && b.pos.y >= target.pos.y && b.pos.y <= target.pos.y + 1.05;

          if (isHeadshot || isBodyHit) {
            this.applyHit(b.ownerId, target, b.damage, isHeadshot, b.headshotMult, b.weaponId);
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        this.scene.remove(b.mesh);
        (b.mesh.material as THREE.Material).dispose();
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vel.y -= 22 * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (g.pos.y <= 0.22) {
        g.pos.y = 0.22;
        g.vel.y = Math.abs(g.vel.y) * 0.48;
        g.vel.x *= 0.72;
        g.vel.z *= 0.72;
      }
      if (this.mapBuild) {
        const half = this.mapBuild.arenaHalfSize - 0.3;
        if (Math.abs(g.pos.x) > half) {
          g.pos.x = Math.sign(g.pos.x) * half;
          g.vel.x *= -0.6;
        }
        if (Math.abs(g.pos.z) > half) {
          g.pos.z = Math.sign(g.pos.z) * half;
          g.vel.z *= -0.6;
        }
      }
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 8;
      g.mesh.rotation.z += dt * 6;
      g.ringMesh.position.set(g.pos.x, 0.05, g.pos.z);

      if (g.fuse <= 0) {
        this.explodeGrenade(g);
        this.scene.remove(g.mesh);
        this.scene.remove(g.ringMesh);
        this.grenades.splice(i, 1);
      }
    }
  }

  private explodeGrenade(g: Grenade): void {
    soundEngine.playExplosion();
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.55);
    this.spawnConfetti(g.pos.x, g.pos.y + 0.4, g.pos.z, 0xf43f5e, 18);
    this.spawnConfetti(g.pos.x, g.pos.y + 0.4, g.pos.z, 0xfacc15, 14);

    const radius = 4.2;
    for (const target of this.fighters) {
      if (!target.alive) continue;
      if (this.currentMode === 'tdm' && target.team === g.ownerTeam && target.id !== g.ownerId) {
        continue;
      }
      const dist = target.pos.distanceTo(g.pos);
      if (dist <= radius) {
        const falloff = 1 - dist / radius;
        const dmg = Math.round(WEAPONS[3].damage * g.damageMult * (0.45 + 0.55 * falloff));
        const kx = target.pos.x - g.pos.x;
        const kz = target.pos.z - g.pos.z;
        const kLen = Math.max(0.1, Math.hypot(kx, kz));
        target.vel.x += (kx / kLen) * 11 * falloff;
        target.vel.z += (kz / kLen) * 11 * falloff;
        target.vel.y += 6 * falloff;
        this.applyHit(g.ownerId, target, dmg, dist < 2.1, 1.25, 'grenade');
      }
    }
  }

  private applyHit(
    attackerId: string,
    victim: Fighter,
    baseDamage: number,
    isHeadshot: boolean,
    headshotMult: number,
    weaponId: 'pistol' | 'rifle' | 'grenade'
  ): void {
    const attacker = this.fighters.find((f) => f.id === attackerId);
    const armorFactor = isHeadshot && victim.hasCueca ? 0.72 : 1.0;
    const shieldFactor = victim.shieldBuffTimer > 0 ? 0.5 : 1.0;
    const difficultyFactor =
      victim.isPlayer && !attacker?.isPlayer && this.currentDifficulty === 'easy' ? 0.72 : 1.0;

    const finalDmg = Math.max(
      1,
      Math.round(
        baseDamage *
        (isHeadshot ? headshotMult : 1.0) *
        armorFactor *
        shieldFactor *
        difficultyFactor
      )
    );

    victim.hp = Math.max(0, victim.hp - finalDmg);
    victim.hitFlashTimer = 0.12;
    victim.rig.setHitFlash(true);
    if (attacker && attacker.id !== victim.id) {
      victim.lastAttackerId = attacker.id;
      victim.lastWeaponId = weaponId;
      if (!victim.isPlayer && victim.hp > 0) {
        victim.aiUnderFireTimer = 2.0;
        victim.aiThreatPos.copy(attacker.pos);
        const takeCoverChance = this.currentDifficulty === 'easy' ? 0.65 : 0.9;
        if (
          victim.aiState !== 'reload_cover' &&
          (victim.hp < 78 || Math.random() < takeCoverChance)
        ) {
          this.assignBotCover(victim, attacker.pos, 'seek_cover');
          victim.aiThinkTimer = 0.45;
        }
      }
    }

    if (this.currentMode === 'cueca-king' && attacker) {
      const kx = victim.pos.x - attacker.pos.x;
      const kz = victim.pos.z - attacker.pos.z;
      const kLen = Math.max(0.1, Math.hypot(kx, kz));
      const force = isHeadshot ? 7.5 : 3.8;
      victim.vel.x += (kx / kLen) * force;
      victim.vel.z += (kz / kLen) * force;
      if (isHeadshot && victim.onGround) victim.vel.y = 4.6;
    }

    if (attacker?.isPlayer) {
      this.hitMarkerTimer = 0.18;
      this.hitMarkerHeadshot = isHeadshot;
      if (weaponId === 'grenade') {
        this.recordDailyMetric('grenade_hits', 1);
      }
      if (isHeadshot) {
        soundEngine.playBoingHeadshot();
        this.hitstopTimer = 0.042;
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
        this.recordDailyMetric('total_headshots', 1);
        if (weaponId === 'pistol') {
          this.recordDailyMetric('pistol_headshots', 1);
        }
      } else {
        soundEngine.playBodyHit();
      }
    }

    this.spawnConfetti(
      victim.pos.x,
      victim.pos.y + (isHeadshot ? 1.55 : 0.7),
      victim.pos.z,
      isHeadshot ? 0xfacc15 : 0xfb7185,
      isHeadshot ? 12 : 5
    );

    if (
      victim.isPlayer &&
      this.phase === 'playing' &&
      isHeadshot &&
      victim.hp > 0 &&
      victim.hasCueca &&
      !this.repair.active &&
      victim.cuecaGraceTimer <= 0
    ) {
      const repairTotal = this.currentDifficulty === 'easy' ? 3.8 : 3.0;
      victim.cuecaDamaged = true;
      victim.rig.setCuecaState(true, true);
      const seq = [0, 1, 2].sort(() => Math.random() - 0.5);
      this.repair = {
        active: true,
        timeRemaining: repairTotal,
        totalTime: repairTotal,
        sequence: seq,
        progress: 0,
        wrongShake: 0,
      };
      soundEngine.playRipFail();
      this.emitHud();
    } else if (!victim.isPlayer && isHeadshot && victim.hp > 0 && victim.hasCueca) {
      victim.hasCueca = false;
      victim.cuecaInPlay = this.currentMode === 'cueca-king';
      victim.rig.setCuecaState(false, false);
      this.spawnFlyingCueca(victim.pos, victim.tier, victim.team, victim.id);
      soundEngine.playBoingHeadshot();
    }

    if (victim.hp <= 0) {
      this.handleElimination(attacker, victim, isHeadshot, weaponId);
    }
  }

  private handleElimination(
    attacker: Fighter | undefined,
    victim: Fighter,
    isHeadshot: boolean,
    weaponId: 'pistol' | 'rifle' | 'grenade'
  ): void {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths += 1;
    victim.respawnTimer = 2.6;
    victim.reloading = false;
    victim.reloadTimer = 0;
    victim.jumpBufferTimer = 0;
    victim.slipTimer = 0;
    victim.emoteTimer = 0;
    victim.activeEmote = null;
    victim.aiPendingEmote = null;
    victim.rig.setEmote(null);
    victim.rig.root.visible = false;

    if (victim.isPlayer) {
      this.repair.active = false;
      victim.cuecaDamaged = false;
      this.mouseFireHeld = false;
      this.mobileFireHeld = false;
      this.aimRingMesh.visible = false;
      this.aimLineMesh.visible = false;
    }

    if (victim.hasCueca) {
      victim.hasCueca = false;
      victim.cuecaInPlay = this.currentMode === 'cueca-king';
      this.spawnFlyingCueca(victim.pos, victim.tier, victim.team, victim.id);
    }

    if (isHeadshot) {
      soundEngine.playBoingHeadshot();
    }

    if (attacker && attacker.id !== victim.id) {
      attacker.kills += 1;
      if (isHeadshot) attacker.headshots += 1;
      const pts = isHeadshot ? 120 : 75;
      attacker.score += pts;

      if (!attacker.isPlayer && attacker.alive && Math.random() < 0.48) {
        this.applyFighterEmote(attacker, isHeadshot ? 'cueca' : 'laugh', 1.8);
      }

      if (attacker.isPlayer) {
        this.careerScore = attacker.score;
        try {
          localStorage.setItem(CAREER_SCORE_KEY, String(this.careerScore));
        } catch {
          // ignore
        }
        if (weaponId === 'rifle') {
          this.recordDailyMetric('rifle_kills', 1);
        }
      }

      const newTier = getCuecaTierForScore(attacker.score);
      const hasExclusiveEquipped =
        attacker.isPlayer && this.dailyChallenges.getEquippedCuecaId() !== null;
      if (!hasExclusiveEquipped && newTier.level > attacker.tier.level) {
        attacker.tier = newTier;
        attacker.rig.setCuecaTier(newTier, attacker.team, this.maxAnisotropy);
        if (attacker.isPlayer) {
          soundEngine.playTierUp();
          this.showBanner(`Nova Cueca (${newTier.rarity}): ${newTier.name}!`, 'gold');
        }
      }

      if (this.currentMode === 'tdm') {
        if (attacker.team === 'blue') this.blueScore += 1;
        else if (attacker.team === 'orange') this.orangeScore += 1;
      }

      this.killfeed.unshift({
        id: this.killfeedSeq++,
        killerName: attacker.name,
        victimName: victim.name,
        weaponId,
        headshot: isHeadshot,
        cuecaColor: victim.tier.secondaryColor,
        timestamp: performance.now(),
      });
      if (this.killfeed.length > 4) this.killfeed.pop();
    }

    if (this.phase === 'title') {
      // Quick demo respawn in title screen preview
      victim.respawnTimer = 1.4;
      return;
    }

    if (this.currentMode === 'deathmatch' && attacker && attacker.kills >= 15) {
      this.phase = 'match-over';
      this.mouseFireHeld = false;
      this.mobileFireHeld = false;
      this.clearKillCam();
    } else if (
      this.currentMode === 'tdm' &&
      (this.blueScore >= 20 || this.orangeScore >= 20)
    ) {
      this.phase = 'match-over';
      this.mouseFireHeld = false;
      this.mobileFireHeld = false;
      this.clearKillCam();
    } else if (this.currentMode === 'cueca-king') {
      this.checkCuecaKingRoundEnd();
    }

    if (victim.isPlayer && this.phase === 'playing') {
      this.startKillCam(attacker, victim, isHeadshot, weaponId);
    }
    this.emitHud();
  }

  private checkCuecaKingRoundEnd(): void {
    const contenders = this.fighters.filter(
      (f) => (f.alive && f.hasCueca) || f.cuecaInPlay
    );
    if (contenders.length <= 1) {
      const winner = contenders[0];
      if (winner?.isPlayer) {
        this.roundWinsPlayer += 1;
        winner.score += 150;
        this.careerScore = winner.score;
        try {
          localStorage.setItem(CAREER_SCORE_KEY, String(this.careerScore));
        } catch {
          // ignore
        }
        const newTier = getCuecaTierForScore(winner.score);
        if (this.dailyChallenges.getEquippedCuecaId() === null && newTier.level > winner.tier.level) {
          winner.tier = newTier;
          winner.rig.setCuecaTier(newTier, winner.team, this.maxAnisotropy);
        }
      }
      const winReason = winner
        ? winner.hasCueca
          ? `${winner.name} venceu com a cueca intacta!`
          : `${winner.name} venceu — última cueca no ar!`
        : 'Todas as cuecas caíram juntas!';
      this.endCuecaKingRound(winReason);
    }
  }

  private endCuecaKingRound(text: string): void {
    this.roundWinnerText = text;
    this.phase = 'round-over';
    this.roundOverTimer = 3.0;
    this.repair.active = false;
    this.clearKillCam();
    this.mouseFireHeld = false;
    this.mobileFireHeld = false;
    soundEngine.playTierUp();
    this.emitHud();
  }

  private respawnFighter(f: Fighter): void {
    if (!this.mapBuild) return;
    const sp = this.pickSafeSpawn(f.team, f.id);

    f.pos.copy(sp);
    f.aiLastPos.copy(sp);
    f.aiTargetPos.copy(sp);
    f.vel.set(0, 0, 0);
    f.hp = f.maxHp;
    f.alive = true;
    f.hasCueca = true;
    f.cuecaInPlay = true;
    f.cuecaDamaged = false;
    f.cuecaGraceTimer = 0;
    f.slipTimer = 0;
    f.speedBuffTimer = 0;
    f.damageBuffTimer = 0;
    f.shieldBuffTimer = 0;
    f.reloading = false;
    f.lastAttackerId = null;
    f.aiState = 'engage';
    f.aiUnderFireTimer = 0;
    f.aiHideTimer = 0;
    f.emoteTimer = 0;
    f.activeEmote = null;
    f.aiPendingEmote = null;
    f.rig.setEmote(null);
    f.ammo = {
      1: WEAPONS[1].magSize,
      2: WEAPONS[2].magSize,
      3: WEAPONS[3].magSize + f.charDef.stats.extraGrenade,
    };
    f.rig.root.visible = true;
    f.rig.root.position.copy(f.pos);
    f.rig.setCuecaState(true, false);
    f.rig.setShieldActive(false);

    if (f.isPlayer) {
      this.clearKillCam();
      this.mouseFireHeld = false;
      this.mobileFireHeld = false;
      this.alignCameraBehind(f);
    }
  }

  private spawnFlyingCueca(
    pos: THREE.Vector3,
    tier: CuecaTier,
    team: TeamId,
    ownerId?: string
  ): void {
    const isCuecaKing = this.currentMode === 'cueca-king';
    const mesh = createFlyingCuecaProp(tier, team, this.maxAnisotropy);
    mesh.position.set(pos.x, pos.y + 1.8, pos.z);
    this.scene.add(mesh);
    this.flyingCuecas.push({
      mesh,
      pos: mesh.position.clone(),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        isCuecaKing ? 15.5 + Math.random() * 3 : 11.5,
        (Math.random() - 0.5) * 8
      ),
      rotVel: new THREE.Vector3(8, 13, 9),
      life: isCuecaKing ? 5.0 : 2.2,
      ownerId,
      bounces: 0,
      gravity: isCuecaKing ? 9.5 : 16,
    });
  }

  private spawnConfetti(x: number, y: number, z: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 9,
          3 + Math.random() * 6,
          (Math.random() - 0.5) * 9
        ),
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
      });
    }
  }

  private stepFlyingProps(dt: number): void {
    for (let i = this.flyingCuecas.length - 1; i >= 0; i--) {
      const fc = this.flyingCuecas[i];
      fc.life -= dt;
      fc.vel.y -= fc.gravity * dt;
      fc.pos.addScaledVector(fc.vel, dt);
      if (fc.pos.y < 0.25) {
        fc.pos.y = 0.25;
        fc.bounces += 1;
        fc.vel.y = Math.abs(fc.vel.y) * 0.42;
        fc.vel.x *= 0.6;
        fc.vel.z *= 0.6;

        if (this.currentMode === 'cueca-king' && fc.ownerId && fc.bounces >= 2) {
          const owner = this.fighters.find((f) => f.id === fc.ownerId);
          if (owner && owner.cuecaInPlay && !owner.hasCueca) {
            owner.cuecaInPlay = false;
            owner.alive = false;
            owner.deaths += 1;
            owner.rig.root.visible = false;
            if (owner.isPlayer) {
              this.mouseFireHeld = false;
              this.mobileFireHeld = false;
              this.showBanner('Sua cueca caiu no chão! Eliminado!', 'pink');
            }
            this.spawnConfetti(fc.pos.x, 0.5, fc.pos.z, 0xf43f5e, 10);
            if (this.phase === 'playing') {
              this.checkCuecaKingRoundEnd();
              if (owner.isPlayer && (this.phase as string) === 'playing' && owner.lastAttackerId) {
                const killer = this.fighters.find((x) => x.id === owner.lastAttackerId);
                this.startKillCam(killer, owner, true, owner.lastWeaponId);
              }
            }
          }
        }
      }
      fc.mesh.position.copy(fc.pos);
      fc.mesh.rotation.x += fc.rotVel.x * dt;
      fc.mesh.rotation.y += fc.rotVel.y * dt;
      fc.mesh.rotation.z += fc.rotVel.z * dt;
      if (fc.life <= 0) {
        if (this.currentMode === 'cueca-king' && fc.ownerId) {
          const owner = this.fighters.find((f) => f.id === fc.ownerId);
          if (owner && owner.cuecaInPlay && !owner.hasCueca) {
            owner.cuecaInPlay = false;
            owner.alive = false;
            owner.rig.root.visible = false;
            if (owner.isPlayer) {
              this.mouseFireHeld = false;
              this.mobileFireHeld = false;
            }
            if (this.phase === 'playing') {
              this.checkCuecaKingRoundEnd();
              if (owner.isPlayer && (this.phase as string) === 'playing' && owner.lastAttackerId) {
                const killer = this.fighters.find((x) => x.id === owner.lastAttackerId);
                this.startKillCam(killer, owner, true, owner.lastWeaponId);
              }
            }
          }
        }
        this.scene.remove(fc.mesh);
        fc.mesh.userData.dispose?.();
        this.flyingCuecas.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.vel.y -= 18 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      pt.mesh.scale.setScalar(Math.max(0.01, pt.life / pt.maxLife));
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        (pt.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number): void {
    const p = this.getPlayer();
    if (!p) return;

    if (this.killCam.active) {
      const killer = this.fighters.find((f) => f.id === this.killCam.killerId);
      if (killer && killer.alive) {
        this.killCam.killerPosAtKill.copy(killer.pos);
        this.killCam.killerYawAtKill = killer.yaw;
      }

      const kx = this.killCam.killerPosAtKill.x;
      const ky = this.killCam.killerPosAtKill.y;
      const kz = this.killCam.killerPosAtKill.z;
      const kyaw = this.killCam.killerYawAtKill;

      const kFwdX = Math.sin(kyaw);
      const kFwdZ = Math.cos(kyaw);
      const kRightX = -kFwdZ;
      const kRightZ = kFwdX;

      let backDist = 2.35;
      for (let d = 0.85; d <= 2.35; d += 0.35) {
        const testX = kx - kFwdX * d + kRightX * 0.72;
        const testZ = kz - kFwdZ * d + kRightZ * 0.72;
        if (this.isBlockedAt(testX, testZ, 0.38)) {
          backDist = Math.max(0.6, d - 0.35);
          break;
        }
      }

      const halfArena = (this.mapBuild?.arenaHalfSize ?? 44) - 0.6;
      _camDesired.set(
        THREE.MathUtils.clamp(kx - kFwdX * backDist + kRightX * 0.72, -halfArena, halfArena),
        ky * 0.55 + 2.1,
        THREE.MathUtils.clamp(kz - kFwdZ * backDist + kRightZ * 0.72, -halfArena, halfArena)
      );

      const progress = 1 - this.killCam.timeRemaining / Math.max(0.1, this.killCam.totalTime);
      const aimX = kx + kFwdX * 14;
      const aimZ = kz + kFwdZ * 14;
      const blend = Math.min(0.45, progress * 0.5);
      _camTarget.set(
        THREE.MathUtils.lerp(this.killCam.deathPos.x, aimX, blend),
        THREE.MathUtils.lerp(this.killCam.deathPos.y + 1.15, ky + 1.35, blend),
        THREE.MathUtils.lerp(this.killCam.deathPos.z, aimZ, blend)
      );

      const targetFov = 48 - Math.min(1, progress * 1.35) * 10;
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 8, dt);
        this.camera.updateProjectionMatrix();
      }

      if (this.cameraInitSnap) {
        this.camera.position.copy(_camDesired);
        this.cameraInitSnap = false;
      } else {
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesired.x, 14, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesired.y, 12, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesired.z, 14, dt);
      }

      this.camera.lookAt(_camTarget);
      this.camera.updateMatrixWorld();

      this.keyLight.target.position.set(kx, 0, kz);
      this.keyLight.position.set(kx + 18, 28, kz + 12);
      this.keyLight.target.updateMatrixWorld();
      return;
    }

    if (Math.abs(this.camera.fov - 48) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 48, 12, dt);
      this.camera.updateProjectionMatrix();
    }

    const fwdX = Math.sin(this.cameraYaw);
    const fwdZ = Math.cos(this.cameraYaw);
    const camDist = 9.2;
    const camHeight = 5.3;

    _camTarget.set(p.pos.x + fwdX * 2.8, p.pos.y * 0.45 + 1.35, p.pos.z + fwdZ * 2.8);

    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.9);
    const shakeAmt = this.shakeTrauma * this.shakeTrauma * 0.55;
    const sx = (Math.random() - 0.5) * shakeAmt;
    const sy = (Math.random() - 0.5) * shakeAmt;

    _camDesired.set(
      p.pos.x - fwdX * camDist + sx,
      p.pos.y * 0.55 + camHeight + sy,
      p.pos.z - fwdZ * camDist
    );

    if (this.cameraInitSnap) {
      this.camera.position.copy(_camDesired);
      this.cameraInitSnap = false;
    } else {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesired.x, 22, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesired.y, 16, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesired.z, 22, dt);
    }

    this.camera.lookAt(_camTarget);
    this.camera.updateMatrixWorld();

    this.keyLight.target.position.set(p.pos.x, 0, p.pos.z);
    this.keyLight.position.set(p.pos.x + 18, 28, p.pos.z + 12);
    this.keyLight.target.updateMatrixWorld();
  }

  private updateAimVisuals(): void {
    const p = this.getPlayer();
    if (!p || !p.alive || p.hp <= 0 || this.phase !== 'playing') {
      this.aimRingMesh.visible = false;
      this.aimLineMesh.visible = false;
      return;
    }

    this.aimRingMesh.visible = true;
    this.aimLineMesh.visible = true;

    let tx: number;
    let tz: number;
    if (!this.usingMobileAim && this.hasPointerMoved) {
      this.refreshMouseAimWorld();
      tx = this.mouseAimWorld.x;
      tz = this.mouseAimWorld.z;
    } else {
      tx = p.pos.x + Math.sin(p.yaw) * 7.5;
      tz = p.pos.z + Math.cos(p.yaw) * 7.5;
    }

    this.aimRingMesh.position.set(tx, 0.08, tz);
    const posAttr = this.aimLineGeo.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, p.pos.x, p.pos.y + 1.25, p.pos.z);
    posAttr.setXYZ(1, tx, 0.16, tz);
    posAttr.needsUpdate = true;
  }

  private emitHud(): void {
    const p = this.getPlayer();
    const now = performance.now();
    this.killfeed = this.killfeed.filter((k) => now - k.timestamp < 4200);

    const leaderboard: ScoreEntry[] = [...this.fighters]
      .sort((a, b) => b.score - a.score || b.kills - a.kills)
      .map((f) => ({
        id: f.id,
        name: f.name,
        team: f.team,
        kills: f.kills,
        deaths: f.deaths,
        headshots: f.headshots,
        score: f.score,
        tier: f.tier,
        hasCueca: f.hasCueca,
        isPlayer: f.isPlayer,
      }));

    const challenges = this.dailyChallenges.getChallenges();
    const unlockedIds = this.dailyChallenges.getUnlockedCuecaIds();
    const equippedId = this.dailyChallenges.getEquippedCuecaId();

    this.onHudUpdate({
      phase: this.phase,
      mode: this.currentMode,
      mapId: this.currentMapId,
      difficulty: this.currentDifficulty,
      selectedCharacter: getCharacterById(this.currentCharacterId),
      hp: p ? p.hp : 0,
      maxHp: p ? p.maxHp : 100,
      hasCueca: p ? p.hasCueca : false,
      playerCuecaInPlay: p ? p.cuecaInPlay : false,
      cuecaDamaged: p ? p.cuecaDamaged : false,
      cuecaTier: p ? p.tier : (this.dailyChallenges.getEquippedCueca() ?? getCuecaTierForScore(this.careerScore)),
      nextCuecaTier: p ? getNextCuecaTier(p.score) : getNextCuecaTier(this.careerScore),
      careerScore: this.careerScore,
      score: p ? p.score : this.careerScore,
      kills: p ? p.kills : 0,
      deaths: p ? p.deaths : 0,
      headshots: p ? p.headshots : 0,
      weaponSlot: p ? p.weaponSlot : 1,
      ammo: p ? { ...p.ammo } : { 1: 12, 2: 30, 3: 2 },
      reloading: p ? p.reloading : false,
      reloadProgress:
        p && p.reloading
          ? 1 - p.reloadTimer / (WEAPONS[p.weaponSlot].reloadTime * p.charDef.stats.reloadMult)
          : 0,
      timerSeconds: Math.ceil(this.matchTimer),
      blueScore: this.blueScore,
      orangeScore: this.orangeScore,
      roundNumber: this.roundNumber,
      roundWinsPlayer: this.roundWinsPlayer,
      roundWinnerText: this.roundWinnerText,
      aliveCuecasCount: this.fighters.filter((f) => f.alive && f.hasCueca).length,
      airborneCuecasCount: this.fighters.filter((f) => !f.hasCueca && f.cuecaInPlay).length,
      totalFightersCount: this.fighters.length,
      minimapActors: this.fighters.map((f) => ({
        id: f.id,
        x: f.pos.x,
        z: f.pos.z,
        team: f.team,
        isPlayer: f.isPlayer,
        hasCueca: f.hasCueca,
        alive: f.alive,
      })),
      minimapWalls: this.mapBuild?.minimapWalls || [],
      arenaHalfSize: this.mapBuild?.arenaHalfSize || 44,
      killfeed: [...this.killfeed],
      repair: { ...this.repair, sequence: [...this.repair.sequence] },
      bannerToast: this.bannerToast,
      leaderboard,
      hitMarkerTimer: this.hitMarkerTimer,
      hitMarkerHeadshot: this.hitMarkerHeadshot,
      playerAlive: p ? p.alive : false,
      respawnTimer: p ? Math.ceil(p.respawnTimer) : 0,
      activeBuffs: {
        speedTimer: p ? p.speedBuffTimer : 0,
        damageTimer: p ? p.damageBuffTimer : 0,
        shieldTimer: p ? p.shieldBuffTimer : 0,
        slipTimer: p ? p.slipTimer : 0,
      },
      killCam: {
        active: this.killCam.active,
        killerName: this.killCam.killerName,
        killerRole: this.killCam.killerRole,
        killerFaction: this.killCam.killerFaction,
        killerCuecaName: this.killCam.killerCuecaName,
        killerCuecaColor: this.killCam.killerCuecaColor,
        killerCuecaAccent: this.killCam.killerCuecaAccent,
        weaponName: this.killCam.weaponName,
        headshot: this.killCam.headshot,
        timeRemaining: this.killCam.timeRemaining,
        totalTime: this.killCam.totalTime,
      },
      emoteCooldown: p ? p.emoteCooldown : 0,
      activeEmote: p ? p.activeEmote : null,
      dailyChallenges: challenges.map((c) => ({
        id: c.template.id,
        title: c.template.title,
        description: c.template.description,
        progress: c.progress,
        target: c.template.target,
        completed: c.completed,
        rewardCuecaId: c.rewardCueca.id,
        rewardCuecaName: c.rewardCueca.name,
        rewardCuecaColor: c.rewardCueca.primaryColor,
        rewardCuecaAccent: c.rewardCueca.secondaryColor,
      })),
      unlockedExclusiveCuecaIds: unlockedIds,
      equippedExclusiveCuecaId: equippedId,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    soundEngine.stopMusic();
    this.clearDynamicEntities();
    if (this.mapBuild) {
      this.scene.remove(this.mapBuild.group);
      for (const d of this.mapBuild.disposables) d.dispose();
    }
    this.bulletGeo.dispose();
    this.particleGeo.dispose();
    this.aimRingMesh.geometry.dispose();
    (this.aimRingMesh.material as THREE.Material).dispose();
    this.aimLineGeo.dispose();
    (this.aimLineMesh.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
