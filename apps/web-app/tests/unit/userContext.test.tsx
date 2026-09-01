import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_DEFAULT_DESTINATION, resolveNextPath } from '../../app/login/authShared';

/* ==========================================================================
   Wave 4a — the mocked-auth stub and the context that switches on it.

   `MOCK_AUTH_ENABLED` is read at module scope (Next inlines NEXT_PUBLIC_* at
   build time), so each test loads a FRESH module graph with the env var
   stubbed. `loadAuth(true)` gives the stub, `loadAuth(false)` gives the real
   Supabase path — both branches are exercised here.
   ========================================================================== */

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: new URLSearchParams(),
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
  getSupabase: () => ({ auth: mocks.auth }),
  getAccessToken: vi.fn(),
}));

/** Loads the auth modules with the stub switched on or off. */
async function loadAuth(mocked: boolean) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_MOCK_AUTH', mocked ? 'true' : 'false');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

  const mockAuth = await import('../../app/lib/mockAuth');
  const context = await import('../../app/context/UserContext');
  const { LoginForm } = await import('../../app/login/LoginForm');
  return { mockAuth, context, LoginForm };
}

/** Every value currently in localStorage, keys included. */
function storageDump(): string {
  const parts: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key === null) continue;
    parts.push(key, window.localStorage.getItem(key) ?? '');
  }
  return parts.join('\n');
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mocks.search = new URLSearchParams();
  mocks.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
  mocks.auth.signUp.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
  mocks.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mocks.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
  mocks.auth.getSession.mockResolvedValue({ data: { session: null } });
  mocks.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  // Silences the intentional activation warning from app/lib/mockAuth.ts.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* ========================================================================== */

