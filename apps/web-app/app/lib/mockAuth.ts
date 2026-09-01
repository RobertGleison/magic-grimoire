/* ==========================================================================
   ██  MOCK AUTHENTICATION — DEVELOPMENT STUB, NEVER SHIP THIS ENABLED  ██
   --------------------------------------------------------------------------
   Every credential works. There is no password check, no server, no token.
   `signInWithPassword('anything@example.com', 'x')` succeeds.

   This file exists so the UI can be built and demoed before Supabase is
   wired up for real. It is deliberately quarantined in ONE module behind ONE
   switch:

       NEXT_PUBLIC_MOCK_AUTH=true    ->  this stub is in charge
       NEXT_PUBLIC_MOCK_AUTH unset   ->  every call site goes to Supabase

   Nothing here weakens the real code path. `app/context/UserContext.tsx`
   implements BOTH branches, so flipping the env var restores real Supabase
   auth with no code edit. `app/lib/supabase.ts` is untouched.

   Guard rails, so this cannot ship by accident:
     - the switch is a single `NEXT_PUBLIC_*` env var, absent by default;
     - `MOCK_AUTH_ENABLED` is `false` for any value other than the exact
       string `'true'`;
     - activation logs a console warning naming the variable;
     - `<MockAuthBanner>` puts a permanent red bar across every page;
     - `README.md` documents the variable and the never-deploy rule.

   Call shapes mirror `@supabase/supabase-js` (`{ data, error }`,
   `onAuthStateChange` returning `{ data: { subscription } }`) so swapping a
   call site back to Supabase is a one-line change.
   ========================================================================== */

// Layering note: `app/lib` reaching into `app/login` is deliberate.
// `authShared.ts` is the single source of truth for what a valid email looks
// like, and the mock must agree with the form so the form's own validation
// stays meaningful. Wave 5 may promote `authShared` out of the page folder.
import { validateEmail } from '../login/authShared';

/** The one switch. Any value other than the exact string `'true'` is off. */
export const MOCK_AUTH_ENABLED = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';

/** Named once so the warning, the banner and the README cannot drift apart. */
export const MOCK_AUTH_ENV_VAR = 'NEXT_PUBLIC_MOCK_AUTH';

/**
 * Obviously-fake storage key. A real session would never live under a name
 * with `mock` in it, so anyone reading devtools sees what is going on.
 */
export const MOCK_SESSION_STORAGE_KEY = 'mg.mockAuth.session';

/** Shown by the auth screens when a provider button is pressed in mock mode. */
export const MOCK_PROVIDER_NOTICE =
  'Google and GitHub sign-in are disabled while authentication is mocked. ' +
  'Sign in with any email and password instead.';

/** Copy for the dev banner. */
export const MOCK_AUTH_BANNER_TEXT =
  'Authentication is MOCKED. Any email and password will sign you in, and no ' +
  'real account or token exists.';

/* ----------------------------------------------------------------- types */

export interface MockAuthUser {
  id: string;
  email: string;
  /** Given at sign-up, otherwise derived from the email local-part. */
  name: string;
}

export interface MockSession {
  user: MockAuthUser;
  /**
   * A placeholder string, NOT a JWT. It is never sent anywhere — the API
   * client reads its bearer token from Supabase, which has no session in
   * mock mode, so authenticated endpoints still 401 exactly as they should.
   */
  accessToken: 'mock-access-token';
  issuedAt: number;
}

export type MockAuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT';

export interface MockAuthError {
  message: string;
}

export interface MockAuthResponse {
  data: { session: MockSession | null };
  error: MockAuthError | null;
}

export interface MockProviderResponse {
  data: { session: null };
  error: null;
  /** Always set. The caller shows this instead of pretending it worked. */
  notice: string;
}

/* ------------------------------------------------------- activation noise */

let warned = false;

/** Warns once per module instance. Called at import and defensively per call. */
function warnOnce(): void {
  if (warned || !MOCK_AUTH_ENABLED) return;
  warned = true;
  console.warn(
    `[mockAuth] AUTHENTICATION IS MOCKED. Any email + password signs in and no ` +
      `real session exists. This is on because ${MOCK_AUTH_ENV_VAR}=true — set it ` +
      `to false (or remove it) in apps/web-app/.env.local to restore real ` +
      `Supabase auth. NEVER DEPLOY WITH THIS ENABLED.`,
  );
}

warnOnce();

/* ---------------------------------------------------------------- storage */

/**
 * Every read and write is wrapped: private windows, blocked-storage settings
 * and server-side rendering all throw on `window.localStorage`.
 */
