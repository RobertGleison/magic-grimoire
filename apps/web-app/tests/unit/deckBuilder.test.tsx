/**
 * Wave 3b — deck builder.
 *
 * Two halves:
 *   1. `deckLogic` — pure, so it is tested directly with no DOM.
 *   2. The screen — rendered against a stubbed `fetch` that also answers the
 *      task polls, so every branch of the pipeline (all six `TaskProgress`
 *      values, a transport drop, an already-finished task, and `ApiError`)
 *      is reachable without a backend.
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TASK_POLL_INTERVAL_MS } from '../../app/hooks/useTaskStream';
import { setAuthTokenProvider } from '../../app/lib/apiClient';
import type { CardInDeck, DeckResponse, TaskProgress, TaskStatus } from '../../app/types/api';
import type { UserStatus } from '../../app/context/UserContext';
import DeckBuilderPage from '../../app/deck-builder/page';
import {
  BASIC_LAND_ADD_MAX,
  BUDGET_MAX,
  CARD_SEARCH_DEBOUNCE_MS,
  COMMANDER_DECK_SIZE,
  DECK_DESCRIPTION_MAX,
  DEFAULT_DECK_CONFIG,
  addCardToDeck,
  buildGeneratePrompt,
  categoriseCard,
  chatColors,
  clampDeckSize,
  copiesInDeck,
  copyLimit,
  deckCardTotal,
  deckColorDistribution,
  deckDescription,
  deckFileName,
  deckListText,
  deckSummaryStats,
  groupDeckCards,
  isBasicLand,
  isFixedSizeFormat,
  maxAddable,
  setDeckFormat,
  setDeckSizeBound,
  toggleDeckColor,
} from '../../app/deck-builder/deckLogic';

/* `vi.mock` factories are hoisted above the rest of this module, so the
   values they close over must be created through `vi.hoisted` rather than a
   plain top-level `const` — otherwise vitest throws on the temporal-dead-zone
   reference. */
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

let userStatus: UserStatus = 'signed-in';
vi.mock('../../app/context/UserContext', () => ({
  useUser: () => ({ status: userStatus, user: null }),
}));

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
    version_no: null,
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

describe('manual add helpers', () => {
  const bolt = { name: 'Lightning Bolt', scryfall_id: 'b', image_uri: null, mana_cost: '{R}', type_line: 'Instant' };

  it('recognises basic lands by type line or name, and nothing else', () => {
    expect(isBasicLand({ name: 'Mountain', type_line: 'Basic Land — Mountain' })).toBe(true);
    expect(isBasicLand({ name: 'Snow-Covered Island', type_line: null })).toBe(true);
    expect(isBasicLand({ name: 'Blood Crypt', type_line: 'Land — Swamp Mountain' })).toBe(false);
  });

  it('allows four copies, one in Commander, and exempts basics', () => {
    expect(copyLimit('standard')).toBe(4);
    expect(copyLimit('commander')).toBe(1);
    expect(maxAddable(CARDS, { name: 'Mayhem Devil', type_line: 'Creature' }, 'standard')).toBe(0);
    expect(maxAddable(CARDS, { name: "Witch's Oven", type_line: 'Artifact' }, 'standard')).toBe(2);
    expect(maxAddable(CARDS, { name: 'Lightning Bolt', type_line: 'Instant' }, 'commander')).toBe(1);
    expect(maxAddable(CARDS, { name: 'Swamp', type_line: 'Basic Land — Swamp' }, 'commander')).toBe(BASIC_LAND_ADD_MAX);
  });

  it('counts main-deck copies only, case-insensitively', () => {
    expect(copiesInDeck(CARDS, 'duress')).toBe(0); // sideboard
    expect(copiesInDeck(CARDS, 'witch\'s oven')).toBe(2);
  });

  it('grows an existing entry and appends a new one with its Scryfall fields', () => {
    const grown = addCardToDeck(CARDS, { ...bolt, name: "Witch's Oven", type_line: 'Artifact' }, 2);
    expect(grown.find((c) => c.name === "Witch's Oven")?.quantity).toBe(4);
    expect(grown).toHaveLength(CARDS.length);

    const added = addCardToDeck(CARDS, bolt, 3);
    expect(added).toHaveLength(CARDS.length + 1);
    expect(added.at(-1)).toEqual({ ...bolt, quantity: 3, section: 'spells', price_eur: null });
    expect(deckCardTotal(added)).toBe(deckCardTotal(CARDS) + 3);
    // Never mutates the input.
    expect(CARDS).toHaveLength(6);
  });

  it('carries the searched card\'s euro price onto the new entry', () => {
    expect(addCardToDeck([], { ...bolt, price_eur: '1.50' }, 2)[0].price_eur).toBe('1.50');
  });

  it('files a land as a land and a creature as a creature', () => {
    expect(addCardToDeck([], { ...bolt, name: 'Forest', type_line: 'Basic Land — Forest' }, 1)[0].section).toBe('lands');
    expect(addCardToDeck([], { ...bolt, name: 'Elf', type_line: 'Creature — Elf' }, 1)[0].section).toBe('creatures');
  });
});

