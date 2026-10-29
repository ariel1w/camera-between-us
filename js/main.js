import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SECTIONS } from './content.js?v=35';
import { initScenes, O, SKY_LABELS, skyAnchor, sst, fract, mix } from './scenes.js?v=35';
import { Score } from './audio.js?v=35';
import { Presence } from './presences.js?v=35';
import { VO_GAIN } from './vogain.js?v=35';

const $ = s => document.querySelector(s);
const MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 600;
const N = MOBILE ? 9000 : 24000;
const UNIT = MOBILE ? 70 : 76; // scroll pixels per timeline unit

// ------------------------------------------------------------ timeline
// Extra breathing room after key lines, so the big moments can land.
const HOLD = {
  0: { 'I chose Lumen.': 1.2, 'Lumen.': 0.8, 'The camera.': 1.6 },
  1: { 'Reverse the sequence.': 0.6, 'But something fundamental had been discovered.': 1 },
  2: { 'It opens.': 0.5, 'It closes.': 0.5, 'It turns.': 0.5, 'It grows.': 0.6, 'It rises.': 0.6, 'It erodes.': 0.6, 'Eventually, it is transformed.': 1.2 },
  3: { 'The universe changes.': 1, 'I am searching for kinship.': 1.4 },
  4: { 'Then there is time in the fuel.': 0.8, 'It had changed its form.': 1 },
  5: { 'Light requires time to travel.': 1.6, 'Yet all these different histories arrive together in my present.': 1, 'Perhaps the night sky is already a kind of natural time machine.': 1.2 },
  6: { 'We are extending what kinds of light can become information available to us.': 1.2, 'The observer has altered the means of observation.': 1 },
  7: { 'The generated': 0.8, 'judgement.': 1.2 },
  8: { 'What is the relationship between what I saw and what actually occurred?': 1.4 },
  9: { 'Later, it rains.': 1, 'With the information:': 0.6, 'Information has affected the future.': 1.4, 'A small change enters a network of lives.': 2, 'We do not merely exist in time. We participate in one another’s futures.': 2.2 },
  10: { 'You pressed the shutter.': 1, 'Cameras are everywhere.': 1, 'Billions of acts of observation.': 1.2 },
  11: { 'One temporal aura meets another.': 1.4 },
  12: { 'Grambles.': 2, 'I was trying to allow Lumen not to be human.': 1.2 },
  13: { 'The thought travels between us.': 1.4 },
  14: { 'It might also mean travelling towards another scale of existence.': 1.4 },
  15: { 'So perhaps the camera was never freezing time.': 1.4, 'It was showing us that time cannot be frozen.': 2.4, 'The beginning of the question.': 2.5 },
};

// Hero lines: the text itself becomes the celebration at these moments.
const HERO = [
  'What is a camera really doing?', 'I chose Lumen.', 'The camera.',
  'Is the camera a time machine?', 'Then perhaps the camera is a proto-time machine.',
  'Nothing happened to the flower', 'Perhaps the mountain was never motionless.',
  'Everything is always changing.', 'Everything.', 'I am searching for kinship.',
  'Then there is time in the fuel.', 'Real and not real.', 'Perhaps the night sky is already a kind of natural time machine.',
  'Perhaps a time machine does not always require a passenger.', 'judgement.', 'Did I see it?', 'Seeing is no longer sufficient.',
  'Information has affected the future.', 'We do not merely exist in time.',
  'Cameras are everywhere.', 'Perhaps we have been constructing a time machine without recognising it.',
  'Aura.', 'Grambles.', 'I was trying to allow Lumen not to be human.', 'The thought travels between us.',
  'Time travel does not necessarily mean travelling to another date.',
  'It was showing us that time cannot be frozen.', 'Not the answer.', 'The beginning of the question.',
];
const isHero = t => HERO.some(h => t === h || t.startsWith(h));

const slots = [];
let total = 0;
const secInfo = [];
SECTIONS.forEach((sec, si) => {
  const info = { start: total, titleSlot: slots.length, lineSlot0: slots.length + 1, n: sec.lines.length, cueIdx: {} };
  // chapter titles stay long enough to read twice: about six seconds, at any reading speed up to 1x
  slots.push({ kind: 'title', sec: si, start: total, len: 5, dur: 6 }); total += 5;
  sec.lines.forEach((ln, li) => {
    const words = ln.t.split(/\s+/).length;
    const hero = isHero(ln.t), short = !hero && words <= 3 && ln.s !== 'H';
    let len = 1.05 + words * 0.075 + (ln.s === 'H' ? 0.3 : 0) + (hero ? 0.9 : 0);
    const hold = (HOLD[si] && HOLD[si][ln.t]) || 0, last = li === sec.lines.length - 1;
    len += hold + (last ? 1.2 : 0);
    const dur = 0.85 + words * 0.19 + (ln.s === 'L' ? 0.45 : 0) + hold * 0.9 + (last ? 0.8 : 0) + (hero ? 1.2 : short ? 0.25 : 0);
    slots.push({ kind: 'line', sec: si, li, start: total, len, dur, line: ln, hero, short }); total += len;
  });
  info.end = total;
  secInfo.push(info);
});
slots.push({ kind: 'credits', sec: SECTIONS.length - 1, start: total, len: 7, dur: 6 }); total += 7;

// ------------------------------------------------------------ scenes + cues
// the particle words are drawn with the site fonts, so wait for them (briefly)
await Promise.race([
  Promise.all(['600 220px "Cormorant Garamond"', 'italic 600 230px "Cormorant Garamond"', '300 230px "Outfit"'].map(f => document.fonts.load(f))),
  new Promise(r => setTimeout(r, 3000)),
]).catch(() => {});
const SCENES = initScenes(N);
SCENES.forEach((sc, si) => {
  const lines = SECTIONS[si].lines, info = secInfo[si];
  for (const [key, txt] of Object.entries(sc.cues)) {
    let idx = lines.findIndex(l => l.t === txt);
    if (idx < 0) idx = lines.findIndex(l => l.t.startsWith(txt));
    if (idx < 0) console.warn('cue not found', si, key, txt);
    info.cueIdx[key] = idx < 0 ? 1e6 : idx;
  }
  info.endQ = {};
  for (const k in info.cueIdx) info.endQ[k] = info.n + 1 - info.cueIdx[k];
});

// ------------------------------------------------------------ three
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x020107, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 0.6, 14);

