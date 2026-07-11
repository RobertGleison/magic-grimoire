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
  onClearChat: () => void;
  disableClear: boolean;
}


export function OptionsPanel({ format, setFormat, colors, toggleColor, deckSize, setDeckSize, onClearChat, disableClear }: OptionsPanelProps) {
  return (
    <div className="options-panel">
      {/* <div className="options-panel-header">
        <span className="h-ui options-panel-title">Options panel</span>
      </div> */}

      <FormatSelector format={format} setFormat={setFormat} setDeckSize={setDeckSize} />
      <div className="options-panel-divider" />
      <ColorSelector colors={colors} toggleColor={toggleColor} />
      <div className="options-panel-divider" />
      <DeckSizeInput format={format} deckSize={deckSize} setDeckSize={setDeckSize} />
      <div className="options-panel-divider" />
      <ClearChatSection onClearChat={onClearChat} disabled={disableClear} />
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
  const disabled = format === 'Commander';

  return (
    <OptionsSection label="Deck Size">
      <div className="options-panel-size-row">
        <div className="options-panel-size-control" style={{ opacity: disabled ? 0.5 : 1 }}>
          <input
            type="number"
            min={60}
            value={deckSize}
            disabled={disabled}
            onChange={e => setDeckSize(Math.max(60, Number(e.target.value)))}
            className="options-panel-size-input"
          />
          <div className="options-panel-size-steppers">
            <button
              type="button"
              className="options-panel-size-stepper"
              disabled={disabled}
              onClick={() => setDeckSize(deckSize + 1)}
              aria-label="Increase deck size"
            >
              ▲
            </button>
            <button
              type="button"
              className="options-panel-size-stepper"
              disabled={disabled}
              onClick={() => setDeckSize(Math.max(60, deckSize - 1))}
              aria-label="Decrease deck size"
            >
              ▼
            </button>
          </div>
        </div>
        <span className="options-panel-size-hint">
          {disabled ? 'fixed at 100' : 'cards'}
        </span>
      </div>
    </OptionsSection>
  );
}


function ClearChatSection({ onClearChat, disabled }: {
  onClearChat: () => void;
  disabled: boolean;
}) {
  return (
    <OptionsSection label="Chat">
      <button
        className="opt-btn options-panel-clear-chat-btn"
        onClick={onClearChat}
        disabled={disabled}
      >
        Clear chat
      </button>
    </OptionsSection>
  );
}

