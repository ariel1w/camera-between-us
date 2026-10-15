import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SECTIONS } from './content.js';
import { initScenes, O, SKY_LABELS, skyAnchor, sst, fract, mix } from './scenes.js';
import { Score } from './audio.js';

const $ = s => document.querySelector(s);
const MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 600;
const N = MOBILE ? 9000 : 24000;
const UNIT = MOBILE ? 95 : 110; // scroll pixels per timeline unit

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

const slots = [];
let total = 0;
const secInfo = [];
SECTIONS.forEach((sec, si) => {
  const info = { start: total, titleSlot: slots.length, lineSlot0: slots.length + 1, n: sec.lines.length, cueIdx: {} };
  slots.push({ kind: 'title', sec: si, start: total, len: 3.4, dur: 4.2 }); total += 3.4;
  sec.lines.forEach((ln, li) => {
    const words = ln.t.split(/\s+/).length;
    let len = 1.05 + words * 0.075 + (ln.s === 'H' ? 0.3 : 0);
    const hold = (HOLD[si] && HOLD[si][ln.t]) || 0, last = li === sec.lines.length - 1;
    len += hold + (last ? 1.2 : 0);
    const dur = 1.6 + words * 0.32 + (ln.s === 'L' ? 0.9 : 0) + hold * 1.6 + (last ? 1.4 : 0);
    slots.push({ kind: 'line', sec: si, li, start: total, len, dur, line: ln }); total += len;
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
const DPR = Math.min(devicePixelRatio || 1, MOBILE ? 1 : 1.5);
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
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 1 }, uExp: { value: 1 } },
  vertexShader: `
    attribute float aSize; attribute vec3 color; varying vec3 vC; varying float vA;
    uniform float uScale; uniform float uExp;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = -mv.z;
      gl_PointSize = aSize <= 0.001 || d < 0.2 ? 0.0 : min(90.0, aSize * uScale / d);
      vA = smoothstep(0.3, 2.5, d);
      vC = color * uExp;
    }`,
  fragmentShader: `
    varying vec3 vC; varying float vA;
    void main(){
      float r = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, r); a = a * a * vA;
      gl_FragColor = vec4(vC, a);
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
  var bgStars = new THREE.Points(g, pMat); bgStars.frustumCulled = false; scene.add(bgStars);
}

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
      col *= smoothstep(1.05, 0.25, r * (1.0 + uDark));
      col = col + uFlash;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(film);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth / (MOBILE ? 3 : 2), innerHeight / (MOBILE ? 3 : 2));
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y * 0.075;
  $('#track').style.height = (total * UNIT + innerHeight) + 'px';
}
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------ text layer
const linesEl = $('#lines');
const els = slots.map((s, k) => {
  const d = document.createElement('div');
  if (s.kind === 'title') {
    const sec = SECTIONS[s.sec];
    d.className = 'ttl';
    const num = /^\d+$/.test(sec.num) ? sec.num : sec.num;
    d.innerHTML = `<div class="num ${/^\d+$/.test(sec.num) ? '' : 'word'}">${num}</div><div class="name">${sec.title}</div>`;
  } else if (s.kind === 'line') {
    const ln = s.line, prev = k > 0 && slots[k - 1].kind === 'line' ? slots[k - 1].line : null;
    const who = ln.s === 'N' ? 'neil' : ln.s === 'L' ? 'lumen' : 'head';
    d.className = 'ln ' + who;
    let html = '';
    if (ln.s !== 'H' && (!prev || prev.s !== ln.s || slots[k - 1].sec !== s.sec)) html += `<div class="who">${ln.s === 'N' ? 'Neil' : 'Lumen'}</div>`;
    if (ln.s === 'L') {
      // Lumen's words assemble out of light, letter by letter
      const words = ln.t.split(' ').map(w => '<span class="w">' + [...w].map(ch => {
        const dx = ((Math.random() - 0.5) * 70).toFixed(0), dy = ((Math.random() - 0.5) * 50).toFixed(0), dl = (Math.random() * 0.55).toFixed(2);
        return `<span class="ch" style="--dx:${dx}px;--dy:${dy}px;--dl:${dl}s">${ch}</span>`;
      }).join('') + '</span>');
      html += `<div class="tx">${words.join(' ')}</div>`;
    } else html += `<div class="tx">${ln.t}</div>`;
    d.innerHTML = html;
  } else { d.className = 'none'; }
  d.style.display = 'none';
  linesEl.appendChild(d);
  return d;
});

// ------------------------------------------------------------ HUD
const tl = $('#timeline');
secInfo.forEach((info, si) => {
  const b = document.createElement('button');
  b.className = 'tick'; b.style.top = (info.start / total * 100) + '%';
  const sec = SECTIONS[si];
  b.title = (/^\d+$/.test(sec.num) ? sec.num + '. ' : sec.num + ': ') + sec.title;
  b.innerHTML = `<span>${b.title}</span>`;
  b.onclick = () => { if (auto) { setAuto(false); flyTo(info.start + 0.4); } else flyTo(info.start + 0.4); };
  tl.appendChild(b);
});
const marker = document.createElement('div'); marker.className = 'marker'; tl.appendChild(marker);

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
let mouseX = 0, mouseY = 0, flying = null, lastSlot = -1, expo = 1, auto = false, autoY = 0;
const score = new Score();
const tmpV = new THREE.Vector3();

addEventListener('pointermove', e => { mouseX = e.clientX / innerWidth - 0.5; mouseY = e.clientY / innerHeight - 0.5; });
['wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { if (flying) flying = null; if (auto) setAuto(false); $('#hint').classList.add('gone'); }, { passive: true }));
addEventListener('keydown', e => {
  if (!started) return;
  if (e.code === 'Space') { e.preventDefault(); setAuto(!auto); return; }
  if (flying) flying = null; if (auto) setAuto(false); $('#hint').classList.add('gone');
});
function setAuto(on) {
  auto = on; autoY = scrollY; flying = null;
  $('#hint').classList.add('gone');
  $('#play').classList.toggle('on', on);
  $('#play').textContent = on ? '❚❚ PAUSE' : '▶ PLAY';
}

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
  [9, 'Later, it rains.', () => { score.play('thunder', { gain: 1, verb: 0.6 }); flash = 0.45; }],
  [9, 'With the information:', () => score.play('bell', { rate: 0.5, gain: 0.6, verb: 1 })],
  [10, 'You pressed the shutter.', () => { score.play('click', { gain: 1.3, verb: 0.6 }); flash = 0.6; }],
  [12, 'Grambles.', () => score.play('swellR', { rate: 1.3, gain: 0.6, verb: 1 })],
  [15, 'So perhaps the camera was never freezing time.', () => { score.windup(2.2); }],
  [15, 'It was showing us that time cannot be frozen.', () => { score.play('crack', { gain: 1, verb: 0.8 }); score.play('boom', { gain: 0.9, verb: 0.9 }); flash = 0.9; }],
  [15, 'The beginning of the question.', () => { [0, 4, 7, 12].forEach((n, k) => score.play('bell', { rate: Math.pow(2, (n - 3) / 12), gain: 0.5, when: k * 0.18, verb: 1 })); }],
].map(([si, txt, fn]) => {
  const li = SECTIONS[si].lines.findIndex(l => l.t.startsWith(txt));
  if (li < 0) console.warn('event line missing', txt);
  return { slot: secInfo[si].lineSlot0 + li, fn };
});

const BRIGHT = [0.3, 0.6, 0.7, 0.6, 0.4, 0.85, 0.85, 0.5, 0.4, 0.5, 0.6, 0.7, 0.6, 0.8, 0.8, 0.95];

// ------------------------------------------------------------ per frame
const cA = { t: 0, f: 0, q: null, sx: 1, intro: 0, burst: 0, choice: 'umbrella' };
const cB = { t: 0, f: 0, q: null, sx: 1, intro: 0, burst: 0, choice: 'umbrella' };
const qLive = SECTIONS.map(() => ({}));
const tc = (s) => { const fr = Math.floor(s * 24) % 24, sec = Math.floor(s) % 60, min = Math.floor(s / 60) % 60, hr = Math.floor(s / 3600); return [hr, min, sec, fr].map(x => String(x).padStart(2, '0')).join(':'); };

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
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
    else { autoY += cur.len / cur.dur * dt * UNIT; window.scrollTo(0, autoY); }
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
  let shut = 0;
  if (si === 15 && started) shut = sst(0, 1.4, q.never) * (1 - sst(0, 0.18, q.cannot));
  const freeze = shut > 0.55 ? 1 : 0;
  flow += (vel * 1.0 + 0.28) * dt * (1 - shut * 0.97);

  // intro: wind up, then the aperture snaps open
  if (introT >= 0) {
    introT += dt;
    intro = Math.min(1, introT / 2.6);
    if (introT >= 2.6 && apertureOpen === 0) { score.boom(); flash = 1; apertureOpen = 0.0001; burst = 1; }
    if (apertureOpen > 0 && apertureOpen < 1) apertureOpen = Math.min(1, apertureOpen + dt * 2.6);
    if (introT > 3.4 && !started) { started = true; document.documentElement.classList.remove('locked'); $('#hint').classList.remove('gone'); $('#hud').classList.add('on'); }
  }
  burst *= Math.exp(-dt * 1.2);
  const openNow = started ? Math.min(1 - shut, 1) : (apertureOpen > 0 ? 1 - Math.pow(1 - apertureOpen, 3) : 0);
  setAperture(si === 15 ? 1 - shut : openNow, si === 15 ? shut : intro * (1 - openNow) + 0.1, (si === 15 && shut > 0.8) ? 0.03 : (!started && intro > 0.6 && openNow === 0 ? 0.01 : 0));

  // contexts for the two states being blended
  const sx = Math.max(0.42, Math.min(1.15, camera.aspect / 1.78));
  for (const c of [cA, cB]) { c.t = t; c.f = flow; c.sx = sx; c.intro = intro; c.burst = burst; c.choice = choice; }
  let fa, fb, m;
  if (lp < -0.15 && si > 0) {
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
  for (let i = 0; i < N; i++) {
    let w = m >= 1 ? 1 : m <= 0 ? 0 : Math.min(1, Math.max(0, m * 1.6 - ((i * 0.6180339) % 1) * 0.6));
    w = w * w * (3 - 2 * w);
    let x, y, z, r, g, b, s;
    if (w < 1) {
      fa(i, cA); x = O[0]; y = O[1]; z = O[2]; r = O[3]; g = O[4]; b = O[5]; s = O[6];
      if (w > 0) {
        fb(i, cB);
        // particles arc through space as they travel between shapes
        const lift = Math.sin(w * Math.PI) * 1.4 * (((i * 0.7548776) % 1) - 0.5);
        x += (O[0] - x) * w + lift; y += (O[1] - y) * w + lift * 0.6; z += (O[2] - z) * w;
        r += (O[3] - r) * w; g += (O[4] - g) * w; b += (O[5] - b) * w; s += (O[6] - s) * w;
      }
    } else { fb(i, cB); x = O[0]; y = O[1]; z = O[2]; r = O[3]; g = O[4]; b = O[5]; s = O[6]; }
    const j = i * 3;
    POS[j] = x; POS[j + 1] = y; POS[j + 2] = z; COL[j] = r; COL[j + 1] = g; COL[j + 2] = b; SIZ[i] = s;
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
  // auto exposure: the more tightly packed the shape on screen, the dimmer each particle
  {
    let n = 0, mx = 0, my = 0, m2 = 0;
    const camZ = camera.position.z;
    for (let i = 0; i < N; i += 97) {
      if (SIZ[i] <= 0.001) continue;
      const d = Math.max(1, camZ - POS[i * 3 + 2]), px = POS[i * 3] / d * 14, py = POS[i * 3 + 1] / d * 14;
      mx += px; my += py; m2 += px * px + py * py; n++;
    }
    if (n > 10) { mx /= n; my /= n; const spread = m2 / n - mx * mx - my * my; expo += (Math.min(1, Math.max(0.2, spread / 24)) - expo) * Math.min(1, dt * 2.5); }
  }
  pMat.uniforms.uExp.value = (started ? 1 : 0.35 + intro * 0.5 + burst * 0.5) * expo;

  // warp streaks
  const wOp = Math.min(0.85, Math.max(0, av - 2.5) / 10);
  wMat.opacity = wOp;
  if (wOp > 0) {
    const len = 0.4 + av * 0.5, dz = vel * dt * 7;
    for (let i = 0; i < WS; i++) {
      const d = wData[i]; d[2] += dz;
      if (d[2] > 14) d[2] -= 134; if (d[2] < -120) d[2] += 134;
      const o = i * 6, l = vel >= 0 ? len : -len;
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
  camera.position.x += ((mouseX * 1.6) + (Math.random() - 0.5) * shake - camera.position.x) * Math.min(1, dt * 3);
  camera.position.y += ((0.6 - mouseY * 0.9) + (Math.random() - 0.5) * shake - camera.position.y) * Math.min(1, dt * 3);
  camera.position.z = (MOBILE && camera.aspect < 1 ? 17 : 14);
  camera.fov += ((58 + Math.min(av, 30) * 0.75) - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(0, 1, 0);
  bgStars.rotation.y = flow * 0.0015; bgStars.rotation.x = flow * 0.0007;

  // post
  flash *= Math.exp(-dt * 2.2);
  const rev = vel < -0.6 ? Math.min(1, (-vel - 0.6) / 3) : 0;
  film.uniforms.uTime.value = t;
  film.uniforms.uAb.value = 0.0025 + Math.min(av, 40) * 0.0007;
  film.uniforms.uRev.value += (rev - film.uniforms.uRev.value) * Math.min(1, dt * 6);
  film.uniforms.uFlash.value = flash;
  film.uniforms.uDark.value = shut * 0.6;
  bloom.strength = 0.85 + burst * 0.6 + Math.min(av, 30) * 0.015;

  composer.render();

  // labels in the night sky
  const sep = si === 5 ? sst(0, 1.2, q.travel) * (1 - sst(0, 1, q.gathers)) : 0;
  skyLabels.forEach((el, n) => {
    if (sep < 0.35) { el.style.opacity = 0; return; }
    skyAnchor(cB, SKY_LABELS[n].k, sep, tmpV); tmpV.project(camera);
    const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
    el.style.opacity = vis ? Math.min(1, (sep - 0.35) * 3) : 0;
    el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * innerWidth}px, ${(-tmpV.y * 0.5 + 0.5) * innerHeight}px)`;
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

  // text
  renderText(k);

  // events
  if (lastSlot >= 0 && k !== lastSlot && started) {
    for (const ev of EVENTS) if (lastSlot < ev.slot && k >= ev.slot) ev.fn();
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
  marker.style.top = (pos / total * 100) + '%';

  // sound
  const sw = lp < -0.15 ? 0 : 1;
  score.update(dt, {
    mood: si, vel, flow, bright: BRIGHT[si] * (started ? 1 : intro), freeze,
    rain: si === 9 || si === 14 ? rainAmt * (choice === 'walk' ? 1.3 : 1) : 0,
    rumble: si === 2 ? sst(0, 1, q.rises) * (1 - sst(0, 3, q.transformed)) * 0.8 + sst(0, 0.5, q.fractures) * (1 - sst(0, 2, q.erodes)) * 0.4 : (si === 15 ? shut * 0.6 : 0),
    fire: si === 4 ? sst(0, 1, q.extract) * (1 - sst(0, 1.5, q.wonder)) : 0,
    projector: si === 1 ? sw : 0,
    shimmer: [0.4, 0, 0.2, 0.3, 0, 1, 1, 0, 0, 0, 0.3, 0.6, 0.8, 0.5, 0.7, 0.8][si] * sw,
    bells: si === 8 ? 0.35 : si === 7 ? 0.6 : 1,
    blips: si === 8 && q.rel < 0 ? sw * 0.8 : 0,
    glitch: si === 7 && q.gen >= 0 && q.all < 0 ? 1 : 0,
    shutters: si === 10 && q.every >= 0 && q.truth < 0 ? (q.billions >= 0 ? 3 : 1) : 0,
    walk: si === 9 && q.ret < 0 && lp > 0 ? 1 : 0,
  });
}

const shown = new Set();
function renderText(k) {
  const lo = Math.max(0, k - 3), hi = Math.min(slots.length, k + 8);
  for (const j of shown) if (j < lo || j >= hi) { els[j].style.display = 'none'; shown.delete(j); }
  for (let j = lo; j < hi; j++) {
    const s = slots[j], el = els[j];
    if (s.kind === 'credits') continue;
    const half = s.len / 2, d = s.start + half - pos;
    let sc = 1, op = 1, bl = 0, y = 0, on = true;
    if (d > half) { const a = (d - half) / 1.2; sc = 1 / (1 + 0.32 * a); op = Math.max(0, 0.22 - a * 0.25) * (a < 0.08 ? 1 + (0.08 - a) * 40 : 1); bl = 2 + a * 3; y = -40 - a * 30; on = a < 0.3; }
    else if (d < -half) { const a = (-d - half) / 1.1; sc = 1.03 + a * 1.2; op = Math.max(0, 1 - a * 7); bl = a * 12; y = a * 20; }
    else sc = 1 + (half - d) / (2 * half) * 0.035;
    if (s.kind === 'title') { op *= 1; }
    if (op <= 0.01 || !started) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
    if (el.style.display !== 'block') { el.style.display = 'block'; shown.add(j); }
    el.style.opacity = op.toFixed(3);
    el.style.transform = `translate(-50%, -50%) translateY(${y.toFixed(1)}px) scale(${sc.toFixed(4)})`;
    el.style.filter = bl > 0.15 ? `blur(${bl.toFixed(1)}px)` : 'none';
    if (on !== el._on) { el._on = on; el.classList.toggle('on', on); }
  }
}

// ------------------------------------------------------------ start
document.documentElement.classList.add('locked');
window.scrollTo(0, 0);
$('#begin').disabled = false;
$('#begin').textContent = MOBILE ? 'Tap to begin' : 'Click to begin';
$('#begin').onclick = async () => {
  $('#gate').classList.add('gone');
  try { await score.init(); score.windup(2.6); } catch (e) { console.warn('audio unavailable', e); }
  introT = 0;
};
$('#snd').onclick = () => { score.setMuted(!score.muted); $('#snd').classList.toggle('off', score.muted); };
$('#rewind').onclick = () => { setAuto(false); flyTo(0); };
$('#play').onclick = () => setAuto(!auto);
window.cbu = { flyTo, slots, secInfo, UNIT, get pos() { return pos; } };
requestAnimationFrame(frame);
