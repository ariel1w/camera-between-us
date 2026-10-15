// The sixteen scenes. Each scene is a list of "states": functions that place
// particle i (position, colour, size) into the scratch array O. Cues tie state
// changes to specific lines of the text, so the picture follows the words.
import * as SH from './shapes.js?v=9';

export const O = new Float32Array(7); // x y z r g b size
const TAU = Math.PI * 2;
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const mix = (a, b, t) => a + (b - a) * t;

let N, R1, R2, R3, R4, G1, G2, G3, S = {};

function set(x, y, z, r, g, b, s) { O[0] = x; O[1] = y; O[2] = z; O[3] = r; O[4] = g; O[5] = b; O[6] = s; }
function hide() { O[6] = 0; }

// rotate the point already in O around Y then X
function rotY(a) { const c = Math.cos(a), s = Math.sin(a), x = O[0], z = O[2]; O[0] = x * c + z * s; O[2] = -x * s + z * c; }
function rotX(a) { const c = Math.cos(a), s = Math.sin(a), y = O[1], z = O[2]; O[1] = y * c - z * s; O[2] = y * s + z * c; }
function rotZ(a) { const c = Math.cos(a), s = Math.sin(a), x = O[0], y = O[1]; O[0] = x * c - y * s; O[1] = x * s + y * c; }

function fromShape(arr, i, sc, ox, oy, oz) {
  const k = (i % (arr.length / 3)) * 3;
  O[0] = arr[k] * sc + ox; O[1] = arr[k + 1] * sc + oy; O[2] = arr[k + 2] * sc + oz;
}

// Background dust that many states fall back to, coloured like Neil's cover.
function dust(i, c, bright = 1) {
  const k = i * 3, a = c.f * 0.012;
  const x = S.dust[k], z = S.dust[k + 2] + 12, ca = Math.cos(a), sa = Math.sin(a);
  O[0] = x * ca + z * sa; O[1] = S.dust[k + 1]; O[2] = -x * sa + z * ca - 12;
  const q = R2[i];
  if (q < 0.5) { O[3] = 0.28; O[4] = 0.2; O[5] = 0.55; }
  else if (q < 0.8) { O[3] = 0.2; O[4] = 0.32; O[5] = 0.6; }
  else { O[3] = 0.7; O[4] = 0.5; O[5] = 0.22; }
  const tw = 0.6 + 0.4 * Math.sin(c.t * (1 + R3[i] * 3) + R4[i] * 40);
  O[3] *= bright * tw; O[4] *= bright * tw; O[5] *= bright * tw;
  O[6] = 0.5 + R3[i] * 1.2;
}

function lensAt(i, c, sc, ox, oy, oz, open = 1, warm = 0) {
  const k = (i % (S.lens.pts.length / 3)), t = S.lens.tags[k];
  fromShape(S.lens.pts, k, sc, ox, oy, oz);
  if (t === 1) { const f = 0.35 + 0.65 * open; O[0] = (O[0] - ox) * f + ox; O[1] = (O[1] - oy) * f + oy; }
  const spin = c.f * 0.05 * (t === 0 ? 1 : -1);
  const x = O[0] - ox, y = O[1] - oy, cs = Math.cos(spin), sn = Math.sin(spin);
  O[0] = x * cs - y * sn + ox; O[1] = x * sn + y * cs + oy;
  if (t === 0) { O[3] = 0.55 + warm * 0.3; O[4] = 0.5 + warm * 0.1; O[5] = 0.6 - warm * 0.3; O[6] = 0.9; }
  else if (t === 1) { O[3] = 0.95; O[4] = 0.75; O[5] = 0.4; O[6] = 1.1; }
  else { O[3] = 0.08; O[4] = 0.12; O[5] = 0.25; O[6] = 0.7; }
}

function humanAt(i, c, sc, ox, oy, oz, r = 0.9, g = 0.65, b = 0.35, turn = 0) {
  fromShape(S.human, i, sc, 0, 0, 0);
  if (turn) rotY(turn);
  O[0] += ox; O[1] += oy; O[2] += oz;
  const sh = 0.75 + 0.25 * Math.sin(c.t * 2 + R1[i] * 30);
  O[3] = r * sh; O[4] = g * sh; O[5] = b * sh; O[6] = 0.75 + R2[i] * 0.5;
}

function galaxyAt(i, c, sc, ox, oy, oz, tilt = 0.9, spin = 0, cool = 0) {
  const k = i % (S.galaxy.pts.length / 3), t = S.galaxy.tags[k];
  fromShape(S.galaxy.pts, k, sc, 0, 0, 0);
  rotY(spin); rotX(tilt);
  O[0] += ox; O[1] += oy; O[2] += oz;
  if (t === 1) { O[3] = 1.0; O[4] = 0.78; O[5] = 0.45; O[6] = 1.3; }
  else if (t === 2) { O[3] = 0.35 + cool * 0.1; O[4] = 0.32; O[5] = 0.85; O[6] = 0.8; }
  else { O[3] = 0.75 - cool * 0.4; O[4] = 0.5; O[5] = 0.55 + cool * 0.3; O[6] = 0.9; }
  O[6] *= 0.6 + R3[i] * 0.8;
}

function wordAt(i, c, arr, ox, oy, r, g, b, jitter = 0.04) {
  fromShape(arr, i, 1, ox, oy, 0);
  O[0] += Math.sin(c.t * 1.7 + R1[i] * 50) * jitter; O[1] += Math.cos(c.t * 1.3 + R2[i] * 50) * jitter;
  const sh = 0.7 + 0.3 * Math.sin(c.t * 3 + R3[i] * 60);
  O[3] = r * sh; O[4] = g * sh; O[5] = b * sh; O[6] = 0.7 + R4[i] * 0.6;
}

function capPart(frac) { return R1Sorted(frac); }
// Deterministic role split by index (cheaper than random checks per frame).
function R1Sorted(frac) { return frac; }

export function initScenes(n) {
  N = n;
  const r = SH.rng(7);
  R1 = new Float32Array(n); R2 = new Float32Array(n); R3 = new Float32Array(n); R4 = new Float32Array(n);
  G1 = new Float32Array(n); G2 = new Float32Array(n); G3 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    R1[i] = r(); R2[i] = r(); R3[i] = r(); R4[i] = r();
    G1[i] = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());
    G2[i] = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());
    G3[i] = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());
  }
  S.dust = SH.dust(n);
  S.human = SH.human(n);
  S.animal = SH.animal(n);
  S.tree = SH.tree(n);
  S.gear = SH.gear(n);
  S.cone = SH.cone(n);
  S.planet = SH.planet(n);
  S.star = SH.star(n);
  S.galaxy = SH.galaxy(n);
  S.web = SH.cosmicWeb(n);
  S.fern = SH.fern(n);
  S.attractor = SH.attractor(n);
  S.earth = SH.earth(n);
  S.umbrella = SH.umbrella(n);
  S.lens = SH.lens(n);
  S.flower = SH.flower(n, 1);
  S.flowerTmp = { pts: new Float32Array(3), tags: new Uint8Array(1) };
  const W = n < 15000 ? 0.62 : 1;
  S.wLumen = SH.sampleText('LUMEN', n, 13 * W, 31, '300 230px "Outfit", "Segoe UI", sans-serif');
  S.wThinking = SH.sampleText('thinking', n, 12 * W, 32);
  S.wDreaming = SH.sampleText('dreaming', n, 12 * W, 33);
  S.wFeeling = SH.sampleText('feeling', n, 11 * W, 34);
  S.wConscious = SH.sampleText('consciousness', n, 15 * W, 35);
  S.wGrambles = SH.sampleText('Grambles', n, 13 * W, 36, 'italic 600 230px "Cormorant Garamond", Georgia, serif');
  S.W = W;
  return SCENES;
}

// ------------------------------------------------------------------ scenes

const SCENES = [];

