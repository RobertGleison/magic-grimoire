import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NavBar from '../../app/components/NavBar/NavBar';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock('../../app/context/UserContext', () => ({
  useUser: vi.fn(),
}));

import { useRouter } from 'next/navigation';
import { useUser } from '../../app/context/UserContext';

function mockUser(user: { email: string; name: string } | null) {
  vi.mocked(useUser).mockReturnValue({
    user,
    setUser: vi.fn(),
    openAuth: vi.fn(),
    closeAuth: vi.fn(),
    authOpen: false,
  });
}

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as ReturnType<typeof useRouter>);
});

// ─── Guest (not logged in) ────────────────────────────────────────────────────

describe('NavBar — guest', () => {
  beforeEach(() => mockUser(null));

  it('shows Home link', () => {
    render(<NavBar />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('shows Deck Builder link', () => {
    render(<NavBar />);
    expect(screen.getByText('Deck Builder')).toBeInTheDocument();
  });

  it('does not show Library link', () => {
    render(<NavBar />);
    expect(screen.queryByText('Library')).not.toBeInTheDocument();
  });

  it('shows Log In button', () => {
    render(<NavBar />);
    expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
  });

  it('shows Sign Up button', () => {
    render(<NavBar />);
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
  });

  it('does not show Log Out button', () => {
    render(<NavBar />);
    expect(screen.queryByRole('button', { name: 'Log Out' })).not.toBeInTheDocument();
  });

  it('Log In button calls openAuth', () => {
    const openAuth = vi.fn();
    vi.mocked(useUser).mockReturnValue({ user: null, setUser: vi.fn(), openAuth, closeAuth: vi.fn(), authOpen: false });
    render(<NavBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(openAuth).toHaveBeenCalledOnce();
  });

  it('Sign Up button calls openAuth', () => {
    const openAuth = vi.fn();
    vi.mocked(useUser).mockReturnValue({ user: null, setUser: vi.fn(), openAuth, closeAuth: vi.fn(), authOpen: false });
    render(<NavBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(openAuth).toHaveBeenCalledOnce();
  });
});

// ─── Logged in ────────────────────────────────────────────────────────────────

describe('NavBar — logged in', () => {
  beforeEach(() => mockUser({ email: 'gandalf@shire.com', name: 'Gandalf' }));

  it('shows Library link', () => {
    render(<NavBar />);
    expect(screen.getByText('Library')).toBeInTheDocument();
  });

  it('shows Home link', () => {
    render(<NavBar />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('shows Deck Builder link', () => {
    render(<NavBar />);
    expect(screen.getByText('Deck Builder')).toBeInTheDocument();
  });

  it('shows Log Out button', () => {
    render(<NavBar />);
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
  });

  it('does not show Log In button', () => {
    render(<NavBar />);
    expect(screen.queryByRole('button', { name: 'Log In' })).not.toBeInTheDocument();
  });

  it('does not show Sign Up button', () => {
    render(<NavBar />);
    expect(screen.queryByRole('button', { name: 'Sign Up' })).not.toBeInTheDocument();
  });

  it('Log Out button calls setUser(null) and redirects to /', () => {
    const setUser = vi.fn();
    const push = vi.fn();
    vi.mocked(useUser).mockReturnValue({ user: { email: 'gandalf@shire.com', name: 'Gandalf' }, setUser, openAuth: vi.fn(), closeAuth: vi.fn(), authOpen: false });
    vi.mocked(useRouter).mockReturnValue({ push } as ReturnType<typeof useRouter>);
    render(<NavBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }));
    expect(setUser).toHaveBeenCalledWith(null);
    expect(push).toHaveBeenCalledWith('/');
  });
});
