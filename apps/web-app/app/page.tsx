'use client';

import { useRouter } from 'next/navigation';
import { ArcaneSigil } from './components/ArcaneSigil/ArcaneSigil';
import { ManaSymbol } from './components/ManaSymbol/ManaSymbol';
import { ALL_COLORS } from './enums';
import { Ornament } from './components/ArcaneSigilLogo/ArcaneSigilLogo';
import { motion } from 'framer-motion';
import style from './page.module.css';


export default function LandingPage() {
  const router = useRouter();

  const enterGrimoire = () => {
    router.push('/deck-builder');
  };

  return (
    <main className={style.page}>
      <HeroSection onEnter={enterGrimoire} />
      <HowToBuildYourDeckSteps />
      <FeaturesSection />
      <CommentSection />
      <CallToAction onEnter={enterGrimoire} />
    </main>
  );
}


function RevealSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 1, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ label, heading, ornamentWidth = 220, headingFontSize }: {
  label: string;
  heading: string;
  ornamentWidth?: number;
  headingFontSize?: string;
}) {
  return (
    <div className={style.sectionHeader}>
      <h2 className={`h-display ${style.sectionHeading}`} style={headingFontSize ? { fontSize: headingFontSize } : undefined}>
        {heading}
      </h2>
      <Ornament style={{ justifyContent: 'center', maxWidth: ornamentWidth, margin: '0 auto 16px' }}>
        <span>{label}</span>
      </Ornament>
    </div>
  );
}

