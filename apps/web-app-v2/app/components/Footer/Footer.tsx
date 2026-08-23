import Link from 'next/link';
import './Footer.css';

/**
 * The grimoire glyph from Figma node 3:411 (24x24). Duplicated from
 * `Header.tsx` on purpose: this wave owns only `Header/` and `Footer/`, so a
 * shared `BookIcon`/`Wordmark` component cannot be created yet.
 */
function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M23.4873 22.1476V20.9837C23.4873 19.3766 27.4548 18.0739 25.8344 18.0739H4.71063C3.09024 18.0739 1.77673 19.3766 1.77673 20.9837V22.1476C1.77673 23.7547 3.09024 25.0574 4.71063 25.0574H25.8344C27.4548 25.0574 23.4873 23.7547 23.4873 22.1476ZM22.6417 23.8936H4.9223C3.8332 23.8936 2.95029 23.025 2.95029 21.9536V21.1777C2.95029 20.1063 3.8332 19.2378 4.9223 19.2378H22.6417C23.7308 19.2378 22.2376 20.1063 22.2376 21.1777V21.9536C22.2376 23.025 23.7308 23.8936 22.6417 23.8936ZM9.36634 9.9262H22.9246C24.5449 9.9262 20.5775 8.62347 20.5775 7.01636V5.85242C20.5775 4.24543 24.5449 2.94256 22.9246 2.94256H9.36634C7.746 2.94256 6.43252 4.2454 6.43252 5.85242V7.01636C6.43249 8.62347 7.746 9.9262 9.36634 9.9262ZM7.60606 6.0464C7.60606 4.97504 8.48896 4.10653 9.57806 4.10653H19.7319C20.821 4.10653 19.3278 4.97504 19.3278 6.0464V6.82239C19.3278 7.89374 20.821 8.76226 19.7319 8.76226H9.57806C8.48896 8.76226 7.60606 7.89374 7.60606 6.82239V6.0464ZM4.48966 17.4918H22.1217C23.742 17.4918 25.0556 16.1891 25.0556 14.582V13.4181C25.0556 11.811 23.742 10.5083 22.1217 10.5083H4.48966C2.86933 10.5083 6.83682 11.811 6.83682 13.4181V14.582C6.8368 16.1891 2.86933 17.4918 4.48966 17.4918ZM7.68235 11.6721H21.91C22.9991 11.6721 23.882 12.5407 23.882 13.6121V14.388C23.882 15.4594 22.9991 16.3279 21.91 16.3279H7.68235C6.59325 16.3279 8.08646 15.4594 8.08646 14.388V13.6121C8.08646 12.5407 6.59325 11.6721 7.68235 11.6721Z" />
    </svg>
  );
}

/**
 * Column labels are verbatim from nodes 3:338 / 3:344 / 3:351. The hrefs are
 * NOT from the design — the Figma footer links to features that do not exist
 * (Mana Optimizer, Meta Ticker, API Docs, …), so each label is pointed at the
 * nearest route that actually ships. No dead links.
 */
const FOOTER_COLUMNS = [
  {
    title: 'Library',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Mana Optimizer', href: '/deck-builder' },
      { label: 'Sideboard Synthesizer', href: '/deck-builder' },
      { label: 'Meta Ticker', href: '/library' },
    ],
  },
  {
    title: 'Spellbooks',
    links: [
      { label: 'Commander', href: '/deck-builder' },
      { label: 'Modern', href: '/deck-builder' },
      { label: 'Standard', href: '/deck-builder' },
      { label: 'Pioneer', href: '/deck-builder' },
      { label: 'Legacy', href: '/deck-builder' },
    ],
  },
  {
    title: 'Guild',
    links: [
      { label: 'Pricing Tiers', href: '/pricing' },
      { label: 'Planeswalker Community', href: '/pricing' },
      { label: 'API Docs', href: '/pricing' },
      { label: 'Changelog', href: '/pricing' },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-columns">
          <div className="footer-brand">
            <Link className="footer-brand-link" href="/" aria-label="Magic Grimoire — home">
              <BookIcon className="footer-brand-icon" />
              <span className="footer-wordmark">MAGIC GRIMOIRE</span>
            </Link>
            <p className="footer-tagline">
              An independent, AI-powered Magic: The Gathering deckbuilder. We compute, you conquer.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav className="footer-column" key={column.title} aria-label={column.title}>
              <h2 className="footer-column-title">{column.title}</h2>
              <ul className="footer-column-list">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link className="footer-link" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="footer-legal">
          <hr className="footer-rule" />
          <div className="footer-legal-row">
            <p className="footer-fan-content">
              Magic Grimoire is unofficial Fan Content permitted under the Fan Content Policy. Not
              approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
              the Coast. © Wizards of the Coast LLC.
            </p>
            <p className="footer-copyright">© 2026 Magic Grimoire Corp.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