describe('deckDescription', () => {
  it('returns the description with whitespace collapsed', () => {
    expect(deckDescription({ description: '  Goblins\n go   wide. ' })).toBe('Goblins go wide.');
  });

  it('hides the block for a deck without one rather than echoing the prompt', () => {
    expect(deckDescription({ description: null })).toBeNull();
    expect(deckDescription({})).toBeNull();
    expect(deckDescription({ description: '   ' })).toBeNull();
  });

  it('caps an overlong description', () => {
    const text = deckDescription({ description: 'a'.repeat(1000) });
    expect(text).toHaveLength(DECK_DESCRIPTION_MAX);
    expect(text?.endsWith('…')).toBe(true);
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

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Every non-task call: the queued `mockResolvedValueOnce` replies are consumed here, in order. */
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

/** URLs of every `GET /api/v1/tasks/:id` poll the page made. */
const taskPolls: string[] = [];

interface TaskReply {
  status: TaskStatus;
  progress: TaskProgress | null;
  message?: string;
}

/** What every task poll answers until the test changes it; an `Error` rejects the poll like a network drop. */
let taskReply: TaskReply | Error = { status: 'queued', progress: null };

function setTask(reply: TaskReply | Error) {
  taskReply = reply;
}

/**
 * Task polls are answered beside `fetchMock` rather than through it, so a poll
 * can never consume a `mockResolvedValueOnce` queued for the deck or save call
 * that follows it, and call counts on `fetchMock` stay about the page's own calls.
 */
async function routedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  // `POST /tasks/:id/cancel` is a page action, not a poll, so it goes through fetchMock.
  if (!url.startsWith('/api/v1/tasks/') || url.endsWith('/cancel')) return fetchMock(input, init);

  taskPolls.push(url);
  if (taskReply instanceof Error) throw taskReply;
  return jsonResponse({ id: 'task-1', message: '', ...taskReply });
}

/** Lets the next scheduled poll run under fake timers. */
async function nextPoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS);
  });
}

beforeEach(() => {
  taskPolls.length = 0;
  setTask({ status: 'queued', progress: null });
  // Never let a test reach Supabase for a bearer token; the page works signed out.
  setAuthTokenProvider(() => null);
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', routedFetch);
  pushMock.mockClear();
  userStatus = 'signed-in';
});

