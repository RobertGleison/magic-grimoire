import { formatEur } from '../../lib/price';
import './DeckPrice.css';

/* ==========================================================================
   DeckPrice — a deck's total in euros (MTG-26), no Figma source.
   --------------------------------------------------------------------------
   Renders the server's `total_price_eur` and, when some cards have no euro
   price, a "partial" flag saying how many were left out — a total that
   silently ignores cards would read as the real cost of the deck.
   ========================================================================== */

interface DeckPriceProps {
  /** `DeckResponse.total_price_eur`; absent on an older API. */
  total: string | null | undefined;
  /** `DeckResponse.unpriced_card_count`; absent on an older API. */
  unpricedCount: number | null | undefined;
  /** Visible label before the amount, e.g. "Price". Omit for the bare amount. */
  label?: string;
  className?: string;
}

export function DeckPrice({ total, unpricedCount, label = '', className = '' }: DeckPriceProps) {
  const amount = formatEur(total);
  const missing = unpricedCount ?? 0;
  const partial = total !== null && total !== undefined && missing > 0;

  return (
    <span className={`deck-price ${className}`.trim()}>
      {label ? <span className="deck-price-label">{label}</span> : null}
      <span className="deck-price-amount">{amount}</span>
      {partial ? (
        <span
          className="deck-price-partial"
          title={`${missing} ${missing === 1 ? 'card has' : 'cards have'} no price and ${missing === 1 ? 'is' : 'are'} not counted`}
        >
          partial
          <span className="visually-hidden">{`, ${missing} unpriced`}</span>
        </span>
      ) : null}
    </span>
  );
}
