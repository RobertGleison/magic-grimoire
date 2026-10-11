'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '../components/Button/Button';
import { CardTile } from '../components/CardTile/CardTile';
import { Spinner } from '../components/Spinner/Spinner';
import { ApiError, isAbortError, searchCards } from '../lib/apiClient';
import type { CardInDeck, CardSearchResult } from '../types/api';
import {
  CARD_SEARCH_DEBOUNCE_MS,
  CARD_SEARCH_MAX_CHARS,
  CARD_SEARCH_MIN_CHARS,
  copiesInDeck,
  copyLimit,
  deckCardTotal,
  deckSizeTarget,
  isBasicLand,
  maxAddable,
} from './deckLogic';
import styles from './page.module.css';

/* ==========================================================================
   AddCardsPanel — no Figma source (MTG-17).
   --------------------------------------------------------------------------
   An in-page panel above the deck: search real cards by name, pick a
   quantity, add. The search is debounced at 400ms and a superseded request
   is aborted, so only the latest query can ever paint results. Results reuse
   `CardTile`, with the copies already in the deck as its ×N.

   Format rules are enforced where they are unambiguous — the copy limit (4,
   or 1 in Commander; basic lands exempt) caps the quantity field — and only
   warned about where they are not: deck size is a target the user may be
   mid-way towards, so it is reported, never blocked.
   ========================================================================== */

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; cards: CardSearchResult[] }
  | { kind: 'error'; message: string };

function asTile(card: CardSearchResult, copies: number): CardInDeck {
  return { ...card, quantity: copies, section: 'mainboard' };
}

interface ResultRowProps {
  card: CardSearchResult;
  cards: readonly CardInDeck[];
  format: string;
  busy: boolean;
  onAdd: (card: CardSearchResult, quantity: number) => void;
}

function ResultRow({ card, cards, format, busy, onAdd }: ResultRowProps) {
  const quantityId = useId();
  const copies = copiesInDeck(cards, card.name);
  const ceiling = maxAddable(cards, card, format);
  const [quantity, setQuantity] = useState(1);
  const clamped = Math.min(Math.max(1, quantity), Math.max(1, ceiling));
  const atLimit = ceiling === 0;

  return (
    <li className={styles.addCardsResult}>
      <CardTile card={asTile(card, copies)} />
      <div className={styles.addCardsControls}>
        <label className={styles.numberFieldLabel} htmlFor={quantityId}>
          Qty
        </label>
        <input
          id={quantityId}
          className={styles.numberInput}
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(1, ceiling)}
          value={clamped}
          disabled={atLimit || busy}
          aria-label={`Qty of ${card.name}`}
          onChange={(event) => setQuantity(Number(event.target.value) || 1)}
        />
        <Button
          variant="subtle"
          size="xs"
          className={styles.goldButton}
          disabled={atLimit || busy}
          aria-label={`Add ${clamped} ${card.name}`}
          onClick={() => onAdd(card, clamped)}
        >
          Add
        </Button>
      </div>
      {atLimit ? (
        <p className={styles.addCardsWarning}>
          {copyLimit(format) === 1 ? 'Singleton — already in the deck.' : `${copyLimit(format)}-copy limit reached.`}
        </p>
      ) : isBasicLand(card) ? (
        <p className={styles.addCardsHint}>Basic land — no copy limit.</p>
      ) : null}
    </li>
  );
}

interface AddCardsPanelProps {
  /** The deck being edited; its list drives copy counts and limits. */
  cards: readonly CardInDeck[];
  format: string;
  /** Adds `quantity` copies; the page updates the list and persists it. */
  onAdd: (card: CardSearchResult, quantity: number) => void;
  onClose: () => void;
  /** An add is being saved — the add buttons wait for it. */
  busy?: boolean;
  /** Outcome of the last add, for the live region. */
  note?: string;
}

export function AddCardsPanel({ cards, format, onAdd, onClose, busy = false, note = '' }: AddCardsPanelProps) {
  const headingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce, then search; a newer query (or closing the panel) aborts the
  // request in flight, so a slow early answer can never overwrite a later one.
  useEffect(() => {
    const term = query.trim();
    if (term.length < CARD_SEARCH_MIN_CHARS) {
      setSearch({ kind: 'idle' });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearch({ kind: 'loading' });
      try {
        const response = await searchCards(term, { signal: controller.signal });
        if (!controller.signal.aborted) setSearch({ kind: 'done', cards: response.cards });
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) return;
        setSearch({
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'Card search failed. Try again.',
        });
      }
    }, CARD_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  const total = deckCardTotal(cards);
  const target = deckSizeTarget(format);
  const commander = copyLimit(format) === 1;
  const sizeNote = commander
    ? total === target
      ? `${total} / ${target} cards — exactly right for Commander.`
      : `${total} / ${target} cards — Commander decks are exactly ${target}.`
    : total < target
      ? `${total} cards — ${format} decks need at least ${target}.`
      : `${total} cards.`;
  const sizeOff = commander ? total !== target : total < target;

  return (
    <section className={styles.addCardsPanel} aria-labelledby={headingId} onKeyDown={handleKeyDown}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={headingId}>
          Add Cards
        </h2>
        <Button variant="ghost" size="xs" onClick={onClose}>
          Close
        </Button>
      </div>

      <input
        ref={inputRef}
        className={styles.addCardsSearch}
        type="search"
        value={query}
        maxLength={CARD_SEARCH_MAX_CHARS}
        placeholder="Search cards by name…"
        aria-label="Search cards by name"
        onChange={(event) => setQuery(event.target.value)}
      />

      <p className={sizeOff ? styles.addCardsWarning : styles.addCardsHint}>{sizeNote}</p>

      <div className={styles.addCardsBody} aria-busy={search.kind === 'loading'}>
        {search.kind === 'idle' ? (
          <p className={styles.addCardsHint}>Type at least {CARD_SEARCH_MIN_CHARS} letters of a card name.</p>
        ) : search.kind === 'loading' ? (
          <p className={styles.addCardsHint}>
            <Spinner size="xs" label="" /> Searching the archives…
          </p>
        ) : search.kind === 'error' ? (
          <p className={styles.addCardsWarning} role="alert">
            {search.message}
          </p>
        ) : search.cards.length === 0 ? (
          <p className={styles.addCardsHint}>No cards match “{query.trim()}”.</p>
        ) : (
          <ul className={styles.addCardsResults} aria-label="Matching cards">
            {search.cards.map((card) => (
              <ResultRow
                key={card.scryfall_id ?? card.name}
                card={card}
                cards={cards}
                format={format}
                busy={busy}
                onAdd={onAdd}
              />
            ))}
          </ul>
        )}
      </div>

      <p className={styles.actionNote} role="status" aria-live="polite">
        {note}
      </p>
    </section>
  );
}
