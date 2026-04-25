'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import { ManaSymbol } from '../components/ManaSymbol';
import DeckPanel, { CardEntry } from '../components/DeckPanel';

interface SavedDeck {
  id: string;
  name: string;
  archetype: string;
  format: string;
  colors: string[];
  savedOn: string;
  prompt: string;
  cards: CardEntry[];
}

const SAVED_DECKS: SavedDeck[] = [
  {
    id: 'verdant-swarm', name: 'The Verdant Swarm', archetype: 'Mono-Green Elf Tribal',
    format: 'Modern', colors: ['G'], savedOn: 'IV · iii · MMXXVI',
    prompt: 'mono-green elf tribal for Modern, aggressive',
    cards: [
      { name: 'Llanowar Elves', quantity: 4, mana_cost: '{G}', type_line: 'Creature — Elf Druid' },
      { name: 'Elvish Mystic', quantity: 4, mana_cost: '{G}', type_line: 'Creature — Elf Druid' },
      { name: 'Elvish Clancaller', quantity: 4, mana_cost: '{G}{G}', type_line: 'Creature — Elf' },
      { name: 'Elvish Archdruid', quantity: 4, mana_cost: '{1}{G}{G}', type_line: 'Creature — Elf Druid' },
      { name: 'Imperious Perfect', quantity: 4, mana_cost: '{2}{G}', type_line: 'Creature — Elf Warrior' },
      { name: 'Ezuri, Renegade Leader', quantity: 4, mana_cost: '{1}{G}{G}', type_line: 'Creature — Elf Warrior' },
      { name: 'Collected Company', quantity: 4, mana_cost: '{3}{G}', type_line: 'Instant' },
      { name: 'Chord of Calling', quantity: 4, mana_cost: '{X}{G}{G}{G}', type_line: 'Instant' },
      { name: 'Harmonize', quantity: 4, mana_cost: '{2}{G}{G}', type_line: 'Sorcery' },
      { name: 'Nykthos, Shrine to Nyx', quantity: 4, mana_cost: '', type_line: 'Land' },
      { name: 'Forest', quantity: 20, mana_cost: '', type_line: 'Basic Land — Forest' },
    ],
  },
  {
    id: 'azorius-teferi', name: 'Silent Veto', archetype: 'Azorius Control',
    format: 'Modern', colors: ['W', 'U'], savedOn: 'IV · ii · MMXXVI',
    prompt: 'Azorius control for Modern with Teferi',
    cards: [
      { name: 'Teferi, Hero of Dominaria', quantity: 3, mana_cost: '{3}{W}{U}', type_line: 'Planeswalker — Teferi' },
      { name: 'Counterspell', quantity: 4, mana_cost: '{U}{U}', type_line: 'Instant' },
      { name: 'Wrath of God', quantity: 3, mana_cost: '{2}{W}{W}', type_line: 'Sorcery' },
      { name: 'Snapcaster Mage', quantity: 4, mana_cost: '{1}{U}', type_line: 'Creature — Human Wizard' },
      { name: 'Absorb', quantity: 4, mana_cost: '{W}{U}{U}', type_line: 'Instant' },
      { name: 'Opt', quantity: 4, mana_cost: '{U}', type_line: 'Instant' },
      { name: 'Search for Azcanta', quantity: 2, mana_cost: '{1}{U}', type_line: 'Enchantment' },
      { name: 'Hallowed Fountain', quantity: 4, mana_cost: '', type_line: 'Land' },
      { name: 'Island', quantity: 14, mana_cost: '', type_line: 'Basic Land — Island' },
      { name: 'Plains', quantity: 10, mana_cost: '', type_line: 'Basic Land — Plains' },
    ],
  },
  {
    id: 'gruul-werewolves', name: 'Moonlight Howl', archetype: 'Gruul Werewolves',
    format: 'Pioneer', colors: ['R', 'G'], savedOn: 'III · xxvii · MMXXVI',
    prompt: 'Gruul werewolves tribal, Pioneer',
    cards: [
      { name: 'Werewolf Pack Leader', quantity: 4, mana_cost: '{1}{G}', type_line: 'Creature — Human Werewolf' },
      { name: 'Tovolar, Dire Overlord', quantity: 3, mana_cost: '{1}{R}{G}', type_line: 'Legendary Creature — Human Werewolf' },
      { name: 'Kessig Wolf Run', quantity: 2, mana_cost: '', type_line: 'Land' },
      { name: 'Lightning Bolt', quantity: 4, mana_cost: '{R}', type_line: 'Instant' },
      { name: 'Moonmist', quantity: 4, mana_cost: '{1}{G}', type_line: 'Instant' },
      { name: 'Mayor of Avabruck', quantity: 4, mana_cost: '{1}{G}', type_line: 'Creature — Human Advisor Werewolf' },
      { name: 'Stomping Ground', quantity: 4, mana_cost: '', type_line: 'Land' },
      { name: 'Forest', quantity: 10, mana_cost: '', type_line: 'Basic Land — Forest' },
      { name: 'Mountain', quantity: 10, mana_cost: '', type_line: 'Basic Land — Mountain' },
    ],
  },
  {
    id: 'dimir-mill', name: 'Drowned Library', archetype: 'Dimir Mill',
    format: 'Commander', colors: ['U', 'B'], savedOn: 'III · xix · MMXXVI',
    prompt: 'Dimir mill, Commander legal',
    cards: [
      { name: 'Maddening Cacophony', quantity: 1, mana_cost: '{1}{U}', type_line: 'Sorcery' },
      { name: 'Archive Trap', quantity: 1, mana_cost: '{3}{U}{U}', type_line: 'Instant — Trap' },
      { name: 'Millstone', quantity: 1, mana_cost: '{2}', type_line: 'Artifact' },
      { name: 'Phenax, God of Deception', quantity: 1, mana_cost: '{3}{U}{B}', type_line: 'Legendary Enchantment Creature — God' },
      { name: 'Ruin Crab', quantity: 1, mana_cost: '{U}', type_line: 'Creature — Crab' },
      { name: 'Traumatize', quantity: 1, mana_cost: '{3}{U}{U}', type_line: 'Sorcery' },
      { name: 'Watery Grave', quantity: 1, mana_cost: '', type_line: 'Land' },
      { name: 'Island', quantity: 30, mana_cost: '', type_line: 'Basic Land — Island' },
      { name: 'Swamp', quantity: 20, mana_cost: '', type_line: 'Basic Land — Swamp' },
    ],
  },
  {
    id: 'boros-tokens', name: 'Gathered Ranks', archetype: 'Boros Tokens',
    format: 'Pioneer', colors: ['R', 'W'], savedOn: 'III · xi · MMXXVI',
    prompt: 'Boros tokens with anthem effects, aggressive',
    cards: [
      { name: 'Monastery Mentor', quantity: 3, mana_cost: '{2}{W}', type_line: 'Creature — Human Monk' },
      { name: 'Raise the Alarm', quantity: 4, mana_cost: '{1}{W}', type_line: 'Instant' },
      { name: 'Intangible Virtue', quantity: 4, mana_cost: '{1}{W}', type_line: 'Enchantment' },
      { name: 'Goblin Rabblemaster', quantity: 4, mana_cost: '{2}{R}', type_line: 'Creature — Goblin Warrior' },
      { name: 'Legion\'s Landing', quantity: 4, mana_cost: '{W}', type_line: 'Legendary Enchantment' },
      { name: 'Sacred Foundry', quantity: 4, mana_cost: '', type_line: 'Land' },
      { name: 'Plains', quantity: 12, mana_cost: '', type_line: 'Basic Land — Plains' },
      { name: 'Mountain', quantity: 10, mana_cost: '', type_line: 'Basic Land — Mountain' },
    ],
  },
  {
    id: 'sultai-reanimator', name: 'The Returning', archetype: 'Sultai Reanimator',
    format: 'Modern', colors: ['U', 'B', 'G'], savedOn: 'II · xxviii · MMXXVI',
    prompt: 'Sultai reanimator with Bloodghast recursion',
    cards: [
      { name: 'Bloodghast', quantity: 4, mana_cost: '{1}{B}', type_line: 'Creature — Vampire Spirit' },
      { name: 'Griselbrand', quantity: 2, mana_cost: '{4}{B}{B}{B}{B}', type_line: 'Legendary Creature — Demon' },
      { name: 'Animate Dead', quantity: 4, mana_cost: '{1}{B}', type_line: 'Enchantment — Aura' },
      { name: 'Faithless Looting', quantity: 4, mana_cost: '{R}', type_line: 'Sorcery' },
      { name: 'Satyr Wayfinder', quantity: 4, mana_cost: '{1}{G}', type_line: 'Creature — Satyr' },
      { name: 'Breakthrough', quantity: 4, mana_cost: '{U}', type_line: 'Sorcery' },
      { name: 'Watery Grave', quantity: 2, mana_cost: '', type_line: 'Land' },
      { name: 'Overgrown Tomb', quantity: 2, mana_cost: '', type_line: 'Land' },
      { name: 'Swamp', quantity: 14, mana_cost: '', type_line: 'Basic Land — Swamp' },
      { name: 'Island', quantity: 8, mana_cost: '', type_line: 'Basic Land — Island' },
      { name: 'Forest', quantity: 8, mana_cost: '', type_line: 'Basic Land — Forest' },
    ],
  },
];

