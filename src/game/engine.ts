import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from './audio';
import {
  CharacterRig,
  createBigHeadCharacter,
  createFlyingCuecaProp,
} from './character';
import { ArenaCollider, buildMapScene, MapBuildResult } from './maps';
import {
  CuecaTier,
  GameMode,
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
  // Bot AI fields
  aiTargetPos: THREE.Vector3;
  aiThinkTimer: number;
  aiStrafeDir: number;
}

interface Bullet {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ownerId: string;
  ownerTeam: TeamId;
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

const BOT_NAMES = [
  'Capitão Cueca',
  'Sargento Elástico',
  'Zé Calcinha',
  'Bolinha Tática',
  'Major Algodão',
  'Cabo Sunga',
];

// Reusable math objects (zero GC inside animation loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.15);
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();

// Isometric screen-aligned movement basis for camera at (+15, +19, +15)
const ISO_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const ISO_UP = new THREE.Vector3(-1, 0, -1).normalize();

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
  private phase: HudSnapshot['phase'] = 'title';

  private fighters: Fighter[] = [];
  private bullets: Bullet[] = [];
  private grenades: Grenade[] = [];
  private flyingCuecas: FlyingCueca[] = [];
  private particles: Particle[] = [];
  private killfeed: KillFeedEntry[] = [];
  private killfeedSeq = 1;

  private keys = new Set<string>();
  private mouseFireHeld = false;
  private mobileFireHeld = false;
  private mouseAimWorld = new THREE.Vector3(0, 1.15, 0);
  private mobileMoveVec = new THREE.Vector2(0, 0);
  private mobileAimVec = new THREE.Vector2(0, 0);
  private usingMobileAim = false;

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

  private repair: RepairMinigameState = {
    active: false,
    timeRemaining: 0,
    totalTime: 3.0,
    sequence: [0, 1, 2],
    progress: 0,
    wrongShake: 0,
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
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.5, 160);
    this.camera.position.set(16, 20, 16);
    this.camera.lookAt(0, 0.8, 0);

