'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArcaneSigil } from '../components/ArcaneSigil/ArcaneSigil';
import { ManaSymbol } from '../components/ManaSymbol/ManaSymbol';
import { SealLogo } from '../components/ArcaneSigilLogo/ArcaneSigilLogo';
import DeckPanel, { DeckData } from '../components/DeckPanel/DeckPanel';
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
  chatLoading?: boolean;
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

const MOCK_CHAT_RESPONSES = [
  'Interesting direction! Are you leaning towards an aggressive early-game strategy, or would you prefer to control the board and win in the late game?',
  'Got it — that helps narrow things down. Do you have a budget in mind, or should I prioritize the strongest available cards?',
  'Noted. Any cards you absolutely want included, or should I have full creative freedom to build around the archetype?',
  'Perfect. Would you like disruption pieces like counterspells or removal, or focus entirely on your own win condition?',
  'Understood. Is this for competitive play or a more casual kitchen-table game? That\'ll help me tune the power level.',
];

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

interface OptionsPanelProps {
  format: string;
  setFormat: (v: string) => void;
  colors: string[];
  toggleColor: (c: string) => void;
  deckSize: number;
  setDeckSize: (v: number) => void;
  strategy: string;
  setStrategy: (v: string) => void;
}

function OptionsPanel({ format, setFormat, colors, toggleColor, deckSize, setDeckSize, strategy, setStrategy }: OptionsPanelProps) {
  return (
    <div className={s.optionsPane}>
      <div className={s.optionsHeader}>
        <SealLogo size={20} />
        <span className={`h-ui ${s.optionsTitle}`}>The Rites</span>
      </div>

      <div className={s.optsSection}>
        <div className={`h-ui ${s.optsSectionLabel}`}>Format</div>
        <div className={s.optsBtnGroup}>
          {ALL_FORMATS.map(f => (
            <button
              key={f}
              className={`opt-btn${format === f ? ' on' : ''} ${s.optsSideBtn}`}
              onClick={() => { setFormat(f); if (f === 'Commander') setDeckSize(100); }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className={s.optsDivider} />

      <div className={s.optsSection}>
        <div className={`h-ui ${s.optsSectionLabel}`}>Colors</div>
        <div className={s.colorRow}>
          {BASIC_COLORS.map(c => (
            <button
              key={c}
              className={`${s.colorBtn}${colors.includes(c) ? ` ${s.colorBtnOn}` : ''}`}
              onClick={() => toggleColor(c)}
              title={COLOR_LABEL[c]}
            >
              <ManaSymbol symbol={c} size={16} />
            </button>
          ))}
        </div>
        {colors.length > 0 && (
          <button className={`opt-btn ${s.clearBtn}`} onClick={() => colors.forEach(c => toggleColor(c))}>
            clear selection
          </button>
        )}
      </div>

      <div className={s.optsDivider} />

      <div className={s.optsSection}>
        <div className={`h-ui ${s.optsSectionLabel}`}>Strategy</div>
        <div className={s.optsBtnGroup}>
          {ALL_STRATEGIES.map(st => (
            <button
              key={st}
              className={`opt-btn${strategy === st ? ' on' : ''} ${s.optsSideBtn}`}
              onClick={() => setStrategy(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className={s.optsDivider} />

      <div className={s.optsSection}>
        <div className={`h-ui ${s.optsSectionLabel}`}>Deck Size</div>
        <div className={s.sizeRow}>
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
            {format === 'Commander' ? 'fixed at 100' : 'cards'}
          </span>
        </div>
      </div>
    </div>
  );
}

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
              : 'radial-gradient(circle at 35% 30%, var(--void-2), var(--void-0))',
          }}
        >
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12, fontStyle: 'italic' }}>
            {isSeeker ? 'S' : '✦'}
          </span>
        </div>
        <div>
          <div className={`h-ui ${s.messageLabel}`} style={{ textAlign: isSeeker ? 'right' : 'left' }}>
            {isSeeker ? `You · ${message.format ?? 'Modern'}` : 'Grimoire'}
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

function ChatTypingBubble() {
  return (
    <div className={s.loadingMsg}>
      <div className={s.loadingInner}>
        <div className={`seal ${s.loadingSeal}`}>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12 }}>✦</span>
        </div>
        <div>
          <div className={`h-ui ${s.loadingLabel}`}>Grimoire</div>
          <div className={s.loadingBox}>
            <div className={s.dots}>
              {[0, 1, 2].map(i => (
                <span key={i} className={s.dot} style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
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
          <div className={`h-ui ${s.loadingLabel}`}>Grimoire · Building</div>
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

// ─── Inner page (needs useSearchParams) ─────────────────────────────────────

function GrimoireInner() {
  const searchParams = useSearchParams();
  const { user, openAuth } = useUser();

  const initialPrompt = searchParams.get('prompt') ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'oracle', content: 'Welcome, Seeker. Describe the kind of deck you envision — archetype, format, playstyle. Chat to refine your vision, then hit **Generate Deck** when you\'re ready.' },
  ]);
  const [activeDeck, setActiveDeck] = useState<DeckData | null>(null);
  const [input, setInput] = useState(initialPrompt);
  const [format, setFormat] = useState('Modern');
  const [colors, setColors] = useState<string[]>([]);
  const [deckSize, setDeckSize] = useState(60);
  const [strategy, setStrategy] = useState('Balanced');
  const [loading, setLoading] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(0);
  const [showSaveNudge, setShowSaveNudge] = useState(false);
  const [optionsCollapsed, setOptionsCollapsed] = useState(false);
  const [deckFullscreen, setDeckFullscreen] = useState(false);
  const [deckWidth, setDeckWidth] = useState(460);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const cancelRef = useRef(false);

  const handleResizeDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = deckWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const maxWidth = Math.floor(window.innerWidth * 2 / 3);
      setDeckWidth(Math.min(Math.max(360, startWidth + delta), maxWidth));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [deckWidth]);

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
    updateLastOracleMessage({ loading: false, content: 'Deck generation was stopped.' });
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
        content: `Your deck **${deck.title ?? 'Untitled'}** is ready — ${deck.card_count ?? 0} cards built for **${deck.format}**.`,
      });
      if (!user) setShowSaveNudge(true);
    } catch {
      updateLastOracleMessage({
        loading: false,
        content: 'Your deck was built, but we couldn\'t load the details. Please try again.',
      });
    } finally {
      esRef.current = null;
      setLoading(false);
    }
  }, [updateLastOracleMessage]);

  const handleChat = useCallback(async () => {
    if (loading || chatBusy || !input.trim()) return;

    const prompt = input.trim();
    const opts = { colors: [...colors], size: deckSize, strategy };

    setMessages(m => [
      ...m,
      { role: 'seeker', content: prompt, format, opts },
      { role: 'oracle', content: '', loading: true, chatLoading: true },
    ]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setChatBusy(true);

    await new Promise<void>(r => setTimeout(r, 750));

    const oracleCount = messages.filter(m => m.role === 'oracle').length;
    const response = MOCK_CHAT_RESPONSES[oracleCount % MOCK_CHAT_RESPONSES.length];

    setMessages(prev => {
      const copy = [...prev];
      const idx = copy.map(m => m.chatLoading).lastIndexOf(true);
      if (idx !== -1) copy[idx] = { role: 'oracle', content: response };
      return copy;
    });
    setChatBusy(false);
  }, [input, format, colors, deckSize, strategy, loading, chatBusy, messages]);

  const handleGenerateDeck = useCallback(async () => {
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
        content: `Your deck **${MOCK_DECK.title}** is ready — ${MOCK_DECK.card_count} cards built for **${MOCK_DECK.format}**.`,
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
        updateLastOracleMessage({ loading: false, content: 'You\'ve used your free build. Sign in to keep generating decks.' });
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
            updateLastOracleMessage({ loading: false, content: 'Deck generation failed. Please try again.' });
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
      updateLastOracleMessage({ loading: false, content: `Could not reach the server. ${message}` });
      setLoading(false);
    }
  }, [input, format, colors, deckSize, strategy, loading, fetchDeck, updateLastOracleMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  };

  const isGuest = !user;
  const leftWidth = optionsCollapsed ? 40 : 256;
  const gridCols = activeDeck && !deckFullscreen
    ? `${leftWidth}px 1fr ${deckWidth}px`
    : `${leftWidth}px 1fr`;

  return (
    <div className={s.layout} style={{ gridTemplateColumns: gridCols }}>

      {/* LEFT: Options panel */}
      <aside className={`${s.optionsCol} ${optionsCollapsed ? s.optionsColCollapsed : ''}`}>
        <button
          className={s.collapseBtn}
          onClick={() => setOptionsCollapsed(v => !v)}
          title={optionsCollapsed ? 'Expand options' : 'Collapse options'}
        >
          {optionsCollapsed ? '›' : '‹'}
        </button>
        {!optionsCollapsed && (
          <OptionsPanel
            format={format} setFormat={setFormat}
            colors={colors} toggleColor={toggleColor}
            deckSize={deckSize} setDeckSize={setDeckSize}
            strategy={strategy} setStrategy={setStrategy}
          />
        )}
      </aside>

      {/* MIDDLE: Chat */}
      <div className={s.chatCol}>
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
            <button className={s.bindBtn} onClick={openAuth}>✦ Sign In</button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className={s.messages}>
          <div className={s.sigilBg}>
            <ArcaneSigil size={560} intensity={0.25} />
          </div>
          <div className={s.messagesInner}>
            {messages.map((m, i) => (
              m.loading
                ? m.chatLoading
                  ? <ChatTypingBubble key={i} />
                  : <LoadingBubble key={i} stage={loadingStage} />
                : <ChatMessageBubble key={i} message={m} />
            ))}
          </div>
        </div>

        {/* Save nudge */}
        {showSaveNudge && isGuest && (
          <div className={s.saveNudge}>
            <div className={s.saveNudgeBox}>
              <span className={s.saveNudgeText}>
                ✦ Sign in to save this deck to your library.
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
                placeholder="Talk with the grimoire…"
                style={{ fontStyle: input ? 'normal' : 'italic' }}
                rows={1}
                disabled={loading}
              />
              <div className={s.inputFooter}>
                <span className={`h-ui ${s.castHint}`}>⏎ to chat · Generate Deck when ready</span>
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
                    onClick={handleChat}
                    disabled={loading || chatBusy || !input.trim()}
                    style={{
                      fontFamily: 'var(--font-ui)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                      padding: '7px 16px',
                      background: (!loading && !chatBusy && input.trim()) ? 'linear-gradient(180deg, rgba(var(--accent-glow), 0.15), rgba(var(--accent-glow), 0.05))' : 'transparent',
                      border: '1px solid ' + ((!loading && !chatBusy && input.trim()) ? 'rgba(var(--accent-glow), 0.4)' : 'rgba(var(--accent-glow), 0.15)'),
                      color: (!loading && !chatBusy && input.trim()) ? 'var(--accent)' : 'var(--muted)',
                      cursor: (!loading && !chatBusy && input.trim()) ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                    }}
                  >
                    Send ✦
                  </button>
                  <button
                    onClick={handleGenerateDeck}
                    disabled={loading || chatBusy}
                    style={{
                      fontFamily: 'var(--font-ui)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                      padding: '7px 16px',
                      background: (!loading && !chatBusy) ? 'linear-gradient(180deg, rgba(var(--accent-glow), 0.35), rgba(var(--accent-glow), 0.15))' : 'transparent',
                      border: '1px solid ' + ((!loading && !chatBusy) ? 'rgba(var(--accent-glow), 0.7)' : 'rgba(var(--accent-glow), 0.15)'),
                      color: (!loading && !chatBusy) ? 'var(--cream)' : 'var(--muted)',
                      cursor: (!loading && !chatBusy) ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                    }}
                  >
                    Generate Deck ⚡
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Deck panel */}
      {activeDeck && (
        <div className={`${s.deckWrapper} ${deckFullscreen ? s.deckFullscreen : ''}`}>
          {!deckFullscreen && (
            <div className={s.resizeHandle} onMouseDown={handleResizeDrag} />
          )}
          <div className={s.deckToolbar}>
            {isGuest && (
              <button className={s.deckToolbarBtn} onClick={openAuth}>✦ Save Deck</button>
            )}
            <button
              className={s.deckToolbarBtn}
              onClick={() => setDeckFullscreen(f => !f)}
              title={deckFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {deckFullscreen ? '⊡' : '⤢'}
            </button>
          </div>
          <DeckPanel
            deck={activeDeck}
            isGuest={isGuest}
            onRequestLogin={openAuth}
          />
        </div>
      )}
    </div>
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
