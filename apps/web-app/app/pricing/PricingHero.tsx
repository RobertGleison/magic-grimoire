// Disabled with the hero badge below — restore both at once.
// import { Badge } from '../components/Badge/Badge';
// import { SparkleIcon } from './PricingIcons';
import styles from './page.module.css';

/** Pricing hero — Figma node 16:221 (light 20:846). */
export function PricingHero() {
  return (
    <section className={styles.hero} aria-labelledby="pricing-hero-title">
      <h1 id="pricing-hero-title" className={styles.heroTitle}>
        Choose Your Magic Grimoire Tier
      </h1>
      {/* <p className={styles.heroLead}>
        Unlock deckbuilding strategies
      </p> */}
    </section>
  );
}