    // Studio environment reflections (PMREM) on every device
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Warm/cool 3-point cozy daylight lighting
    const hemi = new THREE.HemisphereLight(0xfff1dc, 0x6b4c3b, 0.85);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4d6, 1.55);
    keyLight.position.set(18, 28, 12);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -22;
    keyLight.shadow.camera.right = 22;
    keyLight.shadow.camera.top = 22;
    keyLight.shadow.camera.bottom = -22;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 64;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    rimLight.position.set(-18, 12, -16);
    this.scene.add(rimLight);

    // Aim reticle & sightline
    // Aim reticle & sightline (vertical / facing camera, at chest/head height)
    const ringGeo = new THREE.RingGeometry(0.24, 0.34, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.aimRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.aimRingMesh.position.y = 1.25;
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

    this.loadScenario('canteiro', 'deathmatch', 'title');

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
    canvas.addEventListener('pointermove', this.handlePointerMove);
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
    canvas.removeEventListener('pointermove', this.handlePointerMove);
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

    // Repair Underwear Minigame keyboard shortcuts (Q, E, F)
    if (this.repair.active) {
      if (e.code === 'KeyQ') this.submitRepairNode(0);
      else if (e.code === 'KeyE') this.submitRepairNode(1);
      else if (e.code === 'KeyF') this.submitRepairNode(2);
    }

    if (e.code === 'Digit1') this.switchWeapon(1);
    else if (e.code === 'Digit2') this.switchWeapon(2);
    else if (e.code === 'Digit3') this.switchWeapon(3);
    else if (e.code === 'KeyR') this.triggerReload();
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

    const p = this.getPlayer();
    if (this.phase === 'playing' && p && document.pointerLockElement === this.renderer.domElement) {
      p.yaw -= e.movementX * 0.0032;
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, this.camera);
    _raycaster.ray.intersectPlane(_aimPlane, this.mouseAimWorld);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.phase === 'playing' && document.pointerLockElement !== this.renderer.domElement) {
      this.renderer.domElement.requestPointerLock?.();
    }
    if (e.pointerType === 'touch') return;
    soundEngine.unlock();
    if (this.phase !== 'playing') return;
    this.handlePointerMove(e);
    if (e.button === 0) {
      this.mouseFireHeld = true;
      const player = this.getPlayer();
      if (player) this.tryFire(player);
    } else if (e.button === 2) {
      const player = this.getPlayer();
      if (player) {
        const prev = player.weaponSlot;
        this.switchWeapon(3);
        this.tryFire(player);
        if (player.ammo[3] === 0) this.switchWeapon(prev);
      }
    }
  };

  private handlePointerUp = (): void => {
    this.mouseFireHeld = false;
  };

  // Public API for React UI & Mobile Controls
  public startMatch(mapId: MapId, mode: GameMode): void {
    soundEngine.unlock();
    soundEngine.startMusic();
    this.loadScenario(mapId, mode, 'playing');
  }

  public previewMapOnTitle(mapId: MapId, mode: GameMode): void {
    if (this.phase === 'title') {
      this.loadScenario(mapId, mode, 'title');
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
    this.loadScenario(this.currentMapId, this.currentMode, 'title');
  }

  public switchWeapon(slot: WeaponSlot): void {
    const p = this.getPlayer();
    if (!p || !p.alive || p.weaponSlot === slot) return;
    p.weaponSlot = slot;
    p.reloading = false;
    p.reloadTimer = 0;
    p.rig.setWeapon(slot);
    this.emitHud();
  }

  public triggerReload(): void {
    const p = this.getPlayer();
    if (!p || !p.alive || p.reloading) return;
    const w = WEAPONS[p.weaponSlot];
    if (p.ammo[p.weaponSlot] >= w.magSize) return;
    p.reloading = true;
    p.reloadTimer = w.reloadTime;
    soundEngine.playReload();
    this.emitHud();
  }

  public triggerJump(): void {
    const p = this.getPlayer();
    if (p && p.alive) {
      p.jumpBufferTimer = 0.14;
    }
  }

  public setMobileMove(x: number, y: number): void {
    this.mobileMoveVec.set(x, y);
  }

  public setMobileAim(dx: number, dy: number): void {
    const mag = Math.hypot(dx, dy);
    if (mag > 0.08) {
      this.usingMobileAim = true;
      this.mobileAimVec.set(dx, dy).multiplyScalar(1 / Math.max(1, mag));
    } else {
      this.mobileAimVec.set(0, 0); // soltou o analógico: para de girar
    }
  }

  public setMobileFire(held: boolean): void {
    soundEngine.unlock();
    this.mobileFireHeld = held;
    if (held && this.phase === 'playing') {
      const p = this.getPlayer();
      if (p) this.tryFire(p);
    }
  }

  public submitRepairNode(nodeIndex: number): void {
    if (!this.repair.active || this.phase !== 'playing') return;
    const expected = this.repair.sequence[this.repair.progress];
    if (nodeIndex === expected) {
      soundEngine.playStitchTick(this.repair.progress);
      this.repair.progress += 1;
      if (this.repair.progress >= this.repair.sequence.length) {
        // SUCCESS: Cueca repaired!
        this.repair.active = false;
        const p = this.getPlayer();
        if (p) {
          p.cuecaDamaged = false;
          p.hasCueca = true;
          p.cuecaGraceTimer = 4.0;
          p.rig.setCuecaState(true, false);
          this.spawnConfetti(p.pos.x, 1.9, p.pos.z, 0x22c55e, 14);
        }
        soundEngine.playTierUp();
        this.showBanner('Cueca Costurada! Capacete salvo!', 'mint');
      }
    } else {
      // Small slip feedback without instant punishment
      this.repair.wrongShake = 0.22;
      soundEngine.playBodyHit();
    }
    this.emitHud();
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
  }

  private loadScenario(
    mapId: MapId,
    mode: GameMode,
    targetPhase: HudSnapshot['phase']
  ): void {
    this.currentMapId = mapId;
    this.currentMode = mode;
    this.phase = targetPhase;

    this.clearDynamicEntities();

    if (this.mapBuild) {
      this.scene.remove(this.mapBuild.group);
      for (const d of this.mapBuild.disposables) d.dispose();
    }

    this.mapBuild = buildMapScene(mapId, this.maxAnisotropy);
    this.scene.add(this.mapBuild.group);
    this.scene.background = new THREE.Color(this.mapBuild.skyColor);
    this.scene.fog = new THREE.FogExp2(this.mapBuild.skyColor, this.mapBuild.fogDensity);

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
    this.hitstopTimer = 0;
    this.shakeTrauma = 0;

    this.spawnAllFighters();
    this.emitHud();
  }

  private spawnAllFighters(): void {
    if (!this.mapBuild) return;
    const isTdm = this.currentMode === 'tdm';
    const total = 6;

    for (let i = 0; i < total; i++) {
      const isPlayer = i === 0;
      const team: TeamId = isTdm ? (i < 3 ? 'blue' : 'orange') : 'none';
      const spawnArr = isTdm
        ? team === 'blue'
          ? this.mapBuild.spawnPoints.blue
          : this.mapBuild.spawnPoints.orange
        : this.mapBuild.spawnPoints.ffa;
      const spawn = spawnArr[i % spawnArr.length].clone();

      const tier = isPlayer
        ? getCuecaTierForScore(this.careerScore)
        : getCuecaTierForScore(i * 95);
      const rig = createBigHeadCharacter(team, tier, i, this.maxAnisotropy);
      rig.root.position.copy(spawn);
      this.scene.add(rig.root);

      const fighter: Fighter = {
        id: isPlayer ? 'player' : `bot-${i}`,
        name: isPlayer ? 'Você' : BOT_NAMES[(i - 1) % BOT_NAMES.length],
        isPlayer,
        team,
        rig,
        pos: spawn.clone(),
        vel: new THREE.Vector3(),
        yaw: 0,
        hp: 100,
        maxHp: 100,
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
          3: WEAPONS[3].magSize,
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
        aiTargetPos: new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16),
        aiThinkTimer: 0.4 + Math.random() * 0.6,
        aiStrafeDir: Math.random() > 0.5 ? 1 : -1,
      };
      rig.setWeapon(fighter.weaponSlot);
      this.fighters.push(fighter);
    }
  }

  private getPlayer(): Fighter | undefined {
    return this.fighters[0];
  }

  private resetRoundForCuecaKing(): void {
    if (!this.mapBuild) return;
    this.roundNumber += 1;
    this.matchTimer = 75;
    this.repair.active = false;
    this.fighters.forEach((f, i) => {
      const spawn = this.mapBuild!.spawnPoints.ffa[i % this.mapBuild!.spawnPoints.ffa.length];
      f.pos.copy(spawn);
      f.vel.set(0, 0, 0);
      f.hp = f.maxHp;
      f.alive = true;
      f.hasCueca = true;
      f.cuecaInPlay = true;
      f.cuecaDamaged = false;
      f.cuecaGraceTimer = 0;
      f.reloading = false;
      f.ammo = {
        1: WEAPONS[1].magSize,
        2: WEAPONS[2].magSize,
        3: WEAPONS[3].magSize,
      };
      f.rig.root.visible = true;
      f.rig.root.position.copy(f.pos);
      f.rig.setCuecaState(true, false);
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
      // Atmospheric live world orbit & playful background skirmish
      const t = this.clock.elapsedTime * 0.22;
      this.camera.position.set(Math.cos(t) * 23, 17, Math.sin(t) * 23);
      this.camera.lookAt(0, 1.2, 0);
      this.aimRingMesh.visible = false;
      this.aimLineMesh.visible = false;
      for (let i = 0; i < this.fighters.length; i++) {
        this.stepBotAI(this.fighters[i], dt, true);
        this.stepFighterPhysics(this.fighters[i], dt);
      }
      this.stepProjectiles(dt);
      this.stepFlyingProps(dt);
      return;
    }

    if (this.phase === 'paused' || this.phase === 'match-over') {
      return;
    }

    if (this.phase === 'round-over') {
      this.stepFlyingProps(dt);
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

    // Hitstop freeze-frame on crisp headshots
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateCamera(dt);
      return;
    }

    // Match clock
    this.matchTimer = Math.max(0, this.matchTimer - dt);
    if (this.matchTimer <= 0) {
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

    // Repair Underwear Minigame countdown
    if (this.repair.active) {
      this.repair.timeRemaining -= dt;
      if (this.repair.wrongShake > 0) this.repair.wrongShake = Math.max(0, this.repair.wrongShake - dt);
      if (this.repair.timeRemaining <= 0) {
        this.failRepairMinigame();
      }
    }

    // Cueca King chaotic grenade replenishment
    if (this.currentMode === 'cueca-king') {
      this.grenadeRegenTimer += dt;
      if (this.grenadeRegenTimer >= 6.5) {
        this.grenadeRegenTimer = 0;
        for (const f of this.fighters) {
          if (f.alive && f.ammo[3] < WEAPONS[3].magSize) {
            f.ammo[3] += 1;
          }
        }
      }
    }

    // Fighters
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
        this.stepPlayerInput(f, dt);
      } else {
        this.stepBotAI(f, dt, false);
      }
      this.stepFighterPhysics(f, dt);
    }

    this.stepProjectiles(dt);
    this.stepFlyingProps(dt);
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
      // Cueca is launched into the air! Player stays in play while their flying cueca is airborne!
      p.cuecaInPlay = true;
      this.showBanner('Cueca no Ar! Enquanto não cair, você segue no jogo!', 'pink');
    } else {
      this.showBanner('Cueca Destruída! Ficou Careca!', 'pink');
    }
    this.emitHud();
  }

  private stepPlayerInput(p: Fighter, dt: number): void {
    const moveRight =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.mobileMoveVec.x;
    const moveForward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
      this.mobileMoveVec.y;

    const forwardX = Math.sin(p.yaw);
    const forwardZ = Math.cos(p.yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    _v1.set(
      forwardX * moveForward + rightX * moveRight,
      0,
      forwardZ * moveForward + rightZ * moveRight
    );
    if (_v1.lengthSq() > 1) _v1.normalize();

    const panicBoost = this.currentMode === 'cueca-king' && !p.hasCueca && p.cuecaInPlay ? 1.24 : 1.0;
    const speed = 7.4 * panicBoost;
    const accel = p.onGround ? 18 : 9;
    p.vel.x = THREE.MathUtils.damp(p.vel.x, _v1.x * speed, accel, dt);
    p.vel.z = THREE.MathUtils.damp(p.vel.z, _v1.z * speed, accel, dt);

    // Gira a câmera/personagem no mobile ou quando sem pointer lock
    if (this.usingMobileAim) {
      p.yaw -= this.mobileAimVec.x * dt * 2.8;
    }
    // } else if (document.pointerLockElement !== this.renderer.domElement) {
    //   const dx = this.mouseAimWorld.x - p.pos.x;
    //   const dz = this.mouseAimWorld.z - p.pos.z;
    //   if (dx * dx + dz * dz > 0.04) {
    //     const targetYaw = Math.atan2(dx, dz);
    //     let diff = targetYaw - p.yaw;
    //     while (diff > Math.PI) diff -= Math.PI * 2;
    //     while (diff < -Math.PI) diff += Math.PI * 2;
    //     p.yaw += diff * Math.min(1, dt * 8);
    //   }
    // }

    if (this.mouseFireHeld || this.mobileFireHeld) {
      if (WEAPONS[p.weaponSlot].automatic) {
        this.tryFire(p);
      }
    }
  }

  private stepBotAI(bot: Fighter, dt: number, titleDemo: boolean): void {
    // Pick nearest enemy
    let nearest: Fighter | null = null;
    let bestDist = Infinity;
    for (const other of this.fighters) {
      if (other.id === bot.id || !other.alive) continue;
      if (this.currentMode === 'tdm' && other.team === bot.team) continue;
      const d = bot.pos.distanceToSquared(other.pos);
      if (d < bestDist) {
        bestDist = d;
        nearest = other;
      }
    }

    bot.aiThinkTimer -= dt;
    if (bot.aiThinkTimer <= 0) {
      bot.aiThinkTimer = 0.7 + Math.random() * 0.9;
      bot.aiStrafeDir = Math.random() > 0.5 ? 1 : -1;
      if (nearest && Math.sqrt(bestDist) > 9) {
        bot.aiTargetPos.copy(nearest.pos);
      } else {
        bot.aiTargetPos.set(
          (Math.random() - 0.5) * 26,
          0,
          (Math.random() - 0.5) * 26
        );
      }
    }

    _v1.subVectors(bot.aiTargetPos, bot.pos);
    _v1.y = 0;
    const dist = _v1.length();
    if (dist > 1.2) {
      _v1.divideScalar(dist);
    } else {
      _v1.set(0, 0, 0);
    }

    // Tactical strafe perpendicular to target
    if (nearest) {
      const toEnemyX = nearest.pos.x - bot.pos.x;
      const toEnemyZ = nearest.pos.z - bot.pos.z;
      const targetYaw = Math.atan2(toEnemyX, toEnemyZ);
      // Smoothly turn towards enemy
      let diff = targetYaw - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.yaw += diff * Math.min(1, dt * 8);

      // Strafe blend
      _v1.x += (-toEnemyZ / Math.max(1, Math.hypot(toEnemyX, toEnemyZ))) * bot.aiStrafeDir * 0.55;
      _v1.z += (toEnemyX / Math.max(1, Math.hypot(toEnemyX, toEnemyZ))) * bot.aiStrafeDir * 0.55;
      if (_v1.lengthSq() > 1) _v1.normalize();

      const realDist = Math.sqrt(bestDist);
      if (
        !titleDemo &&
        realDist < 22 &&
        bot.fireCooldown <= 0 &&
        !bot.reloading &&
        this.hasLineOfSight(bot.pos, nearest.pos)
      ) {
        if (realDist < 12 && bot.ammo[3] > 0 && Math.random() < 0.06) {
          bot.weaponSlot = 3;
          bot.rig.setWeapon(3);
          this.tryFire(bot);
          bot.weaponSlot = 2;
          bot.rig.setWeapon(2);
        } else {
          this.tryFire(bot);
        }
      }
    }

    const botSpeed = 5.4;
    bot.vel.x = THREE.MathUtils.damp(bot.vel.x, _v1.x * botSpeed, 10, dt);
    bot.vel.z = THREE.MathUtils.damp(bot.vel.z, _v1.z * botSpeed, 10, dt);
  }

  private hasLineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    if (!this.mapBuild) return true;
    const steps = 8;
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

    // Coyote time & jump buffer
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

    // Gravity
    f.vel.y -= 24 * dt;

    // Move & AABB slide collision
    const radius = 0.5;
    const halfArena = (this.mapBuild?.arenaHalfSize ?? 18) - radius;

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

    // Character squash-stretch, walk bob & Cueca cloth sway!
    f.squashY = THREE.MathUtils.damp(f.squashY, 1, 14, dt);
    const invXZ = 1 / Math.sqrt(Math.max(0.5, f.squashY));
    f.rig.bodyPivot.scale.set(invXZ, f.squashY, invXZ);

    const horizSpeed = Math.hypot(f.vel.x, f.vel.z);
    f.walkPhase += horizSpeed * dt * 2.2;
    const bob = horizSpeed > 0.4 && f.onGround ? Math.abs(Math.sin(f.walkPhase)) * 0.09 : 0;
    f.rig.bodyPivot.position.y = bob;
    f.rig.leftFoot.position.z = 0.04 + Math.sin(f.walkPhase) * 0.14 * Math.min(1, horizSpeed / 5);
    f.rig.rightFoot.position.z = 0.04 - Math.sin(f.walkPhase) * 0.14 * Math.min(1, horizSpeed / 5);

    // Simple cloth physics on the Cueca Helmet (sways with speed & wobbles violently if damaged!)
    const wobbleAmp = f.cuecaDamaged ? 0.38 : 0.06 + Math.min(0.14, horizSpeed * 0.018);
    const wobbleSpeed = f.cuecaDamaged ? 24 : 7;
    const t = this.clock.elapsedTime * wobbleSpeed + f.walkPhase * 0.5;
    f.rig.cuecaHelmet.rotation.z = Math.sin(t) * wobbleAmp;
    f.rig.cuecaHelmet.rotation.x = Math.cos(t * 0.85) * wobbleAmp * 0.65 - Math.min(0.15, horizSpeed * 0.015);
    f.rig.cuecaLeftFlap.rotation.z = 0.35 + Math.sin(t * 1.4) * 0.25;
    f.rig.cuecaRightFlap.rotation.z = -0.35 - Math.sin(t * 1.4) * 0.25;

    f.rig.root.position.set(f.pos.x, 0, f.pos.z);
    f.rig.bodyPivot.position.y += f.pos.y;
    f.rig.shadowMesh.scale.setScalar(Math.max(0.5, 1 - f.pos.y * 0.2));
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
        }
      }
    }
  }

  private tryFire(f: Fighter): void {
    if (!f.alive || f.reloading || f.fireCooldown > 0) return;
    const weapon = WEAPONS[f.weaponSlot];
    if (f.ammo[f.weaponSlot] <= 0) {
      f.reloading = true;
      f.reloadTimer = weapon.reloadTime;
      if (f.isPlayer) soundEngine.playReload();
      return;
    }

    f.ammo[f.weaponSlot] -= 1;
    f.fireCooldown = 1 / weapon.fireRate;
    if (f.ammo[f.weaponSlot] === 0 && f.weaponSlot !== 3) {
      f.reloading = true;
      f.reloadTimer = weapon.reloadTime;
      if (f.isPlayer) soundEngine.playReload();
    }

    const dirX = Math.sin(f.yaw);
    const dirZ = Math.cos(f.yaw);

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
        fuse: 1.15,
      });
      if (f.isPlayer) soundEngine.playJump();
      return;
    }

    // Bullet (Pistol / Rifle)
    const spread = (Math.random() - 0.5) * weapon.spread * (f.isPlayer ? 1 : 2.3);
    const angle = f.yaw + spread;
    const vx = Math.sin(angle) * weapon.projectileSpeed;
    const vz = Math.cos(angle) * weapon.projectileSpeed;

    const bulletMat = new THREE.MeshBasicMaterial({
      color: weapon.id === 'pistol' ? 0x38bdf8 : 0xfacc15,
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
      damage: weapon.damage,
      headshotMult: weapon.headshotMult,
      life: weapon.range / weapon.projectileSpeed,
    });

    if (f.isPlayer) {
      soundEngine.playPuff(weapon.id === 'rifle');
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.08);
    }
  }

  private stepProjectiles(dt: number): void {
    // Bullets
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

          // Big-head headshot check vs body check!
          const headCenterY = target.pos.y + 1.46;
          const distToHead = Math.hypot(dx, b.pos.y - headCenterY, dz);
          const isHeadshot = distToHead <= 0.66;
          const isBodyHit = distXZ <= 0.48 && b.pos.y >= target.pos.y && b.pos.y <= target.pos.y + 1.05;

          if (isHeadshot || isBodyHit) {
            this.applyHit(b.ownerId, target, b.damage, isHeadshot, b.headshotMult, 'rifle');
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

    // Grenades
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
        const dmg = Math.round(WEAPONS[3].damage * (0.45 + 0.55 * falloff));
        // Knockback
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
    const finalDmg = Math.round(
      baseDamage * (isHeadshot ? headshotMult : 1.0) * armorFactor
    );

    victim.hp = Math.max(0, victim.hp - finalDmg);
    victim.hitFlashTimer = 0.12;
    victim.rig.setHitFlash(true);

    // Extra chaotic comical elastic knockback in Cueca King!
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
      if (isHeadshot) {
        soundEngine.playBoingHeadshot();
        this.hitstopTimer = 0.042;
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
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

    // REPAIR UNDERWEAR MINIGAME TRIGGER!
    // When the player's cueca helmet takes a headshot and they survive, trigger the 3-second Repair Minigame!
    if (
      victim.isPlayer &&
      isHeadshot &&
      victim.hp > 0 &&
      victim.hasCueca &&
      !this.repair.active &&
      victim.cuecaGraceTimer <= 0
    ) {
      victim.cuecaDamaged = true;
      victim.rig.setCuecaState(true, true);
      const seq = [0, 1, 2].sort(() => Math.random() - 0.5);
      this.repair = {
        active: true,
        timeRemaining: 3.0,
        totalTime: 3.0,
        sequence: seq,
        progress: 0,
        wrongShake: 0,
      };
      soundEngine.playRipFail();
      this.emitHud();
    } else if (!victim.isPlayer && isHeadshot && victim.hp > 0 && victim.hasCueca) {
      // Bots lose their cueca helmet on headshot so they look hilariously bald too!
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
    victim.deaths += 1;
    victim.respawnTimer = 2.6;
    victim.rig.root.visible = false;

    if (victim.isPlayer) {
      this.repair.active = false;
      victim.cuecaDamaged = false;
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

      if (attacker.isPlayer) {
        this.careerScore = attacker.score;
        try {
          localStorage.setItem(CAREER_SCORE_KEY, String(this.careerScore));
        } catch {
          // ignore storage quota errors
        }
      }

      const newTier = getCuecaTierForScore(attacker.score);
      if (newTier.level > attacker.tier.level) {
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

    // Check win conditions
    if (this.currentMode === 'deathmatch' && attacker && attacker.kills >= 15) {
      this.phase = 'match-over';
    } else if (
      this.currentMode === 'tdm' &&
      (this.blueScore >= 20 || this.orangeScore >= 20)
    ) {
      this.phase = 'match-over';
    } else if (this.currentMode === 'cueca-king') {
      this.checkCuecaKingRoundEnd();
    }
    this.emitHud();
  }

  private checkCuecaKingRoundEnd(): void {
    // A fighter remains in contention if they still have their cueca intact OR their launched cueca is still airborne!
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
        if (newTier.level > winner.tier.level) {
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
    soundEngine.playTierUp();
    this.emitHud();
  }

  private respawnFighter(f: Fighter): void {
    if (!this.mapBuild) return;
    const pool =
      this.currentMode === 'tdm'
        ? f.team === 'blue'
          ? this.mapBuild.spawnPoints.blue
          : this.mapBuild.spawnPoints.orange
        : this.mapBuild.spawnPoints.ffa;
    const sp = pool[Math.floor(Math.random() * pool.length)];

    f.pos.copy(sp);
    f.vel.set(0, 0, 0);
    f.hp = f.maxHp;
    f.alive = true;
    f.hasCueca = true;
    f.cuecaInPlay = true;
    f.cuecaDamaged = false;
    f.cuecaGraceTimer = 0;
    f.reloading = false;
    f.ammo = {
      1: WEAPONS[1].magSize,
      2: WEAPONS[2].magSize,
      3: WEAPONS[3].magSize,
    };
    f.rig.root.visible = true;
    f.rig.root.position.copy(f.pos);
    f.rig.setCuecaState(true, false);
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

        // In Cueca King, once a flying cueca touches down (2nd bounce or settled), that player's cueca is out of play!
        if (this.currentMode === 'cueca-king' && fc.ownerId && fc.bounces >= 2) {
          const owner = this.fighters.find((f) => f.id === fc.ownerId);
          if (owner && owner.cuecaInPlay && !owner.hasCueca) {
            owner.cuecaInPlay = false;
            owner.alive = false;
            owner.deaths += 1;
            owner.rig.root.visible = false;
            this.spawnConfetti(fc.pos.x, 0.5, fc.pos.z, 0xf43f5e, 10);
            if (owner.isPlayer) {
              this.showBanner('Sua cueca caiu no chão! Eliminado!', 'pink');
            }
            if (this.phase === 'playing') {
              this.checkCuecaKingRoundEnd();
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
            if (this.phase === 'playing') this.checkCuecaKingRoundEnd();
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

    const forwardX = Math.sin(p.yaw);
    const forwardZ = Math.cos(p.yaw);
    // Vetor para a direita do personagem (para visão levemente sobre o ombro)
    const rightX = -forwardZ;
    const rightZ = forwardX;

    // Ponto para onde a câmera olha (à frente do jogador, na altura da cabeça/mira)
    _camTarget.set(
      p.pos.x + forwardX * 6.0 + rightX * 0.65,
      p.pos.y + 1.45,
      p.pos.z + forwardZ * 6.0 + rightZ * 0.65
    );

    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.9);
    const shakeAmt = this.shakeTrauma * this.shakeTrauma * 0.55;
    const sx = (Math.random() - 0.5) * shakeAmt;
    const sy = (Math.random() - 0.5) * shakeAmt;

    // Posição da câmera: 6.5 unidades atrás do jogador, 3.2 de altura e 0.85 à direita
    const backDist = 6.5;
    const camHeight = p.pos.y + 3.2;
    const shoulderOffset = 0.85;

    _camDesired.set(
      p.pos.x - forwardX * backDist + rightX * shoulderOffset + sx,
      camHeight + sy,
      p.pos.z - forwardZ * backDist + rightZ * shoulderOffset
    );

    // Evita que a câmera saia para fora das paredes da arena
    const halfArena = (this.mapBuild?.arenaHalfSize ?? 18) - 0.6;
    _camDesired.x = THREE.MathUtils.clamp(_camDesired.x, -halfArena, halfArena);
    _camDesired.z = THREE.MathUtils.clamp(_camDesired.z, -halfArena, halfArena);

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesired.x, 12, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesired.y, 12, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesired.z, 12, dt);
    this.camera.lookAt(_camTarget);
  }

  private updateAimVisuals(): void {
    const p = this.getPlayer();
    if (!p || !p.alive || this.phase !== 'playing') {
      this.aimRingMesh.visible = false;
      this.aimLineMesh.visible = false;
      return;
    }

    this.aimRingMesh.visible = true;
    this.aimLineMesh.visible = true;

    const aimDist = 9.0;
    //is.usingMobileAim
    //: 9.0
    // Math.max(3.5, Math.min(16, Math.hypot(this.mouseAimWorld.x - p.pos.x, this.mouseAimWorld.z - p.pos.z)));

    const aimHeight = p.pos.y + 1.28; // Mesma altura de saída da bala
    const tx = p.pos.x + Math.sin(p.yaw) * aimDist;
    const tz = p.pos.z + Math.cos(p.yaw) * aimDist;

    this.aimRingMesh.position.set(tx, aimHeight, tz);
    this.aimRingMesh.lookAt(this.camera.position);

    const posAttr = this.aimLineGeo.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, p.pos.x + Math.sin(p.yaw) * 0.75, aimHeight, p.pos.z + Math.cos(p.yaw) * 0.75);
    posAttr.setXYZ(1, tx, aimHeight, tz);
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

    this.onHudUpdate({
      phase: this.phase,
      mode: this.currentMode,
      mapId: this.currentMapId,
      hp: p ? p.hp : 0,
      maxHp: p ? p.maxHp : 100,
      hasCueca: p ? p.hasCueca : false,
      playerCuecaInPlay: p ? p.cuecaInPlay : false,
      cuecaDamaged: p ? p.cuecaDamaged : false,
      cuecaTier: p ? p.tier : getCuecaTierForScore(this.careerScore),
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
          ? 1 - p.reloadTimer / WEAPONS[p.weaponSlot].reloadTime
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
      arenaHalfSize: this.mapBuild?.arenaHalfSize || 18,
      killfeed: [...this.killfeed],
      repair: { ...this.repair, sequence: [...this.repair.sequence] },
      bannerToast: this.bannerToast,
      leaderboard,
      hitMarkerTimer: this.hitMarkerTimer,
      hitMarkerHeadshot: this.hitMarkerHeadshot,
      playerAlive: p ? p.alive : false,
      respawnTimer: p ? Math.ceil(p.respawnTimer) : 0,
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
