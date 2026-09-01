'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * User-selectable preference. `'system'` follows `prefers-color-scheme`.
 */
export type ThemePreference = 'dark' | 'light' | 'system';

/**
 * What the document actually renders as, after resolving `'system'`.
 */
export type ResolvedTheme = 'dark' | 'light';

/** localStorage key. Exported so tests and the init script agree on it. */
export const THEME_STORAGE_KEY = 'magic-grimoire:theme';

/** Dark is the design's primary theme, so it is also the fallback. */
const DEFAULT_RESOLVED: ResolvedTheme = 'dark';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

/**
 * Blocking inline script that resolves and applies the theme BEFORE first
 * paint, so there is no flash of the wrong theme on load.
 *
 * CONTRACT FOR WAVE 2a (`app/layout.tsx`):
 *   Render it as the first child of <head> (or the very top of <body>) as a
 *   plain, non-deferred inline script:
 *
 *     import { themeInitScript } from './context/ThemeContext';
 *     ...
 *     <head>
 *       <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 *     </head>
 *
 *   Do NOT use `next/script` here — its strategies all run after hydration,
 *   which defeats the purpose. Do NOT add `defer`/`async`.
 *
 *   The script writes `data-theme="dark|light"` and `style.colorScheme` onto
 *   <html>. `ThemeProvider` then adopts the same value on mount, so the
 *   attribute is never rewritten to a different value and nothing flickers.
 *
 *   Because <html> always carries an explicit `data-theme`, the
 *   `prefers-color-scheme` block in globals.css is only a safety net for when
 *   this script does not run (JS disabled). Both paths resolve identically.
 */
export const themeInitScript = `(function(){try{var d=document.documentElement;var s=null;try{s=window.localStorage.getItem('${THEME_STORAGE_KEY}');}catch(e){}var t=(s==='dark'||s==='light')?s:((window.matchMedia&&window.matchMedia('${LIGHT_QUERY}').matches)?'light':'${DEFAULT_RESOLVED}');d.setAttribute('data-theme',t);d.style.colorScheme=t;}catch(e){}})();`;

interface ThemeContextType {
  /** The stored preference, including `'system'`. */
  theme: ThemePreference;
  /** The preference with `'system'` resolved against `matchMedia`. */
  resolvedTheme: ResolvedTheme;
  /** What the OS currently prefers, regardless of the stored preference. */
  systemTheme: ResolvedTheme;
  /** `false` until the client effect has read storage — useful to skip SSR-unsafe UI. */
  isReady: boolean;
  setTheme: (theme: ThemePreference) => void;
  /** Flip between explicit dark and explicit light (never lands on `'system'`). */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: DEFAULT_RESOLVED,
  systemTheme: DEFAULT_RESOLVED,
  isReady: false,
  setTheme: () => {
    /* no-op outside a ThemeProvider */
  },
  toggleTheme: () => {
    /* no-op outside a ThemeProvider */
  },
});

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

function readStoredTheme(): ThemePreference | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : null;
  } catch {
    // Private windows and blocked-storage settings throw on read.
    return null;
  }
}

function writeStoredTheme(theme: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private windows and blocked-storage settings throw on write.
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Preference used until localStorage has been read. */
  defaultTheme?: ThemePreference;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemePreference>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(DEFAULT_RESOLVED);
  const [isReady, setIsReady] = useState(false);

  // Read the stored preference + the OS preference once, then track OS changes.
  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) {
      setThemeState(stored);
    }

    const media = window.matchMedia(LIGHT_QUERY);
    setSystemTheme(media.matches ? 'light' : 'dark');
    setIsReady(true);

    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'light' : 'dark');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  // Mirror the resolved theme onto <html>. Skipped until the storage read has
  // happened so we never overwrite what themeInitScript already applied.
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [isReady, resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    writeStoredTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextType>(
    () => ({ theme, resolvedTheme, systemTheme, isReady, setTheme, toggleTheme }),
    [theme, resolvedTheme, systemTheme, isReady, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
