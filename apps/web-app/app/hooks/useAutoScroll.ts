'use client';

import { useEffect, useRef } from 'react';

/**
 * Continuously scrolls an overflowing element sideways, pausing while the
 * pointer or a finger rests on it. Used by the marquee strips.
 *
 * @param speed Pixels advanced per animation frame.
 * @returns Ref to attach to the scroll container.
 */
export function useAutoScroll<T extends HTMLElement = HTMLDivElement>(speed = 0.4) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Honour the OS-level motion preference rather than animating regardless.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let paused = false;

    const tick = () => {
      if (!paused) {
        el.scrollLeft += speed;
        // Wrap once the tail is on screen; callers duplicate their content so
        // the reset is invisible.
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth) el.scrollLeft = 0;
      }
      frame = requestAnimationFrame(tick);
    };

    const pause = () => { paused = true; };
    const resume = () => { paused = false; };

    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', resume);

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend', resume);
    };
  }, [speed]);

  return ref;
}
