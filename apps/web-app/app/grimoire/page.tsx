'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArcaneSigil } from '../components/ArcaneSigil';
import { ManaSymbol } from '../components/ManaSymbol';
import { SealLogo } from '../components/atoms';
import AuthModal from '../components/AuthModal';
import DeckPanel, { DeckData } from '../components/DeckPanel';
import { useUser } from '../context/UserContext';
import { User } from '../context/UserContext';
import { BASIC_COLORS, COLOR_LABEL, ALL_FORMATS, ALL_STRATEGIES } from '../enums';

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
    { name: 'Llanowar Elves',       quantity: 4,  mana_cost: '{G}',         type_line: 'Creature — Elf Druid' },
    { name: 'Elvish Mystic',        quantity: 4,  mana_cost: '{G}',         type_line: 'Creature — Elf Druid' },
    { name: 'Elvish Clancaller',    quantity: 4,  mana_cost: '{G}{G}',      type_line: 'Creature — Elf' },
    { name: 'Elvish Archdruid',     quantity: 4,  mana_cost: '{1}{G}{G}',   type_line: 'Creature — Elf Druid' },
    { name: 'Imperious Perfect',    quantity: 4,  mana_cost: '{2}{G}',      type_line: 'Creature — Elf Warrior' },
    { name: 'Ezuri, Renegade Leader', quantity: 4, mana_cost: '{1}{G}{G}',  type_line: 'Creature — Elf Warrior' },
    { name: 'Collected Company',    quantity: 4,  mana_cost: '{3}{G}',      type_line: 'Instant' },
    { name: 'Chord of Calling',     quantity: 4,  mana_cost: '{X}{G}{G}{G}',type_line: 'Instant' },
    { name: 'Harmonize',            quantity: 4,  mana_cost: '{2}{G}{G}',   type_line: 'Sorcery' },
    { name: 'Nykthos, Shrine to Nyx', quantity: 4, mana_cost: '',          type_line: 'Land' },
    { name: 'Forest',               quantity: 20, mana_cost: '',            type_line: 'Basic Land — Forest' },
  ],
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isSeeker = message.role === 'seeker';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isSeeker ? 'flex-end' : 'flex-start',
      marginBottom: 22,
      animation: 'messageIn 0.5s ease',
    }}>
      <div style={{ maxWidth: '90%', display: 'flex', flexDirection: isSeeker ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
        <div className="seal" style={{
          width: 30, height: 30, flexShrink: 0,
          background: isSeeker
            ? 'radial-gradient(circle at 35% 30%, var(--void-3), var(--void-1))'
            : 'radial-gradient(circle at 35% 30%, var(--void-4), var(--void-0))',
        }}>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12, fontStyle: 'italic' }}>
            {isSeeker ? 'S' : '✦'}
          </span>
        </div>
        <div>
          <div className="h-ui" style={{ fontSize: '0.55rem', opacity: 0.5, marginBottom: 4, textAlign: isSeeker ? 'right' : 'left' }}>
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
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
              <span className="chip">{message.opts.size} cards</span>
              {message.opts.colors.length > 0 && (
                <span className="chip" style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
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
    <div style={{ display: 'flex', marginBottom: 22, animation: 'messageIn 0.5s ease' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div className="seal" style={{ width: 30, height: 30, flexShrink: 0, animation: 'sealPulse 2s ease-in-out infinite' }}>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12 }}>✦</span>
        </div>
        <div>
          <div className="h-ui" style={{ fontSize: '0.55rem', opacity: 0.5, marginBottom: 4 }}>Oracle · Divining</div>
          <div style={{
            background: 'linear-gradient(135deg, rgba(28, 22, 40, 0.6), rgba(14, 11, 20, 0.8))',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(var(--accent-glow), 0.25)',
            padding: '12px 18px',
            display: 'flex', alignItems: 'center', gap: 14, minWidth: 260,
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <span style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--cream)', opacity: 0.9 }} key={stage}>
              {LOADING_STAGES[stage]}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
            {LOADING_STAGES.map((_, i) => (
              <span key={i} style={{ flex: 1, height: 1, background: i <= stage ? 'var(--accent)' : 'rgba(var(--accent-glow), 0.15)', transition: 'background 0.4s' }} />
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
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
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
          <span className="chip" style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {colors.map(c => <ManaSymbol key={c} symbol={c} size={11} />)}
          </span>
        )}
        {strategy !== 'Balanced' && <span className="chip">{strategy}</span>}
      </div>

      {open && (
        <div style={{ marginTop: 8, padding: '10px 12px', border: '1px solid rgba(var(--accent-glow), 0.2)', background: 'rgba(14, 11, 20, 0.6)', animation: 'messageIn 0.25s ease' }}>
          <div className="opt-row">
            <span className="opt-label">Format</span>
            {ALL_FORMATS.map(f => (
              <button key={f} className={`opt-btn${format === f ? ' on' : ''}`} onClick={() => { setFormat(f); if (f === 'Commander') setDeckSize(100); }}>{f}</button>
            ))}
          </div>
          <div className="opt-row">
            <span className="opt-label">Colors</span>
            {BASIC_COLORS.map(c => (
              <button key={c} className={`opt-btn${colors.includes(c) ? ' on' : ''}`} onClick={() => toggleColor(c)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 7px' }}>
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
              style={{
                width: 70, background: 'transparent',
                border: '1px solid rgba(var(--accent-glow), 0.3)',
                color: 'var(--cream)', fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem', padding: '3px 6px', textAlign: 'center',
                opacity: format === 'Commander' ? 0.5 : 1,
              }}
            />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: 'var(--cream)', opacity: 0.5 }}>
              {format === 'Commander' ? 'fixed at 100' : 'cards · 60 – 200+'}
            </span>
          </div>
          <div className="opt-row" style={{ marginBottom: 0 }}>
            <span className="opt-label">Strategy</span>
            {ALL_STRATEGIES.map(s => (
              <button key={s} className={`opt-btn${strategy === s ? ' on' : ''}`} onClick={() => setStrategy(s)}>{s}</button>
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
  const { user, setUser } = useUser();

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
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const cancelRef = useRef(false);

  const toggleColor = (c: string) => {
    setColors(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);
  };

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setLoadingStage(s => Math.min(s + 1, LOADING_STAGES.length - 1) as LoadingStage), 900);
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
      for (let s = 0; s < LOADING_STAGES.length; s++) {
        await new Promise<void>(r => setTimeout(r, 750));
        if (cancelRef.current) return;
        setLoadingStage(s as LoadingStage);
      }
      await new Promise<void>(r => setTimeout(r, 400));
      if (cancelRef.current) return;
      setActiveDeck(MOCK_DECK);
      updateLastOracleMessage({
        loading: false,
        content: `So it shall be. The tome has divined **${MOCK_DECK.title}** for **${MOCK_DECK.format}** — ${MOCK_DECK.card_count} cards of purpose, balanced and ready for battle.`,
      });
      setLoading(false);
      return;
    }

    try {
      const initRes = await fetch('/api/v1/decks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enhancedPrompt, format: format.toLowerCase() }),
      });

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

  const handleAuthSuccess = (u: User) => {
    setUser(u);
    setAuthMode(null);
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          borderRight: activeDeck ? '1px solid rgba(var(--accent-glow), 0.2)' : 'none',
          position: 'relative',
          minWidth: 0,
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(var(--accent-glow), 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, var(--void-1), transparent)',
            zIndex: 5,
            gap: 12,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div className="seal" style={{ width: 38, height: 38, flexShrink: 0 }}>
                <SealLogo size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="h-ui" style={{ fontSize: '0.55rem', opacity: 0.6 }}>The Grimoire</div>
                <div className="h-display" style={{ fontSize: '0.95rem', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeDeck ? (activeDeck.title ?? 'Arcane Deck') : 'Consulting the tome'}
                </div>
              </div>
            </div>
            {isGuest && (
              <button
                onClick={() => setAuthMode('login')}
                style={{
                  fontFamily: 'var(--font-ui)', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                  padding: '7px 12px', border: '1px solid rgba(var(--accent-glow), 0.4)', background: 'transparent',
                  color: 'var(--accent)', cursor: 'pointer', flexShrink: 0,
                }}
              >
                ✦ Bind Seeker
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 160px', position: 'relative' }}>
            <div style={{ position: 'absolute', right: -200, bottom: -200, opacity: 0.06, pointerEvents: 'none', zIndex: 0 }}>
              <ArcaneSigil size={600} intensity={0.3} />
            </div>
            <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative', zIndex: 1 }}>
              {messages.map((m, i) => (
                m.loading
                  ? <LoadingBubble key={i} stage={loadingStage} />
                  : <ChatMessageBubble key={i} message={m} />
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '16px 20px',
            background: 'linear-gradient(180deg, transparent, var(--void-0) 40%)',
            zIndex: 10,
          }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              {messages.length === 1 && !loading && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, justifyContent: 'center' }}>
                  {QUICK_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => setInput(p)}
                      style={{
                        background: 'transparent', border: '1px solid rgba(var(--accent-glow), 0.2)',
                        color: 'var(--cream)', fontFamily: 'var(--font-body)', fontSize: '0.82rem',
                        fontStyle: 'italic', padding: '5px 12px', cursor: 'pointer', opacity: 0.75,
                        transition: 'all 0.2s',
                      }}
                    >
                      ❝ {p} ❞
                    </button>
                  ))}
                </div>
              )}
              <div style={{
                background: 'linear-gradient(180deg, rgba(14, 11, 20, 0.95), rgba(8, 6, 10, 0.98))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(var(--accent-glow), 0.35)',
                padding: '12px 16px',
                boxShadow: '0 0 32px rgba(var(--accent-glow), 0.08)',
              }}>
                <ChatOptions
                  open={optsOpen} setOpen={setOptsOpen}
                  format={format} setFormat={setFormat}
                  colors={colors} toggleColor={toggleColor}
                  deckSize={deckSize} setDeckSize={setDeckSize}
                  strategy={strategy} setStrategy={setStrategy}
                />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Whisper thy desire into the tome…"
                  style={{
                    width: '100%', minHeight: 36, maxHeight: 140,
                    background: 'transparent', border: 'none',
                    color: 'var(--cream)', fontFamily: 'var(--font-body)',
                    fontSize: '1.02rem', fontStyle: input ? 'normal' : 'italic',
                    outline: 'none', resize: 'none',
                  }}
                  rows={1}
                  disabled={loading}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span className="h-ui" style={{ fontSize: '0.55rem', opacity: 0.4 }}>⏎ to cast</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {loading && (
                      <button
                        onClick={handleStop}
                        style={{
                          fontFamily: 'var(--font-ui)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                          padding: '7px 14px',
                          background: 'transparent',
                          border: '1px solid rgba(180, 60, 60, 0.5)',
                          color: 'rgba(220, 100, 100, 0.9)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
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
            onRequestLogin={() => setAuthMode('login')}
          />
        )}
      </div>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={handleAuthSuccess}
          onSwitchMode={setAuthMode}
        />
      )}
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
