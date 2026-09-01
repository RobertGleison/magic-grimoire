import type { CSSProperties } from 'react';

import './ManaSymbol.css';

/* ==========================================================================
   Mana-cost parsing
   --------------------------------------------------------------------------
   The wire format is Scryfall's raw `mana_cost` string, passed straight
   through by the backend (`app/services/scryfall_service.py` keeps
   `card.get("mana_cost", "")`, typed as `str | None` in `app/decks/dtos.py`).
   Real values look like `"{R}"`, `"{2}{R}"`, `"{1}{B}"`, `"{W/U}"`, `"{2/W}"`,
   `"{X}{B}{B}"`, `""` (lands and other cost-less cards) or `null`.

   Nothing here throws. Anything unrecognised degrades to a neutral pip and
   contributes 1 to the mana value, which is what MTG rules do for an unknown
   single symbol.
   ========================================================================== */

/** The five colours plus colourless, in WUBRG order. */
export const MANA_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
export type ManaColor = (typeof MANA_COLORS)[number];

const COLOR_NAMES: Record<ManaColor, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
  C: 'colourless',
};

/**
 * Basename of each colour's symbol art in `public/assets/mana-*.png`.
 * Spelled the way the files are (`colorless`, not `colourless`), which is why
 * this is its own map rather than a lowercase of `COLOR_NAMES`. Read by
 * `ManaIcon`; the CSS pip below needs no art.
 */
export const MANA_COLOR_ASSETS: Record<ManaColor, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
  C: 'colorless',
};

/** Non-colour symbols the game uses that are not a plain numeral. */
const SPECIAL_NAMES: Record<string, string> = {
  X: 'variable X',
  Y: 'variable Y',
  Z: 'variable Z',
  S: 'snow',
  P: 'phyrexian',
  E: 'energy',
  T: 'tap',
  Q: 'untap',
};

function isManaColor(token: string): token is ManaColor {
  return (MANA_COLORS as readonly string[]).includes(token);
}

function isGeneric(token: string): boolean {
  return /^\d+$/.test(token);
}

/**
 * Split a cost string into its bare symbols, uppercased.
 * `"{2}{W}{U}"` → `['2', 'W', 'U']`. Anything without `{}` pairs yields `[]`,
 * so a malformed string renders nothing rather than guessing.
 */
export function parseManaCost(cost: string | null | undefined): string[] {
  if (!cost) return [];
  const matches = cost.match(/\{[^{}]+\}/g);
  if (!matches) return [];
  return matches.map((token) => token.slice(1, -1).trim().toUpperCase()).filter(Boolean);
}

/** One symbol's contribution to the converted mana cost. */
function symbolValue(symbol: string): number {
  if (isGeneric(symbol)) return Number(symbol);
  if (symbol === 'X' || symbol === 'Y' || symbol === 'Z') return 0;
  if (symbol.includes('/')) {
    // Numeric hybrid `{2/W}` counts as its generic half; colour and
    // Phyrexian hybrids `{W/U}` / `{W/P}` count as 1.
    const head = symbol.split('/')[0];
    return isGeneric(head) ? Number(head) : 1;
  }
  return 1;
}

/**
 * Converted mana cost / mana value of a whole cost string.
 * `"{2}{W}{U}"` → 4. `null`, `''` and unparseable input → 0.
 */
export function manaValue(cost: string | null | undefined): number {
  return parseManaCost(cost).reduce((sum, symbol) => sum + symbolValue(symbol), 0);
}

/** Every distinct colour appearing in a cost, in WUBRG order. */
export function manaColorsOf(cost: string | null | undefined): ManaColor[] {
  const found = new Set<ManaColor>();
  for (const symbol of parseManaCost(cost)) {
    for (const part of symbol.split('/')) {
      if (isManaColor(part)) found.add(part);
    }
  }
  return MANA_COLORS.filter((color) => found.has(color));
}

function symbolLabel(symbol: string): string {
  if (isGeneric(symbol)) return `${symbol} generic`;
  if (isManaColor(symbol)) return COLOR_NAMES[symbol];
  if (symbol in SPECIAL_NAMES) return SPECIAL_NAMES[symbol];
  if (symbol.includes('/')) {
    return symbol
      .split('/')
      .map((part) => symbolLabel(part))
      .join(' or ');
  }
  return symbol;
}

/** Screen-reader text for a whole cost. `"{2}{W}"` → `"2 generic, white"`. */
export function manaCostLabel(cost: string | null | undefined): string {
  const symbols = parseManaCost(cost);
  if (symbols.length === 0) return 'no mana cost';
  return symbols.map(symbolLabel).join(', ');
}

