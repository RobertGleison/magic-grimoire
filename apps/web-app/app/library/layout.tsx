'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { Spinner } from '../components/Spinner/Spinner';
import { useUser } from '../context/UserContext';
import { resolveNextPath } from '../login/authShared';
import styles from './page.module.css';

/* ==========================================================================
   Route guard for `/library`.

   `GET /decks` and `DELETE /decks/{id}` are the only endpoints that require a
   bearer token, so `/library` is the only guarded route. `/deck-builder` is
   deliberately NOT guarded — `POST /decks/generate` and `POST /chat` work
   signed out and that screen is designed for it.

   The destination is built with `resolveNextPath()`, the same open-redirect
   chokepoint the login form uses. It is a constant here rather than
   `usePathname()` output so nothing user-controlled can ever reach the query
   string, and `/login` re-normalises whatever it receives anyway.
   ========================================================================== */

const GUARDED_PATH = '/library';
const SIGN_IN_HREF = `/login?next=${encodeURIComponent(resolveNextPath(GUARDED_PATH))}`;

export default function LibraryLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useUser();

  useEffect(() => {
    if (status === 'signed-out') router.replace(SIGN_IN_HREF);
  }, [status, router]);

  if (status === 'signed-out') {
    return (
      <div className={styles.centered} role="status">
        <Spinner size="lg" label="Taking you to sign in" />
      </div>
    );
  }

  // `checking` renders through: the page shows its own spinner, and the
  // prerendered HTML stays identical to the first client paint.
  return <>{children}</>;
}
