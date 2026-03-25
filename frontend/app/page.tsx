'use client';

import { useReveal } from './hooks/useReveal';
import Link from 'next/link';
import { ArcaneSigil } from './components/ArcaneSigil';


const PROMPTS = [
  {
    prompt: 'A black/white vampire deck that drains life with lifelink', format: 'standard', colors: ['B', 'W'] },
  { prompt: 'An aggressive red goblin deck that casts a dozen goblins in a single turn', format: 'legacy', colors: ['R'] },
  { prompt: 'A five-color dragon commander deck helmed by The Ur-Dragon', format: 'commander', colors: ['W', 'U', 'B', 'R', 'G'] },
  { prompt: 'Blue/green simic ramp that cheats enormous creatures into play on turn three', format: 'modern', colors: ['U', 'G'] },
  { prompt: 'A red/white deck with equipments and artifacts theme', format: 'commander', colors: ['R', 'W'] },
  { prompt: 'A red and blue dech themed in Ravnica with only spells', format: 'modern', colors: ['R', 'B'] },
];

const WORKFLOW_STEPS = [
  {
    glyph: 'I',
    title: 'Speak Your Intent',
    body: 'Describe your ideal deck in plain language. The more vivid and specific, the better the result.',
    accent: 'var(--gold-mid)',
  },
  {
    glyph: 'II',
    title: 'Intent is Parsed',
    body: 'The forge reads your request and extracts colors, strategy, creature types, and archetypes.',
    accent: 'var(--arcane)',
  },
  {
    glyph: 'III',
    title: 'Archives Consulted',
    body: 'Thousands of cards from the Scryfall database are searched and ranked against your vision.',
    accent: 'var(--sapphire)',
  },
  {
    glyph: 'IV',
    title: 'Deck is Forged',
    body: 'The forge composes a balanced and synergistic deck and returns it ready to copy and play.',
    accent: 'var(--crimson)',
  },
];


const FEATURES = [
  {
    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M14 3 L14 25 M3 14 L25 14" opacity="0.3" /><circle cx="14" cy="14" r="10" /><circle cx="14" cy="14" r="5" /><circle cx="14" cy="14" r="1.5" fill="currentColor" /></svg>,
    title: 'Natural Language',
    body: 'No need to know card names or set codes. Just describe what you want to play.'
  },
  {
    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M4 14 C4 8 8 4 14 4 C20 4 24 8 24 14" strokeDasharray="3 2" /><path d="M24 14 C24 20 20 24 14 24 C8 24 4 20 4 14" /><polyline points="20,10 24,14 20,18" /></svg>,
    title: 'Real-Time Streaming',
    body: 'Watch the ritual unfold live — each step shown as it happens through the arcane stream.'
  },
  {
    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="5" y="4" width="12" height="16" rx="1" /><rect x="11" y="8" width="12" height="16" rx="1" /><line x1="8" y1="9" x2="14" y2="9" /><line x1="8" y1="12" x2="14" y2="12" /><line x1="8" y1="15" x2="11" y2="15" /></svg>,
    title: 'Scryfall-Powered',
    body: 'Every card sourced from Scryfall\'s complete database with artwork, oracle text, and legality.'
  },
  {
    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><polygon points="14,3 17,11 26,11 19,16 21,25 14,20 7,25 9,16 2,11 11,11" /></svg>,
    title: 'All Formats',
    body: 'Standard, Modern, Legacy, and Commander — each with its own card pool and rules applied.'
  },
];


function RevealSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal-section ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}


export default function LandingPage() {
  return (
    <div className="app-shell landing">
      <ArcaneSigil />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="app-header">
        <h1 className="header-title">Magic<br />Grimoire</h1>
        <p className="header-subtitle">
          Describe a deck in plain language and watch the grimoire forge it from thousands of cards of Magic: The Gathering.
        </p>
        <div className="hero-cta-row">
          <Link href="/grimoire" className="cta-primary">
            <span>Enter the Grimoire</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2L2 8l4 2 2 4 6-12z" />
            </svg>
          </Link>
        </div>
        <p className="header-formats">Standard · Modern · Legacy · Commander</p>
      </header>

      <main className="landing-content">

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section className="section steps-section">
        <div className="section-inner">
          <RevealSection className="section-header-wrap">
            <p className="section-eyebrow">The Ritual</p>
            <h2 className="section-title">How the Grimoire Works</h2>
            <p className="section-subtitle">
              Four arcane steps stand between your intention and a complete, battle-ready deck.
            </p>
          </RevealSection>

          <div className="steps-grid">
            {WORKFLOW_STEPS.map((step, i) => (
              <RevealSection key={step.glyph} delay={i * 80}>
                <div className="step-card">
                  <div className="step-numeral" style={{ color: step.accent, boxShadow: `0 0 20px ${step.accent}22` }}>
                    {step.glyph}
                  </div>
                  <div className="step-connector" aria-hidden="true" />
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-body">{step.body}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="section features-section">
        <div className="section-inner">
          <RevealSection className="section-header-wrap">
            <p className="section-eyebrow">Capabilities</p>
            <h2 className="section-title">Built for the Discerning Planeswalker</h2>
          </RevealSection>

          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <RevealSection key={f.title} delay={i * 60}>
                <div className="feature-card">
                  <div className="feature-icon" aria-hidden="true">{f.icon}</div>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-body">{f.body}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Example prompts ───────────────────────────────────────── */}
      <section className="section prompts-section">
        <div className="section-inner">
          <RevealSection className="section-header-wrap">
            <p className="section-eyebrow">Incantations</p>
            <h2 className="section-title">What Will You Create?</h2>
          </RevealSection>

          <div className="prompts-grid">
            <div className="prompts-track">
              {[...PROMPTS, ...PROMPTS].map((ex, i) => (
                <Link key={i} href="/grimoire" className="prompt-card">
                  <div className="prompt-colors">
                    {ex.colors.map((c) => (
                      <div key={c} className={`color-pip ${c}`} aria-hidden="true">{c}</div>
                    ))}
                    <span className="prompt-format">{ex.format}</span>
                  </div>
                  <p className="prompt-text">"{ex.prompt}"</p>
                  <div className="prompt-cta">Try this →</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="section final-cta-section">
        <RevealSection>
          <div className="final-cta-inner">
            <h2 className="final-title">Ready to cast?</h2>
            <p className="final-body">
              The Grimoire awaits. Speak your desire and let the cards answer.
            </p>
            <Link href="/grimoire" className="cta-primary cta-large">
              <span>Open the Grimoire</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2L2 8l4 2 2 4 6-12z" />
              </svg>
            </Link>
          </div>
        </RevealSection>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <span>Magic Grimoire</span>
        <span className="footer-sep">·</span>
        <span>By Robert Gleison</span>
      </footer>
      </main>
    </div>
  );
}
