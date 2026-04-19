'use client';

import { useRouter } from 'next/navigation';
import { useUser } from './context/UserContext';
import { ArcaneSigil } from './components/ArcaneSigil';
import { ManaSymbol } from './components/ManaSymbol';
import { Ornament, Frame } from './components/atoms';
import { useReveal } from './hooks/useReveal';

const INCANTATIONS = [
  "Mono-red aggro for Pioneer, burn-heavy, cheap curve",
  "Azorius control for Modern, Teferi win condition",
  "Sultai reanimator with Bloodghast recursion",
  "Mono-green stompy with trample and pump",
  "Boros tokens with Anthem effects, aggressive",
  "Dimir mill, four-color if needed, Commander legal",
  "Simic flash creatures, Brazen Borrower package",
  "Jund midrange, discard + removal + threats",
  "Selesnya aura voltron, hexproof creatures",
  "Orzhov lifegain with token synergies",
  "Izzet spells matter, prowess + cantrips",
  "Gruul werewolves tribal, Modern legal",
];

function RevealSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="reveal" style={style}>
      {children}
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
          <div style={{ marginBottom: 32 }}>
            <Ornament style={{ justifyContent: 'center', maxWidth: 320, margin: '0 auto' }}>
              <span style={{ fontSize: '0.7rem' }}>Codex Arcanum · Vol. IV</span>
            </Ornament>
          </div>

          <h1 className="h-display" style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            lineHeight: 1.05,
            margin: '0 0 12px',
            textShadow: '0 0 40px rgba(var(--accent-glow), 0.3)',
          }}>
            Magic<br />
            <span style={{
              background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-mid) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontStyle: 'italic',
            }}>Grimoire</span>
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
            Whisper thine desire into the tome, and it shall render unto thee sixty cards of purest intent.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: 0.6 }}>
              {['W', 'U', 'B', 'R', 'G'].map(c => <ManaSymbol key={c} symbol={c} size={18} />)}
            </div>
            <button className="btn btn-primary" onClick={enterGrimoire} style={{ fontSize: '0.85rem', padding: '18px 44px' }}>
              Enter the Grimoire ✦
            </button>
            <div style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7 }}>
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
          ↓ scroll the tome
        </div>
      </section>

      {/* Ritual Steps */}
      <RevealSection style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <Ornament style={{ justifyContent: 'center', maxWidth: 220, margin: '0 auto 16px' }}>
            <span>The Rite</span>
          </Ornament>
          <h2 className="h-display" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: 0 }}>
            Four rites of summoning
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 1,
          background: 'rgba(var(--accent-glow), 0.15)',
          border: '1px solid rgba(var(--accent-glow), 0.15)',
        }}>
          {[
            { roman: 'I', title: 'Inscribe', body: 'Commit your vision to the page. Any archetype, any format. The oracle reads intent, not keywords.' },
            { roman: 'II', title: 'Divine', body: 'Seventeen thousand cards are weighed against your words. The tome selects those most befitting your will.' },
            { roman: 'III', title: 'Compose', body: 'Mana curves balanced. Synergies sought. Sideboards summoned. Sixty cards emerge in perfect order.' },
            { roman: 'IV', title: 'Inherit', body: 'Receive thy decklist, annotated and export-ready. Carry it forth into duel, tournament, or kitchen-table glory.' },
          ].map((s, i) => (
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
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <Ornament style={{ justifyContent: 'center', maxWidth: 220, margin: '0 auto 16px' }}>
            <span>Virtues</span>
          </Ornament>
          <h2 className="h-display" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: 0 }}>
            What the tome knows
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[
            { title: 'Five Colors of Magic', body: 'Every color pie, every guild, every shard. The tome knows the soul of each.', pips: ['W', 'U', 'B', 'R', 'G'] as const },
            { title: 'All Formats Honored', body: 'Standard, Modern, Pioneer, Legacy, Vintage, Commander, Pauper. Budget or boundless.', icon: '⟡' },
            { title: 'Curated Synergies', body: 'Not a list of cards — a plan. Mana curves, ratios, and interactions chosen with intent.', icon: '✦' },
            { title: 'Annotated Reasoning', body: 'Each inclusion justified. Each ratio defended. Argue with the oracle, refine the result.', icon: '❖' },
          ].map((f, i) => (
            <Frame key={i} ornate style={{ minHeight: 220 }}>
              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                {f.pips
                  ? f.pips.map(p => <ManaSymbol key={p} symbol={p} size={22} />)
                  : <span style={{ fontSize: '2rem', color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{f.icon}</span>}
              </div>
              <h3 className="h-display" style={{ fontSize: '1.35rem', margin: '0 0 10px' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: '1rem', color: 'var(--cream)', opacity: 0.75 }}>{f.body}</p>
            </Frame>
          ))}
        </div>
      </RevealSection>

      {/* Marquee */}
      <RevealSection style={{ padding: '80px 0', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: 48, padding: '0 24px' }}>
          <Ornament style={{ justifyContent: 'center', maxWidth: 280, margin: '0 auto 16px' }}>
            <span>Sample Incantations</span>
          </Ornament>
          <h2 className="h-display" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', margin: 0 }}>
            Others have whispered…
          </h2>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 120, background: 'linear-gradient(to right, var(--void-0), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 120, background: 'linear-gradient(to left, var(--void-0), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', gap: 16, animation: 'marquee 80s linear infinite', width: 'max-content' }}>
            {[...INCANTATIONS, ...INCANTATIONS].map((inc, i) => (
              <div key={i} style={{
                padding: '14px 22px',
                border: '1px solid rgba(var(--accent-glow), 0.2)',
                background: 'var(--void-1)',
                fontFamily: 'var(--font-body)',
                fontSize: '1.05rem',
                fontStyle: 'italic',
                color: 'var(--cream)',
                whiteSpace: 'nowrap',
                opacity: 0.85,
              }}>
                <span style={{ color: 'var(--accent)', marginRight: 10 }}>❝</span>
                {inc}
                <span style={{ color: 'var(--accent)', marginLeft: 10 }}>❞</span>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Final CTA */}
      <RevealSection style={{ padding: '120px 24px', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.3, pointerEvents: 'none' }}>
          <ArcaneSigil size={500} intensity={0.5} />
        </div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 className="h-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: '0 0 16px', fontStyle: 'italic' }}>
            <span style={{ background: 'linear-gradient(180deg, var(--accent), var(--accent-mid))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              The tome awaits.
            </span>
          </h2>
          <p style={{ color: 'var(--cream)', opacity: 0.7, fontSize: '1.15rem', margin: '0 0 36px', fontStyle: 'italic' }}>
            No account. No incense. Just intent.
          </p>
          <button className="btn btn-primary" onClick={enterGrimoire} style={{ fontSize: '0.9rem', padding: '18px 40px' }}>
            Enter the Grimoire ✦
          </button>
        </div>
      </RevealSection>
    </div>
  );
}
