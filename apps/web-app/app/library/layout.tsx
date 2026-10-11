'use client';

import type { ReactNode } from 'react';

import { RequireSignIn } from '../components/RequireSignIn/RequireSignIn';

/* `GET /decks` and `DELETE /decks/{id}` need a bearer token. */
export default function LibraryLayout({ children }: { children: ReactNode }) {
  return <RequireSignIn path="/library">{children}</RequireSignIn>;
}
