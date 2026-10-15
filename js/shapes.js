// Point-cloud shape library. Every shape is a Float32Array of n*3 positions,
// precomputed once so scenes can morph between them cheaply.

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function unitVec(r) {
  const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return [s * Math.cos(a), u, s * Math.sin(a)];
}

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2831853 * r());
}

// caps: [ax,ay,az, bx,by,bz, radius, tag?]
export function sampleCapsules(caps, n, seed) {
  const r = rng(seed), out = new Float32Array(n * 3), tags = new Uint8Array(n);
  const w = caps.map(c => (Math.hypot(c[3] - c[0], c[4] - c[1], c[5] - c[2]) + c[6] * 1.3) * c[6]);
  const tot = w.reduce((a, b) => a + b, 0);
  const cum = []; let acc = 0;
  for (const x of w) { acc += x / tot; cum.push(acc); }
  for (let i = 0; i < n; i++) {
    const q = r(); let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < q) lo = m + 1; else hi = m; }
    const c = caps[lo], t = r(), v = unitVec(r), rr = c[6] * (0.72 + 0.28 * r());
    out[i * 3] = c[0] + (c[3] - c[0]) * t + v[0] * rr;
    out[i * 3 + 1] = c[1] + (c[4] - c[1]) * t + v[1] * rr;
    out[i * 3 + 2] = c[2] + (c[5] - c[2]) * t + v[2] * rr;
    tags[i] = c[7] || 0;
  }
  return { pts: out, tags };
}

export function human(n, seed = 11) {
  const caps = [
    [0, 2.62, 0, 0, 2.78, 0, 0.42, 1],
    [0, 2.15, 0, 0, 2.4, 0, 0.15],
    [0, 1.95, 0, 0, 0.55, 0, 0.5],
    [-0.62, 1.95, 0, 0.62, 1.95, 0, 0.2],
    [-0.66, 1.9, 0, -0.88, 0.8, 0.05, 0.16], [0.66, 1.9, 0, 0.88, 0.8, 0.05, 0.16],
    [-0.88, 0.8, 0.05, -0.98, -0.25, 0.15, 0.13], [0.88, 0.8, 0.05, 0.98, -0.25, 0.15, 0.13],
    [-0.35, 0.45, 0, 0.35, 0.45, 0, 0.3],
    [-0.28, 0.4, 0, -0.32, -1.0, 0, 0.22], [0.28, 0.4, 0, 0.32, -1.0, 0, 0.22],
    [-0.32, -1.0, 0, -0.34, -2.4, 0, 0.17], [0.32, -1.0, 0, 0.34, -2.4, 0, 0.17],
    [-0.34, -2.52, 0, -0.34, -2.52, 0.35, 0.1], [0.34, -2.52, 0, 0.34, -2.52, 0.35, 0.1],
  ];
  return sampleCapsules(caps, n, seed).pts;
}

export function animal(n, seed = 12) {
  const caps = [
    [-1.3, 0.2, 0, 1.2, 0.35, 0, 0.62],
    [1.1, 0.6, 0, 1.7, 1.6, 0, 0.27],
    [1.75, 1.75, 0, 2.35, 1.45, 0, 0.25, 1],
    [1.85, 2.0, 0.1, 1.65, 2.5, 0.25, 0.06], [1.85, 2.0, -0.1, 1.65, 2.5, -0.25, 0.06],
    [1.0, -0.1, 0.3, 1.05, -2.3, 0.3, 0.13], [1.0, -0.1, -0.3, 1.1, -2.3, -0.3, 0.13],
    [-1.1, -0.1, 0.3, -1.2, -2.3, 0.3, 0.14], [-1.1, -0.1, -0.3, -1.05, -2.3, -0.3, 0.14],
    [-1.4, 0.4, 0, -1.85, 0.75, 0, 0.09],
  ].map(c => [c[0] - 0.3, c[1], c[2], c[3] - 0.3, c[4], c[5], c[6], c[7]]);
  return sampleCapsules(caps, n, seed).pts;
}

