'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '../components/Button/Button';
import { DeckSummaryCard } from '../components/DeckSummaryCard/DeckSummaryCard';
import { Input } from '../components/Input/Input';
import { Modal } from '../components/Modal/Modal';
import { Select } from '../components/Select/Select';
import { Spinner } from '../components/Spinner/Spinner';
import { ApiError, deleteDeck, isAbortError, listDecks } from '../lib/apiClient';
import { getSupabase } from '../lib/supabase';
import { DECK_FORMATS, type DeckListResponse, type DeckResponse } from '../types/api';
import styles from './page.module.css';

/* ==========================================================================
   /library — "My Grimoire" (design nodes 9:4 page, 9:23 content).
   Header 9:7 and footer 9:236 are already in app/layout.tsx.

   Wires `GET /api/v1/decks` and `DELETE /api/v1/decks/{id}`. BOTH require a
   bearer token — the backend's `get_current_user` dependency 401s without one
   (`apps/api-server/app/decks/routes.py`), so signed out is a first-class
   state here, not an error.
   ========================================================================== */

/** 3 columns x 4 rows. The API accepts 1..100 and defaults to 20. */
const PAGE_SIZE = 12;

/** Design shows four format chips (9:34-9:43) and omits Legacy; the enum has five. */
const FORMAT_FILTERS = ['all', ...DECK_FORMATS] as const;
type FormatFilter = (typeof FORMAT_FILTERS)[number];

/**
 * The design's sort control reads "Sort by: Win Rate" (9:49). There is no win
 * rate and no server-side ordering parameter — `GET /decks` is hardwired to
 * `created_at DESC` — so these four sort the decks already on screen instead.
 */
const SORT_OPTIONS = [
  { value: 'newest', label: 'Sort by: Newest' },
  { value: 'oldest', label: 'Sort by: Oldest' },
  { value: 'title', label: 'Sort by: Name' },
  { value: 'largest', label: 'Sort by: Card count' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

/**
 * One source of truth for what the screen is doing. `data` rides along on
 * `loading` and `error` so paging and refreshing keep the grid on screen
 * instead of collapsing it back to a spinner.
 */
type LibraryState =
  | { kind: 'loading'; data: DeckListResponse | null }
  | { kind: 'signed-out' }
  | { kind: 'error'; message: string; data: DeckListResponse | null }
  | { kind: 'ready'; data: DeckListResponse };

type DeleteState =
  | { kind: 'idle' }
  | { kind: 'deleting' }
  | { kind: 'error'; message: string };

/** Supabase's answer to "is anyone signed in", before any API call is made. */
type SessionState = 'checking' | 'signed-in' | 'signed-out';

/* ---------------------------------------------------------------- session */

/**
 * SEAM FOR WAVE 4a. There is no auth context yet, so the session is read
 * straight off the Supabase client. When `app/context/UserContext.tsx` lands,
 * delete this hook and replace the single `useSession()` call below with the
 * context's equivalent — nothing else on this page touches Supabase.
 */
function useSession(): SessionState {
  const [state, setState] = useState<SessionState>('checking');

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      const supabase = getSupabase();

      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (active) setState(data.session ? 'signed-in' : 'signed-out');
        })
        .catch(() => {
          if (active) setState('signed-out');
        });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setState(session ? 'signed-in' : 'signed-out');
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Supabase env vars are missing — no token can exist, so the API would
      // 401 anyway. Show the sign-in prompt rather than a crash.
      setState('signed-out');
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return state;
}

/* ------------------------------------------------------------------ icons */

