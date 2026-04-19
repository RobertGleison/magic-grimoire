'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import { SealLogo } from './atoms';

export default function SpineNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

  const links = user
    ? [
        { path: '/', label: 'Codex' },
        { path: '/library', label: 'Library' },
        { path: '/grimoire', label: 'Grimoire' },
      ]
    : [
        { path: '/', label: 'Codex' },
        { path: '/grimoire', label: 'Cast' },
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
      <div className="spine-foot">MG · MMXXVI</div>
    </nav>
  );
}
