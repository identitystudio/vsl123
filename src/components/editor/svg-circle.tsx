'use client';

import type { CircleStyle } from '@/types';

interface SvgCircleProps {
  width: number;
  height: number;
  style: CircleStyle;
}

export function SvgCircle({ width, height, style }: SvgCircleProps) {
  const color = style === 'black-solid' ? '#1a1a1a' : '#dc2626';
  const isDotted = style === 'red-dotted';

  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2 + 8;
  const ry = height / 2 + 6;

  // Hand-drawn effect: slightly irregular ellipse
  const d = `M ${cx - rx} ${cy}
    C ${cx - rx} ${cy - ry * 0.9}, ${cx - rx * 0.3} ${cy - ry}, ${cx} ${cy - ry}
    C ${cx + rx * 0.3} ${cy - ry}, ${cx + rx} ${cy - ry * 0.85}, ${cx + rx} ${cy}
    C ${cx + rx} ${cy + ry * 0.85}, ${cx + rx * 0.3} ${cy + ry}, ${cx} ${cy + ry}
    C ${cx - rx * 0.3} ${cy + ry}, ${cx - rx} ${cy + ry * 0.9}, ${cx - rx} ${cy}
    Z`;

  return (
    <svg
      width={width + 20}
      height={height + 16}
      viewBox={`${-10} ${-8} ${width + 20} ${height + 16}`}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <path
        d={d}
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={isDotted ? '6 4' : 'none'}
      />
    </svg>
  );
}
