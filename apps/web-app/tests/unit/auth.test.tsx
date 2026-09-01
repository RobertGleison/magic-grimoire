import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '../../app/login/LoginForm';
import { SignupForm } from '../../app/signup/SignupForm';
import {
  AUTH_DEFAULT_DESTINATION,
  authHref,
  describeAuthError,
  isSupabaseConfigured,
  oauthRedirectTo,
  resolveNextPath,
} from '../../app/login/authShared';

/* --------------------------------------------------------------------------
   Mocks. `vi.hoisted` so the factories below can reach them — `vi.mock` calls
   are hoisted above the imports.
   -------------------------------------------------------------------------- */

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  search: new URLSearchParams(),
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: mocks.push,
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

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = new URLSearchParams();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  mocks.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
  mocks.auth.signUp.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
  mocks.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mocks.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  cleanup();
  process.env = { ...ORIGINAL_ENV };
});

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/* ========================================================================== */

describe('authShared — ?next= contract', () => {
  it('falls back to the library when no destination is given', () => {
    expect(resolveNextPath(null)).toBe(AUTH_DEFAULT_DESTINATION);
    expect(resolveNextPath('')).toBe(AUTH_DEFAULT_DESTINATION);
    expect(resolveNextPath('   ')).toBe(AUTH_DEFAULT_DESTINATION);
  });

  it('keeps same-origin paths, query string included', () => {
    expect(resolveNextPath('/pricing')).toBe('/pricing');
    expect(resolveNextPath('/deck-builder?deck=42')).toBe('/deck-builder?deck=42');
  });

  it('refuses every shape of off-origin redirect', () => {
    for (const hostile of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      'javascript:alert(1)',
      '/redirect?to=https://ok.test://evil',
      'evil.test',
    ]) {
      expect(resolveNextPath(hostile)).toBe(AUTH_DEFAULT_DESTINATION);
    }
  });

  it('round-trips the destination through the login <-> signup cross-link', () => {
    expect(authHref('/signup', '/pricing')).toBe('/signup?next=%2Fpricing');
    expect(authHref('/login', null)).toBe('/login');
    // The default destination is implicit, so it never bloats the URL.
    expect(authHref('/login', AUTH_DEFAULT_DESTINATION)).toBe('/login');
  });

  it('builds an absolute OAuth return URL on this origin only', () => {
    expect(oauthRedirectTo('/pricing')).toBe(`${window.location.origin}/pricing`);
    expect(oauthRedirectTo('https://evil.test')).toBe(
      `${window.location.origin}${AUTH_DEFAULT_DESTINATION}`,
    );
  });
});

describe('authShared — error and config surfacing', () => {
  it('passes a Supabase message through verbatim', () => {
    expect(describeAuthError({ message: 'Invalid login credentials' })).toBe(
      'Invalid login credentials',
    );
    expect(describeAuthError(new Error('Email not confirmed'))).toBe('Email not confirmed');
  });

  it('never leaks a stack trace for an unrecognised failure', () => {
    const message = describeAuthError(undefined);
    expect(message).toMatch(/authentication service/i);
    expect(message).not.toMatch(/at .*\(/);
  });

  it('reports the Supabase env vars as missing when either one is absent', () => {
    expect(isSupabaseConfigured()).toBe(true);
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(isSupabaseConfigured()).toBe(false);
  });
});

/* ========================================================================== */

describe('LoginForm — semantics', () => {
  it('renders a real form whose submit button posts it, so Enter submits', () => {
    render(<LoginForm />);
    const submit = screen.getByRole('button', { name: /^sign in$/i }) as HTMLButtonElement;
    expect(submit).toHaveAttribute('type', 'submit');
    expect(submit.form).toBeInstanceOf(HTMLFormElement);
    expect(submit.form).toBe(document.querySelector('form'));
  });

  it('binds every label to its control and asks the browser for the right autofill', () => {
    render(<LoginForm />);
    const email = screen.getByLabelText('Aether Mail (Email)');
    const password = screen.getByLabelText('Spell-Password');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
  });

  it('links across to sign-up, carrying ?next= with it', () => {
    mocks.search = new URLSearchParams('next=/pricing');
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup?next=%2Fpricing',
    );
  });
});

describe('LoginForm — validation', () => {
  it('blocks submission and describes both fields when they are empty', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('wires the message to the control with aria-invalid and aria-describedby', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    const email = await screen.findByLabelText('Aether Mail (Email)');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    const describedBy = email.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Enter your email address.');
  });

  it('rejects an address that is not an address', async () => {
    render(<LoginForm />);
    type('Aether Mail (Email)', 'liliana');
    type('Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/does not look like an email address/i)).toBeInTheDocument();
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('LoginForm — sign-in', () => {
  it('signs in with the trimmed email and lands on the library', async () => {
    render(<LoginForm />);
    type('Aether Mail (Email)', '  liliana@mana.vault  ');
    type('Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/library'));
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'liliana@mana.vault',
      password: 'ravnica-2024',
    });
  });

  it('honours ?next= instead of the default destination', async () => {
    mocks.search = new URLSearchParams('next=/deck-builder');
    render(<LoginForm />);
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/deck-builder'));
  });

  it('will not follow an off-origin ?next=', async () => {
    mocks.search = new URLSearchParams('next=https://evil.test/steal');
    render(<LoginForm />);
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/library'));
  });

  it('drops the password from state once Supabase has it', async () => {
    render(<LoginForm />);
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
    expect(screen.getByLabelText('Spell-Password')).toHaveValue('');
  });

  it('shows the real Supabase message and stays put on failure', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    render(<LoginForm />);
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'wrong-password');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('reports a thrown transport failure instead of hanging', async () => {
    mocks.auth.signInWithPassword.mockRejectedValue(new Error('Failed to fetch'));
    render(<LoginForm />);
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
  });

  it('blocks the submit button while the request is in flight', async () => {
    let release: (value: { data: unknown; error: null }) => void = () => {};
    mocks.auth.signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<LoginForm />);
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: /^sign in$/i })).toHaveAttribute('aria-busy', 'true');

    release({ data: { session: {} }, error: null });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  });
});

