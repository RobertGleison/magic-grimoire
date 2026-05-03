'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArcaneSigil } from '../components/ArcaneSigil/ArcaneSigil';
import { SealLogo } from '../components/ArcaneSigilLogo/ArcaneSigilLogo';
import DeckPanel, { DeckData } from '../components/DeckPanel/DeckPanel';
import { OptionsPanel } from '../components/OptionsPanel/OptionsPanel';
import { ChatMessage } from '../components/ChatMessage/ChatMessage';
import { ChatInput } from '../components/ChatInput/ChatInput';
import { useUser } from '../context/UserContext';
import style from './page.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type LoadingStage = 0 | 1 | 2 | 3 | 4;

interface GrimoireMessage {
  role: 'oracle' | 'user';
  content: string;
  format?: string;
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

// Maps frontend ManaColor names to single-letter codes the backend expects.
const COLOR_CODE: Record<string, string> = {
  WHITE: 'W', BLUE: 'U', BLACK: 'B', RED: 'R', GREEN: 'G',
};

const QUICK_PROMPTS = [
  'Mono-green elf tribal for Modern, aggressive',
  'Azorius control with Teferi',
  'Burn deck for Pioneer',
  'Dimir mill for Commander',
];


function ChatTypingBubble() {
  return (
    <div className={style.loadingMsg}>
      <div className={style.loadingInner}>
        <div className={`seal ${style.loadingSeal}`}>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12 }}>✦</span>
        </div>
        <div>
          <div className={`h-ui ${style.loadingLabel}`}>Grimoire</div>
          <div className={style.loadingBox}>
            <div className={style.dots}>
              {[0, 1, 2].map(i => (
                <span key={i} className={style.dot} style={{ animationDelay: `${i * 0.2}s` }} />
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
    <div className={style.loadingMsg}>
      <div className={style.loadingInner}>
        {/* <div className={`seal ${style.loadingSeal}`}>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12 }}>✦</span>
        </div> */}
        <div>
          <div className={`h-ui ${style.loadingLabel}`}>Grimoire · Building</div>
          <div className={style.loadingBox}>
            <div className={style.dots}>
              {[0, 1, 2].map(i => (
                <span key={i} className={style.dot} style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <span className={style.loadingText} key={stage}>{LOADING_STAGES[stage]}</span>
          </div>
          <div className={style.progress}>
            {LOADING_STAGES.map((_, i) => (
              <span
                key={i}
                className={style.progressSeg}
                style={{ background: i <= stage ? 'var(--accent)' : 'rgba(var(--accent-glow), 0.15)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GrimoirePage() {
  const { user, openAuth } = useUser();
  const [messages, setMessages] = useState<GrimoireMessage[]>([
    { role: 'oracle', content: 'Welcome!. Describe the kind of deck you want. Chat to refine your vision, then hit **Generate Deck** when you\'re ready.' },
  ]);
  const [activeDeck, setActiveDeck] = useState<DeckData | null>(null);
  const [input, setInput] = useState('');
  const [format, setFormat] = useState('Modern');
  const [colors, setColors] = useState<string[]>([]);
  const [deckSize, setDeckSize] = useState(60);
  const [loading, setLoading] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(0);
  const [showSaveNudge, setShowSaveNudge] = useState(false);
  const [optionsCollapsed, setOptionsCollapsed] = useState(false);
  const [deckFullscreen, setDeckFullscreen] = useState(false);
  const [deckWidth, setDeckWidth] = useState(460);

  const scrollRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const cancelRef = useRef(false);

  const handleResizeDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = deckWidth;

    const onMove = (ev: PointerEvent) => {
      const maxWidth = Math.floor(window.innerWidth * 2 / 3);
      setDeckWidth(Math.min(Math.max(360, startWidth + (startX - ev.clientX)), maxWidth));
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', () => el.removeEventListener('pointermove', onMove), { once: true });
  }, [deckWidth]);

  const toggleColor = (color: string) => {
    setColors(prev => prev.includes(color) ? prev.filter(selected => selected !== color) : [...prev, color]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Patches the last oracle message in-place (e.g. replaces a loading bubble with the final response)
  // Example: Your deck Verdant Storm is ready — 60 cards built for Modern.
  const updateLastOracleMessage = useCallback((patch: Partial<GrimoireMessage>) => {
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
        content: `Your deck **${deck.title ?? 'Untitled'}** is ready, ${deck.card_count ?? 0} cards built for **${deck.format}**.`,
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

    setMessages(m => [
      ...m,
      { role: 'user', content: prompt, format },
      { role: 'oracle', content: '', loading: true, chatLoading: true },
    ]);
    setInput('');
    setChatBusy(true);

    try {
      const history = [
        ...messages.filter(m => !m.loading && m.content),
        { role: 'seeker' as const, content: prompt },
      ].map(m => ({
        role: m.role === 'seeker' ? 'user' : 'assistant' as const,
        content: m.content,
      }));

      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          context: {
            format: format.toLowerCase(),
            colors: colors.length > 0 ? colors.map(c => COLOR_CODE[c] ?? c) : undefined,
            strategy: strategy !== 'Balanced' ? strategy : undefined,
          },
        }),
      });

      const data = await res.json();
      const reply = res.ok ? data.message : 'Something went wrong. Please try again.';

      setMessages(prev => {
        const copy = [...prev];
        const idx = copy.map(m => m.chatLoading).lastIndexOf(true);
        if (idx !== -1) copy[idx] = { role: 'oracle', content: reply };
        return copy;
      });
    } catch {
      setMessages(prev => {
        const copy = [...prev];
        const idx = copy.map(m => m.chatLoading).lastIndexOf(true);
        if (idx !== -1) copy[idx] = { role: 'oracle', content: 'Could not reach the server. Please try again.' };
        return copy;
      });
    } finally {
      setChatBusy(false);
    }
  }, [input, format, colors, deckSize, strategy, loading, chatBusy, messages]);

  const handleGenerateDeck = useCallback(async () => {
    if (loading) return;

    const prompt = input.trim();
    cancelRef.current = false;

    const optParts = [
      colors.length > 0 ? `Colors: ${colors.join(', ')}` : '',
      deckSize !== 60 ? `Deck size: ${deckSize}` : '',
    ].filter(Boolean);
    const enhancedPrompt = prompt
      ? (optParts.length > 0 ? `${prompt}. ${optParts.join('. ')}` : prompt)
      : (optParts.length > 0 ? optParts.join('. ') : 'Surprise me with a fun deck');

    setMessages(m => [
      ...m,
      { role: 'user', content: prompt || enhancedPrompt, format },
      { role: 'oracle', content: '', loading: true },
    ]);
    setInput('');
    setLoading(true);
    setLoadingStage(0);

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
  }, [input, format, colors, deckSize, loading, fetchDeck, updateLastOracleMessage]);


  const isGuest = !user;
  const leftWidth = optionsCollapsed ? 40 : 256;
  const gridCols = activeDeck && !deckFullscreen
    ? `${leftWidth}px 1fr ${deckWidth}px`
    : `${leftWidth}px 1fr`;

  return (
    <div className={style.layout} style={{ gridTemplateColumns: gridCols }}>

      {/* LEFT: Options panel */}
      <aside className={`${style.optionsCol} ${optionsCollapsed ? style.optionsColCollapsed : ''}`}>
        <button
          className={style.collapseBtn}
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

          />
        )}
      </aside>

      {/* MIDDLE: Chat */}
      <div className={style.chatCol}>
        {/* Header */}
        <div className={style.header}>
          <div className={style.headerLeft}>
            <div className={`seal ${style.headerSeal}`}>
              <SealLogo size={22} />
            </div>
            <div className={style.headerMeta}>
              <div className={`h-ui ${style.headerTagline}`}>The Grimoire</div>
              <div className={`h-display ${style.headerTitle}`}>
                {activeDeck ? (activeDeck.title ?? 'Arcane Deck') : 'Consulting the grimoire'}
              </div>
            </div>
          </div>
          {/* {isGuest && (
            <button className={style.bindBtn} onClick={openAuth}>Sign In</button>
          )} */}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className={style.messages}>
          <div className={style.messagesInner}>
            {messages.map((m, i) => (
              m.loading
                ? m.chatLoading
                  ? <ChatTypingBubble key={i} />
                  : <LoadingBubble key={i} stage={loadingStage} />
                : <ChatMessage key={i} message={m} />
            ))}
          </div>
        </div>

        {/* Save nudge */}
        {showSaveNudge && isGuest && (
          <div className={style.saveNudge}>
            <div className={style.saveNudgeBox}>
              <span className={style.saveNudgeText}>
                Sign in to save this deck to your library.
              </span>
              <div className={style.saveNudgeActions}>
                <button className="btn btn-primary" onClick={openAuth} style={{ fontSize: '0.65rem', padding: '7px 14px' }}>Sign In</button>
                <button className="btn" onClick={() => setShowSaveNudge(false)} style={{ fontSize: '0.65rem', padding: '7px 10px' }}>✕</button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <ChatInput
          input={input}
          setInput={setInput}
          loading={loading}
          chatBusy={chatBusy}
          isFirstMessage={messages.length === 1}
          onChat={handleChat}
          onGenerateDeck={handleGenerateDeck}
          onStop={handleStop}
        />
      </div>

      {/* RIGHT: Deck panel */}
      {activeDeck && (
        <div className={`${style.deckWrapper} ${deckFullscreen ? style.deckFullscreen : ''}`}>
          {!deckFullscreen && (
            <div className={style.resizeHandle} onPointerDown={handleResizeDrag} />
          )}
          <div className={style.deckToolbar}>

            <button
              className={style.deckToolbarBtn}
              onClick={() => setDeckFullscreen(f => !f)}
              title={deckFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {deckFullscreen ? '🗕' : '⤢'}
            </button>
          </div>
          <DeckPanel
            deck={activeDeck}
            isGuest={isGuest}
            onRequestLogin={openAuth}
            onReplaceCards={cards => {
              const names = cards.map(c => `${c.quantity}x ${c.name}`).join(', ');
              setInput(`Replace ${names} — `);
            }}
          />
        </div>
      )}
    </div>
  );
}