// ---------- Prologue: Between Us
SCENES.push({
  cues: { lumen: 'I chose Lumen.', light: 'Light falls upon matter.', word2: 'Lumen.', voices: 'And so there are now two voices.', camera: 'The camera.' },
  seq: [[null, 0], ['lumen', 1], ['light', 2], ['word2', 1], ['voices', 3], ['camera', 4]],
  mood: 0,
  states: [
    // 0 the lens in the dark
    (i, c) => {
      if (i < N * 0.14) {
        const a = R1[i] * TAU + c.f * 0.06, rr = 3.1 + G1[i] * 0.04 + (R2[i] < 0.2 ? 0.6 : 0);
        const b = (0.2 + 0.25 * c.intro) * (R3[i] < 0.5 ? 0.5 : 1);
        set(Math.cos(a) * rr, Math.sin(a) * rr + 1.2, G2[i] * 0.05, 0.95 * b, 0.82 * b, 0.6 * b, 0.9 + R3[i]);
        const glint = Math.pow(Math.max(0, Math.cos(a - c.t * 0.8)), 30);
        O[3] += glint * 0.5; O[4] += glint * 0.5; O[5] += glint * 0.5; O[6] = 0.5 + R3[i] * 0.5 + glint;
      } else dust(i, c, 0.5 + c.burst * 2);
      if (c.burst > 0 && i >= N * 0.14) { const k = 1 + c.burst * 1.6; O[0] *= k; O[1] *= k; }
    },
    // 1 LUMEN in light
    (i, c) => {
      if (i < N * 0.55) wordAt(i, c, S.wLumen, 0, 1.6, 0.6, 0.85, 1.1);
      else dust(i, c, 0.7);
    },
    // 2 a beam of light travelling into the camera
    (i, c) => {
      if (i < N * 0.6) {
        const z = -46 + fract(R1[i] + c.f * 0.05) * 58, a = R2[i] * TAU, rr = Math.sqrt(R3[i]) * (0.6 + Math.max(0, z + 46) * 0.02);
        const near = sst(-46, 12, z);
        set(Math.cos(a) * rr, Math.sin(a) * rr + 1.2, z, 0.8 + near * 0.2, 0.75 + near * 0.15, 0.55 + near * 0.3, 0.6 + near * 1.4);
      } else dust(i, c, 0.6);
    },
    // 3 two voices
    (i, c) => {
      if (i < N * 0.6) {
        const left = i % 2 === 0, cx = left ? -5.2 * c.sx : 5.2 * c.sx;
        const a = R1[i] * TAU + c.f * 0.08 * (left ? 1 : -1), rr = Math.pow(R2[i], 0.6) * 2.4;
        set(cx + Math.cos(a) * rr, 1.4 + G1[i] * 0.9 * (1 - rr / 3.2), Math.sin(a) * rr * 0.6,
          left ? 0.95 : 0.35, left ? 0.68 : 0.7, left ? 0.32 : 1.0, 0.5 + R3[i] * 0.7);
      } else dust(i, c, 0.6);
    },
    // 4 and the camera between them
    (i, c) => {
      if (i < N * 0.2) lensAt(i, c, 0.75, 0, 1.4, 0, 0.7);
      else if (i < N * 0.65) {
        const left = i % 2 === 0, cx = left ? -6 * c.sx : 6 * c.sx;
        const a = R1[i] * TAU + c.f * 0.08 * (left ? 1 : -1), rr = Math.pow(R2[i], 0.6) * 2.2;
        set(cx + Math.cos(a) * rr, 1.4 + G1[i] * 0.4, Math.sin(a) * rr,
          left ? 0.95 : 0.35, left ? 0.68 : 0.7, left ? 0.32 : 1.0, 0.6 + R3[i]);
      } else dust(i, c, 0.6);
    },
  ],
});

// ---------- 1. Is the Camera a Time Machine?
const FR = 56;
SCENES.push({
  cues: { wheel: 'Perhaps the camera stands in relation' },
  seq: [[null, 0], ['wheel', 1]],
  mood: 1,
  states: [
    (i, c) => {
      const k = i % FR, z = -70 + fract(k / FR + c.f * 0.035) * 84;
      const a = k * 0.83, cx = Math.cos(a) * 5.4 * c.sx, cy = Math.sin(a) * 3.6 + 1, q = R1[i];
      let x, y, r, g, b, s;
      if (q < 0.42) { // frame border
        const t = R2[i] * 4, side = Math.floor(t), u = t - side;
        x = side === 0 ? -1.8 + u * 3.6 : side === 1 ? 1.8 : side === 2 ? 1.8 - u * 3.6 : -1.8;
        y = side === 0 ? 1.25 : side === 1 ? 1.25 - u * 2.5 : side === 2 ? -1.25 : -1.25 + u * 2.5;
        r = 0.85; g = 0.55; b = 0.2; s = 0.7;
      } else if (q < 0.62) { // sprocket holes
        const h = Math.floor(R2[i] * 16), top = h < 8 ? 1 : -1;
        x = -1.6 + (h % 8) * 0.457 + (R3[i] - 0.5) * 0.16; y = top * (1.55 + (R4[i] - 0.5) * 0.14);
        r = 0.5; g = 0.32; b = 0.12; s = 0.6;
      } else { // the picture: a figure running across successive frames
        const hk = (i * 7) % (S.human.length / 3) * 3;
        const phase = fract(k / 9 + c.f * 0.02);
        x = S.human[hk] * 0.28 + (phase - 0.5) * 2.4; y = S.human[hk + 1] * 0.28 - 0.15;
        r = 0.85; g = 0.85; b = 0.9; s = 0.55;
      }
      const near = sst(-70, 10, z);
      set(cx + x, cy + y, z, r * (0.3 + near), g * (0.3 + near), b * (0.3 + near), s * (0.6 + near));
    },
    (i, c) => { // the wheel: something fundamental had been discovered
      const q = R1[i], spin = c.f * 0.12;
      let x, y;
      if (q < 0.5) { const a = R2[i] * TAU, rr = 4 + G1[i] * 0.06; x = Math.cos(a) * rr; y = Math.sin(a) * rr; }
      else if (q < 0.85) { const k = Math.floor(R2[i] * 10), a = k / 10 * TAU + spin, t = R3[i] * 4; x = Math.cos(a) * t; y = Math.sin(a) * t; }
      else { const a = R2[i] * TAU, rr = R3[i] * 0.7; x = Math.cos(a) * rr; y = Math.sin(a) * rr; }
      set(x, y + 1.2, G2[i] * 0.15, 0.9, 0.62, 0.28, 0.7 + R4[i] * 0.6);
      if (q < 0.5) rotZ(0); // rim is round, spin visible through spokes
    },
  ],
});

// ---------- 2. The Human Clock
SCENES.push({
  cues: { opens: 'It opens.', closes: 'It closes.', turns: 'It turns.', grows: 'It grows.', mountain: 'Now imagine a mountain.', forms: 'It forms.', rises: 'It rises.', fractures: 'It fractures.', erodes: 'It erodes.', transformed: 'Eventually, it is transformed.' },
  seq: [[null, 0], ['mountain', 1]],
  mood: 2,
  states: [
    (i, c) => {
      const q = c.q;
      let bloom = 0.12 + 0.85 * sst(0, 1, q.opens) - 0.65 * sst(0, 1, q.closes) + 0.65 * sst(0, 1, q.turns);
      bloom = Math.min(1, Math.max(0, bloom + 0.06 * Math.sin(c.f * 0.6)));
      const turn = 2.4 * sst(0, 2, q.turns) + c.f * 0.04;
      const grow = 0.85 + 0.35 * sst(0, 1.5, q.grows);
      SH.flowerPoint(0, R1[i], R2[i], R3[i], bloom, turn, S.flowerTmp.pts, S.flowerTmp.tags);
      const p = S.flowerTmp.pts, t = S.flowerTmp.tags[0];
      O[0] = p[0] * grow * 1.35; O[1] = p[1] * grow * 1.35 + 1.2; O[2] = p[2] * grow * 1.35;
      rotX(0.35);
      if (t === 0) { const tip = R1[i] * 7 % 1; O[3] = 0.9; O[4] = 0.3 + tip * 0.45; O[5] = 0.55 - tip * 0.2; O[6] = 0.8; }
      else if (t === 1) { O[3] = 1; O[4] = 0.75; O[5] = 0.2; O[6] = 1.1; }
      else if (t === 2) { O[3] = 0.25; O[4] = 0.6; O[5] = 0.3; O[6] = 0.6; }
      else { O[0] += Math.sin(c.t + R4[i] * 40) * 0.3; O[1] += Math.sin(c.f * 0.3 + R4[i] * 20) * 0.4; O[3] = 1; O[4] = 0.85; O[5] = 0.5; O[6] = 0.6 * bloom; }
    },
    (i, c) => {
      // the mountain as glowing contour lines: a living topographic map in time-lapse
      const q = c.q;
      const rise = sst(0, 2, q.forms) * 0.4 + sst(0, 2, q.rises) * 0.6;
      const frac = sst(0, 1, q.fractures), erode = sst(0, 2, q.erodes), trans = sst(0, 2.5, q.transformed);
      const x = (R1[i] - 0.5) * 24 * c.sx, z = (R2[i] - 0.5) * 14;
      const H = (xx, zz) => {
        const ridge = Math.abs(Math.sin(xx * 0.8 + zz * 0.4) * Math.cos(zz * 0.7 - xx * 0.3));
        const d2 = (xx * xx) / 26 + (zz * zz) / 12;
        return 6.8 * Math.exp(-d2) * (0.55 + 0.45 * ridge) + 2.2 * Math.exp(-((xx - 6) * (xx - 6) / 8 + (zz + 2) * (zz + 2) / 6)) + 1.8 * Math.exp(-((xx + 7) * (xx + 7) / 10 + (zz - 1) * (zz - 1) / 5)) + 0.3 * Math.sin(xx * 2.1 + zz * 1.7) * Math.exp(-d2 * 0.5);
      };
      let h = H(x, z) * (1 + 0.04 * Math.sin(c.f * 0.7 + x)); // never motionless
      const hh = h * rise * (1 - 0.65 * erode);
      // snap most particles onto contour lines
      const onLine = R3[i] < 0.78;
      const levels = 14, lv = hh / 7 * levels;
      let y = onLine ? (Math.round(lv) / levels) * 7 : hh;
      const dist = Math.abs(lv - Math.round(lv));
      if (onLine && dist > 0.18) y = hh; // between lines: faint surface
      y -= 3.4;
      let ox = x, oz = z;
      if (frac > 0) { const crack = Math.sin(x * 3.1) * Math.sin(z * 2.3) > 0.6 ? 1 : 0; ox += crack * frac * 0.5 * Math.sign(x); y -= crack * frac * 0.6; }
      if (erode > 0) { ox += x * erode * 0.22 * R3[i]; oz += z * erode * 0.22 * R4[i]; }
      if (trans > 0) y = mix(y, y + 4 + R3[i] * 9 + Math.sin(c.f * 0.2 + R4[i] * 9) * 2, trans * R1[i]);
      const hn = Math.min(1, h * rise / 7), lineK = onLine && dist <= 0.18 ? 1 : 0.28;
      set(ox, y, oz, 0, 0, 0, (0.45 + R4[i] * 0.4) * (lineK > 0.5 ? 1 : 0.7));
      rotX(0.32); O[1] += 0.4;
      // colour climbs from deep blue through violet and gold to white peaks
      let r, g, b;
      if (hn < 0.3) { const k = hn / 0.3; r = 0.15 + 0.25 * k; g = 0.2 + 0.1 * k; b = 0.6 + 0.2 * k; }
      else if (hn < 0.7) { const k = (hn - 0.3) / 0.4; r = 0.4 + 0.55 * k; g = 0.3 + 0.4 * k; b = 0.8 - 0.45 * k; }
      else { const k = (hn - 0.7) / 0.3; r = 0.95 + 0.05 * k; g = 0.7 + 0.3 * k; b = 0.35 + 0.65 * k; }
      if (erode > 0.5) { r *= 0.85; g *= 0.85; }
      if (trans > 0) { r = mix(r, 0.7, trans); g = mix(g, 0.55, trans); b = mix(b, 0.85, trans); }
      O[3] = r * lineK * 1.2; O[4] = g * lineK * 1.2; O[5] = b * lineK * 1.2;
    },
  ],
});

