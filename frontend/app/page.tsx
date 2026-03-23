'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

// ─── Animated Arcane Circle ───────────────────────────────────────────────────

function HeroSigil() {
  return (
    <div className="hero-sigil-wrap" aria-hidden>
      {/* Outermost ring — slowest */}
      <svg className="sigil-ring ring-1" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="200" cy="200" r="190" stroke="url(#ring1grad)" strokeWidth="0.6" />
        {[...Array(24)].map((_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const r = 190, inner = 182;
          return (
            <line
              key={i}
              x1={200 + r * Math.cos(angle)} y1={200 + r * Math.sin(angle)}
              x2={200 + inner * Math.cos(angle)} y2={200 + inner * Math.sin(angle)}
              stroke="url(#ring1grad)" strokeWidth="0.8"
            />
          );
        })}
        <defs>
          <linearGradient id="ring1grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8a6f2e" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#c9a84c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8a6f2e" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Second ring — reverse */}
      <svg className="sigil-ring ring-2" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="200" cy="200" r="155" stroke="url(#ring2grad)" strokeWidth="0.5" strokeDasharray="4 8" />
        <defs>
          <linearGradient id="ring2grad" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8a6f2e" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* Pentagram ring */}
      <svg className="sigil-ring ring-3" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="200" cy="200" r="120" stroke="url(#ring3grad)" strokeWidth="0.5" />
        {/* 5-pointed star */}
        {[0, 1, 2, 3, 4].map((i) => {
          const a0 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const a1 = ((i + 2) * 2 * Math.PI) / 5 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={200 + 120 * Math.cos(a0)} y1={200 + 120 * Math.sin(a0)}
              x2={200 + 120 * Math.cos(a1)} y2={200 + 120 * Math.sin(a1)}
              stroke="url(#ring3grad)" strokeWidth="0.6"
            />
          );
        })}
        {/* Pentagon inner */}
        {[0, 1, 2, 3, 4].map((i) => {
          const a0 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const a1 = ((i + 1) * 2 * Math.PI) / 5 - Math.PI / 2;
          return (
            <line
              key={`p${i}`}
              x1={200 + 46 * Math.cos(a0)} y1={200 + 46 * Math.sin(a0)}
              x2={200 + 46 * Math.cos(a1)} y2={200 + 46 * Math.sin(a1)}
              stroke="url(#ring3grad)" strokeWidth="0.5"
            />
          );
        })}
        <defs>
          <linearGradient id="ring3grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#8a6f2e" stopOpacity="0.3" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center gem */}
      <div className="sigil-center">
        <div className="sigil-gem" />
      </div>
    </div>
  );
}

// ─── How it works steps ───────────────────────────────────────────────────────

const STEPS = [
  {
    glyph: 'I',
    title: 'Speak Your Intent',
    body: 'Describe your ideal deck in plain language. The more vivid and specific, the better the result.',
    accent: '#c9a84c',
  },
  {
    glyph: 'II',
    title: 'Intent is Parsed',
    body: 'Claude reads your request and extracts colors, strategy, creature types, and archetypes.',
    accent: '#8b4ea8',
  },
  {
    glyph: 'III',
    title: 'Archives Consulted',
    body: 'Thousands of cards from the Scryfall database are searched and ranked against your vision.',
    accent: '#2e7ab8',
  },
  {
    glyph: 'IV',
    title: 'Deck is Forged',
    body: 'Claude composes a balanced, synergistic 60-card deck and returns it ready to copy and play.',
    accent: '#8b1a2f',
  },
];

