/**
 * Wave 3b — deck builder.
 *
 * Two halves:
 *   1. `deckLogic` — pure, so it is tested directly with no DOM.
 *   2. The screen — rendered against a stubbed `fetch` and a stubbed
 *      `EventSource`, so every branch of the pipeline (all six `TaskProgress`
 *      values, a transport drop, an already-finished task, and `ApiError`)
 *      is reachable without a backend.
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setAuthTokenProvider } from '../../app/lib/apiClient';
import type { CardInDeck, DeckResponse } from '../../app/types/api';
import DeckBuilderPage from '../../app/deck-builder/page';
import {
  BUDGET_MAX,
  COMMANDER_DECK_SIZE,
  DEFAULT_DECK_CONFIG,
  buildGeneratePrompt,
  categoriseCard,
  chatColors,
  clampDeckSize,
  deckColorDistribution,
  deckFileName,
  deckListText,
  deckSummaryStats,
  groupDeckCards,
  isFixedSizeFormat,
  setDeckFormat,
  setDeckSizeBound,
  toggleDeckColor,
} from '../../app/deck-builder/deckLogic';

/* ------------------------------------------------------------- fixtures */

function card(partial: Partial<CardInDeck> & { name: string }): CardInDeck {
  return {
    quantity: 1,
    scryfall_id: null,
    image_uri: null,
    mana_cost: null,
    type_line: null,
    section: 'mainboard',
    ...partial,
  };
}

const CARDS: CardInDeck[] = [
  card({ name: 'Cauldron Familiar', quantity: 4, mana_cost: '{B}', type_line: 'Creature — Cat' }),
  card({ name: 'Mayhem Devil', quantity: 4, mana_cost: '{1}{B}{R}', type_line: 'Creature — Devil' }),
  card({ name: 'Deadly Dispute', quantity: 4, mana_cost: '{1}{B}', type_line: 'Instant' }),
  card({ name: "Witch's Oven", quantity: 2, mana_cost: '{1}', type_line: 'Artifact' }),
  card({ name: 'Blood Crypt', quantity: 4, mana_cost: '', type_line: 'Land — Swamp Mountain' }),
  card({ name: 'Duress', quantity: 2, mana_cost: '{B}', type_line: 'Sorcery', section: 'sideboard' }),
];

function deckFixture(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-1',
    title: 'Rakdos Sacrifice',
    prompt: 'A competitive Rakdos sacrifice deck',
    format: 'standard',
    colors: ['B', 'R'],
    cards: CARDS,
    card_count: 20,
    status: 'completed',
    error_message: null,
    created_at: '2026-01-01T00:00:00Z',
    completed_at: '2026-01-01T00:01:00Z',
    failed_at: null,
    ...overrides,
  };
}

/* ==========================================================================
   1. Pure logic
   ========================================================================== */

describe('categoriseCard', () => {
  it('routes anything flagged sideboard by `section` before looking at the type line', () => {
    expect(categoriseCard(card({ name: 'Duress', type_line: 'Sorcery', section: 'sideboard' }))).toBe(
      'sideboard',
    );
  });

  it('treats a land-creature as a land, matching CardTile and ManaCurve', () => {
    expect(categoriseCard(card({ name: 'Dryad Arbor', type_line: 'Land Creature — Forest Dryad' }))).toBe(
      'lands',
    );
  });

  it('maps the remaining type lines onto the design sections', () => {
    expect(categoriseCard(card({ name: 'a', type_line: 'Creature — Cat' }))).toBe('creatures');
    expect(categoriseCard(card({ name: 'b', type_line: 'Instant' }))).toBe('spells');
    expect(categoriseCard(card({ name: 'c', type_line: 'Sorcery' }))).toBe('spells');
    expect(categoriseCard(card({ name: 'd', type_line: 'Artifact' }))).toBe('artifacts');
    expect(categoriseCard(card({ name: 'e', type_line: 'Enchantment' }))).toBe('artifacts');
    expect(categoriseCard(card({ name: 'f', type_line: 'Planeswalker — Liliana' }))).toBe('planeswalkers');
  });

  it('falls back to `other` for an un-enriched card with no type line', () => {
    expect(categoriseCard(card({ name: 'Unknown' }))).toBe('other');
  });
});