afterEach(() => {
  cleanup();
  setAuthTokenProvider(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function describeADeck(text = 'A Rakdos sacrifice deck') {
  fireEvent.change(screen.getByLabelText('Describe your ideal deck'), { target: { value: text } });
}

/** Generate is blocked until a colour and a format are picked. */
function pickConfig(format = 'Standard', color = 'Red') {
  if (screen.getByRole('button', { name: color }).getAttribute('aria-pressed') !== 'true') {
    fireEvent.click(screen.getByRole('button', { name: color }));
  }
  fireEvent.click(screen.getByRole('button', { name: format }));
}

async function startGeneration(
  deckBody: unknown = { task_id: 'task-1', deck_id: 'deck-1', status: 'pending' },
  format = 'Standard',
) {
  fetchMock.mockResolvedValueOnce(jsonResponse(deckBody, 202));
  pickConfig(format);
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

  it('blocks Generate until a colour and a format are both picked', () => {
    render(<DeckBuilderPage />);
    void describeADeck();
    const generate = () => screen.getByRole('button', { name: /generate deck/i });
    const message = 'Choose a color and a deck format to generate a deck';

    // Neither picked.
    expect(generate()).toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent(message);
    expect(generate()).toHaveAccessibleDescription(message);

    // Colour only.
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(generate()).toBeDisabled();

    // Format only.
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modern' }));
    expect(generate()).toBeDisabled();

    // Both: enabled at once, and the tooltip is gone.
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(generate()).toBeEnabled();
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(generate()).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the blocked Generate reachable by keyboard so the reason can be read', () => {
    render(<DeckBuilderPage />);
    const tooltip = screen.getByRole('tooltip');
    const gate = tooltip.parentElement as HTMLElement;
    expect(gate).toHaveAttribute('tabindex', '0');
    expect(gate).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('cannot be bypassed with Enter: the field sends chat, never a generation', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Noted.' }));
    render(<DeckBuilderPage />);
    const field = screen.getByLabelText('Describe your ideal deck');
    fireEvent.change(field, { target: { value: 'Rakdos sacrifice' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Noted.')).toBeInTheDocument());
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain('/api/v1/decks/generate');
  });

  it('toggles a mana colour and reflects it back', () => {
    render(<DeckBuilderPage />);
    expect(screen.getByText('Pick at least one colour to forge a deck.')).toBeInTheDocument();
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
    await startGeneration(undefined, 'Commander');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { deck_size: number; format: string };
    expect(body).toMatchObject({ format: 'commander', deck_size: COMMANDER_DECK_SIZE });
  });
});

describe('DeckBuilderPage — config panel collapse', () => {
  it('retracts the config to a rail when a generation starts', async () => {
    render(<DeckBuilderPage />);
    expect(screen.getByRole('heading', { name: 'Deck Configuration' })).toBeInTheDocument();

    await startGeneration();

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Deck Configuration' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Expand deck configuration' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('reopens from the rail with every selection preserved', async () => {
    render(<DeckBuilderPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Black' }));
    await startGeneration(undefined, 'Modern');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Expand deck configuration' })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand deck configuration' }));

    expect(screen.getByRole('heading', { name: 'Deck Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Modern' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not retract when Generate is blocked', () => {
    render(<DeckBuilderPage />);
    void describeADeck();
    fireEvent.click(screen.getByRole('button', { name: /generate deck/i }));
    expect(screen.getByRole('heading', { name: 'Deck Configuration' })).toBeInTheDocument();
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
    // Nothing picked on the panel yet, so the context says so rather than guessing.
    expect(body.context).toEqual({ format: null, colors: null });
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
      colors: ['R'],
      deck_size: 60,
    });
    // AbortSignal is threaded through so unmounting cancels the request.
    expect(init.signal).toBeInstanceOf(AbortSignal);

    await waitFor(() => expect(taskPolls[0]).toBe('/api/v1/tasks/task-1'));
  });

  it('walks the four non-terminal stages in order and never rewinds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<DeckBuilderPage />);
      await startGeneration();
      await waitFor(() => expect(taskPolls.length).toBeGreaterThan(0));
      const bar = () => screen.getByRole('progressbar');

      for (const [stage, expected] of [
        ['processing', 1],
        ['searching_cards', 2],
        ['composing_deck', 3],
        ['enriching', 4],
      ] as const) {
        setTask({ status: 'processing', progress: stage, message: `at ${stage}` });
        await nextPoll();
        await waitFor(() => expect(bar()).toHaveAttribute('aria-valuenow', String(expected)));
        expect(screen.getAllByText(`at ${stage}`).length).toBeGreaterThan(0);
      }

      // A stale earlier stage from a lagging read must not walk the bar backwards.
      setTask({ status: 'processing', progress: 'processing', message: 'replay' });
      await nextPoll();
      expect(bar()).toHaveAttribute('aria-valuenow', '4');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fetches and renders the deck on the terminal completed event', async () => {
    setTask({ status: 'completed', progress: 'completed', message: 'Deck ready' });
    render(<DeckBuilderPage />);
    await startGeneration();
    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture()));

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
    // The very first poll already reads a terminal row, with no stage ever seen.
    setTask({ status: 'completed', progress: 'completed', message: 'Task already completed' });
    render(<DeckBuilderPage />);
    await startGeneration();
    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture()));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument());
  });

  it('shows the backend message when the task itself fails', async () => {
    setTask({ status: 'failed', progress: 'failed', message: 'Scryfall returned no cards' });
    render(<DeckBuilderPage />);
    await startGeneration();

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
      pickConfig();
      fireEvent.change(screen.getByLabelText('Describe your ideal deck'), {
        target: { value: 'A Rakdos sacrifice deck' },
      });
      // Every poll fails at the transport, never reaching the task row.
      setTask(new TypeError('network'));
      fireEvent.click(screen.getByRole('button', { name: /generate deck/i }));
      await act(async () => {});

      // Exhaust the hook's bounded backoff.
      for (let attempt = 0; attempt <= 5; attempt += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });
      }

      expect(screen.getByRole('heading', { name: 'Lost the progress stream' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /check the deck anyway/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DeckBuilderPage — cancel generation', () => {
  /** fetchMock calls to a given URL, in order. */
  const callsTo = (url: string) => fetchMock.mock.calls.filter(([called]) => String(called) === url);

  it('cancels the task server-side and returns to the config state', async () => {
    setTask({ status: 'processing', progress: 'composing_deck', message: 'Building your deck...' });
    render(<DeckBuilderPage />);
    await startGeneration();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument());
    // Generating retracted the config panel.
    expect(screen.queryByRole('heading', { name: 'Deck Configuration' })).toBeNull();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'task-1', status: 'cancelled', progress: 'cancelled', message: 'Generation cancelled.' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Generation cancelled' })).toBeInTheDocument(),
    );
    const [[, init]] = callsTo('/api/v1/tasks/task-1/cancel') as [[string, RequestInit]];
    expect(init.method).toBe('POST');
    // Back to config: the panel is open again, selections intact, Generate usable.
    expect(screen.getByRole('heading', { name: 'Deck Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /generate deck/i })).toBeEnabled();

    // Polling has stopped.
    const polls = taskPolls.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(taskPolls.length).toBe(polls);
  });

  it('cancels a task whose generate request was still in flight when Cancel was pressed', async () => {
    let answerGenerate: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => {
        answerGenerate = resolve;
      }),
    );
    render(<DeckBuilderPage />);
    pickConfig();
    await describeADeck();
    fireEvent.click(screen.getByRole('button', { name: /generate deck/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'task-1', status: 'cancelled', progress: 'cancelled', message: '' }),
    );
    await act(async () => {
      answerGenerate(jsonResponse({ task_id: 'task-1', deck_id: 'deck-1', status: 'pending' }, 202));
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Generation cancelled' })).toBeInTheDocument(),
    );
    expect(callsTo('/api/v1/tasks/task-1/cancel')).toHaveLength(1);
  });

  it('keeps following the task when the forge finished before the cancel landed', async () => {
    setTask({ status: 'processing', progress: 'enriching' });
    render(<DeckBuilderPage />);
    await startGeneration();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument());

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'This generation has already finished (completed); there is nothing to cancel.' }, 409),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.getByText(/too late to cancel/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Generation cancelled' })).toBeNull();
  });

  it('lands in the cancelled state when the task was cancelled elsewhere', async () => {
    setTask({ status: 'cancelled', progress: 'cancelled', message: 'Generation cancelled.' });
    render(<DeckBuilderPage />);
    await startGeneration();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Generation cancelled' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Deck Configuration' })).toBeInTheDocument();
  });
});