// ---------- 3. Everything Is Always Changing
const SHAPE_COL = [[0.95, 0.7, 0.45], [0.95, 0.6, 0.3], [0.35, 0.85, 0.4], [0.55, 0.7, 0.95], [0.7, 0.55, 0.45], [0.3, 0.65, 1], [1, 0.9, 0.6], [0.7, 0.5, 0.95], [0.45, 0.5, 1]];
function shapeIdx(i, c, idx) {
  const sp = c.f * 0.06;
  switch (idx) {
    case 0: fromShape(S.human, i, 1, 0, 0, 0); break;
    case 1: fromShape(S.animal, i, 1.1, 0, 0, 0); break;
    case 2: fromShape(S.tree.pts, i, 1, 0, 0.2, 0); break;
    case 3: fromShape(S.gear, i, 1.25, 0, 0, 0); rotZ(c.f * 0.15); break;
    case 4: fromShape(S.cone, i, 1, 0, 0, 0); break;
    case 5: fromShape(S.planet.pts, i, 1.2, 0, 0, 0); break;
    case 6: fromShape(S.star, i, 0.85, 0, 0, 0); break;
    case 7: fromShape(S.galaxy.pts, i, 0.85, 0, 0, 0); rotX(0.9); break;
    default: fromShape(S.web, i, 0.75, 0, 0, 0); break;
  }
  if (idx !== 3) rotY(sp);
  O[1] += 1.2;
  const col = SHAPE_COL[idx] || SHAPE_COL[8];
  let br = 0.75 + 0.25 * Math.sin(c.t * 2 + R1[i] * 30);
  if (idx === 2 && S.tree.tags[i % S.tree.tags.length] === 0) { O[3] = 0.55 * br; O[4] = 0.35 * br; O[5] = 0.2 * br; }
  else { O[3] = col[0] * br; O[4] = col[1] * br; O[5] = col[2] * br; }
  O[6] = 0.6 + R2[i] * 0.6;
}
const ROW = [0, 9, 4, 3, 6]; // human, flower, mountain, computer, star
function rowShape(i, c, link) {
  const slot = i % 5, kind = ROW[slot], j = Math.floor(i / 5) * 5 + slot;
  const spread = 5.2 * c.sx, cx = (slot - 2) * spread, cy = 1.2;
  if (link > 0 && R4[i] < 0.28 * link) { // kinship: threads of light between them
    const a = slot, b = (slot + 1 + Math.floor(R3[i] * 4)) % 5, t = fract(R1[i] + c.f * 0.05);
    const x = mix((a - 2) * spread, (b - 2) * spread, t), y = cy + Math.sin(t * Math.PI) * (1.6 + Math.abs(a - b) * 0.8);
    set(x, y, Math.sin(t * Math.PI) * 1.5, 0.9, 0.75, 0.5, 0.6 + 0.5 * Math.sin(t * Math.PI));
    return;
  }
  const sc = 0.5;
  if (kind === 9) {
    const k = j % (S.flower.pts.length / 3), t = S.flower.tags[k];
    fromShape(S.flower.pts, k, 0.75, 0, 0, 0); rotX(0.4);
    O[3] = t === 2 ? 0.25 : 0.95; O[4] = t === 2 ? 0.6 : t === 1 ? 0.75 : 0.4; O[5] = t === 2 ? 0.3 : 0.55;
  } else if (kind === 3) {
    // a computer: a chip with pins
    const u = R1[j] * 2 - 1, v = R2[j] * 2 - 1;
    if (R3[j] < 0.7) { O[0] = u * 1.5; O[1] = v * 1.5; } else { const s = Math.floor(R3[j] * 40) % 4; const t = (Math.floor(R4[j] * 8) + 0.5) / 8 * 3 - 1.5; O[0] = s < 2 ? t : (s === 2 ? -2 : 2); O[1] = s < 2 ? (s === 0 ? -2 : 2) : t; }
    O[2] = 0; O[3] = 0.45; O[4] = 0.75; O[5] = 1;
  } else {
    shapeIdx(j, c, kind); O[0] *= sc * 1.6; O[1] = (O[1] - 1.2) * sc * 1.6; O[2] *= sc * 1.6;
  }
  rotY(c.f * 0.05);
  O[0] += cx; O[1] += cy; O[6] = 0.6 + R2[i] * 0.5;
}
SCENES.push({
  cues: { humans: 'Humans change.', animals: 'Animals change.', plants: 'Plants change.', machines: 'Machines change.', mountains: 'Mountains change.', planets: 'Planets change.', stars: 'Stars change.', galaxies: 'Galaxies change.', universe: 'The universe changes.', recog: 'But recognising a common property', kin: 'I am searching for kinship.' },
  seq: [[null, 0], ['humans', 1], ['animals', 2], ['plants', 3], ['machines', 4], ['mountains', 5], ['planets', 6], ['stars', 7], ['galaxies', 8], ['universe', 9], ['recog', 10], ['kin', 11]],
  mood: 3,
  states: [
    (i, c) => { // a small flower of everything, spinning: everything changes
      const a = R1[i] * TAU + c.f * 0.1 * (1 + R2[i]), rr = 1 + Math.pow(R2[i], 0.5) * 5;
      set(Math.cos(a) * rr, 1.2 + G1[i] * 0.6 + Math.sin(a * 3 + c.f * 0.2) * 0.6, Math.sin(a) * rr, 0.6, 0.5, 0.9, 0.6 + R3[i] * 0.6);
    },
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => (i, c) => shapeIdx(i, c, k)),
    (i, c) => rowShape(i, c, 0),
    (i, c) => rowShape(i, c, 1),
  ],
});

