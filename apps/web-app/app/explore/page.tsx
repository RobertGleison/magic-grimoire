'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '../components/Button/Button';
import { DeckSummaryCard } from '../components/DeckSummaryCard/DeckSummaryCard';
import { Input } from '../components/Input/Input';
import { ManaIcon } from '../components/ManaIcon/ManaIcon';
import { Select } from '../components/Select/Select';
import { Spinner } from '../components/Spinner/Spinner';
import { MANA_COLOR_NAMES } from '../deck-builder/deckLogic';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { ApiError, exploreDecks, isAbortError } from '../lib/apiClient';
import { normalizeTag } from '../lib/deckTags';
import { DECK_FORMATS, MTG_COLORS, type DeckFormat, type DeckResponse, type MTGColor } from '../types/api';
import styles from './page.module.css';

/* ==========================================================================
   /explore — the community feed: public saved decks, newest first.
   No sign-in needed. Filters (name, colours, tags, format) combine and go to
   the server, so they cover every public deck, not just the loaded page.
   Typed filters are debounced; clicks apply at once. Paged by cursor with a
   "Load more" button.
   ========================================================================== */

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 24;

type FormatFilter = 'all' | DeckFormat;

const FORMAT_OPTIONS = [
  { value: 'all', label: 'All formats' },
  ...DECK_FORMATS.map((format) => ({ value: format, label: format[0].toUpperCase() + format.slice(1) })),
];

type FeedState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      decks: DeckResponse[];
      nextCursor: string | null;
      more: { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };
    };

/** "Aggro, token swarm" → ['aggro', 'token swarm']. */
function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(',').map(normalizeTag).filter(Boolean)));
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong reaching the community decks.';
}

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [tagText, setTagText] = useState('');
  const [colors, setColors] = useState<MTGColor[]>([]);
  const [format, setFormat] = useState<FormatFilter>('all');
  const [state, setState] = useState<FeedState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const debouncedTagText = useDebouncedValue(tagText, SEARCH_DEBOUNCE_MS);
  const tags = useMemo(() => parseTags(debouncedTagText), [debouncedTagText]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      colors,
      tags,
      format: format === 'all' ? undefined : format,
      limit: PAGE_SIZE,
    }),
    [debouncedQuery, colors, tags, format],
  );

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    exploreDecks(filters, { signal: controller.signal })
      .then((page) =>
        setState({ kind: 'ready', decks: page.decks, nextCursor: page.next_cursor, more: { kind: 'idle' } }),
      )
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState({ kind: 'error', message: messageOf(error) });
      });
    return () => controller.abort();
  }, [filters, reloadToken]);

  const loadMore = useCallback(async () => {
    if (state.kind !== 'ready' || !state.nextCursor || state.more.kind === 'loading') return;
    const cursor = state.nextCursor;
    setState({ ...state, more: { kind: 'loading' } });
    try {
      const page = await exploreDecks({ ...filters, cursor });
      setState((current) =>
        current.kind === 'ready'
          ? {
              kind: 'ready',
              decks: [...current.decks, ...page.decks],
              nextCursor: page.next_cursor,
              more: { kind: 'idle' },
            }
          : current,
      );
    } catch (error: unknown) {
      setState((current) =>
        current.kind === 'ready' ? { ...current, more: { kind: 'error', message: messageOf(error) } } : current,
      );
    }
  }, [state, filters]);

  const toggleColor = (color: MTGColor) =>
    setColors((current) =>
      current.includes(color) ? current.filter((value) => value !== color) : [...current, color],
    );

  const filtered = Boolean(query.trim() || tagText.trim() || colors.length || format !== 'all');
  const clearFilters = () => {
    setQuery('');
    setTagText('');
    setColors([]);
    setFormat('all');
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.headerText}>
          <h1 className={styles.title}>Explore</h1>
          <p className={styles.subtitle}>Decks the community has shared. Newest first.</p>
        </header>

        <section className={styles.filterBar} aria-label="Filter decks">
          <Input
            size="sm"
            type="search"
            value={query}
            label="Name"
            placeholder="Search deck names..."
            wrapperClassName={styles.field}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Input
            size="sm"
            type="search"
            value={tagText}
            label="Tags"
            placeholder="e.g. aggro, budget"
            wrapperClassName={styles.field}
            onChange={(event) => setTagText(event.target.value)}
          />
          <Select
            size="sm"
            value={format}
            label="Format"
            wrapperClassName={styles.formatField}
            options={FORMAT_OPTIONS}
            onChange={(event) => setFormat(event.target.value as FormatFilter)}
          />
          <div className={styles.colorGroup}>
            <span className={styles.colorLabel} id="explore-colors">
              Colours
            </span>
            <div className={styles.colorPickers} role="group" aria-labelledby="explore-colors">
              {MTG_COLORS.map((color) => {
                const selected = colors.includes(color);
                return (
                  <button
                    key={color}
                    type="button"
                    className={`${styles.colorPicker} ${selected ? styles.colorPickerOn : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleColor(color)}
                  >
                    <ManaIcon color={color} size={20} />
                    <span className="visually-hidden">{MANA_COLOR_NAMES[color]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {state.kind === 'loading' ? (
          <div className={styles.centered} role="status">
            <Spinner size="lg" label="Loading community decks" />
          </div>
        ) : null}

        {state.kind === 'error' ? (
          <div className={styles.panel} role="alert">
            <h2 className={styles.panelTitle}>The archive would not open</h2>
            <p className={styles.panelBody}>{state.message}</p>
            <Button variant="primary" size="md" onClick={() => setReloadToken((token) => token + 1)}>
              Try again
            </Button>
          </div>
        ) : null}

        {state.kind === 'ready' && state.decks.length === 0 ? (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>{filtered ? 'No decks match' : 'Nothing shared yet'}</h2>
            <p className={styles.panelBody}>
              {filtered
                ? 'No public deck matches those filters. Loosen them and try again.'
                : 'Public decks appear here as soon as their owners save them.'}
            </p>
            {filtered ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}

        {state.kind === 'ready' && state.decks.length > 0 ? (
          <>
            <ul className={styles.grid}>
              {state.decks.map((deck) => (
                <li key={deck.id} className={styles.gridItem}>
                  <DeckSummaryCard
                    deck={deck}
                    variant="feed"
                    viewHref={`/explore/deck?id=${encodeURIComponent(deck.id)}`}
                  />
                </li>
              ))}
            </ul>

            {state.more.kind === 'error' ? (
              <p className={styles.moreError} role="alert">
                {state.more.message}
              </p>
            ) : null}

            {state.nextCursor ? (
              <div className={styles.more}>
                <Button
                  variant="outline"
                  size="sm"
                  loading={state.more.kind === 'loading'}
                  onClick={() => void loadMore()}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
