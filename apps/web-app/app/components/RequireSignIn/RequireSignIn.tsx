'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { Spinner } from '../Spinner/Spinner';
import { useUser } from '../../context/UserContext';
import { resolveNextPath } from '../../login/authShared';
import styles from './RequireSignIn.module.css';

/* ==========================================================================
   Route guard: signed-out visitors are sent to `/login` and brought back.

   `path` is a constant from the calling layout, never `usePathname()` output,
   so nothing user-controlled decides where `/login` returns to. Only the query
   string (e.g. `?deck=…` on the deck builder) is carried over, behind that
   fixed path, and both this and `/login` run it through `resolveNextPath()`,
   the open-redirect chokepoint.
   ========================================================================== */

export function RequireSignIn({ path, children }: { path: string; children: ReactNode }) {
  const router = useRouter();
  const { status } = useUser();

  useEffect(() => {
    if (status !== 'signed-out') return;
    const next = resolveNextPath(`${path}${window.location.search}`);
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [status, router, path]);

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
