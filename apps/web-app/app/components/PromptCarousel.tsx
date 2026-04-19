'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';

const PROMPTS = [
  { prompt: 'A black/white vampire deck that drains life with lifelink', format: 'standard', colors: ['B', 'W'] },
  { prompt: 'An aggressive red goblin deck that casts a dozen goblins in a single turn', format: 'legacy', colors: ['R'] },
  { prompt: 'A five-color dragon commander deck helmed by The Ur-Dragon', format: 'commander', colors: ['W', 'U', 'B', 'R', 'G'] },
  { prompt: 'Blue/green simic ramp that cheats enormous creatures into play on turn three', format: 'modern', colors: ['U', 'G'] },
];

export function PromptCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[index] as HTMLElement;
    track.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
    setActive(index);
  }, []);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(index);
  }, []);

  return (
    <div className="carousel">
      <div className="carousel-track" ref={trackRef} onScroll={onScroll}>
        {PROMPTS.map((ex, i) => (
          <Link key={i} href="/grimoire" className="prompt-card">
            <div className="prompt-colors">
              {ex.colors.map((c) => (
                <div key={c} className={`color-pip ${c}`} aria-hidden="true">{c}</div>
              ))}
              <span className="prompt-format">{ex.format}</span>
            </div>
            <p className="prompt-text">"{ex.prompt}"</p>
            <div className="prompt-cta">Try this →</div>
          </Link>
        ))}
      </div>

      <div className="carousel-controls">
        <button className="carousel-btn" onClick={() => scrollTo(Math.max(0, active - 1))} disabled={active === 0} aria-label="Previous">←</button>
        <div className="carousel-dots" role="tablist">
          {PROMPTS.map((_, i) => (
            <button key={i} role="tab" aria-selected={i === active} className={`carousel-dot${i === active ? ' active' : ''}`} onClick={() => scrollTo(i)} aria-label={`Card ${i + 1}`} />
          ))}
        </div>
        <button className="carousel-btn" onClick={() => scrollTo(Math.min(PROMPTS.length - 1, active + 1))} disabled={active === PROMPTS.length - 1} aria-label="Next">→</button>
      </div>
    </div>
  );
}