describe('groupDeckCards', () => {
  it('emits sections in display order with quantity-weighted counts', () => {
    const sections = groupDeckCards(CARDS);
    expect(sections.map((section) => section.category)).toEqual([
      'creatures',
      'spells',
      'artifacts',
      'lands',
      'sideboard',
    ]);
    expect(sections[0].count).toBe(8);
    expect(sections[3].label).toBe('Lands');
  });

  it('drops empty sections and survives null cards', () => {
    expect(groupDeckCards(null)).toEqual([]);
    expect(groupDeckCards([])).toEqual([]);
  });
});

describe('deckSummaryStats', () => {
  it('splits lands, creatures and everything else without double counting', () => {
    const stats = deckSummaryStats(CARDS);
    expect(stats.total).toBe(20);
    expect(stats.lands).toBe(4);
    expect(stats.creatures).toBe(8);
    expect(stats.nonCreature).toBe(20 - 4 - 8);
  });

  it('averages mana value over the non-land cards only', () => {
    const stats = deckSummaryStats([
      card({ name: 'one', quantity: 2, mana_cost: '{1}{B}', type_line: 'Instant' }),
      card({ name: 'land', quantity: 10, mana_cost: '', type_line: 'Land' }),
    ]);
    expect(stats.averageCmc).toBe(2);
  });

  it('reports zero rather than NaN for a landless, spelless deck', () => {
    expect(deckSummaryStats([]).averageCmc).toBe(0);
  });
});

describe('deckColorDistribution', () => {
  it('weights by quantity, excludes lands and normalises the shares', () => {
    const slices = deckColorDistribution(CARDS);
    const total = slices.reduce((sum, slice) => sum + slice.share, 0);
    expect(total).toBeCloseTo(1);
    expect(slices.map((slice) => slice.color)).toEqual(['B', 'R', 'C']);
  });

  it('counts a colourless spell as C and a gold spell in both colours', () => {
    const slices = deckColorDistribution([
      card({ name: 'gold', quantity: 1, mana_cost: '{B}{R}', type_line: 'Creature' }),
      card({ name: 'grey', quantity: 1, mana_cost: '{2}', type_line: 'Artifact' }),
    ]);
    expect(slices.map((slice) => [slice.color, slice.count])).toEqual([
      ['B', 1],
      ['R', 1],
      ['C', 1],
    ]);
  });

  it('returns nothing for an empty or land-only deck', () => {
    expect(deckColorDistribution([card({ name: 'l', type_line: 'Land' })])).toEqual([]);
  });
});

