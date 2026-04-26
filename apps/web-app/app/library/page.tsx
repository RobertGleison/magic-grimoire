'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import { ManaSymbol } from '../components/ManaSymbol/ManaSymbol';
import DeckPanel, { CardEntry } from '../components/DeckPanel/DeckPanel';
import s from './page.module.css';

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
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalBox} onClick={e => e.stopPropagation()}>
        <button className={s.modalClose} onClick={onClose}>×</button>
        <div className={`h-ui ${s.modalTagline}`}>Inscribe from without</div>
        <h2 className={`h-display ${s.modalTitle}`}>Import Deck</h2>

        <div className={s.modalField}>
          <label className={`h-ui ${s.modalLabel}`}>Deck Name</label>
          <input
            className={s.modalInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Deck"
          />
        </div>

        <div className={s.modalField}>
          <label className={`h-ui ${s.modalLabel}`}>
            Decklist · one card per line{' '}
            <span className={s.modalLabelHint}>(e.g. 4 Lightning Bolt)</span>
          </label>
          <textarea
            className={s.modalTextarea}
            value={txt}
            onChange={e => { setTxt(e.target.value); setError(''); }}
            placeholder={'4 Lightning Bolt\n4 Goblin Guide\n20 Mountain'}
            rows={10}
          />
        </div>

        <div className={s.modalUploadRow}>
          <span className={`h-ui ${s.modalOr}`}>or</span>
          <label style={{ cursor: 'pointer' }}>
            <span className="btn" style={{ fontSize: '0.65rem', display: 'inline-block' }}>Upload .txt</span>
            <input type="file" accept=".txt" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </div>

        {error && <p className={s.modalError}>{error}</p>}

        <button className={`btn btn-primary ${s.modalSubmit}`} onClick={handleImport}>Import ✦</button>
      </div>
    </div>
  );
}

function DeckTile({ deck, onClick }: { deck: SavedDeck; onClick: () => void }) {
  const firstCard = deck.cards[0];
  const imgSrc = firstCard?.image_uri
    ?? `https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=${encodeURIComponent(firstCard?.name ?? '')}`;

  return (
    <div className={s.tile} onClick={onClick}>
      <div className={s.tileImageWrapper}>
        <img className={s.tileImage} src={imgSrc} alt={firstCard?.name} />
        <div className={s.tileImageOverlay} />
        <div className={s.tileColors}>
          {deck.colors.map(c => <ManaSymbol key={c} symbol={c} size={20} />)}
        </div>
        <div className={s.tileFormat}>{deck.format}</div>
      </div>
      <div className={s.tileBody}>
        <h3 className={`h-display ${s.tileName}`}>{deck.name}</h3>
        <div className={s.tileArchetype}>{deck.archetype}</div>
        <div className={s.tileFooter}>
          <span className={`h-ui ${s.tileSavedOn}`}>{deck.savedOn}</span>
          <span className={s.tileArrow}>→</span>
        </div>
      </div>
    </div>
  );
}

function DeckRow({ deck, onClick }: { deck: SavedDeck; onClick: () => void }) {
  return (
    <div className={s.row} onClick={onClick}>
      <div className={s.rowColors}>
        {deck.colors.map(c => <ManaSymbol key={c} symbol={c} size={16} />)}
      </div>
      <div className={s.rowInfo}>
        <div className={`h-display ${s.rowName}`}>{deck.name}</div>
        <div className={s.rowArchetype}>{deck.archetype}</div>
      </div>
      <div className={`h-ui ${s.rowFormat}`}>{deck.format}</div>
      <div className={`h-ui ${s.rowSavedOn}`}>{deck.savedOn}</div>
      <span className={s.rowArrow}>→</span>
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [view, setView] = useState<LibraryView>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importedDecks, setImportedDecks] = useState<SavedDeck[]>([]);
  const [showImport, setShowImport] = useState(false);

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
    <div className={s.page}>
      {/* Main list/grid area */}
      <div className={s.mainArea}>
        <div className={s.mainInner}>

          {/* Header */}
          <div className={s.header}>
            <div>
              <div className={`h-ui ${s.headerTagline}`}>Tome of {user.name} · Chapter II</div>
              <h1 className={`h-display ${s.headerTitle}`}>Thy Divined Decks</h1>
              <p className={s.headerSubtitle}>{allDecks.length} decks bound to thy grimoire.</p>
            </div>
            <div className={s.headerActions}>
              <div className={s.viewToggle}>
                <button
                  className={`${s.toggleBtn} ${view === 'grid' ? s.toggleBtnActive : ''}`}
                  onClick={() => setView('grid')}
                  title="Grid"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="1" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="8" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="8" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                </button>
                <button
                  className={`${s.toggleBtn} ${view === 'list' ? s.toggleBtnActive : ''}`}
                  onClick={() => setView('list')}
                  title="List"
                >
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
            <div className={s.deckGrid}>
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

      {/* Fullscreen deck overlay */}
      {selectedDeck && (
        <div className={s.deckOverlay}>
          <button className={s.deckBackBtn} onClick={() => setSelectedId(null)}>← Back to Library</button>
          <DeckPanel
            deck={{
              id: selectedDeck.id,
              title: selectedDeck.name,
              format: selectedDeck.format,
              colors: selectedDeck.colors,
              cards: selectedDeck.cards,
              card_count: selectedDeck.cards.reduce((sum, c) => sum + c.quantity, 0),
            }}
            isGuest={false}
            onRequestLogin={() => {}}
          />
        </div>
      )}
    </div>
  );
}
