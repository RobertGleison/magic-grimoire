'use client';

import Link from 'next/link';

import type { DeckResponse, DeckStatus } from '../../types/api';
import { MTG_COLORS } from '../../types/api';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { Card } from '../Card/Card';
import { ManaSymbol } from '../ManaSymbol/ManaSymbol';
import { VisibilityToggle } from '../VisibilityToggle/VisibilityToggle';
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
  cancelled: 'Dispelled',
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

const SCRYFALL_CDN = 'https://cards.scryfall.io/';

/**
 * Scryfall serves every size of a printing under one path that differs only
 * in the size segment, so a stored `normal` URL yields its `art_crop` sibling.
 * Returns `null` for anything that is not a Scryfall `normal` image.
 */
export function artCropFromNormal(imageUri: string | null | undefined): string | null {
  if (!imageUri?.startsWith(`${SCRYFALL_CDN}normal/`)) return null;
  return `${SCRYFALL_CDN}art_crop/${imageUri.slice(`${SCRYFALL_CDN}normal/`.length)}`;
}

export interface CoverArt {
  src: string;
  /**
   * `art` is the artwork alone and may fill the plate. `card` is a full card
   * face — cropping it to fill shows frame and rules text, so it is letterboxed.
   */
  kind: 'art' | 'card';
}

/**
 * The deck's cover: the first card that came back with any image, shown as
 * its art crop when one is stored or derivable, else as the whole card face.
 * `cards` is null until the pipeline finishes.
 */
export function coverArt(deck: DeckResponse): CoverArt | null {
  const card = deck.cards?.find((entry) => entry.art_crop_uri || entry.image_uri);
  if (!card) return null;
  const art = card.art_crop_uri || artCropFromNormal(card.image_uri);
  if (art) return { src: art, kind: 'art' };
  return card.image_uri ? { src: card.image_uri, kind: 'card' } : null;
}

function unknownColorCount(deck: DeckResponse): number {
  return (deck.colors ?? []).filter((color) => !VALID_COLORS.has(color.trim().toUpperCase())).length;
}

interface DeckSummaryCardProps {
  deck: DeckResponse;
  /**
   * `library` (default) is the owner's tile: status and timestamps. `feed` is
   * the community explore tile: the deck's prompt as a short description in
   * place of the owner-facing stat block.
   */
  variant?: 'library' | 'feed';
  /**
   * Where clicking the tile goes — the read-only deck view. Present ⇒ the
   * whole tile is a link (the title's anchor is stretched over the card), and
   * the footer actions sit above it so they never trigger it.
   */
  viewHref?: string;
  /**
   * Where the "Edit" action points. There is no deck-detail route in this app,
   * so the default is the deck builder carrying the deck id as a query param.
   */
  editHref?: string;
  /** Omit to render the card read-only — the destructive action disappears. */
  onDelete?: (deck: DeckResponse) => void;
  /** Present ⇒ the footer shows the public/private lock, which calls this. */
  onToggleVisibility?: (deck: DeckResponse) => void;
  /** Blocks this card's actions while a mutation for it is in flight. */
  busy?: boolean;
  /** `Date.now()` override, so relative timestamps are deterministic in tests. */
  now?: number;
  className?: string;
}

export function DeckSummaryCard({
  deck,
  variant = 'library',
  viewHref,
  editHref,
  onDelete,
  onToggleVisibility,
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
  // In the community feed, Edit is only for the deck's own author.
  const showEdit = variant === 'library' || deck.is_owner;
  const showFooter = showEdit || Boolean(onToggleVisibility) || Boolean(onDelete);

  return (
    <Card
      as="article"
      variant="panel"
      border="accent"
      radius="lg"
      padding="none"
      elevation={1}
      className={`deck-summary${viewHref ? ' deck-summary-clickable' : ''} ${className}`.trim()}
      aria-busy={busy || undefined}
    >
      <header className="deck-summary-head">
        <h3 className="deck-summary-title" title={deck.prompt}>
          {viewHref ? (
            <Link href={viewHref} className="deck-summary-link">
              {title}
            </Link>
          ) : (
            title
          )}
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
          <img
            className={`deck-summary-art-img deck-summary-art-img-${art.kind}`}
            src={art.src}
            alt=""
            loading="lazy"
            decoding="async"
          />
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

      {deck.tags?.length ? (
        <ul className="deck-summary-tags" aria-label="Tags">
          {deck.tags.map((tag) => (
            <li key={tag} className="deck-summary-tag">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {variant === 'feed' ? (
        <p className="deck-summary-description">{deck.prompt}</p>
      ) : (
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
      )}

      {variant === 'library' && deck.error_message ? (
        <p className="deck-summary-error">{deck.error_message}</p>
      ) : null}

      {showFooter ? (
        <footer className="deck-summary-actions">
          {showEdit ? (
            <Button
              href={isReady ? href : undefined}
              variant="secondary"
              size="xs"
              disabled={!isReady || busy}
            >
              Edit
            </Button>
          ) : null}
          {onToggleVisibility ? (
            <VisibilityToggle
              isPublic={deck.is_public}
              onToggle={() => onToggleVisibility(deck)}
              disabled={busy}
              deckName={title}
            />
          ) : null}
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
      ) : null}
    </Card>
  );
}
