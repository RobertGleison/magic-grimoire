'use client';

import { useEffect, useState } from 'react';
import {
  MOCK_AUTH_BANNER_TEXT,
  MOCK_AUTH_ENABLED,
  MOCK_AUTH_ENV_VAR,
} from '../../lib/mockAuth';
import './MockAuthBanner.css';

/** Per-tab dismissal only — it comes back on every new session, by design. */
const DISMISS_KEY = 'mg.mockAuth.bannerDismissed';

/**
 * Development banner for the mocked-auth stub.
 *
 * Renders NOTHING unless `NEXT_PUBLIC_MOCK_AUTH=true`, so it costs a
 * production build one dead boolean. `app/layout.tsx` also gates on the same
 * constant, which lets the bundler drop this module entirely.
 *
 * Deliberately un-dismissible beyond the current tab session: the point is
 * that nobody can forget the app is not really authenticating anyone.
 */
export function MockAuthBanner() {
  const [dismissed, setDismissed] = useState(false);

  // Read after mount, never during render — sessionStorage is not available
  // during SSR and reading it in render would desync hydration.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === 'true') setDismissed(true);
    } catch {
      // Private windows and blocked-storage settings throw. Keep it visible.
    }
  }, []);

  if (!MOCK_AUTH_ENABLED || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // Not persisting the dismissal is the safe failure.
    }
  };

  return (
    <div className="mock-auth-banner" role="status">
      <p className="mock-auth-banner-text">
        <strong className="mock-auth-banner-label">Dev build</strong>
        <span>{MOCK_AUTH_BANNER_TEXT}</span>{' '}
        <span className="mock-auth-banner-hint">
          Set <code className="mock-auth-banner-code">{MOCK_AUTH_ENV_VAR}=false</code> to restore
          real Supabase auth. Never deploy with it enabled.
        </span>
      </p>
      <button
        type="button"
        className="mock-auth-banner-dismiss"
        onClick={dismiss}
        aria-label="Hide the mocked-authentication notice for this tab"
      >
        Dismiss
      </button>
    </div>
  );
}
