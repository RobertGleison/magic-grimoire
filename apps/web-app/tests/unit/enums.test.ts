import { describe, it, expect } from 'vitest';
import { SELECTABLE_COLORS, ManaColor, toggleDeckColor, toBackendColors } from '../../app/enums';

describe('SELECTABLE_COLORS', () => {
  it('includes colorless after the five basic colors', () => {
    expect(SELECTABLE_COLORS).toEqual([
      ManaColor.WHITE, ManaColor.BLUE, ManaColor.BLACK, ManaColor.RED, ManaColor.GREEN, ManaColor.COLORLESS,
    ]);
  });
});

describe('toggleDeckColor', () => {
  it('adds a color that is not selected', () => {
    expect(toggleDeckColor([], ManaColor.WHITE)).toEqual([ManaColor.WHITE]);
  });

  it('removes a color that is already selected', () => {
    expect(toggleDeckColor([ManaColor.WHITE], ManaColor.WHITE)).toEqual([]);
  });

  it('selecting colorless clears any basic colors', () => {
    expect(toggleDeckColor([ManaColor.WHITE, ManaColor.BLUE], ManaColor.COLORLESS)).toEqual([ManaColor.COLORLESS]);
  });

  it('selecting a basic color clears colorless', () => {
    expect(toggleDeckColor([ManaColor.COLORLESS], ManaColor.RED)).toEqual([ManaColor.RED]);
  });
});

describe('toBackendColors', () => {
  it('returns undefined when nothing is selected', () => {
    expect(toBackendColors([])).toBeUndefined();
  });

  it('maps full color names to backend letter codes', () => {
    expect(toBackendColors([ManaColor.WHITE, ManaColor.BLUE])).toEqual(['W', 'U']);
  });

  it('maps colorless to C', () => {
    expect(toBackendColors([ManaColor.COLORLESS])).toEqual(['C']);
  });
});