describe('DeckBuilderPage — deck states', () => {
  async function renderWithDeck(
    overrides: Partial<DeckResponse> = {},
    options: { userStatus?: UserStatus } = {},
  ) {
    if (options.userStatus) userStatus = options.userStatus;
    setTask({ status: 'completed', progress: 'completed', message: 'done' });
    render(<DeckBuilderPage />);
    await startGeneration();
    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture(overrides)));
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
    setTask({ status: 'completed', progress: 'completed', message: 'done' });
    render(<DeckBuilderPage />);
    await startGeneration();
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Deck not found' }, 404));

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

  it('shows the deck idea instead of echoing the original prompt', async () => {
    await renderWithDeck({
      prompt: 'the raw brief the user typed',
      description: 'Sacrifice fodder feeds Mayhem Devil until the table burns.',
    });
    await waitFor(() => expect(screen.getByText('Deck idea')).toBeInTheDocument());
    expect(screen.getByText('Sacrifice fodder feeds Mayhem Devil until the table burns.')).toBeInTheDocument();
    expect(screen.queryByText(/original incantation/i)).toBeNull();
    expect(screen.queryByText('the raw brief the user typed')).toBeNull();
  });

  it('renders a description as text, never as markup', async () => {
    await renderWithDeck({ description: '<img src=x onerror=alert(1)> Elves go wide.' });
    await waitFor(() =>
      expect(screen.getByText('<img src=x onerror=alert(1)> Elves go wide.')).toBeInTheDocument(),
    );
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('hides the block for an older deck with no description', async () => {
    await renderWithDeck({ description: null });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument());
    expect(screen.queryByText('Deck idea')).toBeNull();
    expect(screen.queryByText(/original incantation/i)).toBeNull();
  });

  describe('add cards manually', () => {
    const BOLT = {
      name: 'Lightning Bolt',
      scryfall_id: 'sc-bolt',
      image_uri: 'https://cards.scryfall.io/normal/bolt.jpg',
      mana_cost: '{R}',
      type_line: 'Instant',
    };
    const searchCalls = () =>
      fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/v1/cards/search'));

    async function openPanel(overrides: Partial<DeckResponse> = {}) {
      await renderWithDeck(overrides);
      fireEvent.click(await screen.findByRole('button', { name: 'Add Cards' }));
      return screen.getByRole('searchbox', { name: 'Search cards by name' });
    }

    it('debounces the search at 400ms and only sends the settled query', async () => {
      const search = await openPanel();
      vi.useFakeTimers({ shouldAdvanceTime: false });
      try {
        fetchMock.mockResolvedValue(jsonResponse({ cards: [BOLT] }));
        fireEvent.change(search, { target: { value: 'li' } });
        fireEvent.change(search, { target: { value: 'light' } });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(CARD_SEARCH_DEBOUNCE_MS - 1);
        });
        expect(searchCalls()).toHaveLength(0);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });
        expect(searchCalls()).toEqual(['/api/v1/cards/search?q=light']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('aborts a superseded request so a stale answer never paints', async () => {
      const search = await openPanel();
      const signals: AbortSignal[] = [];
      fetchMock.mockImplementation((url, init) => {
        if (!String(url).startsWith('/api/v1/cards/search')) return Promise.reject(new Error('unexpected'));
        signals.push(init?.signal as AbortSignal);
        // The first query hangs; the second answers.
        return signals.length === 1 ? new Promise<Response>(() => {}) : Promise.resolve(jsonResponse({ cards: [BOLT] }));
      });

      fireEvent.change(search, { target: { value: 'bol' } });
      await waitFor(() => expect(signals).toHaveLength(1));
      fireEvent.change(search, { target: { value: 'bolt' } });
      await waitFor(() => expect(signals).toHaveLength(2));

      expect(signals[0].aborted).toBe(true);
      await waitFor(() => expect(screen.getByRole('list', { name: 'Matching cards' })).toBeInTheDocument());
    });

    it('adds a chosen quantity, updates the deck at once, and saves it', async () => {
      const search = await openPanel();
      let saved: unknown = null;
      fetchMock.mockImplementation(async (url, init) => {
        if (String(url).startsWith('/api/v1/cards/search')) return jsonResponse({ cards: [BOLT] });
        if (String(url) === '/api/v1/decks/deck-1/cards') {
          saved = JSON.parse(String(init?.body));
          const cards = (saved as { cards: CardInDeck[] }).cards;
          return jsonResponse(deckFixture({ cards, card_count: cards.reduce((n, c) => n + c.quantity, 0) }));
        }
        throw new Error(`unexpected ${String(url)}`);
      });

      fireEvent.change(search, { target: { value: 'bolt' } });
      const results = await screen.findByRole('list', { name: 'Matching cards' });
      // The result is the grid's CardTile.
      expect(within(results).getByText('Lightning Bolt')).toBeInTheDocument();

      fireEvent.change(within(results).getByLabelText('Qty of Lightning Bolt'), { target: { value: '3' } });
      fireEvent.click(within(results).getByRole('button', { name: 'Add 3 Lightning Bolt' }));

      // Optimistic: the header count moves before the save answers.
      expect(screen.getByText(/23 cards compiled/)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Added 3 × Lightning Bolt.')).toBeInTheDocument());
      const body = saved as { cards: CardInDeck[] };
      expect(body.cards.at(-1)).toMatchObject({ name: 'Lightning Bolt', quantity: 3, section: 'spells' });
    });

    it('moves the deck total at once when a priced card is added', async () => {
      const priced = [{ ...CARDS[0], quantity: 4, price_eur: '0.50' }];
      const search = await openPanel({ cards: priced, card_count: 4, total_price_eur: '2.00', unpriced_card_count: 0 });
      expect(screen.getAllByText('€2.00').length).toBeGreaterThan(0);
      fetchMock.mockImplementation(async (url) => {
        if (String(url).startsWith('/api/v1/cards/search')) return jsonResponse({ cards: [{ ...BOLT, price_eur: '1.50' }] });
        return new Promise<Response>(() => {}); // the save never answers: only the optimistic total shows
      });

      fireEvent.change(search, { target: { value: 'bolt' } });
      const results = await screen.findByRole('list', { name: 'Matching cards' });
      expect(within(results).getByText('€1.50')).toBeInTheDocument();
      fireEvent.change(within(results).getByLabelText('Qty of Lightning Bolt'), { target: { value: '2' } });
      fireEvent.click(within(results).getByRole('button', { name: 'Add 2 Lightning Bolt' }));

      // Header and the panel's count line both read 4 × €0.50 + 2 × €1.50.
      expect(screen.getAllByText('€5.00')).toHaveLength(2);
    });

    it('caps the quantity at the copy limit and blocks a fifth copy', async () => {
      const search = await openPanel();
      fetchMock.mockResolvedValue(
        jsonResponse({ cards: [{ ...BOLT, name: 'Mayhem Devil', type_line: 'Creature — Devil' }] }),
      );
      fireEvent.change(search, { target: { value: 'mayhem' } });
      const results = await screen.findByRole('list', { name: 'Matching cards' });
      expect(within(results).getByText('4-copy limit reached.')).toBeInTheDocument();
      expect(within(results).getByRole('button', { name: /add 1 mayhem devil/i })).toBeDisabled();
    });

    it('rolls the deck back and explains when the save is refused', async () => {
      const search = await openPanel();
      fetchMock.mockImplementation(async (url) => {
        if (String(url).startsWith('/api/v1/cards/search')) return jsonResponse({ cards: [BOLT] });
        return jsonResponse({ detail: 'Only a finished deck can be edited.' }, 400);
      });
      fireEvent.change(search, { target: { value: 'bolt' } });
      const results = await screen.findByRole('list', { name: 'Matching cards' });
      fireEvent.click(within(results).getByRole('button', { name: 'Add 1 Lightning Bolt' }));

      await waitFor(() => expect(screen.getByText('Only a finished deck can be edited.')).toBeInTheDocument());
      expect(screen.getByText(/20 cards compiled/)).toBeInTheDocument();
    });

    it('handles the empty and error states', async () => {
      const search = await openPanel();
      expect(screen.getByText(/type at least 2 letters/i)).toBeInTheDocument();

      fetchMock.mockResolvedValueOnce(jsonResponse({ cards: [] }));
      fireEvent.change(search, { target: { value: 'zzqx' } });
      await waitFor(() => expect(screen.getByText('No cards match “zzqx”.')).toBeInTheDocument());

      fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Card search is unavailable right now.' }, 502));
      fireEvent.change(search, { target: { value: 'bolt' } });
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('Card search is unavailable right now.'),
      );
    });

    it('closes on Escape without losing the deck', async () => {
      const search = await openPanel();
      fireEvent.keyDown(search, { key: 'Escape' });
      expect(screen.queryByRole('searchbox', { name: 'Search cards by name' })).toBeNull();
      expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
    });

    it('is not offered on a saved library version, which is immutable', async () => {
      await renderWithDeck({ version_no: 2 });
      await screen.findByRole('heading', { name: 'Rakdos Sacrifice' });
      expect(screen.queryByRole('button', { name: 'Add Cards' })).toBeNull();
    });
  });

  describe('save to library', () => {
    it('saves the deck and reports the version it wrote', async () => {
      setAuthTokenProvider(() => 'token-123');
      await renderWithDeck();

      fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture({ id: 'snap-1', version_no: 2 })));

      fireEvent.click(await screen.findByRole('button', { name: /save to library/i }));

      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(/saved to your library as v2/i),
      );
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('/decks/deck-1/save');
    });

    it('shows the reason when the save is refused', async () => {
      setAuthTokenProvider(() => 'token-123');
      await renderWithDeck();

      fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'This version is already saved.' }, 400));

      fireEvent.click(await screen.findByRole('button', { name: /save to library/i }));

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/already saved/i));
    });

    it('lets the most recent action own the live region, clearing a prior save confirmation', async () => {
      setAuthTokenProvider(() => 'token-123');
      await renderWithDeck();

      fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture({ id: 'snap-1', version_no: 2 })));
      fireEvent.click(await screen.findByRole('button', { name: /save to library/i }));
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(/saved to your library as v2/i),
      );

      // A later Copy List must retake the live region — the save confirmation
      // is not allowed to squat on it for the rest of the deck's session.
      fireEvent.click(screen.getByRole('button', { name: /copy list/i }));
      await waitFor(() =>
        expect(screen.getByRole('status')).not.toHaveTextContent(/saved to your library/i),
      );
      expect(screen.getByRole('status')).toHaveTextContent(/clipboard blocked|decklist copied/i);
    });

    it('does not let an in-flight save from a previous deck land on the newly loaded deck', async () => {
      setAuthTokenProvider(() => 'token-123');
      await renderWithDeck();

      // The save's fetch is held open under our control, so we can load a
      // different deck while it is still in flight.
      let resolveSave!: (value: Response) => void;
      const savePromise = new Promise<Response>((resolve) => {
        resolveSave = resolve;
      });
      fetchMock.mockImplementationOnce(() => savePromise);

      fireEvent.click(await screen.findByRole('button', { name: /save to library/i }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

      // Before that save resolves, a second generation replaces the deck on screen.
      // Reuses the existing `userTurns` transcript from the first generation
      // rather than typing a new draft: `buildGeneratePrompt` composes the
      // prompt from the whole transcript, so the already-pushed first turn is
      // enough to make the button clickable again with no further input.
      // The task row still reads completed, so task-2's first poll finishes it
      // at once: both replies are queued before the click, in call order.
      const pollsBefore = taskPolls.length;
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ task_id: 'task-2', deck_id: 'deck-2', status: 'pending' }, 202),
      );
      fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture({ id: 'deck-2', title: 'Second Deck' })));
      fireEvent.click(screen.getByRole('button', { name: /generate deck/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Second Deck' })).toBeInTheDocument(),
      );
      expect(fetchMock.mock.calls[3][0]).toBe('/api/v1/decks/generate');
      expect(taskPolls.slice(pollsBefore)).toContain('/api/v1/tasks/task-2');

      // Only now let the stale save resolve — it must be a no-op.
      await act(async () => {
        resolveSave(jsonResponse(deckFixture({ id: 'snap-1', version_no: 9 })));
        await savePromise;
      });

      expect(screen.getByRole('status')).not.toHaveTextContent(/saved to your library/i);
    });

    it('does not let an in-flight save on the same deck land after a later copy', async () => {
      setAuthTokenProvider(() => 'token-123');
      await renderWithDeck();

      // Hold the save's fetch open under our control.
      let resolveSave!: (value: Response) => void;
      const savePromise = new Promise<Response>((resolve) => {
        resolveSave = resolve;
      });
      fetchMock.mockImplementationOnce(() => savePromise);

      fireEvent.click(await screen.findByRole('button', { name: /save to library/i }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

      // Before that save resolves, the user copies the list instead.
      fireEvent.click(screen.getByRole('button', { name: /copy list/i }));
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(/clipboard blocked|decklist copied/i),
      );

      // Only now let the stale save resolve — it must be a no-op, not a
      // takeover of the live region the copy confirmation just claimed.
      await act(async () => {
        resolveSave(jsonResponse(deckFixture({ id: 'snap-1', version_no: 5 })));
        await savePromise;
      });

      expect(screen.getByRole('status')).not.toHaveTextContent(/saved to your library/i);
      expect(screen.getByRole('status')).toHaveTextContent(/clipboard blocked|decklist copied/i);
    });

    it('sends a signed-out visitor to login with the deck in the return path', async () => {
      setAuthTokenProvider(() => null);
      await renderWithDeck({}, { userStatus: 'signed-out' });

      fireEvent.click(await screen.findByRole('button', { name: /save to library/i }));

      expect(pushMock).toHaveBeenCalledWith(
        `/login?next=${encodeURIComponent('/deck-builder?deck=deck-1&save=1')}`,
      );
      // Nothing was sent to the API — the save happens after the round-trip.
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/save'))).toBe(false);
    });
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

describe('DeckBuilderPage — save round trip arrival', () => {
  it('finishes the save exactly once on ?save=1 and strips the parameter', async () => {
    setAuthTokenProvider(() => 'token-123');
    window.history.replaceState({}, '', '/deck-builder?deck=deck-1&save=1');
    // Queued in call order: the permalink GET, then the auto-fired save.
    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture()));
    fetchMock.mockResolvedValueOnce(jsonResponse(deckFixture({ id: 'snap-1', version_no: 3 })));
    try {
      render(<DeckBuilderPage />);

      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(/saved to your library as v3/i),
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1][0])).toContain('/decks/deck-1/save');

      // The arrival parameter is gone so a reload cannot re-trigger the save,
      // while the rest of the query string (the permalink) survives.
      expect(window.location.search).not.toContain('save=1');
      expect(window.location.search).toContain('deck=deck-1');
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });
});
