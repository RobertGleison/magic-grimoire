/**
 * MTG-21 — "Export TXT" writes MTG Arena's import format.
 */

import { describe, expect, it } from 'vitest';

import {
  arenaCardName,
  arenaDeckList,
  arenaExportNote,
  arenaSetCode,
} from '../../app/deck-builder/arenaExport';
import type { CardInDeck } from '../../app/types/api';

function card(overrides: Partial<CardInDeck> & Pick<CardInDeck, 'name'>): CardInDeck {
  return {
    quantity: 1,
    scryfall_id: null,
    image_uri: null,
    mana_cost: null,
    type_line: 'Instant',
    section: 'mainboard',
    set_code: 'M10',
    collector_number: '146',
    on_arena: true,
    arena_name: overrides.name,
    ...overrides,
  };
}

describe('arenaDeckList', () => {
  it('writes the Deck and Sideboard blocks in Arena import format', () => {
    const { text, unmatched, unverified } = arenaDeckList([
      card({ name: 'Lightning Bolt', quantity: 4 }),
      card({ name: 'Mountain', quantity: 20, type_line: 'Basic Land — Mountain', set_code: 'ANA', collector_number: '59' }),
      card({ name: 'Smash to Smithereens', quantity: 2, section: 'sideboard', set_code: 'ELD', collector_number: '139' }),
    ]);

    expect(text).toBe(
      [
        'Deck',
        '4 Lightning Bolt (M10) 146',
        '20 Mountain (ANA) 59',
        '',
        'Sideboard',
        '2 Smash to Smithereens (ELD) 139',
        '',
      ].join('\n'),
    );
    expect(unmatched).toEqual([]);
    expect(unverified).toEqual([]);
  });

  it('omits the Sideboard block when there is no sideboard', () => {
    expect(arenaDeckList([card({ name: 'Shock', quantity: 4 })]).text).toBe('Deck\n4 Shock (M10) 146\n');
  });

  it('aggregates duplicate entries into one line per card per board', () => {
    const { text } = arenaDeckList([
      card({ name: 'Mountain', quantity: 10, type_line: 'Basic Land — Mountain' }),
      card({ name: 'Shock', quantity: 2 }),
      card({ name: 'Mountain', quantity: 8, type_line: 'Basic Land — Mountain' }),
      card({ name: 'Shock', quantity: 1, section: 'sideboard' }),
    ]);

    expect(text).toBe('Deck\n18 Mountain (M10) 146\n2 Shock (M10) 146\n\nSideboard\n1 Shock (M10) 146\n');
  });

  it('uses the Arena name for multi-face cards', () => {
    const { text } = arenaDeckList([
      card({ name: 'Delver of Secrets // Insectile Aberration', arena_name: 'Delver of Secrets' }),
      card({ name: 'Fire // Ice', arena_name: 'Fire // Ice' }),
    ]);

    expect(text).toContain('1 Delver of Secrets (M10) 146');
    expect(text).toContain('1 Fire // Ice (M10) 146');
  });

  it('leaves out and flags cards with no Arena printing', () => {
    const result = arenaDeckList([
      card({ name: 'Lightning Bolt', quantity: 4 }),
      card({ name: 'Black Lotus', on_arena: false, set_code: 'LEA', collector_number: '232' }),
    ]);

    expect(result.text).toBe('Deck\n4 Lightning Bolt (M10) 146\n');
    expect(result.unmatched).toEqual(['Black Lotus']);
    expect(arenaExportNote(result)).toContain('Black Lotus');
  });

  it('writes name-only lines for cards enriched before printing data existed', () => {
    const legacy = card({ name: 'Shock', quantity: 4 });
    delete legacy.set_code;
    delete legacy.collector_number;
    delete legacy.on_arena;
    delete legacy.arena_name;

    const result = arenaDeckList([legacy]);

    expect(result.text).toBe('Deck\n4 Shock\n');
    expect(result.unverified).toEqual(['Shock']);
    expect(arenaExportNote(result)).toMatch(/1 card\b/);
  });

  it('skips zero-quantity and malformed entries', () => {
    const { text } = arenaDeckList([
      card({ name: 'Shock', quantity: 0 }),
      card({ name: 'Bolt', quantity: Number.NaN }),
      card({ name: 'Opt', quantity: 1 }),
    ]);

    expect(text).toBe('Deck\n1 Opt (M10) 146\n');
  });

  it('handles an empty deck', () => {
    expect(arenaDeckList(null).text).toBe('Deck\n');
  });
});

describe('arenaSetCode', () => {
  it('upper-cases Scryfall codes and maps the ones Arena renamed', () => {
    expect(arenaSetCode('m10')).toBe('M10');
    expect(arenaSetCode('dom')).toBe('DAR');
  });
});

describe('arenaCardName', () => {
  it('falls back to the front face when the backend sent no Arena name', () => {
    expect(arenaCardName(card({ name: 'Bonecrusher Giant // Stomp', arena_name: null }))).toBe('Bonecrusher Giant');
  });
});

describe('arenaExportNote', () => {
  it('confirms a clean export', () => {
    expect(arenaExportNote({ text: 'Deck\n', unmatched: [], unverified: [] })).toBe(
      'Decklist downloaded in Arena format.',
    );
  });
});
