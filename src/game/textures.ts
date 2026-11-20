import * as THREE from 'three';
import { CuecaTier, EmoteId } from './types';

const cuecaTextureCache = new Map<string, THREE.CanvasTexture>();

export function createCuecaTexture(
  tier: CuecaTier,
  teamTint?: string,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const key = `${tier.level}-${tier.pattern}-${teamTint || 'none'}`;
  const existing = cuecaTextureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base fabric fill
  ctx.fillStyle = tier.primaryColor;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle cotton weave lines
  ctx.strokeStyle = 'rgba(0,0,0,0.035)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  if (tier.pattern === 'classic') {
    // Plain crisp cotton briefs with a tiny simple hem seam
    ctx.strokeStyle = 'rgba(148,163,184,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 210);
    ctx.lineTo(256, 210);
    ctx.stroke();
  } else if (tier.pattern === 'striped') {
    ctx.fillStyle = tier.secondaryColor;
    for (let y = 44; y < 256; y += 36) {
      ctx.fillRect(0, y, 256, 16);
    }
    ctx.fillStyle = tier.accentColor;
    for (let y = 62; y < 256; y += 72) {
      ctx.fillRect(0, y, 256, 6);
    }
  } else if (tier.pattern === 'tropical') {
    // Playful bananas, watermelons & strawberries
    for (let i = 0; i < 27; i++) {
      const px = ((i * 53) % 220) + 18;
      const py = ((i * 71) % 190) + 52;
      if (i % 3 === 0) {
        // Watermelon slice
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI);
        ctx.fill();
      } else if (i % 3 === 1) {
        // Strawberry
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(px - 5, py - 11, 10, 4);
      } else {
        // Banana arc
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(px, py, 10, 0.2, 2.2);
        ctx.stroke();
      }
    }
  } else if (tier.pattern === 'neon') {
    // Synthwave grid & neon zigzags
    ctx.strokeStyle = tier.accentColor;
    ctx.lineWidth = 3;
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 42);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = tier.secondaryColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 32) {
      const y = (x / 32) % 2 === 0 ? 120 : 152;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (tier.pattern === 'cosmic') {
    // Nebula wash + twinkling star constellations
    const grad = ctx.createRadialGradient(128, 140, 12, 128, 140, 130);
    grad.addColorStop(0, '#7e22ce');
    grad.addColorStop(0.6, '#312e81');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 42, 256, 214);

    ctx.fillStyle = '#fef08a';
    for (let i = 0; i < 36; i++) {
      const sx = ((i * 61) % 236) + 10;
      const sy = ((i * 89) % 190) + 52;
      const r = i % 5 === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (tier.pattern === 'royal') {
    // Royal diamond pattern + golden sheen
    ctx.fillStyle = tier.accentColor;
    for (let x = 24; x < 256; x += 48) {
      for (let y = 64; y < 256; y += 48) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
      }
    }
  } else if (tier.pattern === 'watermelon') {
    // Juicy watermelon rind border + black seeds
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 214, 256, 42);
    ctx.fillStyle = '#dcfce7';
    ctx.fillRect(0, 204, 256, 10);
    ctx.fillStyle = '#1e1b2e';
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 47) % 232) + 12;
      const sy = ((i * 67) % 140) + 56;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 3, 6, (i % 4) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (tier.pattern === 'tiger') {
    // Bold tiger stripes
    ctx.fillStyle = '#1e1b2e';
    for (let y = 54; y < 256; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(108, y + 14);
      ctx.lineTo(0, y + 22);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(256, y + 12);
      ctx.lineTo(140, y + 26);
      ctx.lineTo(256, y + 34);
      ctx.closePath();
      ctx.fill();
    }
  } else if (tier.pattern === 'pizza') {
    // Melted cheese crust + pepperoni slices + basil leaves
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 212, 256, 44);
    for (let i = 0; i < 16; i++) {
      const px = ((i * 61) % 220) + 18;
      const py = ((i * 53) % 145) + 55;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(px - 4, py - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(px + 12, py + 8, 9, 5);
      }
    }
  } else if (tier.pattern === 'rainbow') {
    // Vibrant synthwave rainbow stripes + stars
    const colors = ['#f43f5e', '#fb923c', '#facc15', '#22c55e', '#38bdf8', '#a855f7'];
    const bandH = Math.ceil(214 / colors.length);
    colors.forEach((c, idx) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, 42 + idx * bandH, 256, bandH + 1);
    });
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.arc(((i * 49) % 236) + 10, ((i * 73) % 190) + 52, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (tier.pattern === 'cow') {
    // Playful cow spots
    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < 18; i++) {
      const cx = ((i * 67) % 228) + 14;
      const cy = ((i * 83) % 184) + 58;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14 + (i % 3) * 6, 10 + (i % 2) * 5, i * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Elastic waistband along the top UV edge
  const bandColor = teamTint || tier.secondaryColor;
  ctx.fillStyle = bandColor;
  ctx.fillRect(0, 0, 256, 42);

  // Waistband stripes & comic label
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, 8, 256, 5);
  ctx.fillRect(0, 30, 256, 5);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CUECA★STRIKE', 128, 25);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  cuecaTextureCache.set(key, tex);
  return tex;
}

