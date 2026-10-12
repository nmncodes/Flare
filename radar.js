/**
 * High-performance, retina-ready Canvas Radar / Spider Chart
 * Renders multi-axis comparison polygon with animated transitions and glowing strokes
 */
export class RadarChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.labels = [];
    this.dataA = [];
    this.dataB = [];
    this.colorA = '#00D2BE';
    this.colorB = '#E10600';
    this.animProgress = 0;
    this.animFrame = null;

    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
      this.draw(1);
    });
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  update({ labels, dataA, dataB, colorA, colorB }) {
    this.labels = labels;
    this.dataA = dataA;
    this.dataB = dataB;
    this.colorA = colorA || '#00D2BE';
    this.colorB = colorB || '#E10600';

    this.resize();
    this.animate();
  }

  animate() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const startTime = performance.now();
    const duration = 700; // ms

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      this.draw(ease);

      if (progress < 1) {
        this.animFrame = requestAnimationFrame(step);
      }
    };
    this.animFrame = requestAnimationFrame(step);
  }

  draw(progress = 1) {
    if (!this.ctx || !this.width || !this.labels.length) return;
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.min(cx, cy) - 44;
    const sides = this.labels.length;
    const angleStep = (Math.PI * 2) / sides;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw concentric background webs
    const levels = 4;
    for (let l = 1; l <= levels; l++) {
      const r = (radius / levels) * l;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = i * angleStep - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = l === levels ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2. Draw radial axis spokes and text labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 11px "Titillium Web", system-ui, sans-serif';

    for (let i = 0; i < sides; i++) {
      const a = i * angleStep - Math.PI / 2;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;

      // Spoke line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();

      // Label with slight offset
      const labelDistance = radius + 22;
      const lx = cx + Math.cos(a) * labelDistance;
      const ly = cy + Math.sin(a) * labelDistance;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(this.labels[i], lx, ly);
    }

    // Helper to draw driver polygon
    const drawPolygon = (data, color, fillOpacity) => {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = i * angleStep - Math.PI / 2;
        const val = (data[i] / 100) * progress;
        const r = Math.max(8, radius * val);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Fill with glowing tint
      ctx.fillStyle = this.hexToRgba(color, fillOpacity);
      ctx.fill();

      // Stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Vertices dots
      for (let i = 0; i < sides; i++) {
        const a = i * angleStep - Math.PI / 2;
        const val = (data[i] / 100) * progress;
        const r = Math.max(8, radius * val);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    // Render Driver A polygon
    if (this.dataA.length) {
      drawPolygon(this.dataA, this.colorA, 0.28);
    }

    // Render Driver B polygon
    if (this.dataB.length) {
      drawPolygon(this.dataB, this.colorB, 0.28);
    }
  }

  hexToRgba(hex, alpha = 1) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
