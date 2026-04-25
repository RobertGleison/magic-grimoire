'use client';

import './ArcaneSigilLogo.css';
import { ReactNode, CSSProperties } from 'react';

export function ArcaneSigilLogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/assets/grimoire_icon.png"
      width={size}
      height={size}
      alt="Magic Grimoire"
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}

export { ArcaneSigilLogo as SealLogo };

export function Ornament({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div className="ornament h-ui" style={style}>
      {children}
    </div>
  );
}

export function Frame({
  children,
  className = '',
  style,
  onClick,
  ornate = false,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  ornate?: boolean;
}) {
  return (
    <div
      className={`frame ${className}`}
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, var(--void-2), var(--void-1))',
        border: '1px solid rgba(var(--accent-glow), 0.18)',
        padding: ornate ? '28px' : '20px',
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {ornate && (
        <>
          <span style={{ position: 'absolute', top: -1, left: -1, width: 10, height: 10, borderTop: '1px solid var(--accent)', borderLeft: '1px solid var(--accent)' }} />
          <span style={{ position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderTop: '1px solid var(--accent)', borderRight: '1px solid var(--accent)' }} />
          <span style={{ position: 'absolute', bottom: -1, left: -1, width: 10, height: 10, borderBottom: '1px solid var(--accent)', borderLeft: '1px solid var(--accent)' }} />
          <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderBottom: '1px solid var(--accent)', borderRight: '1px solid var(--accent)' }} />
        </>
      )}
      {children}
    </div>
  );
}
