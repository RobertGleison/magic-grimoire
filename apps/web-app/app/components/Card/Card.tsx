import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import './Card.css';

/** Surface tint. `panel` is the design's card ground, `inset` its stat blocks. */
export type CardVariant = 'panel' | 'inset' | 'plain';
/** Maps 1:1 onto `--shadow-1` … `--shadow-4`; `0` is flat. */
export type CardElevation = 0 | 1 | 2 | 3 | 4;
export type CardBorder = 'default' | 'strong' | 'thick' | 'accent' | 'crimson' | 'none';

interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Rendered element. `article`/`section`/`li` all work. */
  as?: ElementType;
  variant?: CardVariant;
  elevation?: CardElevation;
  border?: CardBorder;
  /** `lg` = panels and feature cards, `xl` = pricing and auth cards. */
  radius?: 'md' | 'lg' | 'xl';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Adds the hover lift the deck-grid cards use. */
  interactive?: boolean;
  children?: ReactNode;
}

export function Card({
  as: Tag = 'div',
  variant = 'panel',
  elevation = 0,
  border = 'default',
  radius = 'lg',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  const classes = [
    'card',
    `card-${variant}`,
    `card-elev-${elevation}`,
    `card-border-${border}`,
    `card-radius-${radius}`,
    `card-pad-${padding}`,
    interactive ? 'card-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
