/**
 * Pricing copy, transcribed verbatim from Figma file pgLzux7WT7F98ZEwDpw8lh.
 *
 *   hero          16:221  (light 20:846)
 *   pricing-grid  16:228  (light 20:853)
 *   faq-section   16:323  (light 20:948)
 *
 * Nothing here is invented — tier names, prices, periods, eyebrows, feature
 * lists, CTA labels and FAQ answers are exactly the strings in the design.
 *
 * Page-local by design: agent 3a builds a *pricing section* on the landing
 * page from node 3:187 with overlapping copy. Deduping the two is a Wave 5
 * task; this file must stay self-contained until then.
 */

/** Which token family paints a tier's eyebrow + feature bullets. */
export type TierAccent = 'muted' | 'gold' | 'crimson';

/** Maps 1:1 onto the `Button` variants harvested in Wave 2b. */
export type TierCtaVariant = 'secondary' | 'accent' | 'primary';

export interface PricingTier {
  /** Stable key + `id` anchor. */
  id: string;
  /** Figma node for the card frame, for Wave 5a parity. */
  node: string;
  /** Uppercase rarity label above the tier name (16:231 / 16:261 / 16:293). */
  eyebrow: string;
  name: string;
  description: string;
  /** Rendered as-is, including the currency glyph (16:235 / 16:265 / 16:297). */
  price: string;
  /** The billing period beside the price (16:236). */
  period: string;
  features: string[];
  ctaLabel: string;
  ctaVariant: TierCtaVariant;
  accent: TierAccent;
  /** The 2px crimson frame + "MOST POPULAR" ribbon (16:257 / 16:258). */
  featured?: boolean;
  /** Ribbon text, verbatim and already uppercase in the design. */
  ribbon?: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'apprentice-pack',
    node: '16:229',
    eyebrow: 'Common',
    name: 'Apprentice Pack',
    description: 'For casual spellcasters testing basic card synergies.',
    price: '$0',
    period: '/ month',
    features: [
      '3 Deck Generations per month',
      'Basic Mana Curve Simulator',
      'Standard Format validation',
      'Public archetype browsing',
    ],
    ctaLabel: 'Start Free',
    ctaVariant: 'secondary',
    accent: 'muted',
  },
  {
    id: 'planeswalker-core',
    node: '16:257',
    eyebrow: 'Rare',
    name: 'Planeswalker Core',
    description: 'For the competitive brewer climbing the Mythic ranks.',
    price: '$9',
    period: '/ month',
    features: [
      'Unlimited Deck Forging',
      'Advanced Synergy engine',
      'Sideboard optimizer assistant',
      'Full Mana Curve Balancer V2',
      'Export to Arena, MTGO & Moxfield',
    ],
    ctaLabel: 'Claim Rare Pack',
    ctaVariant: 'accent',
    accent: 'gold',
    featured: true,
    ribbon: 'MOST POPULAR',
  },
  {
    id: 'archmage-archives',
    node: '16:291',
    eyebrow: 'Mythic Legendary',
    name: 'Archmage Archives',
    description: 'For high-stakes tournament teams and draft clubs.',
    price: '$24',
    period: '/ month',
    features: [
      'Everything in Planeswalker Core',
      'Real-time local store meta-tracking',
      '10,000 Hands Goldfish Simulation',
      'Private discord wizard channel',
      'API & team grimoire sharing',
    ],
    ctaLabel: 'Go Archmage',
    ctaVariant: 'primary',
    accent: 'crimson',
  },
];

export interface FaqEntry {
  id: string;
  node: string;
  question: string;
  answer: string;
}

export const PRICING_FAQ: FaqEntry[] = [
  {
    id: 'upgrade-mid-season',
    node: '16:328',
    question: 'Can I upgrade my grimoire mid-season?',
    answer:
      'Yes, planeswalker. You can upgrade or downgrade your plan instantly. Your remaining days on the previous tier will be automatically calculated and prorated as mana credits toward your new scroll.',
  },
  {
    id: 'tournament-legality',
    node: '16:333',
    question: 'Is it legal to use these AI-generated decks in real tournaments?',
    answer:
      'Absolutely. Magic Grimoire generates lists that conform exactly to legal card pools of your chosen formats. You still physicalize the spells to play them—we just do the math.',
  },
  {
    id: 'team-sharing',
    node: '16:338',
    question: 'Do you offer guild/team sharing options?',
    answer:
      'We do. The Archmage Archives plan enables up to 5 wizards to share a singular database pool, collaborate on sideboarding strategies, and analyze simulated matchup statistics simultaneously.',
  },
  {
    id: 'refund-policy',
    node: '16:343',
    question: 'What is your refund spell policy?',
    answer:
      "If the magical synergy doesn't suit your playstyle, summon a support request within 7 days of your payment transaction and we will refund your mana vault completely, no questions asked.",
  },
];

/** Every CTA on this page points at sign-up — there is no billing backend. */
export const PRICING_CTA_HREF = '/signup';
