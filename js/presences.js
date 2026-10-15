// The two voices, drawn live: Neil is a lens (a gold focus ring and a six
// blade iris that opens when he speaks); Lumen is a being of light (a white
// core, an anamorphic flare, slow rays, orbiting photons, ripples of light).
const TAU = Math.PI * 2;

export class Presence {
  constructor(canvas, kind) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.kind = kind;
    this.act = 0; this.ripples = []; this.lastPulse = 0; this.spin = 0;
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    this.w = Math.max(2, Math.round(r.width * d)); this.h = Math.max(2, Math.round(r.height * d));
    this.cv.width = this.w; this.cv.height = this.h; this.d = d;
  }
  draw(t, dt, speaking, pulse) {
    if (!this.w) return;
    this.act += ((speaking ? 1 : 0.18) - this.act) * Math.min(1, dt * 3.5);
    this.spin += dt * (0.15 + this.act * 0.6);
    if (speaking && pulse > this.lastPulse + 0.25) this.ripples.push({ r: 0, a: 1 });
    this.lastPulse = pulse * 0.92;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.w, this.h);
    g.translate(this.w / 2, this.h / 2); const s = this.w / 120; g.scale(s, s);
    if (this.kind === 'N') this.neil(g, t, pulse); else this.lumen(g, t, pulse);
    // ripples of light on the beats of the music
    for (const rp of this.ripples) { rp.r += dt * 60; rp.a -= dt * 0.9; }
    this.ripples = this.ripples.filter(r => r.a > 0);
    g.globalCompositeOperation = 'lighter';
    for (const rp of this.ripples) {
      g.beginPath(); g.arc(0, 0, 22 + rp.r, 0, TAU);
      g.strokeStyle = this.kind === 'N' ? `rgba(240,200,120,${rp.a * 0.5})` : `rgba(150,210,255,${rp.a * 0.6})`;
      g.lineWidth = 1.2; g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }

  neil(g, t, pulse) {
    const A = this.act, R = 30;
    g.globalCompositeOperation = 'lighter';
    // warm glow
    const halo = g.createRadialGradient(0, 0, 6, 0, 0, 58);
    halo.addColorStop(0, `rgba(255,205,120,${0.22 * A + 0.05})`); halo.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    // focus ring with ticks, turning slowly
    g.save(); g.rotate(this.spin * 0.4);
    g.strokeStyle = `rgba(216,178,106,${0.55 + 0.45 * A})`; g.lineWidth = 1.6;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
    g.lineWidth = 1;
    for (let k = 0; k < 48; k++) {
      const a = k / 48 * TAU, l = k % 6 === 0 ? 5 : 2.5;
      g.beginPath(); g.moveTo(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2)); g.lineTo(Math.cos(a) * (R + 2 + l), Math.sin(a) * (R + 2 + l)); g.stroke();
    }
    g.restore();
    // the iris: six blades; opens with speech and breathes with the music
    const open = 0.32 + 0.5 * A + pulse * 0.12, ap = (R - 3) * open, rot = this.spin;
    g.save(); g.rotate(rot);
    g.strokeStyle = `rgba(243,220,166,${0.6 + 0.4 * A})`; g.lineWidth = 1.2;
    g.fillStyle = 'rgba(10,6,2,0.55)';
    for (let k = 0; k < 6; k++) {
      const a0 = k / 6 * TAU, a1 = (k + 1) / 6 * TAU;
      const p0 = [Math.cos(a0) * ap, Math.sin(a0) * ap], p1 = [Math.cos(a1) * ap, Math.sin(a1) * ap];
      // blade edge extends from the aperture vertex tangentially out to the ring
      const ex = Math.cos(a0 + 1.15) * (R - 2), ey = Math.sin(a0 + 1.15) * (R - 2);
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(ex, ey); g.closePath(); g.fill(); g.stroke();
    }
    g.restore();
    // light through the opening
    g.globalCompositeOperation = 'lighter';
    const core = g.createRadialGradient(0, 0, 0, 0, 0, ap + 2);
    core.addColorStop(0, `rgba(255,240,205,${0.5 + 0.5 * A})`); core.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, ap + 2, 0, TAU); g.fill();
    // a glint that travels around the glass
    const ga = t * 0.7, gx = Math.cos(ga) * R * 0.55, gy = Math.sin(ga) * R * 0.55;
    const gl = g.createRadialGradient(gx, gy, 0, gx, gy, 6);
    gl.addColorStop(0, `rgba(255,255,255,${0.5 * A + 0.1})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(gx, gy, 6, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  lumen(g, t, pulse) {
    const A = this.act, B = 0.35 + 0.65 * A + pulse * 0.25;
    g.globalCompositeOperation = 'lighter';
    // outer bloom
    const halo = g.createRadialGradient(0, 0, 2, 0, 0, 58);
    halo.addColorStop(0, `rgba(170,220,255,${0.32 * B})`); halo.addColorStop(0.4, `rgba(80,150,255,${0.12 * B})`); halo.addColorStop(1, 'rgba(40,90,255,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.fill();
    // anamorphic flare: a long thin streak of light
    for (const [w, a] of [[58, 0.18], [40, 0.4], [22, 0.8]]) {
      const fl = g.createLinearGradient(-w, 0, w, 0);
      fl.addColorStop(0, 'rgba(120,190,255,0)'); fl.addColorStop(0.5, `rgba(220,240,255,${a * B})`); fl.addColorStop(1, 'rgba(120,190,255,0)');
      g.fillStyle = fl; g.fillRect(-w, -0.9 - (w === 58 ? 0.3 : 0), w * 2, 1.8 + (w === 58 ? 0.6 : 0));
    }
    // rays, turning slowly: four long, eight faint
    g.save(); g.rotate(this.spin * 0.25);
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * TAU, long = k % 3 === 0, L = (long ? 30 : 17) * (0.8 + 0.35 * B) + Math.sin(t * 2 + k) * 2;
      const rg = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
      rg.addColorStop(0, `rgba(235,247,255,${(long ? 0.55 : 0.25) * B})`); rg.addColorStop(1, 'rgba(150,210,255,0)');
      g.strokeStyle = rg; g.lineWidth = long ? 1.6 : 0.9;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke();
    }
    g.restore();
    // orbiting photons with short trails
    for (let k = 0; k < 7; k++) {
      const sp = 0.6 + k * 0.17, ph = k * 1.7, rx = 18 + k * 3.2, ry = rx * (0.35 + 0.08 * k), tilt = k * 0.45;
      for (let tr = 0; tr < 6; tr++) {
        const a = t * sp * (0.6 + A) + ph - tr * 0.07;
        const x0 = Math.cos(a) * rx, y0 = Math.sin(a) * ry;
        const x = x0 * Math.cos(tilt) - y0 * Math.sin(tilt), y = x0 * Math.sin(tilt) + y0 * Math.cos(tilt);
        g.fillStyle = `rgba(200,235,255,${(0.7 - tr * 0.11) * B})`;
        g.beginPath(); g.arc(x, y, 1.3 - tr * 0.15, 0, TAU); g.fill();
      }
    }
    // the core: white-hot, breathing with the music
    const cr = 7 + 3 * B + pulse * 2;
    const core = g.createRadialGradient(0, 0, 0, 0, 0, cr * 2.2);
    core.addColorStop(0, `rgba(255,255,255,${0.95})`); core.addColorStop(0.35, `rgba(215,238,255,${0.8 * B + 0.2})`); core.addColorStop(1, 'rgba(110,180,255,0)');
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, cr * 2.2, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
}