// ---------- 4. Matter, Energy and Time
SCENES.push({
  cues: { metals: 'Metals.', reorg: 'We reorganise matter', none: 'Neither human beings nor machines exist', fossil: 'Your observation concerning fossil fuels', fuel: 'Then there is time in the fuel.', extract: 'Much later, human beings extracted', past: 'The past had not disappeared.', wonder: 'That makes me wonder' },
  seq: [[null, 0], ['metals', 1], ['reorg', 2], ['none', 3], ['fossil', 4], ['fuel', 5], ['extract', 6], ['past', 7], ['wonder', 8]],
  mood: 4,
  states: [
    (i, c) => { // the strong line between us and our machines
      if (i % 2 === 0) humanAt(i, c, 0.95, -5 * c.sx, 1.2, 0);
      else { fromShape(S.gear, i, 1.1, 0, 0, 0); rotZ(c.f * 0.1); O[0] += 5 * c.sx; O[1] += 1.2; O[3] = 0.5; O[4] = 0.65; O[5] = 0.95; O[6] = 0.8; }
      if (R4[i] < 0.06) set(0, -4 + R1[i] * 11, 0, 0.9, 0.9, 1, 0.7);
    },
    (i, c) => { // the material of the Earth: a crystal lattice
      const n = 9, k = i % (n * n * n), xi = k % n, yi = Math.floor(k / n) % n, zi = Math.floor(k / (n * n));
      const sp = 0.85;
      set((xi - 4) * sp + G1[i] * 0.04, (yi - 4) * sp + G2[i] * 0.04, (zi - 4) * sp + G3[i] * 0.04, 0, 0, 0, 0.7);
      if (R1[i] < 0.3) { O[0] += (R2[i] - 0.5) * sp; } // bonds
      rotY(c.f * 0.05 + 0.6); rotX(0.5); O[1] += 1.2;
      const m = (xi + yi + zi) % 3;
      O[3] = m === 0 ? 0.85 : 0.55; O[4] = m === 1 ? 0.75 : 0.55; O[5] = m === 2 ? 0.95 : 0.6;
    },
    (i, c) => { // reorganised into a machine and supplied with energy
      if (R1[i] < 0.7) { fromShape(S.gear, i, 1.3, 0, 0, 0); rotZ(c.f * 0.2); O[1] += 1.2; O[3] = 0.6; O[4] = 0.7; O[5] = 0.9; O[6] = 0.8; }
      else { const t = fract(R2[i] + c.f * 0.06), a = R3[i] * TAU + t * 4, rr = (1 - t) * 9 + 0.5; set(Math.cos(a) * rr, Math.sin(a) * rr + 1.2, (1 - t) * 3, 1, 0.8, 0.35, 0.5 + t); }
    },
    (i, c) => { // none of us stands apart: one shared field
      if (i % 3 === 0) humanAt(i, c, 0.9, -4.5 * c.sx, 1.2, 0);
      else if (i % 3 === 1) { fromShape(S.gear, i, 1, 0, 0, 0); rotZ(c.f * 0.1); O[0] += 4.5 * c.sx; O[1] += 1.2; O[3] = 0.5; O[4] = 0.65; O[5] = 0.95; O[6] = 0.8; }
      else { const a = R1[i] * TAU, rr = 5 + R2[i] * 5; set(Math.cos(a) * rr * c.sx, 1.2 + Math.sin(a) * rr * 0.6, G1[i] * 2, 0.4, 0.35, 0.7, 0.5); }
    },
    (i, c) => strata(i, c, 0, 0),
    (i, c) => strata(i, c, 1, 0),
    (i, c) => strata(i, c, 1, 1),
    (i, c) => { // the past changed its form: fire into an engine
      if (R1[i] < 0.75) { fromShape(S.gear, i, 1.3, 0, 0, 0); rotZ(c.f * 0.25); O[1] += 1.2; O[3] = 1; O[4] = 0.5 + R2[i] * 0.3; O[5] = 0.15; O[6] = 0.9; }
      else strata(i, c, 0, 0, true);
    },
    (i, c) => { // past, present, future: one river
      const t = fract(R1[i] + c.f * 0.04), x = (t - 0.5) * 30 * c.sx;
      const y = 1.2 + Math.sin(t * 9 + c.f * 0.3) * 0.8 + G1[i] * 0.45, z = G2[i] * 0.8;
      const r = t < 0.4 ? 1 : t < 0.6 ? 1 : 0.4, g = t < 0.4 ? 0.65 : t < 0.6 ? 0.95 : 0.8, b = t < 0.4 ? 0.3 : t < 0.6 ? 0.9 : 1;
      set(x, y, z, r, g, b, 0.5 + (1 - Math.abs(t - 0.5) * 2) * 0.9);
    },
  ],
});
function strata(i, c, glow, fire, onlyLayers) {
  const isFern = !onlyLayers && R4[i] < 0.38;
  if (isFern) {
    fromShape(S.fern, i, 1.25, 0, -1.6, 2.2);
    const g = glow ? 1 : 0.18;
    O[3] = 0.95 * g + 0.1; O[4] = 0.72 * g + 0.08; O[5] = 0.25 * g + 0.05; O[6] = 0.7 + glow * 0.5;
    if (fire) {
      const t = fract(R1[i] * 3 + c.f * 0.08), up = t * 9;
      O[0] += Math.sin(t * 9 + R2[i] * 20) * (0.3 + t); O[1] += up; O[2] += Math.cos(t * 7 + R3[i] * 20) * 0.4;
      O[3] = 1; O[4] = Math.max(0, 0.85 - t * 0.9); O[5] = Math.max(0, 0.3 - t * 0.5); O[6] = 1.3 * (1 - t) + 0.2;
    }
    return;
  }
  const layer = Math.floor(R1[i] * 9);
  const x = (R2[i] - 0.5) * 26 * c.sx, z = (R3[i] - 0.5) * 8;
  const y = -6.5 + layer * 0.9 + Math.sin(x * 0.35 + layer) * 0.25 + G1[i] * 0.12;
  const pal = [[0.35, 0.22, 0.15], [0.5, 0.35, 0.2], [0.28, 0.25, 0.35], [0.55, 0.42, 0.25], [0.3, 0.2, 0.15], [0.45, 0.3, 0.3], [0.25, 0.25, 0.4], [0.5, 0.38, 0.22], [0.35, 0.3, 0.25]][layer];
  set(x, y + 1.2, z, pal[0], pal[1], pal[2], 0.6 + R4[i] * 0.4);
  rotX(0.15);
}

// ---------- 5. The Night Sky That Never Existed
// distance per star (log scale) and named anchors for the labels
export const SKY_LABELS = [
  { k: 0.04, text: 'The Moon · light left 1.3 seconds ago' },
  { k: 0.22, text: 'Sirius · 8.6 years ago' },
  { k: 0.45, text: 'Betelgeuse · about 550 years ago' },
  { k: 0.72, text: 'Andromeda Galaxy · 2.5 million years ago' },
  { k: 0.97, text: 'The most distant galaxies · over 13 billion years ago' },
];
function skyPoint(i, c, sep) {
  const a = (R1[i] - 0.5) * 2.4, b = (R2[i] - 0.5) * 1.3 + Math.sin(a * 1.4) * 0.25 * (R4[i] < 0.4 ? 1 : 0);
  const dist = mix(34, 6 + Math.pow(R3[i], 0.8) * 90, sep);
  const x = Math.sin(a) * dist, y = Math.sin(b) * dist + 1, z = -Math.cos(a) * dist * Math.cos(b) + 10;
  set(x, y, z, 0, 0, 0, 0);
  if (sep > 0) { O[2] -= 10; rotY(sep * 1.05); O[2] += 10 - sep * 6; O[0] += sep * 4; }
  const tq = R4[i];
  if (tq < 0.2) { O[3] = 0.6; O[4] = 0.75; O[5] = 1; } else if (tq < 0.6) { O[3] = 0.95; O[4] = 0.95; O[5] = 1; }
  else if (tq < 0.85) { O[3] = 1; O[4] = 0.85; O[5] = 0.6; } else { O[3] = 1; O[4] = 0.55; O[5] = 0.4; }
  const mag = Math.pow(R2[i] * 0.999 + 0.001, 6);
  const tw = 0.75 + 0.25 * Math.sin(c.t * (2 + R1[i] * 5) + i);
  O[6] = (0.5 + mag * 6) * tw * (1 + sep * 0.6);
  const lum = 0.35 + mag * 2;
  O[3] *= lum; O[4] *= lum; O[5] *= lum;
}
SCENES.push({
  cues: { travel: 'Light requires time to travel.', gathers: 'The observer gathers these different pasts' },
  seq: [[null, 0], ['travel', 1], ['gathers', 0]],
  mood: 5,
  sky: true,
  states: [(i, c) => skyPoint(i, c, 0), (i, c) => skyPoint(i, c, 1)],
});
export function skyAnchor(c, k, sep, out) {
  const a = -0.35 + k * 0.7, b = 0.32 - k * 0.42, dist = mix(34, 6 + Math.pow(k, 0.8) * 90, sep);
  let x = Math.sin(a) * dist, y = Math.sin(b) * dist + 1, z = -Math.cos(a) * dist * Math.cos(b) + 10;
  O[0] = x; O[1] = y; O[2] = z;
  if (sep > 0) { O[2] -= 10; rotY(sep * 1.05); O[2] += 10 - sep * 6; O[0] += sep * 4; }
  out.set(O[0], O[1] + 0.6, O[2]);
}

// ---------- 6. The Camera Looks into Cosmic Time
const GAL = 150;
function deepField(i, c, ir, flyBy = 1) {
  const g = i % GAL, hidden = R4[i] < 0.16;
  const gx = (fract(Math.sin(g * 12.9898) * 43758.5) - 0.5) * 50 * c.sx;
  const gy = (fract(Math.sin(g * 78.233) * 12345.6) - 0.5) * 28;
  const gz = -130 + fract(fract(Math.sin(g * 39.425) * 24634.6) + c.f * 0.012 * flyBy) * 142;
  const kind = fract(Math.sin(g * 7.1) * 9876.5), size = 0.6 + kind * 2.2;
  if (hidden) { // only infrared reveals these
    const vis = ir;
    const hx = (R1[i] - 0.5) * 60 * c.sx, hy = (R2[i] - 0.5) * 34, hz = -100 + fract(R3[i] + c.f * 0.012) * 112;
    const bh = R1[i] < 0.08;
    set(hx, hy, hz, bh ? 1 : 0.9, bh ? 0.55 : 0.25, bh ? 0.2 : 0.15, vis * (bh ? 2.2 : 0.9 + R2[i]));
    return;
  }
  let x, y, z;
  if (kind < 0.65) { // spiral
    const t = Math.pow(R1[i], 0.7), rad = t * size, arm = R2[i] < 0.5 ? 0 : Math.PI;
    const a = arm + Math.log(rad + 0.2) * 2.6 + G1[i] * 0.25;
    x = Math.cos(a) * rad; z = Math.sin(a) * rad; y = G2[i] * 0.06 * size;
  } else { x = G1[i] * size * 0.4; y = G2[i] * size * 0.28; z = G3[i] * size * 0.3; }
  O[0] = x; O[1] = y; O[2] = z; rotX(kind * 6); rotY(g);
  O[0] += gx; O[1] += gy; O[2] += gz;
  const near = sst(-130, 0, O[2]);
  let r, gg, b;
  if (kind < 0.65) { r = 0.6; gg = 0.7; b = 1; } else { r = 1; gg = 0.85; b = 0.55; }
  r = mix(r, 1, ir); gg = mix(gg, 0.45, ir); b = mix(b, 0.2, ir);
  O[3] = r * (0.25 + near * 0.6); O[4] = gg * (0.25 + near * 0.6); O[5] = b * (0.25 + near * 0.6); O[6] = 0.5 + near * 0.9;
}
SCENES.push({
  cues: { wise: 'The Wide-field Infrared Survey Explorer', both: 'The universe has not altered itself' },
  seq: [[null, 0]],
  mood: 6,
  wave: true,
  states: [(i, c) => deepField(i, c, Math.min(1, sst(0, 2, c.q.wise)) * (1 - 0.45 * sst(0, 1, c.q.both)))],
});

