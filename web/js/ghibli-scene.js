/* Client-Side Animated Ghibli Ambient Scene Renderer
 * Lightweight 2D Canvas, adaptive FPS, respects prefers-reduced-motion & tab visibility.
 */

export class GhibliScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.theme = 'meadow';
    this.mode = 'full'; // 'full' | 'light' | 'off'
    this.particles = [];
    this.clouds = [];
    this.rafId = null;
    this.lastFrame = 0;
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener?.('change', (e) => {
        this.reducedMotion = e.matches;
        this.restart();
      });
    }

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.start();
    });

    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.seedEntities();
  }

  configure(theme, mode) {
    this.theme = theme || 'meadow';
    this.mode = mode || 'full';
    this.restart();
  }

  restart() {
    this.stop();
    this.seedEntities();
    if (this.mode === 'off' || this.reducedMotion) {
      this.clear();
      return;
    }
    this.start();
  }

  seedEntities() {
    const isLight = this.mode === 'light';
    const count = isLight ? 10 : 22;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (this.width || 1200),
        y: Math.random() * (this.height || 800),
        r: 2.5 + Math.random() * 4.5,
        vx: (Math.random() - 0.3) * 0.45,
        vy: this.theme === 'bakery' ? -(0.25 + Math.random() * 0.4) : 0.2 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.02,
      });
    }

    const cloudCount = isLight ? 3 : 5;
    this.clouds = [];
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        x: Math.random() * (this.width || 1200),
        y: 35 + Math.random() * 140,
        scale: 0.7 + Math.random() * 0.9,
        speed: 0.12 + Math.random() * 0.18,
      });
    }
  }

  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  start() {
    if (!this.ctx || this.mode === 'off' || this.reducedMotion || document.hidden) return;
    if (this.rafId) return;
    const minDelta = this.mode === 'light' ? 66 : 30; // ~15fps light, ~33fps full
    const loop = (ts) => {
      this.rafId = requestAnimationFrame(loop);
      if (ts - this.lastFrame < minDelta) return;
      this.lastFrame = ts;
      this.draw(ts * 0.001);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  drawCloud(c) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale, c.scale);
    ctx.fillStyle = this.theme === 'bakery'
      ? 'rgba(255, 250, 240, 0.52)'
      : 'rgba(255, 253, 247, 0.62)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.arc(24, -8, 22, 0, Math.PI * 2);
    ctx.arc(48, 0, 24, 0, Math.PI * 2);
    ctx.arc(24, 8, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  draw(t) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.theme !== 'lantern') {
      for (const c of this.clouds) {
        c.x += c.speed;
        if (c.x > this.width + 120) c.x = -120;
        this.drawCloud(c);
      }
    }

    for (const p of this.particles) {
      p.phase += 0.025;
      p.rot += p.vrot;

      if (this.theme === 'meadow') {
        p.x += p.vx + Math.sin(p.phase) * 0.35;
        p.y += p.vy;
        if (p.y > this.height + 20) { p.y = -20; p.x = Math.random() * this.width; }
        if (p.x > this.width + 20) p.x = -20;
        if (p.x < -20) p.x = this.width + 20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = 'rgba(74, 134, 96, 0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.4, p.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (this.theme === 'bakery') {
        p.x += Math.sin(p.phase) * 0.4;
        p.y += p.vy;
        if (p.y < -20) { p.y = this.height + 20; p.x = Math.random() * this.width; }

        ctx.save();
        ctx.fillStyle = 'rgba(181, 90, 68, 0.16)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // lantern fireflies
        p.x += Math.cos(p.phase * 0.7) * 0.35;
        p.y += Math.sin(p.phase * 0.9) * 0.3;
        const glow = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.8 + p.phase));

        ctx.save();
        const grad = ctx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, p.r * 3);
        grad.addColorStop(0, `rgba(242, 196, 116, ${glow.toFixed(2)})`);
        grad.addColorStop(1, 'rgba(242, 196, 116, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
