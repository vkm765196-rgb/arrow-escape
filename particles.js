/**
 * Arrow Escape - High Performance Particle & Visual Effects Engine
 * Renders particle trails, collision sparks, bomb shockwaves, and victory confetti
 */

class ParticleEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.particles = [];
    this.texts = [];
    this.animId = null;
    this.lastTime = performance.now();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  start() {
    if (!this.animId) {
      this.lastTime = performance.now();
      this.animId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Update & draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(p.friction || 0.98, dt * 60);
      p.vy *= Math.pow(p.friction || 0.98, dt * 60);
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.rotation !== undefined && p.vRot) p.rotation += p.vRot * dt;

      const alpha = Math.max(0, p.life / p.maxLife);

      this.ctx.save();
      this.ctx.globalAlpha = alpha;

      if (p.type === 'confetti') {
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation || 0);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size * (p.aspect || 0.5) / 2, p.size, p.size * (p.aspect || 0.5));
      } else if (p.type === 'shockwave') {
        const radius = p.baseRadius + (1 - alpha) * p.growth;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = p.lineWidth * alpha;
        this.ctx.stroke();
      } else if (p.type === 'spark' || p.type === 'trail') {
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = p.glow ? 8 : 0;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * (0.3 + 0.7 * alpha), 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    // Update & draw floating texts
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }

      t.y += t.vy * dt;
      const alpha = Math.min(1, t.life / t.maxLife);
      const scale = 1 + (1 - alpha) * 0.25;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.font = `900 ${Math.round(t.size * scale)}px 'Inter', sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // Outline
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(t.text, t.x, t.y);

      // Fill
      this.ctx.fillStyle = t.color;
      this.ctx.shadowColor = t.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(t.text, t.x, t.y);
      this.ctx.restore();
    }

    // Continue loop if active items remain
    if (this.particles.length > 0 || this.texts.length > 0) {
      this.animId = requestAnimationFrame((t) => this.loop(t));
    } else {
      this.animId = null;
    }
  }

  // 1. Arrow Launch Speed Trails
  createArrowTrail(startX, startY, dir, color = '#38bdf8', count = 12) {
    const dirMap = {
      UP: { dx: 0, dy: 1 },
      DOWN: { dx: 0, dy: -1 },
      LEFT: { dx: 1, dy: 0 },
      RIGHT: { dx: -1, dy: 0 }
    };
    const backward = dirMap[dir] || { dx: 0, dy: 1 };

    for (let i = 0; i < count; i++) {
      const speed = 120 + Math.random() * 220;
      const spread = (Math.random() - 0.5) * 40;
      this.particles.push({
        type: 'trail',
        x: startX + (Math.random() - 0.5) * 20,
        y: startY + (Math.random() - 0.5) * 20,
        vx: backward.dx * speed + spread * backward.dy,
        vy: backward.dy * speed + spread * backward.dx,
        size: 3 + Math.random() * 4,
        color: color,
        glow: true,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        friction: 0.92
      });
    }
    this.start();
  }

  // 2. Collision Sparks on Bonk
  createBonkSparks(x, y, dir, color = '#f43f5e') {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        type: 'spark',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 3.5,
        color: Math.random() > 0.4 ? color : '#facc15',
        glow: true,
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.4,
        friction: 0.9
      });
    }

    // Small shockwave ring
    this.particles.push({
      type: 'shockwave',
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      baseRadius: 8,
      growth: 24,
      lineWidth: 3,
      color: color,
      life: 0.25,
      maxLife: 0.25
    });

    this.start();
  }

  // 3. Bomb Powerup Explosion
  createExplosion(x, y) {
    const colors = ['#f97316', '#ef4444', '#fbbf24', '#ffffff'];
    // Fast shockwave ring
    this.particles.push({
      type: 'shockwave',
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      baseRadius: 15,
      growth: 85,
      lineWidth: 6,
      color: '#fbbf24',
      life: 0.35,
      maxLife: 0.35
    });

    // Debris & embers
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 320;
      this.particles.push({
        type: 'spark',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        glow: true,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        friction: 0.88,
        gravity: 120
      });
    }
    this.start();
  }

  // 4. Epic Victory Confetti Blast
  createConfetti(originX, originY, count = 80) {
    const palette = ['#38bdf8', '#818cf8', '#ec4899', '#facc15', '#10b981', '#fb923c'];
    const centerX = originX !== undefined ? originX : this.width / 2;
    const centerY = originY !== undefined ? originY : this.height / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 180 + Math.random() * 400;
      this.particles.push({
        type: 'confetti',
        x: centerX + (Math.random() - 0.5) * 40,
        y: centerY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150, // initial upward lift
        size: 8 + Math.random() * 7,
        aspect: 0.3 + Math.random() * 0.5,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 15,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 1.2 + Math.random() * 1.0,
        maxLife: 2.2,
        friction: 0.94,
        gravity: 380
      });
    }
    this.start();
  }

  // 5. Floating text popup
  createFloatingText(x, y, text, color = '#38bdf8', size = 18) {
    this.texts.push({
      text: text,
      x: x,
      y: y,
      vy: -60,
      color: color,
      size: size,
      life: 0.85,
      maxLife: 0.85
    });
    this.start();
  }
}

window.ParticleEngine = ParticleEngine;
