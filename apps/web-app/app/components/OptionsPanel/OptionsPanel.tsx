'use client';

import { ManaSymbol } from '../ManaSymbol/ManaSymbol';
import { SealLogo } from '../ArcaneSigilLogo/ArcaneSigilLogo';
import { ALL_FORMATS, BASIC_COLORS, COLOR_LABEL } from '../../enums';
import './OptionsPanel.css';

// ─── Main component ───────────────────────────────────────────────────────────

interface OptionsPanelProps {
  format: string;
  setFormat: (value: string) => void;
  colors: string[];
  toggleColor: (color: string) => void;
  deckSize: number;
  setDeckSize: (value: number) => void;
}


export function OptionsPanel({ format, setFormat, colors, toggleColor, deckSize, setDeckSize }: OptionsPanelProps) {
  return (
    <div className="options-panel">
      <div className="options-panel-header">
        <SealLogo size={20} />
        <span className="h-ui options-panel-title">The Rites</span>
      </div>

      <FormatSelector format={format} setFormat={setFormat} setDeckSize={setDeckSize} />
      <div className="options-panel-divider" />
      <ColorSelector colors={colors} toggleColor={toggleColor} />
      <div className="options-panel-divider" />
      <DeckSizeInput format={format} deckSize={deckSize} setDeckSize={setDeckSize} />
    </div>
  );
}


function OptionsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="options-panel-section">
      <div className="h-ui options-panel-section-label">{label}</div>
      {children}
    </div>
  );
}

function FormatSelector({ format, setFormat, setDeckSize }: {
  format: string;
  setFormat: (v: string) => void;
  setDeckSize: (v: number) => void;
}) {
  return (
    <OptionsSection label="Format">
      <div className="options-panel-btn-group">
        {ALL_FORMATS.map(f => (
          <button
            key={f}
            className={`opt-btn${format === f ? ' on' : ''} options-panel-side-btn`}
            onClick={() => { setFormat(f); if (f === 'Commander') setDeckSize(100); }}
          >
            {f}
          </button>
        ))}
      </div>
    </OptionsSection>
  );
}

function ColorSelector({ colors, toggleColor }: {
  colors: string[];
  toggleColor: (color: string) => void;
}) {
  return (
    <OptionsSection label="Colors">
      <div className="options-panel-color-row">
        {BASIC_COLORS.map(c => (
          <button
            key={c}
            className={`options-panel-color-btn${colors.includes(c) ? ' options-panel-color-btn-on' : ''}`}
            onClick={() => toggleColor(c)}
            title={COLOR_LABEL[c]}
          >
            <ManaSymbol symbol={c} size={30} />
          </button>
        ))}
      </div>
      {colors.length > 0 && (
        <button className="opt-btn options-panel-clear-btn" onClick={() => colors.forEach(c => toggleColor(c))}>
          clear selection
        </button>
      )}
    </OptionsSection>
  );
}


function DeckSizeInput({ format, deckSize, setDeckSize }: {
  format: string;
  deckSize: number;
  setDeckSize: (v: number) => void;
}) {
  return (
    <OptionsSection label="Deck Size">
      <div className="options-panel-size-row">
        <input
          type="number"
          min={60}
          value={deckSize}
          disabled={format === 'Commander'}
          onChange={e => setDeckSize(Math.max(60, Number(e.target.value)))}
          className="options-panel-size-input"
          style={{ opacity: format === 'Commander' ? 0.5 : 1 }}
        />
        <span className="options-panel-size-hint">
          {format === 'Commander' ? 'fixed at 100' : 'cards'}
        </span>
      </div>
    </OptionsSection>
  );
}