describe('deckListText / deckFileName', () => {
  it('writes a section-grouped plain-text list', () => {
    const text = deckListText(deckFixture());
    expect(text).toContain('Rakdos Sacrifice');
    expect(text).toContain('Creatures · 8');
    expect(text).toContain('4 Cauldron Familiar');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('slugs the title and always ends in .txt', () => {
    expect(deckFileName(deckFixture())).toBe('rakdos-sacrifice.txt');
    expect(deckFileName(deckFixture({ title: null }))).toBe('magic-grimoire-deck.txt');
  });
});

describe('config helpers', () => {
  it('toggles colours back into WUBRG order, colourless last', () => {
    expect(toggleDeckColor(['R'], 'B')).toEqual(['B', 'R']);
    expect(toggleDeckColor(['B', 'R'], 'B')).toEqual(['R']);
    expect(toggleDeckColor(['C', 'R'], 'W')).toEqual(['W', 'R', 'C']);
  });

  it('strips colourless from the chat context, which the endpoint rejects', () => {
    expect(chatColors(['W', 'C', 'R'])).toEqual(['W', 'R']);
    expect(chatColors(['C'])).toEqual([]);
  });

  it('clamps the deck size to the builder\'s 60..200', () => {
    expect(clampDeckSize(10)).toBe(60);
    expect(clampDeckSize(400)).toBe(200);
    expect(clampDeckSize(201)).toBe(200);
    expect(clampDeckSize(200)).toBe(200);
    expect(clampDeckSize(Number.NaN)).toBe(60);
  });

  it('pins the range to 100 for Commander — the format\u2019s own rule', () => {
    const commander = setDeckFormat(DEFAULT_DECK_CONFIG, 'commander');
    expect(commander.deckSizeMin).toBe(COMMANDER_DECK_SIZE);
    expect(commander.deckSizeMax).toBe(COMMANDER_DECK_SIZE);
    expect(isFixedSizeFormat('commander')).toBe(true);
  });

  it('leaves the count alone for every format that does not fix one', () => {
    for (const format of ['standard', 'modern', 'pioneer', 'legacy'] as const) {
      const next = setDeckFormat({ ...DEFAULT_DECK_CONFIG, deckSizeMin: 70, deckSizeMax: 80 }, format);
      expect([next.deckSizeMin, next.deckSizeMax]).toEqual([70, 80]);
      expect(isFixedSizeFormat(format)).toBe(false);
    }
  });

  it('restores the default range on the way back out of Commander', () => {
    const commander = setDeckFormat(DEFAULT_DECK_CONFIG, 'commander');
    const back = setDeckFormat(commander, 'modern');
    expect(back.deckSizeMin).toBe(DEFAULT_DECK_CONFIG.deckSizeMin);
    expect(back.deckSizeMax).toBe(DEFAULT_DECK_CONFIG.deckSizeMax);
  });

  it('refuses to move either bound while a fixed-size format is selected', () => {
    const commander = setDeckFormat(DEFAULT_DECK_CONFIG, 'commander');
    expect(setDeckSizeBound(commander, 'min', 60)).toBe(commander);
    expect(setDeckSizeBound(commander, 'max', 200)).toBe(commander);
  });
});

describe('buildGeneratePrompt', () => {
  it('joins every user turn so the refinement reaches the generator', () => {
    const prompt = buildGeneratePrompt(['Rakdos sacrifice', 'keep the curve low'], '', {
      ...DEFAULT_DECK_CONFIG,
      budget: BUDGET_MAX,
    });
    expect(prompt).toBe(
      'Rakdos sacrifice keep the curve low Anywhere from 60 to 75 cards is fine — ' +
        'use the room if the curve needs it.',
    );
  });

  it('folds the budget control in as prose — it has no API field', () => {
    const prompt = buildGeneratePrompt(['Rakdos sacrifice'], '', {
      ...DEFAULT_DECK_CONFIG,
      budget: 150,
    });
    expect(prompt).toBe(
      'Rakdos sacrifice Anywhere from 60 to 75 cards is fine — use the room if the ' +
        'curve needs it. Keep the total budget under $150.',
    );
  });

  it('no longer emits the removed strategy and sideboard qualifiers', () => {
    const prompt = buildGeneratePrompt(['Rakdos sacrifice'], '', DEFAULT_DECK_CONFIG);
    expect(prompt).not.toContain('Strategy:');
    expect(prompt).not.toContain('sideboard');
  });

  it('omits the budget qualifier once the slider reaches the ceiling', () => {
    const prompt = buildGeneratePrompt(['x'], '', { ...DEFAULT_DECK_CONFIG, budget: BUDGET_MAX });
    expect(prompt).not.toContain('budget');
  });

  it('returns empty when there is no brief — qualifiers alone are not a deck', () => {
    expect(buildGeneratePrompt([], '', DEFAULT_DECK_CONFIG)).toBe('');
    expect(buildGeneratePrompt([], '   ', DEFAULT_DECK_CONFIG)).toBe('');
  });

  it('states the Commander rule in the brief, not just in `deck_size`', () => {
    const prompt = buildGeneratePrompt(
      ['a Muldrotha graveyard deck'],
      '',
      { ...setDeckFormat(DEFAULT_DECK_CONFIG, 'commander'), budget: BUDGET_MAX },
    );
    expect(prompt).toContain(`exactly ${COMMANDER_DECK_SIZE} cards`);
    expect(prompt).toContain('singleton');
    // The free-range qualifier is meaningless once the count is pinned.
    expect(prompt).not.toContain('Anywhere from');
  });

  it('never exceeds the 2000-char server limit', () => {
    expect(buildGeneratePrompt([ 'x'.repeat(5000) ], '', DEFAULT_DECK_CONFIG).length).toBe(2000);
  });
});

/* ==========================================================================
   2. The screen
   ========================================================================== */

interface StubSource {
  url: string;
  emit: (payload: unknown) => void;
  drop: () => void;
  open: () => void;
  closed: boolean;
}

const sources: StubSource[] = [];

class StubEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    sources.push({
      url,
      emit: (payload) => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) })),
      drop: () => this.onerror?.(),
      open: () => this.onopen?.(),
      get closed() {
        return false;
      },
    } as StubSource);
  }

  close() {
    this.closed = true;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sources.length = 0;
  // Never let a test reach Supabase for a bearer token; the page works signed out.
  setAuthTokenProvider(() => null);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('EventSource', StubEventSource);
});

