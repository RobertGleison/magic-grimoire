import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ManaSymbol, ManaCost } from '../../app/components/ManaSymbol/ManaSymbol';

describe('ManaSymbol', () => {
  it.each([
    ['W', 'white'],
    ['U', 'blue'],
    ['B', 'black'],
    ['R', 'red'],
    ['G', 'green'],
    ['C', 'colorless'],
  ])('renders correct src for %s', (symbol, name) => {
    render(<ManaSymbol symbol={symbol} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', `/assets/mana-${name}.png`);
  });

  it('falls back to symbol value for unknown codes', () => {
    render(<ManaSymbol symbol="X" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/assets/mana-x.png');
  });

  it('sets alt text to {symbol}', () => {
    render(<ManaSymbol symbol="W" />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', '{W}');
  });

  it('applies size prop to width and height', () => {
    render(<ManaSymbol symbol="R" size={32} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '32');
    expect(img).toHaveAttribute('height', '32');
  });

  it('defaults to size 16', () => {
    render(<ManaSymbol symbol="G" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '16');
    expect(img).toHaveAttribute('height', '16');
  });
});

describe('ManaCost', () => {
  it('returns null for empty string', () => {
    const { container } = render(<ManaCost cost="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when cost has no parseable symbols', () => {
    const { container } = render(<ManaCost cost="no brackets here" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one symbol per token', () => {
    render(<ManaCost cost="{W}{U}{B}" />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('sets aria-label to the full cost string', () => {
    render(<ManaCost cost="{R}{G}" />);
    expect(screen.getByLabelText('{R}{G}')).toBeInTheDocument();
  });

  it('renders each symbol with correct src', () => {
    render(<ManaCost cost="{R}{G}" />);
    const imgs = screen.getAllByRole('img');
    expect(imgs[0]).toHaveAttribute('src', '/assets/mana-red.png');
    expect(imgs[1]).toHaveAttribute('src', '/assets/mana-green.png');
  });

  it('applies size prop to each symbol', () => {
    render(<ManaCost cost="{W}{U}" size={20} />);
    screen.getAllByRole('img').forEach(img => {
      expect(img).toHaveAttribute('width', '20');
    });
  });
});