// the living particle cloud
const geo = new THREE.BufferGeometry();
const POS = new Float32Array(N * 3), COL = new Float32Array(N * 3), SIZ = new Float32Array(N);
geo.setAttribute('position', new THREE.BufferAttribute(POS, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('color', new THREE.BufferAttribute(COL, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('aSize', new THREE.BufferAttribute(SIZ, 1).setUsage(THREE.DynamicDrawUsage));
// particles are written in a shuffled buffer order, so lowering quality (draw range)
// thins every scene evenly instead of dropping whole roles
const PERM = new Uint32Array(N); { for (let i = 0; i < N; i++) PERM[i] = i; for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = PERM[i]; PERM[i] = PERM[j]; PERM[j] = t; } }
const PREV = new Float32Array((MOBILE ? 350 : 1200) * 3);
const SEED = new Float32Array(N); for (let i = 0; i < N; i++) SEED[i] = Math.random();
geo.setAttribute('aSeed', new THREE.BufferAttribute(SEED, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 1 }, uExp: { value: 1 }, uMax: { value: 64 }, uTime: { value: 0 }, uSpark: { value: 0 } },
  vertexShader: `
    attribute float aSize; attribute float aSeed; attribute vec3 color; varying vec3 vC; varying float vA; varying float vSeed;
    uniform float uScale; uniform float uExp; uniform float uMax;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = -mv.z;
      float big = step(0.985, aSeed) * 1.8 + 1.0;
      gl_PointSize = aSize <= 0.001 || d < 0.2 ? 0.0 : min(uMax, aSize * big * 1.45 * uScale / d);
      vA = smoothstep(0.3, 2.5, d) * (1.0 - smoothstep(160.0, 380.0, d));
      vC = color * uExp; vSeed = aSeed;
    }`,
  fragmentShader: `
    varying vec3 vC; varying float vA; varying float vSeed;
    uniform float uTime; uniform float uSpark;
    void main(){
      vec2 p = (gl_PointCoord - 0.5) * 2.0;
      float r2 = dot(p, p);
      if (r2 > 1.0) discard;
      float core = exp(-r2 * 16.0);
      float halo = exp(-r2 * 3.2) * 0.22;
      float rare = step(0.985, vSeed);
      float tw = pow(max(0.0, sin(uTime * 2.1 + vSeed * 91.0)), 14.0);
      float cross = exp(-abs(p.x) * 26.0) * exp(-abs(p.y) * 2.6) + exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 2.6);
      float spark = rare * (0.35 + tw * 0.9 + uSpark * 0.8);
      float a = (core + halo + cross * spark * 0.55) * vA;
      vec3 col = vC * (1.0 + spark * 0.6) + vec3(0.08, 0.06, 0.12) * spark * tw;
      gl_FragColor = vec4(col, min(a, 1.0));
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const points = new THREE.Points(geo, pMat);
points.frustumCulled = false;
scene.add(points);

// distant stars that are always there
{
  const n = MOBILE ? 1500 : 3500, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 200 + Math.random() * 150, q = Math.sqrt(1 - u * u);
    p[i * 3] = q * Math.cos(a) * r; p[i * 3 + 1] = u * r; p[i * 3 + 2] = q * Math.sin(a) * r;
    const t = Math.random(), b = 0.25 + Math.pow(Math.random(), 4) * 0.9;
    c[i * 3] = b * (t < 0.3 ? 0.7 : 1); c[i * 3 + 1] = b * 0.9; c[i * 3 + 2] = b * (t > 0.7 ? 0.7 : 1);
    s[i] = 6 + Math.random() * 16;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
  const sd = new Float32Array(n); for (let i = 0; i < n; i++) sd[i] = Math.random(); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  var bgStars = new THREE.Points(g, pMat); bgStars.frustumCulled = false; scene.add(bgStars);
}

// painted skies far behind the light, one per section, crossfading
const SKY_FILES = ['violet-deep', 'amber-dust', 'nebula-gold', 'cosmos-blue', 'milkyway'];
const SKY_OF = [0, 1, 2, 3, 1, 4, 2, 0, 3, 3, 0, 2, 0, 4, 3, 2];
const SKY_LEVEL = [0.55, 0.5, 0.55, 0.55, 0.5, 0.75, 0.65, 0.5, 0.45, 0.5, 0.55, 0.6, 0.5, 0.65, 0.6, 0.75];
const skyLoader = new THREE.TextureLoader();
const skies = SKY_FILES.map((name, k) => {
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  skyLoader.load('img/bg-' + name + '.jpg?v=35', tex => { tex.colorSpace = THREE.SRGBColorSpace; mat.map = tex; mat.needsUpdate = true; });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(680, 383), mat);
  mesh.position.z = -175; mesh.renderOrder = -10; mesh.visible = false; mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, mat, op: 0, spin: (k % 2 ? 1 : -1) * 0.0016 };
});
// light trails: fine comets that appear when particles move fast
const TR = MOBILE ? 350 : 1200;
const trGeo = new THREE.BufferGeometry(), trPos = new Float32Array(TR * 6), trCol = new Float32Array(TR * 6);
trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3).setUsage(THREE.DynamicDrawUsage));
trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3).setUsage(THREE.DynamicDrawUsage));
const trails = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
trails.frustumCulled = false; trails.matrixAutoUpdate = false; scene.add(trails);
// warp streaks: speed made visible
const WS = MOBILE ? 220 : 500;
const wGeo = new THREE.BufferGeometry(), wPos = new Float32Array(WS * 6), wData = [];
for (let i = 0; i < WS; i++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.pow(Math.random(), 0.6) * 38; wData.push([Math.cos(a) * r, Math.sin(a) * r * 0.65, -120 + Math.random() * 134]); }
wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3).setUsage(THREE.DynamicDrawUsage));
const wMat = new THREE.LineBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const warp = new THREE.LineSegments(wGeo, wMat); warp.frustumCulled = false; scene.add(warp);

// rain
const RN = MOBILE ? 900 : 2200;
const rGeo = new THREE.BufferGeometry(), rPos = new Float32Array(RN * 6), rData = [];
for (let i = 0; i < RN; i++) rData.push([(Math.random() - 0.5) * 44, Math.random() * 26 - 11, -18 + Math.random() * 28, 0.8 + Math.random() * 0.6]);
rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3).setUsage(THREE.DynamicDrawUsage));
const rMat = new THREE.LineBasicMaterial({ color: 0x9fb6e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const rainLines = new THREE.LineSegments(rGeo, rMat); rainLines.frustumCulled = false; scene.add(rainLines);

// the aperture: nine blades that open the film and, at the end, try to close it
const aperture = new THREE.Group(); aperture.position.z = 8.2; scene.add(aperture);
const BLADES = 9, blades = [];
{
  const sh = new THREE.Shape();
  sh.moveTo(0.4, -2.2); sh.quadraticCurveTo(-6, -3.6, -12.6, -1.6); sh.lineTo(-13, 1.6); sh.quadraticCurveTo(-6, 3.4, 0.4, 2.6); sh.lineTo(0.4, -2.2);
  const bg = new THREE.ShapeGeometry(sh, 24);
  const edge = new THREE.BufferGeometry().setFromPoints(sh.getPoints(40));
  for (let k = 0; k < BLADES; k++) {
    const a = k / BLADES * Math.PI * 2, piv = new THREE.Group();
    piv.position.set(Math.cos(a) * 10.5, Math.sin(a) * 10.5, k * 0.012);
    const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.018, 0.016, 0.024), side: THREE.DoubleSide }));
    const e = new THREE.LineLoop(edge, new THREE.LineBasicMaterial({ color: 0xd8b26a, transparent: true, opacity: 0.5 }));
    e.position.z = 0.005; piv.add(m); piv.add(e); aperture.add(piv);
    blades.push({ piv, a, edge: e.material });
  }
}
function setAperture(open, glow, jitter = 0) {
  // open 0: closed iris. open 1: blades swung out of view.
  aperture.visible = open < 0.999;
  const phi = 0.32 + open * 1.25;
  blades.forEach((b, k) => {
    b.piv.rotation.z = b.a + phi + (jitter ? (Math.random() - 0.5) * jitter : 0);
    b.edge.opacity = 0.18 + glow * 0.8;
  });
}

// post: bloom, then a film look with aberration, grain and a rewind tint
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 1.05, 0.6, 0.1);
composer.addPass(bloom);
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAb: { value: 0.002 }, uRev: { value: 0 }, uFlash: { value: 0 }, uGrain: { value: 0.05 }, uDark: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAb, uRev, uFlash, uGrain, uDark; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float band = floor(uv.y * 48.0) + floor(uTime * 24.0);
      uv.x += (h(vec2(band, 3.0)) - 0.5) * 0.012 * uRev * step(0.6, h(vec2(band, 9.0)));
      vec2 d = uv - 0.5; float r = length(d);
      vec2 off = d * uAb * (0.6 + r * 1.6);
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      col *= 1.0 - sin(uv.y * 1100.0 + uTime * 40.0) * 0.05 * uRev;
      col = mix(col, col * vec3(0.8, 1.0, 1.25), uRev * 0.55);
      col += (h(uv * 1000.0 + fract(uTime * 7.3)) - 0.5) * uGrain;
      col *= 1.0 - smoothstep(0.25, 1.05, r * (1.0 + uDark));
      col = col + uFlash;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(film);

// adaptive quality: the site watches its own frame rate and trades resolution,
// glow and particle count for smoothness on weaker graphics chips
const QUALITY = [
  { pr: 1.5, bloom: 2, draw: 1 }, { pr: 1.25, bloom: 2, draw: 1 }, { pr: 1, bloom: 2.5, draw: 1 },
  { pr: 0.85, bloom: 3, draw: 0.85 }, { pr: 0.7, bloom: 3.5, draw: 0.7 }, { pr: 0.6, bloom: 4, draw: 0.55 },
];
let qLevel = MOBILE ? 3 : Math.min(DPR, 1.5) >= 1.5 ? 1 : 2, fpsAcc = 0, fpsN = 0, fpsT = 0;
function applyQuality() {
  const Q = QUALITY[qLevel];
  renderer.setPixelRatio(Math.min(Q.pr, DPR));
  composer.setPixelRatio(Math.min(Q.pr, DPR));
  geo.setDrawRange(0, Math.floor(N * Q.draw));
  bloom.enabled = Q.bloom > 0;
  pMat.uniforms.uMax.value = Q.bloom > 0 ? 56 : 30;
  resize();
}
function watchFps(dt) {
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT < 2.5) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; fpsT = 0;
  if (fps < 40 && qLevel < QUALITY.length - 1) { qLevel++; applyQuality(); }
  else if (fps > 52 && qLevel > 0 && Math.min(QUALITY[qLevel - 1].pr, DPR) > Math.min(QUALITY[qLevel].pr, DPR) - 0.01) { qLevel--; applyQuality(); }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  const bd = typeof qLevel === 'number' && QUALITY[qLevel].bloom ? QUALITY[qLevel].bloom : 2;
  bloom.setSize(innerWidth / bd, innerHeight / bd);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y * 0.075;
  $('#track').style.height = (total * UNIT + innerHeight) + 'px';
}
addEventListener('resize', () => { resize(); for (const el of els || []) if (el) el._spot = null; });
resize();

// ------------------------------------------------------------ text layer
const KEYWORDS = [['time', /^time$/i], ['camera', /^cameras?$/i], ['light', /^light$/i], ['change', /^chang(e|es|ing|ed)$/i], ['matter', /^matter$/i],
  ['future', /^futures?$/i], ['universe', /^universe$/i], ['aura', /^aura$/i], ['kinship', /^kinship$/i], ['truth', /^truth$/i],
  ['intelligence', /^intelligence$/i], ['now', /^now$/i], ['past', /^past$/i], ['observer', /^observer$/i]];
const seenKw = new Set();
function keywordClass(word) {
  const bare = word.replace(/[^A-Za-z’'-]/g, '');
  for (const [key, re] of KEYWORDS) if (re.test(bare)) {
    if (!seenKw.has(key)) { seenKw.add(key); return ' kw'; }
    return key === 'time' || key === 'light' ? ' kw2' : '';
  }
  return '';
}
const linesEl = $('#lines');
const els = slots.map((s, k) => {
  const d = document.createElement('div');
  if (s.kind === 'title') {
    const sec = SECTIONS[s.sec];
    d.className = 'ttl';
    const num = /^\d+$/.test(sec.num) ? sec.num : sec.num;
    d.innerHTML = `<div class="num ${/^\d+$/.test(sec.num) ? '' : 'word'}">${num}</div><div class="name">${sec.title}</div>`;
  } else if (s.kind === 'line') {
    const ln = s.line, prev = k > 0 && slots[k - 1].kind === 'line' && slots[k - 1].sec === s.sec ? slots[k - 1].line : null;
    const who = ln.s === 'N' ? 'neil' : ln.s === 'L' ? 'lumen' : 'head';
    const L = ln.t.length;
    d.className = 'ln ' + who + (s.hero ? ' hero ' + (L <= 14 ? 'h1' : L <= 42 ? 'h2' : 'h3') : s.short ? ' short' : '');
    let html = '';
    // who is speaking, on every line; bigger when the voice changes
    if (ln.s !== 'H') html += `<div class="who${!prev || prev.s !== ln.s ? ' chg' : ''}"><i></i>${ln.s === 'N' ? 'Neil' : 'Lumen'}</div>`;
    let wi = 0;
    const wordHtml = w => {
      const cls = keywordClass(w), i = wi++;
      const inner = ln.s === 'L'
        ? [...w].map(ch => { const dx = ((Math.random() - 0.5) * 50).toFixed(0), dy = ((Math.random() - 0.5) * 36).toFixed(0), dl = (Math.random() * 0.22).toFixed(2); return `<span class="ch" style="--dx:${dx}px;--dy:${dy}px;--dl:${dl}s">${ch}</span>`; }).join('')
        : w;
      return `<span class="w${cls}" style="--i:${i};--d:${Math.min(i * 0.035, 0.55).toFixed(3)}s">${inner}</span>`;
    };
    html += `<div class="tx">${ln.t.split(' ').map(wordHtml).join(' ')}</div>`;
    d.innerHTML = html;
  } else { d.className = 'none'; }
  d.style.display = 'none';
  linesEl.appendChild(d);
  return d;
});

// ------------------------------------------------------------ HUD
// the deck: a scrub bar marked with every section, a big play button, speed
const scrub = $('#scrub'), scrubTrack = $('#scrub .track'), scrubTip = $('#scrub .tip');
const playable = slots[slots.length - 1].start + 1; // the end of the conversation
secInfo.forEach((info) => {
  const t = document.createElement('div'); t.className = 'tk'; t.style.left = (info.start / playable * 100) + '%';
  $('#scrub .ticks').appendChild(t);
});
const secName = si => { const sec = SECTIONS[si]; return (/^\d+$/.test(sec.num) ? sec.num + '. ' : sec.num + ': ') + sec.title; };
const fracAt = e => { const r = scrubTrack.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
let scrubbing = false;
function scrubTo(f) {
  const target = f * playable * UNIT;
  flying = null; window.scrollTo(0, target); autoY = target;
  $('#hint').classList.add('gone');
}
scrub.addEventListener('pointerdown', e => { scrubbing = true; scrub.setPointerCapture(e.pointerId); scrubTo(fracAt(e)); });
scrub.addEventListener('pointermove', e => {
  const f = fracAt(e), k = slotAt(f * playable);
  scrubTip.textContent = secName(slots[k].sec);
  const r = scrubTrack.getBoundingClientRect();
  scrubTip.style.left = Math.max(90, Math.min(r.width - 90, f * r.width)) + 'px';
  if (scrubbing) scrubTo(f);
});
['pointerup', 'pointercancel'].forEach(ev => scrub.addEventListener(ev, () => { scrubbing = false; }));
// reading time at 1x, for the clock on the deck
const cumDur = []; { let acc = 0; for (const sl of slots) { cumDur.push(acc); acc += sl.kind === 'credits' ? 0 : sl.dur; } }
const totalDur = cumDur[cumDur.length - 1];
const mmss = x => { x = Math.max(0, Math.round(x)); return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };

const skyLabels = SKY_LABELS.map(L => { const d = document.createElement('div'); d.className = 'sky'; d.textContent = L.text; $('#labels').appendChild(d); return d; });
let choice = 'umbrella';
const choiceEls = [$('#c-umb'), $('#c-walk')];
choiceEls[0].onclick = e => { e.stopPropagation(); setChoice('umbrella'); };
choiceEls[1].onclick = e => { e.stopPropagation(); setChoice('walk'); };
function setChoice(c) {
  if (c === choice) return;
  choice = c;
  choiceEls[0].classList.toggle('sel', c === 'umbrella'); choiceEls[1].classList.toggle('sel', c === 'walk');
  score.play('swell', { gain: 0.6, verb: 0.6 });
}
choiceEls[0].classList.add('sel');

// ------------------------------------------------------------ flight state
let pos = 0, prevPos = 0, vel = 0, flow = 0, t0 = performance.now(), last = t0;
let started = false, intro = 0, burst = 0, apertureOpen = 0, introT = -1, flash = 0;
let mouseX = 0, mouseY = 0, flying = null, lastSlot = -1, expo = 1, auto = false, autoY = 0, lastMove = 0;
const score = new Score();
// the picture breathes with the music: every note sends a pulse of light
let pulse = 0, camKick = 0, warpKick = 0, shutNow = 0;
let bassPulse = 0, treblePulse = 0, sceneTime = 0;
const tmpV = new THREE.Vector3();

addEventListener('pointermove', e => { mouseX = e.clientX / innerWidth - 0.5; mouseY = e.clientY / innerHeight - 0.5; });
['wheel', 'touchstart'].forEach(ev => addEventListener(ev, e => { if (e.target.closest && e.target.closest('#deck')) return; if (flying) flying = null; if (auto) setAuto(false); $('#hint').classList.add('gone'); }, { passive: true }));
addEventListener('pointermove', () => { lastMove = performance.now(); });
addEventListener('keydown', e => {
  if (!started) return;
  if (e.code === 'Space') { e.preventDefault(); setAuto(!auto); return; }
  if (e.code === 'ArrowRight') { e.preventDefault(); step(1); return; }
  if (e.code === 'ArrowLeft') { e.preventDefault(); step(-1); return; }
  if (e.key === '+' || e.key === '=') { setSpeed(speedIdx + 1); return; }
  if (e.key === '-' || e.key === '_') { setSpeed(speedIdx - 1); return; }
  if (e.key === 'f' || e.key === 'F') return;
  if (flying) flying = null; if (auto) setAuto(false); $('#hint').classList.add('gone');
});
function setAuto(on) {
  auto = on; autoY = scrollY; flying = null;
  $('#hint').classList.add('gone');
  $('#play').classList.toggle('on', on);
  $('#play').setAttribute('aria-label', on ? 'Pause' : 'Play'); $('#play').dataset.l = on ? 'Pause' : 'Play';
  $('#play').innerHTML = on ? '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  lastMove = performance.now();
  if (on && !tipPlayed) { tipPlayed = true; speedTip(8000); }
}
// one line back or forward; Play keeps going from the new line
function step(dir) {
  if (!started) return;
  flying = null;
  const cur = slotAt(scrollY / UNIT + 0.001);
  let j = cur + dir;
  if (dir < 0 && (scrollY / UNIT - slots[cur].start) > slots[cur].len * 0.6) j = cur; // replay this line if well into it
  j = Math.max(0, Math.min(slots.length - 1, j));
  const target = (slots[j].start + slots[j].len * 0.2) * UNIT;
  window.scrollTo(0, target); autoY = target;
  $('#hint').classList.add('gone');
  toast(j === cur ? 'From the start of this line' : dir < 0 ? 'One line back' : 'One line forward');
}
// a short word above the deck, so a tap on a phone says what it did
let toastT = 0;
function toast(msg, always) {
  if (!MOBILE && !always) return;
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1400);
}
// playback speed for Play
// everyone starts at 0.5x so every line can be read; a speed someone picks is remembered
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
let speedIdx = 0;
try { const v = parseInt(localStorage.getItem('cbu-rate'), 10); if (v >= 0 && v < SPEEDS.length) speedIdx = v; } catch (e) {}
SPEEDS.forEach((v, i) => { const b = document.createElement('button'); b.textContent = v + '×'; b.onclick = () => setSpeed(i); $('#speeds').appendChild(b); });
function setSpeed(i, quiet) {
  speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, i));
  [...$('#speeds').children].forEach((b, k) => b.classList.toggle('on', k === speedIdx));
  if (quiet) return;
  toast('Reading speed ' + SPEEDS[speedIdx] + '×' + (SPEEDS[speedIdx] < 1 ? ', slower' : SPEEDS[speedIdx] > 1 ? ', faster' : ', normal'), true);
  speedTip(0);
  if (typeof vo !== 'undefined') vo.playbackRate = voRate();
  try { localStorage.setItem('cbu-rate', speedIdx); } catch (e) {}
}
// the reading speed, said plainly: a note over the glowing speed buttons when the flight starts and on the first Play
let tipT = 0, tipOn = false, tipPlayed = false;
function speedTip(ms) {
  clearTimeout(tipT);
  tipOn = ms > 0;
  $('#spdtip').classList.toggle('on', tipOn); document.documentElement.classList.toggle('tip', tipOn); $('#speeds').classList.toggle('hl', tipOn);
  if (!tipOn) return;
  $('#spdtip b').textContent = 'Reading speed: ' + SPEEDS[speedIdx] + '×';
  $('#spdtip span').textContent = MOBILE ? 'Too fast or too slow? Tap another speed in the Speed row below.' : 'Too fast or too slow? Click another speed here, or press + and -.';
  lastMove = performance.now();
  tipT = setTimeout(() => speedTip(0), ms);
}

// voice over: each line read aloud as it arrives. Neil in his own voice; Lumen in its own voice or in Neil's.
// The voice keeps its natural pace below 1x (the pause after each line just grows) and speeds up above 1x
// without changing pitch. On Play the flight waits for a line's voice to finish.
const VO_MODES = ['off', 'duo'], VO_NAMES = { off: 'Voice off', duo: 'Voice: Neil and Lumen' };
let voMode = 'duo';
try { const v = localStorage.getItem('cbu-vo'); if (VO_MODES.includes(v)) voMode = v; } catch (e) {}
const vo = new Audio(); vo.preload = 'auto'; vo.preservesPitch = true; vo.mozPreservesPitch = true; vo.webkitPreservesPitch = true;
let voSlot = -1, voT = 0, voSoonT = 0, voGain = null, voFirst = 0;  // voFirst: when the very first line may speak
// the voice sits inside the music, not on top of it: about 6 dB down, and each line fades in instead of arriving at full force
const VO_LEVEL = 0.5;
vo.volume = VO_LEVEL;
function voFadeIn(clip) {
  if (!voGain && score.ctx) {
    try { const src = score.ctx.createMediaElementSource(vo); voGain = score.ctx.createGain(); src.connect(voGain); voGain.connect(score.vIn); vo.volume = 1; } catch (e) {}
  }
  score.voiceBed(true);
  if (!voGain) return;
  const now = score.ctx.currentTime;
  voGain.gain.cancelScheduledValues(now); voGain.gain.setValueAtTime(0, now); voGain.gain.linearRampToValueAtTime(VO_LEVEL * Math.pow(10, (VO_GAIN[clip] || 0) / 20), now + 0.35);
}
const voRate = () => Math.max(1, SPEEDS[speedIdx]);
function voLine(k) {
  clearTimeout(voT); clearTimeout(voSoonT); vo.pause(); voSlot = -1;
  const sl = slots[k];
  if (voMode === 'off' || score.muted || !sl || sl.kind !== 'line' || (sl.line.s !== 'N' && sl.line.s !== 'L')) return;
  const dir = sl.line.s === 'N' ? 'N' : 'L';
  // a short wait, so racing through lines does not stutter out a syllable of each
  const lead = Math.max(0, voFirst - performance.now()), carried = lead > 0;
  // a sound that lands on this line strikes first, and the voice follows just after it, in the clear
  const wait = Math.max(lead, auto ? 60 : 280) + (EVENT_SLOTS.has(k) ? 450 : 0);
  // the mix makes room a quarter second before the first word
  voSoonT = setTimeout(() => score.voiceSoon(), Math.max(0, wait - 250));
  voT = setTimeout(() => {
    voSlot = k; vo.src = 'audio/vo/' + dir + '/' + sl.sec + '-' + sl.li + '.mp3?v=35';
    vo.playbackRate = voRate();
    voFadeIn(dir + '/' + sl.sec + '-' + sl.li);
    // the first line is carried by the music that led into it; later lines ask it to step back a little
    vo.play().then(() => { if (score.ready && !carried) score.duck(0.82, (vo.duration || 4) / voRate(), 0.5); }).catch(() => { voSlot = -1; });
  }, wait);
}
vo.onended = vo.onerror = () => { voSlot = -1; score.voiceSpeaking(false); };
vo.onplaying = () => score.voiceSpeaking(true); vo.onpause = () => score.voiceSpeaking(false);
function voHolds(cur) {
  if (voSlot < 0 || slots[voSlot] !== cur || vo.paused) return false;
  return (autoY / UNIT - cur.start) / cur.len > 0.82;
}
function setVo(m, quiet) {
  voMode = m;
  document.querySelectorAll('#vo-pick button').forEach(b => b.classList.toggle('on', b.dataset.vo === m));
  $('#vo').classList.toggle('off', m === 'off'); $('#vo').textContent = m === 'off' ? 'VOICE OFF' : 'VOICE';
  try { localStorage.setItem('cbu-vo', m); } catch (e) {}
  if (quiet) return;
  toast(VO_NAMES[m], true);
  if (m === 'off') { vo.pause(); voSlot = -1; score.voiceBed(false); } else if (started) voLine(slotAt(scrollY / UNIT + 0.001));
}
document.querySelectorAll('#vo-pick button').forEach(b => b.onclick = () => setVo(b.dataset.vo, true));
$('#vo').onclick = () => setVo(VO_MODES[(VO_MODES.indexOf(voMode) + 1) % VO_MODES.length]);
addEventListener('keydown', e => { if (started && (e.key === 'v' || e.key === 'V')) setVo(VO_MODES[(VO_MODES.indexOf(voMode) + 1) % VO_MODES.length]); });
setVo(voMode, true);

function flyTo(target) {
  const from = scrollY, to = Math.max(0, target * UNIT), dist = Math.abs(to - from) / UNIT;
  flying = { from, to, t: 0, dur: Math.min(16, Math.max(1.4, dist * 0.035)) };
}

function slotAt(p) {
  let lo = 0, hi = slots.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (slots[m].start <= p) lo = m; else hi = m - 1; }
  return lo;
}

// line based events: sounds and light that fire as you pass a line
const EVENTS = [
  [0, 'The camera.', () => score.play('click', { gain: 0.6, verb: 0.7 })],
  [2, 'It rises.', () => score.play('boom', { rate: 1.6, gain: 0.35, verb: 0.4 })],
  [5, 'Light requires time to travel.', () => score.play('swell', { rate: 0.6, gain: 0.5, verb: 0.9 })],
  [6, 'The Wide-field Infrared Survey Explorer', () => { score.play('swellR', { rate: 0.8, gain: 0.5, verb: 0.8 }); }],
  [8, 'Did I see it?', () => { for (let k = 0; k < 6; k++) score.play('blip', { rate: 0.3 + Math.random(), gain: 0.4, when: k * 0.05, pos: score.rndPos(2) }); }],
  [9, 'Later, it rains.', () => { score.play('thunder', { gain: 1, verb: 0.6 }); score.hit(1); flash = 0.45; }],
  [9, 'A small change enters a network of lives.', () => score.climax()],
  [9, 'We do not merely exist in time.', () => score.hit(1.2)],
  [13, 'The thought travels between us.', () => score.hit(0.7)],
  [15, 'Perhaps that is ultimately why the camera matters.', () => score.hit(0.6)],
  [9, 'With the information:', () => score.play('bell', { rate: Math.pow(2, 3 / 12) * 0.5, gain: 0.5, verb: 1 })],
  [10, 'You pressed the shutter.', () => { score.play('click', { gain: 1.3, verb: 0.6 }); score.hit(0.5); flash = 0.6; }],
  [12, 'Grambles.', () => score.play('swellR', { rate: 1.3, gain: 0.6, verb: 1 })],
  [15, 'So perhaps the camera was never freezing time.', () => { score.windup(2.2); }],
  [15, 'It was showing us that time cannot be frozen.', () => { score.play('crack', { gain: 0.8, verb: 0.8 }); score.play('boom', { gain: 0.8, verb: 0.9 }); score.climax(); setTimeout(() => score.phrase('finale'), 9000); flash = 0.9; }],
  [15, 'The beginning of the question.', () => { score.hit(1.4); [0, 4, 7, 12].forEach((n, k) => score.play('bell', { rate: Math.pow(2, (n + 3) / 12), gain: 0.3, when: 0.4 + k * 0.22, verb: 1 })); }],
].map(([si, txt, fn]) => {
  const li = SECTIONS[si].lines.findIndex(l => l.t.startsWith(txt));
  if (li < 0) console.warn('event line missing', txt);
  return { slot: li < 0 ? -1 : secInfo[si].lineSlot0 + li, fn };
}).filter(e => e.slot >= 0);
const EVENT_SLOTS = new Set(EVENTS.map(e => e.slot));

// camera flights: each section has its own move (p = progress through the section)
const camOut = new THREE.Vector3(), camAim = new THREE.Vector3(), aimNow = new THREE.Vector3(0, 1, 0);
const CAMS = [
  (p, f) => { camOut.set(Math.sin(f * 0.02) * 1.2, 0.8, mix(18, 12.5, p)); camAim.set(0, 1.2, 0); },                         // prologue: slow push in
  (p, f) => { camOut.set(Math.sin(f * 0.03) * 2.2, 1 + Math.sin(f * 0.021) * 1.2, 15); camAim.set(Math.sin(f * 0.03 + 0.4) * 3, 1, -30); }, // down the film tunnel
  (p, f) => { const a = mix(-0.55, 0.55, p) + Math.sin(f * 0.01) * 0.1; camOut.set(Math.sin(a) * 14.5, mix(1, 4.2, sst(0.45, 1, p)), Math.cos(a) * 14.5); camAim.set(0, mix(1.2, -0.5, sst(0.45, 1, p)), 0); }, // round the flower, up over the mountain
  (p, f) => { const a = mix(-0.9, 0.9, p); camOut.set(Math.sin(a) * 13.5, 1.2 + Math.sin(f * 0.02) * 0.8, Math.cos(a) * 13.5); camAim.set(0, 1.2, 0); }, // circling every changing thing
  (p, f) => { camOut.set(mix(-5, 5, p), 0.8 + Math.sin(f * 0.02), 14); camAim.set(mix(-2, 2, p), 0.6, 0); },                  // a sideways dolly through matter
  (p, f) => { camOut.set(Math.sin(f * 0.012) * 1.5, mix(0.2, -1.2, p), mix(15, 10, p)); camAim.set(0, mix(2, 4, p), -10); },    // looking up at the night sky
  (p, f) => { camOut.set(Math.sin(f * 0.025) * 2.5, 1 + Math.sin(f * 0.018), 14); camAim.set(Math.sin(f * 0.025 + 0.3) * 3, 1, -40); }, // flying into deep time
  (p, f) => { camOut.set(Math.sin(f * 0.015) * 1.5, 1.2, 15); camAim.set(0, 1.3, 0); },                                         // the portals
  (p, f) => { camOut.set(Math.sin(f * 0.02) * 1.2, 1, mix(16, 9.5, p)); camAim.set(0, 1.2, 0); },                               // pushing into the rain
  (p, f) => { camOut.set(Math.sin(f * 0.015) * 2, mix(0.6, 3.2, sst(0.45, 1, p)), mix(14, 16.5, sst(0.45, 1, p))); camAim.set(0, mix(0.8, -0.8, sst(0.45, 1, p)), 0); }, // craning up over the lives
  (p, f) => { const a = mix(-0.5, 0.5, p); camOut.set(Math.sin(a) * 14, 1 + Math.sin(f * 0.02) * 1.2, Math.cos(a) * 14); camAim.set(0, 1, -4); }, // among the cameras
  (p, f) => { camOut.set(mix(5, -5, p), 1.1, 13.5); camAim.set(mix(3, -3, p), 1, 0); },                                         // tracking beside the walker
  (p, f) => { camOut.set(Math.sin(f * 0.02) * 1.5, 1.3, mix(16, 10, p)); camAim.set(0, 1.3, 0); },                             // into the unnamed
  (p, f) => { camOut.set(Math.sin(f * 0.012) * 2.5, 1.4, 16); camAim.set(0, 1.3, 0); },                                         // wide on the two of them
  (p, f) => { camOut.set(Math.sin(f * 0.03) * 2, 1 + Math.sin(f * 0.022), 14); camAim.set(Math.sin(f * 0.03 + 0.5) * 2.5, 1, -40); }, // through the gates of scale
  (p, f) => { camOut.set(Math.sin(f * 0.01) * 2, mix(1, 3.5, p), mix(12, 21, p)); camAim.set(0, mix(1, 0.5, p), 0); },           // rising and pulling back
];
// the arc of the score: intimate at the start, opening up, majestic at the end
const INTENSITY = [0.22, 0.32, 0.38, 0.45, 0.42, 0.55, 0.6, 0.45, 0.5, 0.6, 0.62, 0.55, 0.5, 0.66, 0.72, 0.6];

// ------------------------------------------------------------ per frame
const cA = { t: 0, f: 0, q: null, sx: 1, intro: 0, burst: 0, choice: 'umbrella' };
const cB = { t: 0, f: 0, q: null, sx: 1, intro: 0, burst: 0, choice: 'umbrella' };
const qLive = SECTIONS.map(() => ({}));
const tc = (s) => { const fr = Math.floor(s * 24) % 24, sec = Math.floor(s) % 60, min = Math.floor(s / 60) % 60, hr = Math.floor(s / 3600); return [hr, min, sec, fr].map(x => String(x).padStart(2, '0')).join(':'); };

function frame(now) {
  requestAnimationFrame(frame);
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.05, realDt); last = now;
  if (started && document.visibilityState === 'visible' && realDt < 1) watchFps(realDt);
  const t = (now - t0) / 1000;

  // scroll, with a little inertia so the flight feels physical
  if (flying) {
    flying.t += dt / flying.dur;
    const k = flying.t >= 1 ? 1 : (flying.t < 0.5 ? 4 * flying.t ** 3 : 1 - Math.pow(-2 * flying.t + 2, 3) / 2);
    window.scrollTo(0, flying.from + (flying.to - flying.from) * k);
    if (flying.t >= 1) flying = null;
  }
  if (auto && started) {
    const cur = slots[slotAt(autoY / UNIT)];
    if (cur.kind === 'credits' && autoY / UNIT > cur.start + 4) setAuto(false);
    else if (!voHolds(cur)) { autoY += cur.len / cur.dur * (cur.kind === 'title' ? Math.max(1, SPEEDS[speedIdx]) : SPEEDS[speedIdx]) * dt * UNIT; window.scrollTo(0, autoY); }
  }
  const target = scrollY / UNIT;
  pos += (target - pos) * (1 - Math.exp(-dt * 6.5));
  const rawV = (pos - prevPos) / Math.max(dt, 1e-3); prevPos = pos;
  vel += (rawV - vel) * (1 - Math.exp(-dt * 7));
  const av = Math.abs(vel);

  // where are we in the conversation
  const k = slotAt(pos), slot = slots[k];
  const si = slot.sec, info = secInfo[si], sc = SCENES[si];
  let lp;
  if (slot.kind === 'title') lp = -1 + (pos - slot.start) / slot.len;
  else if (slot.kind === 'line') lp = slot.li + (pos - slot.start) / slot.len;
  else lp = info.n + 1;
  const q = qLive[si];
  for (const key in info.cueIdx) q[key] = lp - info.cueIdx[key];

  // the epilogue shutter: closes on "never freezing time", breaks on "cannot be frozen"
  let shut = 0; shutNow = 0;
  if (si === 15 && started) shut = sst(0, 1.4, q.never) * (1 - sst(0, 0.18, q.cannot));
  shutNow = shut;
  const freeze = shut > 0.55 ? 1 : 0;
  flow += (vel * 1.0 + 0.28) * dt * (1 - shut * 0.97);

  // intro: wind up, then the aperture snaps open
  if (introT >= 0) {
    introT += Math.min(0.5, realDt);
    intro = Math.min(1, introT / 2.6);
    if (introT >= 2.6 && apertureOpen === 0 && (score.ready || introT > 4.5)) { score.boom(); flash = 1; apertureOpen = 0.0001; burst = 1; }
    if (apertureOpen > 0 && apertureOpen < 1) apertureOpen = Math.min(1, apertureOpen + Math.min(0.5, realDt) * 2.6);
    if (introT > 3.4 && !started) { started = true; document.documentElement.classList.remove('locked'); $('#hint').classList.remove('gone'); $('#hud').classList.add('on'); $('#deck').classList.add('on'); lastMove = performance.now(); setTimeout(() => speedTip(10000), 1400); if (voMode !== 'off') { score.voiceBed(true); score.phrase('section'); voFirst = performance.now() + 3500; } voLine(slotAt(scrollY / UNIT + 0.001)); if (presenting) setTimeout(() => setAuto(true), 1500); }
  }
  burst *= Math.exp(-dt * 1.2);
  const openNow = started ? Math.min(1 - shut, 1) : (apertureOpen > 0 ? 1 - Math.pow(1 - apertureOpen, 3) : 0);
  setAperture(si === 15 ? 1 - shut : openNow, si === 15 ? shut : intro * (1 - openNow) + 0.1, (si === 15 && shut > 0.8) ? 0.03 : (!started && intro > 0.6 && openNow === 0 ? 0.01 : 0));

  // contexts for the two states being blended
  const sx = Math.max(0.42, Math.min(1.15, camera.aspect / 1.78));
  sceneTime += dt * (1 - shut * 0.97);
  for (const c of [cA, cB]) { c.t = sceneTime; c.f = flow; c.sx = sx; c.intro = intro; c.burst = burst; c.choice = choice; c.bass = bassPulse; c.treble = treblePulse; }
  let fa, fb, m, cross = false;
  if (lp < -0.15 && si > 0) {
    cross = true;
    const ps = SCENES[si - 1], pinf = secInfo[si - 1];
    fa = ps.states[ps.seq[ps.seq.length - 1][1]]; cA.q = pinf.endQ;
    fb = sc.states[sc.seq[0][1]]; cB.q = q;
    m = sst(-1, -0.15, lp);
  } else {
    let e = 0;
    for (let j = 1; j < sc.seq.length; j++) if (q[sc.seq[j][0]] >= 0) e = j;
    fb = sc.states[sc.seq[e][1]]; cB.q = q;
    if (e === 0) { fa = fb; m = 1; }
    else { fa = sc.states[sc.seq[e - 1][1]]; cA.q = q; m = sst(0, 0.9, q[sc.seq[e][0]]); }
  }

  // move every particle
  for (let k2 = 0; k2 < TR; k2++) { const sl = Math.floor(k2 * N / TR) * 3; PREV[k2 * 3] = POS[sl]; PREV[k2 * 3 + 1] = POS[sl + 1]; PREV[k2 * 3 + 2] = POS[sl + 2]; }
  const drawN = geo.drawRange.count === Infinity ? N : Math.min(N, geo.drawRange.count);
  for (let i = 0; i < N; i++) {
    if (PERM[i] >= drawN) continue; // not drawn at this quality level: skip the work too
    let w = m >= 1 ? 1 : m <= 0 ? 0 : Math.min(1, Math.max(0, m * 1.6 - ((i * 0.6180339) % 1) * 0.6));
    w = w * w * (3 - 2 * w);
    let x, y, z, r, g, b, s;
    if (w < 1) {
      fa(i, cA); x = O[0]; y = O[1]; z = O[2]; r = O[3]; g = O[4]; b = O[5]; s = O[6];
      if (w > 0) {
        fb(i, cB);
        if (cross) {
          // between sections every particle pours through one glowing aperture
          const h = (i * 0.6180339) % 1, a = h * 6.2831853, u = 1 - w, rr = 2.6 + ((i * 0.7548776) % 1) * 1.6;
          const tx = Math.cos(a) * rr * 1.3, ty = 1.2 + Math.sin(a) * rr, tz = -7 - ((i * 0.5698403) % 1) * 6;
          x = u * u * x + 2 * u * w * tx + w * w * O[0];
          y = u * u * y + 2 * u * w * ty + w * w * O[1];
          z = u * u * z + 2 * u * w * tz + w * w * O[2];
          const flare = Math.pow(Math.sin(Math.PI * w), 6);
          r += (O[3] - r) * w + flare * 0.1; g += (O[4] - g) * w + flare * 0.09; b += (O[5] - b) * w + flare * 0.14; s += (O[6] - s) * w + flare * 0.15;
        } else {
          // particles arc through space as they travel between shapes
          const lift = Math.sin(w * Math.PI) * 1.4 * (((i * 0.7548776) % 1) - 0.5);
          x += (O[0] - x) * w + lift; y += (O[1] - y) * w + lift * 0.6; z += (O[2] - z) * w;
          r += (O[3] - r) * w; g += (O[4] - g) * w; b += (O[5] - b) * w; s += (O[6] - s) * w;
        }
      }
    } else { fb(i, cB); x = O[0]; y = O[1]; z = O[2]; r = O[3]; g = O[4]; b = O[5]; s = O[6]; }
    const pi = PERM[i], j = pi * 3;
    POS[j] = x; POS[j + 1] = y; POS[j + 2] = z; COL[j] = r; COL[j + 1] = g; COL[j + 2] = b; SIZ[pi] = s;
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
  // trails: a head at the particle, a tail where it was, only when it really moved
  {
    const stretch = Math.min(3.5, 0.05 / Math.max(dt, 0.008));
    let any = 0;
    for (let k2 = 0; k2 < TR; k2++) {
      const sl = Math.floor(k2 * N / TR), j = sl * 3, o = k2 * 6;
      const dx = POS[j] - PREV[k2 * 3], dy = POS[j + 1] - PREV[k2 * 3 + 1], dz = POS[j + 2] - PREV[k2 * 3 + 2];
      const d = Math.hypot(dx, dy, dz), ok = sl < drawN && SIZ[sl] > 0.001 && d > 0.02 && d < 2.5;
      trPos[o] = POS[j]; trPos[o + 1] = POS[j + 1]; trPos[o + 2] = POS[j + 2];
      trPos[o + 3] = POS[j] - (ok ? dx * stretch : 0); trPos[o + 4] = POS[j + 1] - (ok ? dy * stretch : 0); trPos[o + 5] = POS[j + 2] - (ok ? dz * stretch : 0);
      const k = ok ? Math.min(1, d * 6) * 0.6 * pMat.uniforms.uExp.value : 0; if (ok) any++;
      trCol[o] = COL[j] * k; trCol[o + 1] = COL[j + 1] * k; trCol[o + 2] = COL[j + 2] * k; trCol[o + 3] = 0; trCol[o + 4] = 0; trCol[o + 5] = 0;
    }
    trails.visible = any > 8;
    if (trails.visible) { trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true; }
  }
  // auto exposure: the more tightly packed the shape on screen, the dimmer each particle
  {
    // measured as the shape's screen area (width x height), so a thin bright band dims too
    let n = 0, mx = 0, my = 0, mxx = 0, myy = 0;
    for (let i = 0; i < N; i += 61) {
      if (SIZ[i] <= 0.001) continue;
      tmpV.set(POS[i * 3], POS[i * 3 + 1], POS[i * 3 + 2]).project(camera);
      if (tmpV.z > 1) continue;
      const px = tmpV.x * 8 * camera.aspect, py = tmpV.y * 8;
      mx += px; my += py; mxx += px * px; myy += py * py; n++;
    }
    if (n > 10) {
      mx /= n; my /= n;
      const vx = Math.max(0.01, mxx / n - mx * mx), vy = Math.max(0.01, myy / n - my * my);
      const area = Math.sqrt(vx * vy);
      expo += (Math.min(1, Math.max(0.14, area / 14)) - expo) * Math.min(1, dt * 2.5);
    }
  }
  const crossDim = cross ? 1 - 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, m))) : 1;
  pMat.uniforms.uExp.value = (started ? 1 + pulse * 0.32 : 0.35 + intro * 0.5 + burst * 0.5) * expo * crossDim * (bloom.enabled ? 1 : 1.6);

  // warp streaks
  const wOp = started ? Math.min(0.9, 0.16 + Math.max(0, av - 2.5) / 10 + warpKick * 0.8) : 0;
  wMat.opacity = wOp;
  if (wOp > 0) {
    const cruise = shutNow > 0.5 ? 0 : 0.9;
    const len = 0.5 + av * 0.5 + warpKick * 7, dz = (vel + cruise + warpKick * 16) * dt * 7;
    for (let i = 0; i < WS; i++) {
      const d = wData[i]; d[2] += dz;
      if (d[2] > 14) d[2] -= 134; if (d[2] < -120) d[2] += 134;
      const o = i * 6, l = vel + cruise >= 0 ? len : -len;
      wPos[o] = d[0]; wPos[o + 1] = d[1]; wPos[o + 2] = d[2]; wPos[o + 3] = d[0]; wPos[o + 4] = d[1]; wPos[o + 5] = d[2] - l;
    }
    wGeo.attributes.position.needsUpdate = true;
  }

  // rain: falls in real time, but rewinding pulls it back up
  let rainAmt = 0;
  if (si === 9) rainAmt = (sst(0, 1, q.likely) * 0.3 + sst(0, 1, q.rains) * 0.7) * (1 - 0.6 * sst(0, 2, q.ret));
  if (si === 14 && q.umbrella >= 0 && q.journey < 0) rainAmt = 0.5;
  if (si === 9 && lp < -0.15) rainAmt = 0;
  rMat.opacity += (rainAmt * (choice === 'walk' ? 0.75 : 0.55) - rMat.opacity) * Math.min(1, dt * 3);
  if (rMat.opacity > 0.01) {
    const fall = (18 + vel * 4) * dt;
    for (let i = 0; i < RN; i++) {
      const d = rData[i]; d[1] -= fall * d[3];
      if (d[1] < -11) d[1] += 26; if (d[1] > 15) d[1] -= 26;
      const o = i * 6; rPos[o] = d[0]; rPos[o + 1] = d[1]; rPos[o + 2] = d[2]; rPos[o + 3] = d[0] + 0.02; rPos[o + 4] = d[1] + 0.55; rPos[o + 5] = d[2];
    }
    rGeo.attributes.position.needsUpdate = true;
  }
  if (rainAmt > 0.3 && choice === 'umbrella' && si === 9 && q.ret < 0 && q.with >= 0 && Math.random() < dt * 22) score.play('ratchet', { rate: 1.4 + Math.random() * 1.2, gain: 0.08, pos: [(Math.random() - 0.5) * 1.4, 1.4, (Math.random() - 0.5) * 1.4], verb: 0.1 });

  // camera: parallax, speed, and a shake when you really fly
  const shake = Math.max(0, av - 12) * 0.004;
  camKick *= Math.exp(-dt * 1.4); warpKick *= Math.exp(-dt * 1.8);
  bassPulse *= Math.exp(-dt * 4.5); treblePulse *= Math.exp(-dt * 8);
  if (score.ready && score.visualEvents) {
    const an = score.ctx.currentTime;
    score.visualEvents = score.visualEvents.filter(ev => {
      if (ev.at > an) return true;
      if (an - ev.at < 0.2) { if (ev.bass) bassPulse = Math.min(1.2, Math.max(bassPulse, ev.gain * 2.4)); else treblePulse = Math.min(1, Math.max(treblePulse, ev.gain * 3)); }
      return false;
    });
  }
  pulse = Math.min(1, bassPulse * 0.8 + treblePulse * 0.5);
  pMat.uniforms.uSpark.value = treblePulse; pMat.uniforms.uTime.value = t;
  {
    const secP = Math.min(1, Math.max(0, (pos - info.start) / (info.end - info.start)));
    (CAMS[si] || CAMS[0])(secP, flow);
    if (MOBILE && camera.aspect < 1) camOut.z += 3;
    // toward the subject on hero lines, back on a light-speed rush
    const toAim = camAim.clone().sub(camOut).normalize();
    camOut.addScaledVector(toAim, camKick * 2.6 - warpKick * 1.5);
    camOut.x += mouseX * 1.2 + (Math.random() - 0.5) * shake; camOut.y += -mouseY * 0.7 + (Math.random() - 0.5) * shake;
    const follow = 1 - Math.exp(-dt * 2.2);
    camera.position.lerp(camOut, follow); aimNow.lerp(camAim, follow);
  }
  camera.fov += ((58 + Math.min(av, 30) * 0.75 + warpKick * 16 - camKick * 5) - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(aimNow);
  // the painted skies: drift, parallax against the camera, bloom on the bass, zoom at light speed
  {
    const want = SKY_OF[si], lvl = (started ? SKY_LEVEL[si] : 0.25 * intro) * (1 - shut * 0.6);
    for (let k = 0; k < skies.length; k++) {
      const sk = skies[k], target = k === want ? lvl : 0;
      sk.op += (target - sk.op) * Math.min(1, dt * 1.2);
      sk.mesh.visible = sk.op > 0.005 && !!sk.mat.map;
      if (!sk.mesh.visible) continue;
      sk.mat.opacity = Math.min(1, sk.op * (1 + bassPulse * 0.25));
      sk.mesh.position.x = camera.position.x * 0.55 + aimNow.x * 0.6; sk.mesh.position.y = camera.position.y * 0.55 + aimNow.y * 0.3;
      sk.mesh.position.z = camera.position.z - 190;
      const zoom = 1 + Math.min(av, 30) * 0.006 + warpKick * 0.12;
      sk.mesh.scale.set(zoom, zoom, 1);
      sk.mesh.lookAt(camera.position); sk.mesh.rotateZ(t * sk.spin + flow * 0.0012);
    }
  }
  trails.matrix.copy(points.matrix);
  bgStars.rotation.y = flow * 0.0015 + t * 0.004; bgStars.rotation.x = flow * 0.0007;
  const sway = shut > 0.5 ? 0 : 1;
  points.rotation.y = (Math.sin(flow * 0.021) * 0.22 + Math.sin(t * 0.37) * 0.05) * sway;
  points.rotation.z = Math.sin(flow * 0.017 + 2) * 0.06 * sway;
  points.rotation.x = Math.sin(t * 0.29 + 1) * 0.04 * sway;
  const breathe = 1 + bassPulse * 0.022 + Math.sin(t * 1.3) * 0.006;
  points.scale.set(breathe, breathe, breathe);
  points.updateMatrix(); trails.matrix.copy(points.matrix);

  // post
  flash *= Math.exp(-dt * 2.2);
  const rev = vel < -0.6 ? Math.min(1, (-vel - 0.6) / 3) : 0;
  film.uniforms.uTime.value = t;
  film.uniforms.uAb.value = 0.0025 + Math.min(av, 40) * 0.0007;
  film.uniforms.uRev.value += (rev - film.uniforms.uRev.value) * Math.min(1, dt * 6);
  film.uniforms.uFlash.value = flash;
  film.uniforms.uDark.value = shut * 0.6;
  bloom.strength = (0.85 + burst * 0.6 + Math.min(av, 30) * 0.015 + pulse * 0.35 + camKick * 0.3) * Math.min(1, 2.2 / QUALITY[qLevel].bloom);

  composer.render();

  // labels in the night sky
  const sep = si === 5 ? sst(0, 1.2, q.travel) * (1 - sst(0, 1, q.gathers)) : 0;
  skyLabels.forEach((el, n) => {
    if (sep < 0.35) { el.style.opacity = 0; return; }
    skyAnchor(cB, SKY_LABELS[n].k, sep, tmpV); tmpV.project(camera);
    const lx = (tmpV.x * 0.5 + 0.5) * innerWidth, ly = (-tmpV.y * 0.5 + 0.5) * innerHeight;
    // labels never sit on the words, the presences or the deck
    let clear = ly > 70 && ly < innerHeight - deckH() - 20 && lx > 140 && lx < innerWidth - 300;
    for (const j of shown) { const sp = els[j]._spot; if (!sp) continue; const h = els[j].offsetHeight; if (ly > sp.y - h / 2 - 24 && ly < sp.y + h / 2 + 24 && lx > sp.left - 280 && lx < sp.left + sp.colW + 20) clear = false; }
    const vis = clear && tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
    el.style.opacity = vis ? Math.min(0.85, (sep - 0.35) * 3) : 0;
    el.style.transform = `translate(${lx}px, ${ly}px)`;
  });
  // umbrella choice
  const showChoice = si === 9 && q.with >= 0.6 && q.ret < 0;
  $('#choice').classList.toggle('on', showChoice);
  if (showChoice) {
    const sp = sst(0, 1.5, q.with);
    [[1, 0], [-1, 1]].forEach(([dirY, n]) => {
      tmpV.set(9.5 * sx, -1.5 + dirY * 2.55 * sp, 0).project(camera);
      choiceEls[n].style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * innerWidth}px, ${(-tmpV.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
    });
  }
  // wavelength gauge
  const ir = si === 6 ? Math.min(1, sst(0, 2, q.wise)) * (1 - 0.45 * sst(0, 1, q.both)) : 0;
  $('#wave').classList.toggle('on', si === 6 && lp > 0);
  $('#wave .knob').style.left = (8 + ir * 84) + '%';
  $('#wave .val').textContent = ir < 0.5 ? 'VISIBLE · 0.55 µm' : 'INFRARED · 3.4 to 22 µm';

  // where is the light on screen? (for placing the words in the dark)
  if ((frameNo++ & 1) === 0) updateDensity();
  // text
  renderText(k, si);

  if (lastSlot >= 0 && slot.kind === 'title' && slots[lastSlot] && slots[lastSlot].sec < si) warpKick = 1;
  // events
  if (lastSlot >= 0 && k !== lastSlot && started) {
    if (k - lastSlot <= 3) for (const ev of EVENTS) if (lastSlot < ev.slot && k >= ev.slot) ev.fn();
    voLine(k);
  }
  lastSlot = k;

  // credits
  const cr = slots[slots.length - 1], crA = sst(cr.start + 0.5, cr.start + 3, pos);
  $('#credits').style.opacity = crA; $('#credits').style.pointerEvents = crA > 0.6 ? 'auto' : 'none';

  // HUD
  const secLabel = /^\d+$/.test(SECTIONS[si].num) ? String(SECTIONS[si].num).padStart(2, '0') : SECTIONS[si].num;
  $('#sec').textContent = secLabel + ' · ' + SECTIONS[si].title;
  $('#tc').textContent = tc(pos * 2);
  $('#spd').textContent = vel < -0.6 ? '◀◀ REWIND ×' + (-vel / 2).toFixed(1) : av > 3 ? '▶▶ ×' + (vel / 2).toFixed(1) : '';
  $('#spd').classList.toggle('rev', vel < -0.6);
  const f = Math.min(1, pos / playable);
  $('#scrub .fill').style.width = (f * 100) + '%';
  $('#scrub .head').style.left = (f * 100) + '%';
  const ts = slot.kind === 'credits' ? totalDur : cumDur[k] + Math.min(1, (pos - slot.start) / slot.len) * slot.dur;
  $('#time').innerHTML = mmss(ts / SPEEDS[speedIdx]) + ' <span>/ ' + mmss(totalDur / SPEEDS[speedIdx]) + '</span>';
  $('#deck-sec').textContent = secName(si);
  const voice = slot.kind === 'line' ? slot.line.s : '';
  if (document.body.dataset.who !== voice) document.body.dataset.who = voice;
  $('#deck').classList.toggle('idle', auto && performance.now() - lastMove > 2600 && !scrubbing && !tipOn);

  // sound
  const sw = lp < -0.15 ? 0 : 1;
  score.update(dt, {
    mood: si, vel, flow, freeze,
    intensity: si === 15 ? (slot.kind === 'credits' ? 0.75 : 0.55 + 0.3 * sst(0, info.n, lp) + 0.25 * sst(0, 2, q.cannot)) : INTENSITY[si],
    rain: si === 9 || si === 14 ? rainAmt * (choice === 'walk' ? 1.15 : 1) : 0,
    rumble: si === 2 ? sst(0, 1, q.rises) * (1 - sst(0, 3, q.transformed)) * 0.8 + sst(0, 0.5, q.fractures) * (1 - sst(0, 2, q.erodes)) * 0.4 : (si === 15 ? shut * 0.6 : 0),
    fire: si === 4 ? sst(0, 1, q.extract) * (1 - sst(0, 1.5, q.wonder)) : 0,
    projector: si === 1 ? sw : 0,
    bells: si === 8 ? 0.35 : si === 7 ? 0.6 : 1,
    blips: si === 8 && q.rel < 0 ? sw * 0.8 : 0,
    glitch: si === 7 && q.gen >= 0 && q.all < 0 ? 1 : 0,
    shutters: si === 10 && q.every >= 0 && q.truth < 0 ? (q.billions >= 0 ? 3 : 1) : 0,
    walk: si === 9 && q.ret < 0 && lp > 0 ? 1 : 0,
    birds: [0.5, 0, 1, 0.6, 0, 0, 0, 0, 0, 0, 0.2, 0.5, 0.3, 0.4, 0.7, 0.4][si] * (rainAmt > 0.3 ? 0 : 1),
    crickets: si === 5 ? 1 : si === 12 ? 0.5 : 0,
    air: si === 6 ? 0.5 : si === 8 ? 0.4 : 1,
    credits: slot.kind === 'credits',
  });
}

// ------------------------------------------------------------ the conversation
// Neil speaks from the left, Lumen from the right, the picture between them.
// Each line is placed where the picture is darkest, chosen when it arrives.
const GW = 18, GH = 12, grid = new Float32Array(GW * GH), gtmp = new Float32Array(GW * GH);
let frameNo = 0, hot = 0;
function updateDensity() {
  gtmp.fill(0);
  points.updateMatrixWorld(true);
  const e = pMat.uniforms.uExp.value, drawn = geo.drawRange.count === Infinity ? N : Math.min(N, geo.drawRange.count);
  for (let i = 0; i < drawn; i += 23) {
    const sz = SIZ[i]; if (sz <= 0.001) continue;
    tmpV.set(POS[i * 3], POS[i * 3 + 1], POS[i * 3 + 2]).applyMatrix4(points.matrixWorld).project(camera);
    if (tmpV.z > 1 || tmpV.x < -1 || tmpV.x > 1 || tmpV.y < -1 || tmpV.y > 1) continue;
    const gx = Math.min(GW - 1, ((tmpV.x * 0.5 + 0.5) * GW) | 0), gy = Math.min(GH - 1, ((-tmpV.y * 0.5 + 0.5) * GH) | 0);
    const v = (COL[i * 3] + COL[i * 3 + 1] + COL[i * 3 + 2]) * sz * e;
    gtmp[gy * GW + gx] += v;
    // glow spills into the neighbours
    if (gx > 0) gtmp[gy * GW + gx - 1] += v * 0.35; if (gx < GW - 1) gtmp[gy * GW + gx + 1] += v * 0.35;
    if (gy > 0) gtmp[(gy - 1) * GW + gx] += v * 0.35; if (gy < GH - 1) gtmp[(gy + 1) * GW + gx] += v * 0.35;
  }
  let mxc = 0;
  for (let i = 0; i < grid.length; i++) { grid[i] += (gtmp[i] - grid[i]) * 0.35; if (grid[i] > mxc) mxc = grid[i]; }
  hot = mxc;
}
function boxDensity(x0, y0, w, h) {
  const cx0 = Math.max(0, Math.floor(x0 / innerWidth * GW)), cx1 = Math.min(GW - 1, Math.floor((x0 + w) / innerWidth * GW));
  const cy0 = Math.max(0, Math.floor(y0 / innerHeight * GH)), cy1 = Math.min(GH - 1, Math.floor((y0 + h) / innerHeight * GH));
  let sum = 0;
  for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) sum += grid[y * GW + x];
  return sum / ((cx1 - cx0 + 1) * (cy1 - cy0 + 1));
}
const lastY = { N: 0, L: 0 };
function deckH() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deckH')) || 150; }
function placeLine(j) {
  const s = slots[j], el = els[j], W = innerWidth, H = innerHeight, narrow = W < 700;
  const speaker = s.kind === 'line' ? s.line.s : 'T';
  const center = s.kind === 'title' || speaker === 'H';
  // phones: the presences wait in a band at the top, so the words get the full width below them
  const margin = narrow ? 16 : Math.max(150, W * 0.1);
  const colW = center ? Math.min(W * 0.88, 1000) : narrow ? W - 32 : Math.min(W * (s.hero ? 0.46 : 0.4), s.hero ? 760 : 640);
  const left = center ? (W - colW) / 2 : speaker === 'N' ? margin : W - margin - colW;
  const align = center ? 'center' : speaker === 'N' ? 'left' : 'right';
  el.style.left = left + 'px'; el.style.width = colW + 'px'; el.style.textAlign = align;
  el.style.transformOrigin = align === 'left' ? '0% 50%' : align === 'right' ? '100% 50%' : '50% 50%';
  el.style.display = 'block'; el.style.opacity = '0';
  const tx = el.querySelector('.tx'); if (tx) tx.style.fontSize = '';
  let h = el.offsetHeight;
  const top = narrow ? 156 : 78, bottom = H - deckH() - 18;
  const room = bottom - top;
  if (tx && h > room) {
    let fs = parseFloat(getComputedStyle(tx).fontSize);
    for (let k = 0; k < 8 && h > room && fs > 15; k++) { fs *= 0.88; tx.style.setProperty('font-size', fs + 'px', 'important'); h = el.offsetHeight; }
  }
  let best = (top + bottom) / 2;
  if (s.kind !== 'title') {
    let bestScore = Infinity;
    const pref = lastY[speaker] || (top + bottom) * 0.5;
    for (let k = 0; k <= 8; k++) {
      const y = top + h / 2 + (bottom - top - h) * (k / 8);
      if (bottom - top < h) { best = (top + bottom) / 2; break; }
      const score_ = boxDensity(left, y - h / 2, colW, h) + Math.abs(y - pref) / H * 0.6 + Math.abs(y - (top + bottom) * 0.52) / H * 0.25;
      if (score_ < bestScore) { bestScore = score_; best = y; }
    }
    if (speaker === 'N' || speaker === 'L') lastY[speaker] = best;
  }
  el.style.top = best + 'px';
  el._spot = { y: best, left, colW, align, speaker };
}

const shown = new Set();
let lastSpeaker = '', echoJ = -1;
function renderText(k, si) {
  const lo = Math.max(0, k - 1), hi = Math.min(slots.length, k + 2);
  const keep = new Set();
  for (let j = lo; j < hi; j++) keep.add(j);
  if (echoJ >= 0) keep.add(echoJ);
  for (const j of shown) if (!keep.has(j)) { els[j].style.display = 'none'; shown.delete(j); if (els[j]._on) { els[j]._on = false; els[j].classList.remove('on'); } els[j]._spot = null; }
  let speakingNow = '';
  for (let j = lo; j < hi; j++) {
    const s = slots[j], el = els[j];
    if (s.kind === 'credits') continue;
    const e = (pos - s.start) / s.len;
    const inside = e >= 0 && e <= 1 && started;
    if (!inside) {
      if (j !== echoJ) {
        if (el.style.display !== 'none') { el.style.display = 'none'; shown.delete(j); }
        if (el._on) { el._on = false; el.classList.remove('on'); }
        el._spot = null;
      }
      continue;
    }
    if (!el._spot) placeLine(j);
    shown.add(j);
    const fin = sst(0, 0.14, e), fout = sst(0.86, 1, e);
    const sp = el._spot, dir = sp.align === 'left' ? -1 : sp.align === 'right' ? 1 : 0;
    const op = fin * (1 - fout), sc = 0.94 + 0.06 * fin + 0.12 * fout, bl = (1 - fin) * 5 + fout * 7;
    const x = dir * (1 - fin) * 40 - dir * fout * 30, y = (1 - fin) * 14 - fout * 16;
    el.style.opacity = op.toFixed(3);
    el.style.transform = `translate(${dir === 0 ? 0 : 0}px, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(4)})`;
    el.style.filter = bl > 0.15 ? `blur(${bl.toFixed(1)}px)` : 'none';
    if (!el._on) {
      el._on = true; el.classList.add('on');
      if (s.hero && Math.abs(vel) < 6) { score.accent(); camKick = 1; }
      // the voice passes across the screen
      if (s.kind === 'line' && (s.line.s === 'N' || s.line.s === 'L')) {
        if (lastSpeaker && lastSpeaker !== s.line.s && Math.abs(vel) < 8) beam(lastSpeaker, s.line.s);
        // the other voice's last line lingers as an echo
        const prevJ = j - 1;
        echoJ = prevJ >= 0 && slots[prevJ].kind === 'line' && slots[prevJ].line.s !== s.line.s && els[prevJ]._spot && !slots[prevJ].hero && !s.hero && innerWidth >= 700 ? prevJ : -1;
        lastSpeaker = s.line.s;
      }
    }
    if (s.kind === 'line' && fin > 0.3 && fout < 0.7) speakingNow = s.line.s;
  }
  // the echo of the other voice, quiet
  if (echoJ >= 0) {
    const el = els[echoJ], cur = slots[k];
    const alive = cur.kind === 'line' && echoJ < k && k - echoJ <= 2;
    if (!alive || !el._spot) { if (el.style.display !== 'none') el.style.display = 'none'; shown.delete(echoJ); el._spot = null; echoJ = -1; }
    else {
      el.style.display = 'block'; shown.add(echoJ);
      el.style.opacity = '0.22'; el.style.filter = 'none';
      el.style.transform = 'translate(0px, -50%) scale(0.86)';
    }
  }
  // the two presences
  orbN.classList.toggle('speaking', speakingNow === 'N'); orbL.classList.toggle('speaking', speakingNow === 'L');
  const showOrbs = started && slots[k].kind === 'line';
  orbN.classList.toggle('on', showOrbs); orbL.classList.toggle('on', showOrbs);
  if (lastY.N) orbN.style.top = lastY.N + 'px';
  if (lastY.L) orbL.style.top = lastY.L + 'px';
  const p = 1 + pulse * 0.28;
  const nowP = performance.now(), pdt = Math.min(0.1, (nowP - presT) / 1000); presT = nowP;
  if (showOrbs || orbN.classList.contains('on')) { presN.draw(nowP / 1000, pdt, speakingNow === 'N', pulse); presL.draw(nowP / 1000, pdt, speakingNow === 'L', pulse); }
}
const orbN = $('#orbN'), orbL = $('#orbL'), beamEl = $('#beam');
const presN = new Presence($('#orbN canvas'), 'N'), presL = new Presence($('#orbL canvas'), 'L');
addEventListener('resize', () => { presN.resize(); presL.resize(); });
let presT = performance.now();
function beam(from, to) {
  const r1 = (from === 'N' ? orbN : orbL).getBoundingClientRect(), r2 = (to === 'N' ? orbN : orbL).getBoundingClientRect();
  const x1 = r1.left + r1.width / 2, y1 = r1.top + r1.height / 2, x2 = r2.left + r2.width / 2, y2 = r2.top + r2.height / 2;
  const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
  beamEl.className = 'to' + to;
  beamEl.animate([
    { transform: `translate(${x1}px, ${y1}px) rotate(${ang}rad) scaleX(0.05)`, opacity: 0 },
    { transform: `translate(${x1}px, ${y1}px) rotate(${ang}rad) scaleX(${len / 400 * 0.5})`, opacity: 1, offset: 0.35 },
    { transform: `translate(${x1 + (x2 - x1) * 0.5}px, ${y1 + (y2 - y1) * 0.5}px) rotate(${ang}rad) scaleX(${len / 400 * 0.5})`, opacity: 0.9, offset: 0.7 },
    { transform: `translate(${x2}px, ${y2}px) rotate(${ang}rad) scaleX(0.05)`, opacity: 0 },
  ], { duration: 950, easing: 'cubic-bezier(.4,0,.2,1)' });
  score.play('swell', { rate: to === 'L' ? 1.8 : 1.4, gain: 0.12, verb: 0.6 });
  score.voice(to);
}

// ------------------------------------------------------------ start
document.documentElement.classList.add('locked');
window.scrollTo(0, 0);
$('#begin').disabled = false;
$('#begin').textContent = 'Begin';
// the gate: headphones are recommended, never required
const gateStep = id => { document.querySelectorAll('.g-step').forEach(e => e.classList.toggle('on', e.id === id)); };
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => gateStep(b.dataset.go));
document.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
  const url = location.href.split('?')[0].split('#')[0];
  try { if (navigator.share && MOBILE) await navigator.share({ title: document.title, url }); else { await navigator.clipboard.writeText(url); b.textContent = 'Link copied. See you there.'; } }
  catch (e) { b.textContent = url; }
});
// presentation mode: full screen, then it plays by itself
const canFS = !!document.documentElement.requestFullscreen;
const toggleFS = () => { if (!canFS) return; if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
let presenting = false;
if (!canFS || MOBILE) { $('#present').remove(); $('#fs').remove(); }
else {
  $('#present').onclick = () => { presenting = true; document.documentElement.requestFullscreen().catch(() => {}); $('#begin').onclick(); };
  $('#fs').onclick = toggleFS;
  addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F') toggleFS(); });
}
if (MOBILE) document.querySelectorAll('.g-how [data-m]').forEach(e => e.textContent = e.dataset.m);
if (MOBILE) document.querySelector('.g-how .keys').innerHTML = '<kbd>&lsaquo;</kbd><kbd>&rsaquo;</kbd>';
if (MOBILE) $('#hint > div:last-child').innerHTML = 'Swipe up to fly, down to rewind.<br>Or press Play. Pick a speed below.';
if (MOBILE) $('#gs-how').textContent = 'It starts slow, at 0.5×, so you can read every line. Faster or slower? Tap the Speed row at the bottom of the screen.';
// phones: every speed on its own row, a word under each button, and a tap on a faded deck only wakes it
if (MOBILE) {
  document.documentElement.classList.add('touch');
  const row = document.createElement('div'); row.className = 'spdrow';
  row.innerHTML = '<span class="lbl">Speed</span>'; row.appendChild($('#speeds')); $('#deck').appendChild(row);
  let wake = false;
  $('#deck').addEventListener('pointerdown', () => { wake = $('#deck').classList.contains('idle'); lastMove = performance.now(); }, true);
  $('#deck').addEventListener('click', e => { if (wake) { e.stopPropagation(); e.preventDefault(); wake = false; } }, true);
  addEventListener('touchstart', () => { lastMove = performance.now(); }, { passive: true });
}
$('#begin').onclick = async () => {
  if ($('#begin').dataset.used) return; $('#begin').dataset.used = '1'; $('#begin').disabled = true;
  $('#gate').classList.add('gone');
  introT = 0;
  score.init().then(() => { if (introT < 2.2) score.windup(2.6 - introT); }).catch(e => console.warn('audio unavailable', e));
};
$('#snd').onclick = () => { score.setMuted(!score.muted); $('#snd').classList.toggle('off', score.muted); if (score.muted) { vo.pause(); voSlot = -1; } };
$('#rewind').onclick = () => { setAuto(false); flyTo(0); };
$('#play').onclick = () => setAuto(!auto);
// if a browser held the sound back, any later click or key unlocks it
['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, () => score.unlock(), { passive: true }));
// leaving the tab pauses music and flight together
document.addEventListener('visibilitychange', () => { const hidden = document.visibilityState === 'hidden'; score.sleep(hidden); if (hidden) vo.pause(); else if (voSlot >= 0 && !vo.ended) vo.play().catch(() => {}); if (!hidden) last = performance.now(); });
$('#back').onclick = () => step(-1);
$('#fwd').onclick = () => step(1);
setSpeed(speedIdx, true);
applyQuality();
window.cbu = { get vo() { return { el: vo, mode: voMode, slot: voSlot }; }, get auto() { return auto; }, get hot() { return hot; }, get expo() { return expo; }, get q() { return qLevel; }, flyTo, slots, secInfo, UNIT, score, get pos() { return pos; } };
requestAnimationFrame(frame);
