---
name: frontend-robert
description: "Robert's frontend coding conventions for the magic-grimoire Next.js app. Use this skill whenever creating, editing, or refactoring any frontend component, page, CSS, or UI code in apps/web-app/. Covers component structure, CSS patterns, TypeScript style, composition, and animation. Trigger on any request to build a component, add a feature to the UI, style something, create a page, or fix frontend code."
user-invocable: true
---

# Frontend Conventions — Magic Grimoire

These are the conventions Robert uses in `apps/web-app/`. Follow them precisely when creating or editing any frontend code, even when not explicitly asked. They exist to keep the codebase consistent and avoid introducing new patterns that don't fit the project.

---

## Component Structure

Every component lives in its own folder with a matching CSS file if necessary:

```
app/components/
└── MyComponent/
    ├── MyComponent.tsx
    └── MyComponent.css
```

**No `index.tsx` barrel files.** Imports always point directly to the file:

```ts
// ✅ correct
import { MyComponent } from '../MyComponent/MyComponent';

// ❌ wrong — index.tsx doesn't exist
import { MyComponent } from '../MyComponent';
```

This makes it immediately clear where a component lives and avoids implicit re-export chains.

**Use named exports** for all components. Default exports are only for Next.js pages (`app/page.tsx`, `app/grimoire/page.tsx`, etc.) because the framework requires it.

```ts
// ✅ named export
export function ManaSymbol({ symbol }: ManaSymbolProps) { ... }

// ❌ default export (only for pages)
export default function ManaSymbol(...) { ... }
```

**Mark client components** with `'use client'` at the top of any file that uses hooks, event handlers, or browser APIs. Server components don't need it.

---

## CSS

Every component imports its own CSS file:

```ts
import './MyComponent.css';
```

**Never hardcode colors, fonts, or spacing values.** Always use CSS variables from `globals.css`. The design token palette:

| Token | Use |
|---|---|
| `--void-0` … `--void-3` | Background layers (darkest to lightest) |
| `--accent` | Primary gold accent color |
| `--accent-mid`, `--accent-dim`, `--accent-deep` | Accent variants |
| `--accent-glow` | **RGB tuple** `232,199,106` — use with rgba() |
| `--cream` | Light text / highlight |
| `--muted` | Subdued text |
| `--font-display`, `--font-ui`, `--font-body`, `--font-mono` | Font families |
| `--mana-w/u/b/r/g/c` | MTG mana colors |

The glow pattern uses an RGB tuple so alpha can be varied:

```css
/* ✅ correct — composable alpha */
box-shadow: 0 0 12px rgba(var(--accent-glow), 0.4);

/* ❌ wrong — hardcoded */
box-shadow: 0 0 12px rgba(232, 199, 106, 0.4);
```

**Class naming:** BEM-inspired kebab-case. Use the component name as a prefix for specificity:

```css
.mana-symbol { ... }
.mana-symbol-inner { ... }
.spine-link { ... }
.spine-link.active { ... }
```

**Page-scoped styles** go in `page.module.css` alongside the page file, not in `globals.css` or a component CSS file.

**Standard transition:** `transition: all 0.25s ease` on interactive elements.

---

## TypeScript

**Prop interfaces** are declared inline, directly above the component function. Don't put them at the bottom or in a separate types file unless they're shared across multiple components.

```ts
interface CardProps {
  name: string;
  manaCost?: string;   // optional with ?
  onClick?: () => void;
}

export function Card({ name, manaCost = '', onClick }: CardProps) { ... }
```

Provide defaults in destructuring, not inside the function body.

**Complex state** uses discriminated union types rather than multiple booleans:

```ts
// ✅ one source of truth
type LoadingStage = 0 | 1 | 2 | 3 | 4;

// ❌ multiple booleans that can contradict each other
const [isLoading, setIsLoading] = useState(false);
const [isComplete, setIsComplete] = useState(false);
```

---

## Composition

**Utility layout wrappers** (`Frame`, `Ornament`, etc.) live in `ArcaneSigilLogo/ArcaneSigilLogo.tsx` and are imported from there. Use them instead of rolling bespoke layout divs.

**Context pattern:** When creating a new React context, keep the interface, `createContext`, provider component, and hook all in one file:

```ts
// context/ThingContext.tsx
interface ThingContextType { ... }
const ThingContext = createContext<ThingContextType>(...);
export function ThingProvider({ children }: { children: ReactNode }) { ... }
export function useThing() { return useContext(ThingContext); }
```

**Sub-components** that are only used by one parent can be defined in the same file as that parent, above it. Extract to their own folder only when they're reused elsewhere.

---

## Checklist for new components

Before considering a component done:

- [ ] Folder: `components/ComponentName/ComponentName.tsx` + `ComponentName.css`
- [ ] Named export (not default)
- [ ] `'use client'` if it uses hooks or events
- [ ] CSS imported from the co-located file
- [ ] No hardcoded colors/fonts — using CSS variables only
- [ ] Animations as CSS classes, keyframes defined in globals.css
- [ ] Prop interface declared inline above the function
- [ ] Imports from other components use full paths (no index barrel)