describe('mockAuth — the stub itself', () => {
  it('accepts any non-empty password for any address that looks like an email', async () => {
    const { mockAuth } = await loadAuth(true);

    for (const password of ['x', 'hunter2', ' ']) {
      const { data, error } = await mockAuth.signInWithPassword({
        email: 'nobody@example.test',
        password,
      });
      expect(error).toBeNull();
      expect(data.session?.user.email).toBe('nobody@example.test');
    }
  });

  it('still rejects an address that is not an address, so form validation stays real', async () => {
    const { mockAuth } = await loadAuth(true);

    const { data, error } = await mockAuth.signInWithPassword({
      email: 'liliana',
      password: 'anything',
    });
    expect(error?.message).toMatch(/does not look like an email address/i);
    expect(data.session).toBeNull();
    expect(storageDump()).toBe('');
  });

  it('rejects an empty password rather than signing in a blank form', async () => {
    const { mockAuth } = await loadAuth(true);

    const { error } = await mockAuth.signInWithPassword({
      email: 'nobody@example.test',
      password: '',
    });
    expect(error?.message).toBe('Enter your password.');
  });

  it('NEVER persists the password — not on sign-in, not on sign-up', async () => {
    const { mockAuth } = await loadAuth(true);
    const secret = 'correct-horse-battery-staple';

    await mockAuth.signInWithPassword({ email: 'nobody@example.test', password: secret });
    expect(storageDump()).not.toContain(secret);

    await mockAuth.signUp({ email: 'other@example.test', password: secret, name: 'Liliana' });
    const dump = storageDump();
    expect(dump).not.toContain(secret);
    // The session really was written — the absence above is not a false pass.
    expect(dump).toContain(mockAuth.MOCK_SESSION_STORAGE_KEY);
    expect(dump).toContain('other@example.test');
  });

  it('derives a display name from the email local-part when none is given', async () => {
    const { mockAuth } = await loadAuth(true);

    await mockAuth.signInWithPassword({ email: 'liliana.vess@mana.vault', password: 'x' });
    const { data } = await mockAuth.getSession();
    expect(data.session?.user.name).toBe('liliana vess');
    expect(mockAuth.displayNameFromEmail('@nothing')).toBe('Planeswalker');
  });

  it('remembers the display name given at sign-up', async () => {
    const { mockAuth } = await loadAuth(true);

    await mockAuth.signUp({ email: 'liliana@mana.vault', password: 'x', name: '  Liliana_Vess_99  ' });
    const { data } = await mockAuth.getSession();
    expect(data.session?.user.name).toBe('Liliana_Vess_99');
  });

  it('persists the session under an obviously fake key and restores it', async () => {
    const { mockAuth } = await loadAuth(true);

    await mockAuth.signInWithPassword({ email: 'nobody@example.test', password: 'x' });
    expect(mockAuth.MOCK_SESSION_STORAGE_KEY).toBe('mg.mockAuth.session');
    expect(window.localStorage.getItem('mg.mockAuth.session')).toBeTruthy();

    const { data } = await mockAuth.getSession();
    expect(data.session?.user.email).toBe('nobody@example.test');
  });

  it('signs out by clearing the stored session and telling its listeners', async () => {
    const { mockAuth } = await loadAuth(true);
    const seen: (unknown | null)[] = [];
    const { data: subscription } = mockAuth.onAuthStateChange((_event, session) =>
      seen.push(session),
    );

    await mockAuth.signInWithPassword({ email: 'nobody@example.test', password: 'x' });
    await mockAuth.signOut();

    expect(window.localStorage.getItem(mockAuth.MOCK_SESSION_STORAGE_KEY)).toBeNull();
    expect((await mockAuth.getSession()).data.session).toBeNull();
    expect(seen).toEqual([expect.objectContaining({ accessToken: 'mock-access-token' }), null]);
    subscription.subscription.unsubscribe();
  });

  it('survives a localStorage that throws, the way a private window does', async () => {
    const { mockAuth } = await loadAuth(true);
    const boom = () => {
      throw new DOMException('QuotaExceededError');
    };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);

    const { error } = await mockAuth.signInWithPassword({
      email: 'nobody@example.test',
      password: 'x',
    });
    expect(error).toBeNull();
    await expect(mockAuth.getSession()).resolves.toEqual({ data: { session: null } });
  });

  it('makes provider sign-in a no-op that resolves with something to say', async () => {
    const { mockAuth } = await loadAuth(true);

    for (const provider of ['google', 'github'] as const) {
      const result = await mockAuth.signInWithProvider(provider);
      expect(result.error).toBeNull();
      expect(result.data.session).toBeNull();
      expect(result.notice).toBe(mockAuth.MOCK_PROVIDER_NOTICE);
    }
    // No session was created and nothing was persisted.
    expect(storageDump()).toBe('');
  });

  it('warns on activation, naming the variable that switches it off', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadAuth(true);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain('NEXT_PUBLIC_MOCK_AUTH');
  });

  it('is off for any value other than the exact string "true"', async () => {
    for (const value of ['false', 'TRUE', '1', 'yes', '']) {
      vi.resetModules();
      vi.stubEnv('NEXT_PUBLIC_MOCK_AUTH', value);
      const mockAuth = await import('../../app/lib/mockAuth');
      expect(mockAuth.MOCK_AUTH_ENABLED).toBe(false);
    }
  });
});

/* ========================================================================== */

