'use client';

import { useEffect, useRef } from 'react';

function hexToRgba(hex, alpha = 1) {
  let c = (hex || '#00D2BE').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function RadarCanvas({ labels, dataA, dataB, colorA = '#00D2BE', colorB = '#E10600' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !labels || !labels.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      return { width: rect.width, height: rect.height };
    };

    let { width, height } = resize();

    const draw = (progress = 1) => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(cx, cy) - 44;
      const sides = labels.length;
      const angleStep = (Math.PI * 2) / sides;

      // 1. Concentric background webs
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

      // 2. Radial spokes and labels
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

        // Label offset
        const labelDistance = radius + 22;
        const lx = cx + Math.cos(a) * labelDistance;
        const ly = cy + Math.sin(a) * labelDistance;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(labels[i], lx, ly);
      }

      // 3. Draw driver polygon helper
      const drawPolygon = (data, color, fillOpacity) => {
        if (!data || !data.length) return;
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

        ctx.fillStyle = hexToRgba(color, fillOpacity);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

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

      // Draw Driver A
      drawPolygon(dataA, colorA, 0.28);
      // Draw Driver B
      drawPolygon(dataB, colorB, 0.28);
    };

    // Smooth ease-out cubic animation
    const startTime = performance.now();
    const duration = 700;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      draw(ease);

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      }
    };
    animFrame = requestAnimationFrame(step);

    const handleResize = () => {
      const dim = resize();
      width = dim.width;
      height = dim.height;
      draw(1);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [labels, dataA, dataB, colorA, colorB]);

  return <canvas ref={canvasRef} id="radarCanvas" className="radar-canvas" />;
}
