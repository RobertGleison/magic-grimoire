'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import { useUser } from '../../context/UserContext';
import './Header.css';

const HEADER_MENU_ID = 'header-menu';

/**
 * The real routes of the app. The Figma header (node 3:9) labels four
 * marketing anchors — Features / Formats / How It Works / Pricing — and the
 * app headers (nodes 9:12 / 10:12) label four features that do not exist
 * (Explore Meta / My Collection / Spellbook Vault). Both are replaced by the
 * routes that actually ship, keeping the design's geometry and type.
 */
const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/deck-builder', label: 'Deck Builder' },
  { href: '/library', label: 'My Decks' },
  { href: '/pricing', label: 'Pricing' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The grimoire glyph from Figma node 3:408 (28x28) / 3:411 (24x24). */
function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M23.4873 22.1476V20.9837C23.4873 19.3766 27.4548 18.0739 25.8344 18.0739H4.71063C3.09024 18.0739 1.77673 19.3766 1.77673 20.9837V22.1476C1.77673 23.7547 3.09024 25.0574 4.71063 25.0574H25.8344C27.4548 25.0574 23.4873 23.7547 23.4873 22.1476ZM22.6417 23.8936H4.9223C3.8332 23.8936 2.95029 23.025 2.95029 21.9536V21.1777C2.95029 20.1063 3.8332 19.2378 4.9223 19.2378H22.6417C23.7308 19.2378 22.2376 20.1063 22.2376 21.1777V21.9536C22.2376 23.025 23.7308 23.8936 22.6417 23.8936ZM9.36634 9.9262H22.9246C24.5449 9.9262 20.5775 8.62347 20.5775 7.01636V5.85242C20.5775 4.24543 24.5449 2.94256 22.9246 2.94256H9.36634C7.746 2.94256 6.43252 4.2454 6.43252 5.85242V7.01636C6.43249 8.62347 7.746 9.9262 9.36634 9.9262ZM7.60606 6.0464C7.60606 4.97504 8.48896 4.10653 9.57806 4.10653H19.7319C20.821 4.10653 19.3278 4.97504 19.3278 6.0464V6.82239C19.3278 7.89374 20.821 8.76226 19.7319 8.76226H9.57806C8.48896 8.76226 7.60606 7.89374 7.60606 6.82239V6.0464ZM4.48966 17.4918H22.1217C23.742 17.4918 25.0556 16.1891 25.0556 14.582V13.4181C25.0556 11.811 23.742 10.5083 22.1217 10.5083H4.48966C2.86933 10.5083 6.83682 11.811 6.83682 13.4181V14.582C6.8368 16.1891 2.86933 17.4918 4.48966 17.4918ZM7.68235 11.6721H21.91C22.9991 11.6721 23.882 12.5407 23.882 13.6121V14.388C23.882 15.4594 22.9991 16.3279 21.91 16.3279H7.68235C6.59325 16.3279 8.08646 15.4594 8.08646 14.388V13.6121C8.08646 12.5407 6.59325 11.6721 7.68235 11.6721Z" />
    </svg>
  );
}

/** The signed-in identity the app-chrome header shows (nodes 9:18 / 10:17). */
export interface HeaderUser {
  /** Display name — "Planeswalker John" in the design. */
  name: string;
  /** Secondary line under the name — "Level 24 Summoner" in the design. */
  rank?: string;
  /** Avatar image. Falls back to the name's initial when absent. */
  avatarUrl?: string;
}

interface HeaderProps {
  /**
   * Non-`undefined` → the design's user-profile cluster (nodes 9:18 / 10:17)
   * for an object, the marketing "Sign In" + "Start Free" pair (node 3:14)
   * for `null`. Auth state — not the route — is the variant axis, so this is
   * the only structural difference between the marketing header (3:5 / 20:8)
   * and the app headers (9:7 / 10:7).
   *
   * Omit it (the normal case) and the header reads the signed-in user from
   * `UserContext` instead. The prop stays an explicit override for tests and
   * for any future route that must force one variant.
   */
  user?: HeaderUser | null;
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname() ?? '/';
  const { user: sessionUser, signOut } = useUser();
  // While the session is still `checking` this is null, so the signed-out
  // pair renders — the same markup the server produced, so the first client
  // paint never mismatches and the "Sign In" link exists with JS disabled.
  const activeUser: HeaderUser | null =
    user !== undefined
      ? user
      : sessionUser
        ? { name: sessionUser.name, avatarUrl: sessionUser.avatarUrl }
        : null;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close the slide-out on navigation.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Focus trap, Escape-to-close and scroll lock while the slide-out is open.
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter(
        (element) => element.offsetParent !== null,
      );

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const items = focusables();
      if (items.length === 0) {
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);

      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const authCluster = activeUser ? (
    <div className="header-user">
      <span className="header-user-meta">
        <span className="header-user-name">{activeUser.name}</span>
        {activeUser.rank ? <span className="header-user-rank">{activeUser.rank}</span> : null}
      </span>
      {activeUser.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar hosts are not in next.config images.remotePatterns
        <img
          className="header-user-avatar"
          src={activeUser.avatarUrl}
          alt=""
          width={36}
          height={36}
        />
      ) : (
        <span className="header-user-avatar" aria-hidden="true">
          {activeUser.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <button type="button" className="header-signout" onClick={() => void signOut()}>
        Sign Out
        <span className="visually-hidden">{` — ${activeUser.name}`}</span>
      </button>
    </div>
  ) : (
    <>
      <Link className="header-signin" href="/login">
        Sign In
      </Link>
      <Link className="header-cta" href="/signup">
        Start Free
      </Link>
    </>
  );

  return (
    <header className="header">
      <div className="header-inner">
        <Link className="header-brand" href="/" aria-label="Magic Grimoire — home">
          <BookIcon className="header-brand-icon" />
          <span className="header-wordmark">MAGIC GRIMOIRE</span>
        </Link>

        <nav className="header-nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              className="header-nav-link"
              href={link.href}
              aria-current={isActive(pathname, link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <div className="header-actions-auth">{authCluster}</div>
          <button
            ref={toggleRef}
            type="button"
            className="header-menu-toggle"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
            aria-controls={HEADER_MENU_ID}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <svg
              className="header-menu-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              {isMenuOpen ? (
                <path d="M4 4l12 12M16 4L4 16" />
              ) : (
                <path d="M2.5 5h15M2.5 10h15M2.5 15h15" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <>
          <button
            type="button"
            className="header-menu-backdrop"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            ref={panelRef}
            id={HEADER_MENU_ID}
            className="header-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="header-menu-header">
              <span className="header-menu-title">Menu</span>
            </div>

            <nav className="header-menu-nav" aria-label="Primary, mobile">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  className="header-menu-link"
                  href={link.href}
                  aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="header-menu-actions">{authCluster}</div>
          </div>
        </>
      ) : null}
    </header>
  );
}
