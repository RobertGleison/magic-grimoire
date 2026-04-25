'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArcaneSigil } from '../components/ArcaneSigil';
import { ManaSymbol } from '../components/ManaSymbol';
import { SealLogo } from '../components/atoms';
import DeckPanel, { DeckData } from '../components/DeckPanel';
import { useUser } from '../context/UserContext';
import { BASIC_COLORS, COLOR_LABEL, ALL_FORMATS, ALL_STRATEGIES } from '../enums';
import s from './page.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type LoadingStage = 0 | 1 | 2 | 3 | 4;

interface ChatMessage {
  role: 'oracle' | 'seeker';
  content: string;
  format?: string;
  opts?: { colors: string[]; strategy: string; size: number };
  loading?: boolean;
  loadingStage?: LoadingStage;
}

const LOADING_STAGES = [
  'Parsing thy intent…',
  'Searching the seventeen thousand…',
  'Weighing mana curves…',
  'Composing the sixty…',
  'Enriching with lore…',
];

const STATUS_TO_STAGE: Record<string, LoadingStage> = {
  parsing_intent: 0,
  searching_cards: 1,
  composing_deck: 2,
  enriching: 3,
};

const QUICK_PROMPTS = [
  'Mono-green elf tribal for Modern, aggressive',
  'Azorius control with Teferi',
  'Burn deck for Pioneer',
  'Dimir mill for Commander',
];

// ─── Mock ────────────────────────────────────────────────────────────────────

const MOCK_MODE = true;