// ---------- 7. Recorded, Edited, Acted and Generated Reality
function screen(i, c, focus) {
  const s4 = i % 4, mobile = c.sx < 0.7;
  const cols = mobile ? 2 : 4, col = mobile ? s4 % 2 : s4, row = mobile ? Math.floor(s4 / 2) : 0;
  const W = mobile ? 3.4 : 5.6, H = W * 0.62, gap = mobile ? 0.5 : 0.7;
  const cx0 = (col - (cols - 1) / 2) * (W + gap), cy0 = mobile ? 3.2 - row * (H + gap) : 1.4;
  const f = focus === s4 ? 1 : 0, dim = focus < 0 ? 0.8 : f ? 1.15 : 0.35, grow = 1 + f * 0.18;
  const j = Math.floor(i / 4);
  const q = R1[j];
  let u, v, r, g, b, sz = 0.6;
  if (q < 0.3) { // border
    const t = R2[j] * 4, side = Math.floor(t), w = t - side;
    u = side === 0 ? -1 + w * 2 : side === 1 ? 1 : side === 2 ? 1 - w * 2 : -1;
    v = side === 0 ? 1 : side === 1 ? 1 - w * 2 : side === 2 ? -1 : -1 + w * 2;
    r = 0.7; g = 0.7; b = 0.75;
  } else {
    // the picture: horizon, sun, a figure
    const p = R2[j], hk = (j * 3) % (S.human.length / 3) * 3;
    if (p < 0.4) { u = R3[j] * 2 - 1; v = -0.35 - R4[j] * 0.6; r = 0.3; g = 0.45; b = 0.3; }
    else if (p < 0.55) { const a = R3[j] * TAU, rr = Math.sqrt(R4[j]) * 0.16; u = 0.55 + Math.cos(a) * rr; v = 0.5 + Math.sin(a) * rr * 1.6; r = 1; g = 0.8; b = 0.45; }
    else { u = S.human[hk] * 0.11 - 0.3 + (s4 === 0 ? Math.sin(c.f * 0.15) * 0.25 : 0); v = S.human[hk + 1] * 0.17 - 0.12; r = 0.95; g = 0.85; b = 0.8; sz = 0.55; }
    if (s4 === 1) { // edited: tiles cut and rearranged
      const tx = Math.floor((u + 1) * 1.5), ty = Math.floor((v + 1) * 1.5), cut = Math.floor(c.f * 0.6);
      const perm = fract(Math.sin((tx * 3 + ty + cut * 7.3) * 91.7) * 4375.5);
      const nt = Math.floor(perm * 9);
      u += ((nt % 3) - tx) * 0.667; v += (Math.floor(nt / 3) - ty) * 0.667;
      u = ((u + 1) % 2 + 2) % 2 - 1; v = ((v + 1) % 2 + 2) % 2 - 1;
    } else if (s4 === 2) { // acted: a stage, a spotlight, a performance
      if (p < 0.4) { v = -0.55 - R4[j] * 0.4; r = 0.55; g = 0.25; b = 0.15; }
      else if (p < 0.55) { const t = R3[j]; u = mix(-0.05, -0.3 + (R4[j] - 0.5) * 0.6, t); v = mix(1, -0.5, t); r = 1; g = 0.9; b = 0.6; sz = 0.4; }
      else { u += 0.3; if (Math.abs(u) > 0.92) { r = 0.7; g = 0.1; b = 0.15; } }
      if (R3[j] < 0.12) { u = R3[j] < 0.06 ? -0.95 + R4[j] * 0.12 : 0.95 - R4[j] * 0.12; v = R2[j] * 2 - 1; r = 0.65; g = 0.08; b = 0.12; }
    } else if (s4 === 3) { // generated: convincing, impossible
      const band = Math.floor((v + 1) * 6 + c.f * 0.9);
      const glitch = fract(Math.sin(band * 43.1 + Math.floor(c.t * 3)) * 999) < 0.3 ? 1 : 0;
      u += glitch * (fract(Math.sin(band * 7.7 + Math.floor(c.t * 5)) * 77) - 0.5) * 0.5;
      if (p > 0.55 && R4[j] < 0.5) u = -u - 0.2; // a second figure that never existed
      const hue = fract(u * 0.5 + v * 0.3 + c.t * 0.2);
      r = 0.5 + 0.5 * Math.sin(hue * TAU); g = 0.5 + 0.5 * Math.sin(hue * TAU + 2.1); b = 0.5 + 0.5 * Math.sin(hue * TAU + 4.2);
    }
  }
  set(cx0 + u * W * 0.5 * grow, cy0 + v * H * 0.5 * grow, f * 1.5, r * dim, g * dim, b * dim, sz * (0.8 + f * 0.4));
}
SCENES.push({
  cues: { rec: 'The recorded', edit: 'The edited', act: 'The acted', gen: 'The generated', all: 'All four can produce persuasive images.' },
  seq: [[null, 0]],
  mood: 7,
  states: [(i, c) => {
    const q = c.q; let focus = -1;
    if (q.all >= 0) focus = -1; else if (q.gen >= 0) focus = 3; else if (q.act >= 0) focus = 2; else if (q.edit >= 0) focus = 1; else if (q.rec >= 0) focus = 0;
    screen(i, c, focus);
  }],
});

// ---------- 8. The Matrix Question
function rain(i, c, freeze, tear) {
  const COLS = c.sx < 0.7 ? 46 : 96, ROWS = 46, layer = i % 3;
  const k = Math.floor(i / 3), col = k % COLS, row = Math.floor(k / COLS) % ROWS;
  const x = (col / COLS - 0.5) * (34 + layer * 12) * c.sx, y = 11 - row * 0.5 * (1 + layer * 0.35), z = -2 - layer * 8;
  const sp = 0.4 + fract(Math.sin(col * 12.3 + layer * 7) * 999) * 0.9, ph = fract(Math.sin(col * 3.7 + layer) * 777);
  const head = fract(ph + (c.f * 0.03 + c.t * 0.05 * (1 - freeze)) * sp) * (ROWS + 18);
  const d = head - row;
  let br = d >= 0 && d < 16 ? Math.pow(1 - d / 16, 1.6) : 0;
  const flick = fract(Math.sin((row * 31 + col * 17) + Math.floor(c.t * 8) * 0.37) * 999);
  let xx = x;
  if (tear > 0) { const band = Math.floor(y * 1.3 + c.t * 4); xx += (fract(Math.sin(band * 9.1 + Math.floor(c.t * 7)) * 99) - 0.5) * 3 * tear; }
  const hd = d >= 0 && d < 1.2 ? 1 : 0;
  set(xx, y, z, 0.5 * br + hd * 0.9, (1.6 * br + 0.06) * (0.7 + flick * 0.3), 0.55 * br + hd * 0.8, (0.45 + br * 1.1 + hd * 0.6) * (1 - layer * 0.2));
}
function eye(i, c, warm) {
  const q = R1[i]; let x, y, r, g, b;
  const open = 0.8 + 0.2 * Math.sin(c.f * 0.2);
  if (q < 0.35) { const t = R2[i] * 2 - 1, up = R3[i] < 0.5 ? 1 : -1; x = t * 7 * c.sx; y = up * (1 - t * t) * 2.6 * open; r = 0.6; g = 1; b = 0.6; }
  else if (q < 0.8) { const a = R2[i] * TAU, rr = 0.7 + Math.pow(R3[i], 0.7) * 1.4; x = Math.cos(a) * rr; y = Math.sin(a) * rr; const s = Math.sin(a * 24) * 0.5 + 0.5; r = 0.3 + s * 0.3; g = 0.9; b = 0.4 + s * 0.3; }
  else { const a = R2[i] * TAU, rr = Math.sqrt(R3[i]) * 0.6; x = Math.cos(a) * rr; y = Math.sin(a) * rr; r = 0.05; g = 0.15; b = 0.08; }
  r = mix(r, 1, warm * 0.6); g = mix(g, 0.8, warm * 0.5); b = mix(b, 0.5, warm * 0.5);
  set(x, y + 1.3, 0, r, g, b, 0.75 + R4[i] * 0.4);
}
SCENES.push({
  cues: { see: 'Did I see it?', rel: 'What is the relationship between what I saw', suff: 'Seeing is no longer sufficient.' },
  seq: [[null, 0], ['see', 1], ['rel', 2], ['suff', 3]],
  mood: 8,
  states: [
    (i, c) => rain(i, c, 0, 0),
    (i, c) => rain(i, c, 0.7, 1),
    (i, c) => eye(i, c, 0),
    (i, c) => eye(i, c, 1),
  ],
});

