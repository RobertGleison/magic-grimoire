import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AuthModal from '../../app/components/AuthModal/AuthModal';
import AuthGate from '../../app/components/AuthGate/AuthGate';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderLogin(overrides = {}) {
  const props = {
    mode: 'login' as const,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onSwitchMode: vi.fn(),
    ...overrides,
  };
  render(<AuthModal {...props} />);
  return props;
}

function fillEmail(value: string) {
  fireEvent.change(screen.getByPlaceholderText('seeker@plane.mtg'), { target: { value } });
}

function fillPassword(value: string) {
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value } });
}

function fillName(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Planeswalker of choice'), { target: { value } });
}

function submitForm() {
  fireEvent.submit(document.querySelector('form')!);
}

// ─── Mode rendering ───────────────────────────────────────────────────────────

describe('AuthModal — login mode', () => {
  it('shows correct heading', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Welcome, Seeker' })).toBeInTheDocument();
  });

  it('shows Log in submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('does not show Name field', () => {
    renderLogin();
    expect(screen.queryByPlaceholderText('Planeswalker of choice')).not.toBeInTheDocument();
  });

  it('shows switch to signup link', () => {
    renderLogin();
    expect(screen.getByText(/no account yet/i)).toBeInTheDocument();
  });
});

describe('AuthModal — signup mode', () => {
  it('shows correct heading', () => {
    renderLogin({ mode: 'signup' });
    expect(screen.getByRole('heading', { name: 'Bind a new Seeker' })).toBeInTheDocument();
  });

  it('shows Sign up submit button', () => {
    renderLogin({ mode: 'signup' });
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  });

  it('shows Name field', () => {
    renderLogin({ mode: 'signup' });
    expect(screen.getByPlaceholderText('Planeswalker of choice')).toBeInTheDocument();
  });

  it('shows switch to login link', () => {
    renderLogin({ mode: 'signup' });
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe('AuthModal — form validation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not call onSuccess when email is empty', () => {
    const { onSuccess } = renderLogin();
    fillPassword('secret');
    submitForm();
    act(() => vi.advanceTimersByTime(900));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not call onSuccess when password is empty', () => {
    const { onSuccess } = renderLogin();
    fillEmail('test@test.com');
    submitForm();
    act(() => vi.advanceTimersByTime(900));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

// ─── Successful submit ────────────────────────────────────────────────────────

describe('AuthModal — onSuccess payload', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('login: derives name from email', () => {
    const { onSuccess } = renderLogin();
    fillEmail('gandalf@shire.com');
    fillPassword('secret');
    submitForm();
    act(() => vi.advanceTimersByTime(900));
    expect(onSuccess).toHaveBeenCalledWith({ email: 'gandalf@shire.com', name: 'gandalf' });
  });

  it('signup with name: uses provided name', () => {
    const { onSuccess } = renderLogin({ mode: 'signup' });
    fillName('Gandalf');
    fillEmail('gandalf@shire.com');
    fillPassword('secret');
    submitForm();
    act(() => vi.advanceTimersByTime(900));
    expect(onSuccess).toHaveBeenCalledWith({ email: 'gandalf@shire.com', name: 'Gandalf' });
  });

  it('signup without name: derives name from email', () => {
    const { onSuccess } = renderLogin({ mode: 'signup' });
    fillEmail('gandalf@shire.com');
    fillPassword('secret');
    submitForm();
    act(() => vi.advanceTimersByTime(900));
    expect(onSuccess).toHaveBeenCalledWith({ email: 'gandalf@shire.com', name: 'gandalf' });
  });
});

// ─── Busy state ───────────────────────────────────────────────────────────────

describe('AuthModal — busy state', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('disables submit button while pending', () => {
    renderLogin();
    fillEmail('test@test.com');
    fillPassword('secret');
    submitForm();
    expect(screen.getByRole('button', { name: 'Sealing the oath…' })).toBeDisabled();
  });
});

// ─── Close behavior ───────────────────────────────────────────────────────────

describe('AuthModal — close', () => {
  it('× button calls onClose', () => {
    const { onClose } = renderLogin();
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Skip login calls onClose', () => {
    const { onClose } = renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Skip login' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking inside the dialog does not call onClose', () => {
    const { onClose } = renderLogin();
    fireEvent.click(screen.getByPlaceholderText('seeker@plane.mtg'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Mode switching ───────────────────────────────────────────────────────────

describe('AuthModal — mode switching', () => {
  it('from login calls onSwitchMode with signup', () => {
    const { onSwitchMode } = renderLogin();
    fireEvent.click(screen.getByText(/no account yet/i));
    expect(onSwitchMode).toHaveBeenCalledWith('signup');
  });

  it('from signup calls onSwitchMode with login', () => {
    const { onSwitchMode } = renderLogin({ mode: 'signup' });
    fireEvent.click(screen.getByText(/already have an account/i));
    expect(onSwitchMode).toHaveBeenCalledWith('login');
  });
});

// ─── AuthGate ─────────────────────────────────────────────────────────────────

vi.mock('../../app/context/UserContext', () => ({
  useUser: vi.fn(),
}));

import { useUser } from '../../app/context/UserContext';

describe('AuthGate', () => {
  it('renders nothing when authOpen is false', () => {
    vi.mocked(useUser).mockReturnValue({
      authOpen: false, closeAuth: vi.fn(), setUser: vi.fn(),
      user: null, openAuth: vi.fn(),
    });
    const { container } = render(<AuthGate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders AuthModal when authOpen is true', () => {
    vi.mocked(useUser).mockReturnValue({
      authOpen: true, closeAuth: vi.fn(), setUser: vi.fn(),
      user: null, openAuth: vi.fn(),
    });
    render(<AuthGate />);
    expect(screen.getByRole('heading', { name: 'Welcome, Seeker' })).toBeInTheDocument();
  });

  it('calls setUser and closeAuth on success', () => {
    vi.useFakeTimers();
    const setUser = vi.fn();
    const closeAuth = vi.fn();
    vi.mocked(useUser).mockReturnValue({
      authOpen: true, closeAuth, setUser, user: null, openAuth: vi.fn(),
    });
    render(<AuthGate />);
    fillEmail('test@test.com');
    fillPassword('secret');
    submitForm();
    act(() => vi.advanceTimersByTime(900));
    expect(setUser).toHaveBeenCalledWith({ email: 'test@test.com', name: 'test' });
    expect(closeAuth).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
