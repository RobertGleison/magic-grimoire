import Image from 'next/image';

import { MANA_COLOR_ASSETS, type ManaColor } from '../ManaSymbol/ManaSymbol';
import './ManaIcon.css';

/* ==========================================================================
   ManaIcon — the real MTG mana symbol, served from `public/assets`
   --------------------------------------------------------------------------
   `ManaSymbol` draws a CSS pip because it has to cope with every symbol a
   Scryfall `mana_cost` can contain (generics, hybrids, Phyrexian, {X}) and v2
   ships art for none of those. The colour pickers are the opposite case: a
   closed set of six known colours, each with a real symbol in
   `public/assets/mana-*.png` (ported from apps/web-app), rendered large enough
   that the drawn glyph reads better than a letter on a coloured disc.

   Art only — no accessible name. Callers own the label, exactly as they do for
   a decorative `ManaSymbol`.
   ========================================================================== */

interface ManaIconProps {
  color: ManaColor;
  /** Rendered diameter in px. */
  size?: number;
  className?: string;
}

export function ManaIcon({ color, size = 24, className = '' }: ManaIconProps) {
  return (
    <Image
      className={`mana-icon ${className}`.trim()}
      src={`/assets/mana-${MANA_COLOR_ASSETS[color]}.png`}
      alt=""
      width={size}
      height={size}
      aria-hidden
      draggable={false}
    />
  );
}
