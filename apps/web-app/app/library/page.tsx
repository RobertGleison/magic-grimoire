'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import { ManaSymbol } from '../components/ManaSymbol';

const COLOR_MAP: Record<string, string> = {
  W: '#f0ead8', U: '#1460a8', B: '#3a2818', R: '#c81808', G: '#0f6030',
};

const SAVED_DECKS = [
  { id: 'verdant-swarm', name: 'The Verdant Swarm', archetype: 'Mono-Green Elf Tribal', format: 'Modern', colors: ['G'], savedOn: 'IV · iii · MMXXVI', prompt: 'mono-green elf tribal for Modern, aggressive' },
  { id: 'azorius-teferi', name: 'Silent Veto', archetype: 'Azorius Control', format: 'Modern', colors: ['W', 'U'], savedOn: 'IV · ii · MMXXVI', prompt: 'Azorius control for Modern with Teferi' },
  { id: 'gruul-werewolves', name: 'Moonlight Howl', archetype: 'Gruul Werewolves', format: 'Pioneer', colors: ['R', 'G'], savedOn: 'III · xxvii · MMXXVI', prompt: 'Gruul werewolves tribal, Pioneer' },
  { id: 'dimir-mill', name: 'Drowned Library', archetype: 'Dimir Mill', format: 'Commander', colors: ['U', 'B'], savedOn: 'III · xix · MMXXVI', prompt: 'Dimir mill, Commander legal' },
  { id: 'boros-tokens', name: 'Gathered Ranks', archetype: 'Boros Tokens', format: 'Pioneer', colors: ['R', 'W'], savedOn: 'III · xi · MMXXVI', prompt: 'Boros tokens with anthem effects, aggressive' },
  { id: 'sultai-reanimator', name: 'The Returning', archetype: 'Sultai Reanimator', format: 'Modern', colors: ['U', 'B', 'G'], savedOn: 'II · xxviii · MMXXVI', prompt: 'Sultai reanimator with Bloodghast recursion' },
];

function DeckTile({ deck, onClick }: { deck: typeof SAVED_DECKS[0]; onClick: () => void }) {
  const colors = deck.colors.map(c => COLOR_MAP[c] || '#8a6f2e');
  const grad = colors.length === 1
    ? `radial-gradient(circle at 30% 30%, ${colors[0]}55, var(--void-1) 70%)`
    : `linear-gradient(135deg, ${colors.map((c, i) => `${c}55 ${(i / (colors.length - 1)) * 100}%`).join(', ')})`;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        cursor: 'pointer',
        background: 'linear-gradient(180deg, var(--void-2), var(--void-1))',
        border: '1px solid rgba(var(--accent-glow), 0.2)',
        overflow: 'hidden',
        transition: 'all 0.3s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.borderColor = 'rgba(var(--accent-glow), 0.5)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(var(--accent-glow), 0.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'rgba(var(--accent-glow), 0.2)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ height: 100, background: grad, position: 'relative', borderBottom: '1px solid rgba(var(--accent-glow), 0.25)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, transparent 0 12px, rgba(0,0,0,0.15) 12px 24px)' }} />
        <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', gap: 4 }}>
          {deck.colors.map(c => <ManaSymbol key={c} symbol={c} size={20} />)}
        </div>
        <div style={{ position: 'absolute', bottom: 10, right: 14, fontFamily: 'var(--font-ui)', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--cream)', opacity: 0.75, background: 'rgba(0,0,0,0.4)', padding: '3px 8px' }}>
          {deck.format}
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        <h3 className="h-display" style={{ fontSize: '1.2rem', margin: '0 0 4px', fontStyle: 'italic', color: 'var(--cream)' }}>{deck.name}</h3>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--cream)', opacity: 0.7, fontStyle: 'italic', marginBottom: 14 }}>
          {deck.archetype}
        </div>
        <div style={{ paddingTop: 12, borderTop: '1px dotted rgba(var(--accent-glow), 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="h-ui" style={{ fontSize: '0.55rem', opacity: 0.5 }}>{deck.savedOn}</span>
          <span style={{ color: 'var(--accent)', fontSize: '0.85rem', fontFamily: 'var(--font-display)' }}>→</span>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const { user, setUser } = useUser();

  useEffect(() => {
    if (!user) router.replace('/');
  }, [user, router]);

  if (!user) return null;

  const handleOpenDeck = (deck: typeof SAVED_DECKS[0]) => {
    router.push(`/grimoire?prompt=${encodeURIComponent(deck.prompt)}`);
  };

  const handleLogout = () => {
    setUser(null);
    router.push('/');
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 32px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, borderBottom: '1px solid rgba(var(--accent-glow), 0.15)', paddingBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="h-ui" style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 8 }}>
            Tome of {user.name} · Chapter II
          </div>
          <h1 className="h-display" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', margin: 0, fontStyle: 'italic' }}>
            Thy Divined Decks
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.05rem', fontStyle: 'italic', color: 'var(--cream)', opacity: 0.7, margin: '8px 0 0' }}>
            {SAVED_DECKS.length} decks bound to thy grimoire.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={handleLogout} style={{ fontSize: '0.7rem' }}>Depart</button>
          <button className="btn btn-primary" onClick={() => router.push('/grimoire')} style={{ fontSize: '0.75rem' }}>
            ✦ New Incantation
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
        {SAVED_DECKS.map(d => (
          <DeckTile key={d.id} deck={d} onClick={() => handleOpenDeck(d)} />
        ))}
      </div>
    </div>
  );
}
