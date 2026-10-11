'use client';

import { useEffect, useState } from 'react';

import { DeckView } from '../../library/deck/DeckView';
import type { DeckResponse } from '../../types/api';

/* ==========================================================================
   /explore/deck?id=<uuid> — a public deck, read-only, for anyone (signed in
   or not). Same view as the library's; Edit, tags and the lock appear only
   when the API says the caller owns the deck.
   ========================================================================== */

function shareUrl(deck: DeckResponse): string {
  return `${window.location.origin}/explore/deck?id=${encodeURIComponent(deck.id)}`;
}

export default function ExploreDeckPage() {
  const [deckId, setDeckId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setDeckId(new URLSearchParams(window.location.search).get('id'));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (deckId === undefined) return null;

  return (
    <DeckView
      deckId={deckId}
      editHref={deckId ? `/deck-builder?deck=${encodeURIComponent(deckId)}` : undefined}
      backHref="/explore"
      backLabel="Back to explore"
      shareUrl={shareUrl}
    />
  );
}
