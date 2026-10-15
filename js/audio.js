// The score and sound design, all synthesized in the browser.
// No sustained tones anywhere: the music is made only of struck and plucked
// sounds that ring and fade (a synthesized piano, a harp, celesta bells),
// flowing as arpeggios through each section's chords, with the theme on top.
// Majesty comes from build: denser arpeggios, octaves, harp sweeps, timpani
// and short swells that bloom and die away at the great moments.

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const IV = {
  M: [0, 4, 7], m: [0, 3, 7], sus2: [0, 2, 7], sus4: [0, 5, 7],
  M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], add9: [0, 4, 7, 14], m9: [0, 3, 7, 14],
};

// [root, quality] per chord. Roots sit around D2 so the bass is felt, not boomy.
const PROG = [
  [[38, 'm9'], [34, 'M7'], [41, 'M'], [36, 'sus2']],                 // prologue: D minor, intimate
  [[41, 'M'], [38, 'm7'], [34, 'M'], [36, 'sus4']],                  // 1 film
  [[43, 'add9'], [38, 'M'], [40, 'm7'], [36, 'M7']],                 // 2 human clock
  [[45, 'sus2'], [42, 'm7'], [38, 'M'], [40, 'sus4']],               // 3 everything changes
  [[36, 'm'], [44, 'M7'], [39, 'M'], [34, 'M']],                     // 4 matter
  [[40, 'sus2'], [37, 'm7'], [45, 'M7'], [35, 'sus4']],              // 5 night sky
  [[37, 'M7'], [34, 'm9'], [42, 'M'], [44, 'sus4']],                 // 6 cosmic time
  [[42, 'm'], [38, 'M7'], [35, 'm7'], [37, 'sus4']],                 // 7 truth
  [[39, 'm'], [35, 'M7'], [42, 'M'], [37, 'M']],                     // 8 matrix
  [[38, 'm9'], [34, 'M7'], [43, 'm7'], [45, 'sus4']],                // 9 umbrella
  [[44, 'M'], [41, 'm7'], [37, 'M7'], [39, 'sus4']],                 // 10 cameras
  [[41, 'M7'], [45, 'm7'], [34, 'M7'], [36, 'add9']],                // 11 aura
  [[46, 'm9'], [42, 'M7'], [37, 'M'], [44, 'sus2']],                 // 12 grambles
  [[43, 'M'], [40, 'm7'], [36, 'M7'], [38, 'sus4']],                 // 13 between us
  [[40, 'M'], [37, 'm7'], [45, 'add9'], [35, 'M']],                  // 14 scale
  [[38, 'M'], [35, 'm7'], [43, 'M7'], [45, 'sus4'], [45, 'M'], [38, 'add9']], // epilogue: D major
];

// the theme, as indices into the chord's tones (0 = root, 1 = third...)
const THEME = [
  [[3, 0.55], [2, 0.55], [4, 0.9], [3, 0.55], [1, 1.6]],
  [[4, 0.55], [5, 0.55], [4, 0.9], [2, 0.55], [3, 1.8]],
  [[2, 0.8], [3, 0.8], [1, 1.4]],
];

// arpeggio shapes, as indices into the chord tones (-1 = rest)
const PATTERNS = [
  [0, 2, 4, 2, 5, 4, 2, 4],
  [0, 1, 2, 4, 3, 2, 4, 6],
  [0, 2, 1, 3, 2, 4, 3, 5],
  [3, 2, 4, 2, 5, 2, 4, 1],
  [0, 4, 2, 5, 3, 6, 4, 2],
];

