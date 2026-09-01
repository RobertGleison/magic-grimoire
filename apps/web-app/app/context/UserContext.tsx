'use client';

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { getSupabase } from '../lib/supabase';
import * as mockAuth from '../lib/mockAuth';
import { MOCK_AUTH_ENABLED } from '../lib/mockAuth';
import { describeAuthError, type AuthProvider } from '../login/authShared';

/* ==========================================================================
   Auth state for the whole app.

   TWO IMPLEMENTATIONS, ONE SWITCH. Every action below branches once on
   `MOCK_AUTH_ENABLED` (`NEXT_PUBLIC_MOCK_AUTH === 'true'`):

     mocked  ->  `app/lib/mockAuth.ts`, the development stub
     real    ->  `@supabase/supabase-js` via `app/lib/supabase.ts`

   The Supabase branch is fully implemented and is what runs by default.
   Turning the mock off is an env-var change, not a code change.

   `resolveNextPath()` in `app/login/authShared.ts` stays the only route to a
   post-auth redirect: this file never reads the query string and never calls
   `router.replace`. Callers pass an already-resolved destination in.
   ========================================================================== */

export interface AuthUser {
  id: string;
  email: string;
  /** Never empty — falls back to the email local-part, then 'Planeswalker'. */
  name: string;
  avatarUrl?: string;
}

export type UserStatus = 'checking' | 'signed-in' | 'signed-out';

/**
 * What every action resolves to. `error` is already human-readable (run
 * through `describeAuthError`), so callers render it directly.
 */
export interface AuthActionResult {
  error: string | null;
  /** Non-fatal message to surface, e.g. the mock's disabled-provider notice. */
  notice?: string;
  /** Signed up successfully but Supabase wants the address confirmed first. */
  pendingConfirmation?: boolean;
}

export interface UserContextType {
  user: AuthUser | null;
  status: UserStatus;
  /** True when the stub is in charge. UI uses it to say so out loud. */
  isMocked: boolean;
  signInWithPassword: (credentials: {
    email: string;
    password: string;
  }) => Promise<AuthActionResult>;
  signUp: (credentials: {
    email: string;
    password: string;
    name: string;
    /** Absolute URL, already through `resolveNextPath` via `oauthRedirectTo`. */
    redirectTo?: string;
  }) => Promise<AuthActionResult>;
  signInWithProvider: (
    provider: AuthProvider,
    options?: { redirectTo?: string },
  ) => Promise<AuthActionResult>;
  resetPassword: (email: string, options?: { redirectTo?: string }) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

/* ------------------------------------------------------------------ store */

/*
 * Session state lives in a module-level store rather than in provider state.
 *
 * Why: exactly one Supabase (or mock) listener exists per page load no matter
 * how many components ask, and `useUser()` keeps working in a unit test that
 * renders a page without mounting `<UserProvider>`. The provider is still the
 * documented mounting point — it gives every consumer one shared, referentially
 * stable value.
 */

interface Snapshot {
  status: UserStatus;
  user: AuthUser | null;
}

const CHECKING: Snapshot = { status: 'checking', user: null };
const SIGNED_OUT: Snapshot = { status: 'signed-out', user: null };

let snapshot: Snapshot = CHECKING;
const listeners = new Set<() => void>();
let stopEngine: (() => void) | null = null;

function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return (
    a.status === b.status &&
    a.user?.id === b.user?.id &&
    a.user?.name === b.user?.name &&
    a.user?.email === b.user?.email &&
    a.user?.avatarUrl === b.user?.avatarUrl
  );
}

function setSnapshot(next: Snapshot): void {
  if (sameSnapshot(snapshot, next)) return;
  snapshot = next;
  for (const listener of [...listeners]) listener();
}

function fromMockSession(session: mockAuth.MockSession | null): Snapshot {
  if (!session) return SIGNED_OUT;
  return {
    status: 'signed-in',
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
  };
}

function fromSupabaseSession(session: Session | null): Snapshot {
  if (!session) return SIGNED_OUT;
  const { id, email, user_metadata: metadata } = session.user ?? {};
  const address = email ?? '';
  const name =
    (typeof metadata?.full_name === 'string' && metadata.full_name) ||
    (typeof metadata?.name === 'string' && metadata.name) ||
    address.split('@')[0] ||
    'Planeswalker';
  const avatarUrl =
    typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : undefined;
  return { status: 'signed-in', user: { id: id ?? address, email: address, name, avatarUrl } };
}

