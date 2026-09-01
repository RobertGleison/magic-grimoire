import type { Metadata } from 'next';
import { PricingHero } from './PricingHero';
import { PricingTiers } from './PricingTiers';
import { PricingFaq } from './PricingFaq';
import styles from './page.module.css';

/**
 * /pricing — Figma page `magic-grimoire-pricing` 16:204 (light 20:829).
 *
 *   hero          16:221  → PricingHero
 *   pricing-grid  16:228  → PricingTiers
 *   faq-section   16:323  → PricingFaq
 *
 * The header (16:207) and footer are the shared shell from Wave 2a and are
 * rendered by `app/layout.tsx`, so this route only owns the three sections.
 *
 * No `'use client'` anywhere on this route: the tier CTAs are plain links and
 * the FAQ is a native `<details>` disclosure, so the whole page ships as a
 * server component with zero client JavaScript of its own.
 */
export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Choose your Magic Grimoire tier from the free Apprentice Pack to unlimited deck forging and team grimoire sharing.',
};

export default function PricingPage() {
  return (
    <div className={styles.page}>
      <PricingHero />
      <PricingTiers />
      <PricingFaq />
    </div>
  );
}
