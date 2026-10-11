'use client';

import { useEffect, useState } from 'react';

import type { DeckResponse } from '../../types/api';
import { DeckView } from './DeckView';

/* ==========================================================================
   /library/deck?id=<uuid> — a saved deck, read-only (cards, no chat).
   "Edit" is the deck builder (`/deck-builder?deck=<uuid>`), which is the
   cards + chat experience. The id rides in the query string rather than a
   `[id]` segment because production is a static export, which cannot
   pre-render one page per deck. Auth gating comes from `../layout.tsx`.
   ========================================================================== */

function readDeckId(): string | null {
  return new URLSearchParams(window.location.search).get('id');
}

function shareUrl(deck: DeckResponse): string {
  return `${window.location.origin}/library/deck?id=${encodeURIComponent(deck.id)}`;
}

export default function LibraryDeckPage() {
  // Undefined until mounted: read off `window.location` rather than
  // `useSearchParams`, which would force a Suspense boundary at build time
  // for a value only ever needed on the client (same as the deck builder).
  const [deckId, setDeckId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setDeckId(readDeckId());
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (deckId === undefined) return null;

  return (
    <DeckView
      deckId={deckId}
      editHref={deckId ? `/deck-builder?deck=${encodeURIComponent(deckId)}` : undefined}
      backHref="/library"
      backLabel="Back to library"
      shareUrl={shareUrl}
    />
  );
}