function readStoredSession(): MockSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MOCK_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isMockSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: MockSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MOCK_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable — the session simply does not survive a reload.
  }
}

function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
  } catch {
    // Nothing to do; there is no session to clear.
  }
}

function isMockSession(value: unknown): value is MockSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { user?: unknown };
  if (!candidate.user || typeof candidate.user !== 'object') return false;
  const user = candidate.user as { id?: unknown; email?: unknown; name?: unknown };
  return (
    typeof user.id === 'string' && typeof user.email === 'string' && typeof user.name === 'string'
  );
}

/* -------------------------------------------------------------- listeners */

type Listener = (event: MockAuthEvent, session: MockSession | null) => void;

const listeners = new Set<Listener>();

function emit(event: MockAuthEvent, session: MockSession | null): void {
  for (const listener of [...listeners]) listener(event, session);
}

/* ---------------------------------------------------------------- helpers */

/**
 * "liliana@mana.vault" -> "liliana". Punctuation becomes spaces so a handle
 * like `liliana.vess` reads as a name rather than a slug.
 */
export function displayNameFromEmail(email: string): string {
  const local = email.trim().split('@')[0] ?? '';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  return cleaned || 'Planeswalker';
}

/** Stable per email, so signing back in returns the same fake identity. */
function userIdFor(email: string): string {
  return `mock-user:${email.toLowerCase()}`;
}

function createSession(email: string, name?: string): MockSession {
  const trimmedName = name?.trim();
  return {
    user: {
      id: userIdFor(email),
      email,
      name: trimmedName || displayNameFromEmail(email),
    },
    accessToken: 'mock-access-token',
    issuedAt: Date.now(),
  };
}

function fail(message: string): MockAuthResponse {
  return { data: { session: null }, error: { message } };
}

/* ------------------------------------------------------------------- API */

/**
 * Succeeds for ANY non-empty password on any address that looks like an
 * email. The password is read once to confirm it is non-empty and then
 * discarded — it is never hashed, compared, stored or logged, not even here.
 */
export async function signInWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<MockAuthResponse> {
  warnOnce();

  const trimmed = email.trim();
  const emailProblem = validateEmail(trimmed);
  if (emailProblem) return fail(emailProblem);
  if (!password) return fail('Enter your password.');

  // `password` goes out of scope here and is never referenced again.
  const existing = readStoredSession();
  const session = createSession(
    trimmed,
    existing?.user.email.toLowerCase() === trimmed.toLowerCase() ? existing.user.name : undefined,
  );

  writeStoredSession(session);
  emit('SIGNED_IN', session);
  return { data: { session }, error: null };
}

/** Same permissiveness as sign-in, and remembers the display name given. */
export async function signUp({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}): Promise<MockAuthResponse> {
  warnOnce();

  const trimmed = email.trim();
  const emailProblem = validateEmail(trimmed);
  if (emailProblem) return fail(emailProblem);
  if (!password) return fail('Enter your password.');

  const session = createSession(trimmed, name);
  writeStoredSession(session);
  emit('SIGNED_IN', session);
  return { data: { session }, error: null };
}

/**
 * A no-op. It resolves, it never throws, it never navigates and it never
 * creates a session — the caller shows {@link MOCK_PROVIDER_NOTICE} so the
 * button stops spinning and the user is told the truth.
 */
export async function signInWithProvider(
  provider: 'google' | 'github',
): Promise<MockProviderResponse> {
  warnOnce();
  void provider;
  return { data: { session: null }, error: null, notice: MOCK_PROVIDER_NOTICE };
}

/** Mirrors Supabase's `resetPasswordForEmail` — nothing is sent anywhere. */
export async function resetPasswordForEmail(email: string): Promise<MockAuthResponse> {
  warnOnce();
  const emailProblem = validateEmail(email);
  if (emailProblem) return fail(emailProblem);
  return { data: { session: null }, error: null };
}

export async function signOut(): Promise<{ error: null }> {
  clearStoredSession();
  emit('SIGNED_OUT', null);
  return { error: null };
}

/** Shape-compatible with `supabase.auth.getSession()`. */
export async function getSession(): Promise<{ data: { session: MockSession | null } }> {
  return { data: { session: readStoredSession() } };
}

/** Shape-compatible with `supabase.auth.onAuthStateChange()`. */
export function onAuthStateChange(callback: Listener): {
  data: { subscription: { unsubscribe: () => void } };
} {
  listeners.add(callback);
  return {
    data: {
      subscription: {
        unsubscribe: () => {
          listeners.delete(callback);
        },
      },
    },
  };
}
