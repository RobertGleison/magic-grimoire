'use client';

import { useId, useState } from 'react';

import { ManaIcon } from '../components/ManaIcon/ManaIcon';
import { DECK_FORMATS, MTG_COLORS, type DeckFormat, type MTGColor } from '../types/api';
import {
  BUDGET_MAX,
  BUDGET_MIN,
  COMMANDER_DECK_SIZE,
  DECK_SIZE_MAX,
  DECK_SIZE_MIN,
  DECK_SIZE_STEP,
  MANA_COLOR_NAMES,
  isFixedSizeFormat,
  setDeckFormat,
  setDeckSizeBound,
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
   • The panel retracts to a rail. The design has no such control, but the
     workspace is three columns wide and the config is the one whose settings
     you set once and stop looking at — collapsing it is what gives the deck
     grid room without touching the splitter.
   • Card count is a min/max pair of number fields, not the design's +/-
     stepper (10:108) and not a slider — a range, so the generator has room
     to land on a legal curve, and typed, because 60..200 is too long a run
     to hit an exact count by dragging. Both ends clamp to `DECK_SIZE_MIN`
     ..`DECK_SIZE_MAX` (60..200, inside the server's `60..250`) and push each
     other rather than inverting; equal ends pin an exact size. `deck_size`
     is a single `int` in the request, so the floor is what gets sent and
     `buildGeneratePrompt` carries the ceiling. Commander is the exception:
     the format is 100 cards by rule, so picking it pins both ends to 100 and
     disables the fields — a range there could only produce an illegal deck.
   ========================================================================== */

/** Points left when the panel is open (collapse) and right when it is a rail. */
function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d={direction === 'left' ? 'M7.5 1.5L3 6l4.5 4.5' : 'M4.5 1.5L9 6l-4.5 4.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  modern: 'Modern',
  pioneer: 'Pioneer',
  legacy: 'Legacy',
  commander: 'Commander',
};

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  disabled?: boolean;
  /** Fires on blur/Enter, never per keystroke — see the draft note below. */
  onCommit: (value: number) => void;
}

/**
 * One end of the card-count range.
 *
 * While the field has focus it renders an uncommitted string rather than the
 * committed number: clamping every keystroke makes the field unusable, since
 * typing "120" passes through "1" and would snap to 60 before the second digit
 * lands. The draft is released on blur, and `setDeckSizeBound` does the
 * clamping once, on a value the user has finished typing.
 */
function NumberField({ id, label, value, disabled = false, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null) onCommit(Number(draft));
    setDraft(null);
  };

  return (
    <span className={styles.numberField}>
      <label className={styles.numberFieldLabel} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.numberInput}
        type="number"
        inputMode="numeric"
        min={DECK_SIZE_MIN}
        max={DECK_SIZE_MAX}
        step={DECK_SIZE_STEP}
        value={draft ?? value}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </span>
  );
}

interface ConfigPanelProps {
  config: DeckConfig;
  onChange: (next: DeckConfig) => void;
  /** True while a generation is in flight — the whole panel goes inert. */
  disabled?: boolean;
  /** Retracted to a rail. The settings stay in effect either way. */
  collapsed?: boolean;
  /** Omit to render a panel that cannot be retracted. */
  onToggleCollapsed?: () => void;
}

export function ConfigPanel({
  config,
  onChange,
  disabled = false,
  collapsed = false,
  onToggleCollapsed,
}: ConfigPanelProps) {
  const autoId = useId();
  const budgetId = `budget-${autoId}`;
  const countId = `count-${autoId}`;
  const bodyId = `config-body-${autoId}`;

  /* Commander is a 100-card format by rule, so the count fields go read-only
     rather than offering a choice the deck cannot legally have. */
  const sizeLocked = isFixedSizeFormat(config.format);

  const setColor = (color: MTGColor) =>
    onChange({ ...config, colors: toggleDeckColor(config.colors, color) });

  /* Collapsing unmounts the controls rather than hiding them: `config` lives
     on the page, so nothing about the brief is lost, and a rail that still
     held 40-odd focusable widgets would be a tab trap with no visible target. */
  if (collapsed && onToggleCollapsed) {
    return (
      <section className={`${styles.configPanel} ${styles.configRail}`} aria-label="Deck configuration">
        <button
          type="button"
          className={styles.panelToggle}
          onClick={onToggleCollapsed}
          aria-expanded={false}
          aria-controls={bodyId}
          title="Expand deck configuration"
        >
          <Chevron direction="right" />
          <span className="visually-hidden">Expand deck configuration</span>
        </button>
        <span className={styles.configRailLabel}>Deck Configuration</span>
      </section>
    );
  }

  return (
    <section
      className={styles.configPanel}
      id={bodyId}
      aria-labelledby={`config-heading-${autoId}`}
    >
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={`config-heading-${autoId}`}>
          Deck Configuration
        </h2>
        {onToggleCollapsed && (
          <button
            type="button"
            className={styles.panelToggle}
            onClick={onToggleCollapsed}
            aria-expanded
            aria-controls={bodyId}
            title="Collapse deck configuration"
          >
            <Chevron direction="left" />
            <span className="visually-hidden">Collapse deck configuration</span>
          </button>
        )}
      </div>

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
          Deck Format
        </span>
        <div className={styles.segmented} role="group" aria-labelledby={`format-${autoId}`}>
          {DECK_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              className={`${styles.segment} ${config.format === format ? styles.segmentOn : ''}`}
              aria-pressed={config.format === format}
              disabled={disabled}
              onClick={() => onChange(setDeckFormat(config, format))}
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
        <div className={styles.countRange} role="group" aria-labelledby={countId}>
          <NumberField
            id={`${countId}-min`}
            label="Min"
            value={config.deckSizeMin}
            disabled={disabled || sizeLocked}
            onCommit={(value) => onChange(setDeckSizeBound(config, 'min', value))}
          />
          <span className={styles.countRangeDash} aria-hidden="true">
            &ndash;
          </span>
          <NumberField
            id={`${countId}-max`}
            label="Max"
            value={config.deckSizeMax}
            disabled={disabled || sizeLocked}
            onCommit={(value) => onChange(setDeckSizeBound(config, 'max', value))}
          />
        </div>
        <p className={styles.configHint}>
          {sizeLocked
            ? `Commander is exactly ${COMMANDER_DECK_SIZE} cards — locked by the format.`
            : config.deckSizeMin === config.deckSizeMax
              ? `Exactly ${config.deckSizeMin} cards.`
              : `Between ${config.deckSizeMin} and ${config.deckSizeMax} cards.`}
        </p>
      </div>

      {/* ---- Budget (10:113) ------------------------------------------- */}
      <div className={styles.configGroup}>
        <div className={styles.sliderHead}>
          <label className={styles.configLabel} htmlFor={budgetId}>
            Budget Range
          </label>
          <span className={styles.sliderValue}>
            {config.budget >= BUDGET_MAX ? 'No ceiling' : `$${config.budget} Max`}
          </span>
        </div>
        <input
          id={budgetId}
          className={styles.slider}
          type="range"
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={10}
          value={config.budget}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, budget: Number(event.target.value) })}
        />
        <div className={styles.sliderScale}>
          <span>${BUDGET_MIN}</span>
          <span>${BUDGET_MAX}+</span>
        </div>
      </div>
    </section>
  );
}
