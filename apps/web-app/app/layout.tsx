import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DM_Sans, DM_Serif_Text } from 'next/font/google';
import { ThemeProvider, themeInitScript } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';
import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import { MockAuthBanner } from './components/MockAuthBanner/MockAuthBanner';
import { MOCK_AUTH_ENABLED } from './lib/mockAuth';
import './globals.css';
import './layout.css';

/**
 * DM Sans is loaded as a variable font with the optical-size axis exposed, so
 * the `font-variation-settings: 'opsz' 14` that globals.css sets on `body`
 * (and that every DM Sans node in the design carries) actually resolves. A
 * variable `wght` axis also covers the 400/500/600/700 the design uses —
 * `axes` and `weight` are mutually exclusive in next/font/google.
 */
const dmSans = DM_Sans({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-dm-sans',
  display: 'swap',
});

/** DM Serif Text ships a single weight. */
const dmSerifText = DM_Serif_Text({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif-text',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Magic Grimoire - AI MTG deckbuilder',
    template: '%s · Magic Grimoire',
  },
  description:
    'Describe a deck in plain language and Magic Grimoire builds a balanced, legal 60-card list from real Magic: The Gathering cards.',
  applicationName: 'Magic Grimoire',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `suppressHydrationWarning`: themeInitScript writes data-theme and
    // style.colorScheme onto <html> before React hydrates.
    // No server-rendered data-theme on purpose — the attribute must stay
    // absent when JS is off so the prefers-color-scheme block in globals.css
    // can still resolve the theme.
    <html lang="en" className={`${dmSans.variable} ${dmSerifText.variable}`} suppressHydrationWarning>
      <head>
        {/* Plain, blocking inline script — next/script would run after
            hydration and flash the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <UserProvider>
            <a className="skip-link" href="#main-content">
              Skip to content
            </a>
            <div className="app-shell">
              {/* DEVELOPMENT ONLY. Present only while NEXT_PUBLIC_MOCK_AUTH=true,
                  where every email/password combination signs in. Gated here as
                  well as inside the component so the bundler can drop it. */}
              {MOCK_AUTH_ENABLED ? <MockAuthBanner /> : null}
              <Header />
              <main id="main-content" className="app-main" tabIndex={-1}>
                {children}
              </main>
              <Footer />
            </div>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
