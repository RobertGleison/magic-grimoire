import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserStatus } from '../../app/context/UserContext';
import DeckBuilderLayout from '../../app/deck-builder/layout';
import LibraryLayout from '../../app/library/layout';

/* `vi.mock` factories are hoisted, so shared mocks come from `vi.hoisted`. */
const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

let userStatus: UserStatus = 'signed-in';
vi.mock('../../app/context/UserContext', () => ({
  useUser: () => ({ status: userStatus, user: null }),
}));

const loginFor = (next: string) => `/login?next=${encodeURIComponent(next)}`;

describe('RequireSignIn route guards', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    window.history.replaceState({}, '', '/');
  });
  afterEach(cleanup);

  it('renders the deck builder for a signed-in user', () => {
    userStatus = 'signed-in';
    render(<DeckBuilderLayout>forge</DeckBuilderLayout>);
    expect(screen.getByText('forge')).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('renders through while the session is still being checked', () => {
    userStatus = 'checking';
    render(<DeckBuilderLayout>forge</DeckBuilderLayout>);
    expect(screen.getByText('forge')).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor from the deck builder to sign in', () => {
    userStatus = 'signed-out';
    render(<DeckBuilderLayout>forge</DeckBuilderLayout>);
    expect(screen.queryByText('forge')).toBeNull();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(replaceMock).toHaveBeenCalledWith(loginFor('/deck-builder'));
  });

  it('keeps the deck builder query so sign-in returns to the same deck', () => {
    userStatus = 'signed-out';
    window.history.replaceState({}, '', '/deck-builder?deck=deck-1');
    render(<DeckBuilderLayout>forge</DeckBuilderLayout>);
    expect(replaceMock).toHaveBeenCalledWith(loginFor('/deck-builder?deck=deck-1'));
  });

  it('still guards the library', () => {
    userStatus = 'signed-out';
    render(<LibraryLayout>shelf</LibraryLayout>);
    expect(screen.queryByText('shelf')).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith(loginFor('/library'));
  });
});