export function tree(n, seed = 13) {
  const r = rng(seed), caps = [];
  function branch(x, y, z, dx, dy, dz, len, rad, depth) {
    const x2 = x + dx * len, y2 = y + dy * len, z2 = z + dz * len;
    caps.push([x, y, z, x2, y2, z2, rad, 0]);
    if (depth === 0) { caps.push([x2, y2, z2, x2, y2 + 0.1, z2, 0.24 + r() * 0.12, 1]); return; }
    const kids = depth > 3 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      let nx = dx + (r() - 0.5) * 1.5, ny = dy + 0.35 + (r() - 0.5) * 0.4, nz = dz + (r() - 0.5) * 1.5;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      branch(x2, y2, z2, nx, ny, nz, len * 0.74, rad * 0.66, depth - 1);
    }
  }
  branch(0, -3.4, 0, 0, 1, 0, 2.0, 0.3, 5);
  return sampleCapsules(caps, n, seed);
}

export function gear(n, seed = 14) {
  const r = rng(seed), out = new Float32Array(n * 3), teeth = 14;
  for (let i = 0; i < n; i++) {
    const q = r(); let x, y;
    const z = (r() - 0.5) * 0.6;
    if (q < 0.45) { const a = r() * 6.2832, rr = 1.9 + r() * 0.6; x = Math.cos(a) * rr; y = Math.sin(a) * rr; }
    else if (q < 0.7) {
      const k = Math.floor(r() * teeth), a = (k + 0.5 + (r() - 0.5) * 0.45) / teeth * 6.2832, rr = 2.5 + r() * 0.55;
      x = Math.cos(a) * rr; y = Math.sin(a) * rr;
    } else if (q < 0.85) { const a = r() * 6.2832, rr = 0.45 + r() * 0.4; x = Math.cos(a) * rr; y = Math.sin(a) * rr; }
    else {
      const k = Math.floor(r() * 6), a = k / 6 * 6.2832 + (r() - 0.5) * 0.12, rr = 0.85 + r() * 1.05;
      x = Math.cos(a) * rr; y = Math.sin(a) * rr;
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

export function cone(n, seed = 15) {
  const r = rng(seed), out = new Float32Array(n * 3), H = 4.6, R = 4.2;
  for (let i = 0; i < n; i++) {
    const h = H * (1 - Math.sqrt(r())), a = r() * 6.2832;
    let rr = R * (1 - h / H);
    rr *= 1 + 0.18 * Math.sin(a * 5 + h * 1.3) * (h / H + 0.3) + 0.06 * Math.sin(a * 13);
    out[i * 3] = Math.cos(a) * rr; out[i * 3 + 1] = h - 2.4; out[i * 3 + 2] = Math.sin(a) * rr;
  }
  return out;
}

export function planet(n, seed = 16) {
  const r = rng(seed), out = new Float32Array(n * 3), tags = new Uint8Array(n);
  const ct = Math.cos(0.45), st = Math.sin(0.45);
  for (let i = 0; i < n; i++) {
    if (r() < 0.62) {
      const v = unitVec(r);
      out[i * 3] = v[0] * 2; out[i * 3 + 1] = v[1] * 2; out[i * 3 + 2] = v[2] * 2;
    } else {
      const a = r() * 6.2832, rr = 2.8 + Math.pow(r(), 0.8) * 1.5;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      out[i * 3] = x; out[i * 3 + 1] = -z * st; out[i * 3 + 2] = z * ct; tags[i] = 1;
    }
  }
  return { pts: out, tags };
}

export function star(n, seed = 17) {
  const r = rng(seed), out = new Float32Array(n * 3), dirs = [];
  for (let k = 0; k < 18; k++) dirs.push(unitVec(r));
  for (let i = 0; i < n; i++) {
    const q = r(); let v, d;
    if (q < 0.35) { v = unitVec(r); d = Math.cbrt(r()) * 0.95; }
    else if (q < 0.7) { v = dirs[Math.floor(r() * dirs.length)]; d = 1 + Math.pow(r(), 2.2) * 5.5; v = [v[0] + (r() - 0.5) * 0.04, v[1] + (r() - 0.5) * 0.04, v[2] + (r() - 0.5) * 0.04]; }
    else { v = unitVec(r); d = 1 + Math.abs(gauss(r)) * 1.1; }
    out[i * 3] = v[0] * d; out[i * 3 + 1] = v[1] * d; out[i * 3 + 2] = v[2] * d;
  }
  return out;
}

export function galaxy(n, seed = 18, arms = 2, size = 5.5) {
  const r = rng(seed), out = new Float32Array(n * 3), tags = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (r() < 0.16) {
      out[i * 3] = gauss(r) * 0.55; out[i * 3 + 1] = gauss(r) * 0.35; out[i * 3 + 2] = gauss(r) * 0.55; tags[i] = 1;
      continue;
    }
    const t = Math.pow(r(), 0.75), rad = 0.35 + size * t;
    const arm = Math.floor(r() * arms);
    const a = arm * 6.2832 / arms + Math.log(rad + 0.3) * 2.7 + gauss(r) * 0.22;
    const sc = 0.1 + rad * 0.09;
    out[i * 3] = Math.cos(a) * rad + gauss(r) * sc;
    out[i * 3 + 1] = gauss(r) * (0.08 + 0.12 * (1 - t));
    out[i * 3 + 2] = Math.sin(a) * rad + gauss(r) * sc;
    tags[i] = t > 0.55 ? 2 : 0;
  }
  return { pts: out, tags };
}

export function cosmicWeb(n, seed = 19) {
  const r = rng(seed), out = new Float32Array(n * 3), C = [];
  for (let k = 0; k < 42; k++) C.push([(r() - 0.5) * 15, (r() - 0.5) * 9, (r() - 0.5) * 10]);
  const pairs = [];
  for (let a = 0; a < C.length; a++) {
    const d = C.map((c, b) => [Math.hypot(c[0] - C[a][0], c[1] - C[a][1], c[2] - C[a][2]), b]).sort((x, y) => x[0] - y[0]);
    pairs.push([a, d[1][1]], [a, d[2][1]]);
  }
  for (let i = 0; i < n; i++) {
    if (r() < 0.45) {
      const c = C[Math.floor(r() * C.length)], s = 0.15 + r() * 0.35;
      out[i * 3] = c[0] + gauss(r) * s; out[i * 3 + 1] = c[1] + gauss(r) * s; out[i * 3 + 2] = c[2] + gauss(r) * s;
    } else {
      const p = pairs[Math.floor(r() * pairs.length)], A = C[p[0]], B = C[p[1]], t = r();
      out[i * 3] = A[0] + (B[0] - A[0]) * t + gauss(r) * 0.12;
      out[i * 3 + 1] = A[1] + (B[1] - A[1]) * t + gauss(r) * 0.12;
      out[i * 3 + 2] = A[2] + (B[2] - A[2]) * t + gauss(r) * 0.12;
    }
  }
  return out;
}

export function fern(n) {
  const r = rng(20), out = new Float32Array(n * 3);
  let x = 0, y = 0;
  for (let i = -30; i < n; i++) {
    const q = r(); let nx, ny;
    if (q < 0.01) { nx = 0; ny = 0.16 * y; }
    else if (q < 0.86) { nx = 0.85 * x + 0.04 * y; ny = -0.04 * x + 0.85 * y + 1.6; }
    else if (q < 0.93) { nx = 0.2 * x - 0.26 * y; ny = 0.23 * x + 0.22 * y + 1.6; }
    else { nx = -0.15 * x + 0.28 * y; ny = 0.26 * x + 0.24 * y + 0.44; }
    x = nx; y = ny;
    if (i >= 0) { out[i * 3] = x * 0.55; out[i * 3 + 1] = y * 0.55 - 2.75; out[i * 3 + 2] = 0; }
  }
  return out;
}

export function attractor(n) {
  // Aizawa attractor: a shape no human vocabulary was built for.
  const out = new Float32Array(n * 3);
  let x = 0.1, y = 0, z = 0;
  const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1, dt = 0.012;
  for (let i = -2000; i < n * 3; i++) {
    const dx = (z - b) * x - d * y;
    const dy = d * x + (z - b) * y;
    const dz = c + a * z - z * z * z / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
    x += dx * dt; y += dy * dt; z += dz * dt;
    if (i >= 0 && i % 3 === 0) { const k = i / 3; out[k * 3] = x * 3; out[k * 3 + 1] = (z - 0.6) * 3; out[k * 3 + 2] = y * 3; }
  }
  return out;
}

export function earth(n, seed = 21) {
  const r = rng(seed), out = new Float32Array(n * 3), tags = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = unitVec(r);
    const land = Math.sin(v[0] * 3.1 + 1.2) * Math.cos(v[1] * 2.7) + Math.sin(v[2] * 4.3 + v[0] * 2) * 0.6 + Math.sin(v[1] * 6.1 + v[2] * 3.3) * 0.3;
    tags[i] = land > 0.35 ? 1 : 0;
    if (Math.abs(v[1]) > 0.9) tags[i] = 2;
    out[i * 3] = v[0] * 3; out[i * 3 + 1] = v[1] * 3; out[i * 3 + 2] = v[2] * 3;
  }
  return { pts: out, tags };
}

export function umbrella(n, seed = 22) {
  const r = rng(seed), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    if (r() < 0.8) {
      const a = r() * 6.2832, rr = Math.sqrt(r()) * 3.2, u = rr / 3.2;
      const y = 1.6 * (1 - u * u) - 0.45 * Math.pow(u, 4) * (1 - Math.abs(Math.cos(a * 4)));
      out[i * 3] = Math.cos(a) * rr; out[i * 3 + 1] = y + 0.6; out[i * 3 + 2] = Math.sin(a) * rr;
    } else {
      const q = r();
      if (q < 0.75) { out[i * 3] = 0; out[i * 3 + 1] = 2.2 - q / 0.75 * 4.6; out[i * 3 + 2] = 0; }
      else { const a = Math.PI + (q - 0.75) / 0.25 * Math.PI; out[i * 3] = 0.45 + Math.cos(a) * 0.45; out[i * 3 + 1] = -2.4 + Math.sin(a) * 0.45; out[i * 3 + 2] = 0; }
    }
  }
  return out;
}