function HeroSection({ onEnter }: { onEnter: () => void }) {
  return (
    <section className={style.hero}>
      <div className={style.heroInner}>
        <div className={style.heroText}>
          <Ornament style={{ justifyContent: 'flex-start', maxWidth: 320, marginBottom: 32 }}>
            <span style={{ fontSize: '0.7rem' }}>Codex Arcanum</span>
          </Ornament>

          <h1 className={`h-display ${style.heroTitle}`}>
            Magic<br />
            <span className={`${style.gradientText}`} style={{ fontStyle: 'italic' }}>Grimoire</span>
          </h1>

          <p className={style.heroSubtitle}>
            Whisper your Magic: The Gathering desires and it shall forge for you the perfect deck of cards.
          </p>

          <div className={style.heroActions}>
            <button className="btn btn-primary" onClick={onEnter} style={{ fontSize: '0.85rem', padding: '18px 44px' }}>
              Ask the Grimoire
            </button>
          </div>
        </div>

        <div className={style.heroSigil}>
          <ArcaneSigil size={520} intensity={0.8} />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { roman: 'I',   title: 'Describe', body: 'Type what kind of Magic: The Gathering deck you want. Any archetype, format, or playstyle. Plain text works fine.' },
  { roman: 'II',  title: 'Search',   body: 'We query the card database and use AI to find cards that match your description.' },
  { roman: 'III', title: 'Build',    body: 'A full deck is assembled with all your requirements but maintaining mana balance, synergy and competitivity.' },
  { roman: 'IV',  title: 'Revision',   body: 'You can rebuild the entire deck or just the cards you dislike until reach your preferences.' },
];

function HowToBuildYourDeckSteps() {
  return (
    <RevealSection className={style.section}>
      <SectionHeader label="The Rite" heading="How to build your deck" />
      <div className={style.grid}>
        {STEPS.map((step, i) => (
          <div key={i} className={style.card}>
            <div className={`h-display ${style.stepRoman}`}>{step.roman}</div>
            <div className={`h-ui ${style.cardLabel}`}>{step.title}</div>
            <p className={style.cardBody}>{step.body}</p>
          </div>
        ))}
      </div>
    </RevealSection>
  );
}

const FEATURES = [
  { title: 'All Colors', body: 'Every color combination, every guild, every card. The tome knows the soul of each.', pips: ALL_COLORS },
  { title: 'All Formats', body: 'Standard, Modern, Pioneer, Legacy, Vintage, Commander, Pauper. Budget or boundless.',  icon: '⚔' },
  { title: 'Synergies',   body: 'Mana curves, ratios and interactions are important.', icon: '✦' },
  { title: 'Iteration',   body: 'Each inclusion justified. Each ratio defended. Argue with the oracle, refine the result.', icon: '↻' },
];

function FeaturesSection() {
  return (
    <RevealSection className={style.section}>
      <SectionHeader label="The scriptures" heading="What the grimoire knows" />
      <div className={style.grid}>
        {FEATURES.map((feature, i) => (
          <div key={i} className={`${style.card} ${style.featureCard}`}>
            <div className={style.featureIcons}>
              {feature.pips
                ? feature.pips.map(p => <ManaSymbol key={p} symbol={p} size={28} />)
                : <span className={style.featureIconGlyph}>{feature.icon}</span>}
            </div>
            <div className={`h-ui ${style.cardLabel}`}>{feature.title}</div>
            <p className={style.cardBody}>{feature.body}</p>
          </div>
        ))}
      </div>
    </RevealSection>
  );
}

const INCANTATIONS = [
  "I want a fast red deck for Pioneer that just kills people on turn four, lots of burn and cheap creatures",
  "Build me a control deck for Modern, heavy on counterspells and wraths, Teferi as the main win con",
  "A reanimator deck that cheats Griselbrand into play as early as possible, doesn't matter the format",
  "Green stompy for Standard, I just want big creatures with trample that are hard to block",
  "Tokens going wide in Modern, white and red, pump them all at once and swing for lethal",
  "A Commander mill deck, something political that slowly grinds everyone's libraries away",
  "Simic tempo for Modern, I want to hold up counterspells and flash in creatures at end of turn",
  "Jund for Modern, the classic — discard, removal, threats. I want Tarmogoyf and Liliana",
  "Aura voltron with hexproof creatures, pile enchantments on one creature and make it huge",
  "Lifegain synergy in white/black, tokens and drain effects, something that snowballs fast",
  "Izzet prowess for Modern, cantrips and cheap spells, Swiftspear as the main threat",
  "Werewolf tribal in red/green, keep the pressure so they never transform back. Add enchatments if possible",
];

const MARQUEE_ROWS = [
  { items: [...INCANTATIONS.slice(0, 6), ...INCANTATIONS.slice(0, 6)], reverse: false },
  { items: [...INCANTATIONS.slice(6),    ...INCANTATIONS.slice(6)],    reverse: true  },
];

function CommentSection() {
  return (
    <RevealSection className={style.incantations}>
      <SectionHeader
        label="Sample Incantations"
        heading="Examples of Deck Ideas"
        ornamentWidth={280}
      />
      <div className={style.marqueeOuter}>
        <div className={style.marqueeFadeLeft} />
        <div className={style.marqueeFadeRight} />
        {MARQUEE_ROWS.map((row, ri) => (
          <div key={ri} className={`${style.marqueeRow} ${row.reverse ? style.marqueeRowReverse : ''}`}>
            {row.items.map((text, i) => (
              <div key={i} className={style.marqueeCard}>
                <span className={style.marqueeQuote} style={{ marginRight: 10 }}>❝</span>
                {text}
                <span className={style.marqueeQuote} style={{ marginLeft: 10 }}>❞</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </RevealSection>
  );
}

function CallToAction({ onEnter }: { onEnter: () => void }) {
  return (
    <RevealSection className={style.cta}>
      <div className={style.ctaInner}>
        <h2 className={`h-display ${style.ctaHeading}`}>
          <span className={style.gradientText}>The grimoire awaits</span>
        </h2>
        <button className="btn btn-primary" onClick={onEnter} style={{ fontSize: '0.9rem', padding: '18px 40px' }}>
          Ask the Grimoire
        </button>
      </div>
    </RevealSection>
  );
}

