import { Badge } from '../components/Badge/Badge';
import { SparkleIcon } from './PricingIcons';
import styles from './page.module.css';

/** Pricing hero — Figma node 16:221 (light 20:846). */
export function PricingHero() {
  return (
    <section className={styles.hero} aria-labelledby="pricing-hero-title">
      <Badge
        variant="crimson"
        size="md"
        shape="pill"
        className={styles.heroPill}
        icon={<SparkleIcon />}
      >
        Grimoire Subscription Plans
      </Badge>
      <h1 id="pricing-hero-title" className={styles.heroTitle}>
        Choose Your Grimoire Tier
      </h1>
      <p className={styles.heroLead}>
        Unlock advanced deckbuilding algorithms, infinite automated meta tests, and sideboards
        optimized directly for your Friday Night Magic tables.
      </p>
    </section>
  );
}
