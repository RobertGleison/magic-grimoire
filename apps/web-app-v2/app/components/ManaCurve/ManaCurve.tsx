import type { CSSProperties } from 'react';

import type { CardInDeck } from '../../types/api';
import { manaValue } from '../ManaSymbol/ManaSymbol';
import './ManaCurve.css';

/* ==========================================================================
   Bucketing
   --------------------------------------------------------------------------
   Design source: node `3:117` (`mana-curve-section`), bars `3:134`.
   Buckets run 0..maxCmc, with the top bucket absorbing everything above it
   (`6+ CMC` in the design). Lands are excluded by default — the design's
   60-card sample shows 22 lands yet the curve totals 62 spells, and the
   legacy `computeStats` in apps/web-app skips them too.
   ========================================================================== */

export interface ManaCurveBucket {
  /** The bucket's mana value. Equal to `maxCmc` for the overflow bucket. */
  cmc: number;
  /** `true` when this bucket absorbs every cost at or above its `cmc`. */
  overflow: boolean;
  /** Number of physical cards (quantity-weighted) in the bucket. */
  count: number;
}

function isLand(typeLine: string | null | undefined): boolean {
  return (typeLine ?? '').toLowerCase().includes('land');
}

/**
 * Quantity-weighted histogram of mana values.
 *
 * Cards with no `mana_cost` land in bucket 0 — that is correct for a genuine
 * zero-cost spell and harmless for an un-enriched card, which is the only
 * other way the field is missing.
 */
export function bucketManaCurve(
  cards: readonly CardInDeck[],
  { maxCmc = 6, includeLands = false }: { maxCmc?: number; includeLands?: boolean } = {},
): ManaCurveBucket[] {
  const top = Math.max(0, Math.trunc(maxCmc));
  const counts = new Array<number>(top + 1).fill(0);

  for (const card of cards) {
    if (!includeLands && isLand(card.type_line)) continue;
    const quantity = Number.isFinite(card.quantity) ? Math.max(0, card.quantity) : 0;
    if (quantity === 0) continue;
    counts[Math.min(manaValue(card.mana_cost), top)] += quantity;
  }

  return counts.map((count, cmc) => ({ cmc, overflow: cmc === top, count }));
}

/** Quantity-weighted average mana value of everything in the buckets. */
export function averageManaValue(buckets: readonly ManaCurveBucket[]): number {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return 0;
  return buckets.reduce((sum, b) => sum + b.cmc * b.count, 0) / total;
}

/**
 * Bar tone, straight off the design: the 1–3 drop core is crimson, the 4-drop
 * shoulder is gold, and 0 / 5+ are the dim gold the design gives the tails.
 */
function barTone(bucket: ManaCurveBucket): 'core' | 'shoulder' | 'tail' {
  if (bucket.cmc >= 1 && bucket.cmc <= 3) return 'core';
  if (bucket.cmc === 4) return 'shoulder';
  return 'tail';
}

function bucketLabel(bucket: ManaCurveBucket, variant: 'panel' | 'bare'): string {
  const value = bucket.overflow ? `${bucket.cmc}+` : `${bucket.cmc}`;
  return variant === 'panel' ? `${value} CMC` : value;
}

/* ==========================================================================
   Component
   ========================================================================== */

interface ManaCurveProps {
  /** Deck contents. Bucketed internally; pass the raw `cards` array. */
  cards: readonly CardInDeck[];
  /**
   * `panel` — the landing-page section card with heading + badge (node `3:127`).
   * `bare` — bars only, for the deck-builder analytics strip (node `10:223`).
   */
  variant?: 'panel' | 'bare';
  /** Panel heading. Ignored by `bare`. */
  title?: string;
  /** Panel sub-heading. Ignored by `bare`. */
  subtitle?: string;
  /** Optional chip at the top right of the panel. Ignored by `bare`. */
  badge?: string;
  /** Highest discrete bucket; everything above it folds into `maxCmc+`. */
  maxCmc?: number;
  /** Count lands in the curve. Off by default, matching the design. */
  includeLands?: boolean;
  className?: string;
}

export function ManaCurve({
  cards,
  variant = 'panel',
  title = 'Mana Curve',
  subtitle = '',
  badge = '',
  maxCmc = 6,
  includeLands = false,
  className = '',
}: ManaCurveProps) {
  const buckets = bucketManaCurve(cards, { maxCmc, includeLands });
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const peak = Math.max(...buckets.map((b) => b.count), 1);

  const summary =
    total === 0
      ? 'Mana curve: no spells yet.'
      : `Mana curve, ${total} spells, average mana value ${averageManaValue(buckets).toFixed(1)}. ` +
        buckets.map((b) => `${bucketLabel(b, 'panel')}: ${b.count}`).join(', ') +
        '.';

  return (
    <section className={`mana-curve mana-curve-${variant} ${className}`.trim()}>
      {variant === 'panel' && (
        <header className="mana-curve-header">
          <div className="mana-curve-heading">
            <h3 className="mana-curve-title">{title}</h3>
            {subtitle && <p className="mana-curve-subtitle">{subtitle}</p>}
          </div>
          {badge && <span className="mana-curve-badge">{badge}</span>}
        </header>
      )}

      <p className="visually-hidden">{summary}</p>

      {total === 0 ? (
        <p className="mana-curve-empty">No spells to chart yet.</p>
      ) : (
        <div className="mana-curve-bars" aria-hidden="true">
          {buckets.map((bucket, index) => (
            <div className="mana-curve-col" key={bucket.cmc}>
              <span className="mana-curve-count">{bucket.count}</span>
              <span className="mana-curve-track">
                <span
                  className={`mana-curve-bar mana-curve-bar-${barTone(bucket)}${
                    bucket.count === 0 ? ' mana-curve-bar-zero' : ''
                  }`}
                  style={
                    {
                      '--bar-fill': `${(bucket.count / peak) * 100}%`,
                      '--bar-index': index,
                    } as CSSProperties
                  }
                />
              </span>
              <span className="mana-curve-label">{bucketLabel(bucket, variant)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
