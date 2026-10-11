'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner/Spinner';
import { DeckResultsPanel } from '../../deck-builder/DeckResultsPanel';
import { deckFileName, deckListText } from '../../deck-builder/deckLogic';
import { ApiError, getDeck, isAbortError } from '../../lib/apiClient';
import type { DeckResponse } from '../../types/api';
import styles from './page.module.css';

/* ==========================================================================
   DeckView — a deck's cards, read-only. No chat is rendered or initialised
   here: the cards + chat experience lives behind "Edit" (the deck builder).
   The card grid/list and analytics are the deck builder's own
   `DeckResultsPanel`, reused as-is with its Save action omitted.
   ========================================================================== */

type ViewState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; deck: DeckResponse };

/** How long an action confirmation ("Decklist copied.") stays up. */
const NOTE_MS = 2400;

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 403) return 'This deck does not exist or is not yours to view.';
    return error.message;
  }
  return 'Something went wrong opening this deck.';
}

interface DeckViewProps {
  /** `null` while the URL is still being read, or when it carries no id. */
  deckId: string | null;
  /** Where "Edit" points. Omit to hide the action (someone else's deck). */
  editHref?: string;
  /** The page this view was opened from. */
  backHref: string;
  backLabel: string;
  /** The URL "Copy Link" puts on the clipboard. */
  shareUrl: (deck: DeckResponse) => string;
}

export function DeckView({ deckId, editHref, backHref, backLabel, shareUrl }: DeckViewProps) {
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [note, setNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!deckId) {
      setState({ kind: 'missing' });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
    getDeck(deckId, { signal: controller.signal })
      .then((deck) => setState({ kind: 'ready', deck }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState({ kind: 'error', message: messageOf(error) });
      });
    return () => controller.abort();
  }, [deckId]);

  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);

  const flash = useCallback((message: string) => {
    setNote(message);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), NOTE_MS);
  }, []);

  const deck = state.kind === 'ready' ? state.deck : null;

  const handleCopyList = useCallback(async () => {
    if (!deck) return;
    try {
      await navigator.clipboard.writeText(deckListText(deck));
      flash('Decklist copied.');
    } catch {
      flash('Clipboard blocked — use Export TXT.');
    }
  }, [deck, flash]);

  const handleCopyLink = useCallback(async () => {
    if (!deck) return;
    try {
      await navigator.clipboard.writeText(shareUrl(deck));
      flash('Link copied.');
    } catch {
      flash('Clipboard blocked — copy the URL from the address bar.');
    }
  }, [deck, flash, shareUrl]);

  const handleExportText = useCallback(() => {
    if (!deck) return;
    const blob = new Blob([deckListText(deck)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = deckFileName(deck);
    anchor.click();
    URL.revokeObjectURL(url);
    flash('Decklist downloaded.');
  }, [deck, flash]);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <nav className={styles.toolbar} aria-label="Deck actions">
          <Button href={backHref} variant="ghost" size="sm">
            &larr; {backLabel}
          </Button>
          {deck && editHref ? (
            <Button href={editHref} variant="primary" size="sm" disabled={deck.status !== 'completed'}>
              Edit
            </Button>
          ) : null}
        </nav>

        {state.kind === 'loading' ? (
          <div className={styles.centered} role="status">
            <Spinner size="lg" label="Opening the deck" />
          </div>
        ) : null}

        {state.kind === 'missing' ? (
          <div className={styles.panel} role="alert">
            <h1 className={styles.panelTitle}>No deck chosen</h1>
            <p className={styles.panelBody}>Pick a deck to open it.</p>
          </div>
        ) : null}

        {state.kind === 'error' ? (
          <div className={styles.panel} role="alert">
            <h1 className={styles.panelTitle}>The deck would not open</h1>
            <p className={styles.panelBody}>{state.message}</p>
          </div>
        ) : null}

        {deck ? (
          <DeckResultsPanel
            deck={deck}
            onCopyList={() => void handleCopyList()}
            onCopyLink={() => void handleCopyLink()}
            onExportText={handleExportText}
            actionNote={note}
          />
        ) : null}
      </div>
    </div>
  );
}
