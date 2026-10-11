import type { CardInDeck, DeckResponse } from '../types/api';

/* ==========================================================================
   Euro prices (MTG-26)
   --------------------------------------------------------------------------
   Prices cross the wire as decimal strings (Scryfall's `prices.eur`), and the
   server computes a deck's `total_price_eur` from its cards. The client
   mirrors that sum only for optimistic edits, in integer cents so it never
   drifts from the server's Decimal arithmetic.
   ========================================================================== */

/** Shown wherever a card or deck has no euro price. */
export const NO_PRICE = '—';

const EUR = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

/** A sane euro amount, or `null` for a missing, malformed or negative one. */
function parseEur(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** `€12.34`, or the `—` placeholder when there is no usable price. */
export function formatEur(value: string | number | null | undefined): string {
  const amount = parseEur(value);
  return amount === null ? NO_PRICE : EUR.format(amount);
}

export type DeckPriceFields = Pick<DeckResponse, 'total_price_eur' | 'unpriced_card_count'>;

/**
 * The deck's price fields as the server would compute them from `cards`:
 * the sum of quantity × `price_eur`, and the quantity-weighted count of cards
 * left out of it for lack of a price. `null` total when nothing is priced.
 */
export function deckPriceFields(cards: readonly CardInDeck[] | null | undefined): DeckPriceFields {
  let cents = 0;
  let priced = false;
  let unpriced = 0;
  for (const card of cards ?? []) {
    const quantity = Math.max(0, Math.trunc(card.quantity || 0));
    const price = parseEur(card.price_eur);
    if (price === null) {
      unpriced += quantity;
      continue;
    }
    cents += Math.round(price * 100) * quantity;
    priced = true;
  }
  return {
    total_price_eur: priced ? (cents / 100).toFixed(2) : null,
    unpriced_card_count: unpriced,
  };
}
