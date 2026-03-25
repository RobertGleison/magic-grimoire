'use client';

interface ManaSymbolProps {
  symbol: string;
  size?: number;
}

// Precomputed sun ray coordinates (8 rays, inner r=4.2, outer r=7.0, center 10,10)
const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return {
    x1: +(10 + 4.2 * Math.cos(rad)).toFixed(2),
    y1: +(10 + 4.2 * Math.sin(rad)).toFixed(2),
    x2: +(10 + 7.0 * Math.cos(rad)).toFixed(2),
    y2: +(10 + 7.0 * Math.sin(rad)).toFixed(2),
  };
});

const MANA_BG: Record<string, string> = {
  W: '#f0ead8',
  U: '#1460a8',
  B: '#150c05',
  R: '#c81808',
  G: '#0f6030',
  C: '#7a7a8a',
};

const MANA_FG: Record<string, string> = {
  W: '#8a7030',
  U: '#c8e4ff',
  B: '#c9a84c',
  R: '#ffd8b0',
  G: '#a8f0a0',
  C: '#e8e8ff',
};

function ManaIcon({ symbol, fg, bg }: { symbol: string; fg: string; bg: string }) {
  switch (symbol) {
    case 'W':
      return (
        <>
          <circle cx="10" cy="10" r="2.6" fill={fg} />
          {SUN_RAYS.map((r, i) => (
            <line
              key={i}
              x1={r.x1} y1={r.y1}
              x2={r.x2} y2={r.y2}
              stroke={fg}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          ))}
        </>
      );

    case 'U':
      return (
        <path
          d="M10 3.5C10 3.5 5.5 8.5 5.5 12a4.5 4.5 0 009 0C14.5 8.5 10 3.5 10 3.5z"
          fill={fg}
        />
      );

    case 'B':
      return (
        <>
          <path
            d="M10 5C7 5 5 7 5 9.5c0 2.2 1.2 3.5 3 4L8 15h4l-.05-1.5C13.8 13 15 11.7 15 9.5 15 7 13 5 10 5z"
            fill={fg}
          />
          <ellipse cx="8" cy="9.5" rx="1.1" ry="1.2" fill={bg} />
          <ellipse cx="12" cy="9.5" rx="1.1" ry="1.2" fill={bg} />
          <line x1="9"  y1="13.8" x2="9"  y2="15.2" stroke={bg} strokeWidth="0.9" />
          <line x1="11" y1="13.8" x2="11" y2="15.2" stroke={bg} strokeWidth="0.9" />
        </>
      );

    case 'R':
      return (
        <path
          d="M10 16c-2.8 0-5-2-5-5 0-2.5 1.5-4 2-6 .8 1.5 1 3 1 3 .6-2 1.5-4 2.5-4.5.6 1.5 1.2 3 2 3.5.5-1.2 1-2 1.5-2 0 2.5 2 4 2 6 0 3-2.2 5-5 5z"
          fill={fg}
        />
      );

    case 'G':
      return (
        <>
          <path
            d="M10 16C10 16 5 13 5 8c2.5 0 4.5 1.5 5 4.5.5-3 2.5-4.5 5-4.5C15 13 10 16 10 16z"
            fill={fg}
          />
          <line x1="10" y1="16" x2="10" y2="10" stroke={fg} strokeWidth="1" strokeLinecap="round" />
        </>
      );

    default: // C — colorless diamond/gem outline
      return (
        <>
          <path
            d="M10 4.5L13.5 10 10 15.5 6.5 10z"
            stroke={fg}
            strokeWidth="0.8"
            fill="none"
          />
          <line x1="6.8"  y1="8.8"  x2="13.2" y2="8.8"  stroke={fg} strokeWidth="0.7" />
          <line x1="6.8"  y1="11.2" x2="13.2" y2="11.2" stroke={fg} strokeWidth="0.7" />
        </>
      );
  }
}

export function ManaSymbol({ symbol, size = 16 }: ManaSymbolProps) {
  const isNumeric = /^\d+$/.test(symbol) || symbol === 'X' || symbol === 'Y';
  const key = symbol.toUpperCase();
  const bg = isNumeric ? '#7a7a8a' : (MANA_BG[key] ?? '#7a7a8a');
  const fg = isNumeric ? '#f0f0f0' : (MANA_FG[key] ?? '#f0f0f0');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      className="mana-symbol"
      aria-label={`{${symbol}}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Background circle */}
      <circle cx="10" cy="10" r="9" fill={bg} />
      {/* Outer border */}
      <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
      {/* Top-left highlight for dimension */}
      <ellipse cx="7.5" cy="6.5" rx="3" ry="1.8" fill="rgba(255,255,255,0.12)" />

      {isNumeric ? (
        <text
          x="10"
          y="14.5"
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fontFamily="Georgia, serif"
          fill={fg}
        >
          {symbol}
        </text>
      ) : (
        <ManaIcon symbol={key} fg={fg} bg={bg} />
      )}
    </svg>
  );
}

export function ManaCost({ cost, size = 14 }: { cost: string; size?: number }) {
  if (!cost) return null;
  const symbols = cost.match(/\{[^}]+\}/g)?.map((s) => s.slice(1, -1)) ?? [];
  if (symbols.length === 0) return null;
  return (
    <span className="mana-cost" aria-label={cost}>
      {symbols.map((s, i) => (
        <ManaSymbol key={i} symbol={s} size={size} />
      ))}
    </span>
  );
}
