'use client';

import { useMemo, useState } from 'react';

import { Badge } from '../components/Badge/Badge';
import { Button } from '../components/Button/Button';
import {
  CardHoverPreview,
  useCardHoverPreview,
  type CardHoverBindings,
} from '../components/CardHoverPreview/CardHoverPreview';
import { ManaCost } from '../components/ManaSymbol/ManaSymbol';
import { ManaCurve } from '../components/ManaCurve/ManaCurve';
import type { CardInDeck, DeckResponse, DeckStatus } from '../types/api';
import {
  MANA_COLOR_NAMES,
  deckColorDistribution,
  deckSummaryStats,
  groupDeckCards,
  quantityOf,
  type DeckCategory,
} from './deckLogic';
import styles from './page.module.css';

/* ==========================================================================
   DeckResultsPanel — Figma nodes `10:134` (header `10:135`, grid `16:4`,
   analytics `10:218`); light counterpart `20:665` for colour only.
   --------------------------------------------------------------------------
   Two design elements are NOT rendered, because no backend field feeds them
   and inventing numbers on a deck page would be a lie:

     • "SYNERGY RATIO: 94.8%" (`10:140`)  -> the deck's real `status` badge.
     • "64.2% Estimated Winrate" (`10:281`) -> the deck's real `prompt`.

   "Export PDF" (`16:186`) is also gone: rendering a PDF needs a dependency,
   and Wave 3 may not add one. Its slot is "Copy List".

   The grid no longer uses `CardTile` (the 80x112 mini-frame that reprints the
   name, type line and cost around a crop of the art). Inside a deck all three
   are already on the card face, so the tile spent its width restating it; the
   grid shows the Scryfall render itself instead, one tile per physical copy,
   and the aggregated x N reading stays in the list view where it belongs.
   ========================================================================== */

export type DeckView = 'grid' | 'list';

const STATUS_LABELS: Record<DeckStatus, string> = {
  pending: 'Queued',
  processing: 'Building',
  completed: 'Complete',
  failed: 'Failed',
};

/** Category -> the 3px rule colour of node `16:7`. */
const CATEGORY_RULE: Record<DeckCategory, string> = {
  creatures: styles.ruleCreature,
  spells: styles.ruleSpell,
  artifacts: styles.ruleSpell,
  planeswalkers: styles.ruleSpell,
  lands: styles.ruleLand,
  sideboard: styles.ruleSpell,
  other: styles.ruleSpell,
};

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M1.5 1.5h5v5h-5zM9.5 1.5h5v5h-5zM1.5 9.5h5v5h-5zM9.5 9.5h5v5h-5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M2 3.5h12M2 8h12M2 12.5h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* --------------------------------------------------------------- card tile */

/* MTG card proportions: 63 x 88 mm. */
const CARD_ASPECT = '63 / 88';

interface DeckCardProps {
  card: CardInDeck;
  /** From `useCardHoverPreview` — mounts the zoom on this tile. */
  hoverProps: CardHoverBindings;
}

/** One physical copy, as its full Scryfall render. */
function DeckCard({ card, hoverProps }: DeckCardProps) {
  const [artFailed, setArtFailed] = useState(false);

  return (
    <li className={styles.gridCard} style={{ aspectRatio: CARD_ASPECT }} {...hoverProps}>
      {card.image_uri && !artFailed ? (
        /* Remote Scryfall art; `next/image` would need a `remotePatterns`
           entry in next.config.ts. Same call as CardTile makes. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.gridCardImg}
          src={card.image_uri}
          alt={card.name}
          loading="lazy"
          decoding="async"
          onError={() => setArtFailed(true)}
        />
      ) : (
        /* No enriched render: keep the slot at card shape and name it, rather
           than leaving a hole in the grid. */
        <span className={styles.gridCardFallback}>
          <span className={styles.gridCardFallbackMark} aria-hidden="true">
            &#x25C8;
          </span>
          {card.name}
        </span>
      )}
    </li>
  );
}

