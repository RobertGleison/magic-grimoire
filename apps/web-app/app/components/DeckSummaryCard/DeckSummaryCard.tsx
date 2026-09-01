'use client';

import type { DeckResponse, DeckStatus } from '../../types/api';
import { MTG_COLORS } from '../../types/api';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { Card } from '../Card/Card';
import { ManaSymbol } from '../ManaSymbol/ManaSymbol';
import './DeckSummaryCard.css';

/* ==========================================================================
   DeckSummaryCard
   --------------------------------------------------------------------------
   Design: `mtg-card-frame` on my-decks (node `9:53`, 384x402). Distinct from
   `CardTile` (`16:38`, 80x112) — that one renders a single card inside a deck,
   this one renders a whole saved deck.

   The design's stat block (`9:64`) shows "Synergy Match 94%" and
   "Win Rate 64.2%". NEITHER FIELD EXISTS. `DeckResponse` carries only
   id/title/prompt/format/colors/cards/card_count/status/error_message and the
   three timestamps — there is no analytics anywhere in the backend. Inventing
   numbers there would be shipping a lie, so the two rows are replaced with
   real fields (status, and the completed/failed timestamp) and the design's
   third row, "Synthesized", is kept because `created_at` genuinely backs it.
   ========================================================================== */

/** The design's copy for each `DeckStatus`, in its own vocabulary. */
const STATUS_LABELS: Record<DeckStatus, string> = {
  pending: 'Queued',
  processing: 'Conjuring',
  completed: 'Ready',
  failed: 'Fizzled',
};

const VALID_COLORS: ReadonlySet<string> = new Set(MTG_COLORS);

/** Largest-first so the first unit that fits is the one a human would say. */
const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/**
 * `"2 hours ago"` from an ISO-8601 timestamp, the design's `9:73` format.
 *
 * `now` is injectable so the output is deterministic under test. Returns
 * `null` — never a guess — for a missing or unparseable timestamp, so the
 * caller can render a dash instead of a wrong time.
 */
export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;

  const delta = parsed - now;
  const magnitude = Math.abs(delta);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (magnitude >= ms) return format.format(Math.round(delta / ms), unit);
  }
  return format.format(Math.round(delta / 1000), 'second');
}

/**
 * What to print in the card's heading. `title` is nullable on the wire and is
 * only filled in once generation succeeds, so a pending deck falls back to the
 * prompt the user actually typed rather than to a placeholder.
 */
export function deckTitle(deck: DeckResponse): string {
  return deck.title?.trim() || deck.prompt.trim() || 'Untitled grimoire';
}

/** Colour identity, de-duplicated and forced into WUBRG order. */
export function deckColors(deck: DeckResponse): string[] {
  const present = new Set((deck.colors ?? []).map((color) => color.trim().toUpperCase()));
  return MTG_COLORS.filter((color) => present.has(color));
}

/**
 * The deck's cover art: the first card that actually came back with one.
 * `cards` is populated on `GET /decks` (the route returns the full
 * `DeckResponseDTO`), but it is null until the pipeline finishes.
 */
function coverArt(deck: DeckResponse): string | null {
  return deck.cards?.find((card) => card.image_uri)?.image_uri ?? null;
}

function unknownColorCount(deck: DeckResponse): number {
  return (deck.colors ?? []).filter((color) => !VALID_COLORS.has(color.trim().toUpperCase())).length;
}

interface DeckSummaryCardProps {
  deck: DeckResponse;
  /**
   * Where the "Edit" action points. There is no deck-detail route in this app,
   * so the default is the deck builder carrying the deck id as a query param.
   */
  editHref?: string;
  /** Omit to render the card read-only — the destructive action disappears. */
  onDelete?: (deck: DeckResponse) => void;
  /** Blocks this card's actions while a mutation for it is in flight. */
  busy?: boolean;
  /** `Date.now()` override, so relative timestamps are deterministic in tests. */
  now?: number;
  className?: string;
}

