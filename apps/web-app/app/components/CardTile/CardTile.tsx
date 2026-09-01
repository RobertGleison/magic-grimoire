'use client';

import { useState } from 'react';
import type { CardInDeck } from '../../types/api';
import { ManaCost, parseManaCost } from '../ManaSymbol/ManaSymbol';
import './CardTile.css';

/* ==========================================================================
   CardTile
   --------------------------------------------------------------------------
   Design: `mtg-card-grid-item` (node `16:38`), hovered state `16:27`.
   80 x 112 frame: name + mana badge strip, 62px art, type-line strip, then a
   footer with the copy count and the card's stats.

   Every field of `CardInDeck` except `name`, `quantity` and `section` is
   nullable on the wire, so each row keeps its box whether or not it has
   content — the frame is a fixed height and a collapsed row would leave a
   hole in it.
   ========================================================================== */

/** Intrinsic art-box size, used for the `<img>` dimensions so nothing shifts. */
const ART_W = 80;
const ART_H = 62;

function isLand(typeLine: string | null | undefined): boolean {
  return (typeLine ?? '').toLowerCase().includes('land');
}

interface CardTileProps {
  card: CardInDeck;
  /**
   * Right-hand footer slot (node `16:37`) — power/toughness or loyalty.
   * Not part of `CardInDeck`; the backend keeps only four Scryfall fields
   * (`app/services/scryfall_service.py`), so a caller has to supply it.
   */
  stats?: string | null;
  /** Deck-builder selection state — the design's hovered/emphasised frame. */
  selected?: boolean;
  /** Makes the tile a button. Omit for a static tile. */
  onSelect?: (card: CardInDeck) => void;
  className?: string;
}

export function CardTile({ card, stats = null, selected = false, onSelect, className = '' }: CardTileProps) {
  const [artFailed, setArtFailed] = useState(false);

  const { name, quantity, image_uri, mana_cost, type_line } = card;
  const hasCost = parseManaCost(mana_cost).length > 0;
  const showArt = Boolean(image_uri) && !artFailed;

  const body = (
    <>
      <span className="card-tile-head">
        <span className="card-tile-name" title={name}>
          {name}
        </span>
        {hasCost ? (
          <ManaCost cost={mana_cost} variant="badge" />
        ) : (
          isLand(type_line) && <span className="card-tile-land-badge">Land</span>
        )}
      </span>

      <span className="card-tile-art">
        {showArt ? (
          /* Scryfall art is remote; next/image would need a `remotePatterns`
             entry in next.config.ts, which is Wave 4b's call, not a component's. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="card-tile-art-img"
            src={image_uri ?? undefined}
            alt={`${name} card art`}
            width={ART_W}
            height={ART_H}
            loading="lazy"
            decoding="async"
            onError={() => setArtFailed(true)}
          />
        ) : (
          <span className="card-tile-art-fallback" aria-hidden="true">
            ◈
          </span>
        )}
      </span>

      <span className="card-tile-type">{type_line || '—'}</span>

      <span className="card-tile-foot">
        <span className="card-tile-qty">
          ×{quantity}
          <span className="visually-hidden"> copies</span>
        </span>
        <span className="card-tile-stats">{stats || '—'}</span>
      </span>
    </>
  );

  const classes = `card-tile${selected ? ' card-tile-selected' : ''} ${className}`.trim();

  if (onSelect) {
    return (
      <button
        type="button"
        className={`${classes} card-tile-interactive`}
        onClick={() => onSelect(card)}
        aria-pressed={selected}
      >
        {body}
      </button>
    );
  }

  return <span className={classes}>{body}</span>;
}