export function lens(n, seed = 23) {
  // A camera lens seen face on: barrel rings, glass, and a six blade aperture.
  const r = rng(seed), out = new Float32Array(n * 3), tags = new Uint8Array(n);
  const rings = [1.0, 1.35, 1.7, 2.05, 2.4];
  for (let i = 0; i < n; i++) {
    const q = r();
    if (q < 0.55) {
      const R = rings[Math.floor(r() * rings.length)], a = r() * 6.2832, j = (r() - 0.5) * 0.05;
      out[i * 3] = Math.cos(a) * (R + j); out[i * 3 + 1] = Math.sin(a) * (R + j); out[i * 3 + 2] = -R * 0.25; tags[i] = 0;
    } else if (q < 0.8) {
      const k = Math.floor(r() * 6), t = r(), a0 = k / 6 * 6.2832, a1 = (k + 1) / 6 * 6.2832;
      out[i * 3] = Math.cos(a0) * (1 - t) + Math.cos(a1) * t; out[i * 3 + 1] = Math.sin(a0) * (1 - t) + Math.sin(a1) * t;
      out[i * 3 + 2] = 0.05; tags[i] = 1; // aperture edge, scaled by openness at render time
    } else {
      const a = r() * 6.2832, rr = Math.sqrt(r()) * 0.95;
      out[i * 3] = Math.cos(a) * rr; out[i * 3 + 1] = Math.sin(a) * rr; out[i * 3 + 2] = 0.1; tags[i] = 2;
    }
  }
  return { pts: out, tags };
}

