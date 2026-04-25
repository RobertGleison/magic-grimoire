'use client';

interface ArcaneSigilProps {
  size?: number;
  intensity?: number;
}

export function ArcaneSigil({ size = 280, intensity = 1 }: ArcaneSigilProps) {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 400 400"
      style={{ filter: `drop-shadow(0 0 ${20 * intensity}px rgba(var(--accent-glow), 0.4))` }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="sigilGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(var(--accent-glow), 0.25)" />
          <stop offset="70%" stopColor="rgba(var(--accent-glow), 0.05)" />
          <stop offset="100%" stopColor="rgba(var(--accent-glow), 0)" />
        </radialGradient>
        <linearGradient id="sigilStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-dim)" />
        </linearGradient>
      </defs>

      <circle cx="200" cy="200" r="180" fill="url(#sigilGrad)" />

      {/* Outer ring — 90s CW */}
      <g style={{ transformOrigin: '200px 200px', animation: 'spinCW 90s linear infinite' }}>
        <circle cx="200" cy="200" r="180" fill="none" stroke="url(#sigilStroke)" strokeWidth="1" opacity="0.7" />
        <circle cx="200" cy="200" r="178" fill="none" stroke="url(#sigilStroke)" strokeWidth="0.5" opacity="0.4" />
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={200 + Math.cos(a) * 170}
              y1={200 + Math.sin(a) * 170}
              x2={200 + Math.cos(a) * 180}
              y2={200 + Math.sin(a) * 180}
              stroke="var(--accent)"
              strokeWidth="1"
              opacity="0.6"
            />
          );
        })}
        {['◈', '※', '⟡', '✦', '◈', '※', '⟡', '✦'].map((r, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          return (
            <text
              key={i}
              x={200 + Math.cos(a) * 160}
              y={200 + Math.sin(a) * 160}
              fill="var(--accent)"
              fontSize="12"
              textAnchor="middle"
              dominantBaseline="middle"
              opacity="0.8"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {r}
            </text>
          );
        })}
      </g>

      {/* Second ring — 60s CCW */}
      <g style={{ transformOrigin: '200px 200px', animation: 'spinCCW 60s linear infinite' }}>
        <circle cx="200" cy="200" r="140" fill="none" stroke="var(--accent-mid)" strokeWidth="0.8" opacity="0.5" strokeDasharray="2 4" />
        {[...Array(6)].map((_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <circle
              key={i}
              cx={200 + Math.cos(a) * 140}
              cy={200 + Math.sin(a) * 140}
              r="3"
              fill="var(--accent)"
              opacity="0.8"
            />
          );
        })}
      </g>

      {/* Third ring — 45s CW, hexagram */}
      <g style={{ transformOrigin: '200px 200px', animation: 'spinCW 45s linear infinite' }}>
        <circle cx="200" cy="200" r="110" fill="none" stroke="var(--accent)" strokeWidth="0.6" opacity="0.5" />
        <polygon
          points={[...Array(6)].map((_, i) => {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            return `${200 + Math.cos(a) * 105},${200 + Math.sin(a) * 105}`;
          }).join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.8"
          opacity="0.6"
        />
        <polygon
          points={[...Array(6)].map((_, i) => {
            const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
            return `${200 + Math.cos(a) * 105},${200 + Math.sin(a) * 105}`;
          }).join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.8"
          opacity="0.4"
        />
      </g>

      {/* Innermost — 110s CCW, pentagram */}
      <g style={{ transformOrigin: '200px 200px', animation: 'spinCCW 110s linear infinite' }}>
        <circle cx="200" cy="200" r="70" fill="none" stroke="var(--accent-mid)" strokeWidth="1" opacity="0.7" />
        <polygon
          points={[...Array(5)].map((_, i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return `${200 + Math.cos(a) * 65},${200 + Math.sin(a) * 65}`;
          }).join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
          opacity="0.85"
        />
        {/* Mana symbols at pentagon vertices — WUBRG clockwise from top */}
        {(['white', 'blue', 'black', 'red', 'green'] as const).map((color, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const cx = 200 + Math.cos(a) * 65;
          const cy = 200 + Math.sin(a) * 65;
          const sz = 28;
          return (
            <image
              key={color}
              href={`/assets/mana-${color}.png`}
              x={cx - sz / 2}
              y={cy - sz / 2}
              width={sz}
              height={sz}
              opacity="1"
              style={{ animation: 'spinCW 110s linear infinite', transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          );
        })}
        <polygon
          points={[0, 2, 4, 1, 3].map((i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return `${200 + Math.cos(a) * 65},${200 + Math.sin(a) * 65}`;
          }).join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.8"
          opacity="0.55"
        />
      </g>
    </svg>
  );
}
