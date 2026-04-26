'use client';

import './NavBar.css';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '../../context/UserContext';

const NAV_LINKS = [
  { path: '/',            label: 'Home',         authOnly: false },
  { path: '/deck-builder', label: 'Deck Builder', authOnly: false },
  { path: '/library',     label: 'Library',      authOnly: true },
];

export default function SpineNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, openAuth } = useUser();

  return (
    <nav className="spine">
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', height: '100%' }}>
        {NAV_LINKS.filter(({ authOnly }) => !authOnly || user).map(({ path, label }) => (
          <div
            key={path}
            className={`spine-link${pathname === path ? ' active' : ''}`}
            onClick={() => router.push(path)}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && router.push(path)}
          >
            {label}
          </div>
        ))}

        {user ? (
          <button className="spine-btn" onClick={() => { setUser(null); router.push('/'); }}>Log Out</button>
        ) : (
          <>
            <button className="spine-btn" onClick={openAuth}>Log In</button>
            <button className="spine-btn spine-btn-primary" onClick={openAuth}>Sign Up</button>
          </>
        )}
      </div>
    </nav>
  );
}
