import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeckResponse } from '../../app/types/api';

const mocks = vi.hoisted(() => ({
  getDeck: vi.fn(),
  setDeckVisibility: vi.fn(),
  sendChat: vi.fn(),
}));

vi.mock('../../app/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
  getAccessToken: async () => 't',
}));

vi.mock('../../app/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/lib/apiClient')>();
  return { ...actual, getDeck: mocks.getDeck, setDeckVisibility: mocks.setDeckVisibility, sendChat: mocks.sendChat };
});

import { ApiError } from '../../app/lib/apiClient';
import { DeckSummaryCard } from '../../app/components/DeckSummaryCard/DeckSummaryCard';
import LibraryDeckPage from '../../app/library/deck/page';

function makeDeck(overrides: Partial<DeckResponse> = {}): DeckResponse {
  return {
    id: 'deck-1',
    title: 'Rakdos Sacrifice',
    prompt: 'an aggressive rakdos sacrifice deck',
    format: 'standard',
    colors: ['B', 'R'],
    cards: [
      {
        name: 'Shock',
        quantity: 4,
        scryfall_id: 'id',
        image_uri: null,
        mana_cost: '{R}',
        type_line: 'Instant',
        section: 'spells',
      },
    ],
    card_count: 4,
    version_no: 1,
    is_public: true,
    is_owner: true,
    status: 'completed',
    error_message: null,
    created_at: '2026-08-23T10:00:00.000Z',
    completed_at: '2026-08-23T10:02:00.000Z',
    failed_at: null,
    ...overrides,
  };
}

function visit(search: string) {
  window.history.pushState({}, '', `/library/deck${search}`);
}

beforeEach(() => {
  mocks.getDeck.mockReset();
  mocks.setDeckVisibility.mockReset();
  mocks.sendChat.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

describe('DeckSummaryCard as a link (MTG-15)', () => {
  it('makes the tile one link to the read-only view, separate from its actions', () => {
    const onDelete = vi.fn();
    render(<DeckSummaryCard deck={makeDeck()} viewHref="/library/deck?id=deck-1" onDelete={onDelete} />);

    const tileLink = screen.getByRole('link', { name: 'Rakdos Sacrifice' });
    expect(tileLink).toHaveAttribute('href', '/library/deck?id=deck-1');

    // Edit and Dissolve are siblings of the link, never inside it, so
    // activating them cannot also open the deck.
    const edit = screen.getByRole('link', { name: 'Edit' });
    const dissolve = screen.getByRole('button', { name: 'Dissolve Rakdos Sacrifice' });
    expect(tileLink.contains(edit)).toBe(false);
    expect(tileLink.contains(dissolve)).toBe(false);
    expect(edit).toHaveAttribute('href', '/deck-builder?deck=deck-1');
  });

  it('stays a plain heading when no view link is supplied', () => {
    render(<DeckSummaryCard deck={makeDeck()} />);
    expect(screen.queryByRole('link', { name: 'Rakdos Sacrifice' })).toBeNull();
  });
});

describe('/library/deck read-only view (MTG-15)', () => {
  it('shows the deck cards with Edit and export actions, and no chat', async () => {
    mocks.getDeck.mockResolvedValue(makeDeck());
    visit('?id=deck-1');
    render(<LibraryDeckPage />);

    expect(await screen.findByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
    expect(mocks.getDeck).toHaveBeenCalledWith('deck-1', expect.anything());

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/deck-builder?deck=deck-1');
    expect(screen.getByRole('button', { name: 'Export TXT' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy List' })).toBeInTheDocument();
    // A saved snapshot cannot be re-saved, so the builder's Save is omitted.
    expect(screen.queryByRole('button', { name: 'Save to Library' })).toBeNull();

    // No chat surface: no message box, and the chat API is never touched.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(mocks.sendChat).not.toHaveBeenCalled();

    expect(screen.getByRole('link', { name: /back to library/i })).toHaveAttribute('href', '/library');
  });

  it('explains a deck the caller may not see', async () => {
    mocks.getDeck.mockRejectedValue(new ApiError('Access denied', 403));
    visit('?id=someone-elses');
    render(<LibraryDeckPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not yours to view/i);
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
  });

  it('asks for a deck when the URL carries no id', async () => {
    visit('');
    render(<LibraryDeckPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no deck chosen/i));
    expect(mocks.getDeck).not.toHaveBeenCalled();
  });

  it('gives the owner a lock that toggles optimistically and rolls back on error (MTG-24)', async () => {
    mocks.getDeck.mockResolvedValue(makeDeck());
    mocks.setDeckVisibility.mockRejectedValue(new ApiError('Deck storage is temporarily unavailable.', 503));
    visit('?id=deck-1');
    render(<LibraryDeckPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Make private: Rakdos Sacrifice' }));
    expect(mocks.setDeckVisibility).toHaveBeenCalledWith('deck-1', false);

    expect(await screen.findByText('Deck storage is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make private: Rakdos Sacrifice' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows someone else\'s public deck without Edit or the lock (MTG-24)', async () => {
    mocks.getDeck.mockResolvedValue(makeDeck({ is_owner: false }));
    visit('?id=deck-1');
    render(<LibraryDeckPage />);

    expect(await screen.findByRole('heading', { name: 'Rakdos Sacrifice' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /make (public|private)/i })).toBeNull();
  });
});
