'use client';

import type { UnderlineStyle } from '@/types';

interface SvgUnderlineProps {
  width: number;
  style: UnderlineStyle;
}

export function SvgUnderline({ width, style }: SvgUnderlineProps) {
  const color =
    style === 'brush-red' || style === 'brush-stroke-red' ? '#dc2626' : '#1a1a1a';

  if (style === 'regular') {
    return (
      <svg
        width={width}
        height="4"
        viewBox={`0 0 ${width} 4`}
        className="absolute -bottom-1 left-0"
      >
        <line
          x1="0"
          y1="2"
          x2={width}
          y2="2"
          stroke={color}
          strokeWidth="2"
        />
      </svg>
    );
  }

  // Brush stroke styles
  const d =
    style === 'brush-stroke-red'
      ? `M 0 3 Q ${width * 0.25} 0, ${width * 0.5} 3 T ${width} 3`
      : `M 0 4 C ${width * 0.2} 1, ${width * 0.4} 6, ${width * 0.6} 2 S ${width * 0.9} 5, ${width} 3`;

  return (
    <svg
      width={width}
      height="8"
      viewBox={`0 0 ${width} 8`}
      className="absolute -bottom-1 left-0"
      style={{ overflow: 'visible' }}
    >
      <path
        d={d}
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
