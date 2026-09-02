/**
 * Pure deck-builder logic — no React, no DOM.
 *
 * Everything the deck-builder screen needs to turn a `DeckResponse` into the
 * groups, counters and charts the design shows (nodes `16:4` and `10:218`),
 * plus the prompt composition that feeds `POST /decks/generate`.
 *
 * Page-local by Wave 3 rules; Wave 5 decides whether any of it is shared.
 */

import { manaColorsOf, manaValue, MANA_COLORS, type ManaColor } from '../components/ManaSymbol/ManaSymbol';
import {
  MTG_COLORS,
  type CardInDeck,
  type ChatColor,
  type DeckFormat,
  type DeckResponse,
  type MTGColor,
} from '../types/api';

/* ------------------------------------------------------------- categories */

/**
 * Display order of the card-grid sections. The design shows four
 * (`Creatures`, `Instants & Sorceries`, `Artifacts`, `Lands`); the extra three
 * exist because `type_line` is a free-form Scryfall string and `section` is a
 * free-form backend string, so a card can always fall outside the design's set.
 */
export const DECK_CATEGORIES = [
  'creatures',
  'spells',
  'artifacts',
  'planeswalkers',
  'lands',
  'sideboard',
  'other',
] as const;

export type DeckCategory = (typeof DECK_CATEGORIES)[number];

export const DECK_CATEGORY_LABELS: Record<DeckCategory, string> = {
  creatures: 'Creatures',
  spells: 'Instants & Sorceries',
  artifacts: 'Artifacts & Enchantments',
  planeswalkers: 'Planeswalkers',
  lands: 'Lands',
  sideboard: 'Sideboard',
  other: 'Other',
};

function lower(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

/**
 * Which grid section a card belongs to.
 *
 * `section` is checked first and only for the sideboard: that is the field's
 * actual job on the wire (`mainboard` / `sideboard`), and it is a plain `str`,
 * so it cannot be trusted to carry a card type. Everything else is derived from
 * `type_line`, land-first — matching `CardTile` and `ManaCurve`, which both
 * treat any type line containing "land" as a land.
 */
export function categoriseCard(card: CardInDeck): DeckCategory {
  if (lower(card.section).includes('sideboard')) return 'sideboard';

  const line = lower(card.type_line);
  if (line.includes('land')) return 'lands';
  if (line.includes('creature')) return 'creatures';
  if (line.includes('planeswalker')) return 'planeswalkers';
  if (line.includes('instant') || line.includes('sorcery')) return 'spells';
  if (line.includes('artifact') || line.includes('enchantment')) return 'artifacts';
  return 'other';
}

export interface DeckSection {
  category: DeckCategory;
  label: string;
  /** Quantity-weighted card count, which is what the design's `· 24` shows. */
  count: number;
  cards: CardInDeck[];
}

/** Copy count, defended against a malformed `quantity` on the wire. */
export function quantityOf(card: CardInDeck): number {
  return Number.isFinite(card.quantity) ? Math.max(0, Math.trunc(card.quantity)) : 0;
}

/** Groups a deck into the design's sections, dropping any that stayed empty. */
export function groupDeckCards(cards: readonly CardInDeck[] | null | undefined): DeckSection[] {
  const buckets = new Map<DeckCategory, CardInDeck[]>();

  for (const card of cards ?? []) {
    const category = categoriseCard(card);
    const bucket = buckets.get(category);
    if (bucket) bucket.push(card);
    else buckets.set(category, [card]);
  }

  return DECK_CATEGORIES.flatMap((category) => {
    const bucket = buckets.get(category);
    if (!bucket || bucket.length === 0) return [];
    return [
      {
        category,
        label: DECK_CATEGORY_LABELS[category],
        count: bucket.reduce((sum, card) => sum + quantityOf(card), 0),
        cards: bucket,
      },
    ];
  });
}

/* ---------------------------------------------------------------- summary */

export interface DeckSummaryStats {
  /** Quantity-weighted total across every section. */
  total: number;
  lands: number;
  creatures: number;
  /** Everything that is neither a land nor a creature. */
  nonCreature: number;
  /** Quantity-weighted mean mana value of the non-land cards. */
  averageCmc: number;
}

/** The four stat tiles of node `10:266`. */
export function deckSummaryStats(cards: readonly CardInDeck[] | null | undefined): DeckSummaryStats {
  let total = 0;
  let lands = 0;
  let creatures = 0;
  let spellQuantity = 0;
  let spellMana = 0;

  for (const card of cards ?? []) {
    const quantity = quantityOf(card);
    if (quantity === 0) continue;
    total += quantity;

    const category = categoriseCard(card);
    if (category === 'lands') {
      lands += quantity;
      continue;
    }
    if (category === 'creatures') creatures += quantity;

    spellQuantity += quantity;
    spellMana += quantity * manaValue(card.mana_cost);
  }

  return {
    total,
    lands,
    creatures,
    nonCreature: total - lands - creatures,
    averageCmc: spellQuantity === 0 ? 0 : spellMana / spellQuantity,
  };
}

/* ----------------------------------------------------------- colour split */

export interface DeckColorSlice {
  color: ManaColor;
  count: number;
  /** Fraction of the whole ring, `0..1`. */
  share: number;
}

/**
 * Colour distribution of the spells (node `10:250`).
 *
 * Lands are excluded, matching the design's own reading — its sample deck is 22
 * lands and the ring shows only "Black / Red / Colorless" spells. A gold or
 * hybrid card contributes its full quantity to every colour it contains, so the
 * counts intentionally sum to more than the card count; `share` normalises
 * against that sum, which is how a pie of colour identity has to work.
 */
export function deckColorDistribution(cards: readonly CardInDeck[] | null | undefined): DeckColorSlice[] {
  const counts = new Map<ManaColor, number>();

  for (const card of cards ?? []) {
    const quantity = quantityOf(card);
    if (quantity === 0) continue;
    if (categoriseCard(card) === 'lands') continue;

    const colors = manaColorsOf(card.mana_cost);
    const keys: ManaColor[] = colors.length > 0 ? colors : ['C'];
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + quantity);
  }

  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];

  return MANA_COLORS.flatMap((color) => {
    const count = counts.get(color) ?? 0;
    if (count === 0) return [];
    return [{ color, count, share: count / total }];
  });
}

