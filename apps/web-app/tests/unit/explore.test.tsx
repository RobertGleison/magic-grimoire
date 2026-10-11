import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeckResponse, ExploreDeckListResponse } from '../../app/types/api';

const mocks = vi.hoisted(() => ({
  exploreDecks: vi.fn(),
  getDeck: vi.fn(),
  setDeckTags: vi.fn(),
}));

vi.mock('../../app/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
  getAccessToken: async () => null,
}));

vi.mock('../../app/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/lib/apiClient')>();
  return {
    ...actual,
    exploreDecks: mocks.exploreDecks,
    getDeck: mocks.getDeck,
    setDeckTags: mocks.setDeckTags,
  };
});

import { ApiError } from '../../app/lib/apiClient';
import { TagEditor } from '../../app/components/TagEditor/TagEditor';
import ExplorePage from '../../app/explore/page';
import ExploreDeckPage from '../../app/explore/deck/page';

function makeDeck(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-1',
    title: 'Rakdos Sacrifice',
    prompt: 'an aggressive rakdos sacrifice deck',
    format: 'standard',
    colors: ['B', 'R'],
    cards: [],
    card_count: 60,
    version_no: 1,
    is_public: true,
    tags: ['aggro'],
    is_owner: false,
    status: 'completed',
    error_message: null,
    created_at: '2026-08-23T10:00:00.000Z',
    completed_at: '2026-08-23T10:02:00.000Z',
    failed_at: null,
    ...overrides,
  };
}

function page(decks: DeckResponse[], next_cursor: string | null = null): ExploreDeckListResponse {
  return { decks, next_cursor };
}

/** The filters of the most recent feed request. */
function lastFilters() {
  return mocks.exploreDecks.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  mocks.exploreDecks.mockReset();
  mocks.getDeck.mockReset();
  mocks.setDeckTags.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.pushState({}, '', '/');
});

describe('/explore feed', () => {
  it('lists public decks as feed tiles that open the public read-only view', async () => {
    mocks.exploreDecks.mockResolvedValue(page([makeDeck()]));
    render(<ExplorePage />);

    const link = await screen.findByRole('link', { name: 'Rakdos Sacrifice' });
    expect(link).toHaveAttribute('href', '/explore/deck?id=deck-1');
    expect(screen.getByText('an aggressive rakdos sacrifice deck')).toBeInTheDocument();
    expect(screen.getByText('aggro')).toBeInTheDocument();
    // Someone else's deck: no Edit, no owner stats.
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.queryByText('Synthesized')).toBeNull();
    expect(lastFilters()).toMatchObject({ q: undefined, colors: [], tags: [], format: undefined });
  });

  it('debounces typed search by ~400ms and combines it with clicked filters', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.exploreDecks.mockResolvedValue(page([makeDeck()]));
    render(<ExplorePage />);
    await screen.findByRole('link', { name: 'Rakdos Sacrifice' });
    const initialCalls = mocks.exploreDecks.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'gob' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'goblin' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(mocks.exploreDecks.mock.calls.length).toBe(initialCalls);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    await waitFor(() => expect(lastFilters()).toMatchObject({ q: 'goblin' }));
    expect(mocks.exploreDecks.mock.calls.length).toBe(initialCalls + 1);

    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'modern' } });
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: ' Aggro, budget,aggro' } });
    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    await waitFor(() =>
      expect(lastFilters()).toMatchObject({
        q: 'goblin',
        colors: ['R'],
        format: 'modern',
        tags: ['aggro', 'budget'],
      }),
    );
  });

  it('shows an empty state, with a way out when filters are on', async () => {
    mocks.exploreDecks.mockResolvedValue(page([]));
    render(<ExplorePage />);
    expect(await screen.findByRole('heading', { name: 'Nothing shared yet' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(await screen.findByRole('heading', { name: 'No decks match' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('heading', { name: 'Nothing shared yet' })).toBeInTheDocument();
  });

  it('shows the error with a working retry', async () => {
    mocks.exploreDecks.mockRejectedValueOnce(new ApiError('Too many requests.', 429));
    render(<ExplorePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests.');

    mocks.exploreDecks.mockResolvedValue(page([makeDeck()]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
  });

  it('loads the next page by cursor and appends it', async () => {
    mocks.exploreDecks
      .mockResolvedValueOnce(page([makeDeck()], 'cursor-2'))
      .mockResolvedValueOnce(page([makeDeck({ id: 'deck-2', title: 'Azorius Control' })]));
    render(<ExplorePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('link', { name: 'Azorius Control' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
    expect(lastFilters()).toMatchObject({ cursor: 'cursor-2' });
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('/explore/deck public view', () => {
  it('opens a public deck for a signed-out visitor, with read-only tags and no owner controls', async () => {
    mocks.getDeck.mockResolvedValue(makeDeck());
    window.history.pushState({}, '', '/explore/deck?id=deck-1');
    render(<ExploreDeckPage />);

    expect(await screen.findByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
    expect(screen.getByText('aggro')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove tag/i })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('link', { name: /back to explore/i })).toHaveAttribute('href', '/explore');
  });

  it('lets the owner edit tags optimistically and rolls back on refusal', async () => {
    mocks.getDeck.mockResolvedValue(makeDeck({ is_owner: true }));
    mocks.setDeckTags.mockRejectedValueOnce(new ApiError('A deck can have at most 10 tags.', 422));
    window.history.pushState({}, '', '/explore/deck?id=deck-1');
    render(<ExploreDeckPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove tag aggro' }));
    expect(mocks.setDeckTags).toHaveBeenCalledWith('deck-1', []);
    expect(await screen.findByText('A deck can have at most 10 tags.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove tag aggro' })).toBeInTheDocument();
  });
});

describe('TagEditor', () => {
  it('normalises, de-duplicates and enforces the limits before calling onChange', () => {
    const onChange = vi.fn();
    const { rerender } = render(<TagEditor tags={['aggro']} onChange={onChange} />);
    const input = screen.getByLabelText('Tags');

    fireEvent.change(input, { target: { value: '  Token   Swarm ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(onChange).toHaveBeenLastCalledWith(['aggro', 'token swarm']);

    fireEvent.change(input, { target: { value: 'AGGRO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('already on this deck');
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: 'x'.repeat(25) } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('at most 24 characters');

    rerender(<TagEditor tags={Array.from({ length: 10 }, (_, i) => `t${i}`)} onChange={onChange} />);
    expect(screen.getByLabelText('Tags')).toBeDisabled();
  });

  it('removes a tag', () => {
    const onChange = vi.fn();
    render(<TagEditor tags={['aggro', 'budget']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag aggro' }));
    expect(onChange).toHaveBeenCalledWith(['budget']);
  });
});
