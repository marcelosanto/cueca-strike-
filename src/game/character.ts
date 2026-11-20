import * as THREE from 'three';
import { CharacterDef, CuecaTier, EmoteId, TeamId, WeaponSlot } from './types';
import { createContactShadowTexture, createCuecaTexture, createEmoteTexture } from './textures';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  cuecaHelmet: THREE.Group;
  cuecaMesh: THREE.Mesh;
  cuecaLeftFlap: THREE.Mesh;
  cuecaRightFlap: THREE.Mesh;
  capeMesh: THREE.Mesh | null;
  shieldAura: THREE.Mesh;
  baldTuft: THREE.Group;
  sweatDrop: THREE.Mesh;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  weaponAnchor: THREE.Group;
  weaponMeshes: Record<WeaponSlot, THREE.Group>;
  mouthMesh: THREE.Mesh;
  leftEyePupil: THREE.Mesh;
  rightEyePupil: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  emoteSprite: THREE.Sprite;
  setCuecaTier: (tier: CuecaTier, team: TeamId, maxAnisotropy: number) => void;
  setWeapon: (slot: WeaponSlot) => void;
  setCuecaState: (hasCueca: boolean, damagedWobble: boolean) => void;
  setHitFlash: (active: boolean) => void;
  setShieldActive: (active: boolean) => void;
  setEmote: (emote: EmoteId | null, maxAnisotropy?: number) => void;
  dispose: () => void;
}

function buildCuecaGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const sideLift = Math.pow(Math.abs(x) / 0.62, 2) * 0.22;
    pos.setY(i, y + sideLift * (1 - y / 0.62));
    pos.setZ(i, z * 0.94);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildWeaponModels(disposables: Array<{ dispose: () => void }>): Record<WeaponSlot, THREE.Group> {
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.32,
    metalness: 0.72,
  });
  const accentBlue = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.4,
    metalness: 0.15,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: '#b45309',
    roughness: 0.75,
    metalness: 0.05,
  });
  const grenadeMat = new THREE.MeshStandardMaterial({
    color: '#f43f5e',
    roughness: 0.35,
    metalness: 0.25,
  });
  disposables.push(metalMat, accentBlue, woodMat, grenadeMat);

  const pistol = new THREE.Group();
  const pBarrelGeo = new THREE.BoxGeometry(0.14, 0.16, 0.46);
  const pGripGeo = new THREE.BoxGeometry(0.12, 0.24, 0.15);
  const pTipGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8);
  pTipGeo.rotateX(Math.PI / 2);
  const pBarrel = new THREE.Mesh(pBarrelGeo, metalMat);
  pBarrel.position.set(0, 0.04, 0.18);
  const pGrip = new THREE.Mesh(pGripGeo, accentBlue);
  pGrip.position.set(0, -0.1, 0.04);
  pGrip.rotation.x = 0.25;
  const pTip = new THREE.Mesh(pTipGeo, accentBlue);
  pTip.position.set(0, 0.04, 0.44);
  pistol.add(pBarrel, pGrip, pTip);
  disposables.push(pBarrelGeo, pGripGeo, pTipGeo);

  const rifle = new THREE.Group();
  const rBodyGeo = new THREE.BoxGeometry(0.15, 0.18, 0.62);
  const rBarrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.42, 8);
  rBarrelGeo.rotateX(Math.PI / 2);
  const rStockGeo = new THREE.BoxGeometry(0.12, 0.16, 0.28);
  const rMagGeo = new THREE.BoxGeometry(0.1, 0.26, 0.13);
  const rBody = new THREE.Mesh(rBodyGeo, metalMat);
  rBody.position.set(0, 0.04, 0.2);
  const rBarrel = new THREE.Mesh(rBarrelGeo, metalMat);
  rBarrel.position.set(0, 0.06, 0.65);
  const rStock = new THREE.Mesh(rStockGeo, woodMat);
  rStock.position.set(0, 0.02, -0.18);
  const rMag = new THREE.Mesh(rMagGeo, woodMat);
  rMag.position.set(0, -0.14, 0.24);
  rMag.rotation.x = -0.22;
  rifle.add(rBody, rBarrel, rStock, rMag);
  disposables.push(rBodyGeo, rBarrelGeo, rStockGeo, rMagGeo);

  const grenade = new THREE.Group();
  const gBodyGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const gCapGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8);
  const gBody = new THREE.Mesh(gBodyGeo, grenadeMat);
  gBody.position.set(0, 0.02, 0.16);
  const gCap = new THREE.Mesh(gCapGeo, metalMat);
  gCap.position.set(0, 0.2, 0.16);
  grenade.add(gBody, gCap);
  disposables.push(gBodyGeo, gCapGeo);

  return { 1: pistol, 2: rifle, 3: grenade };
}

