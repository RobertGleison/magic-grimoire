/**
 * MTG Arena import format — the payload behind "Export TXT".
 *
 * Arena's importer (Decks → Import) reads:
 *
 *   Deck
 *   4 Lightning Bolt (M10) 146
 *   20 Mountain (ANA) 59
 *
 *   Sideboard
 *   2 Smash to Smithereens (ELD) 139
 *
 * Pure — no React, no DOM.
 */

import type { CardInDeck } from '../types/api';
import { categoriseCard, quantityOf } from './deckLogic';

/**
 * Sets whose Arena code differs from Scryfall's. Arena rejects the Scryfall
 * code for these, so the line would fail to import.
 */
const ARENA_SET_CODES: Record<string, string> = {
  DOM: 'DAR',
};

export function arenaSetCode(setCode: string): string {
  const upper = setCode.toUpperCase();
  return ARENA_SET_CODES[upper] ?? upper;
}

/**
 * Arena names multi-face cards by their front face ("Delver of Secrets"),
 * except split/aftermath cards, which keep both halves. The backend computes
 * this from the card's layout (`arena_name`); decks enriched before that field
 * existed fall back to the front face.
 */
export function arenaCardName(card: CardInDeck): string {
  return card.arena_name?.trim() || card.name.split(' // ')[0].trim();
}

export interface ArenaExport {
  /** The file body. Ends with a newline. */
  text: string;
  /** Cards with no Arena printing — left out of `text` so the import doesn't fail. */
  unmatched: string[];
  /**
   * Cards without printing data (decks generated before it was stored). They
   * are written as `<qty> <name>`, which Arena resolves by name, but whether
   * they exist on Arena could not be checked.
   */
  unverified: string[];
}

interface ArenaLine {
  name: string;
  quantity: number;
  printing: string | null;
}

function formatLine({ quantity, name, printing }: ArenaLine): string {
  return printing ? `${quantity} ${name} ${printing}` : `${quantity} ${name}`;
}

function printingOf(card: CardInDeck): string | null {
  const set = card.set_code?.trim();
  const number = card.collector_number?.trim();
  return set && number ? `(${arenaSetCode(set)}) ${number}` : null;
}

/**
 * Builds the Arena import text, one line per card per board (duplicates are
 * summed; the first printing seen wins).
 */
export function arenaDeckList(cards: readonly CardInDeck[] | null | undefined): ArenaExport {
  const main = new Map<string, ArenaLine>();
  const side = new Map<string, ArenaLine>();
  const unmatched = new Set<string>();
  const unverified = new Set<string>();

  for (const card of cards ?? []) {
    const quantity = quantityOf(card);
    if (quantity === 0) continue;

    const name = arenaCardName(card);
    if (!name) continue;

    if (card.on_arena === false) {
      unmatched.add(name);
      continue;
    }

    const printing = card.on_arena ? printingOf(card) : null;
    if (!printing) unverified.add(name);

    const board = categoriseCard(card) === 'sideboard' ? side : main;
    const existing = board.get(name);
    if (existing) {
      existing.quantity += quantity;
      existing.printing ??= printing;
    } else {
      board.set(name, { name, quantity, printing });
    }
  }

  const blocks = [['Deck', ...[...main.values()].map(formatLine)].join('\n')];
  if (side.size > 0) blocks.push(['Sideboard', ...[...side.values()].map(formatLine)].join('\n'));

  return {
    text: `${blocks.join('\n\n')}\n`,
    unmatched: [...unmatched],
    unverified: [...unverified],
  };
}

/** User-facing status line for an export, flagging anything that was dropped or unchecked. */
export function arenaExportNote({ unmatched, unverified }: ArenaExport): string {
  if (unmatched.length > 0) {
    return `Decklist downloaded — not on Arena, left out: ${unmatched.join(', ')}.`;
  }
  if (unverified.length > 0) {
    return `Decklist downloaded — no Arena printing on file for ${unverified.length} card${
      unverified.length === 1 ? '' : 's'
    }, regenerate to verify.`;
  }
  return 'Decklist downloaded in Arena format.';
}
