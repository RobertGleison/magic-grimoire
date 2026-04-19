'use client';

// Expands single-char MTG codes to full color names used in asset filenames
const MTG_CODE: Record<string, string> = {
  W: 'WHITE', U: 'BLUE', B: 'BLACK', R: 'RED', G: 'GREEN', C: 'COLORLESS',
};

interface ManaSymbolProps {
  symbol: string;
  size?: number;
}

export function ManaSymbol({ symbol, size = 16 }: ManaSymbolProps) {
  const expanded = MTG_CODE[symbol] ?? symbol;
  const key = expanded.toLowerCase().replace(/\//g, '');
  return (
    <img
      src={`/assets/mana-${key}.png`}
      width={size}
      height={size}
      alt={`{${symbol}}`}
      className="mana-symbol"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
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