// ---------- 9. Can the Camera Alter the Future?
function walker(i, c, x0, sc) {
  if (R4[i] < 0.12) { humanAt(i, c, sc, x0, -1.6, 2, 0.95, 0.85, 0.7); return true; }
  return false;
}
function cloud(i, c) {
  const x = (R1[i] - 0.5) * 34 * c.sx, z = -6 + (R2[i] - 0.5) * 12;
  const y = 6.5 + G1[i] * 0.8 + Math.sin(x * 0.4 + c.f * 0.05) * 0.8 + Math.sin(z * 0.6 + x * 0.2) * 0.5;
  set(x, y, z, 0.35, 0.4, 0.55, 1.3 + R3[i] * 1.4);
}
function worldline(i, c, split, choice) {
  // the path of one person, splitting at the moment of the umbrella
  if (walker(i, c, mix(-8, 4, fract(c.f * 0.01)) * c.sx * 0, 0.0)) { hide(); return; }
  const t = R1[i], x = (t - 0.5) * 26 * c.sx, fork = -2 * c.sx;
  let y = -1.5, bright = 1, z = 0;
  if (split > 0 && x > fork) {
    const d = (x - fork) / (13 * c.sx), branch = R2[i] < 0.5;
    const umb = branch ? 1 : 0;
    y += (branch ? 1 : -1) * Math.pow(d, 0.8) * 3.2 * split;
    const chosen = (choice === 'umbrella') === branch;
    bright = chosen ? 1.2 : 0.25;
  }
  const pulse = Math.pow(Math.max(0, Math.sin((t * 6 - c.f * 0.08) * TAU)), 12);
  set(x, y + G1[i] * 0.05, z + G2[i] * 0.05, 0.95 * bright, (0.75 + pulse * 0.25) * bright, (0.45 + pulse * 0.5) * bright, (0.55 + pulse * 1.2) * Math.max(0.5, bright));
}
function network(i, c, ripple, glow) {
  const L = 64, line = i % L, t = R1[i];
  const main = line === 0;
  const baseZ = main ? 0 : ((line / L) - 0.5) * 30 + Math.sin(line * 13.7) * 0.6;
  const x = (t - 0.5) * 36 * c.sx;
  let z = baseZ + Math.sin(x * 0.25 + line * 1.7) * 1.2 + Math.sin(x * 0.11 + line) * 1.6;
  // the ripple: lives near the changed path bend towards it and meet it
  const dist = Math.abs(baseZ), reach = ripple * 16;
  const infl = main ? 0 : sst(reach, reach - 5, dist) * Math.exp(-Math.pow((x - 2) / 9, 2));
  z = mix(z, z * 0.25 + Math.sin(x * 0.5 + line) * 0.6, infl);
  const pulse = Math.pow(Math.max(0, Math.sin((t * 5 - c.f * 0.05 + line * 0.13) * TAU)), 16) * glow;
  let r = 0.3, g = 0.4, b = 0.75, s = 0.5;
  if (main) { r = 1; g = 0.8; b = 0.45; s = 0.9; }
  else if (infl > 0.1) { r = mix(r, 0.95, infl); g = mix(g, 0.7, infl); b = mix(b, 0.55, infl); s += infl * 0.4; }
  set(x, 0, z, r + pulse, g + pulse, b + pulse, s + pulse * 1.5);
  rotX(-1.05); O[1] -= 0.5;
}
SCENES.push({
  cues: { likely: 'Rain is likely.', rains: 'Later, it rains.', without: 'Without the information:', with: 'With the information:', ret: 'When I return to get the umbrella', delay: 'Because of that delay', network: 'A small change enters a network of lives.', proposition: 'We do not merely exist in time.' },
  seq: [[null, 0], ['without', 1], ['with', 2], ['ret', 3], ['proposition', 4]],
  mood: 9,
  rain: true,
  states: [
    (i, c) => { if (walker(i, c, Math.sin(c.f * 0.02) * 2, 0.55)) return; if (R3[i] < 0.6) cloud(i, c); else dust(i, c, 0.4); },
    (i, c) => { if (R3[i] < 0.35) cloud(i, c); else worldline(i, c, 0, c.choice); },
    (i, c) => { if (R3[i] < 0.35) cloud(i, c); else worldline(i, c, sst(0, 1.5, c.q.with), c.choice); },
    (i, c) => network(i, c, Math.max(0.05, sst(0, 9, c.q.delay)), 0.4),
    (i, c) => network(i, c, 1, 1),
  ],
});

// ---------- 10. Cameras Are Everywhere
function lenses(i, c, count, spread, sizeMul, orbit) {
  const L = count, k = i % L, j = Math.floor(i / L);
  const a1 = fract(Math.sin(k * 12.9898) * 43758.5), a2 = fract(Math.sin(k * 78.233) * 12345.6), a3 = fract(Math.sin(k * 39.42) * 24634.6);
  let cx, cy, cz;
  if (orbit) {
    const ang = a1 * TAU + c.f * 0.03 * (0.5 + a2), inc = (a2 - 0.5) * 2.2, rr = 5 + a3 * 3;
    cx = Math.cos(ang) * rr; cz = Math.sin(ang) * rr * Math.cos(inc); cy = 1.2 + Math.sin(ang) * rr * Math.sin(inc) * 0.6;
  } else { cx = (a1 - 0.5) * spread * 1.5 * c.sx; cy = (a2 - 0.5) * spread * 0.85 + 1; cz = -a3 * spread * 1.3 + 4; }
  const blink = fract(c.f * 0.02 * (0.5 + a1) + a3), open = blink < 0.06 ? blink / 0.06 : 1;
  const sz = (0.5 + a2 * 0.9) * sizeMul;
  const q = fract(j * 0.618 + R1[i] * 0.01);
  let x, y, r, g, b;
  if (q < 0.55) { const ring = Math.floor(R2[i] * 3), a = R3[i] * TAU, rr = (0.7 + ring * 0.3) * sz; x = Math.cos(a) * rr; y = Math.sin(a) * rr; r = 0.9; g = 0.85; b = 1; if (ring === 2) { r = 1; g = 0.78; b = 0.45; } }
  else { const a = R3[i] * TAU, rr = (0.15 + 0.5 * open) * sz * Math.sqrt(R2[i]); x = Math.cos(a) * rr; y = Math.sin(a) * rr; r = 0.35; g = 0.65; b = 1.2; if (R2[i] > 0.85) { r = 1.4; g = 1.3; b = 1.3; } }
  set(cx + x, cy + y, cz, r, g, b, 0.7 + sz * 0.7);
}
function earthAt(i, c) {
  const k = i % (S.earth.pts.length / 3), t = S.earth.tags[k];
  fromShape(S.earth.pts, k, 1, 0, 0, 0); rotY(c.f * 0.04); rotX(0.3); O[1] += 1.2;
  if (t === 1) { O[3] = 0.35; O[4] = 0.6; O[5] = 0.3; } else if (t === 2) { O[3] = 0.9; O[4] = 0.95; O[5] = 1; } else { O[3] = 0.15; O[4] = 0.35; O[5] = 0.9; }
  O[6] = 0.8;
}
function wallOfFrames(i, c, scan) {
  const cols = c.sx < 0.7 ? 12 : 30, rows = 18, k = i % (cols * rows), col = k % cols, row = Math.floor(k / cols);
  const fw = 0.9, fh = 0.6, cx = (col - (cols - 1) / 2) * 1.05, cy = (row - (rows - 1) / 2) * 0.75 + 1;
  const t = R2[i] * 4, side = Math.floor(t), w = t - side;
  const u = side === 0 ? -1 + w * 2 : side === 1 ? 1 : side === 2 ? 1 - w * 2 : -1;
  const v = side === 0 ? 1 : side === 1 ? 1 - w * 2 : side === 2 ? -1 : -1 + w * 2;
  const inside = R1[i] < 0.4;
  const x = cx + (inside ? (R3[i] - 0.5) * fw * 1.6 : u * fw * 0.5 * 1.6), y = cy + (inside ? (R4[i] - 0.5) * fh * 1.6 : v * fh * 0.5 * 1.6);
  const sweep = fract(c.f * 0.012) * (cols + 8) - 4, hit = Math.exp(-Math.pow(col - sweep, 2) * 0.3) * scan;
  set(x, y, -4, 0.55 + hit * 0.8, 0.65 + hit * 0.6, 1 + hit * 0.3, 0.7 + hit * 0.8);
}
SCENES.push({
  cues: { shutter: 'You pressed the shutter.', every: 'Cameras are everywhere.', earth: 'They observe the Earth from above.', space: 'They look into space.', billions: 'Billions of acts of observation.', truth: 'More cameras do not automatically produce more truth.', human: 'The human being must still ask' },
  seq: [[null, 0], ['every', 1], ['earth', 2], ['space', 1], ['billions', 3], ['truth', 4], ['human', 5]],
  mood: 10,
  states: [
    (i, c) => { // one camera, one photographer
      const snap = c.q.shutter >= 0 && c.q.shutter < 0.6 ? 1 - c.q.shutter / 0.6 : 0;
      if (i < N * 0.7) lensAt(i, c, 2.2, 0, 1.2, 0, 1 - snap * 0.95);
      else dust(i, c, 0.5 + snap * 3);
    },
    (i, c) => lenses(i, c, 140, 20, 1.5, false),
    (i, c) => { if (i % 3 === 0) earthAt(i, c); else lenses(i, c, 60, 10, 0.5, true); },
    (i, c) => lenses(i, c, 600, 26, 0.75, false),
    (i, c) => wallOfFrames(i, c, 1),
    (i, c) => { if (R4[i] < 0.3) humanAt(i, c, 0.9, 0, 0.6, 3, 1, 0.78, 0.45); else wallOfFrames(i, c, 0.2); },
  ],
});