export function DeckSummaryCard({
  deck,
  editHref,
  onDelete,
  busy = false,
  now,
  className = '',
}: DeckSummaryCardProps) {
  const title = deckTitle(deck);
  const colors = deckColors(deck);
  const colorless = colors.length === 0;
  const art = coverArt(deck);
  const isReady = deck.status === 'completed';
  const inFlight = deck.status === 'pending' || deck.status === 'processing';

  const synthesized = formatRelativeTime(deck.created_at, now);
  // Not 'Fizzled' — that is the status badge's word; repeating it here reads
  // as a duplicate rather than as a timestamp label.
  const settledLabel = deck.status === 'failed' ? 'Failed' : 'Completed';
  const settled = formatRelativeTime(
    deck.status === 'failed' ? deck.failed_at : deck.completed_at,
    now,
  );

  const href = editHref ?? `/deck-builder?deck=${encodeURIComponent(deck.id)}`;

  return (
    <Card
      as="article"
      variant="panel"
      border="accent"
      radius="lg"
      padding="none"
      elevation={1}
      className={`deck-summary ${className}`.trim()}
      aria-busy={busy || undefined}
    >
      <header className="deck-summary-head">
        <h3 className="deck-summary-title" title={deck.prompt}>
          {title}
        </h3>
        <span className="deck-summary-pips">
          {colorless ? (
            <span className="deck-summary-colorless">Colourless</span>
          ) : (
            colors.map((color) => (
              <ManaSymbol key={color} symbol={color} size={8} className="deck-summary-pip" />
            ))
          )}
          {unknownColorCount(deck) > 0 ? (
            <span className="visually-hidden">
              {`plus ${unknownColorCount(deck)} unrecognised colour value`}
            </span>
          ) : null}
        </span>
      </header>

      <div className={`deck-summary-art${inFlight ? ' deck-summary-art-working' : ''}`}>
        {art ? (
          /* Scryfall art is remote and next.config.ts has no `images` block
             yet (Wave 4b left that open), so this matches CardTile's plain
             <img>. */
          // eslint-disable-next-line @next/next/no-img-element
          <img className="deck-summary-art-img" src={art} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="deck-summary-art-fallback" aria-hidden="true">
            ◈
          </span>
        )}
      </div>

      <div className="deck-summary-strip">
        <Badge variant="crimson" size="sm">
          {deck.format}
        </Badge>
        <span className="deck-summary-count">
          {deck.card_count} {deck.card_count === 1 ? 'Spell' : 'Spells'}
        </span>
      </div>

      <dl className="deck-summary-stats">
        <div className="deck-summary-stat">
          <dt className="deck-summary-stat-label">Status</dt>
          <dd className="deck-summary-stat-value">
            <Badge variant={deck.status} size="sm">
              {STATUS_LABELS[deck.status]}
            </Badge>
          </dd>
        </div>
        <div className="deck-summary-stat">
          <dt className="deck-summary-stat-label">Synthesized</dt>
          <dd className="deck-summary-stat-value">{synthesized ?? '—'}</dd>
        </div>
        <div className="deck-summary-stat deck-summary-stat-quiet">
          <dt className="deck-summary-stat-label">{settledLabel}</dt>
          <dd className="deck-summary-stat-value">{settled ?? '—'}</dd>
        </div>
      </dl>

      {deck.error_message ? (
        <p className="deck-summary-error">{deck.error_message}</p>
      ) : null}

      <footer className="deck-summary-actions">
        <Button
          href={isReady ? href : undefined}
          variant="secondary"
          size="xs"
          disabled={!isReady || busy}
        >
          Edit
        </Button>
        {onDelete ? (
          <Button
            variant="danger"
            size="xs"
            disabled={busy}
            onClick={() => onDelete(deck)}
            aria-label={`Dissolve ${title}`}
          >
            Dissolve
          </Button>
        ) : null}
      </footer>
    </Card>
  );
}
