'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

import './CardHoverPreview.css';

/* ==========================================================================
   CardHoverPreview
   --------------------------------------------------------------------------
   The cursor-following card zoom the pre-rebuild builder had: hovering a card
   anywhere in the deck (a grid tile or a list row) floats the full Scryfall
   render next to the pointer, big enough to read the rules text.

   Two details that are not incidental:

   • It renders through a portal into `document.body`. The deck grid is a
     scroll container with `overflow: auto`, and a preview positioned inside it
     would be clipped by its own parent — the portal is what lets a 418px card
     hang over a 300px-tall panel.

   • Only enter/leave go through React state. The pointer position is written
     straight onto the node's `transform` by a document-level listener, so
     dragging the cursor across sixty cards never re-renders the deck panel.
   ========================================================================== */

/** Scryfall's `normal` render is 488x680; this is that shape, scaled to read. */
const PREVIEW_W = 300;
const PREVIEW_H = 418;
/** Cursor clearance, so the pointer never sits on top of the art. */
const CURSOR_GAP = 16;
/** Minimum distance kept from the viewport edges. */
const EDGE_PAD = 8;

export interface CardPreviewTarget {
  name: string;
  imageUri?: string | null;
}

interface PreviewState extends CardPreviewTarget {
  /** Viewport coordinates of the pointer when the card was entered. */
  x: number;
  y: number;
}

/**
 * `image_uri` is nullable on the wire — enrichment can miss a card. Scryfall's
 * named-card endpoint redirects to the same render, so a miss still previews.
 */
function imageFor({ name, imageUri }: CardPreviewTarget): string {
  return (
    imageUri ||
    `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(name)}`
  );
}

/** Flips to the left of the cursor near the right edge; clamps vertically. */
function transformFor(x: number, y: number): string {
  const overflowsRight = x + CURSOR_GAP + PREVIEW_W + EDGE_PAD > window.innerWidth;
  const left = overflowsRight
    ? Math.max(EDGE_PAD, x - CURSOR_GAP - PREVIEW_W)
    : x + CURSOR_GAP;
  const top = Math.max(
    EDGE_PAD,
    Math.min(y - PREVIEW_H / 2, window.innerHeight - PREVIEW_H - EDGE_PAD),
  );
  return `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

/** What `hoverProps` returns — spread onto the element that should zoom. */
export interface CardHoverBindings {
  onMouseEnter: (event: MouseEvent) => void;
  onMouseLeave: () => void;
}

/**
 * Wires a card to the preview. Spread `hoverProps(card)` onto whatever the
 * pointer should hover, and render one `<CardHoverPreview>` per panel.
 */
export function useCardHoverPreview() {
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const hoverProps = (card: CardPreviewTarget): CardHoverBindings => ({
    onMouseEnter: (event) => setPreview({ ...card, x: event.clientX, y: event.clientY }),
    onMouseLeave: () => setPreview(null),
  });

  return { preview, hoverProps };
}

interface CardHoverPreviewProps {
  /** The hook's `preview`; `null` hides the zoom. */
  preview: PreviewState | null;
}

export function CardHoverPreview({ preview }: CardHoverPreviewProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  // Follow the pointer without going back through React.
  useEffect(() => {
    if (!preview) return;

    const follow = (event: PointerEvent) => {
      const node = nodeRef.current;
      if (node) node.style.transform = transformFor(event.clientX, event.clientY);
    };

    document.addEventListener('pointermove', follow);
    return () => document.removeEventListener('pointermove', follow);
  }, [preview]);

  // Never rendered on the server: `preview` is only ever set by a mouse event.
  if (!preview) return null;

  return createPortal(
    <div
      ref={nodeRef}
      className="card-hover-preview"
      style={{ transform: transformFor(preview.x, preview.y) }}
      aria-hidden="true"
    >
      {/* Remote Scryfall art — see the CardTile note on `next/image`. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="card-hover-preview-img"
        src={imageFor(preview)}
        alt=""
        width={PREVIEW_W}
        height={PREVIEW_H}
        decoding="async"
      />
    </div>,
    document.body,
  );
}
