'use client';

import type { ReactNode } from 'react';

import { RequireSignIn } from '../components/RequireSignIn/RequireSignIn';

/* `POST /decks/generate` and `POST /chat` spend LLM tokens, so they need an
   account (the API returns 401 without one). */
export default function DeckBuilderLayout({ children }: { children: ReactNode }) {
  return <RequireSignIn path="/deck-builder">{children}</RequireSignIn>;
}