describe('UserContext — the switch', () => {
  it('reports itself as mocked and uses the stub when the flag is on', async () => {
    const { mockAuth, context } = await loadAuth(true);
    expect(mockAuth.MOCK_AUTH_ENABLED).toBe(true);

    const result = await callSignIn(context, 'nobody@example.test', 'x');
    expect(result.error).toBeNull();
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(mockAuth.MOCK_SESSION_STORAGE_KEY)).toBeTruthy();
  });

  it('takes the Supabase path when MOCK_AUTH_ENABLED is false', async () => {
    const { mockAuth, context } = await loadAuth(false);
    expect(mockAuth.MOCK_AUTH_ENABLED).toBe(false);

    const result = await callSignIn(context, '  liliana@mana.vault  ', 'ravnica-2024');

    expect(result.error).toBeNull();
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'liliana@mana.vault',
      password: 'ravnica-2024',
    });
    // Nothing mock-shaped was written; the stub was never involved.
    expect(storageDump()).not.toContain('mock');
  });

  it('routes sign-up, provider and sign-out to Supabase when the flag is off', async () => {
    const { context } = await loadAuth(false);
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

    await value.current.signOut();
    expect(mocks.auth.signOut).toHaveBeenCalled();
  });

  it('exposes the signed-in user and clears it again on sign-out, mocked', async () => {
    const { context } = await loadAuth(true);
    const value = await renderUser(context);

    await waitFor(() => expect(value.current.status).toBe('signed-out'));

    await value.current.signInWithPassword({ email: 'liliana@mana.vault', password: 'x' });
    await waitFor(() => expect(value.current.status).toBe('signed-in'));
    expect(value.current.user).toEqual(
      expect.objectContaining({ email: 'liliana@mana.vault', name: 'liliana' }),
    );
    expect(value.current.isMocked).toBe(true);

    await value.current.signOut();
    await waitFor(() => expect(value.current.status).toBe('signed-out'));
    expect(value.current.user).toBeNull();
  });

  it('surfaces a Supabase failure as a readable string, never an object', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    const { context } = await loadAuth(false);

    const result = await callSignIn(context, 'liliana@mana.vault', 'wrong');
    expect(result.error).toBe('Invalid login credentials');
  });
});

/* ========================================================================== */

describe('LoginForm under the stub', () => {
  it('signs in with credentials that could not possibly be real', async () => {
    const { LoginForm } = await loadAuth(true);
    render(<LoginForm />);

    type('Aether Mail (Email)', 'literally-anyone@example.test');
    type('Spell-Password', 'a');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(AUTH_DEFAULT_DESTINATION));
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Spell-Password')).toHaveValue('');
  });

  it('refuses an off-origin ?next=, so resolveNextPath stays the only way to a redirect', async () => {
    mocks.search = new URLSearchParams('next=https://evil.test/steal');
    const { LoginForm } = await loadAuth(true);
    render(<LoginForm />);

    type('Aether Mail (Email)', 'anyone@example.test');
    type('Spell-Password', 'a');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/library'));
    expect(mocks.replace).not.toHaveBeenCalledWith(expect.stringContaining('evil.test'));
    // The guard itself, on the shapes a query string can carry.
    expect(resolveNextPath('https://evil.test/steal')).toBe(AUTH_DEFAULT_DESTINATION);
    expect(resolveNextPath('//evil.test')).toBe(AUTH_DEFAULT_DESTINATION);
    expect(resolveNextPath('/\\evil.test')).toBe(AUTH_DEFAULT_DESTINATION);
  });

  it('says provider sign-in is disabled instead of faking it or hanging', async () => {
    const { mockAuth, LoginForm } = await loadAuth(true);
    render(<LoginForm />);

    const google = screen.getByRole('button', { name: /continue with google/i });
    expect(() => fireEvent.click(google)).not.toThrow();

    expect(await screen.findByText(mockAuth.MOCK_PROVIDER_NOTICE)).toBeInTheDocument();
    // Not navigated, not signed in, and the button is usable again.
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(mockAuth.MOCK_SESSION_STORAGE_KEY)).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled(),
    );
  });

  it('renders the form even with no Supabase project configured', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_MOCK_AUTH', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const { LoginForm } = await import('../../app/login/LoginForm');

    render(<LoginForm />);
    expect(screen.getByLabelText('Spell-Password')).toBeInTheDocument();
    expect(screen.queryByText(/NEXT_PUBLIC_SUPABASE_URL must both be set/)).toBeNull();
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

async function callSignIn(context: AuthModule, email: string, password: string) {
  const handle = await renderUser(context);
  return handle.current.signInWithPassword({ email, password });
}