type LibraryView = 'grid' | 'list';

function parseDeckTxt(txt: string, name: string): SavedDeck {
  const cards: CardEntry[] = [];
  for (const line of txt.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (match) cards.push({ name: match[2].trim(), quantity: parseInt(match[1], 10) });
  }
  return {
    id: `import-${Date.now()}`,
    name: name.trim() || 'Imported Deck',
    archetype: 'Imported',
    format: '—',
    colors: [],
    savedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    prompt: '',
    cards,
  };
}

function ImportModal({ onImport, onClose }: { onImport: (deck: SavedDeck) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [txt, setTxt] = useState('');
  const [error, setError] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!name) setName(file.name.replace(/\.txt$/i, ''));
    file.text().then(setTxt);
  };

  const handleImport = () => {
    const deck = parseDeckTxt(txt, name);
    if (!deck.cards.length) { setError('No valid card lines found. Format: "4 Card Name"'); return; }
    onImport(deck);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,10,0.85)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 500, background: 'linear-gradient(180deg, var(--void-2), var(--void-0))', border: '1px solid rgba(var(--accent-glow), 0.4)', padding: '32px 28px', boxShadow: '0 0 60px rgba(var(--accent-glow), 0.15)', animation: 'messageIn 0.3s ease' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.3rem' }}>×</button>
        <div className="h-ui" style={{ fontSize: '0.6rem', opacity: 0.6, marginBottom: 6 }}>Inscribe from without</div>
        <h2 className="h-display" style={{ fontSize: '1.5rem', margin: '0 0 24px', fontStyle: 'italic' }}>Import Deck</h2>

        <div style={{ marginBottom: 14 }}>
          <label className="h-ui" style={{ fontSize: '0.58rem', opacity: 0.65, display: 'block', marginBottom: 6 }}>Deck Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Deck"
            style={{ width: '100%', padding: '10px 12px', background: 'var(--void-0)', border: '1px solid rgba(var(--accent-glow), 0.2)', color: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="h-ui" style={{ fontSize: '0.58rem', opacity: 0.65, display: 'block', marginBottom: 6 }}>Decklist · one card per line <span style={{ opacity: 0.5 }}>(e.g. 4 Lightning Bolt)</span></label>
          <textarea
            value={txt}
            onChange={e => { setTxt(e.target.value); setError(''); }}
            placeholder={'4 Lightning Bolt\n4 Goblin Guide\n20 Mountain'}
            rows={10}
            style={{ width: '100%', padding: '10px 12px', background: 'var(--void-0)', border: '1px solid rgba(var(--accent-glow), 0.2)', color: 'var(--cream)', fontFamily: 'var(--font-ui)', fontSize: '0.82rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span className="h-ui" style={{ fontSize: '0.58rem', opacity: 0.5 }}>or</span>
          <label style={{ cursor: 'pointer' }}>
            <span className="btn" style={{ fontSize: '0.65rem', display: 'inline-block' }}>Upload .txt</span>
            <input type="file" accept=".txt" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </div>

        {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'rgba(220,100,100,0.9)', margin: '0 0 14px', fontStyle: 'italic' }}>{error}</p>}

        <button className="btn btn-primary" onClick={handleImport} style={{ width: '100%', fontSize: '0.72rem' }}>Import ✦</button>
      </div>
    </div>
  );
}

