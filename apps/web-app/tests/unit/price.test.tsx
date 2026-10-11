import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DeckPrice } from '../../app/components/DeckPrice/DeckPrice';
import { deckPriceFields, formatEur } from '../../app/lib/price';
import type { CardInDeck } from '../../app/types/api';

afterEach(cleanup);

function card(quantity: number, price_eur: string | null | undefined): CardInDeck {
  return {
    name: 'x',
    quantity,
    scryfall_id: null,
    image_uri: null,
    mana_cost: null,
    type_line: null,
    section: 'spells',
    ...(price_eur === undefined ? {} : { price_eur }),
  };
}

describe('formatEur', () => {
  it.each([
    ['12.34', '€12.34'],
    ['0.5', '€0.50'],
    ['10', '€10.00'],
    ['1234.5', '€1,234.50'],
    [7.1, '€7.10'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatEur(value)).toBe(expected);
  });

  it.each([null, undefined, '', 'abc', '-1', 'NaN'])('shows a placeholder for %s', (value) => {
    expect(formatEur(value)).toBe('—');
  });
});

describe('deckPriceFields', () => {
  it('sums quantity × price in cents, as the server does', () => {
    expect(deckPriceFields([card(4, '0.10'), card(3, '0.20'), card(1, '10')])).toEqual({
      total_price_eur: '11.00',
      unpriced_card_count: 0,
    });
  });

  it('counts unpriced copies, including cards from before prices existed', () => {
    expect(deckPriceFields([card(4, '0.25'), card(2, null), card(1, undefined)])).toEqual({
      total_price_eur: '1.00',
      unpriced_card_count: 3,
    });
  });

  it('has no total when no card is priced', () => {
    expect(deckPriceFields([card(2, null)])).toEqual({ total_price_eur: null, unpriced_card_count: 2 });
    expect(deckPriceFields(null)).toEqual({ total_price_eur: null, unpriced_card_count: 0 });
  });
});

describe('DeckPrice', () => {
  it('shows a complete total without a partial flag', () => {
    render(<DeckPrice total="42.10" unpricedCount={0} />);
    expect(screen.getByText('€42.10')).toBeInTheDocument();
    expect(screen.queryByText(/partial/i)).not.toBeInTheDocument();
  });

  it('flags the total as partial when some cards have no price', () => {
    render(<DeckPrice total="42.10" unpricedCount={3} />);
    expect(screen.getByText('€42.10')).toBeInTheDocument();
    const flag = screen.getByText(/partial/i);
    expect(flag).toHaveAttribute('title', '3 cards have no price and are not counted');
  });

  it('shows a placeholder when nothing is priced', () => {
    render(<DeckPrice total={null} unpricedCount={5} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/partial/i)).not.toBeInTheDocument();
  });

  it('treats an older API with no price fields as unpriced', () => {
    render(<DeckPrice total={undefined} unpricedCount={undefined} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