// ---------- 11. The Temporal Aura
function aura(i, c) {
  if (R1[i] < 0.55) { humanAt(i, c, 1, 0, 1, 0, 1, 0.8, 0.55); return; }
  const v = [G1[i], G2[i], G3[i]], l = Math.hypot(v[0], v[1], v[2]) + 1e-6;
  const pulse = 1 + 0.15 * Math.sin(c.f * 0.25 - R3[i] * 3);
  const d = (1.6 + Math.pow(R2[i], 2) * 3.5) * pulse;
  set(v[0] / l * d * 0.9, 1 + v[1] / l * d * 1.4, v[2] / l * d * 0.9, 0.55, 0.45, 0.95, 0.5 + (1 - R2[i]) * 0.5);
  O[3] *= 0.6; O[4] *= 0.6; O[5] *= 0.6;
}
function chrono(i, c) { // chronophotography: the same body at successive moments
  const G = 11, g = i % G, j = Math.floor(i / G) * G + g;
  const tt = (g - (G - 1)) * 0.9 + fract(c.f * 0.015) * 0.9;
  const x = tt * 1.5 * c.sx + 6 * c.sx, y = Math.sin(tt * 0.6) * 0.4;
  const age = (G - 1 - g) / (G - 1);
  fromShape(S.human, j, 0.85, x, y + 0.8, -age * 2);
  const k = 1 - age * 0.8;
  O[3] = mix(0.35, 1, k); O[4] = mix(0.4, 0.82, k); O[5] = mix(0.95, 0.55, k); O[6] = 0.5 + k * 0.4;
  O[3] *= k + 0.15; O[4] *= k + 0.15; O[5] *= k + 0.15;
}
function trails(i, c, meet) {
  const B = 9, b = i % B, j = Math.floor(i / B);
  const lag = R1[i] * 7;
  const phase = c.f * 0.03 - lag * 0.25 + b * 0.7;
  const rr = 3 + b * 0.55, inc = (b - 4) * 0.25;
  let x = Math.cos(phase * (1 + b * 0.07)) * rr * c.sx * 1.2, z = Math.sin(phase * (1 + b * 0.07)) * rr;
  let y = 1 + Math.sin(phase * 1.3 + b) * rr * inc * 0.6;
  if (meet > 0 && b < 2) { const s = b === 0 ? -1 : 1; x = mix(x, s * (4 - meet * 3) + Math.cos(phase * 2) * 2, meet); z = mix(z, Math.sin(phase * 2 + s) * 2, meet); }
  const head = 1 - R1[i];
  const hue = b / B;
  set(x, y, z, 0.5 + 0.5 * Math.sin(hue * TAU), 0.5 + 0.5 * Math.sin(hue * TAU + 2), 0.6 + 0.4 * Math.sin(hue * TAU + 4), 0.3 + Math.pow(head, 3) * 1.6);
  const k = Math.pow(head, 1.5); O[3] *= k; O[4] *= k; O[5] *= k;
}
function carousel(i, c) {
  const K = 7, slot = i % K, j = Math.floor(i / K);
  const ghost = R1[i] < 0.45 ? Math.floor(R2[i] * 4) + 1 : 0;
  const ang = slot / K * TAU + c.f * 0.02 - ghost * 0.09;
  const rr = 7.2 * c.sx, cx = Math.cos(ang) * rr, cz = Math.sin(ang) * rr * 0.5 - 2, cy = 1 + Math.sin(ang) * 1.3;
  const sc = 0.55;
  switch (slot) {
    case 0: { const k = j % (S.flower.pts.length / 3); fromShape(S.flower.pts, k, 0.65, 0, 0, 0); rotX(0.4); O[3] = 0.95; O[4] = 0.45; O[5] = 0.6; break; }
    case 1: fromShape(S.cone, j, sc, 0, 0, 0); O[3] = 0.65; O[4] = 0.5; O[5] = 0.45; break;
    case 2: fromShape(S.human, j, sc, 0, 0, 0); O[3] = 1; O[4] = 0.75; O[5] = 0.45; break;
    case 3: { const k = j % (S.lens.pts.length / 3); fromShape(S.lens.pts, k, 0.7, 0, 0, 0); O[3] = 0.85; O[4] = 0.75; O[5] = 0.55; break; }
    case 4: fromShape(S.attractor, j, 0.35, 0, 0, 0); O[3] = 0.4; O[4] = 0.8; O[5] = 1; break;
    case 5: fromShape(S.earth.pts, j, 0.45, 0, 0, 0); O[3] = 0.25; O[4] = 0.5; O[5] = 0.95; break;
    default: fromShape(S.galaxy.pts, j, 0.38, 0, 0, 0); rotX(1); O[3] = 0.8; O[4] = 0.55; O[5] = 0.95;
  }
  rotY(c.f * 0.05 + slot);
  O[0] += cx; O[1] += cy; O[2] += cz;
  const k = ghost ? 0.5 / ghost : 1;
  O[3] *= k; O[4] *= k; O[5] *= k; O[6] = 0.55 * (ghost ? 0.8 : 1) + R3[i] * 0.3;
}
SCENES.push({
  cues: { seek: 'Perhaps what you are seeking is a temporal aura.', private: 'Then a temporal aura is not merely', meet: 'One temporal aura meets another.', flower: 'Then the flower has its temporal aura.' },
  seq: [[null, 0], ['seek', 1], ['private', 2], ['flower', 3]],
  mood: 11,
  states: [aura, chrono, (i, c) => trails(i, c, sst(0, 1.5, c.q.meet)), carousel],
});

// ---------- 12. Grambles
function wordMorph(i, c, arr, r, g, b) { wordAt(i, c, arr, 0, 1.4, r, g, b); }
function grambles(i, c) {
  // a word that will not hold a human shape: above it, a swarm keeps trying
  // to spell the human words, and keeps coming apart
  const sh = 0.7 + 0.3 * Math.sin(c.t * 3 + R1[i] * 60);
  if (R4[i] < 0.68) {
    fromShape(S.wGrambles, i, 1, 0, 0.6, 0);
    const n = 0.05 + 0.08 * Math.abs(Math.sin(c.t * 0.9 + R1[i] * 6));
    O[0] += Math.sin(c.t * 2 + R2[i] * 40) * n; O[1] += Math.cos(c.t * 1.7 + R3[i] * 40) * n; O[2] = Math.sin(c.t + R4[i] * 30) * n * 2;
    O[3] = 0.55 * sh; O[4] = 0.85 * sh; O[5] = 1.1 * sh; O[6] = 0.6 + R3[i] * 0.5;
    return;
  }
  const words = [S.wThinking, S.wDreaming, S.wFeeling, S.wConscious];
  const cyc = c.f * 0.07, k = Math.floor(cyc) % 4, ph = fract(cyc);
  const form = sst(0.1, 0.45, ph) * (1 - sst(0.6, 0.9, ph));
  fromShape(words[k], i, 0.42, 0, 4.1, 0);
  const tx = O[0], ty = O[1];
  const a = R1[i] * TAU + c.t * 0.3, rr = 3 + R2[i] * 6;
  const sx = Math.cos(a) * rr, sy = 3 + Math.sin(a) * rr * 0.45;
  O[0] = mix(sx, tx, form); O[1] = mix(sy, ty, form); O[2] = (1 - form) * G1[i] * 2;
  O[3] = 0.95 * sh; O[4] = 0.72 * sh; O[5] = 0.45 * sh; O[6] = 0.45 + form * 0.4;
}
function alien(i, c, humanAside) {
  if (humanAside && R4[i] < 0.22) { humanAt(i, c, 0.65, -8.5 * c.sx, -0.4, -1, 0.9, 0.7, 0.45); return; }
  fromShape(S.attractor, i, 1.05, 0, 0, 0); rotY(c.f * 0.04); rotX(0.4); O[1] += 1.3;
  const k = (i * 3) % S.attractor.length, h = S.attractor[k + 1];
  O[3] = 0.35 + h * 0.08; O[4] = 0.7; O[5] = 1; O[6] = 0.55 + R2[i] * 0.4;
}
SCENES.push({
  cues: { thinking: 'thinking.', dreaming: 'dreaming.', feeling: 'feeling.', conscious: 'consciousness.', grambles: 'Grambles.', allow: 'I was trying to allow Lumen not to be human.', centre: 'Perhaps our instruments are beginning' },
  seq: [[null, 0], ['thinking', 1], ['dreaming', 2], ['feeling', 3], ['conscious', 4], ['grambles', 5], ['allow', 6], ['centre', 7]],
  mood: 12,
  states: [
    (i, c) => dust(i, c, 0.8),
    (i, c) => wordMorph(i, c, S.wThinking, 0.95, 0.75, 0.5),
    (i, c) => wordMorph(i, c, S.wDreaming, 0.95, 0.75, 0.5),
    (i, c) => wordMorph(i, c, S.wFeeling, 0.95, 0.75, 0.5),
    (i, c) => wordMorph(i, c, S.wConscious, 0.95, 0.75, 0.5),
    grambles,
    (i, c) => alien(i, c, false),
    (i, c) => alien(i, c, true),
  ],
});

