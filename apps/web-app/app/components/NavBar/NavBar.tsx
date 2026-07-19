'use client';

import './NavBar.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SealLogo } from '../ArcaneSigilLogo/ArcaneSigilLogo';
import { useUser } from '../../context/UserContext';

const NAV_LINKS = [
  { path: '/',            label: 'Home',         authOnly: false, requiresAuth: false },
  { path: '/deck-builder', label: 'Deck Builder', authOnly: false, requiresAuth: true },
  { path: '/library',     label: 'Library',      authOnly: true,  requiresAuth: true },
];

export function SpineNav() {
  const pathname = usePathname();
  const { user, openAuth, signOut } = useUser();

  return (
    <nav className="spine">
      <Link href="/" className="spine-brand">
        <SealLogo size={32} />
      </Link>

      <div className="spine-links">
        {NAV_LINKS.filter(({ authOnly }) => !authOnly || user).map(({ path, label, requiresAuth }) => (
          <Link
            key={path}
            href={path}
            className={`spine-link${pathname === path ? ' active' : ''}`}
            onClick={e => {
              if (requiresAuth && !user) {
                e.preventDefault();
                openAuth();
              }
            }}
          >
            {label}
          </Link>
        ))}

        {user ? (
          <div className="spine-auth">
            <span className="spine-user-name">{user.name}</span>
            <button className="spine-logout" onClick={signOut}>
              Logout
            </button>
          </div>
        ) : (
          <button className="btn btn-primary spine-login" onClick={openAuth}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
}
