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

const MOCK_CHAT_RESPONSES = [
  'Interesting direction! Are you leaning towards an aggressive early-game strategy, or would you prefer to control the board and win in the late game?',
  'Got it — that helps narrow things down. Do you have a budget in mind, or should I prioritize the strongest available cards?',
  'Noted. Any cards you absolutely want included, or should I have full creative freedom to build around the archetype?',
  'Perfect. Would you like disruption pieces like counterspells or removal, or focus entirely on your own win condition?',
  'Understood. Is this for competitive play or a more casual kitchen-table game? That\'ll help me tune the power level.',
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

    setMessages(m => [
      ...m,
      { role: 'user', content: prompt, format },
      { role: 'oracle', content: '', loading: true, chatLoading: true },
    ]);
    setInput('');
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
  }, [input, format, colors, deckSize, loading, chatBusy, messages]);

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
            <div className={style.resizeHandle} onMouseDown={handleResizeDrag} />
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
          />
        </div>
      )}
    </div>
  );
}