/* ------------------------------------------------------------ colour ring */

const RING_SIZE = 90;
const RING_RADIUS = 35;
const RING_STROKE = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ColorRing({ deck }: { deck: DeckResponse }) {
  const slices = deckColorDistribution(deck.cards);

  if (slices.length === 0) {
    return <p className={styles.analyticsEmpty}>No spells to weigh yet.</p>;
  }

  let offset = 0;

  return (
    <div className={styles.ringRow}>
      <svg
        className={styles.ring}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        width={RING_SIZE}
        height={RING_SIZE}
        role="img"
        aria-label={slices
          .map((slice) => `${MANA_COLOR_NAMES[slice.color]} ${Math.round(slice.share * 100)}%`)
          .join(', ')}
      >
        {slices.map((slice) => {
          const dash = slice.share * RING_CIRCUMFERENCE;
          const node = (
            <circle
              key={slice.color}
              className={styles.ringArc}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              stroke={`var(--mana-${slice.color.toLowerCase()})`}
              strokeDasharray={`${dash} ${RING_CIRCUMFERENCE - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return node;
        })}
      </svg>

      <ul className={styles.ringLegend}>
        {slices.map((slice) => (
          <li key={slice.color} className={styles.ringLegendItem}>
            <span
              className={styles.ringSwatch}
              style={{ background: `var(--mana-${slice.color.toLowerCase()})` }}
              aria-hidden="true"
            />
            {MANA_COLOR_NAMES[slice.color]} ({Math.round(slice.share * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ panel */

interface DeckResultsPanelProps {
  deck: DeckResponse;
  /** Copies the plain-text decklist. */
  onCopyList: () => void;
  /** Downloads the plain-text decklist. */
  onExportText: () => void;
  /** Copies a permalink that reloads this deck. */
  onCopyLink: () => void;
  /** Transient confirmation for whichever action last ran. */
  actionNote?: string;
}

export function DeckResultsPanel({
  deck,
  onCopyList,
  onExportText,
  onCopyLink,
  actionNote = '',
}: DeckResultsPanelProps) {
  const [view, setView] = useState<DeckView>('grid');
  const { preview, hoverProps } = useCardHoverPreview();

  const sections = useMemo(() => groupDeckCards(deck.cards), [deck.cards]);
  const stats = useMemo(() => deckSummaryStats(deck.cards), [deck.cards]);
  const cards = deck.cards ?? [];

  return (
    <div className={styles.deckStack}>
      {/* ---- Header (10:135) ------------------------------------------ */}
      <header className={styles.deckHeader}>
        <div className={styles.deckHeadRow}>
          <div className={styles.deckTitleBlock}>
            <h2 className={styles.deckTitle}>{deck.title?.trim() || 'Untitled deck'}</h2>
            <p className={styles.deckSubtitle}>
              {deck.format} format &bull; {deck.card_count} cards compiled from live Scryfall data
            </p>
          </div>
          <Badge variant={deck.status} size="md">
            {STATUS_LABELS[deck.status]}
          </Badge>
        </div>

        <div className={styles.deckActions}>
          <Button variant="subtle" size="xs" className={styles.goldButton} onClick={onCopyList}>
            Copy List
          </Button>
          <Button variant="subtle" size="xs" className={styles.goldButton} onClick={onExportText}>
            Export TXT
          </Button>
          <Button variant="subtle" size="xs" className={styles.goldButton} onClick={onCopyLink}>
            Copy Link
          </Button>

          <div className={styles.viewToggle} role="group" aria-label="Deck layout">
            <button
              type="button"
              className={`${styles.viewButton} ${view === 'grid' ? styles.viewButtonOn : ''}`}
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
              onClick={() => setView('grid')}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              className={`${styles.viewButton} ${view === 'list' ? styles.viewButtonOn : ''}`}
              aria-pressed={view === 'list'}
              aria-label="List view"
              onClick={() => setView('list')}
            >
              <ListIcon />
            </button>
          </div>

          <p className={styles.actionNote} role="status" aria-live="polite">
            {actionNote}
          </p>
        </div>
      </header>

      {/* ---- Card grid (16:4) ------------------------------------------ */}
      <div className={styles.cardGridPanel}>
        {deck.status === 'failed' ? (
          <p className={styles.analyticsEmpty}>
            {deck.error_message?.trim() || 'The forge could not finish this deck.'}
          </p>
        ) : sections.length === 0 ? (
          <p className={styles.analyticsEmpty}>
            {deck.card_count > 0
              ? `The deck reports ${deck.card_count} cards but the list has not been written yet. It may still be enriching — reload in a moment.`
              : 'No cards in this deck yet.'}
          </p>
        ) : (
          sections.map((section) => (
            <section className={styles.deckSection} key={section.category}>
              <h3 className={styles.sectionHead}>
                <span
                  className={`${styles.sectionRule} ${CATEGORY_RULE[section.category]}`}
                  aria-hidden="true"
                />
                <span className={styles.sectionLabel}>
                  {section.label} &middot; {section.count}
                </span>
                <span className={styles.sectionHairline} aria-hidden="true" />
              </h3>

              {view === 'grid' ? (
                /* One tile per physical copy: four Lightning Bolts are four
                   cards on the table, so they are four cards here. */
                <ul className={styles.cardGrid}>
                  {section.cards.flatMap((card, index) =>
                    Array.from({ length: quantityOf(card) }, (_, copy) => (
                      <DeckCard
                        key={`${card.name}-${index}-${copy}`}
                        card={card}
                        hoverProps={hoverProps({ name: card.name, imageUri: card.image_uri })}
                      />
                    )),
                  )}
                </ul>
              ) : (
                <ul className={styles.cardList}>
                  {section.cards.map((card, index) => (
                    <li
                      className={styles.cardListRow}
                      key={`${card.name}-${index}`}
                      {...hoverProps({ name: card.name, imageUri: card.image_uri })}
                    >
                      <span className={styles.cardListQty}>&times;{card.quantity}</span>
                      <span className={styles.cardListName}>{card.name}</span>
                      <span className={styles.cardListType}>{card.type_line || '—'}</span>
                      <ManaCost cost={card.mana_cost} variant="pips" size={12} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>

      {/* ---- Analytics (10:218) ---------------------------------------- */}
      <section className={styles.analyticsPanel} aria-label="Deck analytics">
        <h3 className={styles.analyticsTitle}>Deck Analytics</h3>

        <div className={styles.analyticsCharts}>
          <div className={styles.analyticsChart}>
            <span className={styles.configLabel}>Mana Curve</span>
            <ManaCurve cards={cards} variant="bare" />
          </div>
          <div className={styles.analyticsChart}>
            <span className={styles.configLabel}>Color Distribution</span>
            <ColorRing deck={deck} />
          </div>
        </div>

        <dl className={styles.statTiles}>
          <div className={styles.statTile}>
            <dt className={styles.statLabel}>Average CMC</dt>
            <dd className={styles.statValue}>{stats.averageCmc.toFixed(2)}</dd>
          </div>
          <div className={styles.statTile}>
            <dt className={styles.statLabel}>Land Count</dt>
            <dd className={styles.statValue}>{stats.lands} Lands</dd>
          </div>
          <div className={styles.statTile}>
            <dt className={styles.statLabel}>Creatures</dt>
            <dd className={styles.statValue}>{stats.creatures} Spells</dd>
          </div>
          <div className={styles.statTile}>
            <dt className={styles.statLabel}>Non-Creature</dt>
            <dd className={styles.statValue}>{stats.nonCreature} Spells</dd>
          </div>
        </dl>

        <div className={styles.forecast}>
          <span className={styles.forecastLabel}>Original incantation</span>
          <p className={styles.forecastValue}>{deck.prompt}</p>
        </div>
      </section>

      <CardHoverPreview preview={preview} />
    </div>
  );
}
