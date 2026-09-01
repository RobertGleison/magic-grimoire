'use client';

import { useEffect, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import './LandingReveal.css';

/* ==========================================================================
   LandingReveal
   --------------------------------------------------------------------------
   Page-local scroll-reveal wrapper for `app/page.tsx`. Deliberately NOT in
   `app/components/` — six screen agents share that folder and the landing
   page is the only surface that needs this.

   The Figma file carries no motion data (see RALPH "Wave 1a findings"), so the
   reveal itself is an addition. Three guarantees it has to keep:

     1. `prefers-reduced-motion: reduce` — the observer is never armed and the
        element renders in its final state. The hidden start state also lives
        inside `@media (prefers-reduced-motion: no-preference)` in the CSS, so
        even a race during hydration cannot leave content hidden.
     2. No JavaScript — `app/page.tsx` ships a `<noscript>` stylesheet that
        neutralises the hidden state.
     3. No IntersectionObserver — falls straight through to revealed.
   ========================================================================== */

interface LandingRevealProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function LandingReveal({ className = '', children, ...rest }: LandingRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.04 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const classes = ['landing-reveal', revealed ? 'is-revealed' : '', className].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
}
