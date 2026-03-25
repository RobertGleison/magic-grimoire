'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArcaneSigil } from '../components/ArcaneSigil';
import { ManaSymbol, ManaCost } from '../components/ManaSymbol';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CardEntry {
  name: string;
  quantity: number;
  mana_cost?: string;
  type_line?: string;
  image_uri?: string;
}

interface Deck {
  id: string;
  title?: string;
  prompt: string;
  format: string;
  colors?: string[];
  cards?: CardEntry[];
  card_count?: number;
  status: string;
}

type MessageStatus =
  | 'parsing_intent'
  | 'searching_cards'
  | 'composing_deck'
  | 'enriching'
  | 'completed'
  | 'failed'
  | 'error';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loadingStatus?: MessageStatus | null;
  deck?: Deck | null;
}

type DeckFormat = 'standard' | 'modern' | 'legacy' | 'commander';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  parsing_intent:  'Deciphering the arcane request…',
  searching_cards: 'Consulting the forbidden archives…',
  composing_deck:  'Weaving the perfect composition…',
  enriching:       'Imbuing cards with mystical knowledge…',
  completed:       'The ritual is complete.',
  failed:          'The ritual has failed.',
};

const STATUS_FLAVOR: Record<string, string> = {
  parsing_intent:  '"Words hold the seeds of all creation."',
  searching_cards: '"Every card is a world waiting to be discovered."',
  composing_deck:  '"From a thousand possibilities, one emerges perfect."',
  enriching:       '"Knowledge transforms the ordinary into the extraordinary."',
  completed:       '"And so the grimoire speaks its final word."',
  failed:          '"Even the greatest mages face insurmountable odds."',
};

const SUGGESTION_PROMPTS = [
  '"Build me a black/white vampire tribal deck for standard"',
  '"Create a fast red aggro deck focused on burn spells"',
  '"Design a five-color dragon commander deck"',
  '"I want a blue control deck with lots of counterspells"',
];

const FORMATS: { value: DeckFormat; label: string }[] = [
  { value: 'standard',   label: 'Standard' },
  { value: 'modern',     label: 'Modern' },
  { value: 'legacy',     label: 'Legacy' },
  { value: 'commander',  label: 'Commander' },
];

// ─── Card grouping helpers ────────────────────────────────────────────────────

type CardGroup = { label: string; count: number; cards: CardEntry[] };

function getCardCategory(card: CardEntry): string {
  const t = (card.type_line ?? '').toLowerCase();
  if (t.includes('land')) return 'Lands';
  if (t.includes('creature')) return 'Creatures';
  if (t.includes('planeswalker')) return 'Planeswalkers';
  if (t.includes('instant')) return 'Instants';
  if (t.includes('sorcery')) return 'Sorceries';
  if (t.includes('enchantment')) return 'Enchantments';
  if (t.includes('artifact')) return 'Artifacts';
  return 'Other';
}

const TYPE_ORDER = ['Creatures', 'Instants', 'Sorceries', 'Planeswalkers', 'Enchantments', 'Artifacts', 'Lands', 'Other'];