const MOCK_DECK: DeckData = {
  id: 'mock-001',
  title: 'Verdant Storm',
  format: 'Modern',
  colors: ['G'],
  card_count: 60,
  cards: [
    { name: 'Llanowar Elves',         quantity: 4,  mana_cost: '{G}',          type_line: 'Creature — Elf Druid' },
    { name: 'Elvish Mystic',          quantity: 4,  mana_cost: '{G}',          type_line: 'Creature — Elf Druid' },
    { name: 'Elvish Clancaller',      quantity: 4,  mana_cost: '{G}{G}',       type_line: 'Creature — Elf' },
    { name: 'Elvish Archdruid',       quantity: 4,  mana_cost: '{1}{G}{G}',    type_line: 'Creature — Elf Druid' },
    { name: 'Imperious Perfect',      quantity: 4,  mana_cost: '{2}{G}',       type_line: 'Creature — Elf Warrior' },
    { name: 'Ezuri, Renegade Leader', quantity: 4,  mana_cost: '{1}{G}{G}',    type_line: 'Creature — Elf Warrior' },
    { name: 'Collected Company',      quantity: 4,  mana_cost: '{3}{G}',       type_line: 'Instant' },
    { name: 'Chord of Calling',       quantity: 4,  mana_cost: '{X}{G}{G}{G}', type_line: 'Instant' },
    { name: 'Harmonize',              quantity: 4,  mana_cost: '{2}{G}{G}',    type_line: 'Sorcery' },
    { name: 'Nykthos, Shrine to Nyx', quantity: 4,  mana_cost: '',             type_line: 'Land' },
    { name: 'Forest',                 quantity: 20, mana_cost: '',             type_line: 'Basic Land — Forest' },
  ],
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isSeeker = message.role === 'seeker';

  return (
    <div
      className={s.message}
      style={{ justifyContent: isSeeker ? 'flex-end' : 'flex-start' }}
    >
      <div
        className={s.messageInner}
        style={{ flexDirection: isSeeker ? 'row-reverse' : 'row' }}
      >
        <div
          className={`seal ${s.messageSeal}`}
          style={{
            background: isSeeker
              ? 'radial-gradient(circle at 35% 30%, var(--void-3), var(--void-1))'
              : 'radial-gradient(circle at 35% 30%, var(--void-4), var(--void-0))',
          }}
        >
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12, fontStyle: 'italic' }}>
            {isSeeker ? 'S' : '✦'}
          </span>
        </div>
        <div>
          <div className={`h-ui ${s.messageLabel}`} style={{ textAlign: isSeeker ? 'right' : 'left' }}>
            {isSeeker ? `Seeker · ${message.format ?? 'Modern'}` : 'Oracle'}
          </div>
          <div
            style={{
              background: isSeeker
                ? 'linear-gradient(135deg, rgba(232, 199, 106, 0.12), rgba(139, 111, 46, 0.08))'
                : 'linear-gradient(135deg, rgba(28, 22, 40, 0.6), rgba(14, 11, 20, 0.8))',
              backdropFilter: isSeeker ? 'none' : 'blur(8px)',
              border: isSeeker ? '1px solid rgba(var(--accent-glow), 0.3)' : '1px solid rgba(var(--accent-glow), 0.18)',
              padding: '12px 16px',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              lineHeight: 1.5,
              color: 'var(--cream)',
            }}
            dangerouslySetInnerHTML={{
              __html: message.content.replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--accent); font-weight: 600;">$1</strong>'),
            }}
          />
          {isSeeker && message.opts && (
            <div className={s.messageOpts} style={{ justifyContent: 'flex-end' }}>
              <span className="chip">{message.opts.size} cards</span>
              {message.opts.colors.length > 0 && (
                <span className={`chip ${s.chipColors}`}>
                  {message.opts.colors.map(c => <ManaSymbol key={c} symbol={c} size={10} />)}
                </span>
              )}
              {message.opts.strategy !== 'Balanced' && <span className="chip">{message.opts.strategy}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingBubble({ stage }: { stage: LoadingStage }) {
  return (
    <div className={s.loadingMsg}>
      <div className={s.loadingInner}>
        <div className={`seal ${s.loadingSeal}`}>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12 }}>✦</span>
        </div>
        <div>
          <div className={`h-ui ${s.loadingLabel}`}>Oracle · Divining</div>
          <div className={s.loadingBox}>
            <div className={s.dots}>
              {[0, 1, 2].map(i => (
                <span key={i} className={s.dot} style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <span className={s.loadingText} key={stage}>{LOADING_STAGES[stage]}</span>
          </div>
          <div className={s.progress}>
            {LOADING_STAGES.map((_, i) => (
              <span
                key={i}
                className={s.progressSeg}
                style={{ background: i <= stage ? 'var(--accent)' : 'rgba(var(--accent-glow), 0.15)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatOptions({
  open, setOpen, format, setFormat, colors, toggleColor, deckSize, setDeckSize, strategy, setStrategy,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  format: string; setFormat: (v: string) => void;
  colors: string[]; toggleColor: (c: string) => void;
  deckSize: number; setDeckSize: (v: number) => void;
  strategy: string; setStrategy: (v: string) => void;
}) {
  return (
    <div className={s.optsWrap}>
      <div className={s.optsChips}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            fontFamily: 'var(--font-ui)', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase',
            padding: '4px 10px', border: '1px solid rgba(var(--accent-glow), 0.3)',
            background: open ? 'rgba(var(--accent-glow), 0.15)' : 'transparent',
            color: open ? 'var(--accent)' : 'var(--cream)', cursor: 'pointer',
          }}
        >
          ⚙ Options {open ? '▾' : '▸'}
        </button>
        <span className="chip">{format}</span>
        <span className="chip">{deckSize} cards</span>
        {colors.length > 0 && (
          <span className={`chip ${s.chipColors}`}>
            {colors.map(c => <ManaSymbol key={c} symbol={c} size={11} />)}
          </span>
        )}
        {strategy !== 'Balanced' && <span className="chip">{strategy}</span>}
      </div>

      {open && (
        <div className={s.optsPanel}>
          <div className="opt-row">
            <span className="opt-label">Format</span>
            {ALL_FORMATS.map(f => (
              <button key={f} className={`opt-btn${format === f ? ' on' : ''}`} onClick={() => { setFormat(f); if (f === 'Commander') setDeckSize(100); }}>{f}</button>
            ))}
          </div>
          <div className="opt-row">
            <span className="opt-label">Colors</span>
            {BASIC_COLORS.map(c => (
              <button key={c} className={`opt-btn${colors.includes(c) ? ' on' : ''} ${s.optColorBtn}`} onClick={() => toggleColor(c)}>
                <ManaSymbol symbol={c} size={13} />
                <span>{COLOR_LABEL[c]}</span>
              </button>
            ))}
            {colors.length > 0 && (
              <button className="opt-btn" onClick={() => colors.forEach(c => toggleColor(c))} style={{ opacity: 0.7 }}>Clear</button>
            )}
          </div>
          <div className="opt-row">
            <span className="opt-label">Size</span>
            <input
              type="number"
              min={60}
              value={deckSize}
              disabled={format === 'Commander'}
              onChange={e => setDeckSize(Math.max(60, Number(e.target.value)))}
              className={s.sizeInput}
              style={{ opacity: format === 'Commander' ? 0.5 : 1 }}
            />
            <span className={s.sizeHint}>
              {format === 'Commander' ? 'fixed at 100' : 'cards · 60 – 200+'}
            </span>
          </div>
          <div className="opt-row" style={{ marginBottom: 0 }}>
            <span className="opt-label">Strategy</span>
            {ALL_STRATEGIES.map(st => (
              <button key={st} className={`opt-btn${strategy === st ? ' on' : ''}`} onClick={() => setStrategy(st)}>{st}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inner page (needs useSearchParams) ─────────────────────────────────────

function GrimoireInner() {
  const searchParams = useSearchParams();
  const { user, openAuth } = useUser();

  const initialPrompt = searchParams.get('prompt') ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'oracle', content: 'The tome stirs. Speak thy desire, Seeker — an archetype, a format, a feeling. I shall divine thy sixty cards.' },
  ]);
  const [activeDeck, setActiveDeck] = useState<DeckData | null>(null);
  const [input, setInput] = useState(initialPrompt);
  const [format, setFormat] = useState('Modern');
  const [colors, setColors] = useState<string[]>([]);
  const [deckSize, setDeckSize] = useState(60);
  const [strategy, setStrategy] = useState('Balanced');
  const [optsOpen, setOptsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(0);
  const [showSaveNudge, setShowSaveNudge] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const cancelRef = useRef(false);

  const toggleColor = (c: string) => {
    setColors(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);
  };

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setLoadingStage(st => Math.min(st + 1, LOADING_STAGES.length - 1) as LoadingStage), 900);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const updateLastOracleMessage = useCallback((patch: Partial<ChatMessage>) => {
    setMessages(prev => {
      const idx = [...prev].reverse().findIndex(m => m.role === 'oracle');
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.map((m, i) => i === realIdx ? { ...m, ...patch } : m);
    });
  }, []);

  const handleStop = useCallback(() => {
    cancelRef.current = true;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    updateLastOracleMessage({ loading: false, content: 'The ritual was interrupted.' });
    setLoading(false);
  }, [updateLastOracleMessage]);

  const fetchDeck = useCallback(async (deckId: string) => {
    try {
      const res = await fetch(`/api/v1/decks/${deckId}`);
      if (!res.ok) throw new Error('Could not retrieve deck');
      const deck: DeckData = await res.json();
      setActiveDeck(deck);
      updateLastOracleMessage({
        loading: false,
        content: `So it shall be. The tome has divined **${deck.title ?? 'thy deck'}** for **${deck.format}** — ${deck.card_count ?? 0} cards of purpose, balanced and ready for battle.`,
      });
      if (!user) setShowSaveNudge(true);
    } catch {
      updateLastOracleMessage({
        loading: false,
        content: 'The deck was forged, but its details could not be retrieved from the archives.',
      });
    } finally {
      esRef.current = null;
      setLoading(false);
    }
  }, [updateLastOracleMessage]);

  const handleSend = useCallback(async () => {
    if (loading) return;

    const prompt = input.trim();
    cancelRef.current = false;

    const optParts = [
      colors.length > 0 ? `Colors: ${colors.join(', ')}` : '',
      strategy !== 'Balanced' ? `Strategy: ${strategy}` : '',
      deckSize !== 60 ? `Deck size: ${deckSize}` : '',
    ].filter(Boolean);
    const enhancedPrompt = prompt
      ? (optParts.length > 0 ? `${prompt}. ${optParts.join('. ')}` : prompt)
      : (optParts.length > 0 ? optParts.join('. ') : 'Surprise me with a fun deck');

    const opts = { colors: [...colors], size: deckSize, strategy };

    setMessages(m => [
      ...m,
      { role: 'seeker', content: prompt || enhancedPrompt, format, opts },
      { role: 'oracle', content: '', loading: true },
    ]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);
    setLoadingStage(0);

    if (MOCK_MODE) {
      for (let st = 0; st < LOADING_STAGES.length; st++) {
        await new Promise<void>(r => setTimeout(r, 750));
        if (cancelRef.current) return;
        setLoadingStage(st as LoadingStage);
      }
      await new Promise<void>(r => setTimeout(r, 400));
      if (cancelRef.current) return;
      setActiveDeck(MOCK_DECK);
      updateLastOracleMessage({
        loading: false,
        content: `So it shall be. The tome has divined **${MOCK_DECK.title}** for **${MOCK_DECK.format}** — ${MOCK_DECK.card_count} cards of purpose, balanced and ready for battle.`,
      });
      setLoading(false);
      if (!user) setShowSaveNudge(true);
      return;
    }

    try {
      const initRes = await fetch('/api/v1/decks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enhancedPrompt, format: format.toLowerCase() }),
      });

      if (initRes.status === 429) {
        updateLastOracleMessage({ loading: false, content: 'The free ritual is spent. Bind thyself to the tome to continue casting.' });
        setLoading(false);
        openAuth();
        return;
      }
      if (!initRes.ok) throw new Error(`Server error: ${initRes.status}`);

      const { task_id, deck_id } = await initRes.json();

      const es = new EventSource(`/api/v1/tasks/${task_id}/stream`);
      esRef.current = es;

      es.onmessage = (event) => {
        if (cancelRef.current) return;
        try {
          const data = JSON.parse(event.data) as { status: string };
          const stage = STATUS_TO_STAGE[data.status];
          if (stage !== undefined) setLoadingStage(stage);

          if (data.status === 'completed') {
            es.close();
            esRef.current = null;
            fetchDeck(deck_id);
          } else if (data.status === 'failed') {
            es.close();
            esRef.current = null;
            updateLastOracleMessage({ loading: false, content: 'The ritual has failed. The arcane forces could not be contained. Please try again.' });
            setLoading(false);
          }
        } catch {
          // ignore parse errors on keepalive pings
        }
      };

      es.onerror = () => {
        if (cancelRef.current) return;
        es.close();
        esRef.current = null;
        fetchDeck(deck_id);
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateLastOracleMessage({ loading: false, content: `Could not reach the arcane server. ${message}` });
      setLoading(false);
    }
  }, [input, format, colors, deckSize, strategy, loading, fetchDeck, updateLastOracleMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isGuest = !user;

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: activeDeck ? 'minmax(380px, 1fr) minmax(460px, 1fr)' : '1fr',
        height: '100vh',
        position: 'relative',
      }}>
        {/* LEFT: Chat */}
        <div
          className={s.chatCol}
          style={{ borderRight: activeDeck ? '1px solid rgba(var(--accent-glow), 0.2)' : 'none' }}
        >
          {/* Header */}
          <div className={s.header}>
            <div className={s.headerLeft}>
              <div className={`seal ${s.headerSeal}`}>
                <SealLogo size={22} />
              </div>
              <div className={s.headerMeta}>
                <div className={`h-ui ${s.headerTagline}`}>The Grimoire</div>
                <div className={`h-display ${s.headerTitle}`}>
                  {activeDeck ? (activeDeck.title ?? 'Arcane Deck') : 'Consulting the tome'}
                </div>
              </div>
            </div>
            {isGuest && (
              <button className={s.bindBtn} onClick={openAuth}>✦ Bind Seeker</button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className={s.messages}>
            <div className={s.sigilBg}>
              <ArcaneSigil size={600} intensity={0.3} />
            </div>
            <div className={s.messagesInner}>
              {messages.map((m, i) => (
                m.loading
                  ? <LoadingBubble key={i} stage={loadingStage} />
                  : <ChatMessageBubble key={i} message={m} />
              ))}
            </div>
          </div>

          {/* Save nudge */}
          {showSaveNudge && isGuest && (
            <div className={s.saveNudge}>
              <div className={s.saveNudgeBox}>
                <span className={s.saveNudgeText}>
                  ✦ Thy deck awaits — Sign in to bind it to thy grimoire.
                </span>
                <div className={s.saveNudgeActions}>
                  <button className="btn btn-primary" onClick={openAuth} style={{ fontSize: '0.65rem', padding: '7px 14px' }}>Sign In</button>
                  <button className="btn" onClick={() => setShowSaveNudge(false)} style={{ fontSize: '0.65rem', padding: '7px 10px' }}>✕</button>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className={s.inputArea}>
            <div className={s.inputInner}>
              {messages.length === 1 && !loading && (
                <div className={s.quickPrompts}>
                  {QUICK_PROMPTS.map(p => (
                    <button key={p} className={s.quickPrompt} onClick={() => setInput(p)}>❝ {p} ❞</button>
                  ))}
                </div>
              )}
              <div className={s.inputBox}>
                <ChatOptions
                  open={optsOpen} setOpen={setOptsOpen}
                  format={format} setFormat={setFormat}
                  colors={colors} toggleColor={toggleColor}
                  deckSize={deckSize} setDeckSize={setDeckSize}
                  strategy={strategy} setStrategy={setStrategy}
                />
                <textarea
                  ref={textareaRef}
                  className={s.inputTextarea}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Whisper thy desire into the tome…"
                  style={{ fontStyle: input ? 'normal' : 'italic' }}
                  rows={1}
                  disabled={loading}
                />
                <div className={s.inputFooter}>
                  <span className={`h-ui ${s.castHint}`}>⏎ to cast</span>
                  <div className={s.inputButtons}>
                    {loading && (
                      <button
                        onClick={handleStop}
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
                      onClick={handleSend}
                      disabled={loading}
                      style={{
                        fontFamily: 'var(--font-ui)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                        padding: '7px 16px',
                        background: !loading ? 'linear-gradient(180deg, rgba(var(--accent-glow), 0.3), rgba(var(--accent-glow), 0.1))' : 'transparent',
                        border: '1px solid ' + (!loading ? 'rgba(var(--accent-glow), 0.6)' : 'rgba(var(--accent-glow), 0.15)'),
                        color: !loading ? 'var(--accent)' : 'var(--muted)',
                        cursor: !loading ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                      }}
                    >
                      Cast ✦
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Deck panel */}
        {activeDeck && (
          <DeckPanel
            deck={activeDeck}
            isGuest={isGuest}
            onRequestLogin={openAuth}
          />
        )}
      </div>
    </>
  );
}

// ─── Page wrapper (Suspense for useSearchParams) ─────────────────────────────

export default function GrimoirePage() {
  return (
    <Suspense fallback={null}>
      <GrimoireInner />
    </Suspense>
  );
}