/** The design's compact form: `"{1}{B}{R}"` → `"1BR"` (node `16:52`). */
export function manaCostShorthand(cost: string | null | undefined): string {
  return parseManaCost(cost)
    .map((symbol) => symbol.replace(/\//g, ''))
    .join('');
}

/* ==========================================================================
   ManaSymbol — one pip
   ========================================================================== */

/** Which visual ground a pip gets. */
function pipModifier(symbol: string): string {
  if (isManaColor(symbol)) return `mana-symbol-${symbol.toLowerCase()}`;
  if (symbol.includes('/')) return 'mana-symbol-hybrid';
  return 'mana-symbol-generic';
}

/** Half-colour custom properties for a hybrid pip's split ground. */
function hybridHalves(symbol: string): { a: string; b: string } {
  const [first = '', second = ''] = symbol.split('/');
  const tint = (part: string) => (isManaColor(part) ? `var(--mana-${part.toLowerCase()})` : 'var(--mana-c)');
  return { a: tint(first), b: tint(second) };
}

/** Pip face text. Kept to two glyphs so it never overflows the circle. */
function pipText(symbol: string): string {
  const stripped = symbol.replace(/\//g, '');
  return stripped.length > 2 ? stripped.slice(0, 2) : stripped;
}

interface ManaSymbolProps {
  /** A bare symbol (`'W'`, `'2'`, `'W/U'`) or a braced one (`'{W}'`). */
  symbol: string;
  /** Diameter in px. */
  size?: number;
  /**
   * `true` when the pip sits inside a `ManaCost` that already carries the
   * accessible label, so the pip itself is hidden from assistive tech.
   */
  decorative?: boolean;
  className?: string;
}

export function ManaSymbol({ symbol, size = 16, decorative = false, className = '' }: ManaSymbolProps) {
  // Accept either `{W}` or `W` so callers can pass raw wire fragments.
  const bare = symbol.replace(/[{}]/g, '').trim().toUpperCase();
  if (!bare) return null;

  const modifier = pipModifier(bare);
  const style: CSSProperties & Record<string, string | number> = { '--mana-size': `${size}px` };
  if (modifier === 'mana-symbol-hybrid') {
    const { a, b } = hybridHalves(bare);
    style['--mana-half-a'] = a;
    style['--mana-half-b'] = b;
  }

  return (
    <span
      className={`mana-symbol ${modifier} ${className}`.trim()}
      style={style}
      {...(decorative
        ? { 'aria-hidden': true as const }
        : { role: 'img' as const, 'aria-label': symbolLabel(bare) })}
    >
      <span className="mana-symbol-glyph">{pipText(bare)}</span>
    </span>
  );
}

/* ==========================================================================
   ManaCost — a whole cost string
   ========================================================================== */

interface ManaCostProps {
  /** Raw `CardInDeck.mana_cost`, e.g. `'{2}{R}'`. `null` renders nothing. */
  cost: string | null | undefined;
  /**
   * `pips` — the round coloured symbols (ported from `apps/web-app`).
   * `badge` — the design's compact text chip, `1BR` on a tinted ground
   *           (deck-builder card tiles, nodes `16:41` / `16:52`).
   */
  variant?: 'pips' | 'badge';
  /** Pip diameter in px. Ignored by `badge`. */
  size?: number;
  className?: string;
}

export function ManaCost({ cost, variant = 'pips', size = 14, className = '' }: ManaCostProps) {
  const symbols = parseManaCost(cost);
  if (symbols.length === 0) return null;

  const label = manaCostLabel(cost);

  if (variant === 'badge') {
    // Crimson reads as "has a coloured pip", muted gold as "generic only" —
    // exactly how nodes 16:41 (generic `1`) and 16:52 (coloured `1BR`) differ.
    const colored = manaColorsOf(cost).length > 0;
    return (
      <span
        className={`mana-cost-badge ${colored ? 'mana-cost-badge-color' : 'mana-cost-badge-generic'} ${className}`.trim()}
        role="img"
        aria-label={label}
      >
        {manaCostShorthand(cost)}
      </span>
    );
  }

  return (
    <span className={`mana-cost ${className}`.trim()} role="img" aria-label={label}>
      {symbols.map((symbol, i) => (
        <ManaSymbol key={`${symbol}-${i}`} symbol={symbol} size={size} decorative />
      ))}
    </span>
  );
}
