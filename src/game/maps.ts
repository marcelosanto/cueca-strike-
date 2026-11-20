import * as THREE from 'three';
import { MapId, MapObstacle } from './types';
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

export interface MapBuildResult {
  group: THREE.Group;
  colliders: ArenaCollider[];
  arenaHalfSize: number;
  skyColor: number;
  fogDensity: number;
  spawnPoints: {
    blue: THREE.Vector3[];
    orange: THREE.Vector3[];
    ffa: THREE.Vector3[];
  };
  minimapWalls: Array<{ x: number; z: number; w: number; d: number }>;
  disposables: Array<{ dispose: () => void }>;
}

interface MapThemeConfig {
  skyColor: number;
  fogDensity: number;
  groundPalette: { base: string; tile: string; accent: string; line: string };
  outerGroundColor: number;
  obstacles: MapObstacle[];
}

const ARENA_SCALE = 1.6;

const EXTRA_COVER: MapObstacle[] = [];
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    EXTRA_COVER.push({ x: sx * 19, z: sz * 11, w: 4.0, h: 1.5, d: 1.3, kind: 'barrier' });
    EXTRA_COVER.push({ x: sx * 10, z: sz * 21, w: 1.6, h: 2.0, d: 3.6, kind: 'crate', color: '#d97706' });
    EXTRA_COVER.push({ x: sx * 25, z: sz * 6, w: 2.2, h: 1.8, d: 2.2, kind: 'crate', color: '#b45309' });
    EXTRA_COVER.push({ x: sx * 5, z: sz * 14, w: 2.6, h: 1.5, d: 1.3, kind: 'barrier' });
  }
}

const MAP_CONFIGS: Record<MapId, MapThemeConfig> = {
  canteiro: {
    skyColor: 0xffe8c8,
    fogDensity: 0.011,
    groundPalette: {
      base: '#f2c185',
      tile: '#e7ae6b',
      accent: '#d69049',
      line: '#c9823c',
    },
    outerGroundColor: 0xdba463,
    obstacles: [
      // Center pipe & crate stack
      { x: 0, z: 0, w: 3.2, h: 1.9, d: 3.2, kind: 'crate', color: '#e07a38' },
      { x: -3.2, z: 1.5, w: 2.2, h: 1.4, d: 2.2, kind: 'pipe', color: '#f59e0b' },
      { x: 3.2, z: -1.5, w: 2.2, h: 1.4, d: 2.2, kind: 'pipe', color: '#38bdf8' },
      // Mid lane hazard barriers
      { x: -7.5, z: -5.5, w: 4.2, h: 1.45, d: 1.3, kind: 'barrier' },
      { x: 7.5, z: 5.5, w: 4.2, h: 1.45, d: 1.3, kind: 'barrier' },
      { x: -7.5, z: 5.5, w: 1.5, h: 2.1, d: 3.8, kind: 'crate', color: '#d97706' },
      { x: 7.5, z: -5.5, w: 1.5, h: 2.1, d: 3.8, kind: 'crate', color: '#d97706' },
      // Flank cover
      { x: 0, z: -10.5, w: 5.2, h: 1.6, d: 1.4, kind: 'barrier' },
      { x: 0, z: 10.5, w: 5.2, h: 1.6, d: 1.4, kind: 'barrier' },
      { x: -12.5, z: 0, w: 1.8, h: 2.2, d: 4.4, kind: 'crate', color: '#b45309' },
      { x: 12.5, z: 0, w: 1.8, h: 2.2, d: 4.4, kind: 'crate', color: '#b45309' },
    ],
  },
  mercado: {
    skyColor: 0xffdfd3,
    fogDensity: 0.011,
    groundPalette: {
      base: '#f6ead7',
      tile: '#ead4b4',
      accent: '#e07a5f',
      line: '#d1b38a',
    },
    outerGroundColor: 0xe2c799,
    obstacles: [
      // Central fountain plaza
      { x: 0, z: 0, w: 3.6, h: 1.55, d: 3.6, kind: 'fountain', color: '#38bdf8' },
      // Market stalls with striped awnings
      { x: -7.2, z: -6.2, w: 3.8, h: 2.4, d: 2.4, kind: 'awning', color: '#f43f5e' },
      { x: 7.2, z: 6.2, w: 3.8, h: 2.4, d: 2.4, kind: 'awning', color: '#10b981' },
      { x: -7.2, z: 6.2, w: 3.8, h: 2.4, d: 2.4, kind: 'awning', color: '#f59e0b' },
      { x: 7.2, z: -6.2, w: 3.8, h: 2.4, d: 2.4, kind: 'awning', color: '#6366f1' },
      // Fruit crates
      { x: 0, z: -9.5, w: 3.4, h: 1.4, d: 1.6, kind: 'crate', color: '#fb7185' },
      { x: 0, z: 9.5, w: 3.4, h: 1.4, d: 1.6, kind: 'crate', color: '#fb7185' },
      { x: -12, z: 0, w: 1.8, h: 1.8, d: 4.0, kind: 'wall', color: '#f4a261' },
      { x: 12, z: 0, w: 1.8, h: 1.8, d: 4.0, kind: 'wall', color: '#f4a261' },
    ],
  },
  base: {
    skyColor: 0xdbeafe,
    fogDensity: 0.011,
    groundPalette: {
      base: '#cbd5e1',
      tile: '#b6c4d4',
      accent: '#64748b',
      line: '#94a3b8',
    },
    outerGroundColor: 0x65a36c,
    obstacles: [
      // Central helipad bunker
      { x: 0, z: 0, w: 3.4, h: 1.8, d: 3.4, kind: 'bunker', color: '#4d7c0f' },
      // Sandbag walls & tactical crates
      { x: -7.5, z: -5.5, w: 4.4, h: 1.4, d: 1.4, kind: 'bunker', color: '#84cc16' },
      { x: 7.5, z: 5.5, w: 4.4, h: 1.4, d: 1.4, kind: 'bunker', color: '#84cc16' },
      { x: -7.5, z: 5.5, w: 2.4, h: 2.0, d: 2.4, kind: 'crate', color: '#3f6212' },
      { x: 7.5, z: -5.5, w: 2.4, h: 2.0, d: 2.4, kind: 'crate', color: '#3f6212' },
      { x: 0, z: -10.5, w: 4.6, h: 1.5, d: 1.3, kind: 'barrier' },
      { x: 0, z: 10.5, w: 4.6, h: 1.5, d: 1.3, kind: 'barrier' },
      { x: -12.5, z: 0, w: 2.0, h: 2.1, d: 4.2, kind: 'bunker', color: '#475569' },
      { x: 12.5, z: 0, w: 2.0, h: 2.1, d: 4.2, kind: 'bunker', color: '#475569' },
    ],
  },
};

