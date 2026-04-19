'use client';

import { ReactNode, CSSProperties } from 'react';

export function SealLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.7" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.5" />
      <polygon
        points={[...Array(5)].map((_, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return `${20 + Math.cos(a) * 10},${20 + Math.sin(a) * 10}`;
        }).join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="0.8"
        opacity="0.9"
      />
      <circle cx="20" cy="20" r="2" fill="var(--accent)" />
    </svg>
  );
}

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
