import { Badge } from '../components/Badge/Badge';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import { PRICING_CTA_HREF, PRICING_TIERS, type PricingTier, type TierAccent } from './pricingContent';
// Disabled with the feature bullets' glyph — restore both at once.
// import { SparkleIcon } from './PricingIcons';
import styles from './page.module.css';

/** Sets `--tier-accent`, which paints the eyebrow and the feature bullets. */
const ACCENT_CLASS: Record<TierAccent, string> = {
  muted: styles.accentMuted,
  gold: styles.accentGold,
  crimson: styles.accentCrimson,
};

/**
 * Per-variant CTA corrections, all of them padding/colour only:
 *   secondary  the design labels "Start Free" in --cream, not the muted the
 *              shared Button variant uses (16:256 / light 20:881)
 *   primary    the pricing "Go Archmage" button (16:321) carries no resting
 *              crimson glow, unlike the hero button the variant was harvested
 *              from; the hover glow is left alone
 */
const CTA_CLASS: Record<PricingTier['ctaVariant'], string> = {
  secondary: styles.ctaOutline,
  accent: '',
  primary: styles.ctaSolid,
};

function TierCard({ tier }: { tier: PricingTier }) {
  const classes = [styles.tier, ACCENT_CLASS[tier.accent], tier.featured ? styles.tierFeatured : '']
    .filter(Boolean)
    .join(' ');

  return (
    <Card
      as="li"
      variant="panel"
      radius="xl"
      padding="xl"
      border={tier.featured ? 'crimson' : 'default'}
      elevation={tier.featured ? 2 : 1}
      className={classes}
    >
      {tier.ribbon ? (
        <Badge variant="crimson-solid" size="sm" className={styles.ribbon}>
          {tier.ribbon}
        </Badge>
      ) : null}

      <div className={styles.tierHead}>
        <p className={styles.tierEyebrow}>{tier.eyebrow}</p>
        <h3 className={styles.tierName} id={`${tier.id}-name`}>
          {tier.name}
        </h3>
        <p className={styles.tierDescription}>{tier.description}</p>
      </div>

      <p className={styles.priceRow}>
        <span className={styles.price}>{tier.price}</span>
        <span className={styles.pricePeriod}>{tier.period}</span>
      </p>

      <hr className={styles.divider} />

      <ul className={styles.features}>
        {tier.features.map((feature) => (
          <li key={feature} className={styles.feature}>
            {/* <SparkleIcon className={styles.featureIcon} /> */}
            <span>- {feature}</span>
          </li>
        ))}
      </ul>

      {/* Links only — there is no billing backend behind these tiers. */}
      <Button
        href={PRICING_CTA_HREF}
        variant={tier.ctaVariant}
        size="md"
        fullWidth
        aria-describedby={`${tier.id}-name`}
        className={`${styles.tierCta} ${CTA_CLASS[tier.ctaVariant]}`.trim()}
      >
        {tier.ctaLabel}
      </Button>
    </Card>
  );
}

/** Pricing grid — Figma node 16:228 (light 20:853). */
export function PricingTiers() {
  return (
    <section className={styles.gridSection} aria-labelledby="pricing-tiers-title">
      <h2 id="pricing-tiers-title" className="visually-hidden">
        Subscription tiers
      </h2>
      <ul className={styles.grid}>
        {PRICING_TIERS.map((tier) => (
          <TierCard key={tier.id} tier={tier} />
        ))}
      </ul>
    </section>
  );
}
