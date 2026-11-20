import * as THREE from 'three';
import { CuecaTier, TeamId, WeaponSlot } from './types';
import { createContactShadowTexture, createCuecaTexture } from './textures';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  cuecaHelmet: THREE.Group;
  cuecaMesh: THREE.Mesh;
  cuecaLeftFlap: THREE.Mesh;
  cuecaRightFlap: THREE.Mesh;
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
  setCuecaTier: (tier: CuecaTier, team: TeamId, maxAnisotropy: number) => void;
  setWeapon: (slot: WeaponSlot) => void;
  setCuecaState: (hasCueca: boolean, damagedWobble: boolean) => void;
  setHitFlash: (active: boolean) => void;
  dispose: () => void;
}

const SKIN_TONES = [0xffd6b8, 0xf7c19b, 0xe8a87c, 0xc6865c, 0xffe0cc];

function buildCuecaGeometry(): THREE.BufferGeometry {
  // Sculpted low-poly briefs dome that fits snugly over the giant head like a helmet
  const geo = new THREE.SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  // Slightly squash front-to-back and pinch side leg-openings for unmistakable underwear silhouette
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Lift the sides (leg holes!)
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

  // 1: Pistol ("Puff-9")
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

  // 2: Assault Rifle ("Boing-47")
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

  // 3: Elastic Grenade
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
  skinIndex: number,
  maxAnisotropy: number
): CharacterRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Ground contact shadow
  const shadowTex = createContactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
  });
  const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.025;
  root.add(shadowMesh);
  disposables.push(shadowTex, shadowMat, shadowGeo);

  const suitColor =
    team === 'blue' ? 0x2563eb : team === 'orange' ? 0xf97316 : 0x8b5cf6;
  const vestColor =
    team === 'blue' ? 0x1e3a8a : team === 'orange' ? 0x9a3412 : 0x4c1d95;

  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN_TONES[skinIndex % SKIN_TONES.length],
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
    roughness: 0.55,
    metalness: 0.15,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.2,
  });
  disposables.push(skinMat, suitMat, vestMat, shoeMat);

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

  // Stubby tactical arms holding weapon
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

  // HUGE COMICAL HEAD (1:2 body-to-head scale!)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.46, 0);
  bodyPivot.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.58, 18, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);
  disposables.push(headGeo);

  // Expressive oversized cartoon eyes
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

  // Expressive determined eyebrows
  const browGeo = new THREE.BoxGeometry(0.22, 0.055, 0.08);
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-0.2, 0.21, 0.54);
  leftBrow.rotation.z = -0.24;
  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(0.2, 0.21, 0.54);
  rightBrow.rotation.z = 0.24;
  headGroup.add(leftBrow, rightBrow);

  // Rosy cheeks + comical mouth
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

  // Bald-head comic hair tuft + sweat drop (visible when cueca is destroyed!)
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

  // Elastic waistband ring + flapping leg-hole cloth cuffs for lively cloth motion!
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

  // 3D Royal Crown Ornament (unlocked at Mythic Royal tier or Cueca King!)
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

  let hitFlashActive = false;

  return {
    root,
    bodyPivot,
    headGroup,
    cuecaHelmet,
    cuecaMesh,
    cuecaLeftFlap,
    cuecaRightFlap,
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
        mouthMesh.scale.set(1.2, 1.8, 1); // Comical shocked "O" mouth when bald!
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
    dispose() {
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
