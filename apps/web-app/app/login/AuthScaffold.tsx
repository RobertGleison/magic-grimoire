'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import type { AuthProvider } from './authShared';
import styles from './AuthScaffold.module.css';

/*
 * Shared chrome for the two auth screens.
 *
 * Geometry from the DARK frames (canonical): card 480x813 (sign-up 16:367) /
 * 480x663 (login 16:410), 48px padding, 32px stack gap, 16px radius, 2px
 * --line-strong frame. The light frames (20:1000 / 20:1045) contributed
 * colour only and every colour they carry already has a token.
 *
 * Lives in `app/login/` and is imported by `app/signup/` with a full relative
 * path — wave-3 screens must not add anything to `app/components/`.
 */

/** Grimoire glyph, node 16:369 / 16:412 (36x36 in the design). */
function BookIcon() {
  return (
    <svg
      className={styles.bookIcon}
      viewBox="0 0 28 28"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M23.4873 22.1476V20.9837C23.4873 19.3766 27.4548 18.0739 25.8344 18.0739H4.71063C3.09024 18.0739 1.77673 19.3766 1.77673 20.9837V22.1476C1.77673 23.7547 3.09024 25.0574 4.71063 25.0574H25.8344C27.4548 25.0574 23.4873 23.7547 23.4873 22.1476ZM22.6417 23.8936H4.9223C3.8332 23.8936 2.95029 23.025 2.95029 21.9536V21.1777C2.95029 20.1063 3.8332 19.2378 4.9223 19.2378H22.6417C23.7308 19.2378 22.2376 20.1063 22.2376 21.1777V21.9536C22.2376 23.025 23.7308 23.8936 22.6417 23.8936ZM9.36634 9.9262H22.9246C24.5449 9.9262 20.5775 8.62347 20.5775 7.01636V5.85242C20.5775 4.24543 24.5449 2.94256 22.9246 2.94256H9.36634C7.746 2.94256 6.43252 4.2454 6.43252 5.85242V7.01636C6.43249 8.62347 7.746 9.9262 9.36634 9.9262ZM7.60606 6.0464C7.60606 4.97504 8.48896 4.10653 9.57806 4.10653H19.7319C20.821 4.10653 19.3278 4.97504 19.3278 6.0464V6.82239C19.3278 7.89374 20.821 8.76226 19.7319 8.76226H9.57806C8.48896 8.76226 7.60606 7.89374 7.60606 6.82239V6.0464ZM4.48966 17.4918H22.1217C23.742 17.4918 25.0556 16.1891 25.0556 14.582V13.4181C25.0556 11.811 23.742 10.5083 22.1217 10.5083H4.48966C2.86933 10.5083 6.83682 11.811 6.83682 13.4181V14.582C6.8368 16.1891 2.86933 17.4918 4.48966 17.4918ZM7.68235 11.6721H21.91C22.9991 11.6721 23.882 12.5407 23.882 13.6121V14.388C23.882 15.4594 22.9991 16.3279 21.91 16.3279H7.68235C6.59325 16.3279 8.08646 15.4594 8.08646 14.388V13.6121C8.08646 12.5407 6.59325 11.6721 7.68235 11.6721Z" />
    </svg>
  );
}

/**
 * The design's social marks are placeholder glyphs (`circle-x`, `app-window`)
 * for providers named "Google" and "Discord". We ship the real Google and
 * GitHub marks — the providers Supabase is actually configured with — drawn in
 * `currentColor` so they inherit the button label in both themes rather than
 * baking brand hex into a token-only codebase.
 */
