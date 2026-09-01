# Backend contract — apps/api-server

Base prefix: `/api/v1` (proxied by `next.config.ts` rewrite to `http://localhost:8000`).
Auth: Supabase JWT as `Authorization: Bearer <token>`.

## Decks
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| POST | `/api/v1/decks/generate` | `DeckGenerateRequest` | `202` `DeckGenerateResponse` |
| GET | `/api/v1/decks` | pagination | `DeckListResponse` |
| GET | `/api/v1/decks/{deck_id}` | — | `DeckResponse` |
| DELETE | `/api/v1/decks/{deck_id}` | — | `204` |

## Tasks
| Method | Path | Returns |
|---|---|---|
| GET | `/api/v1/tasks/{task_id}/stream` | `text/event-stream` of progress events |

## Chat
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/v1/chat` | `ChatRequest` | `ChatResponse` |

## Schemas (mirror exactly in `app/types/api.ts`)

```
CardInDeck        { name, quantity, scryfall_id?, image_uri?, mana_cost?, type_line?, section }
DeckGenerateRequest  { prompt (1..2000), format=DeckFormat.standard, colors?: MTGColor[], deck_size=60 (60..250) }
DeckGenerateResponse { task_id, deck_id (uuid), status: DeckStatus }
DeckResponse      { id, title?, prompt, format, colors?, cards?, card_count, status,
                    error_message?, created_at, completed_at?, failed_at? }
DeckListResponse  { decks, total, page, pages }
TaskStatusResponse{ id, status: TaskStatus, message? }
ChatMessage       { role: 'user'|'assistant', content (1..2000) }
ChatContext       { format?: DeckFormat, colors?: ('W'|'U'|'B'|'R'|'G')[], strategy?: string (<=50) }
ChatRequest       { messages: ChatMessage[] (1..20), context?: ChatContext }
ChatResponse      { message: string }
```

## Enums (exact string values)

```
DeckStatus    pending | processing | completed | failed
TaskStatus    queued | processing | completed | failed
TaskProgress  processing | searching_cards | composing_deck | enriching | completed | failed
DeckFormat    standard | modern | pioneer | legacy | commander
MTGColor      W | U | B | R | G | C
```

`TaskProgress` is what arrives over SSE during generation — the five pipeline stages.
