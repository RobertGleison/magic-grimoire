'use client';

import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

interface ThemeToggleProps {
  /** Extra class for placement inside a header / sidebar. */
  className?: string;
  /** `sm` for dense chrome (mobile header), `md` everywhere else. */
  size?: 'sm' | 'md';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  const isLight = resolvedTheme === 'light';
  const nextTheme = isLight ? 'dark' : 'light';
  const label = `Switch to ${nextTheme} theme`;

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle-${size} ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={isLight}
      data-resolved-theme={resolvedTheme}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          <svg className="theme-toggle-icon theme-toggle-icon-moon" viewBox="0 0 16 16">
            <path
              d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.7 5.7 0 1 0 7.3 7.3Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          <svg className="theme-toggle-icon theme-toggle-icon-sun" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <path d="M8 1v1.7M8 13.3V15M1 8h1.7M13.3 8H15M3 3l1.2 1.2M11.8 11.8 13 13M13 3l-1.2 1.2M4.2 11.8 3 13" />
            </g>
          </svg>
        </span>
      </span>
    </button>
  );
}