/** Starts whichever backend is switched on. Returns its teardown. */
function startEngine(): () => void {
  let active = true;

  if (MOCK_AUTH_ENABLED) {
    void mockAuth.getSession().then(({ data }) => {
      if (active) setSnapshot(fromMockSession(data.session));
    });
    const { data } = mockAuth.onAuthStateChange((_event, session) => {
      if (active) setSnapshot(fromMockSession(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }

  try {
    const supabase = getSupabase();

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSnapshot(fromSupabaseSession(data.session));
      })
      .catch(() => {
        if (active) setSnapshot(SIGNED_OUT);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSnapshot(fromSupabaseSession(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  } catch {
    // Supabase env vars are missing, so no session can exist. Signed out is
    // the truthful answer, and every guarded endpoint would 401 anyway.
    setSnapshot(SIGNED_OUT);
    return () => {
      active = false;
    };
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!stopEngine) stopEngine = startEngine();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopEngine?.();
    stopEngine = null;
    // Nothing is watching, so the next mount re-reads from scratch.
    snapshot = CHECKING;
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

/** Server render: nothing is known yet, and `checking` is what the client starts on. */
function getServerSnapshot(): Snapshot {
  return CHECKING;
}

/* ---------------------------------------------------------------- actions */

async function signInWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const address = email.trim();

  if (MOCK_AUTH_ENABLED) {
    const { error } = await mockAuth.signInWithPassword({ email: address, password });
    return { error: error ? error.message : null };
  }

  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email: address, password });
    return { error: error ? describeAuthError(error) : null };
  } catch (error) {
    return { error: describeAuthError(error) };
  }
}

async function signUp({
  email,
  password,
  name,
  redirectTo,
}: {
  email: string;
  password: string;
  name: string;
  redirectTo?: string;
}): Promise<AuthActionResult> {
  const address = email.trim();
  const displayName = name.trim();

  if (MOCK_AUTH_ENABLED) {
    const { error } = await mockAuth.signUp({ email: address, password, name: displayName });
    return { error: error ? error.message : null };
  }

  try {
    const { data, error } = await getSupabase().auth.signUp({
      email: address,
      password,
      options: { data: { name: displayName }, emailRedirectTo: redirectTo },
    });
    if (error) return { error: describeAuthError(error) };
    // No session back means the project has email confirmation switched on.
    return { error: null, pendingConfirmation: !data.session };
  } catch (error) {
    return { error: describeAuthError(error) };
  }
}

async function signInWithProvider(
  provider: AuthProvider,
  options: { redirectTo?: string } = {},
): Promise<AuthActionResult> {
  if (MOCK_AUTH_ENABLED) {
    const { notice } = await mockAuth.signInWithProvider(provider);
    return { error: null, notice };
  }

  try {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: options.redirectTo },
    });
    // On success the browser leaves for the provider; only errors land here.
    return { error: error ? describeAuthError(error) : null };
  } catch (error) {
    return { error: describeAuthError(error) };
  }
}

async function resetPassword(
  email: string,
  options: { redirectTo?: string } = {},
): Promise<AuthActionResult> {
  const address = email.trim();

  if (MOCK_AUTH_ENABLED) {
    const { error } = await mockAuth.resetPasswordForEmail(address);
    return { error: error ? error.message : null };
  }

  try {
    const { error } = await getSupabase().auth.resetPasswordForEmail(address, {
      redirectTo: options.redirectTo,
    });
    return { error: error ? describeAuthError(error) : null };
  } catch (error) {
    return { error: describeAuthError(error) };
  }
}

async function signOut(): Promise<void> {
  if (MOCK_AUTH_ENABLED) {
    await mockAuth.signOut();
    return;
  }

  try {
    await getSupabase().auth.signOut();
  } catch {
    // Nothing to revoke if the client cannot even be built. Drop the session
    // locally so the UI does not claim someone is signed in.
    setSnapshot(SIGNED_OUT);
  }
}

/** Stable across renders — they close over nothing component-scoped. */
const ACTIONS = {
  signInWithPassword,
  signUp,
  signInWithProvider,
  resetPassword,
  signOut,
} as const;

/* ------------------------------------------------------- context + hooks */

const UserContext = createContext<UserContextType | null>(null);

function useAuthValue(): UserContextType {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(
    () => ({
      user: current.user,
      status: current.status,
      isMocked: MOCK_AUTH_ENABLED,
      ...ACTIONS,
    }),
    [current],
  );
}

export function UserProvider({ children }: { children: ReactNode }) {
  const value = useAuthValue();
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Both hooks are called unconditionally, so the rules of hooks hold. Inside a
 * provider the shared value wins; outside one the component still gets live
 * auth state from the same module-level store instead of a dead default.
 */
export function useUser(): UserContextType {
  const provided = useContext(UserContext);
  const detached = useAuthValue();
  return provided ?? detached;
}
