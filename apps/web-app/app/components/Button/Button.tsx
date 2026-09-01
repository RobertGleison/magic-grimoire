'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../Spinner/Spinner';
import './Button.css';

/**
 * Every variant below is harvested from a real node in the Figma file:
 *   primary   crimson fill + gold hairline + crimson glow — hero 3:27,
 *             final CTA 3:326, my-decks 9:28, auth 16:390, pricing 3:271
 *   accent    gold fill — pricing "Claim Rare Pack" 3:242
 *   outline   gold hairline + gold label — my-decks 9:234
 *   secondary muted hairline — hero 3:30, pricing 3:215, deck card 9:76
 *   subtle    panel fill + faint hairline — auth social 16:397, 10:76
 *   ghost     bare label — my-decks format filters 9:36
 *   danger    bare crimson label — deck card "Dissolve" 9:80
 */
export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'outline'
  | 'secondary'
  | 'subtle'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width — how every card CTA in the design sits. */
  fullWidth?: boolean;
  /** Swaps the leading icon for a spinner and blocks interaction. */
  loading?: boolean;
  /** Present ⇒ renders a `next/link` anchor instead of a `<button>`. */
  href?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  href,
  iconLeft,
  iconRight,
  children,
  className = '',
  disabled = false,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth ? 'btn-full' : '',
    loading ? 'btn-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading ? <Spinner size="xs" label="" className="btn-spinner" /> : iconLeft}
      <span className="btn-label">{children}</span>
      {iconRight}
    </>
  );

  if (href) {
    const inert = disabled || loading;
    return (
      <Link
        href={href}
        className={classes}
        aria-disabled={inert || undefined}
        aria-busy={loading || undefined}
        tabIndex={inert ? -1 : undefined}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
}
