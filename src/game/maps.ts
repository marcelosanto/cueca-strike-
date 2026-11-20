import * as THREE from 'three';
import { HazardType, MapBonusSpawn, MapHazardDef, MapId, MapObstacle } from './types';
import {
  createContactShadowTexture,
  createCrateTexture,
  createGroundTexture,
  createHazardStripeTexture,
} from './textures';

export interface ArenaCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export interface MapHazardInstance {
  id: number;
  type: HazardType;
  x: number;
  z: number;
  group: THREE.Group;
  tileTop?: THREE.Mesh;
  springCoil?: THREE.Mesh;
  triggerAnim: number;
  cooldown: number;
}

export interface MapBuildResult {
  group: THREE.Group;
  colliders: ArenaCollider[];
  hazards: MapHazardInstance[];
  bonusSpawns: MapBonusSpawn[];
  arenaHalfSize: number;
  skyColor: number;
  fogDensity: number;
  spawnPoints: {
    blue: THREE.Vector3[];
    orange: THREE.Vector3[];
    ffa: THREE.Vector3[];
  };
  waypoints: THREE.Vector3[];
  minimapWalls: Array<{ x: number; z: number; w: number; d: number }>;
  disposables: Array<{ dispose: () => void }>;
}

interface MapThemeConfig {
  skyColor: number;
  fogDensity: number;
  groundPalette: { base: string; tile: string; accent: string; line: string };
  outerGroundColor: number;
  obstacles: MapObstacle[];
  hazards: MapHazardDef[];
  bonusSpawns: MapBonusSpawn[];
}

