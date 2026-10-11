'use client';

import './VisibilityToggle.css';

/* ==========================================================================
   VisibilityToggle — the lock on a deck. Locked = private (owner only),
   open = public (anyone can read it, and it can appear in the community
   feed). The button's name says what clicking does; its visible label and
   `aria-pressed` say what the deck is now.
   ========================================================================== */

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg className="visibility-toggle-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d={locked ? 'M5.25 7V5a2.75 2.75 0 0 1 5.5 0v2' : 'M5.25 7V5a2.75 2.75 0 0 1 5.37-.85'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface VisibilityToggleProps {
  isPublic: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Names the deck in the accessible label, e.g. "Make Rakdos Sacrifice private". */
  deckName?: string;
  className?: string;
}

export function VisibilityToggle({
  isPublic,
  onToggle,
  disabled = false,
  deckName = 'this deck',
  className = '',
}: VisibilityToggleProps) {
  const locked = !isPublic;
  return (
    <button
      type="button"
      className={`visibility-toggle${locked ? ' visibility-toggle-locked' : ''} ${className}`.trim()}
      aria-pressed={locked}
      aria-label={`${locked ? 'Make public' : 'Make private'}: ${deckName}`}
      title={locked ? 'Private — only you can see this deck. Click to make it public.' : 'Public — anyone can see this deck. Click to make it private.'}
      disabled={disabled}
      onClick={onToggle}
    >
      <LockIcon locked={locked} />
      <span className="visibility-toggle-label">{locked ? 'Private' : 'Public'}</span>
    </button>
  );
}