function DeckTile({ deck, onClick }: { deck: SavedDeck; onClick: () => void }) {
  const firstCard = deck.cards[0];
  const imgSrc = firstCard?.image_uri
    ?? `https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=${encodeURIComponent(firstCard?.name ?? '')}`;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative', cursor: 'pointer',
        background: 'linear-gradient(180deg, var(--void-2), var(--void-1))',
        border: '1px solid rgba(var(--accent-glow), 0.2)',
        overflow: 'hidden', transition: 'all 0.3s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(var(--accent-glow), 0.5)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(var(--accent-glow), 0.15)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(var(--accent-glow), 0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ height: 120, position: 'relative', borderBottom: '1px solid rgba(var(--accent-glow), 0.25)', overflow: 'hidden' }}>
        <img
          src={imgSrc}
          alt={firstCard?.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }} />
        <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 4 }}>
          {deck.colors.map(c => <ManaSymbol key={c} symbol={c} size={20} />)}
        </div>
        <div style={{ position: 'absolute', bottom: 8, right: 12, fontFamily: 'var(--font-ui)', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--cream)', opacity: 0.9, background: 'rgba(0,0,0,0.55)', padding: '3px 8px' }}>
          {deck.format}
        </div>
      </div>
      <div style={{ padding: '16px 18px' }}>
        <h3 className="h-display" style={{ fontSize: '1.2rem', margin: '0 0 4px', fontStyle: 'italic', color: 'var(--cream)' }}>{deck.name}</h3>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--cream)', opacity: 0.7, fontStyle: 'italic', marginBottom: 14 }}>{deck.archetype}</div>
        <div style={{ paddingTop: 12, borderTop: '1px dotted rgba(var(--accent-glow), 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="h-ui" style={{ fontSize: '0.55rem', opacity: 0.5 }}>{deck.savedOn}</span>
          <span style={{ color: 'var(--accent)', fontSize: '0.85rem', fontFamily: 'var(--font-display)' }}>→</span>
        </div>
      </div>
    </div>
  );
}