const MAP_CONFIGS: Record<MapId, MapThemeConfig> = {
  canteiro: {
    skyColor: 0xffe8c8,
    fogDensity: 0.0055,
    groundPalette: {
      base: '#f2c185',
      tile: '#e7ae6b',
      accent: '#d69049',
      line: '#c9823c',
    },
    outerGroundColor: 0xdba463,
    obstacles: [
      // Mid Double-Door style choke & Xbox crate (Dust2-inspired CS 1.6 proportions)
      { x: -3.8, z: -2, w: 4.4, h: 2.6, d: 1.8, kind: 'wall', color: '#d97706' },
      { x: 3.8, z: 2, w: 4.4, h: 2.6, d: 1.8, kind: 'wall', color: '#d97706' },
      { x: 0, z: 7, w: 2.8, h: 1.8, d: 2.8, kind: 'crate', color: '#e07a38' },
      { x: -1.5, z: -11, w: 3.2, h: 1.5, d: 1.6, kind: 'barrier' },

      // Long A Lane & Bombsite A (East / North-East)
      { x: 18, z: 10, w: 2.2, h: 2.8, d: 14, kind: 'wall', color: '#b45309' },
      { x: 30, z: 12, w: 5.5, h: 1.6, d: 1.8, kind: 'barrier' },
      { x: 28, z: -4, w: 3.2, h: 2.0, d: 3.2, kind: 'crate', color: '#e07a38' },
      { x: 24, z: -22, w: 3.6, h: 2.2, d: 3.6, kind: 'crate', color: '#f59e0b' },
      { x: 32, z: -26, w: 2.8, h: 1.6, d: 2.8, kind: 'pipe', color: '#38bdf8' },
      { x: 14, z: -26, w: 5.0, h: 1.6, d: 1.6, kind: 'barrier' },

      // B Tunnels & Bombsite B (West / North-West)
      { x: -18, z: 10, w: 2.2, h: 2.8, d: 14, kind: 'wall', color: '#b45309' },
      { x: -30, z: 8, w: 4.5, h: 2.0, d: 2.2, kind: 'pipe', color: '#f59e0b' },
      { x: -28, z: -8, w: 3.4, h: 2.2, d: 3.4, kind: 'crate', color: '#d97706' },
      { x: -24, z: -24, w: 3.8, h: 2.2, d: 3.8, kind: 'crate', color: '#e07a38' },
      { x: -34, z: -20, w: 2.4, h: 2.6, d: 8.5, kind: 'wall', color: '#92400e' },
      { x: -14, z: -24, w: 4.8, h: 1.5, d: 1.5, kind: 'barrier' },

      // T-Side & CT-Side Spawn Cover
      { x: -10, z: 28, w: 6.5, h: 1.7, d: 1.8, kind: 'barrier' },
      { x: 10, z: 28, w: 6.5, h: 1.7, d: 1.8, kind: 'barrier' },
      { x: 0, z: 22, w: 3.2, h: 1.9, d: 3.2, kind: 'pipe', color: '#f59e0b' },
      { x: -10, z: -30, w: 6.0, h: 1.7, d: 1.8, kind: 'barrier' },
      { x: 10, z: -30, w: 6.0, h: 1.7, d: 1.8, kind: 'barrier' },
      { x: 0, z: -23, w: 3.4, h: 2.0, d: 3.4, kind: 'crate', color: '#d97706' },
      { x: -33, z: 24, w: 3.5, h: 2.1, d: 3.5, kind: 'crate', color: '#b45309' },
      { x: 33, z: 24, w: 3.5, h: 2.1, d: 3.5, kind: 'crate', color: '#b45309' },
    ],
    hazards: [
      { x: -7, z: 10, type: 'banana' },
      { x: 8, z: -8, type: 'banana' },
      { x: -24, z: -12, type: 'banana' },
      { x: 24, z: 12, type: 'banana' },
      { x: 0, z: -18, type: 'banana' },
      { x: -12, z: -1, type: 'trampoline' },
      { x: 13, z: 4, type: 'trampoline' },
      { x: -24, z: -3, type: 'trampoline' },
      { x: 24, z: -15, type: 'trampoline' },
      { x: 0, z: 16, type: 'trampoline' },
    ],
    bonusSpawns: [
      { x: 0, z: 0, type: 'damage' },
      { x: -13, z: -16, type: 'heal' },
      { x: 13, z: 16, type: 'speed' },
      { x: -30, z: -16, type: 'shield' },
      { x: 30, z: -16, type: 'heal' },
      { x: -30, z: 16, type: 'speed' },
      { x: 30, z: 16, type: 'damage' },
      { x: 0, z: -31, type: 'shield' },
    ],
  },
  mercado: {
    skyColor: 0xffdfd3,
    fogDensity: 0.0055,
    groundPalette: {
      base: '#f6ead7',
      tile: '#ead4b4',
      accent: '#e07a5f',
      line: '#d1b38a',
    },
    outerGroundColor: 0xe2c799,
    obstacles: [
      // Central Bazaar Fountain & Connectors
      { x: 0, z: 0, w: 4.8, h: 1.65, d: 4.8, kind: 'fountain', color: '#38bdf8' },
      { x: -9, z: 0, w: 2.0, h: 2.4, d: 7.0, kind: 'wall', color: '#e76f51' },
      { x: 9, z: 0, w: 2.0, h: 2.4, d: 7.0, kind: 'wall', color: '#e76f51' },

      // 4 Market Quarters with Colorful Striped Awnings
      { x: -20, z: -16, w: 5.2, h: 2.5, d: 3.0, kind: 'awning', color: '#f43f5e' },
      { x: 20, z: 16, w: 5.2, h: 2.5, d: 3.0, kind: 'awning', color: '#10b981' },
      { x: -20, z: 16, w: 5.2, h: 2.5, d: 3.0, kind: 'awning', color: '#f59e0b' },
      { x: 20, z: -16, w: 5.2, h: 2.5, d: 3.0, kind: 'awning', color: '#6366f1' },

      // Market Alley Walls & Fruit Stalls
      { x: -30, z: -4, w: 4.8, h: 2.4, d: 2.8, kind: 'awning', color: '#ec4899' },
      { x: 30, z: 4, w: 4.8, h: 2.4, d: 2.8, kind: 'awning', color: '#06b6d4' },
      { x: -16, z: -29, w: 6.5, h: 2.3, d: 2.2, kind: 'wall', color: '#f4a261' },
      { x: 16, z: 29, w: 6.5, h: 2.3, d: 2.2, kind: 'wall', color: '#f4a261' },
      { x: 16, z: -29, w: 3.6, h: 1.7, d: 3.6, kind: 'crate', color: '#fb7185' },
      { x: -16, z: 29, w: 3.6, h: 1.7, d: 3.6, kind: 'crate', color: '#fb7185' },

      // Mid & Flank Fruit Crates
      { x: 0, z: -16, w: 4.2, h: 1.5, d: 2.2, kind: 'crate', color: '#f97316' },
      { x: 0, z: 16, w: 4.2, h: 1.5, d: 2.2, kind: 'crate', color: '#f97316' },
      { x: -32, z: -24, w: 3.2, h: 1.8, d: 3.2, kind: 'crate', color: '#eab308' },
      { x: 32, z: 24, w: 3.2, h: 1.8, d: 3.2, kind: 'crate', color: '#eab308' },
      { x: -32, z: 24, w: 4.4, h: 1.6, d: 1.8, kind: 'barrier' },
      { x: 32, z: -24, w: 4.4, h: 1.6, d: 1.8, kind: 'barrier' },
    ],
    hazards: [
      { x: -5, z: 8, type: 'banana' },
      { x: 6, z: -8, type: 'banana' },
      { x: -22, z: 4, type: 'banana' },
      { x: 22, z: -4, type: 'banana' },
      { x: 0, z: 24, type: 'banana' },
      { x: -13, z: -10, type: 'trampoline' },
      { x: 13, z: 10, type: 'trampoline' },
      { x: -26, z: -16, type: 'trampoline' },
      { x: 26, z: 16, type: 'trampoline' },
      { x: 0, z: -23, type: 'trampoline' },
    ],
    bonusSpawns: [
      { x: 0, z: -8, type: 'heal' },
      { x: 0, z: 8, type: 'speed' },
      { x: -15, z: 0, type: 'damage' },
      { x: 15, z: 0, type: 'shield' },
      { x: -28, z: -14, type: 'heal' },
      { x: 28, z: 14, type: 'damage' },
      { x: -25, z: 24, type: 'shield' },
      { x: 25, z: -24, type: 'speed' },
    ],
  },
  base: {
    skyColor: 0xdbeafe,
    fogDensity: 0.0055,
    groundPalette: {
      base: '#cbd5e1',
      tile: '#b6c4d4',
      accent: '#64748b',
      line: '#94a3b8',
    },
    outerGroundColor: 0x65a36c,
    obstacles: [
      // Central Helipad Command Bunker
      { x: 0, z: 0, w: 4.4, h: 2.1, d: 4.4, kind: 'bunker', color: '#4d7c0f' },
      { x: -10, z: -8, w: 5.5, h: 1.5, d: 1.6, kind: 'bunker', color: '#84cc16' },
      { x: 10, z: 8, w: 5.5, h: 1.5, d: 1.6, kind: 'bunker', color: '#84cc16' },
      { x: -10, z: 8, w: 5.5, h: 1.5, d: 1.6, kind: 'bunker', color: '#84cc16' },
      { x: 10, z: -8, w: 5.5, h: 1.5, d: 1.6, kind: 'bunker', color: '#84cc16' },

      // West & East Hangar Corridors (Nuke/Aztec style yard)
      { x: -24, z: 0, w: 2.4, h: 2.8, d: 16, kind: 'bunker', color: '#475569' },
      { x: 24, z: 0, w: 2.4, h: 2.8, d: 16, kind: 'bunker', color: '#475569' },
      { x: -34, z: -12, w: 3.4, h: 2.1, d: 3.4, kind: 'crate', color: '#3f6212' },
      { x: -34, z: 12, w: 3.4, h: 2.1, d: 3.4, kind: 'crate', color: '#3f6212' },
      { x: 34, z: -12, w: 3.4, h: 2.1, d: 3.4, kind: 'crate', color: '#3f6212' },
      { x: 34, z: 12, w: 3.4, h: 2.1, d: 3.4, kind: 'crate', color: '#3f6212' },

      // North & South Tactical Trench Barriers
      { x: 0, z: -22, w: 7.0, h: 1.6, d: 1.8, kind: 'barrier' },
      { x: 0, z: 22, w: 7.0, h: 1.6, d: 1.8, kind: 'barrier' },
      { x: -18, z: -24, w: 3.8, h: 2.0, d: 3.8, kind: 'crate', color: '#4d7c0f' },
      { x: 18, z: -24, w: 3.8, h: 2.0, d: 3.8, kind: 'crate', color: '#4d7c0f' },
      { x: -18, z: 24, w: 3.8, h: 2.0, d: 3.8, kind: 'crate', color: '#4d7c0f' },
      { x: 18, z: 24, w: 3.8, h: 2.0, d: 3.8, kind: 'crate', color: '#4d7c0f' },

      { x: -29, z: -29, w: 4.8, h: 1.8, d: 2.2, kind: 'bunker', color: '#64748b' },
      { x: 29, z: 29, w: 4.8, h: 1.8, d: 2.2, kind: 'bunker', color: '#64748b' },
      { x: -29, z: 29, w: 4.8, h: 1.8, d: 2.2, kind: 'bunker', color: '#64748b' },
      { x: 29, z: -29, w: 4.8, h: 1.8, d: 2.2, kind: 'bunker', color: '#64748b' },
    ],
    hazards: [
      { x: -6, z: -15, type: 'banana' },
      { x: 6, z: 15, type: 'banana' },
      { x: -18, z: 0, type: 'banana' },
      { x: 18, z: 0, type: 'banana' },
      { x: 0, z: -30, type: 'banana' },
      { x: -14, z: 14, type: 'trampoline' },
      { x: 14, z: -14, type: 'trampoline' },
      { x: -30, z: 0, type: 'trampoline' },
      { x: 30, z: 0, type: 'trampoline' },
      { x: 0, z: 12, type: 'trampoline' },
    ],
    bonusSpawns: [
      { x: 0, z: 11, type: 'heal' },
      { x: 0, z: -11, type: 'damage' },
      { x: -16, z: -12, type: 'speed' },
      { x: 16, z: 12, type: 'shield' },
      { x: -30, z: -18, type: 'heal' },
      { x: 30, z: 18, type: 'damage' },
      { x: -30, z: 18, type: 'shield' },
      { x: 30, z: -18, type: 'speed' },
    ],
  },
};