export function createBigHeadCharacter(
  team: TeamId,
  tier: CuecaTier,
  charDef: CharacterDef,
  maxAnisotropy: number
): CharacterRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const shadowTex = createContactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
  });
  const shadowGeo = new THREE.PlaneGeometry(1.55, 1.55);
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.025;
  root.add(shadowMesh);
  disposables.push(shadowTex, shadowMat, shadowGeo);

  // Team tint blends smoothly in TDM while preserving character identity in FFA/Cueca King
  const suitColor =
    team === 'blue'
      ? 0x2563eb
      : team === 'orange'
        ? 0xf97316
        : charDef.suitColor;
  const vestColor =
    team === 'blue'
      ? 0x1e3a8a
      : team === 'orange'
        ? 0x9a3412
        : charDef.vestColor;

  const skinMat = new THREE.MeshStandardMaterial({
    color: charDef.skinTone,
    roughness: 0.65,
    metalness: 0.02,
  });
  const suitMat = new THREE.MeshStandardMaterial({
    color: suitColor,
    roughness: 0.72,
    metalness: 0.05,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: vestColor,
    roughness: 0.52,
    metalness: 0.18,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: charDef.accentColor,
    roughness: 0.35,
    metalness: 0.25,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.2,
  });
  disposables.push(skinMat, suitMat, vestMat, accentMat, shoeMat);

  // Small feet & stubby body (1:2 ratio vs HUGE head!)
  const footGeo = new THREE.BoxGeometry(0.24, 0.16, 0.34);
  const leftFoot = new THREE.Mesh(footGeo, shoeMat);
  leftFoot.position.set(-0.2, 0.08, 0.04);
  leftFoot.castShadow = true;
  const rightFoot = new THREE.Mesh(footGeo, shoeMat);
  rightFoot.position.set(0.2, 0.08, 0.04);
  rightFoot.castShadow = true;
  bodyPivot.add(leftFoot, rightFoot);
  disposables.push(footGeo);

  const torsoGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.62, 10);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.position.y = 0.5;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const vestGeo = new THREE.BoxGeometry(0.64, 0.42, 0.52);
  const vest = new THREE.Mesh(vestGeo, vestMat);
  vest.position.y = 0.54;
  vest.castShadow = true;
  bodyPivot.add(vest);
  disposables.push(torsoGeo, vestGeo);

  const armGeo = new THREE.CapsuleGeometry(0.11, 0.24, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, suitMat);
  leftArm.position.set(-0.4, 0.56, 0.16);
  leftArm.rotation.x = Math.PI / 3;
  leftArm.rotation.z = -0.3;
  const rightArm = new THREE.Mesh(armGeo, suitMat);
  rightArm.position.set(0.4, 0.56, 0.22);
  rightArm.rotation.x = Math.PI / 2.6;
  bodyPivot.add(leftArm, rightArm);
  disposables.push(armGeo);

  const weaponAnchor = new THREE.Group();
  weaponAnchor.position.set(0.32, 0.55, 0.32);
  bodyPivot.add(weaponAnchor);
  const weaponMeshes = buildWeaponModels(disposables);
  weaponAnchor.add(weaponMeshes[1], weaponMeshes[2], weaponMeshes[3]);
  weaponMeshes[2].visible = false;
  weaponMeshes[3].visible = false;

  // HUGE COMICAL HEAD
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.46, 0);
  bodyPivot.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.58, 18, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);
  disposables.push(headGeo);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.8 });
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.8 });
  disposables.push(eyeWhiteMat, pupilMat, browMat, blushMat);

  const eyeGeo = new THREE.SphereGeometry(0.145, 12, 10);
  const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
  leftEye.position.set(-0.2, 0.04, 0.49);
  const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
  rightEye.position.set(0.2, 0.04, 0.49);
  headGroup.add(leftEye, rightEye);

  const pupilGeo = new THREE.SphereGeometry(0.068, 10, 8);
  const leftEyePupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftEyePupil.position.set(-0.2, 0.04, 0.61);
  const rightEyePupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightEyePupil.position.set(0.2, 0.04, 0.61);
  headGroup.add(leftEyePupil, rightEyePupil);

  const browGeo = new THREE.BoxGeometry(0.22, 0.055, 0.08);
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-0.2, 0.21, 0.54);
  leftBrow.rotation.z = charDef.faction === 'villains' ? 0.34 : -0.24;
  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(0.2, 0.21, 0.54);
  rightBrow.rotation.z = charDef.faction === 'villains' ? -0.34 : 0.24;
  headGroup.add(leftBrow, rightBrow);

  const cheekGeo = new THREE.SphereGeometry(0.075, 8, 8);
  const cheekL = new THREE.Mesh(cheekGeo, blushMat);
  cheekL.scale.set(1.2, 0.7, 0.5);
  cheekL.position.set(-0.34, -0.1, 0.46);
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.34;
  headGroup.add(cheekL, cheekR);

  const mouthGeo = new THREE.BoxGeometry(0.22, 0.09, 0.08);
  const mouthMesh = new THREE.Mesh(mouthGeo, pupilMat);
  mouthMesh.position.set(0, -0.22, 0.53);
  headGroup.add(mouthMesh);
  disposables.push(eyeGeo, pupilGeo, browGeo, cheekGeo, mouthGeo);

  // BESPOKE HERO & VILLAIN ACCESSORIES (super visible from behind-the-player chase camera!)
  let capeMesh: THREE.Mesh | null = null;
  const acc = charDef.accessory;

  if (acc === 'cape-hero' || acc === 'banana-king') {
    const capeGeo = new THREE.BoxGeometry(0.68, 0.78, 0.06);
    const capeMat = new THREE.MeshStandardMaterial({
      color: acc === 'cape-hero' ? '#f43f5e' : '#eab308',
      roughness: 0.65,
    });
    capeMesh = new THREE.Mesh(capeGeo, capeMat);
    capeMesh.position.set(0, 0.48, -0.36);
    capeMesh.rotation.x = 0.24;
    capeMesh.castShadow = true;
    bodyPivot.add(capeMesh);
    disposables.push(capeGeo, capeMat);

    if (acc === 'cape-hero') {
      const maskGeo = new THREE.BoxGeometry(0.68, 0.16, 0.12);
      const mask = new THREE.Mesh(maskGeo, accentMat);
      mask.position.set(0, 0.05, 0.52);
      headGroup.add(mask);
      disposables.push(maskGeo);
    } else {
      // Banana badge on back of cape
      const bBadgeGeo = new THREE.TorusGeometry(0.14, 0.04, 6, 12, Math.PI * 1.1);
      const bBadgeMat = new THREE.MeshStandardMaterial({ color: '#fef08a', roughness: 0.4 });
      const bBadge = new THREE.Mesh(bBadgeGeo, bBadgeMat);
      bBadge.position.set(0, 0.52, -0.41);
      bBadge.rotation.z = 0.5;
      bodyPivot.add(bBadge);
      disposables.push(bBadgeGeo, bBadgeMat);
    }
  } else if (acc === 'speed-visor') {
    const visorGeo = new THREE.BoxGeometry(0.66, 0.14, 0.16);
    const visorMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: 0x06b6d4,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.05, 0.52);
    headGroup.add(visor);
    // Ear speed-wings (readable from behind!)
    const wingGeo = new THREE.BoxGeometry(0.08, 0.22, 0.34);
    const wL = new THREE.Mesh(wingGeo, accentMat);
    wL.position.set(-0.62, 0.06, -0.05);
    wL.rotation.x = 0.35;
    const wR = wL.clone();
    wR.position.x = 0.62;
    headGroup.add(wL, wR);
    disposables.push(visorGeo, visorMat, wingGeo);
  } else if (acc === 'fire-tank') {
    const tankGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.52, 10);
    const tankMat = new THREE.MeshStandardMaterial({
      color: '#facc15',
      roughness: 0.3,
      metalness: 0.5,
    });
    const tankL = new THREE.Mesh(tankGeo, tankMat);
    tankL.position.set(-0.15, 0.54, -0.34);
    const tankR = tankL.clone();
    tankR.position.x = 0.15;
    bodyPivot.add(tankL, tankR);
    disposables.push(tankGeo, tankMat);
  } else if (acc === 'ninja-band') {
    const bandGeo = new THREE.CylinderGeometry(0.59, 0.59, 0.12, 16, 1, true);
    const bandMat = new THREE.MeshStandardMaterial({
      color: '#f43f5e',
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.18;
    const tailGeo = new THREE.BoxGeometry(0.1, 0.38, 0.04);
    const tailL = new THREE.Mesh(tailGeo, bandMat);
    tailL.position.set(-0.08, 0.02, -0.62);
    tailL.rotation.set(0.35, 0, -0.25);
    const tailR = new THREE.Mesh(tailGeo, bandMat);
    tailR.position.set(0.08, 0.02, -0.62);
    tailR.rotation.set(0.35, 0, 0.25);
    headGroup.add(band, tailL, tailR);
    disposables.push(bandGeo, bandMat, tailGeo);
  } else if (acc === 'mad-goggles') {
    const rimGeo = new THREE.TorusGeometry(0.16, 0.035, 8, 16);
    const gMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.75, roughness: 0.25 });
    const gL = new THREE.Mesh(rimGeo, gMat);
    gL.position.set(-0.2, 0.04, 0.56);
    const gR = new THREE.Mesh(rimGeo, gMat);
    gR.position.set(0.2, 0.04, 0.56);
    const antGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6);
    const ant = new THREE.Mesh(antGeo, accentMat);
    ant.position.set(0.25, 0.65, -0.2);
    headGroup.add(gL, gR, ant);
    disposables.push(rimGeo, gMat, antGeo);
  } else if (acc === 'devil-horns') {
    const hornGeo = new THREE.ConeGeometry(0.11, 0.36, 8);
    const hornMat = new THREE.MeshStandardMaterial({ color: '#1e1b2e', roughness: 0.4 });
    const hL = new THREE.Mesh(hornGeo, hornMat);
    hL.position.set(-0.42, 0.42, 0.05);
    hL.rotation.z = 0.55;
    const hR = new THREE.Mesh(hornGeo, hornMat);
    hR.position.set(0.42, 0.42, 0.05);
    hR.rotation.z = -0.55;
    // Villain dark cape
    const capeGeo = new THREE.BoxGeometry(0.68, 0.74, 0.06);
    const capeMat = new THREE.MeshStandardMaterial({ color: '#4c0519', roughness: 0.7 });
    capeMesh = new THREE.Mesh(capeGeo, capeMat);
    capeMesh.position.set(0, 0.48, -0.36);
    capeMesh.rotation.x = 0.22;
    bodyPivot.add(capeMesh);
    headGroup.add(hL, hR);
    disposables.push(hornGeo, hornMat, capeGeo, capeMat);
  } else if (acc === 'cyber-eye') {
    const cyGeo = new THREE.SphereGeometry(0.165, 12, 10);
    const cyMat = new THREE.MeshStandardMaterial({
      color: '#f43f5e',
      emissive: 0xf43f5e,
      emissiveIntensity: 0.85,
      roughness: 0.15,
    });
    const cyEye = new THREE.Mesh(cyGeo, cyMat);
    cyEye.position.set(0.2, 0.04, 0.5);
    const packGeo = new THREE.BoxGeometry(0.42, 0.44, 0.22);
    const pack = new THREE.Mesh(packGeo, vestMat);
    pack.position.set(0, 0.54, -0.32);
    bodyPivot.add(pack);
    headGroup.add(cyEye);
    disposables.push(cyGeo, cyMat, packGeo);
  }

  // Translucent Shield Aura (shown when Shield bonus pickup is active)
  const auraGeo = new THREE.SphereGeometry(1.18, 16, 12);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.22,
    wireframe: true,
    depthWrite: false,
  });
  const shieldAura = new THREE.Mesh(auraGeo, auraMat);
  shieldAura.position.y = 1.05;
  shieldAura.visible = false;
  bodyPivot.add(shieldAura);
  disposables.push(auraGeo, auraMat);

  // Bald-head comic hair tuft + sweat drop
  const baldTuft = new THREE.Group();
  const strandGeo = new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI * 1.2);
  const s1 = new THREE.Mesh(strandGeo, browMat);
  s1.position.set(0, 0.58, 0.04);
  const s2 = new THREE.Mesh(strandGeo, browMat);
  s2.position.set(-0.06, 0.57, 0);
  s2.rotation.y = 0.6;
  baldTuft.add(s1, s2);
  baldTuft.visible = false;
  headGroup.add(baldTuft);

  const sweatMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.1,
  });
  const sweatGeo = new THREE.ConeGeometry(0.06, 0.16, 8);
  const sweatDrop = new THREE.Mesh(sweatGeo, sweatMat);
  sweatDrop.position.set(0.48, 0.35, 0.25);
  sweatDrop.rotation.z = -0.35;
  sweatDrop.visible = false;
  headGroup.add(sweatDrop);
  disposables.push(strandGeo, sweatMat, sweatGeo);

  // THE HERO ELEMENT: CUECA HELMET ON TOP OF THE GIANT HEAD!
  const cuecaHelmet = new THREE.Group();
  cuecaHelmet.position.set(0, 0.16, 0);
  headGroup.add(cuecaHelmet);

  const teamBand =
    team === 'blue' ? '#2563eb' : team === 'orange' ? '#f97316' : undefined;
  const cuecaTex = createCuecaTexture(tier, teamBand, maxAnisotropy);
  const cuecaMat = new THREE.MeshStandardMaterial({
    map: cuecaTex,
    roughness: 0.72,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const cuecaGeo = buildCuecaGeometry();
  const cuecaMesh = new THREE.Mesh(cuecaGeo, cuecaMat);
  cuecaMesh.castShadow = true;
  cuecaHelmet.add(cuecaMesh);

  const bandMat = new THREE.MeshStandardMaterial({
    color: teamBand || tier.secondaryColor,
    roughness: 0.5,
  });
  const bandGeo = new THREE.TorusGeometry(0.61, 0.055, 8, 20);
  bandGeo.rotateX(Math.PI / 2);
  const bandMesh = new THREE.Mesh(bandGeo, bandMat);
  bandMesh.position.y = 0.04;
  cuecaHelmet.add(bandMesh);

  const flapGeo = new THREE.BoxGeometry(0.18, 0.22, 0.34);
  const cuecaLeftFlap = new THREE.Mesh(flapGeo, cuecaMat);
  cuecaLeftFlap.position.set(-0.56, 0.02, -0.05);
  cuecaLeftFlap.rotation.z = 0.35;
  const cuecaRightFlap = new THREE.Mesh(flapGeo, cuecaMat);
  cuecaRightFlap.position.set(0.56, 0.02, -0.05);
  cuecaRightFlap.rotation.z = -0.35;
  cuecaHelmet.add(cuecaLeftFlap, cuecaRightFlap);

  const crownOrnament = new THREE.Group();
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xb45309,
    emissiveIntensity: 0.35,
    metalness: 0.85,
    roughness: 0.2,
  });
  const crownBaseGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.16, 6);
  const crownBase = new THREE.Mesh(crownBaseGeo, crownMat);
  crownOrnament.add(crownBase);
  const spikeGeo = new THREE.ConeGeometry(0.06, 0.16, 5);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, crownMat);
    spike.position.set(Math.cos(a) * 0.15, 0.14, Math.sin(a) * 0.15);
    crownOrnament.add(spike);
  }
  crownOrnament.position.set(0, 0.68, 0);
  crownOrnament.visible = Boolean(tier.hasCrown);
  cuecaHelmet.add(crownOrnament);

  disposables.push(cuecaMat, cuecaGeo, bandMat, bandGeo, flapGeo, crownMat, crownBaseGeo, spikeGeo);

  const emoteMat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: false,
  });
  const emoteSprite = new THREE.Sprite(emoteMat);
  emoteSprite.position.set(0, 2.72, 0);
  emoteSprite.scale.set(1.35, 1.35, 1);
  emoteSprite.renderOrder = 10;
  emoteSprite.visible = false;
  root.add(emoteSprite);
  const emoteTexCache = new Map<EmoteId, THREE.CanvasTexture>();
  disposables.push(emoteMat);

  let hitFlashActive = false;

  return {
    root,
    bodyPivot,
    headGroup,
    cuecaHelmet,
    cuecaMesh,
    cuecaLeftFlap,
    cuecaRightFlap,
    capeMesh,
    shieldAura,
    baldTuft,
    sweatDrop,
    leftFoot,
    rightFoot,
    weaponAnchor,
    weaponMeshes,
    mouthMesh,
    leftEyePupil,
    rightEyePupil,
    shadowMesh,
    emoteSprite,
    setCuecaTier(newTier, newTeam, aniso) {
      const tBand =
        newTeam === 'blue' ? '#2563eb' : newTeam === 'orange' ? '#f97316' : undefined;
      cuecaMat.map = createCuecaTexture(newTier, tBand, aniso);
      cuecaMat.needsUpdate = true;
      bandMat.color.set(tBand || newTier.secondaryColor);
      if (newTier.emissiveHex) {
        bandMat.emissive.setHex(newTier.emissiveHex);
        bandMat.emissiveIntensity = 0.65;
      } else {
        bandMat.emissive.setHex(0x000000);
        bandMat.emissiveIntensity = 0;
      }
      crownOrnament.visible = Boolean(newTier.hasCrown);
    },
    setWeapon(slot) {
      weaponMeshes[1].visible = slot === 1;
      weaponMeshes[2].visible = slot === 2;
      weaponMeshes[3].visible = slot === 3;
    },
    setCuecaState(hasCueca, damagedWobble) {
      cuecaHelmet.visible = hasCueca;
      baldTuft.visible = !hasCueca;
      sweatDrop.visible = !hasCueca || damagedWobble;
      if (!hasCueca) {
        mouthMesh.scale.set(1.2, 1.8, 1);
      } else {
        mouthMesh.scale.set(1, 1, 1);
      }
    },
    setHitFlash(active) {
      if (hitFlashActive === active) return;
      hitFlashActive = active;
      skinMat.emissive.setHex(active ? 0xff4444 : 0x000000);
      skinMat.emissiveIntensity = active ? 0.55 : 0;
      suitMat.emissive.setHex(active ? 0xffffff : 0x000000);
      suitMat.emissiveIntensity = active ? 0.35 : 0;
    },
    setShieldActive(active) {
      shieldAura.visible = active;
    },
    setEmote(emote, aniso = 4) {
      if (!emote) {
        emoteSprite.visible = false;
        return;
      }
      let tex = emoteTexCache.get(emote);
      if (!tex) {
        tex = createEmoteTexture(emote, aniso);
        emoteTexCache.set(emote, tex);
      }
      emoteMat.map = tex;
      emoteMat.needsUpdate = true;
      emoteSprite.visible = true;
    },
    dispose() {
      for (const tex of emoteTexCache.values()) tex.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}

export function createFlyingCuecaProp(
  tier: CuecaTier,
  team: TeamId,
  maxAnisotropy: number
): THREE.Group {
  const grp = new THREE.Group();
  const teamBand =
    team === 'blue' ? '#2563eb' : team === 'orange' ? '#f97316' : undefined;
  const tex = createCuecaTexture(tier, teamBand, maxAnisotropy);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const geo = buildCuecaGeometry();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  grp.add(mesh);
  grp.userData.dispose = () => {
    mat.dispose();
    geo.dispose();
  };
  return grp;
}
