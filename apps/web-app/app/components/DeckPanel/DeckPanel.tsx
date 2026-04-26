'use client';

import { useState } from 'react';
import { ManaSymbol, ManaCost } from '../ManaSymbol/ManaSymbol';

// ─── Card hover preview ───────────────────────────────────────────────────────

const PREVIEW_W = 200 * 1.5;
const PREVIEW_H = 279 * 1.5; // MTG card aspect ratio

function CardImageTooltip({ name, image_uri, pos }: {
  name: string;
  image_uri?: string;
  pos: { x: number; y: number };
}) {
  const src = image_uri
    ?? `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(name)}`;

  const left = pos.x + PREVIEW_W + 18 > window.innerWidth
    ? pos.x - PREVIEW_W - 14
    : pos.x + 14;
  const top = Math.max(8, Math.min(pos.y - PREVIEW_H / 2, window.innerHeight - PREVIEW_H - 8));

  return (
    <div style={{
      position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none',
      animation: 'messageIn 0.15s ease',
    }}>
      <img
        src={src}
        alt={name}
        width={PREVIEW_W}
        height={PREVIEW_H}
        style={{
          display: 'block',
          borderRadius: 11,
          objectFit: 'cover',
          boxShadow: '0 16px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)',
        }}
      />
    </div>
  );
}

export interface CardEntry {
  name: string;
  quantity: number;
  mana_cost?: string;
  type_line?: string;
  image_uri?: string;
}

export interface DeckData {
  id: string;
  title?: string;
  format: string;
  colors?: string[];
  cards?: CardEntry[];
  card_count?: number;
}

type DeckLayout = 'list' | 'grid';

interface CardGroup {
  label: string;
  count: number;
  cards: CardEntry[];
}

const TYPE_ORDER = ['Creatures', 'Instants', 'Sorceries', 'Planeswalkers', 'Enchantments', 'Artifacts', 'Lands', 'Other'];

function getCardCategory(typeLine = ''): string {
  const t = typeLine.toLowerCase();
  if (t.includes('land')) return 'Lands';
  if (t.includes('creature')) return 'Creatures';
  if (t.includes('planeswalker')) return 'Planeswalkers';
  if (t.includes('instant')) return 'Instants';
  if (t.includes('sorcery')) return 'Sorceries';
  if (t.includes('enchantment')) return 'Enchantments';
  if (t.includes('artifact')) return 'Artifacts';
  return 'Other';
}