export const MANA_COLOR_NAMES: Record<ManaColor, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};

/* ----------------------------------------------------------------- export */

/** Plain-text decklist, the payload behind the design's "Export TXT" action. */
export function deckListText(deck: DeckResponse): string {
  const header = [deck.title?.trim() || 'Untitled deck', `${deck.format} · ${deck.card_count} cards`];
  const sections = groupDeckCards(deck.cards).map((section) => {
    const rows = section.cards.map((card) => `${quantityOf(card)} ${card.name}`);
    return [`${section.label} · ${section.count}`, ...rows].join('\n');
  });
  return [...header, '', ...sections].join('\n').concat('\n');
}

/** Filesystem-safe basename for the exported list. */
export function deckFileName(deck: DeckResponse): string {
  const base = (deck.title?.trim() || 'magic-grimoire-deck')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'magic-grimoire-deck'}.txt`;
}

/* ----------------------------------------------------------- config → API */

/**
 * Deck-size bounds. `DeckGenerateRequest` server-side allows `60..250`; the
 * builder deliberately stops at 200 — the upper stretch was never a deck
 * anyone asked for, and a shorter slider run is the whole point. Any value in
 * this range is still a valid request body. `DECK_SIZE_STEP` is the slider's
 * granularity.
 */
export const DECK_SIZE_MIN = 60;
export const DECK_SIZE_MAX = 200;
export const DECK_SIZE_STEP = 5;

/**
 * Commander is a singleton 100-card format — the deck is exactly 100 cards,
 * commander included. That is a rule of the format, not a preference, so the
 * range collapses to a pinned 100 and the fields go read-only rather than
 * letting the builder ask the generator for an illegal deck.
 */
export const COMMANDER_DECK_SIZE = 100;

/** Formats whose card count is fixed by the rules and cannot be chosen. */
export function isFixedSizeFormat(format: DeckFormat): boolean {
  return format === 'commander';
}

/** The size the rules pin `format` to, or `null` when the count is free. */
export function fixedDeckSize(format: DeckFormat): number | null {
  return format === 'commander' ? COMMANDER_DECK_SIZE : null;
}
/** `prompt` is `1..2000` chars in `app/decks/dtos.py`. */
export const PROMPT_MAX = 2000;

/** Above this the budget slider is treated as "no ceiling" and is not sent. */
export const BUDGET_MAX = 500;
export const BUDGET_MIN = 10;

export interface DeckConfig {
  /**
   * `MTGColor`, so colourless `C` is pickable — `DeckGenerateRequest.colors` is
   * `list[MTGColor]` server-side and accepts it. The chat endpoint's
   * `_ManaColor` does NOT, so `chatColors` strips `C` on the way out.
   */
  colors: MTGColor[];
  format: DeckFormat;
  /**
   * Deck size is a range, not a number, so the generator has room to land on a
   * legal curve. `DeckGenerateRequest.deck_size` is a single `int` server-side
   * (`compose_deck` prompts "Total quantity must equal {deck_size}"), so the
   * floor is what gets sent and the ceiling rides along in the prompt — the
   * same escape hatch `budget` uses. Collapse the two to pin an exact size.
   */
  deckSizeMin: number;
  deckSizeMax: number;
  budget: number;
}

export const DEFAULT_DECK_CONFIG: DeckConfig = {
  colors: [],
  format: 'standard',
  deckSizeMin: 60,
  deckSizeMax: 75,
  budget: 150,
};

/** WUBRG+C order, so the request body is stable no matter the click order. */
export function toggleDeckColor(colors: readonly MTGColor[], color: MTGColor): MTGColor[] {
  const next = new Set(colors);
  if (next.has(color)) next.delete(color);
  else next.add(color);
  return MTG_COLORS.filter((candidate) => next.has(candidate));
}

/**
 * The subset the chat endpoint accepts. `app/chat/dtos.py` types its context
 * colours as `Literal["W","U","B","R","G"]`, so sending `C` would 422 the whole
 * turn — dropping it keeps the rest of the picker's selection as context.
 */
export function chatColors(colors: readonly MTGColor[]): ChatColor[] {
  return colors.filter((color): color is ChatColor => color !== 'C');
}

export function clampDeckSize(size: number): number {
  if (!Number.isFinite(size)) return DECK_SIZE_MIN;
  return Math.min(DECK_SIZE_MAX, Math.max(DECK_SIZE_MIN, Math.round(size)));
}

/**
 * Switches format, applying whatever card count the format's rules require.
 *
 * Commander pins the range to exactly 100. Coming back out of a fixed-size
 * format restores the defaults rather than the count you had before it: the
 * pinned 100 overwrote that, and a remembered-range field on `DeckConfig`
 * would exist only to survive this one round trip.
 */
export function setDeckFormat(config: DeckConfig, format: DeckFormat): DeckConfig {
  const fixed = fixedDeckSize(format);
  if (fixed !== null) {
    return { ...config, format, deckSizeMin: fixed, deckSizeMax: fixed };
  }
  if (!isFixedSizeFormat(config.format)) return { ...config, format };
  return {
    ...config,
    format,
    deckSizeMin: DEFAULT_DECK_CONFIG.deckSizeMin,
    deckSizeMax: DEFAULT_DECK_CONFIG.deckSizeMax,
  };
}

/**
 * Moves one end of the deck-size range and pushes the other out of the way,
 * so the two thumbs can be dragged past each other without the range ever
 * inverting. Equal ends are allowed — that is how you ask for an exact size.
 */
export function setDeckSizeBound(
  config: DeckConfig,
  end: 'min' | 'max',
  value: number,
): DeckConfig {
  // A fixed-size format owns the count. The fields are disabled in the panel,
  // so this only catches a programmatic caller — but the rule lives here, not
  // in the markup, so it holds either way.
  if (isFixedSizeFormat(config.format)) return config;

  const size = clampDeckSize(value);
  return end === 'min'
    ? { ...config, deckSizeMin: size, deckSizeMax: Math.max(size, config.deckSizeMax) }
    : { ...config, deckSizeMax: size, deckSizeMin: Math.min(size, config.deckSizeMin) };
}

/**
 * Composes the `prompt` field from the conversation plus the config panel.
 *
 * Every user turn is included, not just the last one: the chat panel exists to
 * refine an idea, so "competitive Rakdos sacrifice" followed by "keep the curve
 * low" has to reach the generator as one brief.
 *
 * Budget has NO field in `DeckGenerateRequest` — the backend does not model it.
 * Rather than render a dead control or drop a control the design has, it is
 * folded into the prompt, which is exactly the surface the pipeline's
 * `parse_intent` step reads. The deck-size ceiling rides along the same way:
 * `deck_size` carries the floor, and the prompt says how far past it the
 * generator may go.
 *
 * Returns `''` when there is nothing to build from; the qualifiers alone are
 * not a deck description.
 */
export function buildGeneratePrompt(
  userTurns: readonly string[],
  draft: string,
  config: DeckConfig,
): string {
  const parts = [...userTurns, draft].map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return '';

  const qualifiers: string[] = [];
  if (isFixedSizeFormat(config.format)) {
    // `deck_size` already carries 100, but the composer prompt is where the
    // singleton rule has to land — a 100-card Commander deck with four copies
    // of a card is still an illegal deck.
    qualifiers.push(
      `This is a Commander deck: exactly ${COMMANDER_DECK_SIZE} cards including the ` +
        'commander, singleton — one copy of every card except basic lands.',
    );
  } else if (config.deckSizeMax > config.deckSizeMin) {
    qualifiers.push(
      `Anywhere from ${config.deckSizeMin} to ${config.deckSizeMax} cards is fine — ` +
        'use the room if the curve needs it.',
    );
  }
  if (config.budget < BUDGET_MAX) qualifiers.push(`Keep the total budget under $${config.budget}.`);

  return [...parts, ...qualifiers].join(' ').slice(0, PROMPT_MAX).trim();
}