function makeIR(ctx, secs = 4.8, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 300 ? i / 300 : 1);
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
  constructor() {
    this.ready = false; this.muted = false; this.t = 0; this.lastStep = 0; this.dir = 1;
    this.running = false; this.mood = -1; this.ci = 0; this.chordT = 0; this.cur = null;
    this.boost = 0; this.nextSparkle = 2; this.themeK = 0; this.chordCount = 0; this.visualEvents = [];
    this.tape = 1; this.tempo = 1; this.nextNote = 0; this.step = 99; this.stepsInChord = 8; this.pattern = [0];
  }

  async init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();

    this.out = ctx.createGain(); this.out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.03; comp.release.value = 0.5;
    this.mfilt = ctx.createBiquadFilter(); this.mfilt.type = 'lowpass'; this.mfilt.frequency.value = 18000; this.mfilt.Q.value = 0.5;
    // a brick wall limiter after the glue compressor, so nothing can ever clip
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    this.lim = lim; this.mfilt.connect(comp); comp.connect(lim); lim.connect(this.out); this.out.connect(ctx.destination);
    this.bus = ctx.createGain(); this.bus.gain.value = 0.42; this.bus.connect(this.mfilt);
    this.verb = ctx.createConvolver(); this.verb.buffer = makeIR(ctx);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 1; this.verbIn.connect(this.verb);
    const vOut = ctx.createGain(); vOut.gain.value = 0.26; this.verb.connect(vOut); vOut.connect(this.mfilt);

    // instrument bus: dry plus a generous hall
    this.inst = ctx.createGain(); this.inst.gain.value = 1; this.inst.connect(this.bus);
    const iv = ctx.createGain(); iv.gain.value = 0.85; this.inst.connect(iv); iv.connect(this.verbIn);

    // textured beds from one stereo noise loop (scene sound design)
    const nb = noiseBuf(ctx, 5);
    const bed = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true; src.start(0, Math.random() * 4);
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
    };
    await this.renderOneShots();
    this.out.gain.setTargetAtTime(this.muted ? 0 : 0.9, ctx.currentTime, 0.8);
    this.ready = true;
  }

  async renderOneShots() {
    const B = this.buf = {};
    B.bell = await render(4, oc => { // harp and piano like voice for the theme
      const f = 523.25, parts = [[1, 1, 3.2], [2.0, 0.42, 1.8], [3.0, 0.16, 1.1], [4.02, 0.08, 0.7], [5.4, 0.04, 0.4]];
      for (const [m, a, d] of parts) {
        const o = oc.createOscillator(); o.frequency.value = f * m; const g = oc.createGain();
        g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(a * 0.32, 0.006); g.gain.exponentialRampToValueAtTime(0.0001, d);
        o.connect(g); g.connect(oc.destination); o.start(); o.stop(d + 0.05);
      }
    });
    B.timp = await render(3.5, oc => { // timpani: a tuned drum on D
      const o = oc.createOscillator(); o.frequency.setValueAtTime(82, 0); o.frequency.exponentialRampToValueAtTime(73.4, 0.25);
      const g = oc.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.9, 0.01); g.gain.exponentialRampToValueAtTime(0.001, 3.2);
      o.connect(g); g.connect(oc.destination); o.start(); o.stop(3.4);
      const o2 = oc.createOscillator(); o2.frequency.value = 73.4 * 1.5; const g2 = oc.createGain();
      g2.gain.setValueAtTime(0.25, 0); g2.gain.exponentialRampToValueAtTime(0.001, 1.4); o2.connect(g2); g2.connect(oc.destination); o2.start(); o2.stop(1.5);
      const nb = oc.createBuffer(1, oc.sampleRate * 0.3, oc.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700;
      const g3 = oc.createGain(); g3.gain.value = 0.5; s.connect(fl); fl.connect(g3); g3.connect(oc.destination); s.start();
    });
    B.click = await render(0.5, oc => {
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
    B.thump = await render(0.4, oc => {
      const o = oc.createOscillator(); o.frequency.setValueAtTime(110, 0); o.frequency.exponentialRampToValueAtTime(45, 0.12);
      const g = oc.createGain(); g.gain.setValueAtTime(0.7, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.2); o.connect(g); g.connect(oc.destination); o.start(); o.stop(0.25);
      const nb = oc.createBuffer(1, oc.sampleRate * 0.3, oc.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1800; fl.Q.value = 0.8;
      const g2 = oc.createGain(); g2.gain.setValueAtTime(0.25, 0); g2.gain.exponentialRampToValueAtTime(0.001, 0.15); s.connect(fl); fl.connect(g2); g2.connect(oc.destination); s.start();
    });
    B.boom = await render(6, oc => {
      const o = oc.createOscillator(); o.frequency.setValueAtTime(95, 0); o.frequency.exponentialRampToValueAtTime(28, 2.5);
      const g = oc.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.02); g.gain.exponentialRampToValueAtTime(0.001, 5.5);
      o.connect(g); g.connect(oc.destination); o.start(); o.stop(6);
      const nb = oc.createBuffer(2, oc.sampleRate * 6, oc.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = nb.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'lowpass';
      fl.frequency.setValueAtTime(6000, 0); fl.frequency.exponentialRampToValueAtTime(120, 4);
      const g2 = oc.createGain(); g2.gain.setValueAtTime(0.5, 0); g2.gain.exponentialRampToValueAtTime(0.001, 5); s.connect(fl); fl.connect(g2); g2.connect(oc.destination); s.start();
    });
    B.swell = await render(3, oc => {
      const nb = oc.createBuffer(2, oc.sampleRate * 3, oc.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = nb.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2;
      fl.frequency.setValueAtTime(3000, 0); fl.frequency.exponentialRampToValueAtTime(300, 3);
      const g = oc.createGain(); g.gain.setValueAtTime(0.5, 0); g.gain.exponentialRampToValueAtTime(0.001, 2.9); s.connect(fl); fl.connect(g); g.connect(oc.destination); s.start();
    });
    B.crack = await render(3, oc => {
      for (let k = 0; k < 9; k++) {
        const t0 = k * 0.03 + Math.random() * 0.05, o = oc.createOscillator(); o.type = 'triangle';
        o.frequency.value = 1800 + Math.random() * 4200; const g = oc.createGain();
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6 + Math.random());
        o.connect(g); g.connect(oc.destination); o.start(t0); o.stop(t0 + 2);
      }
      const nb = oc.createBuffer(1, oc.sampleRate * 0.6, oc.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
      const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 2500;
      s.connect(fl); fl.connect(oc.destination); s.start();
    });
    B.blip = await render(0.25, oc => {
      const o = oc.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(1200, 0); o.frequency.setValueAtTime(1800, 0.04);
      const g = oc.createGain(); g.gain.setValueAtTime(0.1, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.12); o.connect(g); g.connect(oc.destination); o.start(); o.stop(0.2);
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
    // a piano: inharmonic partials, two detuned strings, a felt hammer; three registers
    for (const [name, f] of [['pno3', 130.81], ['pno4', 261.63], ['pno5', 523.25]]) {
      B[name] = await render(6, oc => {
        const B2 = 0.00035;
        for (let n = 1; n <= 12; n++) {
          const fn = f * n * Math.sqrt(1 + B2 * n * n); if (fn > 16000) break;
          const amp = 0.32 / Math.pow(n, 1.25) * (n === 1 ? 1 : 0.9), dec = (4.8 * Math.pow(261.63 / f, 0.35)) / (1 + n * 0.42);
          for (const det of [-0.8, 0.8]) {
            const o = oc.createOscillator(); o.frequency.value = fn; o.detune.value = det;
            const g = oc.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(amp * 0.5, 0.004); g.gain.exponentialRampToValueAtTime(0.0001, Math.min(5.9, dec + 0.05));
            o.connect(g); g.connect(oc.destination); o.start(); o.stop(6);
          }
        }
        const nb = oc.createBuffer(1, oc.sampleRate * 0.03, oc.sampleRate), d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
        const s = oc.createBufferSource(); s.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f * 6; fl.Q.value = 1;
        const g = oc.createGain(); g.gain.value = 0.08; s.connect(fl); fl.connect(g); g.connect(oc.destination); s.start();
      });
    }
    // a harp: plucked string (Karplus-Strong), two registers
    for (const [name, f] of [['harp3', 130.81], ['harp4', 261.63]]) {
      const sr = 44100, len = sr * 4, buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      const N = Math.round(sr / f), ring = new Float32Array(N);
      for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(Math.PI * i / N));
      let idx = 0, prev = 0;
      for (let i = 0; i < len; i++) {
        const cur = ring[idx], nxt = ring[(idx + 1) % N];
        const v = 0.4985 * (cur + nxt);
        ring[idx] = v; d[i] = cur * 0.45; idx = (idx + 1) % N; prev = v;
      }
      for (let i = 0; i < 60; i++) d[i] *= i / 60;
      B[name] = buf;
    }
    for (const k of ['bell', 'swell', 'click', 'crack', 'pno3', 'pno4', 'pno5', 'harp3', 'harp4']) B[k + 'R'] = reversed(this.ctx, B[k]);
  }

  play(name, { rate = 1, gain = 1, pos = null, verb = 0.4, when = 0, at = 0, inst = false } = {}) {
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
    if (inst) node.connect(this.inst);
    else {
      node.connect(this.bus);
      if (verb > 0) { const vg = ctx.createGain(); vg.gain.value = verb; node.connect(vg); vg.connect(this.verbIn); }
    }
    s.start(at || ctx.currentTime + when);
  }

  rndPos(r = 4) {
    const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * 1.2;
    return [Math.cos(a) * r, Math.sin(e) * r, Math.sin(a) * r];
  }

  // ---------------------------------------------------------------- the score
  // one note on an instrument, at an exact audio time
  note(inst, midi, at, gain, pan = 0) {
    const regs = inst === 'pno' ? [[48, 'pno3'], [60, 'pno4'], [72, 'pno5']] : [[48, 'harp3'], [60, 'harp4']];
    let best = regs[0]; for (const r of regs) if (Math.abs(midi - r[0]) < Math.abs(midi - best[0])) best = r;
    const name = best[1] + (this.dir < 0 ? 'R' : '');
    this.play(name, { rate: Math.pow(2, (midi - best[0]) / 12) * this.tape, gain, at, inst: true, pos: [pan * 2.5, 0.3, -1.2] });
    if (this.visualEvents.length < 200) this.visualEvents.push({ at, gain, bass: midi < 50 });
  }

  // a swell that blooms and dies away: never held
  bloom(root, at, strength = 1) {
    const ctx = this.ctx;
    for (const [n, a] of [[root, 1], [root + 7, 0.6], [root + 12, 0.45]]) {
      const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
      f.frequency.setValueAtTime(300, at); f.frequency.linearRampToValueAtTime(1400 + 900 * strength, at + 1.1); f.frequency.exponentialRampToValueAtTime(350, at + 4.2);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.05 * a * strength, at + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, at + 4.6);
      for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n); o.detune.value = det; o.connect(f); o.start(at); o.stop(at + 4.8); }
      f.connect(g); g.connect(this.inst);
    }
  }

  timp(root, gain = 0.7, when = 0) {
    let n = root; while (n > 41) n -= 12; while (n < 33) n += 12;
    this.play('timp', { rate: mtof(n) / 73.42, gain, verb: 0.5, when });
    if (this.ctx) this.visualEvents.push({ at: this.ctx.currentTime + when, gain: 0.5, bass: true });
  }

  // a harp sweep up through the chord
  gliss(at, I) {
    if (!this.cur) return;
    const { root, iv } = this.cur, notes = [];
    for (let o = 12; o <= 36; o += 12) for (const x of iv) notes.push(root + o + x);
    notes.forEach((n, k) => this.note('harp', n, at + k * (0.07 - I * 0.02), 0.22 + I * 0.1, -0.8 + k / notes.length * 1.6));
  }

  // the recurring theme, high on the celesta
  theme(at, I) {
    if (!this.cur) return;
    const { root, iv } = this.cur, all = [];
    for (const o of [24, 36]) for (const x of iv) all.push(root + o + x);
    const ph = THEME[this.themeK++ % THEME.length];
    let t = at;
    for (const [idx, d] of ph) {
      const n = all[Math.min(idx, all.length - 1)];
      this.play(this.dir < 0 ? 'bellR' : 'bell', { rate: mtof(n) / 523.25 * this.tape, gain: 0.13 + I * 0.07, at: t, inst: true, pos: [0.6, 0.6, -1.5] });
      this.visualEvents.push({ at: t, gain: 0.3, bass: false });
      t += d * (1.3 - I * 0.35);
    }
  }

  hit(strength = 1) { // a great moment: timpani, a harp sweep, a swell
    if (!this.ready || !this.cur) return;
    const at = this.ctx.currentTime + 0.05;
    this.boost = Math.min(0.4, this.boost + 0.25 * strength);
    this.timp(this.cur.root, 0.5 + strength * 0.35);
    this.gliss(at + 0.05, Math.min(1, 0.5 + strength * 0.3));
    this.bloom(this.cur.root + 12, at, Math.min(1.4, strength));
  }

  accent() { // a hero line arrives: a shimmer of celesta and a breath of harp
    if (!this.ready || !this.cur) return;
    const at = this.ctx.currentTime + 0.05, { root, iv } = this.cur;
    [0, 1, 2].forEach((k) => this.play('bell', { rate: mtof(root + 36 + iv[k % iv.length]) / 523.25, gain: 0.12, at: at + k * 0.11, inst: true, pos: [(k - 1) * 1.5, 0.8, -1.4] }));
    this.gliss(at + 0.1, 0.4);
  }

  // the arpeggio engine: schedules notes slightly ahead on the audio clock
  schedule(now, I, st) {
    while (this.nextNote < now + 0.3) {
      const at = Math.max(this.nextNote, now + 0.02);
      if (this.step >= this.stepsInChord) {
        const prog = PROG[this.mood] || PROG[0];
        const [root, q] = prog[this.ci % prog.length]; this.ci++;
        this.cur = { root, iv: IV[q] };
        this.step = 0; this.stepsInChord = I > 0.62 ? 16 : 8; this.chordCount++;
        this.pattern = PATTERNS[(this.mood + this.ci) % PATTERNS.length];
        if (I > 0.28 && this.chordCount % 2 === 0) this.theme(at + 0.4, I);
        if (I > 0.78) this.bloom(root + 12, at, (I - 0.7) * 2.5);
        if (I > 0.85 && this.chordCount % 2 === 1) this.timp(root, 0.35 + (I - 0.85) * 2);
      }
      const { root, iv } = this.cur, k = this.step, stepDur = (0.46 - I * 0.17) / this.tempo;
      const tones = []; for (const o of [12, 24]) for (const x of iv) tones.push(root + o + x); tones.push(root + 36);
      // the bass, struck at the top of each chord
      if (k === 0) { this.note('pno', root, at, 0.32 + I * 0.12, -0.3); if (I > 0.7) this.note('pno', root - 12, at, 0.22, -0.3); }
      if (k === 8 && I > 0.62) this.note('pno', root + 7, at, 0.2, -0.2);
      // the flowing figure; calm passages leave gaps
      const idx = this.pattern[k % this.pattern.length];
      const quiet = I < 0.45 && (k % 2 === 1) && Math.random() < 0.55;
      if (idx >= 0 && !quiet) {
        const n = tones[Math.min(idx, tones.length - 1)], accent = k % 4 === 0 ? 1.25 : 1;
        this.note('pno', n, at, (0.12 + I * 0.1) * accent, -0.4 + (idx / tones.length) * 0.9);
        if (I > 0.74) this.note('pno', n + 12, at, (0.05 + (I - 0.74) * 0.25) * accent, 0.4);
      }
      this.step++;
      this.nextNote = at + stepDur + (this.step >= this.stepsInChord && I < 0.42 && Math.random() < 0.4 ? stepDur * 2 : 0);
    }
  }

  windup(secs) {
    let t = 0, k = 0;
    while (t < secs) { this.play('ratchet', { rate: 0.8 + k * 0.02, gain: 0.3 + t / secs * 0.45, verb: 0.15, when: t }); const step = Math.max(0.05, 0.22 * (1 - t / secs)); t += step; k++; }
  }

  boom() {
    this.play('boom', { gain: 1, verb: 0.8 });
    this.play('click', { rate: 0.5, gain: 1.1, verb: 1 });
    this.running = true; this.nextNote = this.ctx ? this.ctx.currentTime + 0.6 : 0; this.step = 99;
  }

  setMuted(m) {
    this.muted = m;
    if (this.ready) this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.2);
  }

  update(dt, st) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // music keeps time on the audio clock, not the animation frame rate
    const adt = this.lastNow ? Math.min(0.5, Math.max(0, now - this.lastNow)) : dt; this.lastNow = now;
    dt = adt; this.t += dt;
    const v = st.vel, av = Math.min(Math.abs(v), 40), rev = v < -0.25;
    this.boost *= Math.exp(-dt * 0.25);
    const I = Math.min(1, st.intensity + this.boost + Math.min(av, 12) * 0.012);

    // the score
    const bendC = Math.max(-500, Math.min(500, v * 16));
    this.tape = Math.pow(2, bendC / 1200);
    this.tempo = 1 + Math.min(av, 10) * 0.06;
    if (this.running && !st.freeze) {
      if (st.mood !== this.mood) {
        const forward = st.mood > this.mood, first = this.mood < 0;
        this.mood = st.mood; this.ci = 0; this.step = 99;
        if (!first) this.nextNote = Math.min(this.nextNote || now, now + 0.15);
        if (forward && !first) setTimeout(() => this.hit(0.6), 250);
      }
      if (!this.nextNote || this.nextNote < now - 1) this.nextNote = now + 0.05;
      this.schedule(now, I, st);
    } else if (st.freeze) this.nextNote = now + 0.4;
    this.mfilt.frequency.setTargetAtTime(st.freeze ? 1000 : 18000, now, st.freeze ? 0.3 : 0.08);

    const B = this.beds, set = (b, x, tc = 0.4) => b.g.gain.setTargetAtTime(x, now, tc);
    set(B.rain, st.rain * 0.45); set(B.rainLow, st.rain * 0.3);
    set(B.rumble, st.rumble * 0.8); set(B.fire, st.fire * 0.3);
    set(B.wind, Math.min(0.4, Math.max(0, av - 2) * 0.025), 0.1);
    B.wind.fl.frequency.setTargetAtTime(300 + av * 110, now, 0.1);

    const dir = v < -0.6 ? -1 : v > 0.6 ? 1 : this.dir;
    if (dir !== this.dir) { if (dir < 0) this.play('swellR', { gain: 0.4, verb: 0.6 }); this.dir = dir; }

    // rare sparkles, more when you fly
    this.nextSparkle -= dt * (0.05 + av * 0.1) * st.bells;
    if (this.nextSparkle <= 0 && this.cur && !st.freeze) {
      this.nextSparkle = 1 + Math.random() * 2;
      const iv = this.cur.iv, n = this.cur.root + 36 + iv[Math.floor(Math.random() * iv.length)];
      this.play(rev ? 'bellR' : 'bell', { rate: mtof(n) / 523.25, gain: 0.1 + Math.random() * 0.06, pos: this.rndPos(3 + Math.random() * 3), verb: 1 });
    }
    if (st.fire > 0.1 && Math.random() < st.fire * dt * 12) this.play('ratchet', { rate: 0.4 + Math.random() * 0.6, gain: 0.2 * st.fire, pos: this.rndPos(2), verb: 0.1 });
    if (st.blips > 0 && Math.random() < st.blips * dt * 3) this.play('blip', { rate: 0.6 + Math.random() * 0.6, gain: 0.18, pos: this.rndPos(3), verb: 0.4 });
    if (st.shutters > 0 && Math.random() < st.shutters * dt * 5) this.play('click', { rate: 0.8 + Math.random() * 0.5, gain: 0.3, pos: this.rndPos(2 + Math.random() * 6), verb: 0.25 });
    if (st.glitch > 0 && Math.random() < st.glitch * dt * 2) this.play('blip', { rate: 0.3 + Math.random() * 0.3, gain: 0.22, pos: this.rndPos(2), verb: 0.1 });
    if (st.walk > 0) {
      const step = Math.floor(st.flow / 0.55);
      if (step !== this.lastStep) { this.lastStep = step; this.play('thump', { rate: 0.9 + Math.random() * 0.2, gain: 0.4 * st.walk, pos: [(step % 2 ? 0.4 : -0.4), -1.5, 0.5], verb: 0.2 }); }
    }
  }
}
