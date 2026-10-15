// The score and sound design, all synthesized live in the browser.
// A pad that follows the flight, generative bells placed in 3D space,
// textured beds per scene, and one shot effects rendered once at start.

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export const MOODS = [
  [38, 50, 57, 64, 69, 74],      // prologue: D minor, dark
  [41, 53, 60, 65, 69, 72],      // 1 film
  [43, 55, 62, 66, 69, 74],      // 2 human clock, lydian warmth
  [45, 52, 57, 64, 71, 76],      // 3 everything changes
  [36, 48, 55, 62, 63, 70],      // 4 matter, deep
  [40, 52, 59, 66, 71, 78],      // 5 night sky, vast
  [37, 49, 56, 63, 68, 75],      // 6 cosmic
  [42, 54, 61, 64, 69, 73],      // 7 truth, tense
  [39, 51, 58, 61, 66, 70],      // 8 matrix
  [38, 50, 57, 62, 65, 69],      // 9 umbrella, D minor 9
  [44, 56, 63, 67, 70, 75],      // 10 cameras
  [41, 53, 60, 64, 67, 72],      // 11 aura
  [46, 53, 58, 61, 65, 72],      // 12 grambles
  [43, 55, 62, 67, 71, 74],      // 13 between us
  [40, 52, 59, 64, 68, 71],      // 14 scale
  [38, 50, 57, 62, 66, 69, 74],  // epilogue: D major, the resolution
];

function makeIR(ctx, secs = 4.2, decay = 2.8) {
  const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1);
  }
  return buf;
}

function reversed(ctx, buf) {
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const a = buf.getChannelData(ch), b = out.getChannelData(ch), n = a.length;
    for (let i = 0; i < n; i++) b[i] = a[n - 1 - i];
  }
  return out;
}

async function render(secs, build, rate = 44100) {
  const oc = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
  build(oc);
  return oc.startRendering();
}

function noiseBuf(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
  return buf;
}

export class Score {
  constructor() { this.ready = false; this.muted = false; this.t = 0; this.nextBell = 0; this.lastStep = 0; this.dir = 1; }

  async init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();

    // master chain: everything -> master filter -> compressor -> volume
    this.out = ctx.createGain(); this.out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    this.mfilt = ctx.createBiquadFilter(); this.mfilt.type = 'lowpass'; this.mfilt.frequency.value = 18000; this.mfilt.Q.value = 0.5;
    this.mfilt.connect(comp); comp.connect(this.out); this.out.connect(ctx.destination);
    this.bus = ctx.createGain(); this.bus.connect(this.mfilt);
    this.verb = ctx.createConvolver(); this.verb.buffer = makeIR(ctx);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.9; this.verbIn.connect(this.verb);
    const vOut = ctx.createGain(); vOut.gain.value = 0.55; this.verb.connect(vOut); vOut.connect(this.mfilt);

    // pad: six voices, two oscillators each, through one warm filter
    this.padFilt = ctx.createBiquadFilter(); this.padFilt.type = 'lowpass'; this.padFilt.frequency.value = 700; this.padFilt.Q.value = 0.7;
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.0;
    this.padFilt.connect(this.padGain); this.padGain.connect(this.bus); this.padGain.connect(this.verbIn);
    this.voices = [];
    for (let v = 0; v < 7; v++) {
      const g = ctx.createGain(); g.gain.value = 0;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.detune.value = 7 + v * 2;
      const pan = ctx.createStereoPanner(); pan.pan.value = (v % 2 ? 1 : -1) * (0.15 + v * 0.1);
      const g1 = ctx.createGain(); g1.gain.value = 0.16; const g2 = ctx.createGain(); g2.gain.value = 0.5;
      o1.connect(g1); o2.connect(g2); g1.connect(g); g2.connect(g); g.connect(pan); pan.connect(this.padFilt);
      o1.start(); o2.start();
      this.voices.push({ g, o1, o2 });
    }
    // slow breathing on the pad filter
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lfoG = ctx.createGain(); lfoG.gain.value = 180;
    lfo.connect(lfoG); lfoG.connect(this.padFilt.frequency); lfo.start();
    // sub
    this.sub = ctx.createOscillator(); this.sub.type = 'sine'; this.subG = ctx.createGain(); this.subG.gain.value = 0;
    this.sub.connect(this.subG); this.subG.connect(this.bus); this.sub.start();

