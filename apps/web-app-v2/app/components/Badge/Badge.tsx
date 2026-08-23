import type { HTMLAttributes, ReactNode } from 'react';
import './Badge.css';

/**
 * `neutral` / `accent` / `accent-solid` / `crimson` / `crimson-solid` are
 * harvested (hero pill 3:20, pricing ribbon 3:245, final-CTA eyebrow 3:321,
 * deck-card format tag 9:61). The deck-status and deck-category sets below are
 * additions — the design has no status chips — built from `--type-*`, the
 * crimson pair and the gold pair so they read as one family.
 */
export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'accent-solid'
  | 'crimson'
  | 'crimson-solid'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'creature'
  | 'spell'
  | 'land';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** `sm` = deck-card tag (9:61); `md` = hero pill (3:20). */
  size?: 'sm' | 'md';
  /** `square` is the design's default; `pill` is the hero eyebrow. */
  shape?: 'square' | 'pill';
  /** Leading glyph — the design pairs the hero pill with a 14px sparkle. */
  icon?: ReactNode;
  /** Adds the crimson ember pulse the "v2.0 Live" badge implies. */
  pulse?: boolean;
  children?: ReactNode;
}

export function Badge({
  variant = 'neutral',
  size = 'sm',
  shape = 'square',
  icon,
  pulse = false,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  const classes = [
    'badge',
    `badge-${variant}`,
    `badge-${size}`,
    `badge-${shape}`,
    pulse ? 'badge-pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {icon ? (
        <span className="badge-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