export function flower(n, bloom = 1, seed = 24) {
  const out = new Float32Array(n * 3), tags = new Uint8Array(n), r = rng(seed);
  for (let i = 0; i < n; i++) flowerPoint(i, r(), r(), r(), bloom, 0, out, tags);
  return { pts: out, tags };
}

// Shared by the live flower scene and the static flower shape.
export function flowerPoint(i, a, b, c, bloom, turn, out, tags) {
  let x, y, z, tag;
  if (c < 0.7) {
    const layer = Math.floor(c / 0.7 * 3), per = 7;
    const k = Math.floor(a * per), u = (a * per - k);
    const phi = (k + layer * 0.5) / per * 6.2832 + turn;
    const len = 2.7 - layer * 0.55;
    const el = (82 - bloom * (70 - layer * 14)) * Math.PI / 180;
    const w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (0.95 - layer * 0.15) * (b * 2 - 1);
    const along = u * len, curl = u * u * (1 - bloom) * 0.6;
    const ce = Math.cos(el + curl), se = Math.sin(el + curl);
    const dx = Math.cos(phi), dz = Math.sin(phi);
    x = dx * ce * along - dz * w; z = dz * ce * along + dx * w; y = se * along + 0.2;
    tag = 0;
  } else if (c < 0.8) {
    const ang = a * 6.2832, rr = Math.sqrt(b) * 0.55;
    x = Math.cos(ang) * rr; z = Math.sin(ang) * rr; y = 0.25 + (1 - rr) * 0.15; tag = 1;
  } else if (c < 0.93) {
    if (b < 0.6) { x = Math.sin(a * 3) * 0.12; y = 0.1 - a * 5.5; z = 0; }
    else {
      const side = b < 0.8 ? 1 : -1, t = a, lw = Math.sin(Math.PI * t) * 0.4 * ((b * 10) % 1 * 2 - 1);
      x = side * t * 1.6; y = -3 + t * 0.9 * side * side + lw; z = lw * 0.3;
    }
    tag = 2;
  } else {
    const ang = a * 6.2832, rr = 0.5 + b * 3.5;
    x = Math.cos(ang) * rr; z = Math.sin(ang) * rr; y = 0.5 + ((c - 0.93) / 0.07) * 3; tag = 3;
  }
  out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z; tags[i] = tag;
}

export function sampleText(str, n, width, seed = 30, font = '600 220px "Cormorant Garamond", Georgia, serif') {
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 360;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(str, 1024, 180);
  const tw = Math.min(2000, g.measureText(str).width);
  const d = g.getImageData(0, 0, 2048, 360).data, cand = [];
  for (let y = 0; y < 360; y += 2) for (let x = 0; x < 2048; x += 2) if (d[(y * 2048 + x) * 4 + 3] > 120) cand.push(x, y);
  const r = rng(seed), out = new Float32Array(n * 3), s = width / tw, m = cand.length / 2;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * m);
    out[i * 3] = (cand[k * 2] - 1024 + (r() - 0.5) * 2) * s;
    out[i * 3 + 1] = -(cand[k * 2 + 1] - 180 + (r() - 0.5) * 2) * s;
    out[i * 3 + 2] = (r() - 0.5) * 0.25;
  }
  return out;
}

export function dust(n, seed = 31) {
  const r = rng(seed), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = unitVec(r), d = 9 + Math.pow(r(), 0.6) * 34;
    out[i * 3] = v[0] * d; out[i * 3 + 1] = v[1] * d * 0.7; out[i * 3 + 2] = v[2] * d - 12;
  }
  return out;
}
