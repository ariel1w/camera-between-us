// The sound: a living world of air, wind, birds and scattered magic, with
// music that ARRIVES with the story and leaves again. Recorded phrases (Gemini)
// swell in at section openings, hero lines and the great turns, play their
// moment, then dissolve back into the air. Neil's lines tint the music warm,
// Lumen's glassy. Scrolling bends a phrase like tape. Only the finale plays on.

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

// which recorded piece plays in each section
const CUE_FILES = { cosmic: 'c-cosmic', deep: 'c-deep', soar: 'c-soar', celesta: 'c-celesta', pianoB: 'c-piano-b', space: 'c-space', strings: 'c-strings', finale: 'c-finale' };
const CUE_OF = ['cosmic', 'soar', 'celesta', 'cosmic', 'deep', 'space', 'deep', 'soar', 'pianoB', 'strings', 'cosmic', 'deep', 'space', 'soar', 'celesta', 'finale'];
const CUE_GAIN = { cosmic: 0.5, deep: 0.5, soar: 0.5, celesta: 0.8, pianoB: 0.9, space: 0.85, strings: 0.9, finale: 1.0 };
// segments of hits.mp3: three orchestral strikes and a long climax build
const HITS = [[0, 4.0], [4.0, 3.55], [7.55, 3.55]], CLIMAX = [11.1, 16.5];

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
    this.buf = {};
    this.ready = false; this.muted = false; this.t = 0; this.lastStep = 0; this.dir = 1;
    this.running = false; this.mood = -1; this.ci = 0; this.chordT = 0; this.cur = null;
    this.hitK = 0; this.phraseAt = {}; this.phraseEnd = 0; this.quietUntil = 0; this.who = 'N'; this.boost = 0; this.nextSparkle = 2; this.themeK = 0; this.chordCount = 0; this.visualEvents = [];
    this.tape = 1; this.tempo = 1; this.nextNote = 0; this.step = 99; this.stepsInChord = 8; this.pattern = [0];
  }

  init() { return this._init || (this._init = this._doInit()); }

  async _doInit() {
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
    // all beds pass one gain and filter, so the world can step back and lose its hiss while a voice speaks
    this.bedBus = ctx.createGain(); this.bedBus.gain.value = 1;
    this.bedFilt = ctx.createBiquadFilter(); this.bedFilt.type = 'lowpass'; this.bedFilt.frequency.value = 20000; this.bedFilt.Q.value = 0.5;
    this.bedBus.connect(this.bedFilt); this.bedFilt.connect(this.bus);
    const bed = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true; src.start(0, Math.random() * 4);
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(this.bedBus);
      return { g, fl };
    };
    this.beds = {
      rain: bed('bandpass', 2600, 0.4),
      rainLow: bed('lowpass', 500, 0.5),
      rumble: bed('lowpass', 85, 1.2),
      wind: bed('bandpass', 600, 1.4),
      fire: bed('lowpass', 900, 0.6),
      air: bed('bandpass', 650, 0.6),
      airHi: bed('highpass', 6500, 0.5),
    };
    this.gust = 0; this.gustT = 0; this.nextBird = 3; this.nextCricket = 0;
    // the recorded score
    // the music sits UNDER the sound of the world: effects lead, music carries
    this.musicLevel = 0.42;
    this.music = ctx.createGain(); this.music.gain.value = this.musicLevel;
    // the voice of the moment colours the music: Neil warm and close, Lumen glassy and high
    this.toneLo = ctx.createBiquadFilter(); this.toneLo.type = 'lowshelf'; this.toneLo.frequency.value = 250;
    this.toneHi = ctx.createBiquadFilter(); this.toneHi.type = 'highshelf'; this.toneHi.frequency.value = 3500;
    this.music.connect(this.toneLo); this.toneLo.connect(this.toneHi); this.toneHi.connect(this.bus);
    const mv = ctx.createGain(); mv.gain.value = 0.18; this.music.connect(mv); mv.connect(this.verbIn);
    // SPACE: the recorded music floats in a huge dark hall, with echoes drifting left and right
    this.cosmos = ctx.createConvolver(); this.cosmos.buffer = makeIR(ctx, 9, 2.2);
    const pre = ctx.createDelay(1); pre.delayTime.value = 0.09;
    const cHi = ctx.createBiquadFilter(); cHi.type = 'highpass'; cHi.frequency.value = 280;
    this.spaceSend = ctx.createGain(); this.spaceSend.gain.value = 0.35;
    this.music.connect(this.spaceSend); this.spaceSend.connect(cHi); cHi.connect(pre); pre.connect(this.cosmos);
    const cOut = ctx.createGain(); cOut.gain.value = 0.5; this.cosmos.connect(cOut); cOut.connect(this.mfilt);
    // ping-pong echoes, darker on each bounce, slowly wavering like light through water
    const dl = ctx.createDelay(2), dr = ctx.createDelay(2); dl.delayTime.value = 0.43; dr.delayTime.value = 0.65;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const dF = ctx.createBiquadFilter(); dF.type = 'lowpass'; dF.frequency.value = 3200;
    const mL = ctx.createChannelMerger(2), eIn = ctx.createGain(); eIn.gain.value = 0.14;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.11; lfoG.gain.value = 0.004; lfo.connect(lfoG); lfoG.connect(dl.delayTime); lfoG.connect(dr.delayTime); lfo.start();
    this.music.connect(eIn); eIn.connect(dl); dl.connect(dF); dF.connect(dr); dr.connect(fb); fb.connect(dl);
    dl.connect(mL, 0, 0); dr.connect(mL, 0, 1);
    const eOut = ctx.createGain(); eOut.gain.value = 0.55; mL.connect(eOut); eOut.connect(this.mfilt); eOut.connect(this.cosmos);
    this.an = ctx.createAnalyser(); this.an.fftSize = 1024; this.an.smoothingTimeConstant = 0.5; this.music.connect(this.an);
    this.fbuf = new Uint8Array(this.an.frequencyBinCount); this.avgB = 0; this.avgT = 0;
    this.cues = {};
    for (const [k, f] of Object.entries(CUE_FILES)) {
      const el = new Audio('audio/' + f + '.mp3?v=27');
      el.preload = 'auto'; el.loop = false; el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false;
      el.crossOrigin = 'anonymous';
      const src = ctx.createMediaElementSource(el), g = ctx.createGain(); g.gain.value = 0;
      src.connect(g); g.connect(this.music);
      this.cues[k] = { el, g, on: false, quietSince: 0 };
      // unlock each player inside the click (phones need this)
      el.muted = true; el.play().then(() => { el.muted = false; if (this.cue !== k || !this.running || this.muted) el.pause(); }).catch(() => { el.muted = false; });
    }
    this.cue = null;
    fetch('audio/hits.mp3?v=27').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { this.buf.hits = buf; this.buf.hitsR = reversed(ctx, buf); }).catch(() => {});

    await this.renderOneShots();
    this.out.gain.setTargetAtTime(this.muted ? 0 : 0.9, ctx.currentTime, 0.8);
    this.ready = true;
  }

  async renderOneShots() {
    const B = this.buf = this.buf || {};
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
    // birds: little FM chirps and trills, a few different songs
    for (let v = 0; v < 4; v++) {
      B['bird' + v] = await render(1.4, oc => {
        const n = 2 + Math.floor(Math.random() * 5), base = 2600 + Math.random() * 1800, gap = 0.07 + Math.random() * 0.09;
        for (let k = 0; k < n; k++) {
          const t0 = k * gap, d = 0.04 + Math.random() * 0.06, o = oc.createOscillator(), m = oc.createOscillator(), mg = oc.createGain();
          const f0 = base * (0.85 + Math.random() * 0.3), f1 = f0 * (v % 2 ? 1.5 : 0.7);
          o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + d);
          m.frequency.value = 40 + Math.random() * 60; mg.gain.value = f0 * 0.04; m.connect(mg); mg.connect(o.frequency);
          const g = oc.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.25, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
          o.connect(g); g.connect(oc.destination); o.start(t0); m.start(t0); o.stop(t0 + d + 0.02); m.stop(t0 + d + 0.02);
        }
      });
    }
    B.cricket = await render(0.5, oc => {
      for (let k = 0; k < 4; k++) {
        const t0 = k * 0.045, o = oc.createOscillator(); o.frequency.value = 4400;
        const g = oc.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
        o.connect(g); g.connect(oc.destination); o.start(t0); o.stop(t0 + 0.04);
      }
    });
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

  // a recorded orchestral strike for the great moments
  hit(strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, at = ctx.currentTime + 0.03;
    if (this.buf.hits) {
      const [off, dur] = HITS[this.hitK++ % HITS.length];
      const s = ctx.createBufferSource(); s.buffer = this.buf.hits;
      const g = ctx.createGain(); g.gain.value = Math.min(0.7, 0.28 + strength * 0.22);
      s.connect(g); g.connect(this.bus); const vg = ctx.createGain(); vg.gain.value = 0.35; g.connect(vg); vg.connect(this.verbIn);
      s.start(at, off, dur);
      this.duck(0.55, 1.6);
    } else this.timp(50, 0.5 + strength * 0.4);
    this.visualEvents.push({ at, gain: 0.5 + strength * 0.2, bass: true });
  }

  // the long climb of the orchestra, for the biggest moments
  climax() {
    if (!this.ready || !this.buf.hits) return this.hit(1.5);
    const ctx = this.ctx, at = ctx.currentTime + 0.03, [off, dur] = CLIMAX;
    const s = ctx.createBufferSource(); s.buffer = this.buf.hits;
    const g = ctx.createGain(); g.gain.value = 0.6; s.connect(g); g.connect(this.bus);
    s.start(at, off, dur);
    this.duck(0.35, dur * 0.9);
    for (let k = 0; k < 8; k++) this.visualEvents.push({ at: at + 8 + k * 0.9, gain: 0.5, bass: true });
  }

  // MUSIC ARRIVES WITH THE STORY. kind: 'section' (a new chapter opens),
  // 'hero' (a great line), 'finale' (the last piece, plays to the end)
  phrase(kind, key) {
    if (!this.ready || !this.running || !this.cues || this.muted) return;
    const now = this.ctx.currentTime, playing = this.cue && now < this.phraseEnd;
    if (kind === 'finale') key = 'finale';
    else if (this.cue === 'finale' && playing) return;
    key = key || CUE_OF[Math.max(0, this.mood)] || 'cosmic';
    const dur = kind === 'finale' ? 1e9 : kind === 'section' ? 8.5 + Math.random() * 1.5 : 7;
    if (playing && kind === 'hero') { this.phraseEnd = Math.min(this.phraseStart + 10, Math.max(this.phraseEnd, now + 5)); return; } // a phrase never runs past 10 s
    if (kind !== 'finale' && now < this.quietUntil) return; // at least 30 s of air and nature between phrases
    const c = this.cues[key];
    if (key !== this.cue || !playing) {
      const D = c.el.duration;
      if (kind === 'finale') c.el.currentTime = 0;
      else if (D > 50) {
        // start somewhere new in the piece each time, never near its end
        const at = ((this.phraseAt[key] ?? Math.random() * D * 0.5) + 37) % (D - dur - 6);
        this.phraseAt[key] = at; c.el.currentTime = at;
      }
      c.g.gain.cancelScheduledValues(now); c.g.gain.setValueAtTime(0, now);
    }
    if (key !== this.cue || !playing) this.phraseStart = now;
    this.cue = key; this.phraseEnd = kind === 'finale' ? now + dur : Math.min(now + dur, this.phraseStart + 10); this.phraseKind = kind;
    this.tryPlay(c);
  }

  voice(who) { this.who = who; }

  tryPlay(c) {
    if (!c || c.pending || this.muted || c.el.ended) return;
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (c.blocked || now < (c.retryAt || 0)) return;
    c.pending = true;
    c.el.play().then(() => { c.pending = false; c.blocked = false; })
      .catch(e => { c.pending = false; if (e && e.name === 'NotAllowedError') c.blocked = true; else c.retryAt = (this.ctx ? this.ctx.currentTime : 0) + 3; });
  }

  // called inside any tap or key: phones only allow playback from a gesture
  unlock() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const c = this.cues && this.cues[this.cue];
    if (c && c.el.paused && !c.el.ended && !this.muted) { c.blocked = false; c.pending = true; c.el.play().then(() => { c.pending = false; }).catch(() => { c.pending = false; c.blocked = true; }); }
  }

  // leaving the tab: everything stops together; coming back: everything resumes together
  sleep(hidden) {
    if (!this.ctx) return;
    const c = this.cues && this.cues[this.cue];
    if (hidden) { this.wasPlaying = c && !c.el.paused; if (c) c.el.pause(); this.ctx.suspend(); }
    else { this.ctx.resume(); if (c && this.wasPlaying) this.tryPlay(c); }
  }

  // music steps back for a moment
  // voice over on: the noise beds sit lower and darker, so under a voice they read as a place, not as tape hiss
  voiceBed(on) {
    if (!this.ready || this.bedOn === on) return;
    this.bedOn = on; const now = this.ctx.currentTime;
    this.bedBus.gain.setTargetAtTime(on ? 0.3 : 1, now, 0.6);
    this.bedFilt.frequency.setTargetAtTime(on ? 2200 : 20000, now, 0.6);
  }

  duck(level, secs, ease = 0.08) {  // ease: how gently the music steps back (time constant, seconds)
    const now = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(now);
    this.music.gain.setTargetAtTime(level * this.musicLevel, now, ease);
    this.music.gain.setTargetAtTime(this.musicLevel, now + secs, 0.8);
  }

  accent() { // a hero line arrives: three high celesta notes in E flat
    if (!this.ready) return;
    const at = this.ctx.currentTime + 0.05;
    [75, 79, 82].forEach((n, k) => this.play('bell', { rate: mtof(n) / 523.25, gain: 0.1, at: at + k * 0.12, inst: true, pos: [(k - 1) * 1.5, 0.8, -1.4] }));
    this.visualEvents.push({ at, gain: 0.35, bass: false });
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
    this.running = true; this.mood = 0;
    setTimeout(() => this.phrase('section', CUE_OF[0]), 2500);
  }

  setMuted(m) {
    this.muted = m;
    if (this.cues) for (const c of Object.values(this.cues)) { if (m) c.el.pause(); }
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

    // the music: phrases that arrive with the story and dissolve back into the air
    if (this.running && this.cues) {
      if (st.mood !== this.mood) {
        const forward = st.mood > this.mood, step = st.mood - this.mood;
        this.mood = st.mood;
        if (this.cue === 'finale' && st.mood < 15) this.phraseEnd = now; // left the finale
        if (forward && step === 1) { setTimeout(() => this.hit(0.5), 200); setTimeout(() => this.phrase('section'), 900); }
      }
      const live = this.cue && now < this.phraseEnd;
      if (this.cue && !live && this.wasLive) this.quietUntil = now + 30;
      this.wasLive = live;
      const rev = v < -0.6;
      let rate = rev ? 0.72 : 1 + Math.max(-0.2, Math.min(0.5, v * 0.025));
      if (st.freeze) rate = 0.9;
      for (const [k, c] of Object.entries(this.cues)) {
        const on = k === this.cue && live;
        const target = on ? CUE_GAIN[k] * (rev ? 0.45 : 1) * (st.freeze ? 0.5 : 1) * (st.credits && k === 'finale' ? 0.55 : 1) : 0;
        c.g.gain.setTargetAtTime(target, now, on ? 0.6 : 1.1);
        if (on) {
          if (Math.abs(c.el.playbackRate - rate) > 0.02) c.el.playbackRate = c.el.playbackRate + (rate - c.el.playbackRate) * 0.5;
          c.quietSince = 0;
          if (c.el.paused) this.tryPlay(c);
        } else if (!c.el.paused) {
          c.quietSince = c.quietSince || now;
          if (now - c.quietSince > 9) c.el.pause();
        }
      }
      // Neil warm and close, Lumen glassy and high (only shapes the music while it plays)
      const L = this.who === 'L';
      this.toneLo.gain.setTargetAtTime(L ? -5 : 2, now, 1.2);
      this.toneHi.gain.setTargetAtTime(L ? 3 : -6, now, 1.2);
      // the music's own pulse drives the picture: bass and treble onsets
      this.an.getByteFrequencyData(this.fbuf);
      let lo = 0, hi = 0;
      for (let i = 1; i < 12; i++) lo += this.fbuf[i];
      for (let i = 60; i < 200; i++) hi += this.fbuf[i];
      lo /= 11 * 255; hi /= 140 * 255;
      if (lo > this.avgB * 1.18 + 0.03) this.visualEvents.push({ at: now, gain: Math.min(0.6, (lo - this.avgB) * 2.2), bass: true });
      if (hi > this.avgT * 1.25 + 0.02) this.visualEvents.push({ at: now, gain: Math.min(0.5, (hi - this.avgT) * 3), bass: false });
      this.avgB += (lo - this.avgB) * Math.min(1, dt * 2); this.avgT += (hi - this.avgT) * Math.min(1, dt * 2);
    }
    this.mfilt.frequency.setTargetAtTime(st.freeze ? 1000 : 18000, now, st.freeze ? 0.3 : 0.08);

    const B = this.beds, set = (b, x, tc = 0.4) => b.g.gain.setTargetAtTime(x, now, tc);
    set(B.rain, st.rain * 0.45); set(B.rainLow, st.rain * 0.3);
    set(B.rumble, st.rumble * 0.8); set(B.fire, st.fire * 0.3);
    set(B.wind, Math.min(0.4, Math.max(0, av - 2) * 0.025), 0.1);
    // the air: never still, gusts come and go; it steps back when music plays
    this.gustT -= dt;
    if (this.gustT <= 0) { this.gustT = 3 + Math.random() * 7; this.gustTo = Math.random() < 0.35 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.3; }
    this.gust += ((this.gustTo || 0) - this.gust) * Math.min(1, dt * 0.35);
    const musicOn = this.cue && now < this.phraseEnd, airK = (musicOn ? 0.55 : 1) * (st.credits ? 0.3 : 1) * (st.air == null ? 1 : st.air);
    set(B.air, (0.006 + this.gust * 0.016) * airK, 0.6); set(B.airHi, (0.0012 + this.gust * 0.0035) * airK, 0.6); // a whisper under everything
    B.air.fl.frequency.setTargetAtTime(420 + this.gust * 700 + av * 25, now, 0.8);
    // birds far and near
    if (st.birds > 0 && !st.freeze) {
      this.nextBird -= dt * st.birds;
      if (this.nextBird <= 0) {
        this.nextBird = 1.2 + Math.random() * 4.5;
        const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 9;
        this.play('bird' + Math.floor(Math.random() * 4), { rate: 0.85 + Math.random() * 0.3, gain: 0.1 + Math.random() * 0.12, pos: [Math.cos(a) * r, 1 + Math.random() * 3, Math.sin(a) * r], verb: 0.25 });
      }
    }
    if (st.crickets > 0) {
      this.nextCricket -= dt;
      if (this.nextCricket <= 0) { this.nextCricket = 0.5 + Math.random() * 0.9; this.play('cricket', { rate: 0.95 + Math.random() * 0.1, gain: 0.05 * st.crickets, pos: this.rndPos(5 + Math.random() * 5), verb: 0.2 }); }
    }
    B.wind.fl.frequency.setTargetAtTime(300 + av * 110, now, 0.1);

    // stars of sound: struck bells drifting around your head, in the music's key
    this.nextSparkle -= dt * (0.25 + av * 0.08) * (st.bells == null ? 1 : st.bells);
    if (this.running && this.nextSparkle <= 0 && !st.freeze && !st.credits) {
      this.nextSparkle = 2.5 + Math.random() * 4;
      const PENT = [63, 65, 67, 70, 72, 75, 77, 79, 82, 84], n = PENT[Math.floor(Math.random() * PENT.length)];
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 5;
      this.play(rev ? 'bellR' : 'bell', { rate: mtof(n) / 523.25, gain: 0.05 + Math.random() * 0.05, pos: [Math.cos(a) * r, (Math.random() - 0.3) * 3, Math.sin(a) * r], verb: 1.2 });
    }

    const dir = v < -0.6 ? -1 : v > 0.6 ? 1 : this.dir;
    if (dir !== this.dir) { if (dir < 0) this.play('swellR', { gain: 0.4, verb: 0.6 }); this.dir = dir; }

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
