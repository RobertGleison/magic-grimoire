// ─── MTG Colors ──────────────────────────────────────────────────────────────

export const ManaColor = {
  WHITE: 'WHITE',
  BLUE: 'BLUE',
  BLACK: 'BLACK',
  RED: 'RED',
  GREEN: 'GREEN',
  COLORLESS: 'COLORLESS',
} as const;

export type ManaColor = (typeof ManaColor)[keyof typeof ManaColor];
export const ALL_COLORS = Object.values(ManaColor);

export const BASIC_COLORS = [
  ManaColor.WHITE,
  ManaColor.BLUE,
  ManaColor.BLACK,
  ManaColor.RED,
  ManaColor.GREEN,
] as const;


export const COLOR_LABEL: Record<string, string> = {
  WHITE: 'White',
  BLUE: 'Blue',
  BLACK: 'Black',
  RED: 'Red',
  GREEN: 'Green',
  COLORLESS: 'Colorless',
};

export const COLOR_HEX: Record<string, string> = {
  WHITE: '#f0ead8',
  BLUE: '#1460a8',
  BLACK: '#000000',
  RED: '#c81808',
  GREEN: '#0f6030',
  COLORLESS: '#7a7a8a',
};

// ─── Formats ─────────────────────────────────────────────────────────────────

export const Format = {
  STANDARD: 'Standard',
  MODERN: 'Modern',
  PIONEER: 'Pioneer',
  LEGACY: 'Legacy',
  COMMANDER: 'Commander',
} as const;

export type Format = (typeof Format)[keyof typeof Format];
export const ALL_FORMATS = Object.values(Format);

// ─── Archetypes ──────────────────────────────────────────────────────────────

export const Archetype = {
  ANY: 'Any',
  AGGRO: 'Aggro',
  MIDRANGE: 'Midrange',
  CONTROL: 'Control',
  COMBO: 'Combo',
  TRIBAL: 'Tribal',
  RAMP: 'Ramp',
  TEMPO: 'Tempo',
} as const;

export type Archetype = (typeof Archetype)[keyof typeof Archetype];
export const ALL_ARCHETYPES = Object.values(Archetype);

// ─── Strategies ──────────────────────────────────────────────────────────────

export const Strategy = {
  BALANCED: 'Balanced',
  AGGRESSIVE: 'Aggressive',
  DEFENSIVE: 'Defensive',
  BUDGET: 'Budget',
  SPICY: 'Spicy',
} as const;

export type Strategy = (typeof Strategy)[keyof typeof Strategy];
export const ALL_STRATEGIES = Object.values(Strategy);
