/**
 * Shared auth helpers for `/login` and `/signup`.
 *
 * Page-local by design (RALPH wave-3 rule: six screen agents run in parallel,
 * so nothing lands in `app/components/`). `/signup` imports from here with a
 * full relative path. Wave 5 may promote this to a shared module.
 *
 * Nothing in this file ever touches a password. Credentials live only in the
 * form components' local state and go straight to `@supabase/supabase-js`.
 */

/** Where a successful sign-in lands when `?next=` is absent or unusable. */
export const AUTH_DEFAULT_DESTINATION = '/library';

/** Supabase's own floor is 6; the forms ask for 8. */
export const PASSWORD_MIN_LENGTH = 8;

/** Shown instead of a working form when the Supabase env vars are missing. */
export const SUPABASE_CONFIG_ERROR =
  'Authentication is not configured. NEXT_PUBLIC_SUPABASE_URL and ' +
  'NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set in apps/web-app/.env.local, ' +
  'then the dev server restarted — Next.js inlines NEXT_PUBLIC_* at build time.';

/**
 * `NEXT_PUBLIC_*` reads are written out longhand so the Next compiler can
 * statically inline them. Reading them inside the function (rather than at
 * module scope) keeps the check honest under test.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Normalises the `?next=` parameter into a safe in-app destination.
 *
 * Only same-origin *paths* survive: anything absolute (`https://evil.test`),
 * protocol-relative (`//evil.test`) or backslash-smuggled (`/\evil.test`)
 * collapses to {@link AUTH_DEFAULT_DESTINATION}. This is the open-redirect
 * guard for the whole auth surface — Wave 4a must route through it rather than
 * pass a raw query value to `router.replace`.
 */
export function resolveNextPath(next: string | null | undefined): string {
  if (!next) return AUTH_DEFAULT_DESTINATION;

  const trimmed = next.trim();
  if (!trimmed.startsWith('/')) return AUTH_DEFAULT_DESTINATION;
  // `//host` and `/\host` are both browser-legal ways to leave the origin.
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return AUTH_DEFAULT_DESTINATION;
  if (trimmed.includes('://')) return AUTH_DEFAULT_DESTINATION;

  return trimmed;
}

/**
 * Absolute URL Supabase sends the browser back to after an OAuth round-trip.
 *
 * SEAM FOR WAVE 4a — the client is on the default implicit flow, so the
 * provider hands the session back in the URL fragment and
 * `detectSessionInUrl` picks it up wherever the user lands. That means we can
 * return people straight to their destination and skip a callback route. If
 * 4a switches to PKCE or server-rendered sessions it needs an
 * `/auth/callback` route that exchanges `?code=` and then forwards to
 * `?next=`; changing this one function is the whole edit.
 */
export function oauthRedirectTo(next: string | null | undefined): string {
  const path = resolveNextPath(next);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${path}`;
}

/** Builds the cross-link between /login and /signup, preserving `?next=`. */
export function authHref(pathname: '/login' | '/signup', next: string | null | undefined): string {
  const path = resolveNextPath(next);
  return path === AUTH_DEFAULT_DESTINATION
    ? pathname
    : `${pathname}?next=${encodeURIComponent(path)}`;
}

/**
 * Turns whatever Supabase (or the network) threw into something a person can
 * read. Supabase's own `AuthError.message` is already user-facing, so it is
 * passed through verbatim rather than replaced with a house string — the task
 * is to surface real errors, not to launder them. Never a stack trace.
 */
export function describeAuthError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message).trim();
    if (message) return message;
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Something went wrong reaching the authentication service. Please try again.';
}

/** Deliberately permissive — the server is the real authority on deliverability. */
export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'That does not look like an email address.';
  return undefined;
}

export function validatePassword(password: string, { requireStrong = false } = {}): string | undefined {
  if (!password) return 'Enter your password.';
  if (requireStrong && password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return undefined;
}

export function validateHandle(handle: string): string | undefined {
  const value = handle.trim();
  if (!value) return 'Choose a handle.';
  if (value.length < 3) return 'Use at least 3 characters.';
  return undefined;
}

/** The two providers the app has configured in Supabase. */
export type AuthProvider = 'google' | 'github';
