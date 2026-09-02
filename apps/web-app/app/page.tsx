import Image from 'next/image';
import type { ReactNode } from 'react';

import { Badge } from './components/Badge/Badge';
import { Button } from './components/Button/Button';
import type { ButtonVariant } from './components/Button/Button';
import { Card } from './components/Card/Card';
import { ManaCurve } from './components/ManaCurve/ManaCurve';
import type { CardInDeck } from './types/api';
import { LandingReveal } from './LandingReveal';
import styles from './page.module.css';

/* ==========================================================================
   Landing page — Figma `arcaneforge-landing` 3:4
     3:18 hero · 3:78 stats · 3:91 features · 3:117 mana-curve
     3:163 how-it-works · 3:187 pricing · 3:273 testimonials · 3:318 final-cta

   Header (3:5) and footer (3:331) are rendered by `app/layout.tsx`.

   Every section sub-component below is page-local on purpose: the Wave 3
   screen agents share `app/components/`, so anything only the landing page
   needs stays here. Marketing copy is transcribed verbatim from the dark
   frames — including the design's own "Aquire Mythic Pack" spelling.
   ========================================================================== */

/* ------------------------------------------------------------------ icons */

/* The design's 14px `sparkles` (3:363, 3:366, 3:420) and 16px `book-icon`
   (3:414, 3:417) are Figma-hosted assets on 7-day URLs. Both are inlined as
   token-coloured SVG rather than shipped as files. */

function SparkleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 1l2.4 7.6L22 11l-7.6 2.4L12 21l-2.4-7.6L2 11l7.6-2.4z" />
    </svg>
  );
}

function BookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v15H7.5A2.5 2.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A2.5 2.5 0 0 0 7.5 22H19v-5" />
    </svg>
  );
}

/* ------------------------------------------------------------------- copy */

const HERO_LEAD =
  'Input your playstyle, choose your format and colors, explain your thoughts to the AI and let Magic Grimoire generate a brand new deck.';

const HERO_FORMATS = ['Commander / EDH', 'Modern', 'Standard', 'Pioneer', 'Legacy'] as const;

/* The `Magic Grimoire` card render, served from `public/` so `next/image` can
   optimise it. Both hero frames (3:52 back, 3:65 front) share the one file. */
const HERO_CARD_ART = '/hero-card.png';

// Disabled together with `StatsSection` below — restore both at once.
// interface Stat {
//   value: string;
//   label: string;
// }
//
// /* 3:79 3:82 3:85 3:88 */
// const STATS: readonly Stat[] = [
//   { value: '2.4M+', label: 'Decks Synthesized' },
//   { value: '94.8%', label: 'AI Synergy Accuracy' },
//   { value: '18.3%', label: 'Average Winrate Boost' },
//   { value: '150k+', label: 'Active Spellcasters' },
// ];

interface Feature {
  glyph: string;
  title: string;
  body: string;
}

/* 3:97 3:102 3:107 3:112 */
const FEATURES: readonly Feature[] = [
  {
    glyph: '◈',
    title: 'Arcane Synergy Engine',
    body: 'Our neural network maps 25,000+ MTG cards, instantly revealing non-obvious combo values and deep thematic cohesion.',
  },
  {
    glyph: '✦',
    title: 'Sideboard Synthesizer',
    body: "Dynamically construct responsive sideboards tailored directly against your local game store's current meta shifts.",
  },
  {
    glyph: '⟡',
    title: 'Mana Curve Optimization',
    body: 'Say goodbye to mana screw. Simulate 10,000 goldfish hands instantly to calculate ideal land-to-spell ratios.',
  },
  {
    glyph: '※',
    title: 'Format Validation',
    body: 'Instant deck check for legality across Standard, Modern, Commander, Pioneer, and Legacy rulesets.',
  },
];

interface Step {
  numeral: string;
  title: string;
  body: string;
}

