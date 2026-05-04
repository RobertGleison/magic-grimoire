import { useRef } from 'react';
import './ChatInput.css';

const QUICK_PROMPTS = [
  'Mono-green elf tribal for Modern, aggressive',
  'Azorius control with Teferi',
  'Burn deck for Pioneer',
  'Dimir mill for Commander',
];

interface ChatInputProps {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  chatBusy: boolean;
  isFirstMessage: boolean;
  onChat: () => void;
  onGenerateDeck: () => void;
  onStop: () => void;
}

export function ChatInput({
  input, setInput, loading, chatBusy, isFirstMessage,
  onChat, onGenerateDeck, onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleChat = () => {
    onChat();
    resetHeight();
  };

  const handleGenerateDeck = () => {
    onGenerateDeck();
    resetHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  };

  const canSend = !loading && !chatBusy && !!input.trim();
  const canGenerate = !loading && !chatBusy;

  return (
    <div className="chat-input-area">
      <div className="chat-input-inner">
        {isFirstMessage && !loading && (
          <div className="chat-input-quick-prompts">
            {QUICK_PROMPTS.map(p => (
              <button key={p} className="chat-input-quick-prompt" onClick={() => setInput(p)}>❝ {p} ❞</button>
            ))}
          </div>
        )}
        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            className="chat-input-textarea"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Talk with the grimoire…"
            style={{ fontStyle: input ? 'normal' : 'italic' }}
            rows={1}
            disabled={loading}
          />
          <div className="chat-input-footer">
            <span className="h-ui chat-input-hint">Generate Deck when ready</span>
            <div className="chat-input-buttons">
              {loading && (
                <button
                  onClick={onStop}
                  style={{
                    fontFamily: 'var(--font-ui)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                    padding: '7px 14px', background: 'transparent',
                    border: '1px solid rgba(180, 60, 60, 0.5)',
                    color: 'rgba(220, 100, 100, 0.9)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  ✕ Stop
                </button>
              )}
              <button
                onClick={handleChat}
                disabled={!canSend}
                style={{
                  fontFamily: 'var(--font-ui)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                  padding: '7px 16px',
                  background: canSend ? 'linear-gradient(180deg, rgba(var(--accent-glow), 0.15), rgba(var(--accent-glow), 0.05))' : 'transparent',
                  border: '1px solid ' + (canSend ? 'rgba(var(--accent-glow), 0.4)' : 'rgba(var(--accent-glow), 0.15)'),
                  color: canSend ? 'var(--accent)' : 'var(--muted)',
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                Send
              </button>
              <button
                onClick={handleGenerateDeck}
                disabled={!canGenerate}
                style={{
                  fontFamily: 'var(--font-ui)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                  padding: '7px 16px',
                  background: canGenerate ? 'linear-gradient(180deg, rgba(var(--accent-glow), 0.35), rgba(var(--accent-glow), 0.15))' : 'transparent',
                  border: '1px solid ' + (canGenerate ? 'rgba(var(--accent-glow), 0.7)' : 'rgba(var(--accent-glow), 0.15)'),
                  color: canGenerate ? 'var(--cream)' : 'var(--muted)',
                  cursor: canGenerate ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                Generate Deck
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