function groupCardsByType(cards: CardEntry[]): CardGroup[] {
  const hasTypes = cards.some((c) => c.type_line);
  if (!hasTypes) {
    return [{
      label: 'Cards',
      count: cards.reduce((s, c) => s + c.quantity, 0),
      cards: [...cards].sort((a, b) => a.name.localeCompare(b.name)),
    }];
  }
  const groups: Record<string, CardEntry[]> = {};
  for (const card of cards) {
    const cat = getCardCategory(card);
    (groups[cat] ??= []).push(card);
  }
  return TYPE_ORDER
    .filter((t) => groups[t]?.length)
    .map((t) => ({
      label: t,
      count: groups[t].reduce((s, c) => s + c.quantity, 0),
      cards: groups[t].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// ─── Color bar helpers ────────────────────────────────────────────────────────

const COLOR_GRADIENT: Record<string, string> = {
  W: '#d8c878', U: '#2878c0', B: '#403020', R: '#b82010', G: '#208050', C: '#808090',
};

function getColorBarGradient(colors: string[]): string {
  if (!colors.length) return 'linear-gradient(90deg, var(--gold-dim), var(--gold-bright), var(--gold-dim))';
  if (colors.length === 1) {
    const c = COLOR_GRADIENT[colors[0]] ?? '#808090';
    return `linear-gradient(90deg, ${c}88, ${c}, ${c}88)`;
  }
  const stops = colors.map((c, i) => {
    const pct = Math.round((i / (colors.length - 1)) * 100);
    return `${COLOR_GRADIENT[c] ?? '#808090'} ${pct}%`;
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusDots() {
  return (
    <div className="rune-dots" style={{ display: 'flex', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rune-dot" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function DeckDisplay({ deck }: { deck: Deck }) {
  const cards = deck.cards ?? [];
  const groups = groupCardsByType(cards);
  const colorBar = deck.colors?.length ? getColorBarGradient(deck.colors) : null;

  return (
    <div className="deck-display fade-in">
      {/* Color identity bar */}
      {colorBar && <div className="deck-color-bar" style={{ background: colorBar }} />}

      <div className="deck-header">
        <div>
          <div className="deck-title">{deck.title ?? 'Arcane Deck'}</div>
          <div className="deck-meta">
            {deck.format} · {deck.card_count ?? cards.length} cards
          </div>
        </div>
        {deck.colors && deck.colors.length > 0 && (
          <div className="deck-colors">
            {deck.colors.map((c) => (
              <ManaSymbol key={c} symbol={c} size={20} />
            ))}
          </div>
        )}
      </div>

      {groups.length > 0 ? (
        <div className="deck-cards-list">
          {groups.map((group) => (
            <div key={group.label} className="card-group">
              <div className="card-group-header">
                <span className="card-group-label">{group.label}</span>
                <span className="card-group-count">{group.count}</span>
              </div>
              {group.cards.map((card, i) => (
                <div key={i} className="card-entry">
                  <span className="card-qty">{card.quantity}</span>
                  <div className="card-info">
                    <div className="card-name-row">
                      <span className="card-name" title={card.name}>{card.name}</span>
                      {card.mana_cost && <ManaCost cost={card.mana_cost} size={13} />}
                    </div>
                    {card.type_line && (
                      <span className="card-type-line">{card.type_line}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px 18px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 15 }}>
          Card details not available.
        </div>
      )}

      <div className="deck-footer">
        <span>{deck.format.toUpperCase()} · {deck.id.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-avatar ${isUser ? 'user' : 'grimoire'}`}>
        {isUser ? 'YOU' : '⬡'}
      </div>
      <div className="message-body">
        <div className="message-label">{isUser ? 'Seeker' : 'Grimoire'}</div>

        {message.loadingStatus ? (
          <>
            <div className="status-indicator">
              <StatusDots />
              <span className="status-text">
                {STATUS_LABELS[message.loadingStatus] ?? 'Channeling arcane energies…'}
              </span>
            </div>
            {STATUS_FLAVOR[message.loadingStatus] && (
              <div className="status-flavor">
                {STATUS_FLAVOR[message.loadingStatus]}
              </div>
            )}
          </>
        ) : (
          <div className="message-bubble">{message.content}</div>
        )}

        {message.deck && <DeckDisplay deck={message.deck} />}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<DeckFormat>('standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const updateAssistantMessage = useCallback(
    (id: string, patch: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const fetchDeck = useCallback(
    async (deckId: string, assistantId: string) => {
      try {
        const res = await fetch(`/api/v1/decks/${deckId}`);
        if (!res.ok) throw new Error('Could not retrieve deck');
        const deck: Deck = await res.json();
        updateAssistantMessage(assistantId, {
          content: `Your deck has been forged: **${deck.title ?? 'Arcane Deck'}** — ${deck.card_count ?? 0} cards ready for battle.`,
          loadingStatus: null,
          deck,
        });
      } catch {
        updateAssistantMessage(assistantId, {
          content: 'The deck was created but its details could not be retrieved from the archives.',
          loadingStatus: null,
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [updateAssistantMessage]
  );

  const handleSubmit = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;

    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;

    const userMsg: Message = { id: userId, role: 'user', content: prompt };
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      loadingStatus: 'parsing_intent',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsGenerating(true);

    try {
      // 1. Initiate deck generation
      const initRes = await fetch('/api/v1/decks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, format }),
      });

      if (!initRes.ok) {
        throw new Error(`Server error: ${initRes.status}`);
      }

      const { task_id, deck_id } = await initRes.json();

      // 2. Stream task events via SSE
      const es = new EventSource(`/api/v1/tasks/${task_id}/stream`);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { status: MessageStatus };
          updateAssistantMessage(assistantId, { loadingStatus: data.status });

          if (data.status === 'completed') {
            es.close();
            fetchDeck(deck_id, assistantId);
          } else if (data.status === 'failed') {
            es.close();
            updateAssistantMessage(assistantId, {
              content: 'The ritual has failed. The arcane forces could not be contained. Please try again.',
              loadingStatus: null,
            });
            setIsGenerating(false);
          }
        } catch {
          // ignore parse errors on keepalive pings
        }
      };

      es.onerror = () => {
        es.close();
        // If we were still loading, it likely completed — try fetching the deck
        updateAssistantMessage(assistantId, {
          content: 'Connection to the arcane stream was lost. Attempting to retrieve your deck…',
          loadingStatus: null,
        });
        fetchDeck(deck_id, assistantId);
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateAssistantMessage(assistantId, {
        content: `Could not reach the arcane server. ${message}`,
        loadingStatus: null,
      });
      setIsGenerating(false);
    }
  }, [input, format, isGenerating, fetchDeck, updateAssistantMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (text: string) => {
    // Strip the quotes from the suggestion
    const clean = text.replace(/^"|"$/g, '');
    setInput(clean);
    textareaRef.current?.focus();
  };

  return (
    <div className="app-shell">
      {/* Background arcane circle */}
      <ArcaneSigil />

      {/* Header */}
      <header className="app-header">
        <Link href="/" className="forge-back-link" title="Back to home">
          ← Home
        </Link>
        <div className="header-eyebrow">The Arcane Grimoire</div>
        <h1 className="header-title">Magic Grimoire</h1>
      </header>

      {/* Messages */}
      <main className="messages-area">
        <div className="messages-inner">
          {messages.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-sigil" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
                <circle cx="40" cy="40" r="24" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
                <polygon
                  points="40,10 47,32 70,32 52,46 58,68 40,54 22,68 28,46 10,32 33,32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.5"
                />
              </svg>
              <div className="empty-title">Describe your deck</div>
              <div className="empty-hints">
                {SUGGESTION_PROMPTS.map((p) => (
                  <button key={p} className="hint-pill" onClick={() => handleSuggestion(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input zone */}
      <div className="input-zone">
        {/* Format selector */}
        <div className="format-bar">
          <span className="format-label">Format</span>
          {FORMATS.map((f) => (
            <button
              key={f.value}
              className={`format-btn ${format === f.value ? 'active' : ''}`}
              onClick={() => setFormat(f.value)}
              disabled={isGenerating}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="input-container">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Describe the deck you wish to forge…"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            rows={1}
          />
          <button
            className="send-button"
            onClick={handleSubmit}
            disabled={!input.trim() || isGenerating}
            title="Cast (Enter)"
            aria-label="Send"
          >
            {isGenerating ? (
              <svg viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="3" opacity="0.6">
                  <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.2s" repeatCount="indefinite" />
                </circle>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2L2 8l4 2 2 4 6-12z" />
              </svg>
            )}
          </button>
        </div>

        <p className="input-hint">
          Press <kbd>Enter</kbd> to cast · <kbd>Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