function groupCards(cards: CardEntry[]): CardGroup[] {
  const hasTypes = cards.some(c => c.type_line);
  if (!hasTypes) {
    return [{
      label: 'Cards',
      count: cards.reduce((s, c) => s + c.quantity, 0),
      cards: [...cards],
    }];
  }
  const groups: Record<string, CardEntry[]> = {};
  for (const card of cards) {
    const cat = getCardCategory(card.type_line);
    (groups[cat] ??= []).push(card);
  }
  return TYPE_ORDER
    .filter(t => groups[t]?.length)
    .map(t => ({
      label: t,
      count: groups[t].reduce((s, c) => s + c.quantity, 0),
      cards: groups[t].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

function parseCmc(manaCost: string): number {
  let cmc = 0;
  for (const token of (manaCost.match(/\{[^}]+\}/g) ?? [])) {
    const inner = token.slice(1, -1);
    if (/^\d+$/.test(inner)) {
      cmc += parseInt(inner, 10);
    } else if (inner === 'X') {
      // X contributes 0
    } else if (inner.includes('/')) {
      const num = inner.split('/')[0];
      if (/^\d+$/.test(num)) cmc += parseInt(num, 10); // numeric hybrid e.g. {2/W}
      else cmc += 1;                                    // color/phyrexian hybrid e.g. {W/U}, {W/P}
    } else {
      cmc += 1;
    }
  }
  return cmc;
}

function computeStats(cards: CardEntry[]) {
  const byCat: Record<string, number> = {};
  for (const card of cards) {
    const cat = getCardCategory(card.type_line);
    byCat[cat] = (byCat[cat] ?? 0) + card.quantity;
  }

  const curve: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
  for (const card of cards) {
    if (getCardCategory(card.type_line) === 'Lands') continue;
    const cmc = parseCmc(card.mana_cost ?? '');
    if (cmc === 0) continue;
    const bucket = cmc >= 5 ? '5+' : String(cmc);
    curve[bucket] += card.quantity;
  }

  return {
    creatureCount: byCat['Creatures'] ?? 0,
    manaBase: byCat['Lands'] ?? 0,
    instantCount: byCat['Instants'] ?? 0,
    sorceryCount: byCat['Sorceries'] ?? 0,
    enchantmentCount: byCat['Enchantments'] ?? 0,
    artifactCount: byCat['Artifacts'] ?? 0,
    curve,
  };
}

function viewBtn(active: boolean): React.CSSProperties {
  return {
    width: 26, height: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(var(--accent-glow), 0.15)' : 'transparent',
    border: '1px solid ' + (active ? 'rgba(var(--accent-glow), 0.5)' : 'rgba(var(--accent-glow), 0.2)'),
    color: active ? 'var(--accent)' : 'var(--muted)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };
}

function CardRow({ card, isGuest }: { card: CardEntry; isGuest: boolean }) {
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 0',
          fontFamily: 'var(--font-body)',
          fontSize: '0.98rem',
          color: 'var(--cream)',
          borderBottom: '1px dotted rgba(var(--accent-glow), 0.08)',
          transition: 'background 0.2s, padding 0.2s',
          cursor: isGuest ? 'default' : 'pointer',
          opacity: isGuest ? 0.85 : 1,
        }}
        onMouseEnter={e => { setHoverPos({ x: e.clientX, y: e.clientY }); if (!isGuest) { e.currentTarget.style.background = 'rgba(var(--accent-glow), 0.06)'; e.currentTarget.style.paddingLeft = '8px'; } }}
        onMouseMove={e => setHoverPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={e => { setHoverPos(null); if (!isGuest) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '0'; } }}
      >
        <span style={{ width: 24, textAlign: 'right', color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontSize: '0.78rem', flexShrink: 0 }}>
          {card.quantity}×
        </span>
        <span style={{ flex: 1, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {card.name}
        </span>
        {card.mana_cost && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <ManaCost cost={card.mana_cost} size={13} />
          </span>
        )}
      </div>
      {hoverPos && <CardImageTooltip name={card.name} image_uri={card.image_uri} pos={hoverPos} />}
    </>
  );
}

function MiniCardTile({ card }: { card: CardEntry }) {
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const imgSrc = card.image_uri
    ?? `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(card.name)}`;

  return (
    <>
      <div
        style={{
          aspectRatio: '0.72 / 1',
          position: 'relative',
          border: '1px solid rgba(var(--accent-glow), 0.22)',
          cursor: 'default',
          transition: 'all 0.25s',
          overflow: 'hidden',
        }}
        onMouseEnter={e => { setHoverPos({ x: e.clientX, y: e.clientY }); e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(var(--accent-glow), 0.5)'; }}
        onMouseMove={e => setHoverPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={e => { setHoverPos(null); e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(var(--accent-glow), 0.22)'; }}
      >
        <img
          src={imgSrc}
          alt={card.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 6px 5px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.58rem', color: 'var(--accent)' }}>×{card.quantity}</span>
          {card.mana_cost && <ManaCost cost={card.mana_cost} size={10} />}
        </div>
      </div>
      {hoverPos && <CardImageTooltip name={card.name} image_uri={card.image_uri} pos={hoverPos} />}
    </>
  );
}

interface DeckPanelProps {
  deck: DeckData;
  isGuest: boolean;
  onRequestLogin: () => void;
}

function exportTxt(deck: DeckData) {
  const cards = deck.cards ?? [];
  const lines = cards.map(c => `${c.quantity} ${c.name}`);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(deck.title ?? 'deck').toLowerCase().replace(/\s+/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DeckPanel({ deck, isGuest, onRequestLogin }: DeckPanelProps) {
  const [layout, setLayout] = useState<DeckLayout>('list');
  const cards = deck.cards ?? [];
  const groups = groupCards(cards);
  const stats = computeStats(cards);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      background: 'linear-gradient(180deg, var(--void-0), var(--void-1))',
      position: 'relative',
      animation: 'panelIn 0.6s ease',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(var(--accent-glow), 0.2)', background: 'linear-gradient(180deg, var(--void-1), transparent)', flexShrink: 0 }}>
        <div className="h-ui" style={{ fontSize: '0.55rem', opacity: 0.6, marginBottom: 4 }}>
          ✦ Divined Decklist · {deck.format}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="h-display" style={{ fontSize: '1.5rem', margin: 0, fontStyle: 'italic', background: 'linear-gradient(180deg, var(--cream), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {deck.title ?? 'Arcane Deck'}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: '0.88rem', color: 'var(--cream)', opacity: 0.7 }}>
              <span style={{ fontStyle: 'italic' }}>{deck.format}</span>
              {deck.colors && deck.colors.length > 0 && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span style={{ display: 'flex', gap: 3 }}>
                    {deck.colors.map(c => <ManaSymbol key={c} symbol={c} size={14} />)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button onClick={() => setLayout('list')} style={viewBtn(layout === 'list')} title="List">
              <svg width="12" height="12" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="1.5" fill="currentColor" /><rect x="1" y="6" width="12" height="1.5" fill="currentColor" /><rect x="1" y="10" width="12" height="1.5" fill="currentColor" /></svg>
            </button>
            <button onClick={() => setLayout('grid')} style={viewBtn(layout === 'grid')} title="Grid">
              <svg width="12" height="12" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="1" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="8" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="8" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
          {[
            ['Total', deck.card_count ?? cards.reduce((s, c) => s + c.quantity, 0)],
            ['Creat.', stats.creatureCount],
            ['Instant', stats.instantCount],
            ['Sorcery', stats.sorceryCount],
            ['Enchant.', stats.enchantmentCount],
            ['Artifact', stats.artifactCount],
            ['Lands', stats.manaBase],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="h-ui" style={{ fontSize: '0.5rem', opacity: 0.55 }}>{label}</div>
              <div className="h-display" style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Mana curve */}
        {(() => {
          const buckets = ['1', '2', '3', '4', '5+'];
          const maxVal = Math.max(...buckets.map(b => stats.curve[b]), 1);
          return (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(var(--accent-glow), 0.1)' }}>
              <div className="h-ui" style={{ fontSize: '0.5rem', opacity: 0.55, marginBottom: 8 }}>Mana Curve</div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 52 }}>
                {buckets.map(b => {
                  const val = stats.curve[b];
                  const barH = Math.max(val > 0 ? 3 : 1, Math.round((val / maxVal) * 36));
                  return (
                    <div key={b} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                      {val > 0 && (
                        <div className="h-ui" style={{ fontSize: '0.44rem', color: 'var(--accent)', opacity: 0.9 }}>{val}</div>
                      )}
                      <div style={{
                        width: '100%',
                        height: barH,
                        background: val > 0
                          ? 'linear-gradient(to top, rgba(var(--accent-glow), 0.65), rgba(var(--accent-glow), 0.25))'
                          : 'rgba(var(--accent-glow), 0.07)',
                        borderTop: val > 0 ? '1px solid rgba(var(--accent-glow), 0.6)' : 'none',
                      }} />
                      <div className="h-ui" style={{ fontSize: '0.44rem', color: 'var(--muted)', opacity: 0.55 }}>{b}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        {groups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <h4 className="h-display" style={{ fontSize: '1.05rem', margin: 0, fontStyle: 'italic', color: 'var(--cream)' }}>{group.label}</h4>
              <span className="h-ui" style={{ fontSize: '0.62rem', color: 'var(--accent)' }}>· {group.count}</span>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(var(--accent-glow), 0.3), transparent)', alignSelf: 'center' }} />
            </div>

            {layout === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {group.cards.map((card, ci) => (
                  <CardRow key={ci} card={card} isGuest={isGuest} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {group.cards.flatMap((card, ci) =>
                  [...Array(Math.min(card.quantity, 4))].map((_, qi) => (
                    <MiniCardTile key={`${ci}-${qi}`} card={card} />
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(var(--accent-glow), 0.15)', background: 'linear-gradient(180deg, transparent, var(--void-0))', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        {isGuest ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--cream)', opacity: 0.75 }}>
            </div>
            <button className="btn btn-primary" onClick={onRequestLogin} style={{ fontSize: '0.68rem' }}>Save Deck</button>
          </div>
        ) : (
          <>
            <button className="btn btn-primary" style={{ fontSize: '0.65rem' }}>Save to Tome</button>
            <button className="btn" onClick={() => exportTxt(deck)} style={{ fontSize: '0.65rem' }}>Export .txt</button>
            <button className="btn" style={{ fontSize: '0.65rem' }}>Copy Arena</button>
          </>
        )}
      </div>
    </div>
  );
}
