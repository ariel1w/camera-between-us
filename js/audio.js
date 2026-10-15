// The score and sound design, all synthesized live in the browser.
// A composed score: every section has its own chord progression, played by
// strings, a choir and (at the big moments) brass and timpani, with a sparse
// recurring theme on a harp-like voice. Chords breathe in and out instead of
// droning, and the whole piece builds to a majestic D major at the end.

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
    this.live = []; this.boost = 0; this.nextSparkle = 2; this.themeK = 0; this.chordCount = 0;
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

    // orchestra buses
    const bus = (filterType, f, q, verbAmt) => {
      const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 1; fl.connect(g); g.connect(this.bus);
      const s = ctx.createGain(); s.gain.value = verbAmt; g.connect(s); s.connect(this.verbIn);
      return { in: fl, fl, g };
    };
    this.strings = bus('lowpass', 1400, 0.5, 0.9);
    this.choir = bus('highpass', 180, 0.5, 1.1);
    this.brass = bus('lowpass', 3500, 0.4, 0.6);
    this.basses = bus('lowpass', 420, 0.6, 0.35);
    // a gentle shared vibrato, like a section of players
    this.vib = ctx.createOscillator(); this.vib.frequency.value = 4.6;
    this.vibG = ctx.createGain(); this.vibG.gain.value = 6; this.vib.connect(this.vibG); this.vib.start();

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
      projector: bed('bandpass', 1500, 2),
    };
    const flut = ctx.createOscillator(); flut.type = 'square'; flut.frequency.value = 18;
    const fg = ctx.createGain(); fg.gain.value = 0.5; flut.connect(fg);
    this.projAM = ctx.createGain(); this.projAM.gain.value = 0.5; fg.connect(this.projAM.gain); flut.start();
    this.beds.projector.g.disconnect(); this.beds.projector.g.connect(this.projAM); this.projAM.connect(this.bus);

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

  // ---------------------------------------------------------------- orchestra
  voice(dest, type, freq, t0, att, hold, rel, peak, detunes, extra) {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + att);
    g.gain.setValueAtTime(peak, t0 + att + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + hold + rel);
    let into = g;
    if (extra) into = extra(g);
    const end = t0 + att + hold + rel + 0.1;
    for (const dt of detunes) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = dt;
      this.vibG.connect(o.detune);
      o.connect(into); o.start(t0); o.stop(end);
      this.live.push({ o, base: dt, end });
    }
    g.connect(dest);
  }

  formants(g) { // a sung "ah"
    const ctx = this.ctx, mix = ctx.createGain(); mix.gain.value = 1;
    for (const [f, q, a] of [[730, 7, 1], [1090, 9, 0.55], [2440, 12, 0.25]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const ga = ctx.createGain(); ga.gain.value = a * 2.4; bp.connect(ga); ga.connect(g); mix.connect(bp);
    }
    return mix;
  }

  playChord(chord, dur, I) {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05, [root, q] = chord, iv = IV[q];
    const att = 2.4 - I * 1.3, rel = 3.8, hold = Math.max(0.5, dur - att * 0.5);
    const tones = iv.map(x => root + 12 + x);
    this.cur = { root, tones };
    // basses: the root, felt underneath
    this.voice(this.basses.in, 'triangle', mtof(root), t0, att, hold, rel, 0.11 + I * 0.07, [0, 5], null);
    // strings: open voicing, three players per note
    const sv = [tones[0], tones[2] !== undefined ? tones[2] : tones[1], tones[1] + 12, ...(tones[3] !== undefined ? [tones[3] + (tones[3] - root > 18 ? 0 : 12)] : [])];
    sv.forEach((n, k) => this.voice(this.strings.in, 'sawtooth', mtof(n), t0 + k * 0.05, att, hold, rel, (0.022 + I * 0.018), [-9, 0, 8], null));
    if (I > 0.82) this.voice(this.strings.in, 'sawtooth', mtof(root + 36), t0, att * 1.4, hold, rel, 0.012 * (I - 0.7) * 6, [-6, 6], null);
    // choir joins as the story opens up
    if (I > 0.42) {
      const ci = Math.min(1, (I - 0.42) / 0.4);
      [root + 24, root + 24 + iv[1], root + 24 + iv[2]].forEach((n, k) => this.voice(this.choir.in, 'sawtooth', mtof(n), t0 + 0.3 + k * 0.1, att * 1.2, hold, rel, 0.02 * ci, [-7, 7], g => this.formants(g)));
    }
    // brass for the great moments: filter opens like a breath through a horn
    if (I > 0.7) {
      const bi = Math.min(1, (I - 0.7) / 0.25);
      for (const n of [root + 12, root + 19]) {
        this.voice(this.brass.in, 'sawtooth', mtof(n), t0 + 0.2, att, hold * 0.8, rel, 0.03 * bi, [-5, 5], g => {
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1;
          f.frequency.setValueAtTime(250, t0); f.frequency.linearRampToValueAtTime(700 + 1600 * bi, t0 + att + 0.3); f.frequency.exponentialRampToValueAtTime(400, t0 + att + hold + rel);
          f.connect(g); return f;
        });
      }
      if (Math.random() < 0.5 + bi * 0.5) this.timp(root, 0.5 + bi * 0.4);
    }
    this.chordCount++;
    // the theme, softly, every other chord
    if (I > 0.28 && this.chordCount % 2 === 0) this.theme(I);
  }

  timp(root, gain = 0.7, when = 0) {
    let n = root; while (n > 41) n -= 12; while (n < 33) n += 12;
    this.play('timp', { rate: mtof(n) / 73.42, gain, verb: 0.5, when });
  }

  theme(I) {
    if (!this.cur) return;
    const tones = this.cur.tones, all = [...tones, ...tones.map(x => x + 12)];
    const ph = THEME[this.themeK++ % THEME.length];
    let t = 0.6;
    for (const [idx, d] of ph) {
      const n = all[Math.min(idx, all.length - 1)] + 12;
      this.play(this.dir < 0 ? 'bellR' : 'bell', { rate: mtof(n) / 523.25, gain: 0.16 + I * 0.08, pos: [Math.sin(this.t) * 1.5, 0.5, -1.5], verb: 1.1, when: t });
      t += d * (1.25 - I * 0.3);
    }
  }

  hit(strength = 1) { // a dramatic accent: timpani and a swell
    if (!this.ready) return;
    this.boost = Math.min(0.45, this.boost + 0.3 * strength);
    if (this.cur) this.timp(this.cur.root, 0.6 + strength * 0.4);
    this.chordT = Math.min(this.chordT, 0.2);
  }

  windup(secs) {
    let t = 0, k = 0;
    while (t < secs) { this.play('ratchet', { rate: 0.8 + k * 0.02, gain: 0.3 + t / secs * 0.45, verb: 0.15, when: t }); const step = Math.max(0.05, 0.22 * (1 - t / secs)); t += step; k++; }
  }

  boom() {
    this.play('boom', { gain: 1, verb: 0.8 });
    this.play('click', { rate: 0.5, gain: 1.1, verb: 1 });
    this.running = true; this.chordT = 0.4;
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

    // the score: a new chord when one has breathed its length
    if (this.running && !st.freeze) {
      if (st.mood !== this.mood) {
        const forward = st.mood > this.mood;
        this.mood = st.mood; this.ci = 0;
        if (forward && this.mood > 0) this.hit(0.6);
        this.chordT = Math.min(this.chordT, 0.3);
      }
      this.chordT -= dt * (1 + Math.min(av, 10) * 0.08);
      if (this.chordT <= 0) {
        const prog = PROG[this.mood] || PROG[0];
        const chord = prog[this.ci % prog.length]; this.ci++;
        const dur = (this.mood === 15 ? 5.6 : 7.2) - I * 1.4;
        this.playChord(chord, dur, I);
        // calm passages leave a breath of air between chords
        this.chordT = dur + (I < 0.45 && Math.random() < 0.35 ? 1.6 : 0);
      }
    }
    // the orchestra opens up with intensity
    this.strings.fl.frequency.setTargetAtTime((st.freeze ? 500 : 900 + I * 2600 + av * 60), now, 0.4);
    this.strings.g.gain.setTargetAtTime(0.75 + I * 0.4, now, 0.5);
    this.mfilt.frequency.setTargetAtTime(st.freeze ? 1000 : 18000, now, st.freeze ? 0.3 : 0.08);

    // tape speed: fast scrolling bends the orchestra, rewinding wobbles it
    const bend = Math.max(-600, Math.min(600, v * 18)) + (rev ? Math.sin(this.t * 6) * 30 : 0);
    if (this.live.length) {
      const keep = [];
      for (const L of this.live) if (L.end > now) { L.o.detune.setTargetAtTime(L.base + bend, now, 0.15); keep.push(L); }
      this.live = keep;
    }

    const B = this.beds, set = (b, x, tc = 0.4) => b.g.gain.setTargetAtTime(x, now, tc);
    set(B.rain, st.rain * 0.45); set(B.rainLow, st.rain * 0.3);
    set(B.rumble, st.rumble * 0.8); set(B.fire, st.fire * 0.3); set(B.projector, st.projector * 0.06);
    set(B.wind, Math.min(0.4, Math.max(0, av - 2) * 0.025), 0.1);
    B.wind.fl.frequency.setTargetAtTime(300 + av * 110, now, 0.1);

    const dir = v < -0.6 ? -1 : v > 0.6 ? 1 : this.dir;
    if (dir !== this.dir) { if (dir < 0) this.play('swellR', { gain: 0.4, verb: 0.6 }); this.dir = dir; }

    // rare sparkles, more when you fly
    this.nextSparkle -= dt * (0.12 + av * 0.1) * st.bells;
    if (this.nextSparkle <= 0 && this.cur && !st.freeze) {
      this.nextSparkle = 1 + Math.random() * 2;
      const tones = this.cur.tones, n = tones[Math.floor(Math.random() * tones.length)] + 24;
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