afterEach(() => {
  cleanup();
  setAuthTokenProvider(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The stream the page opened, once React has run the effect. */
async function latestSource(): Promise<StubSource> {
  await waitFor(() => expect(sources.length).toBeGreaterThan(0));
  return sources[sources.length - 1];
}

async function describeADeck(text = 'A Rakdos sacrifice deck') {
  fireEvent.change(screen.getByLabelText('Describe your ideal deck'), { target: { value: text } });
}

async function startGeneration(deckBody: unknown = { task_id: 'task-1', deck_id: 'deck-1', status: 'pending' }) {
  fetchMock.mockResolvedValueOnce(jsonResponse(deckBody, 202));
  await describeADeck();
  fireEvent.click(screen.getByRole('button', { name: /generate deck/i }));
}

describe('DeckBuilderPage — shell', () => {
  it('renders the three workspace panels without any auth gate', () => {
    render(<DeckBuilderPage />);
    expect(screen.getByRole('heading', { name: 'Deck Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Magic Grimoire' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nothing forged yet' })).toBeInTheDocument();
    // No sign-in wall, no redirect: /decks/generate and /chat both work signed out.
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });

  it('blocks Generate until something has been described', () => {
    render(<DeckBuilderPage />);
    expect(screen.getByRole('button', { name: /generate deck/i })).toBeDisabled();
    // expect(screen.getByText('Describe your deck first, then forge it.')).toBeInTheDocument();
  });

  it('toggles a mana colour and reflects it back', () => {
    render(<DeckBuilderPage />);
    expect(screen.getByText('Any colours — the forge decides.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Black' }));
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(screen.getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');
    // Read back in WUBRG order regardless of click order.
    expect(screen.getByText('Black · Red')).toBeInTheDocument();
  });

  it('offers colourless, which DeckGenerateRequest accepts', () => {
    render(<DeckBuilderPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Colorless' }));
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(screen.getByRole('button', { name: 'Colorless' })).toHaveAttribute('aria-pressed', 'true');
    // WUBRG order puts colourless last, and the hint proves it reached the config.
    expect(screen.getByText('Red · Colorless')).toBeInTheDocument();
  });

  it('renders each picker as its symbol art from public/assets', () => {
    render(<DeckBuilderPage />);
    const sources = screen
      .getAllByRole('button')
      .flatMap((button) => Array.from(button.querySelectorAll('img')))
      .map((img) => decodeURIComponent(img.getAttribute('src') ?? ''));
    for (const file of ['white', 'blue', 'black', 'red', 'green', 'colorless']) {
      expect(sources.some((src) => src.includes(`/assets/mana-${file}.png`))).toBe(true);
    }
  });

  it('clamps a typed card count to the builder\u2019s bounds on commit', () => {
    render(<DeckBuilderPage />);
    const min = screen.getByLabelText('Min');
    expect(min).toHaveValue(60);

    // The draft is uncommitted while the field has focus, so "1" of "120"
    // must not snap to the floor mid-keystroke.
    fireEvent.change(min, { target: { value: '1' } });
    expect(min).toHaveValue(1);
    fireEvent.blur(min);
    expect(screen.getByLabelText('Min')).toHaveValue(60);

    // Pushing the floor past the ceiling carries the ceiling with it.
    fireEvent.change(screen.getByLabelText('Min'), { target: { value: '90' } });
    fireEvent.blur(screen.getByLabelText('Min'));
    expect(screen.getByLabelText('Max')).toHaveValue(90);
  });

  it('offers all five DeckFormat values, not just the design’s three', () => {
    render(<DeckBuilderPage />);
    for (const label of ['Standard', 'Modern', 'Pioneer', 'Legacy', 'Commander']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('locks the card count to 100 while Commander is the format', () => {
    render(<DeckBuilderPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Commander' }));

    expect(screen.getByLabelText('Min')).toHaveValue(COMMANDER_DECK_SIZE);
    expect(screen.getByLabelText('Max')).toHaveValue(COMMANDER_DECK_SIZE);
    expect(screen.getByLabelText('Min')).toBeDisabled();
    expect(screen.getByLabelText('Max')).toBeDisabled();
    expect(screen.getByText(/Commander is exactly 100 cards/)).toBeInTheDocument();

    // And the lock lifts again on any format that does not fix a count.
    fireEvent.click(screen.getByRole('button', { name: 'Modern' }));
    expect(screen.getByLabelText('Min')).toBeEnabled();
    expect(screen.getByLabelText('Min')).toHaveValue(DEFAULT_DECK_CONFIG.deckSizeMin);
  });

  it('sends 100 as `deck_size` for a Commander build', async () => {
    render(<DeckBuilderPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Commander' }));
    await startGeneration();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { deck_size: number; format: string };
    expect(body).toMatchObject({ format: 'commander', deck_size: COMMANDER_DECK_SIZE });
  });
});

describe('DeckBuilderPage — chat input', () => {
  it('is a wrapping textarea, so a long brief is not typed on one endless line', () => {
    render(<DeckBuilderPage />);
    const field = screen.getByLabelText('Describe your ideal deck');
    expect(field.tagName).toBe('TEXTAREA');
    // The four-line ceiling is `max-height` in the stylesheet; the element is
    // one row tall until the measured content pushes it past that.
    expect(field).toHaveAttribute('rows', '1');
  });

  it('sends on Enter and breaks the line on Shift+Enter', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'A Rakdos shell is viable.' }));
    render(<DeckBuilderPage />);
    const field = screen.getByLabelText('Describe your ideal deck');

    fireEvent.change(field, { target: { value: 'first line' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(field).toHaveValue('first line');

    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(field).toHaveValue('');
  });

  it('does not send an Enter on an empty draft', () => {
    render(<DeckBuilderPage />);
    const field = screen.getByLabelText('Describe your ideal deck');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('DeckBuilderPage — chat', () => {
  it('posts the transcript to /api/v1/chat and appends the reply', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'A Rakdos shell is viable.' }));
    render(<DeckBuilderPage />);

    await describeADeck('Rakdos sacrifice please');
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(screen.getByText('A Rakdos shell is viable.')).toBeInTheDocument());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/chat');
    const body = JSON.parse(String(init.body)) as { messages: { role: string }[]; context: unknown };
    // The seeded intro bubble is UI, not a model turn.
    expect(body.messages).toEqual([{ role: 'user', content: 'Rakdos sacrifice please' }]);
    expect(body.context).toEqual({ format: 'standard', colors: null });
  });

  it('surfaces an ApiError as an error bubble that is never replayed to the model', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Prompt injection detected' }, 422));
    render(<DeckBuilderPage />);

    await describeADeck('bad input');
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => expect(screen.getByText('Prompt injection detected')).toBeInTheDocument());
    expect(screen.getByText('Forge Error')).toBeInTheDocument();

    // The next turn must carry the user turns only.
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'ok' }));
    await describeADeck('second try');
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body)) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages.map((message) => message.content)).toEqual(['bad input', 'second try']);
  });

  it('reports a transport failure without inventing a status code', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<DeckBuilderPage />);
    await describeADeck('offline');
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() =>
      expect(screen.getByText(/Could not reach the Magic Grimoire API/)).toBeInTheDocument(),
    );
  });
});

