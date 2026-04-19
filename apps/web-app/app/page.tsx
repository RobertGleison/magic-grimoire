'use client';

import { useRouter } from 'next/navigation';
import { useUser } from './context/UserContext';
import { ArcaneSigil } from './components/ArcaneSigil';
import { ManaSymbol } from './components/ManaSymbol';
import { ALL_COLORS } from './enums';
import { Ornament } from './components/atoms';
import { useReveal } from './hooks/useReveal';

const COMMENTS = [
  "Mono-red aggro for Pioneer, burn-heavy with Goblin Guides and Eidolon of the Great Revel, cheap curve topping at three",
  "Azorius control for Modern, Teferi, Hero of Dominaria as primary win condition with Supreme Verdict sweepers",
  "Sultai reanimator with Bloodghast recursion, Unearth package, and Griselbrand as the top-end reanimation target",
  "Mono-green stompy with trample and pump, Steel Leaf Champion and Aspect of Hydra for burst damage",
  "Boros tokens with Anthem effects, aggressive go-wide strategy using Raise the Alarm and Intangible Virtue",
  "Dimir mill for Commander, four-color if needed, Persistent Petitioners and Traumatize as core pieces",
  "Simic flash creatures with Brazen Borrower package, Nightpack Ambusher as the primary threat at instant speed",
  "Jund midrange with discard, removal, and threats — Liliana of the Veil, Tarmogoyf, and Bloodbraid Elf",
  "Selesnya aura voltron with hexproof creatures, Slippery Bogle and Kor Spiritdancer carrying Light of Promise",
  "Orzhov lifegain with token synergies, Ajani's Pridemate and Cruel Celebrant as the engine for Modern",
  "Izzet spells matter with prowess and cantrips, Monastery Swiftspear and Dragon's Rage Channeler as threats",
  "Gruul werewolves tribal for Modern, Immerwolf as the anthem lord keeping the pack always transformed",
];

const STEPS = [
  { roman: 'I', title: 'Describe', body: 'Type what kind of Magic: The Gathering deck you want: any archetype, format, or playstyle. Plain text works fine.' },
  { roman: 'II', title: 'Search', body: 'We query the card database and use AI to find cards that match your description.' },
  { roman: 'III', title: 'Build', body: 'A full deck is assembled with all your requirements but maintaining mana balance, synergy and competitivity.' },
  { roman: 'IV', title: 'Export', body: 'Your decklist is ready to edit,copy, share, or import directly into your preferred deck builder.' },
];

const FEATURES = [
  { title: 'All Colors', body: 'Every color combination, every guild, every shard. The tome knows the soul of each.', pips: ALL_COLORS },
  { title: 'All Formats', body: 'Standard, Modern, Pioneer, Legacy, Vintage, Commander, Pauper. Budget or boundless.'},
  { title: 'Synergies', body: 'Not a list of cards — a plan. Mana curves, ratios, and interactions chosen with intent.' },
  { title: 'Iteration', body: 'Each inclusion justified. Each ratio defended. Argue with the oracle, refine the result.' },
];

const gradientText: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--accent), var(--accent-mid))',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

function RevealSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="reveal" style={style}>
      {children}
    </div>
  );
}