function buildBananaHazard(
  def: MapHazardDef,
  id: number,
  shadowTex: THREE.CanvasTexture,
  disposables: Array<{ dispose: () => void }>
): MapHazardInstance {
  const grp = new THREE.Group();
  grp.position.set(def.x, 0, def.z);
  grp.rotation.y = id * 1.1;

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.35,
  });
  const shadowGeo = new THREE.PlaneGeometry(1.4, 1.4);
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.015;
  grp.add(shadowMesh);

  const peelMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.42,
    metalness: 0.05,
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: '#78350f',
    roughness: 0.8,
  });

  const petalGeo = new THREE.BoxGeometry(0.24, 0.07, 0.56);
  const tipGeo = new THREE.BoxGeometry(0.16, 0.07, 0.12);

  for (let i = 0; i < 4; i++) {
    const petalGroup = new THREE.Group();
    petalGroup.rotation.y = (i * Math.PI) / 2 + 0.3;
    const p = new THREE.Mesh(petalGeo, peelMat);
    p.position.set(0, 0.06, 0.28);
    p.rotation.x = 0.16;
    p.castShadow = true;
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, 0.03, 0.56);
    petalGroup.add(p, tip);
    grp.add(petalGroup);
  }

  const stemGeo = new THREE.CylinderGeometry(0.07, 0.11, 0.24, 8);
  const stem = new THREE.Mesh(stemGeo, peelMat);
  stem.position.y = 0.16;
  const stemTip = new THREE.Mesh(tipGeo, tipMat);
  stemTip.position.y = 0.28;
  grp.add(stem, stemTip);

  disposables.push(shadowMat, shadowGeo, peelMat, tipMat, petalGeo, tipGeo, stemGeo);

  return {
    id,
    type: 'banana',
    x: def.x,
    z: def.z,
    group: grp,
    triggerAnim: 0,
    cooldown: 0,
  };
}

