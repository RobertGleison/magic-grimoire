import { PRICING_FAQ } from './pricingContent';
import { PlusIcon } from './PricingIcons';
import styles from './page.module.css';

/**
 * FAQ — Figma node 16:323 (light 20:948).
 *
 * Built on native `<details>`/`<summary>` rather than a React `useState`
 * button. `<summary>` already exposes `role="button"` with a browser-managed
 * `aria-expanded`, and it owns the answer as its disclosure region, so this
 * satisfies the accessible-disclosure contract while ALSO staying keyboard
 * operable and openable with JavaScript disabled — which a stateful button
 * cannot be. That in turn keeps the whole pricing route a server component:
 * no `'use client'` anywhere on this page.
 *
 * DELIBERATE DEVIATION: the Figma frame renders every answer expanded, but it
 * draws a "+" marker on each row — the design contradicts itself. Resolved in
 * favour of the marker: items start collapsed (so the "+" is truthful at rest)
 * and the glyph rotates 45 degrees into a close "x" when open. Flagged for
 * Wave 5a, which will otherwise read the collapsed height as a parity diff.
 */
export function PricingFaq() {
  return (
    <section className={styles.faq} aria-labelledby="pricing-faq-title">
      <div className={styles.faqInner}>
        <div className={styles.faqHead}>
          <h2 id="pricing-faq-title" className={styles.faqTitle}>
            Frequently Asked Spell-Inquiries
          </h2>
          <p className={styles.faqSubtitle}>
            Everything you need to know about payment rituals, refunds, and spellbook legality.
          </p>
        </div>

        <div className={styles.faqList}>
          {PRICING_FAQ.map((entry) => (
            <details key={entry.id} className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                <h3 className={styles.faqQuestion}>{entry.question}</h3>
                <PlusIcon className={styles.faqIcon} />
              </summary>
              <p className={styles.faqAnswer}>{entry.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
