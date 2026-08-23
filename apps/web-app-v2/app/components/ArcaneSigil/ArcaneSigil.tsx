import type { CSSProperties } from 'react';

import { MANA_COLORS } from '../ManaSymbol/ManaSymbol';
import './ArcaneSigil.css';

/* ==========================================================================
   ArcaneSigil
   --------------------------------------------------------------------------
   Ported from `apps/web-app/app/components/ArcaneSigil/ArcaneSigil.tsx`, which
   has no design counterpart in the Figma file. Four concentric rings turning at
   different speeds and directions.

   Two changes from the legacy version:
     1. The innermost ring's five mana pips were `<image href="/assets/mana-*.png">`.
        v2 ships no `/public/assets`, so they are drawn as token-coloured circles
        with the colour's letter — no asset dependency, no broken images.
     2. The rotations were inline `style={{ animation: ... }}`. They are CSS
        classes here, per the project's convention that keyframes live in
        globals.css and animations are applied by class.
   ========================================================================== */

const VIEW = 400;
const C = VIEW / 2;

/** Point on a circle of radius `r`, `i/n` of the way round, starting at 12 o'clock. */
function polar(i: number, n: number, r: number, offset = -Math.PI / 2) {
  const a = (i / n) * Math.PI * 2 + offset;
  return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
}

function polygon(n: number, r: number, offset?: number): string {
  return Array.from({ length: n }, (_, i) => {
    const { x, y } = polar(i, n, r, offset);
    return `${x},${y}`;
  }).join(' ');
}

/** A five-pointed star drawn as one path by visiting every other vertex. */
function pentagram(r: number): string {
  return [0, 2, 4, 1, 3]
    .map((i) => {
      const { x, y } = polar(i, 5, r);
      return `${x},${y}`;
    })
    .join(' ');
}

const RUNES = ['◈', '※', '⟡', '✦', '◈', '※', '⟡', '✦'];
/** WUBRG — the colourless pip is dropped so five points land on the pentagram. */
const PIP_COLORS = MANA_COLORS.filter((c) => c !== 'C');

interface ArcaneSigilProps {
  /** Rendered width and height in px. */
  size?: number;
  /** Multiplier on the outer glow. `0` removes it. */
  intensity?: number;
  /** Set when the sigil carries meaning rather than decorating. */
  label?: string;
  className?: string;
}

export function ArcaneSigil({ size = 280, intensity = 1, label = '', className = '' }: ArcaneSigilProps) {
  return (
    <svg
      className={`arcane-sigil ${className}`.trim()}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      style={{ '--sigil-glow-blur': `${20 * intensity}px` } as CSSProperties}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        <radialGradient id="arcane-sigil-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="arcane-sigil-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-dim)" />
        </linearGradient>
      </defs>

      <circle cx={C} cy={C} r={180} fill="url(#arcane-sigil-halo)" />

      {/* Ring 1 — 90s clockwise: double rim, 12 ticks, 8 runes */}
      <g className="arcane-sigil-ring arcane-sigil-ring-1">
        <circle
          cx={C}
          cy={C}
          r={180}
          fill="none"
          stroke="url(#arcane-sigil-stroke)"
          strokeWidth="1"
          opacity="0.7"
        />
        <circle
          cx={C}
          cy={C}
          r={178}
          fill="none"
          stroke="url(#arcane-sigil-stroke)"
          strokeWidth="0.5"
          opacity="0.4"
        />
        {Array.from({ length: 12 }, (_, i) => {
          const inner = polar(i, 12, 170, 0);
          const outer = polar(i, 12, 180, 0);
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--accent)"
              strokeWidth="1"
              opacity="0.6"
            />
          );
        })}
        {RUNES.map((rune, i) => {
          const { x, y } = polar(i, RUNES.length, 160);
          return (
            <text
              key={`${rune}-${i}`}
              className="arcane-sigil-rune"
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {rune}
            </text>
          );
        })}
      </g>

      {/* Ring 2 — 60s counter-clockwise: dashed rim with 6 nodes */}
      <g className="arcane-sigil-ring arcane-sigil-ring-2">
        <circle
          cx={C}
          cy={C}
          r={140}
          fill="none"
          stroke="var(--accent-mid)"
          strokeWidth="0.8"
          strokeDasharray="2 4"
          opacity="0.5"
        />
        {Array.from({ length: 6 }, (_, i) => {
          const { x, y } = polar(i, 6, 140, 0);
          return <circle key={i} cx={x} cy={y} r={3} fill="var(--accent)" opacity="0.8" />;
        })}
      </g>

      {/* Ring 3 — 45s clockwise: hexagram */}
      <g className="arcane-sigil-ring arcane-sigil-ring-3">
        <circle cx={C} cy={C} r={110} fill="none" stroke="var(--accent)" strokeWidth="0.6" opacity="0.5" />
        <polygon points={polygon(6, 105)} fill="none" stroke="var(--accent)" strokeWidth="0.8" opacity="0.6" />
        <polygon
          points={polygon(6, 105, Math.PI / 6)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.8"
          opacity="0.4"
        />
      </g>

      {/* Ring 4 — 110s counter-clockwise: pentagram with the five mana pips */}
      <g className="arcane-sigil-ring arcane-sigil-ring-4">
        <circle cx={C} cy={C} r={70} fill="none" stroke="var(--accent-mid)" strokeWidth="1" opacity="0.7" />
        <polygon points={polygon(5, 65)} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.85" />
        <polygon points={pentagram(65)} fill="none" stroke="var(--accent)" strokeWidth="0.8" opacity="0.55" />
        {PIP_COLORS.map((color, i) => {
          const { x, y } = polar(i, PIP_COLORS.length, 65);
          return (
            /* Counter-rotated so each pip stays upright while the ring turns. */
            <g key={color} className="arcane-sigil-pip">
              <circle
                cx={x}
                cy={y}
                r={12}
                fill={`var(--mana-${color.toLowerCase()})`}
                stroke="var(--accent)"
                strokeWidth="1"
              />
              <text
                className={`arcane-sigil-pip-glyph arcane-sigil-pip-glyph-${color.toLowerCase()}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {color}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