function buildTrampolineHazard(
  def: MapHazardDef,
  id: number,
  tileColor: string,
  lineColor: string,
  disposables: Array<{ dispose: () => void }>
): MapHazardInstance {
  const grp = new THREE.Group();
  grp.position.set(def.x, 0, def.z);

  // Recessed floor pit base
  const pitGeo = new THREE.BoxGeometry(2.35, 0.04, 2.35);
  const pitMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85 });
  const pit = new THREE.Mesh(pitGeo, pitMat);
  pit.position.y = 0.01;
  grp.add(pit);

  // Hidden coil spring beneath the disguised floor tile (pops into view on bounce!)
  const springGeo = new THREE.CylinderGeometry(0.45, 0.52, 0.55, 10, 1, true);
  const springMat = new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: 0xf97316,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.6,
    wireframe: true,
  });
  const springCoil = new THREE.Mesh(springGeo, springMat);
  springCoil.position.y = 0.02;
  springCoil.scale.y = 0.05;
  grp.add(springCoil);

  // Disguised tile plate matching floor color with subtle seam tell
  const tileGeo = new THREE.BoxGeometry(2.2, 0.06, 2.2);
  const tileMat = new THREE.MeshStandardMaterial({
    color: tileColor,
    roughness: 0.82,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const tileTop = new THREE.Mesh(tileGeo, tileMat);
  tileTop.position.y = 0.032;
  tileTop.receiveShadow = true;

  // Subtle corner seam border so observant players can spot the hidden spring tile
  const seamGeo = new THREE.RingGeometry(0.75, 0.88, 4);
  seamGeo.rotateX(-Math.PI / 2);
  seamGeo.rotateY(Math.PI / 4);
  const seamMat = new THREE.MeshBasicMaterial({
    color: lineColor,
    transparent: true,
    opacity: 0.6,
  });
  const seam = new THREE.Mesh(seamGeo, seamMat);
  seam.position.y = 0.036;
  tileTop.add(seam);
  grp.add(tileTop);

  disposables.push(pitGeo, pitMat, springGeo, springMat, tileGeo, tileMat, seamGeo, seamMat);

  return {
    id,
    type: 'trampoline',
    x: def.x,
    z: def.z,
    group: grp,
    tileTop,
    springCoil,
    triggerAnim: 0,
    cooldown: 0,
  };
}

function buildObstacleProp(
  obs: MapObstacle,
  crateTex: THREE.CanvasTexture,
  hazardTex: THREE.CanvasTexture,
  shadowTex: THREE.CanvasTexture,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(obs.x, 0, obs.z);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.42,
  });
  const shadowGeo = new THREE.PlaneGeometry(obs.w * 1.32, obs.d * 1.32);
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02;
  grp.add(shadowMesh);
  disposables.push(shadowMat, shadowGeo);

  if (obs.kind === 'crate') {
    const mat = new THREE.MeshStandardMaterial({
      map: crateTex,
      color: obs.color || '#d97706',
      roughness: 0.78,
      metalness: 0.06,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#451a03',
      roughness: 0.45,
      metalness: 0.35,
    });
    const baseGeo = new THREE.BoxGeometry(obs.w, obs.h * 0.75, obs.d);
    const base = new THREE.Mesh(baseGeo, mat);
    base.position.y = (obs.h * 0.75) / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    grp.add(base);

    const topGeo = new THREE.BoxGeometry(obs.w * 0.68, obs.h * 0.35, obs.d * 0.68);
    const top = new THREE.Mesh(topGeo, mat);
    top.position.set(obs.w * 0.08, obs.h * 0.75 + (obs.h * 0.35) / 2, -obs.d * 0.06);
    top.rotation.y = 0.18;
    top.castShadow = true;
    top.receiveShadow = true;
    grp.add(top);

    const bandGeo = new THREE.BoxGeometry(obs.w + 0.06, 0.14, obs.d + 0.06);
    const band = new THREE.Mesh(bandGeo, trimMat);
    band.position.y = obs.h * 0.38;
    grp.add(band);

    disposables.push(mat, trimMat, baseGeo, topGeo, bandGeo);
  } else if (obs.kind === 'barrier') {
    const concreteMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.85,
      metalness: 0.05,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.5,
      metalness: 0.15,
    });
    const postMat = new THREE.MeshStandardMaterial({
      color: '#f97316',
      roughness: 0.35,
      metalness: 0.1,
    });

    const footGeo = new THREE.BoxGeometry(obs.w, obs.h * 0.35, obs.d);
    const foot = new THREE.Mesh(footGeo, concreteMat);
    foot.position.y = (obs.h * 0.35) / 2;
    foot.castShadow = true;
    foot.receiveShadow = true;
    grp.add(foot);

    const wallGeo = new THREE.BoxGeometry(obs.w * 0.94, obs.h * 0.65, obs.d * 0.64);
    const wall = new THREE.Mesh(wallGeo, stripeMat);
    wall.position.y = obs.h * 0.35 + (obs.h * 0.65) / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    grp.add(wall);

    const coneGeo = new THREE.ConeGeometry(0.24, 0.55, 8);
    const coneL = new THREE.Mesh(coneGeo, postMat);
    coneL.position.set(-obs.w * 0.42, obs.h + 0.27, 0);
    const coneR = coneL.clone();
    coneR.position.x = obs.w * 0.42;
    grp.add(coneL, coneR);

    disposables.push(concreteMat, stripeMat, postMat, footGeo, wallGeo, coneGeo);
  } else if (obs.kind === 'pipe') {
    const pipeMat = new THREE.MeshStandardMaterial({
      color: obs.color || '#f59e0b',
      roughness: 0.42,
      metalness: 0.38,
    });
    const cradleMat = new THREE.MeshStandardMaterial({
      color: '#78350f',
      roughness: 0.82,
      metalness: 0.05,
    });
    const cradleGeo = new THREE.BoxGeometry(obs.w, 0.24, obs.d);
    const cradle = new THREE.Mesh(cradleGeo, cradleMat);
    cradle.position.y = 0.12;
    grp.add(cradle);

    const pipeGeo = new THREE.CylinderGeometry(0.46, 0.46, obs.d * 0.96, 14);
    pipeGeo.rotateX(Math.PI / 2);
    const p1 = new THREE.Mesh(pipeGeo, pipeMat);
    p1.position.set(-0.52, 0.66, 0);
    p1.castShadow = true;
    const p2 = new THREE.Mesh(pipeGeo, pipeMat);
    p2.position.set(0.52, 0.66, 0);
    p2.castShadow = true;
    const p3 = new THREE.Mesh(pipeGeo, pipeMat);
    p3.position.set(0, 1.4, 0);
    p3.castShadow = true;
    grp.add(p1, p2, p3);

    disposables.push(pipeMat, cradleMat, cradleGeo, pipeGeo);
  } else if (obs.kind === 'awning') {
    const woodMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.82 });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: obs.color || '#f43f5e',
      roughness: 0.62,
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#fffbeb', roughness: 0.7 });

    const counterGeo = new THREE.BoxGeometry(obs.w, 1.05, obs.d);
    const counter = new THREE.Mesh(counterGeo, woodMat);
    counter.position.y = 0.525;
    counter.castShadow = true;
    counter.receiveShadow = true;
    grp.add(counter);

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, obs.h, 8);
    const offsets = [
      [-obs.w * 0.44, -obs.d * 0.42],
      [obs.w * 0.44, -obs.d * 0.42],
      [-obs.w * 0.44, obs.d * 0.42],
      [obs.w * 0.44, obs.d * 0.42],
    ];
    for (const [px, pz] of offsets) {
      const pole = new THREE.Mesh(poleGeo, woodMat);
      pole.position.set(px, obs.h / 2, pz);
      grp.add(pole);
    }

    const roofGeo = new THREE.BoxGeometry(obs.w + 0.35, 0.2, obs.d + 0.35);
    const roof = new THREE.Mesh(roofGeo, canopyMat);
    roof.position.y = obs.h;
    roof.rotation.x = 0.12;
    roof.castShadow = true;
    grp.add(roof);

    const valanceGeo = new THREE.BoxGeometry(obs.w + 0.36, 0.25, 0.12);
    const valance = new THREE.Mesh(valanceGeo, trimMat);
    valance.position.set(0, obs.h - 0.18, obs.d * 0.52);
    grp.add(valance);

    disposables.push(woodMat, canopyMat, trimMat, counterGeo, poleGeo, roofGeo, valanceGeo);
  } else if (obs.kind === 'fountain') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#f5ebe0', roughness: 0.78 });
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 0.9,
    });
    const rimGeo = new THREE.CylinderGeometry(obs.w * 0.48, obs.w * 0.52, 0.72, 12);
    const rim = new THREE.Mesh(rimGeo, stoneMat);
    rim.position.y = 0.36;
    rim.castShadow = true;
    rim.receiveShadow = true;
    grp.add(rim);

    const waterGeo = new THREE.CylinderGeometry(obs.w * 0.42, obs.w * 0.42, 0.76, 12);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = 0.38;
    grp.add(water);

    const pillarGeo = new THREE.CylinderGeometry(0.32, 0.45, obs.h, 10);
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.y = obs.h / 2;
    pillar.castShadow = true;
    grp.add(pillar);

    const bowlGeo = new THREE.CylinderGeometry(0.95, 0.32, 0.35, 10);
    const bowl = new THREE.Mesh(bowlGeo, stoneMat);
    bowl.position.y = obs.h - 0.1;
    grp.add(bowl);

    disposables.push(stoneMat, waterMat, rimGeo, waterGeo, pillarGeo, bowlGeo);
  } else {
    const mainMat = new THREE.MeshStandardMaterial({
      color: obs.color || '#64748b',
      roughness: 0.85,
      metalness: 0.08,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.65,
      metalness: 0.2,
    });
    const bodyGeo = new THREE.BoxGeometry(obs.w, obs.h * 0.85, obs.d);
    const body = new THREE.Mesh(bodyGeo, mainMat);
    body.position.y = (obs.h * 0.85) / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    grp.add(body);

    const capGeo = new THREE.BoxGeometry(obs.w + 0.16, obs.h * 0.2, obs.d + 0.16);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = obs.h * 0.85 + (obs.h * 0.2) / 2;
    cap.castShadow = true;
    grp.add(cap);

    disposables.push(mainMat, capMat, bodyGeo, capGeo);
  }

  return grp;
}