function DeckRow({ deck, onClick }: { deck: SavedDeck; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
        background: 'linear-gradient(90deg, var(--void-2), var(--void-1))',
        border: '1px solid rgba(var(--accent-glow), 0.15)',
        cursor: 'pointer', transition: 'all 0.2s', marginBottom: 4,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(var(--accent-glow), 0.4)'; e.currentTarget.style.background = 'linear-gradient(90deg, var(--void-3), var(--void-2))'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(var(--accent-glow), 0.15)'; e.currentTarget.style.background = 'linear-gradient(90deg, var(--void-2), var(--void-1))'; }}
    >
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {deck.colors.map(c => <ManaSymbol key={c} symbol={c} size={16} />)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: '1.05rem', fontStyle: 'italic', color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deck.name}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--cream)', opacity: 0.6, fontStyle: 'italic' }}>{deck.archetype}</div>
      </div>
      <div className="h-ui" style={{ fontSize: '0.58rem', color: 'var(--cream)', opacity: 0.45, flexShrink: 0 }}>{deck.format}</div>
      <div className="h-ui" style={{ fontSize: '0.55rem', color: 'var(--cream)', opacity: 0.4, flexShrink: 0, minWidth: 100, textAlign: 'right' }}>{deck.savedOn}</div>
      <span style={{ color: 'var(--accent)', fontSize: '0.85rem', fontFamily: 'var(--font-display)', flexShrink: 0 }}>→</span>
    </div>
  );
}

function viewToggleBtn(active: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(var(--accent-glow), 0.15)' : 'transparent',
    border: '1px solid ' + (active ? 'rgba(var(--accent-glow), 0.5)' : 'rgba(var(--accent-glow), 0.2)'),
    color: active ? 'var(--accent)' : 'var(--muted)',
    cursor: 'pointer', transition: 'all 0.2s',
  };
}

