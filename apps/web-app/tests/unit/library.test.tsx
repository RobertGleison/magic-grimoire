import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeckListResponse, DeckResponse } from '../../app/types/api';

/* ==========================================================================
   Mocks
   --------------------------------------------------------------------------
   `ApiError` and `isAbortError` stay REAL — the page branches on
   `error instanceof ApiError` and on `error.status === 401`, so a stubbed
   error class would make those branches untestable.
   ========================================================================== */

const mocks = vi.hoisted(() => ({
  listDecks: vi.fn(),
  deleteDeck: vi.fn(),
  session: null as { access_token: string } | null,
  getSessionRejects: false,
  supabaseThrows: false,
  unsubscribe: vi.fn(),
}));

vi.mock('../../app/lib/supabase', () => ({
  getSupabase: () => {
    if (mocks.supabaseThrows) throw new Error('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL.');
    return {
      auth: {
        getSession: () =>
          mocks.getSessionRejects
            ? Promise.reject(new Error('network down'))
            : Promise.resolve({ data: { session: mocks.session } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: mocks.unsubscribe } } }),
      },
    };
  },
  getAccessToken: async () => mocks.session?.access_token ?? null,
}));

vi.mock('../../app/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/lib/apiClient')>();
  return { ...actual, listDecks: mocks.listDecks, deleteDeck: mocks.deleteDeck };
});

import { ApiError } from '../../app/lib/apiClient';
import {
  DeckSummaryCard,
  deckColors,
  deckTitle,
  formatRelativeTime,
} from '../../app/components/DeckSummaryCard/DeckSummaryCard';
import LibraryPage from '../../app/library/page';

/* ------------------------------------------------------------- fixtures */

function makeDeck(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-1',
    title: 'Rakdos Sacrifice',
    prompt: 'an aggressive rakdos sacrifice deck',
    format: 'standard',
    colors: ['B', 'R'],
    cards: null,
    card_count: 60,
    status: 'completed',
    error_message: null,
    created_at: '2026-08-23T10:00:00.000Z',
    completed_at: '2026-08-23T10:02:00.000Z',
    failed_at: null,
    ...overrides,
  };
}

function makeList(decks: DeckResponse[], overrides: Partial<DeckListResponse> = {}): DeckListResponse {
  return { decks, total: decks.length, page: 1, pages: 1, ...overrides };
}

/** Resolves the list call with a fixed payload, echoing back the page asked for. */
function respondWith(list: DeckListResponse) {
  mocks.listDecks.mockImplementation(async (params?: { page?: number }) => ({
    ...list,
    page: params?.page ?? list.page,
  }));
}

beforeEach(() => {
  mocks.listDecks.mockReset();
  mocks.deleteDeck.mockReset();
  mocks.unsubscribe.mockReset();
  mocks.session = { access_token: 'jwt' };
  mocks.getSessionRejects = false;
  mocks.supabaseThrows = false;
});

afterEach(cleanup);

/* ==========================================================================
   Pure helpers
   ========================================================================== */

describe('DeckSummaryCard helpers', () => {
  const now = Date.parse('2026-08-23T12:00:00.000Z');

  it('formats a timestamp relative to an injected now', () => {
    expect(formatRelativeTime('2026-08-23T10:00:00.000Z', now)).toBe('2 hours ago');
    expect(formatRelativeTime('2026-08-16T12:00:00.000Z', now)).toBe('last week');
  });

  it('returns null rather than guessing for a missing or unparseable timestamp', () => {
    expect(formatRelativeTime(null, now)).toBeNull();
    expect(formatRelativeTime(undefined, now)).toBeNull();
    expect(formatRelativeTime('not-a-date', now)).toBeNull();
  });

  it('falls back from a null title to the prompt the user actually typed', () => {
    expect(deckTitle(makeDeck())).toBe('Rakdos Sacrifice');
    expect(deckTitle(makeDeck({ title: null }))).toBe('an aggressive rakdos sacrifice deck');
    expect(deckTitle(makeDeck({ title: '   ', prompt: '  ' }))).toBe('Untitled grimoire');
  });

  it('normalises colour identity to WUBRG order and drops junk values', () => {
    expect(deckColors(makeDeck({ colors: ['R', 'b', 'R'] }))).toEqual(['B', 'R']);
    expect(deckColors(makeDeck({ colors: ['ZZ'] }))).toEqual([]);
    expect(deckColors(makeDeck({ colors: null }))).toEqual([]);
  });
});

/* ==========================================================================
   DeckSummaryCard
   ========================================================================== */