function buildLowPolyTree(
  x: number,
  z: number,
  scale: number,
  leafColor: number,
  isPalm: boolean,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.72 });

  if (isPalm) {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 3.6, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.8;
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    tree.add(trunk);

    const frondGeo = new THREE.ConeGeometry(0.95, 2.2, 5);
    for (let i = 0; i < 5; i++) {
      const frond = new THREE.Mesh(frondGeo, leafMat);
      frond.position.set(0, 3.6, 0);
      frond.rotation.z = Math.PI / 2.4;
      frond.rotation.y = (i * Math.PI * 2) / 5;
      tree.add(frond);
    }
    disposables.push(trunkMat, leafMat, trunkGeo, frondGeo);
  } else {
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.36, 1.5, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    tree.add(trunk);

    const cone1Geo = new THREE.ConeGeometry(1.4, 2.2, 7);
    const c1 = new THREE.Mesh(cone1Geo, leafMat);
    c1.position.y = 2.3;
    c1.castShadow = true;

    const cone2Geo = new THREE.ConeGeometry(1.05, 1.8, 7);
    const c2 = new THREE.Mesh(cone2Geo, leafMat);
    c2.position.y = 3.4;
    c2.castShadow = true;
    tree.add(c1, c2);

    disposables.push(trunkMat, leafMat, trunkGeo, cone1Geo, cone2Geo);
  }

  return tree;
}