export default function LibraryPage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [view, setView] = useState<LibraryView>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importedDecks, setImportedDecks] = useState<SavedDeck[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [panelWidth, setPanelWidth] = useState(460);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    const onMove = (ev: MouseEvent) => setPanelWidth(Math.max(300, Math.min(800, startW + (startX - ev.clientX))));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    if (!user) router.replace('/');
  }, [user, router]);

  if (!user) return null;

  const allDecks = [...SAVED_DECKS, ...importedDecks];
  const selectedDeck = allDecks.find(d => d.id === selectedId) ?? null;

  const handleImport = (deck: SavedDeck) => {
    setImportedDecks(prev => [...prev, deck]);
    setShowImport(false);
    setSelectedId(deck.id);
  };

  const handleLogout = () => { setUser(null); router.push('/'); };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Main list/grid area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 32px 80px', minWidth: 0 }}>
        <div style={{ maxWidth: selectedDeck ? 900 : 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, borderBottom: '1px solid rgba(var(--accent-glow), 0.15)', paddingBottom: 20, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="h-ui" style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 8 }}>Tome of {user.name} · Chapter II</div>
              <h1 className="h-display" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', margin: 0, fontStyle: 'italic' }}>Thy Divined Decks</h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.05rem', fontStyle: 'italic', color: 'var(--cream)', opacity: 0.7, margin: '8px 0 0' }}>
                {allDecks.length} decks bound to thy grimoire.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* View toggle */}
              <div style={{ display: 'flex', gap: 4, marginRight: 6 }}>
                <button style={viewToggleBtn(view === 'grid')} onClick={() => setView('grid')} title="Grid">
                  <svg width="13" height="13" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="1" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="8" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="8" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                </button>
                <button style={viewToggleBtn(view === 'list')} onClick={() => setView('list')} title="List">
                  <svg width="13" height="13" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="1.5" fill="currentColor" /><rect x="1" y="6" width="12" height="1.5" fill="currentColor" /><rect x="1" y="10" width="12" height="1.5" fill="currentColor" /></svg>
                </button>
              </div>
              <button className="btn" onClick={handleLogout} style={{ fontSize: '0.7rem' }}>Log out</button>
              <button className="btn" onClick={() => setShowImport(true)} style={{ fontSize: '0.72rem' }}>Import .txt</button>
              <button className="btn btn-primary" onClick={() => router.push('/grimoire')} style={{ fontSize: '0.75rem' }}>Generate new deck</button>
            </div>
          </div>

          {/* Deck list */}
          {view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
              {allDecks.map(d => (
                <DeckTile key={d.id} deck={d} onClick={() => setSelectedId(selectedId === d.id ? null : d.id)} />
              ))}
            </div>
          ) : (
            <div>
              {allDecks.map(d => (
                <DeckRow key={d.id} deck={d} onClick={() => setSelectedId(selectedId === d.id ? null : d.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}

      {/* Detail panel */}
      {selectedDeck && (
        <div style={{
          width: panelWidth, flexShrink: 0, borderLeft: '1px solid rgba(var(--accent-glow), 0.2)',
          animation: 'panelIn 0.4s ease',
          position: 'relative',
        }}>
          {/* Resize handle */}
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 6,
              cursor: 'col-resize', zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--accent-glow), 0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ width: 2, height: 40, borderRadius: 1, background: 'rgba(var(--accent-glow), 0.35)' }} />
          </div>
          <button
            onClick={() => setSelectedId(null)}
            style={{
              position: 'absolute', top: 14, right: 14, zIndex: 10,
              background: 'transparent', border: 'none', color: 'var(--muted)',
              cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1,
            }}
          >×</button>
          <DeckPanel
            deck={{
              id: selectedDeck.id,
              title: selectedDeck.name,
              format: selectedDeck.format,
              colors: selectedDeck.colors,
              cards: selectedDeck.cards,
              card_count: selectedDeck.cards.reduce((s, c) => s + c.quantity, 0),
            }}
            isGuest={false}
            onRequestLogin={() => {}}
          />
        </div>
      )}
    </div>
  );
}
