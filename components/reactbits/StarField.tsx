'use client';

import { useEffect, useRef } from 'react';
import useMeasure from 'react-use-measure';

interface StarFieldProps {
  speed?: number;
  backgroundColor?: string;
  starColor?: string;
  count?: number;
}

export default function StarField({
  speed = 0.05,
  backgroundColor = 'black',
  starColor = '#ffffff',
  count = 500,
}: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerRef, { width, height }] = useMeasure();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const stars: { x: number; y: number; z: number }[] = [];

    // Initialize stars
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        z: Math.random() * 2000,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      stars.forEach((star) => {
        // Move star closer
        star.z -= speed * 100;

        // Reset if passed camera
        if (star.z <= 0) {
          star.x = Math.random() * 2000 - 1000;
          star.y = Math.random() * 2000 - 1000;
          star.z = 2000;
        }

        // Project 3D to 2D
        const k = 128.0 / star.z;
        const x = star.x * k + cx;
        const y = star.y * k + cy;

        if (x >= 0 && x < width && y >= 0 && y < height) {
          const size = (1 - star.z / 2000) * 3;
          const shade = Math.floor((1 - star.z / 2000) * 255);

          ctx.beginPath();
          ctx.fillStyle = starColor;
          ctx.globalAlpha = shade / 255;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [width, height, speed, starColor, count]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        backgroundColor,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block' }}
      />
    </div>
  );
}
