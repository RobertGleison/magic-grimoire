# Clear Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Clear chat" button to the deck-builder OptionsPanel that empties the chat message list (and clears the draft input), disabled while a deck generation or chat reply is in flight.

**Architecture:** Chat is stateless server-side — the frontend already rebuilds the full history on every request, so there's nothing to clear on the backend. This is a pure frontend change: a new `handleClearChat` callback in `apps/web-app/app/deck-builder/page.tsx` resets local state, and two new props (`onClearChat`, `disableClear`) thread that behavior into a new button section in `apps/web-app/app/components/OptionsPanel/OptionsPanel.tsx`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React, Vitest + Testing Library for unit tests.

---

### Task 1: Add "Clear chat" button to OptionsPanel

**Files:**
- Modify: `apps/web-app/app/components/OptionsPanel/OptionsPanel.tsx`
- Modify: `apps/web-app/app/components/OptionsPanel/OptionsPanel.css`
- Test: `apps/web-app/tests/unit/OptionsPanel.test.tsx` (new file)

- [ ] **Step 1: Write the failing test**

Create `apps/web-app/tests/unit/OptionsPanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OptionsPanel } from '../../app/components/OptionsPanel/OptionsPanel';

function baseProps(overrides = {}) {
  return {
    format: 'Modern',
    setFormat: vi.fn(),
    colors: [],
    toggleColor: vi.fn(),
    deckSize: 60,
    setDeckSize: vi.fn(),
    onClearChat: vi.fn(),
    disableClear: false,
    ...overrides,
  };
}

describe('OptionsPanel — clear chat', () => {
  it('shows a Clear chat button', () => {
    render(<OptionsPanel {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Clear chat' })).toBeInTheDocument();
  });

  it('calls onClearChat when clicked', () => {
    const onClearChat = vi.fn();
    render(<OptionsPanel {...baseProps({ onClearChat })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }));
    expect(onClearChat).toHaveBeenCalledOnce();
  });

  it('disables the button when disableClear is true', () => {
    render(<OptionsPanel {...baseProps({ disableClear: true })} />);
    expect(screen.getByRole('button', { name: 'Clear chat' })).toBeDisabled();
  });

  it('does not call onClearChat when disabled and clicked', () => {
    const onClearChat = vi.fn();
    render(<OptionsPanel {...baseProps({ onClearChat, disableClear: true })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }));
    expect(onClearChat).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web-app && npx vitest run tests/unit/OptionsPanel.test.tsx`
Expected: FAIL — `onClearChat`/`disableClear` don't exist on `OptionsPanelProps`, and there's no "Clear chat" button in the rendered output (`TestingLibraryElementError: Unable to find role="button" and name "Clear chat"`).

- [ ] **Step 3: Implement the props and button**

In `apps/web-app/app/components/OptionsPanel/OptionsPanel.tsx`, update the props interface and component signature:

```tsx
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
```

Add the new section component at the end of the file (after `DeckSizeInput`):

```tsx
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
```

Add matching styles to `apps/web-app/app/components/OptionsPanel/OptionsPanel.css` (append at end of file):

```css
.options-panel-clear-chat-btn {
  width: 100%;
  border-radius: var(--radius);
}

.options-panel-clear-chat-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.options-panel-clear-chat-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web-app && npx vitest run tests/unit/OptionsPanel.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/app/components/OptionsPanel/OptionsPanel.tsx apps/web-app/app/components/OptionsPanel/OptionsPanel.css apps/web-app/tests/unit/OptionsPanel.test.tsx
git commit -m "feat: add clear chat button to OptionsPanel"
```

---

### Task 2: Wire clear-chat handler into the deck-builder page

**Files:**
- Modify: `apps/web-app/app/deck-builder/page.tsx:169-177` (add handler near `handleStop`)
- Modify: `apps/web-app/app/deck-builder/page.tsx:361-366` (pass new props to `OptionsPanel`)

- [ ] **Step 1: Add the `handleClearChat` callback**

In `apps/web-app/app/deck-builder/page.tsx`, immediately after the existing `handleStop` callback (currently lines 169-177), add:

```tsx
  const handleClearChat = useCallback(() => {
    setMessages([]);
    setInput('');
  }, []);
```

So the surrounding code reads:

```tsx
  const handleStop = useCallback(() => {
    cancelRef.current = true;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    updateLastOracleMessage({ loading: false, content: 'Deck generation was stopped.' });
    setLoading(false);
  }, [updateLastOracleMessage]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setInput('');
  }, []);

```

- [ ] **Step 2: Pass the new props to `OptionsPanel`**

Find the `OptionsPanel` render call (currently around lines 361-366):

```tsx
          <OptionsPanel
            format={format} setFormat={setFormat}
            colors={colors} toggleColor={toggleColor}
            deckSize={deckSize} setDeckSize={setDeckSize}

          />
```

Replace it with:

```tsx
          <OptionsPanel
            format={format} setFormat={setFormat}
            colors={colors} toggleColor={toggleColor}
            deckSize={deckSize} setDeckSize={setDeckSize}
            onClearChat={handleClearChat} disableClear={loading || chatBusy}
          />
```

- [ ] **Step 3: Run the full unit test suite**

Run: `cd apps/web-app && npx vitest run`
Expected: PASS — all existing tests plus the new `OptionsPanel.test.tsx` tests pass. TypeScript compiles cleanly (no missing/extra prop errors) since `OptionsPanel` now requires `onClearChat`/`disableClear` and the page supplies both.

- [ ] **Step 4: Manually verify in the browser**

Run: `make dev` (or `cd apps/web-app && npm run dev`) and open `http://localhost:3000/deck-builder`.

1. Type a message and send it, or click **Generate Deck** — confirm the **Clear chat** button in the left OptionsPanel (bottom section, under "Chat") is disabled/greyed out while the reply/generation is in flight.
2. Once idle, click **Clear chat** — confirm the message list becomes completely empty (no welcome message reappears) and the chat input is cleared.
3. Confirm the OptionsPanel selections (format, colors, deck size) are unchanged after clearing.
4. If a deck was already generated and shown in the right-hand DeckPanel, confirm it's still visible after clearing chat.

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/app/deck-builder/page.tsx
git commit -m "feat: wire clear chat handler into deck-builder page"
```