export function createGroundTexture(
  palette: { base: string; tile: string; accent: string; line: string },
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, 512, 512);

  const step = 128;
  for (let gx = 0; gx < 512; gx += step) {
    for (let gy = 0; gy < 512; gy += step) {
      if (((gx + gy) / step) % 2 === 0) {
        ctx.fillStyle = palette.tile;
        ctx.fillRect(gx + 4, gy + 4, step - 8, step - 8);
      }
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 4;
      ctx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);
    }
  }

  ctx.fillStyle = palette.accent;
  for (let i = 0; i < 65; i++) {
    const sx = (i * 97) % 512;
    const sy = (i * 151) % 512;
    ctx.beginPath();
    ctx.arc(sx, sy, (i % 3) + 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.needsUpdate = true;
  return tex;
}

export function createCrateTexture(
  bg: string,
  trim: string,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 5;
  for (let y = 32; y < 256; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  ctx.strokeStyle = trim;
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, 234, 234);

  ctx.beginPath();
  ctx.moveTo(18, 18);
  ctx.lineTo(238, 238);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createHazardStripeTexture(
  c1 = '#facc15',
  c2 = '#1e293b',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = c2;
  for (let i = -256; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 32, 0);
    ctx.lineTo(i + 288, 256);
    ctx.lineTo(i + 256, 256);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(20, 14, 34, 0.52)');
  grad.addColorStop(0.65, 'rgba(20, 14, 34, 0.22)');
  grad.addColorStop(1, 'rgba(20, 14, 34, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createEmoteTexture(
  emote: EmoteId,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  const borderMap: Record<EmoteId, string> = {
    'thumbs-up': '#facc15',
    cueca: '#38bdf8',
    gg: '#22c55e',
    laugh: '#fb7185',
  };
  const border = borderMap[emote];

  // Comic speech bubble with tail
  ctx.fillStyle = '#1e1b2e';
  ctx.strokeStyle = border;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(22, 18, 212, 178, 44);
  ctx.fill();
  ctx.stroke();

  // Bubble pointer tail
  ctx.fillStyle = '#1e1b2e';
  ctx.beginPath();
  ctx.moveTo(106, 190);
  ctx.lineTo(128, 238);
  ctx.lineTo(150, 190);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(106, 194);
  ctx.lineTo(128, 238);
  ctx.lineTo(150, 194);
  ctx.stroke();

  if (emote === 'thumbs-up') {
    // Cuff
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(62, 102, 34, 62, 10);
    ctx.fill();
    // Hand & Thumb up
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#fff8f0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(96, 96, 86, 68, 18);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(114, 42, 32, 66, 15);
    ctx.fill();
    ctx.stroke();
    // Sparkles
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(64, 58, 7, 0, Math.PI * 2);
    ctx.arc(192, 64, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (emote === 'cueca') {
    // Iconic Cueca badge
    ctx.fillStyle = '#fff8f0';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(58, 60);
    ctx.lineTo(198, 60);
    ctx.lineTo(188, 108);
    ctx.quadraticCurveTo(164, 118, 152, 160);
    ctx.lineTo(104, 160);
    ctx.quadraticCurveTo(92, 118, 68, 108);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Waistband
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.roundRect(56, 54, 144, 24, 6);
    ctx.fill();
    // Polka dots
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(104, 108, 9, 0, Math.PI * 2);
    ctx.arc(152, 108, 9, 0, Math.PI * 2);
    ctx.arc(128, 134, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (emote === 'gg') {
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 88px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GG!', 128, 112);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(54, 58, 8, 0, Math.PI * 2);
    ctx.arc(202, 58, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Laughing comic face + HAHA!
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(128, 114, 54, 0, Math.PI * 2);
    ctx.fill();
    // Happy squinting eyes
    ctx.strokeStyle = '#1e1b2e';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(106, 98, 10, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(150, 98, 10, Math.PI, 0);
    ctx.stroke();
    // Wide laughing mouth
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(128, 118, 28, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    // HAHA label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HAHA!', 128, 50);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}