    // textured beds from one stereo noise loop
    const nb = noiseBuf(ctx, 5);
    const bed = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true; src.loopStart = Math.random() * 2; src.start(0, Math.random() * 4);
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(this.bus);
      return { g, fl };
    };
    this.beds = {
      rain: bed('bandpass', 2600, 0.4),
      rainLow: bed('lowpass', 500, 0.5),
      rumble: bed('lowpass', 85, 1.2),
      wind: bed('bandpass', 600, 1.4),
      fire: bed('lowpass', 900, 0.6),
      projector: bed('bandpass', 1500, 2),
      air: bed('highpass', 7000, 0.3),
    };
    this.beds.wind.g.connect(this.verbIn);
    // projector flutter: amplitude modulation at 18 Hz
    const flut = ctx.createOscillator(); flut.type = 'square'; flut.frequency.value = 18;
    const fg = ctx.createGain(); fg.gain.value = 0.5; flut.connect(fg);
    this.projAM = ctx.createGain(); this.projAM.gain.value = 0.5; fg.connect(this.projAM.gain); flut.start();
    this.beds.projector.g.disconnect(); this.beds.projector.g.connect(this.projAM); this.projAM.connect(this.bus);
    // cosmic shimmer: a cluster of high sines
    this.shimG = ctx.createGain(); this.shimG.gain.value = 0; this.shimG.connect(this.verbIn);
    this.shims = [];
    for (let k = 0; k < 4; k++) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1200; const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(this.shimG); o.start(); this.shims.push(o); }

    await this.renderOneShots();
    this.out.gain.setTargetAtTime(this.muted ? 0 : 0.9, ctx.currentTime, 0.8);
    this.ready = true;
  }

  async renderOneShots() {
    const B = this.buf = {};
    B.bell = await render(3.2, oc => {
      const f = 523.25, parts = [[1, 1, 2.8], [2.0, 0.5, 1.6], [2.76, 0.35, 1.2], [5.4, 0.18, 0.6], [8.93, 0.08, 0.35]];
      for (const [m, a, d] of parts) {
        const o = oc.createOscillator(); o.frequency.value = f * m; const g = oc.createGain();
        g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(a * 0.3, 0.005); g.gain.exponentialRampToValueAtTime(0.0001, d);
        o.connect(g); g.connect(oc.destination); o.start(); o.stop(d + 0.05);
      }
    });
    B.click = await render(0.5, oc => { // a mechanical shutter: two clacks and a thump
      const nb = oc.createBuffer(1, oc.sampleRate * 0.5, oc.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      for (const [t0, amp, freq] of [[0, 0.9, 3200], [0.075, 0.7, 2400]]) {
        const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = freq; fl.Q.value = 2.5;
        const g = oc.createGain(); g.gain.setValueAtTime(amp, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.045);
        s.connect(fl); fl.connect(g); g.connect(oc.destination); s.start(t0); s.stop(t0 + 0.06);
      }
      const o = oc.createOscillator(); o.frequency.setValueAtTime(140, 0); o.frequency.exponentialRampToValueAtTime(50, 0.08);
      const g = oc.createGain(); g.gain.setValueAtTime(0.6, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.12); o.connect(g); g.connect(oc.destination); o.start(); o.stop(0.15);
    });
    B.thump = await render(0.4, oc => { // footstep on wet ground
      const o = oc.createOscillator(); o.frequency.setValueAtTime(110, 0); o.frequency.exponentialRampToValueAtTime(45, 0.12);
      const g = oc.createGain(); g.gain.setValueAtTime(0.7, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.2); o.connect(g); g.connect(oc.destination); o.start(); o.stop(0.25);
      const nb = oc.createBuffer(1, oc.sampleRate * 0.3, oc.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1800; fl.Q.value = 0.8;
      const g2 = oc.createGain(); g2.gain.setValueAtTime(0.25, 0); g2.gain.exponentialRampToValueAtTime(0.001, 0.15); s.connect(fl); fl.connect(g2); g2.connect(oc.destination); s.start();
    });
    B.boom = await render(6, oc => { // the aperture opening: sub drop plus a wall of air
      const o = oc.createOscillator(); o.frequency.setValueAtTime(95, 0); o.frequency.exponentialRampToValueAtTime(28, 2.5);
      const g = oc.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.02); g.gain.exponentialRampToValueAtTime(0.001, 5.5);
      o.connect(g); g.connect(oc.destination); o.start(); o.stop(6);
      const nb = oc.createBuffer(2, oc.sampleRate * 6, oc.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = nb.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'lowpass';
      fl.frequency.setValueAtTime(6000, 0); fl.frequency.exponentialRampToValueAtTime(120, 4);
      const g2 = oc.createGain(); g2.gain.setValueAtTime(0.5, 0); g2.gain.exponentialRampToValueAtTime(0.001, 5); s.connect(fl); fl.connect(g2); g2.connect(oc.destination); s.start();
    });
    B.swell = await render(3, oc => { // a breath of air that grows, used reversed for rewinds
      const nb = oc.createBuffer(2, oc.sampleRate * 3, oc.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = nb.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2;
      fl.frequency.setValueAtTime(3000, 0); fl.frequency.exponentialRampToValueAtTime(300, 3);
      const g = oc.createGain(); g.gain.setValueAtTime(0.5, 0); g.gain.exponentialRampToValueAtTime(0.001, 2.9); s.connect(fl); fl.connect(g); g.connect(oc.destination); s.start();
    });
    B.crack = await render(3, oc => { // glass and metal giving way
      for (let k = 0; k < 9; k++) {
        const t0 = k * 0.03 + Math.random() * 0.05, o = oc.createOscillator(); o.type = 'triangle';
        o.frequency.value = 1800 + Math.random() * 4200; const g = oc.createGain();
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6 + Math.random());
        o.connect(g); g.connect(oc.destination); o.start(t0); o.stop(t0 + 2);
      }
      const nb = oc.createBuffer(1, oc.sampleRate * 0.6, oc.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 2500;
      s.connect(fl); fl.connect(oc.destination); s.start();
    });
    B.blip = await render(0.25, oc => {
      const o = oc.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(1600, 0); o.frequency.setValueAtTime(2400, 0.04);
      const g = oc.createGain(); g.gain.setValueAtTime(0.12, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.12); o.connect(g); g.connect(oc.destination); o.start(); o.stop(0.2);
    });
    B.ratchet = await render(0.12, oc => {
      const nb = oc.createBuffer(1, oc.sampleRate * 0.1, oc.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 12);
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 4200; fl.Q.value = 6;
      const g = oc.createGain(); g.gain.value = 1.4; s.connect(fl); fl.connect(g); g.connect(oc.destination); s.start();
    });
    B.thunder = await render(7, oc => {
      const nb = oc.createBuffer(2, oc.sampleRate * 7, oc.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = nb.getChannelData(ch); let v = 0; for (let i = 0; i < d.length; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.15; d[i] = v; } }
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 400;
      const g = oc.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1.6, 0.15); g.gain.setValueAtTime(1.2, 0.6); g.gain.linearRampToValueAtTime(1.8, 1.1); g.gain.exponentialRampToValueAtTime(0.001, 6.8);
      s.connect(fl); fl.connect(g); g.connect(oc.destination); s.start();
    });
    for (const k of ['bell', 'swell', 'click', 'crack']) B[k + 'R'] = reversed(this.ctx, B[k]);
  }

  play(name, { rate = 1, gain = 1, pos = null, verb = 0.4, when = 0 } = {}) {
    if (!this.ready || !this.buf[name]) return;
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.buf[name]; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(g);
    let node = g;
    if (pos) {
      const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 0.8;
      p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2];
      g.connect(p); node = p;
    }
    node.connect(this.bus);
    if (verb > 0) { const vg = ctx.createGain(); vg.gain.value = verb; node.connect(vg); vg.connect(this.verbIn); }
    s.start(ctx.currentTime + when);
  }

  rndPos(r = 4) {
    const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * 1.2;
    return [Math.cos(a) * r, Math.sin(e) * r, Math.sin(a) * r];
  }

  // the camera winding before it opens
  windup(secs) {
    let t = 0, k = 0;
    while (t < secs) { this.play('ratchet', { rate: 0.8 + k * 0.02, gain: 0.35 + t / secs * 0.5, verb: 0.15, when: t }); const step = Math.max(0.045, 0.22 * (1 - t / secs)); t += step; k++; }
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = 'sawtooth'; const g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 400;
    o.frequency.setValueAtTime(55, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + secs);
    g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + secs * 0.95); g.gain.linearRampToValueAtTime(0, ctx.currentTime + secs + 0.05);
    o.connect(f); f.connect(g); g.connect(this.bus); o.start(); o.stop(ctx.currentTime + secs + 0.1);
  }

  boom() {
    this.play('boom', { gain: 1, verb: 0.8 });
    this.play('click', { rate: 0.5, gain: 1.2, verb: 1 });
    this.padGain.gain.setTargetAtTime(0.55, this.ctx.currentTime, 1.5);
  }

  setMuted(m) {
    this.muted = m;
    if (this.ready) this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.2);
  }

  // per frame
  update(dt, st) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime;
    this.t += dt;
    const v = st.vel, av = Math.min(Math.abs(v), 40), rev = v < -0.25;
    const chord = MOODS[st.mood] || MOODS[0];
    // pad follows the chord of the scene, gliding like a slow camera move
    for (let k = 0; k < this.voices.length; k++) {
      const vo = this.voices[k], note = chord[k];
      if (note !== undefined) {
        vo.o1.frequency.setTargetAtTime(mtof(note), now, 0.9); vo.o2.frequency.setTargetAtTime(mtof(note), now, 0.9);
        vo.g.gain.setTargetAtTime((k === 0 ? 0.32 : 0.2) * (st.freeze ? 0.4 : 1), now, 1.2);
      } else vo.g.gain.setTargetAtTime(0, now, 1);
      // tape speed: scrolling fast bends the whole score, rewinding wobbles it
      const bend = Math.max(-700, Math.min(700, v * 22)) + (rev ? Math.sin(this.t * 7 + k) * 35 : 0);
      vo.o1.detune.setTargetAtTime(bend, now, 0.12); vo.o2.detune.setTargetAtTime(bend + 7 + k * 2, now, 0.12);
    }
    this.sub.frequency.setTargetAtTime(mtof(chord[0] - 12), now, 1);
    this.subG.gain.setTargetAtTime(0.18 * st.bright, now, 1);
    const cut = (420 + st.bright * 900 + av * 70) * (st.freeze ? 0.35 : 1);
    this.padFilt.frequency.setTargetAtTime(Math.min(9000, cut), now, 0.25);
    this.mfilt.frequency.setTargetAtTime(st.freeze ? 900 : 18000, now, st.freeze ? 0.3 : 0.08);

    const B = this.beds, set = (b, x, tc = 0.4) => b.g.gain.setTargetAtTime(x, now, tc);
    set(B.rain, st.rain * 0.55); set(B.rainLow, st.rain * 0.35);
    set(B.rumble, st.rumble * 0.9); set(B.fire, st.fire * 0.35); set(B.projector, st.projector * 0.08);
    set(B.air, 0.015 + st.shimmer * 0.03);
    // the rush of speed
    set(B.wind, Math.min(0.5, av * 0.03), 0.08);
    B.wind.fl.frequency.setTargetAtTime(300 + av * 120, now, 0.1);
    this.shimG.gain.setTargetAtTime(st.shimmer * 0.25, now, 0.8);
    this.shims.forEach((o, k) => o.frequency.setTargetAtTime(mtof(chord[(k + 2) % chord.length] + 24) * (1 + (rev ? -0.02 : 0)), now, 0.5));

    // direction change into reverse: a breath sucked backwards
    const dir = v < -0.6 ? -1 : v > 0.6 ? 1 : this.dir;
    if (dir !== this.dir) { if (dir < 0) this.play('swellR', { gain: 0.5, verb: 0.6 }); this.dir = dir; }

    // generative bells, placed around the listener; reversed when rewinding
    this.nextBell -= dt * (0.35 + av * 0.18) * st.bells;
    if (this.nextBell <= 0 && !st.freeze) {
      this.nextBell = 0.6 + Math.random() * 1.4;
      const note = chord[1 + Math.floor(Math.random() * (chord.length - 1))] + (Math.random() < 0.5 ? 12 : 24);
      const rate = mtof(note) / 523.25;
      this.play(rev ? 'bellR' : 'bell', { rate, gain: 0.32 + Math.random() * 0.15, pos: this.rndPos(3 + Math.random() * 3), verb: 0.9 });
    }
    // fire crackle
    if (st.fire > 0.1 && Math.random() < st.fire * dt * 14) this.play('ratchet', { rate: 0.4 + Math.random() * 0.6, gain: 0.25 * st.fire, pos: this.rndPos(2), verb: 0.1 });
    // digital blips in the matrix
    if (st.blips > 0 && Math.random() < st.blips * dt * 5) this.play('blip', { rate: 0.6 + Math.random(), gain: 0.25, pos: this.rndPos(3), verb: 0.3 });
    // cameras everywhere: shutters all around you
    if (st.shutters > 0 && Math.random() < st.shutters * dt * 6) this.play('click', { rate: 0.8 + Math.random() * 0.5, gain: 0.4, pos: this.rndPos(2 + Math.random() * 6), verb: 0.25 });
    // glitch bursts for generated images
    if (st.glitch > 0 && Math.random() < st.glitch * dt * 3) this.play('blip', { rate: 0.2 + Math.random() * 0.3, gain: 0.35, pos: this.rndPos(2), verb: 0 });
    // footsteps: your scrolling is the walking
    if (st.walk > 0) {
      const step = Math.floor(st.flow / 0.55);
      if (step !== this.lastStep) { this.lastStep = step; this.play('thump', { rate: 0.9 + Math.random() * 0.2, gain: 0.5 * st.walk, pos: [(step % 2 ? 0.4 : -0.4), -1.5, 0.5], verb: 0.2 }); }
    }
  }
}