describe('LoginForm — OAuth', () => {
  it('offers exactly the two providers Supabase is configured with', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /discord/i })).toBeNull();
  });

  it('sends the browser to the provider with a same-origin return URL', async () => {
    mocks.search = new URLSearchParams('next=/pricing');
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() =>
      expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/pricing` },
      }),
    );
  });

  it('passes the github provider through unchanged', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));

    await waitFor(() =>
      expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/library` },
      }),
    );
  });

  it('surfaces a provider error rather than leaving a dead button', async () => {
    mocks.auth.signInWithOAuth.mockResolvedValue({
      data: {},
      error: { message: 'Unsupported provider: provider is not enabled' },
    });
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsupported provider: provider is not enabled',
    );
  });
});

describe('LoginForm — password reset', () => {
  it('needs an email address before it will send anything', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /forgot spell-password/i }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(mocks.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('answers without confirming whether the account exists', async () => {
    render(<LoginForm />);
    type('Aether Mail (Email)', 'liliana@mana.vault');
    fireEvent.click(screen.getByRole('button', { name: /forgot spell-password/i }));

    await waitFor(() =>
      expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith('liliana@mana.vault', {
        redirectTo: `${window.location.origin}/login`,
      }),
    );
    // Queried by text, not by role: a loading Button also renders role="status".
    expect(await screen.findByText(/reset link is on its way/i)).toBeInTheDocument();
  });
});

describe('LoginForm — missing configuration', () => {
  it('explains itself instead of rendering a broken form', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    render(<LoginForm />);

    expect(screen.getByRole('alert')).toHaveTextContent(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(screen.queryByLabelText('Spell-Password')).toBeNull();
    // The way out is still reachable.
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument();
  });
});

/* ========================================================================== */

describe('SignupForm', () => {
  it('renders the design’s four fields, each with a new-password hint where it belongs', () => {
    render(<SignupForm />);
    expect(screen.getByLabelText('Planeswalker Handle')).toHaveAttribute('autocomplete', 'nickname');
    expect(screen.getByLabelText('Aether Mail (Email)')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Spell-Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Confirm Spell-Password')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
  });

  it('submits through a real form button', () => {
    render(<SignupForm />);
    const submit = screen.getByRole('button', { name: /^create account$/i }) as HTMLButtonElement;
    expect(submit).toHaveAttribute('type', 'submit');
    expect(submit.form).toBe(document.querySelector('form'));
  });

  it('rejects a short password before it reaches the network', async () => {
    render(<SignupForm />);
    type('Planeswalker Handle', 'Liliana_Vess_99');
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'short');
    type('Confirm Spell-Password', 'short');
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(mocks.auth.signUp).not.toHaveBeenCalled();
  });

  it('rejects a mismatched confirmation', async () => {
    render(<SignupForm />);
    type('Planeswalker Handle', 'Liliana_Vess_99');
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    type('Confirm Spell-Password', 'ravnica-2025');
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByText('The two spells do not match.')).toBeInTheDocument();
    expect(mocks.auth.signUp).not.toHaveBeenCalled();
  });

  it('rejects a handle that is too short', async () => {
    render(<SignupForm />);
    type('Planeswalker Handle', 'ab');
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    type('Confirm Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByText('Use at least 3 characters.')).toBeInTheDocument();
    expect(mocks.auth.signUp).not.toHaveBeenCalled();
  });

  it('creates the account, carrying the handle and the confirmation return URL', async () => {
    mocks.search = new URLSearchParams('next=/deck-builder');
    render(<SignupForm />);
    type('Planeswalker Handle', '  Liliana_Vess_99  ');
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    type('Confirm Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() =>
      expect(mocks.auth.signUp).toHaveBeenCalledWith({
        email: 'liliana@mana.vault',
        password: 'ravnica-2024',
        options: {
          data: { name: 'Liliana_Vess_99' },
          emailRedirectTo: `${window.location.origin}/deck-builder`,
        },
      }),
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/deck-builder'));
  });

  it('asks the user to confirm by email when no session comes back', async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    render(<SignupForm />);
    type('Planeswalker Handle', 'Liliana_Vess_99');
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    type('Confirm Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    // Queried by text, not by role: a loading Button also renders role="status".
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Spell-Password')).toHaveValue('');
    expect(screen.getByLabelText('Confirm Spell-Password')).toHaveValue('');
  });

  it('shows the real Supabase message on failure', async () => {
    mocks.auth.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    });
    render(<SignupForm />);
    type('Planeswalker Handle', 'Liliana_Vess_99');
    type('Aether Mail (Email)', 'liliana@mana.vault');
    type('Spell-Password', 'ravnica-2024');
    type('Confirm Spell-Password', 'ravnica-2024');
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('User already registered');
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('links back to sign-in, carrying ?next= with it', () => {
    mocks.search = new URLSearchParams('next=/pricing');
    render(<SignupForm />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?next=%2Fpricing',
    );
  });

  it('offers the same two OAuth providers as sign-in', async () => {
    render(<SignupForm />);
    fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));

    await waitFor(() =>
      expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/library` },
      }),
    );
  });

  it('explains a missing Supabase configuration instead of rendering a broken form', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    render(<SignupForm />);

    expect(screen.getByRole('alert')).toHaveTextContent(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(screen.queryByLabelText('Planeswalker Handle')).toBeNull();
  });
});