function SectionHeader({ label, heading, ornamentWidth = 220, headingFontSize = 'clamp(2rem, 4vw, 3rem)', style }: {
  label: string;
  heading: string;
  ornamentWidth?: number;
  headingFontSize?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 64, ...style }}>
      <h2 className="h-display" style={{ fontSize: headingFontSize, margin: 0 }}>
        {heading}
      </h2>
      <Ornament style={{ justifyContent: 'center', maxWidth: ornamentWidth, margin: '0 auto 16px' }}>
        <span>{label}</span>
      </Ornament>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { user } = useUser();

  const enterGrimoire = () => {
    router.push(user ? '/library' : '/grimoire');
  };

  return (
    <div style={{ position: 'relative', paddingBottom: 120 }}>
      {/* Hero */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '80px 24px',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.35,
          pointerEvents: 'none',
        }}>
          <ArcaneSigil size={780} intensity={0.6} />
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 30%, var(--void-0) 80%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 900, zIndex: 4 }}>
          <Ornament style={{ justifyContent: 'center', maxWidth: 320, margin: '0 auto 32px' }}>
            <span style={{ fontSize: '0.7rem' }}>Codex Arcanum </span>
          </Ornament>

          <h1 className="h-display" style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            lineHeight: 1.05,
            margin: '0 0 12px',
            textShadow: '0 0 40px rgba(var(--accent-glow), 0.3)',
          }}>
            Magic<br />
            <span style={{ ...gradientText, fontStyle: 'italic' }}>Grimoire</span>
          </h1>

          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            color: 'var(--cream)',
            fontStyle: 'italic',
            margin: '0 auto 48px',
            maxWidth: 580,
            opacity: 0.85,
          }}>
            Whisper your Magic: The Gathering desires and it shall forge for you the perfect deck of cards.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: 0.6 }}>
              {ALL_COLORS.map(c => <ManaSymbol key={c} symbol={c} size={18} />)}
            </div>
            <button className="btn btn-primary" onClick={enterGrimoire} style={{ fontSize: '0.85rem', padding: '18px 44px' }}>
              Ask the Grimoire
            </button>
            <div style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)', letterSpacing: '0.2em', opacity: 0.7 }}>
              No account · No incense · Just intent
            </div>
          </div>
        </div>

        <div style={{
          position: 'absolute',
          bottom: 32, left: '50%',
          transform: 'translateX(-50%)',
          color: 'var(--muted)',
          fontFamily: 'var(--font-ui)',
          fontSize: '0.7rem',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          animation: 'fadeBreath 3s ease-in-out infinite',
        }}>
        </div>
      </section>

      {/* Ritual Steps */}
      <RevealSection style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeader label="The Rite" heading="Casting Steps" />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 1,
          background: 'rgba(var(--accent-glow), 0.15)',
          border: '1px solid rgba(var(--accent-glow), 0.15)',
        }}>
          {STEPS.map((s, i) => (
            <div
              key={i}
              style={{
                background: 'var(--void-1)',
                padding: '40px 28px',
                transition: 'background 0.4s',
                cursor: 'default',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--void-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--void-1)')}
            >
              <div className="h-display" style={{ fontSize: '2.5rem', color: 'var(--accent)', fontStyle: 'italic', marginBottom: 20, opacity: 0.9 }}>
                {s.roman}
              </div>
              <div className="h-ui" style={{ marginBottom: 12 }}>{s.title}</div>
              <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cream)', opacity: 0.75, lineHeight: 1.5 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Features */}
      <RevealSection style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeader label="The scriptures" heading="What the tome knows" />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 1,
          background: 'rgba(var(--accent-glow), 0.15)',
          border: '1px solid rgba(var(--accent-glow), 0.15)',
        }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                background: 'var(--void-1)',
                padding: '40px 28px',
                transition: 'background 0.4s',
                cursor: 'default',
                height: '100%',
                boxSizing: 'border-box',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--void-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--void-1)')}
            >
              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                {f.pips
                  ? f.pips.map(p => <ManaSymbol key={p} symbol={p} size={22} />)
                  : <span style={{ fontSize: '2rem', color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{f.icon}</span>}
              </div>
              <div className="h-ui" style={{ marginBottom: 12 }}>{f.title}</div>
              <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cream)', opacity: 0.75, lineHeight: 1.5 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* INCANTATIONS */}
      <RevealSection style={{ padding: '80px 0', overflow: 'hidden' }}>
        <SectionHeader
          label="Sample Incantations"
          heading="Others have whispered…"
          ornamentWidth={280}
          headingFontSize="clamp(1.8rem, 3.5vw, 2.5rem)"
          style={{ padding: '0 24px', marginBottom: 48 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 120, background: 'linear-gradient(to right, var(--void-0), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 120, background: 'linear-gradient(to left, var(--void-0), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          {[
            { items: [...COMMENTS.slice(0, 6), ...COMMENTS.slice(0, 6)], animation: 'marquee 120s linear infinite' },
            { items: [...COMMENTS.slice(6), ...COMMENTS.slice(6)], animation: 'marquee-reverse 120s linear infinite' },
          ].map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 16, animation: row.animation, width: 'max-content' }}>
              {row.items.map((inc, i) => (
                <div key={i} style={{
                  padding: '14px 22px',
                  border: '1px solid rgba(var(--accent-glow), 0.2)',
                  background: 'var(--void-1)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.05rem',
                  fontStyle: 'italic',
                  color: 'var(--cream)',
                  whiteSpace: 'normal',
                  width: 400,
                  flexShrink: 0,
                  opacity: 0.85,
                }}>
                  <span style={{ color: 'var(--accent)', marginRight: 10 }}>❝</span>
                  {inc}
                  <span style={{ color: 'var(--accent)', marginLeft: 10 }}>❞</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Final CTA */}
      <RevealSection style={{ padding: '120px 24px', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.3, pointerEvents: 'none' }}>
          <ArcaneSigil size={500} intensity={0.5} />
        </div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 className="h-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: '0 0 16px', fontStyle: 'italic' }}>
            <span style={gradientText}>The tome awaits.</span>
          </h2>
          <button className="btn btn-primary" onClick={enterGrimoire} style={{ fontSize: '0.9rem', padding: '18px 40px' }}>
            Ask the Grimoire
          </button>
        </div>
      </RevealSection>
    </div>
  );
}