/* 3:169 3:175 3:181 */
const STEPS: readonly Step[] = [
  {
    numeral: 'I',
    title: 'Declare Playstyle',
    body: "Input your favorite commander, color identity, or strategic keyword (e.g., 'Golgari Graveyard Reanimator').",
  },
  {
    numeral: 'II',
    title: 'Synthesize Matrix',
    body: 'The Grimoire computes hundreds of thousands of card combinations, filtering for perfect mana cost alignment.',
  },
  {
    numeral: 'III',
    title: 'Export & Conquer',
    body: 'Export instantly to Arena, MTGO, or Moxfield. Tap into your optimized sideboard guide and take the table.',
  },
];

interface Tier {
  id: string;
  eyebrow: string;
  tone: 'muted' | 'accent' | 'crimson';
  name: string;
  blurb: string;
  amount: string;
  cadence: string;
  features: readonly string[];
  cta: string;
  ctaVariant: ButtonVariant;
  featured: boolean;
}

/* 3:193 3:217 3:244 */
const TIERS: readonly Tier[] = [
  {
    id: "apprentice",
    eyebrow: "Common",
    tone: "muted",
    name: "Apprentice Pack",
    blurb: "For testing basic card interactions.",
    amount: "Free",
    cadence: "/ month",
    features: [
      "Standard Deck Generation",
      "Basic Mana Curve Balancer",
      "Limited deck saves (5 maximum)",
      "Public archetype searching",
    ],
    cta: "Start Free",
    ctaVariant: "secondary",
    featured: false,
  },
  {
    id: "planeswalker",
    eyebrow: "Rare",
    tone: "accent",
    name: "Planeswalker Core",
    blurb: "For the weekly Friday Night Magic competitor.",
    amount: "€9",
    cadence: "/ month",
    features: [
      "Unlimited Advanced Forging",
      "Full Sideboard Synthesizer",
      "Mana Curve Optimization V2",
      "Integration with Moxfield & Arena",
      "Priority AI server queueing",
    ],
    cta: "Claim Rare Pack",
    ctaVariant: "accent",
    featured: false,
  },
  {
    id: "archmage",
    eyebrow: "Mythic Legendary",
    tone: "crimson",
    name: "Archmage Archives",
    blurb: "For mythic-tier tournament grinders and draft clubs.",
    amount: "€24",
    cadence: "/ month",
    features: [
      "Everything in Planeswalker Core",
      "10,000 Hands Goldfish Simulator",
      "Real-time Local Store Meta tracking",
      "Dedicated custom model fine-tuning",
      "Private discord wizard channel",
    ],
    cta: "Aquire Mythic Pack",
    ctaVariant: "primary",
    featured: true,
  },
];

interface Quote {
  monogram: string;
  text: string;
  name: string;
  role: string;
}

/* 3:279 3:292 3:305 */
const QUOTES: readonly Quote[] = [
  {
    monogram: 'JB',
    text: '"The Sideboard Synthesizer completely saved my tournament run. It predicted the rise of Golgari midrange and gave me the exact three cards I needed to counter. Legendary tool."',
    name: 'Jace B.',
    role: 'Mythic Championship Competitor',
  },
  {
    monogram: 'CN',
    text: '"Commander is all about theme, but bad synergy ruins games. Magic Grimoire lets me keep my crazy tribal concepts while generating highly functional, explosive mana curves."',
    name: 'Chandra N.',
    role: 'EDH/Commander Brewer',
  },
  {
    monogram: 'LV',
    text: '"Legacy deckbuilding is notoriously punishing. Even single pip miscalculations will end you. This AI algorithm evaluated 20,000 hands of my Reanimator brew and fixed my land count."',
    name: 'Liliana V.',
    role: 'Legacy Enthusiast',
  },
];

/* The histogram the design draws in 3:134 — 3 / 12 / 18 / 14 / 8 / 5 / 2, run
   back through the real `ManaCurve` bucketing so the section is the shipped
   component and not a picture of it. */
