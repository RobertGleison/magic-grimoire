import { Badge } from './components/Badge/Badge';
import { Button } from './components/Button/Button';
import style from './not-found.module.css';

/* ==========================================================================
   404 — Figma `magic-grimoire-404` 16:349, inner frame 16:351 (680x431).
   Light counterpart 20:981 / 20:984 read for COLOUR ONLY; its inner frame is
   435px because its badge is 6/16 padded instead of 4/12. Per the RALPH rule,
   DARK IS THE CANONICAL GEOMETRY — 431 wins and the badge keeps 4/12.

   Renders inside the root layout, which already supplies Header + Footer, so
   this file is the <main> content only.

   Deviations from the design, all deliberate and reported to the controller:
     • The design ships ONE action ("Return to Grimoire"). Task 3f requires
       links to both `/` and `/deck-builder`, so a secondary Deck Builder
       button is added, labelled from the Header's own nav vocabulary.
     • The design has no rotating sigil here — the backdrop is a single
       blurred crimson ellipse (16:350) — so `ArcaneSigil` is NOT used.
   ========================================================================== */

/**
 * The button's leading glyph (16:360). Vector data is the exact `d` from the
 * Figma-exported asset, inlined rather than committed to `/public` because v2
 * deliberately ships no image assets (Wave 2 finding). `currentColor` lets it
 * inherit `--on-crimson` from the button label.
 */
function Sparkle() {
  return (
    <svg
      className={style.sparkle}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1.60156 13.7988C1.93272 13.7988 2.20117 14.0673 2.20117 14.3984C2.201 14.7294 1.93262 14.998 1.60156 14.998C1.27051 14.998 1.00213 14.7294 1.00195 14.3984C1.00195 14.0673 1.27041 13.7988 1.60156 13.7988ZM8.64453 5.28418C8.7416 5.79767 8.99082 6.27012 9.36035 6.63965C9.72988 7.00918 10.2023 7.2584 10.7158 7.35547L14.123 8L10.7158 8.64453C10.2023 8.7416 9.72988 8.99082 9.36035 9.36035C8.99082 9.72988 8.7416 10.2023 8.64453 10.7158L8 14.123L7.35547 10.7158C7.2584 10.2023 7.00918 9.72988 6.63965 9.36035C6.27012 8.99082 5.79767 8.7416 5.28418 8.64453L1.87598 8L5.28418 7.35547C5.79767 7.2584 6.27012 7.00918 6.63965 6.63965C7.00918 6.27012 7.2584 5.79767 7.35547 5.28418L8 1.87598L8.64453 5.28418ZM15.1611 7.80371H15.1592C15.1605 7.80344 15.1618 7.80298 15.1631 7.80273L15.1611 7.80371Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export default function NotFound() {
  return (
    <section className={style.page}>
      {/* 16:350 — 600x600 circle, --crimson at 15%, Gaussian blur 90. */}
      <div className={style.glow} aria-hidden="true" />

      <div className={style.frame}>
        {/* 16:352 */}
        <div className={style.masthead}>
          {/* 16:353 — decorative: the <h1> below carries the meaning. */}
          <p className={style.numeral} aria-hidden="true">
            404
          </p>
          {/* 16:354 */}
          <Badge variant="crimson" size="md" shape="square">
            Wayward Spell Error
          </Badge>
        </div>

        {/* 16:356 */}
        <div className={style.copy}>
          <h1 className={style.heading}>Spell Not Found</h1>
          <p className={style.body}>
            The scroll you seek has been lost to the void. Perhaps a wayward counterspell intercepted
            your path or a demonic rift consumed the destination.
          </p>
        </div>

        <div className={style.actions}>
          {/* 16:359 — bg --crimson, 1px --line-accent, --on-crimson label. */}
          <Button href="/" variant="primary" size="lg" iconLeft={<Sparkle />}>
            Return to Grimoire
          </Button>
          {/* Addition — see the deviation note above. */}
          <Button href="/deck-builder" variant="secondary" size="lg">
            Deck Builder
          </Button>
        </div>
      </div>
    </section>
  );
}