describe('DeckBuilderPage — generation pipeline', () => {
  it('POSTs the composed prompt and subscribes to the returned task', async () => {
    render(<DeckBuilderPage />);
    await startGeneration();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/decks/generate');
    expect(JSON.parse(String(init.body))).toEqual({
      prompt:
        'A Rakdos sacrifice deck Anywhere from 60 to 75 cards is fine — use the room ' +
        'if the curve needs it. Keep the total budget under $150.',
      format: 'standard',
      colors: null,
      deck_size: 60,
    });
    // AbortSignal is threaded through so unmounting cancels the request.
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const source = await latestSource();
    expect(source.url).toBe('/api/v1/tasks/task-1/stream');
  });

  it('walks the four non-terminal stages in order and never rewinds', async () => {
    render(<DeckBuilderPage />);
    await startGeneration();
    const source = await latestSource();

    act(() => source.open());
    const bar = () => screen.getByRole('progressbar');

    for (const [status, expected] of [
      ['processing', 1],
      ['searching_cards', 2],
      ['composing_deck', 3],
      ['enriching', 4],
    ] as const) {
      act(() => source.emit({ status, message: `at ${status}` }));
      await waitFor(() => expect(bar()).toHaveAttribute('aria-valuenow', String(expected)));
      expect(screen.getAllByText(`at ${status}`).length).toBeGreaterThan(0);
    }

    // A replayed early event after a reconnect must not walk the bar backwards.
    act(() => source.emit({ status: 'processing', message: 'replay' }));
    expect(bar()).toHaveAttribute('aria-valuenow', '4');
  });

  it('fetches and renders the deck on the terminal completed event', async () => {
    render(<DeckBuilderPage />);
    await startGeneration();
    const source = await latestSource();

    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture()));
    act(() => source.emit({ status: 'completed', message: 'Deck ready' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument());
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/decks/deck-1');

    // Sections, curve and stat tiles all come off the real card list.
    expect(screen.getByText('Creatures · 8')).toBeInTheDocument();
    expect(screen.getByText('Lands · 4')).toBeInTheDocument();
    // Creatures and Non-Creature both read "8 Spells" for this fixture, so the
    // tiles are asserted through their labels rather than their values.
    const tileValue = (label: string) =>
      screen.getByText(label).parentElement?.querySelector('dd')?.textContent;
    expect(tileValue('Land Count')).toBe('4 Lands');
    expect(tileValue('Creatures')).toBe('8 Spells');
    expect(tileValue('Non-Creature')).toBe('8 Spells');
    expect(tileValue('Average CMC')).toBe('1.75');
    // The design's fabricated "SYNERGY RATIO" is replaced by the real status.
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText(/synergy ratio/i)).toBeNull();
  });

  it('handles a task that had already finished before the client subscribed', async () => {
    render(<DeckBuilderPage />);
    await startGeneration();
    const source = await latestSource();

    // The endpoint replays exactly one synthetic terminal event in this case,
    // with no preceding stage events at all.
    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture()));
    act(() => source.emit({ status: 'completed', message: 'Task already completed' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument());
  });

  it('shows the backend message when the task itself fails', async () => {
    render(<DeckBuilderPage />);
    await startGeneration();
    const source = await latestSource();

    act(() => source.emit({ status: 'failed', message: 'Scryfall returned no cards' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'The forge could not finish' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Scryfall returned no cards')).toBeInTheDocument();
    // Never invent a rate-limit branch: the backend has no rate limiting.
    expect(screen.queryByText(/free build/i)).toBeNull();
  });

  it('distinguishes a dropped transport from a failed task and offers recovery', async () => {
    vi.useFakeTimers();
    try {
      render(<DeckBuilderPage />);
      fetchMock.mockResolvedValueOnce(jsonResponse({ task_id: 'task-1', deck_id: 'deck-1', status: 'pending' }, 202));
      fireEvent.change(screen.getByLabelText('Describe your ideal deck'), {
        target: { value: 'A Rakdos sacrifice deck' },
      });
      fireEvent.click(screen.getByRole('button', { name: /generate deck/i }));
      await act(async () => {});

      // Exhaust the hook's bounded backoff.
      for (let attempt = 0; attempt <= 5; attempt += 1) {
        const source = sources[sources.length - 1];
        act(() => source.drop());
        await act(async () => {
          vi.advanceTimersByTime(10_000);
        });
      }

      expect(screen.getByRole('heading', { name: 'Lost the progress stream' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /check the deck anyway/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DeckBuilderPage — deck states', () => {
  async function renderWithDeck(overrides: Partial<DeckResponse> = {}) {
    render(<DeckBuilderPage />);
    await startGeneration();
    const source = await latestSource();
    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture(overrides)));
    act(() => source.emit({ status: 'completed', message: 'done' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  }

  it('explains an empty card list instead of rendering a blank grid', async () => {
    await renderWithDeck({ cards: [], card_count: 60 });
    await waitFor(() =>
      expect(screen.getByText(/reports 60 cards but the list has not been written yet/)).toBeInTheDocument(),
    );
  });

  it('surfaces error_message when the deck row itself is failed', async () => {
    await renderWithDeck({ status: 'failed', cards: null, error_message: 'LLM timed out' });
    await waitFor(() => expect(screen.getByText('LLM timed out')).toBeInTheDocument());
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('recovers from an ApiError on GET /decks/{id} and offers a retry', async () => {
    render(<DeckBuilderPage />);
    await startGeneration();
    const source = await latestSource();

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Deck not found' }, 404));
    act(() => source.emit({ status: 'completed', message: 'done' }));

    await waitFor(() => expect(screen.getByText('Deck not found')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('switches between the grid and list layouts', async () => {
    await renderWithDeck();
    await waitFor(() => expect(screen.getByRole('button', { name: 'List view' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    const creatures = screen.getByText('Creatures · 8').closest('section') as HTMLElement;
    const rows = within(creatures).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('×4');
    expect(rows[0]).toHaveTextContent('Cauldron Familiar');
  });
});

describe('DeckBuilderPage — permalink', () => {
  it('loads ?deck=<id> on mount so an anonymous build survives a reload', async () => {
    window.history.replaceState({}, '', '/deck-builder?deck=deck-9');
    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture({ id: 'deck-9' })));
    try {
      render(<DeckBuilderPage />);
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument(),
      );
      expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/decks/deck-9');
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });
});