export function buildMapScene(mapId: MapId, maxAnisotropy: number): MapBuildResult {
  const cfg = MAP_CONFIGS[mapId];
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  // Full CS 1.6 tactical arena scale: 88 x 88 units!
  const arenaHalfSize = 44;

  const groundTex = createGroundTexture(cfg.groundPalette, maxAnisotropy);
  groundTex.repeat.set(36, 36);
  const crateTex = createCrateTexture('#ffffff', '#3f2305', maxAnisotropy);
  const hazardTex = createHazardStripeTexture('#facc15', '#1e293b', maxAnisotropy);
  const shadowTex = createContactShadowTexture();
  disposables.push(groundTex, crateTex, hazardTex, shadowTex);

  // Extended outer ground (never floating in an empty void)
  const outerGeo = new THREE.PlaneGeometry(260, 260);
  const outerMat = new THREE.MeshStandardMaterial({
    color: cfg.outerGroundColor,
    roughness: 0.95,
    metalness: 0.0,
  });
  const outerGround = new THREE.Mesh(outerGeo, outerMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.02;
  outerGround.receiveShadow = true;
  group.add(outerGround);
  disposables.push(outerGeo, outerMat);

  // Playable CS 1.6-sized arena floor
  const floorGeo = new THREE.PlaneGeometry(arenaHalfSize * 2, arenaHalfSize * 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  group.add(floor);
  disposables.push(floorGeo, floorMat);

  // Perimeter curb around playable bounds
  const borderMat = new THREE.MeshStandardMaterial({
    color: mapId === 'canteiro' ? '#f59e0b' : mapId === 'mercado' ? '#e76f51' : '#64748b',
    roughness: 0.72,
    metalness: 0.1,
  });
  const curbHorizGeo = new THREE.BoxGeometry(arenaHalfSize * 2 + 1.4, 1.0, 0.9);
  const curbVertGeo = new THREE.BoxGeometry(0.9, 1.0, arenaHalfSize * 2 + 1.4);
  const north = new THREE.Mesh(curbHorizGeo, borderMat);
  north.position.set(0, 0.5, -arenaHalfSize - 0.45);
  const south = new THREE.Mesh(curbHorizGeo, borderMat);
  south.position.set(0, 0.5, arenaHalfSize + 0.45);
  const west = new THREE.Mesh(curbVertGeo, borderMat);
  west.position.set(-arenaHalfSize - 0.45, 0.5, 0);
  const east = new THREE.Mesh(curbVertGeo, borderMat);
  east.position.set(arenaHalfSize + 0.45, 0.5, 0);
  [north, south, west, east].forEach((m) => {
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  });
  disposables.push(borderMat, curbHorizGeo, curbVertGeo);

  // Obstacles & Colliders
  const colliders: ArenaCollider[] = [];
  const minimapWalls: Array<{ x: number; z: number; w: number; d: number }> = [];

  for (const obs of cfg.obstacles) {
    const prop = buildObstacleProp(obs, crateTex, hazardTex, shadowTex, disposables);
    group.add(prop);
    colliders.push({
      minX: obs.x - obs.w / 2,
      maxX: obs.x + obs.w / 2,
      minZ: obs.z - obs.d / 2,
      maxZ: obs.z + obs.d / 2,
      height: obs.h,
    });
    minimapWalls.push({ x: obs.x, z: obs.z, w: obs.w, d: obs.d });
  }

  // Interactive Hazards (Banana Peels & Hidden Floor-Tile Trampolines)
  const hazards: MapHazardInstance[] = [];
  cfg.hazards.forEach((hDef, idx) => {
    const haz =
      hDef.type === 'banana'
        ? buildBananaHazard(hDef, idx, shadowTex, disposables)
        : buildTrampolineHazard(
          hDef,
          idx,
          cfg.groundPalette.tile,
          cfg.groundPalette.line,
          disposables
        );
    group.add(haz.group);
    hazards.push(haz);
  });

  // Natural perimeter scenery outside playable bounds (trees, hills, landmarks)
  const hillMat = new THREE.MeshStandardMaterial({
    color: mapId === 'canteiro' ? '#d49a59' : mapId === 'mercado' ? '#e5b299' : '#4d7c0f',
    roughness: 0.92,
  });
  const hillGeo = new THREE.ConeGeometry(9.5, 7.5, 7);
  disposables.push(hillMat, hillGeo);

  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    const dist = 53 + (i % 3) * 6.5;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    if (i % 3 === 0) {
      const hill = new THREE.Mesh(hillGeo, hillMat);
      hill.position.set(px, 3.0, pz);
      hill.rotation.y = i;
      group.add(hill);
    } else {
      const leafColor =
        mapId === 'mercado' ? 0x22c55e : mapId === 'canteiro' ? 0x84cc16 : 0x15803d;
      const tree = buildLowPolyTree(
        px,
        pz,
        1.1 + (i % 4) * 0.2,
        leafColor,
        mapId === 'mercado',
        disposables
      );
      group.add(tree);
    }
  }

  if (mapId === 'canteiro') {
    const craneMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.45 });
    const towerGeo = new THREE.BoxGeometry(1.8, 22, 1.8);
    const armGeo = new THREE.BoxGeometry(18, 1.2, 1.2);
    const tower = new THREE.Mesh(towerGeo, craneMat);
    tower.position.set(-50, 11, -50);
    const arm = new THREE.Mesh(armGeo, craneMat);
    arm.position.set(-42, 21.5, -50);
    arm.rotation.y = 0.4;
    group.add(tower, arm);
    disposables.push(craneMat, towerGeo, armGeo);
  } else if (mapId === 'base') {
    const padMat = new THREE.MeshBasicMaterial({
      color: '#fef08a',
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const ringGeo = new THREE.RingGeometry(6.0, 6.6, 28);
    const ring = new THREE.Mesh(ringGeo, padMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.01, 0);
    group.add(ring);
    disposables.push(padMat, ringGeo);
  }

  // Well-spaced spawn points across the CS 1.6-sized arena (safe from colliders!)
  const blueSpawns = [
    new THREE.Vector3(-22, 0, -37),
    new THREE.Vector3(0, 0, -38),
    new THREE.Vector3(22, 0, -37),
    new THREE.Vector3(-36, 0, -34),
    new THREE.Vector3(36, 0, -34),
    new THREE.Vector3(-10, 0, -37),
    new THREE.Vector3(10, 0, -37),
  ];

  const orangeSpawns = [
    new THREE.Vector3(-22, 0, 37),
    new THREE.Vector3(0, 0, 38),
    new THREE.Vector3(22, 0, 37),
    new THREE.Vector3(-36, 0, 34),
    new THREE.Vector3(36, 0, 34),
    new THREE.Vector3(-10, 0, 37),
    new THREE.Vector3(10, 0, 37),
  ];

  const ffaSpawns = [
    ...blueSpawns,
    ...orangeSpawns,
    new THREE.Vector3(-38, 0, 0),
    new THREE.Vector3(38, 0, 0),
    new THREE.Vector3(-26, 0, 14),
    new THREE.Vector3(26, 0, -14),
  ];

  // Tactical navigation waypoints in open lanes for smart Bot AI pathing
  const waypoints = [
    new THREE.Vector3(0, 0, 14),
    new THREE.Vector3(0, 0, -14),
    new THREE.Vector3(-12, 0, 0),
    new THREE.Vector3(12, 0, 0),
    new THREE.Vector3(-26, 0, -14),
    new THREE.Vector3(26, 0, -14),
    new THREE.Vector3(-26, 0, 14),
    new THREE.Vector3(26, 0, 14),
    new THREE.Vector3(-36, 0, 0),
    new THREE.Vector3(36, 0, 0),
    new THREE.Vector3(0, 0, -34),
    new THREE.Vector3(0, 0, 34),
    new THREE.Vector3(-28, 0, -34),
    new THREE.Vector3(28, 0, -34),
    new THREE.Vector3(-28, 0, 34),
    new THREE.Vector3(28, 0, 34),
  ];

  return {
    group,
    colliders,
    hazards,
    bonusSpawns: cfg.bonusSpawns,
    arenaHalfSize,
    skyColor: cfg.skyColor,
    fogDensity: cfg.fogDensity,
    spawnPoints: {
      blue: blueSpawns,
      orange: orangeSpawns,
      ffa: ffaSpawns,
    },
    waypoints,
    minimapWalls,
    disposables,
  };
}