/** Figma node 9:260, 14x14. */
function SearchIcon() {
  return (
    <svg className={styles.searchIcon} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path
        d="M12.2501 12.2501L9.71843 9.71843M11.0833 6.41667C11.0833 8.994 8.994 11.0833 6.41667 11.0833C3.83934 11.0833 1.75 8.994 1.75 6.41667C1.75 3.83934 3.83934 1.75 6.41667 1.75C8.994 1.75 11.0833 3.83934 11.0833 6.41667Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Figma node 9:30, 16x16 — the "Conjure New Deck" button's trailing glyph. */
function SparkleIcon() {
  return (
    <svg className={styles.sparkleIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M14.3985 0.00156213V3.2008M15.9981 1.60118H12.7989M7.21379 0.652959C7.24806 0.469486 7.34542 0.303775 7.489 0.184526C7.63259 0.0652771 7.81335 0 8 0C8.18665 0 8.36742 0.0652771 8.511 0.184526C8.65459 0.303775 8.75194 0.469486 8.78621 0.652959L9.62681 5.0983C9.68651 5.41434 9.8401 5.70504 10.0675 5.93247C10.295 6.1599 10.5857 6.31349 10.9017 6.37319L15.347 7.21379C15.5305 7.24806 15.6962 7.34542 15.8155 7.489C15.9347 7.63259 16 7.81335 16 8C16 8.18665 15.9347 8.36742 15.8155 8.511C15.6962 8.65459 15.5305 8.75194 15.347 8.78621L10.9017 9.62681C10.5857 9.68651 10.295 9.8401 10.0675 10.0675C9.8401 10.295 9.68651 10.5857 9.62681 10.9017L8.78621 15.347C8.75194 15.5305 8.65459 15.6962 8.511 15.8155C8.36742 15.9347 8.18665 16 8 16C7.81335 16 7.63259 15.9347 7.489 15.8155C7.34542 15.6962 7.24806 15.5305 7.21379 15.347L6.37319 10.9017C6.31349 10.5857 6.1599 10.295 5.93247 10.0675C5.70504 9.8401 5.41434 9.68651 5.0983 9.62681L0.652959 8.78621C0.469486 8.75194 0.303775 8.65459 0.184526 8.511C0.0652772 8.36742 0 8.18665 0 8C0 7.81335 0.0652772 7.63259 0.184526 7.489C0.303775 7.34542 0.469486 7.24806 0.652959 7.21379L5.0983 6.37319C5.41434 6.31349 5.70504 6.1599 5.93247 5.93247C6.1599 5.70504 6.31349 5.41434 6.37319 5.0983L7.21379 0.652959ZM3.20119 14.3981C3.20119 15.2816 2.48501 15.9977 1.60157 15.9977C0.718126 15.9977 0.00195266 15.2816 0.00195266 14.3981C0.00195266 13.5147 0.718126 12.7985 1.60157 12.7985C2.48501 12.7985 3.20119 13.5147 3.20119 14.3981Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------- filtering */

function matchesQuery(deck: DeckResponse, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    (deck.title ?? '').toLowerCase().includes(needle) ||
    deck.prompt.toLowerCase().includes(needle) ||
    deck.format.toLowerCase().includes(needle)
  );
}

function sortDecks(decks: DeckResponse[], sort: SortKey): DeckResponse[] {
  const sorted = [...decks];
  switch (sort) {
    case 'oldest':
      return sorted.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    case 'title':
      return sorted.sort((a, b) =>
        (a.title ?? a.prompt).localeCompare(b.title ?? b.prompt, undefined, { sensitivity: 'base' }),
      );
    case 'largest':
      return sorted.sort((a, b) => b.card_count - a.card_count);
    case 'newest':
    default:
      return sorted.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong reading your grimoire.';
}

/* ------------------------------------------------------------------- page */

export default function LibraryPage() {
  const session = useSession();

  const [state, setState] = useState<LibraryState>({ kind: 'loading', data: null });
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const [pendingDelete, setPendingDelete] = useState<DeckResponse | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: 'idle' });

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (session === 'checking') return;

    if (session === 'signed-out') {
      setState({ kind: 'signed-out' });
      return;
    }

    const controller = new AbortController();
    setState((previous) => ({
      kind: 'loading',
      data: 'data' in previous ? previous.data : null,
    }));

    listDecks({ page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => setState({ kind: 'ready', data }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        // The token can expire between the session check and the request.
        if (error instanceof ApiError && error.status === 401) {
          setState({ kind: 'signed-out' });
          return;
        }
        setState((previous) => ({
          kind: 'error',
          message: messageOf(error),
          data: 'data' in previous ? previous.data : null,
        }));
      });

    return () => controller.abort();
  }, [session, page, reloadToken]);

  // A deleted last row, or a shrunken list, can leave `page` past the end.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    if (state.data.page > state.data.pages) setPage(state.data.pages);
  }, [state]);

  const data = state.kind === 'signed-out' ? null : state.data;
  const decks = useMemo(() => data?.decks ?? [], [data]);

  const visibleDecks = useMemo(() => {
    const filtered = decks.filter(
      (deck) =>
        (formatFilter === 'all' || deck.format.toLowerCase() === formatFilter) &&
        matchesQuery(deck, query.trim()),
    );
    return sortDecks(filtered, sort);
  }, [decks, formatFilter, query, sort]);

  const clearFilters = useCallback(() => {
    setFormatFilter('all');
    setQuery('');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleteState({ kind: 'deleting' });
    try {
      await deleteDeck(pendingDelete.id);
      setPendingDelete(null);
      setDeleteState({ kind: 'idle' });
      // Stepping back a page when the last row of a later page goes away.
      if (decks.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        setPendingDelete(null);
        setDeleteState({ kind: 'idle' });
        setState({ kind: 'signed-out' });
        return;
      }
      setDeleteState({ kind: 'error', message: messageOf(error) });
    }
  }, [pendingDelete, decks.length, page, reload]);

  const closeDeleteModal = useCallback(() => {
    if (deleteState.kind === 'deleting') return;
    setPendingDelete(null);
    setDeleteState({ kind: 'idle' });
  }, [deleteState.kind]);

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const busy = state.kind === 'loading';

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.headerRow}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>My Grimoire</h1>
            <p className={styles.subtitle}>
              {state.kind === 'signed-out'
                ? 'Sign in to summon the decks bound to your name.'
                : total > 0
                  ? `You have conjured ${total} mythic ${total === 1 ? 'synergy' : 'synergies'}. Enter the arena fully prepared.`
                  : 'Every grimoire starts blank. Conjure the first entry.'}
            </p>
          </div>
          <Button href="/deck-builder" variant="primary" size="lg" iconRight={<SparkleIcon />}>
            Conjure New Deck
          </Button>
        </header>

        {state.kind === 'signed-out' ? <SignedOutPanel /> : null}

        {state.kind !== 'signed-out' && !data && state.kind === 'loading' ? (
          <div className={styles.centered} role="status">
            <Spinner size="lg" label="Loading your decks" />
          </div>
        ) : null}

        {state.kind === 'error' && !data ? (
          <ErrorPanel message={state.message} onRetry={reload} />
        ) : null}

        {data ? (
          <>
            {state.kind === 'error' ? (
              <div className={styles.inlineError} role="alert">
                <span>{state.message}</span>
                <Button variant="ghost" size="xs" onClick={reload}>
                  Retry
                </Button>
              </div>
            ) : null}

            {total === 0 ? (
              <EmptyPanel />
            ) : (
              <>
                <div className={styles.filterBar}>
                  <div className={styles.chips} role="group" aria-label="Filter by format">
                    {FORMAT_FILTERS.map((value) => (
                      <Button
                        key={value}
                        variant="ghost"
                        size="sm"
                        aria-pressed={formatFilter === value}
                        onClick={() => setFormatFilter(value)}
                      >
                        {value === 'all' ? 'All Formats' : value}
                      </Button>
                    ))}
                  </div>

                  <div className={styles.tools}>
                    <div className={styles.search}>
                      <SearchIcon />
                      <Input
                        size="sm"
                        type="search"
                        value={query}
                        placeholder="Search library..."
                        aria-label="Search the decks on this page"
                        wrapperClassName={styles.searchField}
                        className={styles.searchInput}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </div>
                    <Select
                      size="sm"
                      value={sort}
                      aria-label="Sort the decks on this page"
                      wrapperClassName={styles.sortField}
                      options={SORT_OPTIONS.map((option) => ({ ...option }))}
                      onChange={(event) => setSort(event.target.value as SortKey)}
                    />
                  </div>
                </div>

                <p className={styles.resultLine} role="status">
                  {`Showing ${visibleDecks.length} of ${decks.length} on this page`}
                  {pages > 1 ? ` — ${total} decks across ${pages} pages. Search, filters and sorting apply to this page only.` : '.'}
                </p>

                {visibleDecks.length === 0 ? (
                  <div className={styles.panel}>
                    <p className={styles.panelBody}>No deck on this page matches those filters.</p>
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <ul
                    className={styles.grid}
                    aria-busy={busy || undefined}
                    data-loading={busy || undefined}
                  >
                    {visibleDecks.map((deck) => (
                      <li key={deck.id} className={styles.gridItem}>
                        <DeckSummaryCard
                          deck={deck}
                          busy={pendingDelete?.id === deck.id && deleteState.kind === 'deleting'}
                          onDelete={setPendingDelete}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {pages > 1 ? (
                  <nav className={styles.pagination} aria-label="Deck pages">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || busy}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </Button>
                    <span className={styles.pageCount} aria-live="polite">
                      Page {data.page} of {pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pages || busy}
                      onClick={() => setPage((current) => Math.min(pages, current + 1))}
                    >
                      Next
                    </Button>
                  </nav>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>

      <Modal
        open={pendingDelete !== null}
        onClose={closeDeleteModal}
        title="Dissolve this deck?"
        description={
          pendingDelete
            ? `“${pendingDelete.title?.trim() || pendingDelete.prompt.trim()}” and its ${pendingDelete.card_count} cards will be destroyed. This cannot be undone.`
            : undefined
        }
        size="sm"
        closeOnScrimClick={false}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={closeDeleteModal}
              disabled={deleteState.kind === 'deleting'}
            >
              Keep it
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void confirmDelete()}
              loading={deleteState.kind === 'deleting'}
            >
              Dissolve
            </Button>
          </>
        }
      >
        {deleteState.kind === 'error' ? (
          <p className={styles.modalError} role="alert">
            {deleteState.message}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------- sub-views */

/**
 * 401 state. The design has no signed-out my-decks frame, so this reuses the
 * page's own panel language rather than inventing a new surface.
 */
function SignedOutPanel() {
  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>The seal is closed</h2>
      <p className={styles.panelBody}>
        Saved decks are bound to your account. Sign in to open your grimoire — decks you conjure
        while signed out are not stored here.
      </p>
      <div className={styles.panelActions}>
        <Button href="/login" variant="primary" size="md">
          Sign In
        </Button>
        <Button href="/signup" variant="secondary" size="md">
          Create account
        </Button>
      </div>
    </div>
  );
}

/** First-run state: authenticated, zero decks. */
function EmptyPanel() {
  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Your grimoire is empty</h2>
      <p className={styles.panelBody}>
        Describe the deck you want in plain language and the forge will assemble a legal list from
        real cards. Everything you build while signed in lands here.
      </p>
      <div className={styles.panelActions}>
        <Button href="/deck-builder" variant="primary" size="md" iconRight={<SparkleIcon />}>
          Conjure your first deck
        </Button>
      </div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.panel} role="alert">
      <h2 className={styles.panelTitle}>The grimoire would not open</h2>
      <p className={styles.panelBody}>{message}</p>
      <div className={styles.panelActions}>
        <Button variant="primary" size="md" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