describe('DeckSummaryCard', () => {
  it('renders only fields that exist on DeckResponse — no synergy or win rate', () => {
    render(<DeckSummaryCard deck={makeDeck()} now={Date.parse('2026-08-23T12:00:00.000Z')} />);

    expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
    expect(screen.getByText('standard')).toBeInTheDocument();
    expect(screen.getByText('60 Spells')).toBeInTheDocument();
    expect(screen.getByText('Synthesized')).toBeInTheDocument();
    // created_at and completed_at are two minutes apart, so both rows read the same.
    expect(screen.getAllByText('2 hours ago')).toHaveLength(2);

    // The design's two invented stats must not appear anywhere.
    expect(screen.queryByText(/synergy/i)).toBeNull();
    expect(screen.queryByText(/win rate/i)).toBeNull();
  });

  it('singularises the card count', () => {
    render(<DeckSummaryCard deck={makeDeck({ card_count: 1 })} />);
    expect(screen.getByText('1 Spell')).toBeInTheDocument();
  });

  it('shows a status badge and disables Edit while a deck is still generating', () => {
    render(<DeckSummaryCard deck={makeDeck({ status: 'processing', completed_at: null })} />);

    expect(screen.getByText('Conjuring')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    // Nothing has completed, so the timestamp row is a dash, never a made-up time.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('links Edit at the deck builder once the deck is completed', () => {
    render(<DeckSummaryCard deck={makeDeck()} />);
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/deck-builder?deck=deck-1',
    );
  });

  it('surfaces error_message for a failed deck', () => {
    render(
      <DeckSummaryCard
        deck={makeDeck({
          status: 'failed',
          completed_at: null,
          failed_at: '2026-08-23T11:00:00.000Z',
          error_message: 'The oracle refused the summons.',
        })}
        now={Date.parse('2026-08-23T12:00:00.000Z')}
      />,
    );
    expect(screen.getByText('Fizzled')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    expect(screen.getByText('The oracle refused the summons.')).toBeInTheDocument();
  });

  it('hides the destructive action entirely when no onDelete is supplied', () => {
    const { rerender } = render(<DeckSummaryCard deck={makeDeck()} />);
    expect(screen.queryByRole('button', { name: /dissolve/i })).toBeNull();

    const onDelete = vi.fn();
    rerender(<DeckSummaryCard deck={makeDeck()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve Rakdos Sacrifice' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

/* ==========================================================================
   /library page
   ========================================================================== */

describe('LibraryPage', () => {
  it('shows a sign-in prompt and never calls the API when signed out', async () => {
    mocks.session = null;
    render(<LibraryPage />);

    expect(await screen.findByRole('heading', { name: 'The seal is closed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(mocks.listDecks).not.toHaveBeenCalled();
  });

  it('falls back to the sign-in prompt when Supabase is not configured', async () => {
    mocks.supabaseThrows = true;
    render(<LibraryPage />);

    expect(await screen.findByRole('heading', { name: 'The seal is closed' })).toBeInTheDocument();
    expect(mocks.listDecks).not.toHaveBeenCalled();
  });

  it('treats a 401 from the list endpoint as signed out rather than an error', async () => {
    mocks.listDecks.mockRejectedValue(new ApiError('Not authenticated', 401));
    render(<LibraryPage />);

    expect(await screen.findByRole('heading', { name: 'The seal is closed' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /would not open/i })).toBeNull();
  });

  it('spins while the first page is in flight instead of hanging blank', async () => {
    mocks.listDecks.mockReturnValue(new Promise(() => {}));
    render(<LibraryPage />);

    await waitFor(() => expect(mocks.listDecks).toHaveBeenCalled());
    expect(screen.getByText('Loading your decks')).toBeInTheDocument();
  });

  it('requests the documented page size and renders the decks it gets back', async () => {
    respondWith(makeList([makeDeck(), makeDeck({ id: 'deck-2', title: 'Azorius Control' })]));
    render(<LibraryPage />);

    expect(await screen.findByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Azorius Control' })).toBeInTheDocument();
    expect(mocks.listDecks).toHaveBeenCalledWith({ page: 1, limit: 12 }, expect.anything());
    expect(screen.getByText(/You have conjured 2 mythic synergies/)).toBeInTheDocument();
  });

  it('shows the first-run state for an authenticated but empty library', async () => {
    respondWith(makeList([]));
    render(<LibraryPage />);

    expect(await screen.findByRole('heading', { name: 'Your grimoire is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Conjure your first deck/ })).toHaveAttribute(
      'href',
      '/deck-builder',
    );
  });

  it('renders the ApiError message with a working retry', async () => {
    mocks.listDecks.mockRejectedValueOnce(new ApiError('Deck storage is temporarily unavailable.', 503));
    render(<LibraryPage />);

    expect(await screen.findByText('Deck storage is temporarily unavailable.')).toBeInTheDocument();

    respondWith(makeList([makeDeck()]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
  });

  it('pages beyond page 1 through the API rather than client-side', async () => {
    respondWith(makeList([makeDeck()], { total: 30, pages: 3 }));
    render(<LibraryPage />);

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() =>
      expect(mocks.listDecks).toHaveBeenLastCalledWith({ page: 2, limit: 12 }, expect.anything()),
    );
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('hides the paginator when there is only one page', async () => {
    respondWith(makeList([makeDeck()]));
    render(<LibraryPage />);

    await screen.findByRole('heading', { name: 'Rakdos Sacrifice' });
    expect(screen.queryByRole('navigation', { name: 'Deck pages' })).toBeNull();
  });

  it('keeps a still-processing deck on screen with its live status', async () => {
    respondWith(
      makeList([makeDeck({ status: 'processing', card_count: 0, completed_at: null, cards: null })]),
    );
    render(<LibraryPage />);

    expect(await screen.findByText('Conjuring')).toBeInTheDocument();
    expect(screen.getByText('0 Spells')).toBeInTheDocument();
  });

  it('never deletes on a single click — the modal has to be confirmed', async () => {
    respondWith(makeList([makeDeck()]));
    mocks.deleteDeck.mockResolvedValue(undefined);
    render(<LibraryPage />);

    await screen.findByRole('heading', { name: 'Rakdos Sacrifice' });
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve Rakdos Sacrifice' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.deleteDeck).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.deleteDeck).not.toHaveBeenCalled();
  });

  it('deletes and refetches once the modal is confirmed', async () => {
    respondWith(makeList([makeDeck()]));
    mocks.deleteDeck.mockResolvedValue(undefined);
    render(<LibraryPage />);

    await screen.findByRole('heading', { name: 'Rakdos Sacrifice' });
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve Rakdos Sacrifice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve' }));

    await waitFor(() => expect(mocks.deleteDeck).toHaveBeenCalledWith('deck-1'));
    await waitFor(() => expect(mocks.listDecks).toHaveBeenCalledTimes(2));
  });

  it('reports a failed delete inside the dialog and keeps the deck', async () => {
    respondWith(makeList([makeDeck()]));
    mocks.deleteDeck.mockRejectedValue(new ApiError('Access denied', 403));
    render(<LibraryPage />);

    await screen.findByRole('heading', { name: 'Rakdos Sacrifice' });
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve Rakdos Sacrifice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dissolve' }));

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.listDecks).toHaveBeenCalledTimes(1);
  });

  it('filters the loaded page by format and by free text', async () => {
    respondWith(
      makeList([
        makeDeck(),
        makeDeck({
          id: 'deck-2',
          title: 'Azorius Control',
          prompt: 'a slow blue-white permission deck',
          format: 'pioneer',
          colors: ['W', 'U'],
        }),
      ]),
    );
    render(<LibraryPage />);

    await screen.findByRole('heading', { name: 'Rakdos Sacrifice' });

    fireEvent.click(screen.getByRole('button', { name: 'pioneer' }));
    expect(screen.queryByRole('heading', { name: 'Rakdos Sacrifice' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Azorius Control' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All Formats' }));
    fireEvent.change(screen.getByLabelText('Search the decks on this page'), {
      target: { value: 'rakdos' },
    });
    expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Azorius Control' })).toBeNull();
  });

  it('offers a way out when filters match nothing', async () => {
    respondWith(makeList([makeDeck()]));
    render(<LibraryPage />);

    await screen.findByRole('heading', { name: 'Rakdos Sacrifice' });
    fireEvent.change(screen.getByLabelText('Search the decks on this page'), {
      target: { value: 'zzzz' },
    });

    expect(screen.getByText('No deck on this page matches those filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
  });

  it('sorts the loaded page without going back to the server', async () => {
    respondWith(
      makeList([
        makeDeck({ id: 'a', title: 'Zebra', created_at: '2026-08-01T00:00:00.000Z' }),
        makeDeck({ id: 'b', title: 'Alpha', created_at: '2026-08-20T00:00:00.000Z' }),
      ]),
    );
    render(<LibraryPage />);

    await screen.findByRole('heading', { name: 'Alpha' });
    const titlesNow = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titlesNow()).toEqual(['Alpha', 'Zebra']);

    fireEvent.change(screen.getByLabelText('Sort the decks on this page'), {
      target: { value: 'oldest' },
    });
    expect(titlesNow()).toEqual(['Zebra', 'Alpha']);
    expect(mocks.listDecks).toHaveBeenCalledTimes(1);
  });
});
