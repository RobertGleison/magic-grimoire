import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ==========================================================================
   UserContext — the Supabase-backed auth store.

   `../../app/lib/supabase` is replaced with a test double so no network is
   touched. Each test loads a FRESH module graph because the session store is
   module-level state.
   ========================================================================== */

type AuthCallback = (event: string, session: unknown) => void;

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: new URLSearchParams(),
  getSupabaseThrows: false,
  authCallback: null as AuthCallback | null,
  unsubscribe: vi.fn(),
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mocks.search,
}));

vi.mock('../../app/lib/supabase', () => ({
  getSupabase: () => {
    if (mocks.getSupabaseThrows) throw new Error('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL.');
    return { auth: mocks.auth };
  },
  getAccessToken: vi.fn(),
}));

async function loadContext() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  return import('../../app/context/UserContext');
}

function supabaseSession(metadata: Record<string, unknown> = {}) {
  return {
    access_token: 'jwt',
    user: { id: 'user-1', email: 'liliana@mana.vault', user_metadata: metadata },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = new URLSearchParams();
  mocks.getSupabaseThrows = false;
  mocks.authCallback = null;
  mocks.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
  mocks.auth.signUp.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
  mocks.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mocks.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
  mocks.auth.getSession.mockResolvedValue({ data: { session: null } });
  mocks.auth.onAuthStateChange.mockImplementation((callback: AuthCallback) => {
    mocks.authCallback = callback;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* ========================================================================== */

describe('UserContext — session state', () => {
  it('starts as checking, then settles on signed-out when Supabase has no session', async () => {
    const context = await loadContext();
    const value = await renderUser(context);

    await waitFor(() => expect(value.current.status).toBe('signed-out'));
    expect(value.current.user).toBeNull();
    expect(mocks.auth.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('maps an existing Supabase session onto the user, preferring full_name and avatar_url', async () => {
    mocks.auth.getSession.mockResolvedValue({
      data: {
        session: supabaseSession({ full_name: 'Liliana Vess', avatar_url: 'https://img.test/a.png' }),
      },
    });
    const context = await loadContext();
    const value = await renderUser(context);

    await waitFor(() => expect(value.current.status).toBe('signed-in'));
    expect(value.current.user).toEqual({
      id: 'user-1',
      email: 'liliana@mana.vault',
      name: 'Liliana Vess',
      avatarUrl: 'https://img.test/a.png',
    });
  });

  it('falls back to the email local-part when no name is in the metadata', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: supabaseSession() } });
    const context = await loadContext();
    const value = await renderUser(context);

    await waitFor(() => expect(value.current.status).toBe('signed-in'));
    expect(value.current.user?.name).toBe('liliana');
  });

  it('follows onAuthStateChange in and out of a session (e.g. after an OAuth redirect)', async () => {
    const context = await loadContext();
    const value = await renderUser(context);
    await waitFor(() => expect(value.current.status).toBe('signed-out'));

    act(() => mocks.authCallback?.('SIGNED_IN', supabaseSession({ name: 'Liliana' })));
    await waitFor(() => expect(value.current.status).toBe('signed-in'));
    expect(value.current.user?.name).toBe('Liliana');

    act(() => mocks.authCallback?.('SIGNED_OUT', null));
    await waitFor(() => expect(value.current.status).toBe('signed-out'));
    expect(value.current.user).toBeNull();
  });

  it('unsubscribes from Supabase once nothing is mounted', async () => {
    const context = await loadContext();
    await renderUser(context);
    cleanup();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('reports signed-out rather than hanging when the Supabase client cannot be built', async () => {
    mocks.getSupabaseThrows = true;
    const context = await loadContext();
    const value = await renderUser(context);

    await waitFor(() => expect(value.current.status).toBe('signed-out'));
  });

  it('works outside a provider, from the same shared store', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: supabaseSession() } });
    const context = await loadContext();

    function Bare() {
      const { status } = context.useUser();
      return <p>{status}</p>;
    }
    render(<Bare />);
    expect(await screen.findByText('signed-in')).toBeInTheDocument();
  });
});

/* ========================================================================== */

describe('UserContext — actions', () => {
  it('signs in with a trimmed email and the password as given', async () => {
    const context = await loadContext();
    const value = await renderUser(context);

    const result = await value.current.signInWithPassword({
      email: '  liliana@mana.vault  ',
      password: 'ravnica-2024',
    });

    expect(result.error).toBeNull();
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'liliana@mana.vault',
      password: 'ravnica-2024',
    });
  });

  it('routes sign-up, provider, reset and sign-out to Supabase', async () => {
    const context = await loadContext();
    const value = await renderUser(context);

    await value.current.signUp({
      email: 'liliana@mana.vault',
      password: 'ravnica-2024',
      name: '  Liliana  ',
      redirectTo: 'https://app.test/library',
    });
    expect(mocks.auth.signUp).toHaveBeenCalledWith({
      email: 'liliana@mana.vault',
      password: 'ravnica-2024',
      options: { data: { name: 'Liliana' }, emailRedirectTo: 'https://app.test/library' },
    });

    await value.current.signInWithProvider('github', { redirectTo: 'https://app.test/library' });
    expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: 'https://app.test/library' },
    });

    await value.current.resetPassword(' liliana@mana.vault ', {
      redirectTo: 'https://app.test/login',
    });
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith('liliana@mana.vault', {
      redirectTo: 'https://app.test/login',
    });

    await value.current.signOut();
    expect(mocks.auth.signOut).toHaveBeenCalled();
  });

  it('flags a sign-up that still needs email confirmation', async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    const context = await loadContext();
    const value = await renderUser(context);

    const result = await value.current.signUp({
      email: 'liliana@mana.vault',
      password: 'ravnica-2024',
      name: 'Liliana',
    });
    expect(result).toEqual({ error: null, pendingConfirmation: true });
  });

  it('surfaces a Supabase failure as a readable string, never an object', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    const context = await loadContext();
    const value = await renderUser(context);

    const result = await value.current.signInWithPassword({
      email: 'liliana@mana.vault',
      password: 'wrong',
    });
    expect(result.error).toBe('Invalid login credentials');
  });

  it('turns a thrown network error into a readable string', async () => {
    mocks.auth.signInWithOAuth.mockRejectedValue(new Error('Failed to fetch'));
    const context = await loadContext();
    const value = await renderUser(context);

    const result = await value.current.signInWithProvider('google');
    expect(result.error).toBe('Failed to fetch');
  });
});

/* --------------------------------------------------------------- helpers */

type AuthModule = typeof import('../../app/context/UserContext');

/** Mounts `UserProvider` and hands back a live handle on the context value. */
async function renderUser(context: AuthModule) {
  const handle: { current: ReturnType<AuthModule['useUser']> } = {
    current: null as unknown as ReturnType<AuthModule['useUser']>,
  };

  function Probe() {
    handle.current = context.useUser();
    return null;
  }

  render(
    <context.UserProvider>
      <Probe />
    </context.UserProvider>,
  );
  await waitFor(() => expect(handle.current).not.toBeNull());
  return handle;
}