// ─── Feature cards ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M14 3 L14 25 M3 14 L25 14" opacity="0.3" />
        <circle cx="14" cy="14" r="10" />
        <circle cx="14" cy="14" r="5" />
        <circle cx="14" cy="14" r="1.5" fill="currentColor" />
      </svg>
    ),
    title: 'Natural Language',
    body: 'No need to know card names or set codes. Just describe what you want to play.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M4 14 C4 8 8 4 14 4 C20 4 24 8 24 14" strokeDasharray="3 2" />
        <path d="M24 14 C24 20 20 24 14 24 C8 24 4 20 4 14" />
        <polyline points="20,10 24,14 20,18" />
      </svg>
    ),
    title: 'Real-Time Streaming',
    body: 'Watch the ritual unfold live — each step shown as it happens through the arcane stream.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <rect x="5" y="4" width="12" height="16" rx="1" />
        <rect x="11" y="8" width="12" height="16" rx="1" />
        <line x1="8" y1="9" x2="14" y2="9" />
        <line x1="8" y1="12" x2="14" y2="12" />
        <line x1="8" y1="15" x2="11" y2="15" />
      </svg>
    ),
    title: 'Scryfall-Powered',
    body: 'Every card sourced from Scryfall\'s complete database with artwork, oracle text, and legality.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <polygon points="14,3 17,11 26,11 19,16 21,25 14,20 7,25 9,16 2,11 11,11" />
      </svg>
    ),
    title: 'All Formats',
    body: 'Standard, Modern, Legacy, and Commander — each with its own card pool and rules applied.',
  },
];

// ─── Scroll reveal hook ───────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

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

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="landing">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-glow" aria-hidden />

        <HeroSigil />

        <div className="hero-content">
          <p className="hero-eyebrow">The Arcane Forge</p>
          <h1 className="hero-title">Magic<br />Grimoire</h1>
          <p className="hero-tagline">
            Describe a deck in plain language.<br />
            Watch AI forge it from thousands of cards.
          </p>

          <div className="hero-cta-row">
            <Link href="/forge" className="cta-primary">
              <span>Enter the Forge</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2L2 8l4 2 2 4 6-12z" />
              </svg>
            </Link>
          </div>

          <p className="hero-formats">
            Standard · Modern · Legacy · Commander
          </p>
        </div>

        <div className="hero-scroll-hint" aria-hidden>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <rect x="1" y="1" width="10" height="18" rx="5" />
            <circle cx="6" cy="6" r="1.5" fill="currentColor">
              <animate attributeName="cy" values="5;13;5" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
          <span>Scroll to learn more</span>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section className="section steps-section">
        <div className="section-inner">
          <RevealSection className="section-header-wrap">
            <p className="section-eyebrow">The Ritual</p>
            <h2 className="section-title">How the Forge Works</h2>
            <p className="section-subtitle">
              Four arcane steps stand between your intention and a complete, battle-ready deck.
            </p>
          </RevealSection>

          <div className="steps-grid">
            {STEPS.map((step, i) => (
              <RevealSection key={step.glyph} delay={i * 80}>
                <div className="step-card">
                  <div className="step-numeral" style={{ color: step.accent, boxShadow: `0 0 20px ${step.accent}22` }}>
                    {step.glyph}
                  </div>
                  <div className="step-connector" aria-hidden />
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
                  <div className="feature-icon">{f.icon}</div>
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
            <h2 className="section-title">What Will You Forge?</h2>
          </RevealSection>

          <div className="prompts-grid">
            {[
              { prompt: 'A black/white vampire tribal deck that drains life and reanimates the fallen', format: 'standard', colors: ['B', 'W'] },
              { prompt: 'An explosive red storm deck that casts a dozen spells in a single turn', format: 'legacy', colors: ['R'] },
              { prompt: 'A five-color dragon commander deck helmed by The Ur-Dragon himself', format: 'commander', colors: ['W', 'U', 'B', 'R', 'G'] },
              { prompt: 'Blue/green simic ramp that cheats enormous creatures into play on turn three', format: 'modern', colors: ['U', 'G'] },
            ].map((ex, i) => (
              <RevealSection key={i} delay={i * 60}>
                <Link href={`/forge`} className="prompt-card">
                  <div className="prompt-colors">
                    {ex.colors.map((c) => (
                      <div key={c} className={`color-pip ${c}`}>{c}</div>
                    ))}
                    <span className="prompt-format">{ex.format}</span>
                  </div>
                  <p className="prompt-text">"{ex.prompt}"</p>
                  <div className="prompt-cta">Try this →</div>
                </Link>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="section final-cta-section">
        <RevealSection>
          <div className="final-cta-inner">
            <div className="final-rune" aria-hidden>⬡</div>
            <h2 className="final-title">Ready to cast?</h2>
            <p className="final-body">
              The Forge awaits. Speak your desire and let the cards answer.
            </p>
            <Link href="/forge" className="cta-primary cta-large">
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
        <span>Powered by Claude & Scryfall</span>
      </footer>
    </div>
  );
}