function buildObstacleProp(
  obs: MapObstacle,
  crateTex: THREE.CanvasTexture,
  hazardTex: THREE.CanvasTexture,
  shadowTex: THREE.CanvasTexture,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(obs.x, 0, obs.z);

  // Soft contact shadow grounded right under the prop
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
  });
  const shadowGeo = new THREE.PlaneGeometry(obs.w * 1.35, obs.d * 1.35);
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02;
  grp.add(shadowMesh);
  disposables.push(shadowMat, shadowGeo);

  if (obs.kind === 'crate') {
    // 3-part stacked crate with corner braces & top cap
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
    // Jersey tactical barrier with hazard stripes + end bollards
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
    // Stacked industrial pipes in cradle
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

    const pipeGeo = new THREE.CylinderGeometry(0.42, 0.42, obs.d * 0.96, 14);
    pipeGeo.rotateX(Math.PI / 2);
    const p1 = new THREE.Mesh(pipeGeo, pipeMat);
    p1.position.set(-0.46, 0.62, 0);
    p1.castShadow = true;
    const p2 = new THREE.Mesh(pipeGeo, pipeMat);
    p2.position.set(0.46, 0.62, 0);
    p2.castShadow = true;
    const p3 = new THREE.Mesh(pipeGeo, pipeMat);
    p3.position.set(0, 1.32, 0);
    p3.castShadow = true;
    grp.add(p1, p2, p3);

    disposables.push(pipeMat, cradleMat, cradleGeo, pipeGeo);
  } else if (obs.kind === 'awning') {
    // Market stall: counter + 4 poles + pitched striped canopy + fruit basket
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
    // Bazaar stone fountain with glowing turquoise water & central spout
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

    const bowlGeo = new THREE.CylinderGeometry(0.85, 0.3, 0.35, 10);
    const bowl = new THREE.Mesh(bowlGeo, stoneMat);
    bowl.position.y = obs.h - 0.1;
    grp.add(bowl);

    disposables.push(stoneMat, waterMat, rimGeo, waterGeo, pillarGeo, bowlGeo);
  } else {
    // Bunker / Wall
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
  const arenaHalfSize = Math.round(18 * ARENA_SCALE);   // 29
  const S = ARENA_SCALE;

  const groundTex = createGroundTexture(cfg.groundPalette, maxAnisotropy);
  const crateTex = createCrateTexture('#ffffff', '#3f2305', maxAnisotropy);
  const hazardTex = createHazardStripeTexture('#facc15', '#1e293b', maxAnisotropy);
  const shadowTex = createContactShadowTexture();
  disposables.push(groundTex, crateTex, hazardTex, shadowTex);

  // Extended outer ground (never floating in an empty void!)
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

  // Playable arena floor
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

  // Cozy low perimeter curb / fence around playable bounds
  const borderMat = new THREE.MeshStandardMaterial({
    color: mapId === 'canteiro' ? '#f59e0b' : mapId === 'mercado' ? '#e76f51' : '#64748b',
    roughness: 0.72,
    metalness: 0.1,
  });
  const curbHorizGeo = new THREE.BoxGeometry(arenaHalfSize * 2 + 1.2, 0.75, 0.75);
  const curbVertGeo = new THREE.BoxGeometry(0.75, 0.75, arenaHalfSize * 2 + 1.2);
  const north = new THREE.Mesh(curbHorizGeo, borderMat);
  north.position.set(0, 0.375, -arenaHalfSize - 0.375);
  const south = new THREE.Mesh(curbHorizGeo, borderMat);
  south.position.set(0, 0.375, arenaHalfSize + 0.375);
  const west = new THREE.Mesh(curbVertGeo, borderMat);
  west.position.set(-arenaHalfSize - 0.375, 0.375, 0);
  const east = new THREE.Mesh(curbVertGeo, borderMat);
  east.position.set(arenaHalfSize + 0.375, 0.375, 0);
  [north, south, west, east].forEach((m) => {
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  });
  disposables.push(borderMat, curbHorizGeo, curbVertGeo);

  // Obstacles & Colliders
  const colliders: ArenaCollider[] = [];
  const minimapWalls: Array<{ x: number; z: number; w: number; d: number }> = [];

  const allObstacles: MapObstacle[] = [
    ...cfg.obstacles.map((o) => ({ ...o, x: o.x * S, z: o.z * S })),
    ...EXTRA_COVER,
  ];

  for (const obs of allObstacles) {
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

  // Natural perimeter scenery outside playable bounds (trees, hills, buildings)
  const hillMat = new THREE.MeshStandardMaterial({
    color: mapId === 'canteiro' ? '#d49a59' : mapId === 'mercado' ? '#e5b299' : '#4d7c0f',
    roughness: 0.92,
  });
  const hillGeo = new THREE.ConeGeometry(7.5, 5.5, 7);
  disposables.push(hillMat, hillGeo);

  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const dist = arenaHalfSize + 6 + (i % 3) * 4.5;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    if (i % 3 === 0) {
      const hill = new THREE.Mesh(hillGeo, hillMat);
      hill.position.set(px, 2.2, pz);
      hill.rotation.y = i;
      group.add(hill);
    } else {
      const leafColor =
        mapId === 'mercado' ? 0x22c55e : mapId === 'canteiro' ? 0x84cc16 : 0x15803d;
      const tree = buildLowPolyTree(
        px,
        pz,
        0.95 + (i % 4) * 0.16,
        leafColor,
        mapId === 'mercado',
        disposables
      );
      group.add(tree);
    }
  }

  // Map-specific landmark outside perimeter
  if (mapId === 'canteiro') {
    // Cozy yellow crane silhouette on the far north-west edge
    const craneMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.45 });
    const towerGeo = new THREE.BoxGeometry(1.4, 14, 1.4);
    const armGeo = new THREE.BoxGeometry(12, 1.0, 1.0);
    const tower = new THREE.Mesh(towerGeo, craneMat);
    tower.position.set(-(arenaHalfSize + 5), 7, -(arenaHalfSize + 5));


    const arm = new THREE.Mesh(armGeo, craneMat);
    arm.position.set(-(arenaHalfSize - 1), 13.5, -(arenaHalfSize + 5));
    arm.rotation.y = 0.4;
    group.add(tower, arm);
    disposables.push(craneMat, towerGeo, armGeo);
  } else if (mapId === 'base') {
    // Helipad ring on the floor + radar tower outside
    const padMat = new THREE.MeshBasicMaterial({
      color: '#fef08a',
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const ringGeo = new THREE.RingGeometry(4.2, 4.7, 24);
    const ring = new THREE.Mesh(ringGeo, padMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.01, 0);
    group.add(ring);
    disposables.push(padMat, ringGeo);
  }

  return {
    group,
    colliders,
    arenaHalfSize,
    skyColor: cfg.skyColor,
    fogDensity: cfg.fogDensity,
    spawnPoints: {
      blue: [
        new THREE.Vector3(-14.5 * S, 0, -14.5 * S),
        new THREE.Vector3(-14.5, 0, 0),
        new THREE.Vector3(-12.5, 0, -14.5),
        new THREE.Vector3(-14.5, 0, 12.5),
      ],
      orange: [
        new THREE.Vector3(14.5, 0, 14.5),
        new THREE.Vector3(14.5, 0, 0),
        new THREE.Vector3(12.5, 0, 14.5),
        new THREE.Vector3(14.5, 0, -12.5),
      ],
      ffa: [
        new THREE.Vector3(-14.5 * S, 0, -14.5 * S),
        new THREE.Vector3(14.5, 0, 14.5),
        new THREE.Vector3(-14.5, 0, 14.5),
        new THREE.Vector3(14.5, 0, -14.5),
        new THREE.Vector3(-4.5, 0, -14.5),
        new THREE.Vector3(4.5, 0, 14.5),
      ],
    },
    minimapWalls,
    disposables,
  };
}
