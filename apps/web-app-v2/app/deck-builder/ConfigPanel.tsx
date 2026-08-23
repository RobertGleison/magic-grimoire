'use client';

import { useId } from 'react';

import { Select } from '../components/Select/Select';
import { ManaSymbol } from '../components/ManaSymbol/ManaSymbol';
import { CHAT_COLORS, DECK_FORMATS, type ChatColor, type DeckFormat } from '../types/api';
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

   • The mana pickers render a `ManaSymbol` pip instead of a bare letter. The
     Figma file has no MTG palette at all (Wave 1a), so its pickers fall back to
     neutral surfaces; `ManaSymbol` is the project's mana renderer and already
     carries per-colour contrast. Selection keeps the design's crimson ground.
   • The segmented format control lists all five `DeckFormat` values, not the
     design's three (Standard / Modern / Cmdr) — `pioneer` and `legacy` are
     legal server-side and would otherwise be unreachable. It wraps.
   • Budget and sideboard have no field in `DeckGenerateRequest`. They are real
     controls whose values are folded into the prompt by `buildGeneratePrompt`,
     rather than two dead widgets or two missing ones.
   ========================================================================== */

const FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  modern: 'Modern',
  pioneer: 'Pioneer',
  legacy: 'Legacy',
  commander: 'Cmdr',
};

/** Free-form server-side (`<= 50` chars); these are the suggestions. */
const STRATEGIES = [
  'Aggro rush',
  'Midrange synergy',
  'Control lock',
  'Combo engine',
  'Ramp payoff',
  'Tempo tricks',
  'Budget brew',
];

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
  const sideboardId = `sideboard-${autoId}`;

  const setColor = (color: ChatColor) =>
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
          {CHAT_COLORS.map((color) => {
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
                <ManaSymbol symbol={color} size={20} decorative />
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

      {/* ---- Strategy (10:123) ----------------------------------------- */}
      <Select
        label="Strategy Style"
        size="sm"
        value={config.strategy}
        disabled={disabled}
        options={STRATEGIES.map((strategy) => ({ value: strategy, label: strategy }))}
        onChange={(event) => onChange({ ...config, strategy: event.target.value })}
      />

      {/* ---- Sideboard (10:128) ---------------------------------------- */}
      <div className={styles.sideboardRow}>
        <span className={styles.sideboardText}>
          <span className={styles.sideboardTitle} id={sideboardId}>
            Include Sideboard
          </span>
          <span className={styles.sideboardHint}>15 optimal counter spells</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={config.sideboard}
          aria-labelledby={sideboardId}
          disabled={disabled}
          className={`${styles.switch} ${config.sideboard ? styles.switchOn : ''}`}
          onClick={() => onChange({ ...config, sideboard: !config.sideboard })}
        >
          <span className={styles.switchKnob} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