const SIMULATED_CURVE: readonly (readonly [number, number])[] = [
  [0, 3],
  [1, 12],
  [2, 18],
  [3, 14],
  [4, 8],
  [5, 5],
  [6, 2],
];

const SIMULATED_DECK: readonly CardInDeck[] = SIMULATED_CURVE.map(([cmc, quantity]) => ({
  name: cmc === 0 ? 'Zero-cost spells' : cmc + '-drop spells',
  quantity,
  scryfall_id: null,
  image_uri: null,
  mana_cost: cmc === 0 ? null : '{' + cmc + '}',
  type_line: 'Instant',
  section: 'mainboard',
}));

/* ----------------------------------------------------------- sub-components */

interface SectionHeadProps {
  eyebrow: string;
  title: string;
  titleId: string;
  lead: string;
}

function SectionHead({ eyebrow, title, titleId, lead }: SectionHeadProps) {
  return (
    <div className={styles['section-head']}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={titleId} className={styles['section-title']}>
        {title}
      </h2>
      <p className={styles['section-lead']}>{lead}</p>
    </div>
  );
}

function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <LandingReveal className={styles.inner}>
        <div className={styles['hero-inner']}>
          <div className={styles['hero-copy']}>
            {/* <Badge variant="crimson" size="md" shape="pill" icon={<SparkleIcon />}>
              MTG AI Core v2.0 Live
            </Badge> */}

            <div className={styles['hero-headline']}>
              <h1 id="hero-title" className={styles['hero-title']}>
                Create Your Perfect
                <br />
                MTG Deck with AI
              </h1>
              <p className={styles['hero-lead']}>{HERO_LEAD}</p>
            </div>

            <div className={styles['hero-actions']}>
              <Button href="/deck-builder" variant="primary" size="lg" >
                Create Your First Deck
              </Button>
              <Button href="/signup" variant="secondary" size="lg">
                Explore Created Decks
              </Button>
            </div>

            <div className={styles['hero-formats']}>
              <p className={styles['hero-formats-label']}>Supported Deck Formats</p>
              <ul className={styles['hero-formats-list']}>
                {HERO_FORMATS.map((format) => (
                  <li key={format} className={styles['hero-format']}>
                    {format}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 3:50 — decorative only; both frames hold the `Magic Grimoire` card render. */}
          <div className={styles['hero-visual']} aria-hidden="true">
            <span className={styles['hero-halo']}  />
            <span className={styles['hero-card'] + ' ' + styles['hero-card-back']}>
              <Image
                src={HERO_CARD_ART}
                alt=""
                fill
                sizes="(max-width: 900px) 46vw, 240px"
                className={styles['hero-card-art'] + ' ' + styles['hero-card-art-back']}
                priority
              />
            </span>
            <span className={styles['hero-card'] + ' ' + styles['hero-card-front']}>
              <Image
                src={HERO_CARD_ART}
                alt=""
                fill
                sizes="(max-width: 900px) 50vw, 260px"
                className={styles['hero-card-art']}
                priority
              />
            </span>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}

// function StatsSection() {
//   return (
//     <section className={styles.stats} aria-labelledby="stats-title">
//       <h2 id="stats-title" className="visually-hidden">
//         Magic Grimoire by the numbers
//       </h2>
//       <LandingReveal className={styles.inner}>
//         <ul className={styles['stats-list']}>
//           {STATS.map((stat) => (
//             <li key={stat.label} className={styles.stat}>
//               <span className={styles['stat-value']}>{stat.value}</span>
//               <span className={styles['stat-label']}>{stat.label}</span>
//             </li>
//           ))}
//         </ul>
//       </LandingReveal>
//     </section>
//   );
// }

function FeaturesSection() {
  return (
    <section className={styles.section} aria-labelledby="features-title">
      <LandingReveal className={styles.inner}>
        <SectionHead
          eyebrow="Wizard Tools"
          title="Engineered for Legendary Play"
          titleId="features-title"
          lead="Combining competitive machine learning algorithms with the deep heritage of Magic: The Gathering deck design."
        />
        <ul className={styles.grid + ' ' + styles['features-grid']}>
          {FEATURES.map((feature) => (
            <Card
              key={feature.title}
              as="li"
              variant="panel"
              border="strong"
              radius="lg"
              padding="md"
              elevation={1}
              className={styles['feature-card']}
            >
              <span className={styles['feature-media']} aria-hidden="true">
                {feature.glyph}
              </span>
              <div className={styles['feature-text']}>
                <h3 className={styles['card-title']}>{feature.title}</h3>
                <p className={styles['card-body']}>{feature.body}</p>
              </div>
            </Card>
          ))}
        </ul>
      </LandingReveal>
    </section>
  );
}

function ManaCurveSection() {
  return (
    <section className={styles.section} aria-labelledby="curve-title">
      <LandingReveal className={styles.inner}>
        <div className={styles['curve-inner']}>
          <div className={styles['curve-copy']}>
            <Badge variant="crimson" size="sm" shape="square">
              Live Algorithm Output
            </Badge>
            <h2 id="curve-title" className={styles['curve-title']}>
              Never Miss a Land Drop Again
            </h2>
            <p className={styles['curve-body']}>
              Our optimization matrix dynamically balances your early-game spells against your mana
              sources. Watch your curve refine in real time as the AI balances colors, double-pips,
              and tap-lands.
            </p>
            <Button
              href="/deck-builder"
              variant="primary"
              size="lg"
              iconRight={<SparkleIcon size={16} />}
            >
              Test Simulator
            </Button>
          </div>

          <ManaCurve
            cards={SIMULATED_DECK}
            variant="panel"
            title="Simulated Mana Distribution"
            subtitle="Optimal Aggro/Midrange Curve (60-Card Standard)"
            badge="SYNERGY RATIO: 92.4%"
            className={styles['curve-panel']}
          />
        </div>
      </LandingReveal>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className={styles.section} aria-labelledby="steps-title">
      <LandingReveal className={styles.inner}>
        <SectionHead
          eyebrow="The Ritual"
          title="Three Steps to Demonic Synergy"
          titleId="steps-title"
          lead="Crafting a tournament-level deck is no longer a multi-day ordeal. Command the machine in seconds."
        />
        <ol className={styles.grid + ' ' + styles['steps-grid']}>
          {STEPS.map((step) => (
            <Card
              key={step.numeral}
              as="li"
              variant="panel"
              border="strong"
              radius="lg"
              padding="xl"
              className={styles['step-card']}
            >
              <span className={styles['step-medallion']} aria-hidden="true">
                {step.numeral}
              </span>
              <div className={styles['step-text']}>
                <h3 className={styles['step-title']}>{step.title}</h3>
                <p className={styles['card-body']}>{step.body}</p>
              </div>
            </Card>
          ))}
        </ol>
      </LandingReveal>
    </section>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <Card
      as="li"
      variant="panel"
      border={tier.featured ? 'crimson' : tier.tone === 'accent' ? 'accent' : 'none'}
      radius="xl"
      padding="xl"
      className={
        styles.tier + (tier.featured || tier.tone === 'accent' ? '' : ' ' + styles['tier-outline'])
      }
    >
      {tier.featured && (
        <Badge variant="crimson-solid" size="sm" shape="square" className={styles['tier-ribbon']}>
          MOST SYNERGIZED
        </Badge>
      )}

      <div className={styles['tier-head']}>
        <p className={styles['tier-eyebrow'] + ' ' + styles['tier-eyebrow-' + tier.tone]}>
          {tier.eyebrow}
        </p>
        <h3 className={styles['tier-name']}>{tier.name}</h3>
        <p className={styles['tier-blurb']}>{tier.blurb}</p>
      </div>

      <p className={styles['tier-price']}>
        <span className={styles['tier-amount']}>{tier.amount}</span>
        <span className={styles['tier-cadence']}>{tier.cadence}</span>
      </p>

      <hr className={styles['tier-rule']} />

      <ul className={styles['tier-features']}>
        {tier.features.map((feature) => (
          <li key={feature} className={styles['tier-feature']}>
            <span className={styles['tier-feature-icon']}>
              <SparkleIcon />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <Button href="/signup" variant={tier.ctaVariant} size="md" fullWidth>
        {tier.cta}
      </Button>
    </Card>
  );
}

function PricingSection() {
  return (
    <section className={styles.section} aria-labelledby="pricing-title">
      <LandingReveal className={styles.inner}>
        <SectionHead
          eyebrow="Mana Cost"
          title="Grimoire Tiers Tailored for Your Vault"
          titleId="pricing-title"
          lead="Choose your spellbook size. From casual Commander tables to high-stakes Mythic Qualifiers."
        />
        <ul className={styles.grid + ' ' + styles['tiers-grid']}>
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </ul>
      </LandingReveal>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className={styles.section} aria-labelledby="quotes-title">
      <LandingReveal className={styles.inner}>
        <SectionHead
          eyebrow="Spark Proof"
          title="Approved by Planeswalkers"
          titleId="quotes-title"
          lead="Here is what competitive grinders and casual tables are brewing with the Magic Grimoire engine."
        />
        <ul className={styles.grid + ' ' + styles['quotes-grid']}>
          {QUOTES.map((quote) => (
            <Card
              key={quote.name}
              as="li"
              variant="panel"
              border="strong"
              radius="lg"
              padding="none"
              className={styles['quote-card']}
            >
              <span className={styles['quote-stars']} role="img" aria-label="Rated 5 out of 5">
                {[0, 1, 2, 3, 4].map((star) => (
                  <SparkleIcon key={star} />
                ))}
              </span>
              <blockquote className={styles['quote-text']}>{quote.text}</blockquote>
              <div className={styles['quote-author']}>
                <span className={styles['quote-avatar']} aria-hidden="true">
                  {quote.monogram}
                </span>
                <span className={styles['quote-meta']}>
                  <span className={styles['quote-name']}>{quote.name}</span>
                  <span className={styles['quote-role']}>{quote.role}</span>
                </span>
              </div>
            </Card>
          ))}
        </ul>
      </LandingReveal>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className={styles.cta} aria-labelledby="cta-title">
      <LandingReveal className={styles.inner}>
        <div className={styles['cta-panel']}>
          <div className={styles['cta-head']}>
            <Badge variant="crimson" size="sm" shape="square">
              Unleash the Spark
            </Badge>
            <h2 id="cta-title" className={styles['cta-title']}>
              Ready to Conjure Your Masterpiece?
            </h2>
            <p className={styles['cta-lead']}>
              Synthesize competitive MTG decks in milliseconds. Enter the arena with mathematically
              optimized curves and superior meta counters.
            </p>
          </div>
          <div className={styles['cta-actions']}>
            <Button href="/deck-builder" variant="primary" size="lg" iconRight={<BookIcon />}>
              Conjure Your First Deck
            </Button>
            <Button href="/signup" variant="secondary" size="lg">
              View Live Meta Stats
            </Button>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}

/* -------------------------------------------------------------------- page */

/**
 * `LandingReveal` hides its content until it scrolls into view. That start
 * state is already scoped to `prefers-reduced-motion: no-preference`; this
 * neutralises it for a visitor with JavaScript off, who would otherwise never
 * get the class that reveals it.
 */
const NOSCRIPT_REVEAL = '.landing-reveal{opacity:1!important;transform:none!important}';

export default function LandingPage(): ReactNode {
  return (
    <div className={styles.landing}>
      <noscript>
        <style>{NOSCRIPT_REVEAL}</style>
      </noscript>

      <HeroSection />
      {/* <StatsSection /> */}
      <FeaturesSection />
      <ManaCurveSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <FinalCtaSection />
    </div>
  );
}
