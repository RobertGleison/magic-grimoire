'use client';

import { useId } from 'react';

import { ManaIcon } from '../components/ManaIcon/ManaIcon';
import { DECK_FORMATS, MTG_COLORS, type DeckFormat, type MTGColor } from '../types/api';
import {
  BUDGET_MAX,
  BUDGET_MIN,
  DECK_SIZE_MAX,
  DECK_SIZE_MIN,
  DECK_SIZE_STEP,
  MANA_COLOR_NAMES,
  clampDeckSize,
  toggleDeckColor,
  type DeckConfig,
} from './deckLogic';
import styles from './page.module.css';

/* ==========================================================================
   ConfigPanel — Figma node `10:82` (light counterpart `20:665` for colour).
   --------------------------------------------------------------------------
   Deviations from the design, all deliberate:

   • The mana pickers render the real symbol art (`ManaIcon`, from
     `public/assets/mana-*.png`) instead of the design's bare letter. The Figma
     file has no MTG palette at all (Wave 1a), so its pickers fall back to
     neutral surfaces. Selection keeps the design's crimson ground.
   • The pickers list all six `MTG_COLORS`, including colourless `C`, not the
     design's five. `DeckGenerateRequest.colors` is `list[MTGColor]` server-side
     and accepts `C`, and eldrazi/artifact decks are unreachable without it.
   • The segmented format control lists all five `DeckFormat` values, not the
     design's three (Standard / Modern / Cmdr) — `pioneer` and `legacy` are
     legal server-side and would otherwise be unreachable. It wraps.
   • Budget has no field in `DeckGenerateRequest`. It is a real control whose
     value is folded into the prompt by `buildGeneratePrompt`, rather than a
     dead widget or a missing one.
   • The design's "Strategy Style" select (`10:123`) and "Include Sideboard"
     switch (`10:128`) are both removed by request. Neither had a request field
     of its own, and both are things the chat brief can say better in prose —
     a fixed seven-item strategy list could only contradict it.
     `ChatContext.strategy` stays in the API types (the field still exists
     server-side) but nothing sends it. `DeckResponse` cards flagged
     `section: "sideboard"` are still grouped and rendered — that is the
     backend's own output, unrelated to the removed toggle.
   • Card count stops at `DECK_SIZE_MAX` (200), inside the server's `60..250`.
   ========================================================================== */

const FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  modern: 'Modern',
  pioneer: 'Pioneer',
  legacy: 'Legacy',
  commander: 'Commander',
};

interface ConfigPanelProps {
  config: DeckConfig;
  onChange: (next: DeckConfig) => void;
  /** True while a generation is in flight — the whole panel goes inert. */
  disabled?: boolean;
}

export function ConfigPanel({ config, onChange, disabled = false }: ConfigPanelProps) {
  const autoId = useId();
  const budgetId = `budget-${autoId}`;
  const countId = `count-${autoId}`;

  const setColor = (color: MTGColor) =>
    onChange({ ...config, colors: toggleDeckColor(config.colors, color) });

  const setSize = (delta: number) =>
    onChange({ ...config, deckSize: clampDeckSize(config.deckSize + delta) });

  return (
    <section className={styles.configPanel} aria-labelledby={`config-heading-${autoId}`}>
      <h2 className={styles.panelTitle} id={`config-heading-${autoId}`}>
        Deck Configuration
      </h2>

      {/* ---- Mana colours (10:84) ------------------------------------- */}
      <div className={styles.configGroup}>
        <span className={styles.configLabel} id={`colors-${autoId}`}>
          Mana Colors
        </span>
        <div className={styles.manaPickers} role="group" aria-labelledby={`colors-${autoId}`}>
          {MTG_COLORS.map((color) => {
            const selected = config.colors.includes(color);
            return (
              <button
                key={color}
                type="button"
                className={`${styles.manaPicker} ${selected ? styles.manaPickerOn : ''}`}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => setColor(color)}
              >
                <ManaIcon color={color} size={24} />
                <span className="visually-hidden">{MANA_COLOR_NAMES[color]}</span>
              </button>
            );
          })}
        </div>
        <p className={styles.configHint}>
          {config.colors.length === 0
            ? 'Any colours — the forge decides.'
            : config.colors.map((color) => MANA_COLOR_NAMES[color]).join(' · ')}
        </p>
      </div>

      {/* ---- Format (10:97) -------------------------------------------- */}
      <div className={styles.configGroup}>
        <span className={styles.configLabel} id={`format-${autoId}`}>
          Spell Format
        </span>
        <div className={styles.segmented} role="group" aria-labelledby={`format-${autoId}`}>
          {DECK_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              className={`${styles.segment} ${config.format === format ? styles.segmentOn : ''}`}
              aria-pressed={config.format === format}
              disabled={disabled}
              onClick={() => onChange({ ...config, format })}
            >
              {FORMAT_LABELS[format]}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Card count (10:106) --------------------------------------- */}
      <div className={styles.configGroup}>
        <span className={styles.configLabel} id={countId}>
          Card Count
        </span>
        <div className={styles.stepper} role="group" aria-labelledby={countId}>
          <span className={styles.stepperValue} aria-live="polite">
            {config.deckSize} Cards
          </span>
          <span className={styles.stepperButtons}>
            <button
              type="button"
              className={styles.stepperButton}
              onClick={() => setSize(-DECK_SIZE_STEP)}
              disabled={disabled || config.deckSize <= DECK_SIZE_MIN}
              aria-label={`Remove ${DECK_SIZE_STEP} cards`}
            >
              &minus;
            </button>
            <button
              type="button"
              className={styles.stepperButton}
              onClick={() => setSize(DECK_SIZE_STEP)}
              disabled={disabled || config.deckSize >= DECK_SIZE_MAX}
              aria-label={`Add ${DECK_SIZE_STEP} cards`}
            >
              +
            </button>
          </span>
        </div>
      </div>

      {/* ---- Budget (10:113) ------------------------------------------- */}
      <div className={styles.configGroup}>
        <div className={styles.budgetHead}>
          <label className={styles.configLabel} htmlFor={budgetId}>
            Budget Range
          </label>
          <span className={styles.budgetValue}>
            {config.budget >= BUDGET_MAX ? 'No ceiling' : `$${config.budget} Max`}
          </span>
        </div>
        <input
          id={budgetId}
          className={styles.budgetSlider}
          type="range"
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={10}
          value={config.budget}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, budget: Number(event.target.value) })}
        />
        <div className={styles.budgetScale}>
          <span>${BUDGET_MIN}</span>
          <span>${BUDGET_MAX}+</span>
        </div>
      </div>
    </section>
  );
}
