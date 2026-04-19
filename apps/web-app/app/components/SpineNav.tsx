'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import { SealLogo } from './atoms';

export default function SpineNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuth } = useUser();

  const links = user
    ? [
        { path: '/', label: 'Home' },
        { path: '/library', label: 'Library' },
        { path: '/grimoire', label: 'Grimoire' },
      ]
    : [
        { path: '/', label: 'Home' },
        { path: '/grimoire', label: 'Grimoire' },
      ];

  return (
    <nav className="spine">
      <div className="spine-logo">
        <SealLogo size={36} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        {links.map(({ path, label }) => (
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
      </div>
      {!user && (
        <div
          className="spine-link"
          onClick={openAuth}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && openAuth()}
          style={{ marginBottom: 8, fontSize: '0.55rem', opacity: 0.7 }}
        >
          Sign In
        </div>
      )}
      <div className="spine-foot">MG · MMXXVI</div>
    </nav>
  );
}