function GoogleMark() {
  return (
    <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 11.1v3.05h4.32a3.7 3.7 0 0 1-1.61 2.43l2.6 2.02c1.52-1.4 2.4-3.47 2.4-5.93 0-.57-.05-1.12-.15-1.65H12Z" />
      <path d="M12 20c2.16 0 3.98-.71 5.31-1.94l-2.6-2.01c-.72.48-1.64.77-2.71.77-2.08 0-3.85-1.4-4.48-3.29L4.83 15.6A8 8 0 0 0 12 20Z" />
      <path d="M7.52 13.53a4.8 4.8 0 0 1 0-3.06L4.83 8.4a8 8 0 0 0 0 7.2l2.69-2.07Z" />
      <path d="M12 7.18c1.18 0 2.23.4 3.06 1.2l2.29-2.29A7.7 7.7 0 0 0 12 4a8 8 0 0 0-7.17 4.4l2.69 2.07C8.15 8.58 9.92 7.18 12 7.18Z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg className={styles.socialIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const PROVIDERS: { id: AuthProvider; label: string; mark: ReactNode }[] = [
  { id: 'google', label: 'Google', mark: <GoogleMark /> },
  { id: 'github', label: 'GitHub', mark: <GitHubMark /> },
];

interface AuthScaffoldProps {
  children: ReactNode;
}

/**
 * Page ground: the two blurred orbs of node 16:364 — crimson 450px at 12%
 * top-left, gold 400px at 8% bottom-right — plus the centred card.
 */
export function AuthScaffold({ children }: AuthScaffoldProps) {
  return (
    <div className={styles.page}>
      <span className={`${styles.orb} ${styles.orbCrimson}`} aria-hidden="true" />
      <span className={`${styles.orb} ${styles.orbAccent}`} aria-hidden="true" />
      <Card
        as="section"
        variant="panel"
        border="thick"
        radius="xl"
        padding="none"
        elevation={3}
        className={styles.card}
      >
        {children}
      </Card>
    </div>
  );
}

interface AuthHeadingProps {
  title: string;
  subtitle: string;
  /** Bound to the `<form>` via `aria-labelledby`. */
  titleId: string;
}

export function AuthHeading({ title, subtitle, titleId }: AuthHeadingProps) {
  return (
    <header className={styles.heading}>
      <BookIcon />
      <h1 className={styles.title} id={titleId}>
        {title}
      </h1>
      <p className={styles.subtitle}>{subtitle}</p>
    </header>
  );
}

/** Divider rule + centred caption ("Or Forge With" / "Or Connect With"). */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className={styles.divider}>
      <span className={styles.dividerRule} aria-hidden="true" />
      <span className={styles.dividerLabel}>{label}</span>
      <span className={styles.dividerRule} aria-hidden="true" />
    </div>
  );
}

interface SocialAuthRowProps {
  onSelect: (provider: AuthProvider) => void;
  /** The provider currently mid-redirect, if any. */
  busyProvider: AuthProvider | null;
  disabled?: boolean;
  /** "Continue with Google" — the accessible name; the visible label is short. */
  actionVerb: string;
}

export function SocialAuthRow({ onSelect, busyProvider, disabled = false, actionVerb }: SocialAuthRowProps) {
  return (
    <div className={styles.socialRow}>
      {PROVIDERS.map(({ id, label, mark }) => (
        <Button
          key={id}
          type="button"
          variant="subtle"
          size="sm"
          fullWidth
          className={styles.socialButton}
          iconLeft={mark}
          loading={busyProvider === id}
          disabled={disabled || (busyProvider !== null && busyProvider !== id)}
          onClick={() => onSelect(id)}
        >
          <span className={styles.socialLabel}>{label}</span>
          <span className="visually-hidden">{` — ${actionVerb} ${label}`}</span>
        </Button>
      ))}
    </div>
  );
}

interface AuthSwitchProps {
  prompt: string;
  href: string;
  label: string;
}

export function AuthSwitch({ prompt, href, label }: AuthSwitchProps) {
  return (
    <p className={styles.switchRow}>
      <span className={styles.switchPrompt}>{prompt}</span>{' '}
      <Link className={styles.switchLink} href={href}>
        {label}
      </Link>
    </p>
  );
}

interface FormAlertProps {
  tone: 'error' | 'notice';
  children: ReactNode;
}

/**
 * Form-level status. `role="alert"` for failures so a screen reader hears the
 * Supabase message immediately; `role="status"` for the polite confirm-email
 * notice.
 */
export function FormAlert({ tone, children }: FormAlertProps) {
  return (
    <p
      className={tone === 'error' ? styles.alertError : styles.alertNotice}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