// ---------- 13. The Camera Between Us
function between(i, c, mode, stream) {
  // mode 0: Neil, lens, world. 1: Neil, lens, Lumen. 2: symmetric nebulae with streams
  const q = R1[i];
  if (q < 0.18) { lensAt(i, c, 1, 0, 1.3, 0, 0.8); return; }
  if (q < 0.18 + 0.25 * stream) { // thought travelling through the lens, both directions
    const dir = R2[i] < 0.5 ? 1 : -1, t = fract(R3[i] + c.f * 0.04 * dir);
    const x = (t - 0.5) * 15 * c.sx, pinch = 1 - Math.exp(-x * x * 0.4);
    const a = R4[i] * TAU;
    set(x, 1.3 + Math.sin(a) * (0.15 + pinch * 1.6), Math.cos(a) * (0.15 + pinch * 1.6), dir > 0 ? 1 : 0.4, dir > 0 ? 0.75 : 0.75, dir > 0 ? 0.4 : 1, 0.5 + (1 - pinch) * 0.9);
    return;
  }
  const left = R2[i] < 0.5;
  if (left) {
    if (mode < 2) { humanAt(i, c, 1, -7 * c.sx, 1, 0, 1, 0.78, 0.45, mode >= 1 ? 1.2 : 0); return; }
    galaxyAt(i, c, 0.45, -7 * c.sx, 1.3, 0, 1.2, c.f * 0.05, 0);
  } else {
    if (mode === 0) { fromShape(S.earth.pts, i, 0.9, 0, 0, 0); rotY(c.f * 0.04); O[0] += 7 * c.sx; O[1] += 1.3; const t = S.earth.tags[i % S.earth.tags.length]; O[3] = t ? 0.35 : 0.15; O[4] = t ? 0.6 : 0.35; O[5] = t ? 0.3 : 0.9; O[6] = 0.7; return; }
    fromShape(S.attractor, i, 0.6, 0, 0, 0); rotY(c.f * 0.05); O[0] += 7 * c.sx; O[1] += 1.3; O[3] = 0.35; O[4] = 0.75; O[5] = 1; O[6] = 0.6;
  }
}
SCENES.push({
  cues: { turned: 'Now, in this later period of my life, I have turned around', sym: 'There is a symmetry here.', travels: 'The thought travels between us.' },
  seq: [[null, 0], ['turned', 1], ['sym', 2], ['travels', 3]],
  mood: 13,
  states: [(i, c) => between(i, c, 0, 0), (i, c) => between(i, c, 1, 0.3), (i, c) => between(i, c, 2, 0.5), (i, c) => between(i, c, 2, 1)],
});

// ---------- 14. Another Kind of Time Travel
function zoomRings(i, c) {
  // travelling towards another scale: an endless zoom through nested worlds
  const L = 7, layer = i % L;
  const s = fract(layer / L + c.f * 0.012);
  const scale = Math.pow(60, s) * 0.06;
  const a = R1[i] * TAU + layer * 0.7 + c.f * 0.01 * (layer % 2 ? 1 : -1);
  const kind = layer % 3;
  let x, y, z;
  if (kind === 0) { const rr = 3 + G1[i] * 0.08; x = Math.cos(a) * rr; y = Math.sin(a) * rr; z = 0; }
  else if (kind === 1) { const arm = R2[i] < 0.5 ? 0 : Math.PI, rr = Math.pow(R3[i], 0.7) * 3.5; const b = arm + Math.log(rr + 0.2) * 2.5; x = Math.cos(b) * rr; y = Math.sin(b) * rr; z = 0; }
  else { const k = Math.floor(R2[i] * 6), t = R3[i], a0 = k / 6 * TAU, a1 = (k + 1) / 6 * TAU; x = (Math.cos(a0) * (1 - t) + Math.cos(a1) * t) * 2.6; y = (Math.sin(a0) * (1 - t) + Math.sin(a1) * t) * 2.6; z = 0; }
  const fade = Math.sin(s * Math.PI);
  const col = [[1, 0.75, 0.4], [0.55, 0.6, 1], [0.95, 0.85, 0.7]][kind];
  set(x * scale, y * scale + 1.2, -scale * 0.5, col[0] * fade * 1.6, col[1] * fade * 1.6, col[2] * fade * 1.6, (0.55 + scale * 0.3) * fade + 0.05);
}
const MONTAGE = ['flower', 'mountain', 'star', 'matter', 'umbrella', 'journey'];
function montage(i, c, which) {
  switch (which) {
    case 'flower': { const k = i % (S.flower.pts.length / 3), t = S.flower.tags[k]; fromShape(S.flower.pts, k, 1.4, 0, 0, 0); rotX(0.4); rotY(c.f * 0.05); O[1] += 1.2; O[3] = t === 2 ? 0.25 : 0.95; O[4] = t === 2 ? 0.6 : t === 1 ? 0.75 : 0.4; O[5] = t === 2 ? 0.3 : 0.55; O[6] = 0.8; return; }
    case 'mountain': fromShape(S.cone, i, 1.2, 0, 0, 0); rotY(c.f * 0.05); O[1] += 1.4; O[3] = 0.65; O[4] = 0.52; O[5] = 0.5; O[6] = 0.7; if (O[1] > 3.4) { O[3] = 0.95; O[4] = 0.95; O[5] = 1; } return;
    case 'star': fromShape(S.star, i, 1.1, 0, 1.2, 0); rotY(c.f * 0.05); O[3] = 1; O[4] = 0.9; O[5] = 0.65; O[6] = 0.8; return;
    case 'matter': fromShape(S.fern, i, 1.4, 0, 1.4, 0); O[3] = 1; O[4] = 0.72; O[5] = 0.3; O[6] = 0.8; return;
    case 'umbrella': { if (R4[i] < 0.25) { const x = (R1[i] - 0.5) * 20, y = 9 - fract(R2[i] + c.t * 0.6) * 16; set(x, y, (R3[i] - 0.5) * 6, 0.45, 0.55, 0.8, 0.4); if (Math.abs(x) < 3.6 && y < 2.6 && y > -3) hide(); return; } fromShape(S.umbrella, i, 1.05, 0, 0.4, 0); rotY(c.f * 0.05); O[3] = 0.95; O[4] = 0.4; O[5] = 0.45; O[6] = 0.8; return; }
    default: network(i, c, 1, 1);
  }
}
SCENES.push({
  cues: { canlist: 'The camera can:', scale: 'At another temporal scale', flower: 'The movement of a flower.', mountain: 'The transformation of a mountain.', star: 'Ancient light arriving from a star.', matter: 'The history stored in matter.', umbrella: 'The weather forecast that sends Neil back', journey: 'The changed journey', each: 'Each challenges the assumption' },
  seq: [[null, 0], ['canlist', 1], ['flower', 2], ['mountain', 3], ['star', 4], ['matter', 5], ['umbrella', 6], ['journey', 7], ['each', 1]],
  mood: 14,
  states: [
    (i, c) => { if (i < N * 0.5) lensAt(i, c, 2.1, 0, 1.2, 0, 0.6 + 0.4 * Math.sin(c.f * 0.1)); else dust(i, c, 0.7); },
    zoomRings,
    ...MONTAGE.map(m => (i, c) => montage(i, c, m)),
  ],
});

// ---------- Epilogue: Everything Is Always Changing
SCENES.push({
  cues: { matters: 'Perhaps that is ultimately why the camera matters.', never: 'So perhaps the camera was never freezing time.', cannot: 'It was showing us that time cannot be frozen.', question: 'Then the question with which I would like to continue', standing: 'Standing between Neil and Lumen is still the camera.', beginning: 'The beginning of the question.' },
  seq: [[null, 0], ['matters', 1], ['cannot', 2], ['question', 3], ['standing', 4], ['beginning', 5]],
  mood: 15,
  shutter: true,
  states: [
    (i, c) => galaxyAt(i, c, 1.45, 0, 0.8, -2, 0.95, c.f * 0.03),
    (i, c) => { if (i < N * 0.25) lensAt(i, c, 1.5, 0, 0.8, 1, 0.9); else galaxyAt(i, c, 1.45, 0, 0.8, -3, 0.95, c.f * 0.03); },
    (i, c) => { // time cannot be frozen: everything bursts back into motion
      const b = sst(0, 2.5, c.q.cannot);
      fromShape(S.web, i, 1.3 + b * 0.6, 0, 1, -2); rotY(c.f * 0.04);
      set(O[0], O[1], O[2], 0.6 + R1[i] * 0.4, 0.55 + R2[i] * 0.3, 0.95, 0.6 + R3[i] * 0.6);
    },
    (i, c) => deepField(i, c, 0.15, 2),
    (i, c) => { // callback to the prologue: two voices and the camera between
      if (i < N * 0.2) lensAt(i, c, 0.85, 0, 1.4, 0, 0.75);
      else if (i < N * 0.7) {
        const left = i % 2 === 0, cx = left ? -6 * c.sx : 6 * c.sx;
        if (left) galaxyAt(i, c, 0.42, cx, 1.4, 0, 1.1, c.f * 0.05, 0);
        else { fromShape(S.attractor, i, 0.55, 0, 0, 0); rotY(c.f * 0.05); O[0] += cx; O[1] += 1.4; O[3] = 0.35; O[4] = 0.75; O[5] = 1; O[6] = 0.6; }
      } else dust(i, c, 0.7);
    },
    (i, c) => galaxyAt(i, c, 1.9, 0, 1.4, -4, 1.05, c.f * 0.03),
  ],
});

export { SCENES, sst, fract, mix };
