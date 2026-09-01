# Design tokens — web-app

Source of truth: `app/globals.css`.
Design source: Figma file `pgLzux7WT7F98ZEwDpw8lh`.

The Figma file defines **no Figma variables** (`get_variable_defs` → `{}`), so every
value below was harvested as a raw hex / px literal from `get_design_context` on the
section nodes listed under [Where each value came from](#where-each-value-came-from)
and then mapped onto the token vocabulary inherited from `apps/web-app/app/globals.css`.

**Rule for all component work:** never write a colour, font, radius, spacing or
shadow literal. Use a token. If a token is missing, add it to the right group in
`globals.css` (all three theme blocks) and add a row here.

---

## Colour tokens

`:root` is the **dark** theme (the design's primary). Light is applied via
`:root[data-theme="light"]` **and** `@media (prefers-color-scheme: light) :root:not([data-theme="dark"])`.
Both light blocks carry identical payloads.

### Surfaces

| Raw hex (dark) | Raw hex (light) | Token | Dark | Light | Role |
|---|---|---|---|---|---|
| `#0a100d` | `#faf9f6` | `--void-0` | `#0a100d` | `#faf9f6` | Page ground (root frames `3:4` / `20:7`) |
| `#101613` | `#f2f4f1` | `--void-1` | `#101613` | `#f2f4f1` | Recessed — the library search field (9:45) only |
| `#131a16` | `#ffffff` | `--void-2` | `#131a16` | `#ffffff` | Panel / card surface |
| `#1d2520` | `#f2f4f1` | `--void-3` | `#1d2520` | `#f2f4f1` | Inset surface inside a panel — chips, tiles, segmented controls, list rows, and the standard text-input / select ground (`16:376`, `9:48`) |

> In dark, "inset" is **lighter** than the panel; in light it is **darker** than the
> panel. Same semantic role, so it is one token.

### Gold accent

| Raw hex (dark) | Raw hex (light) | Token | Dark | Light | Role |
|---|---|---|---|---|---|
| `#a68a56` | `#7a6a38` | `--accent` | `#a68a56` | `#a68a56` | Gold accent: labels, ornament, secondary buttons, emphasis borders |
| `#8b7a40` | `#8b7a40` | `--accent-mid` | `#8b7a40` | `#8b7a40` | De-emphasised gold text (mini-card type lines) |
| `#6b5837` | `#e1e4e1` | `--accent-dim` | `#6b5837` | `#e1e4e1` | Card / section borders, slider tracks |
| `#1a1008` | — | `--accent-soft` | `#1a1008` | `#f2f4f1` | Gold-tinted card ground (deck-builder mini card renders) |
| `#2c1810` | — | `--accent-deep` | `#2c1810` | `#e1e4e1` | Gold-tinted badge ground on those cards |
| `#a68a56` | `#a68a56` | `--accent-glow` | `166, 138, 86` | `166, 138, 86` | **RGB tuple.** Use as `rgba(var(--accent-glow), a)` |
| `#6b5837` | `#e1e4e1` | `--accent-dim-glow` | `107, 88, 55` | `225, 228, 225` | **RGB tuple** for `rgba(107,88,55,0.4)` borders in the deck builder |

### Crimson (primary action)

| Raw hex (dark) | Raw hex (light) | Token | Dark | Light | Role |
|---|---|---|---|---|---|
| `#a22c29` | `#a22c29` | `--crimson` | `#a22c29` | `#a22c29` | Primary CTA fill, live badges, "creatures" category rule |
| `#6b1d1a` | `#fbebeb` | `--crimson-soft` | `#6b1d1a` | `#fbebeb` | Tinted crimson surface behind crimson text (hero pill, AI chat bubble, forecast strip) |
| `rgba(144,41,35,…)` | same | `--crimson-glow` | `144, 41, 35` | `144, 41, 35` | **RGB tuple** the design's red glows use. Slightly deeper than `--crimson` — that is what Figma reports |

### Text

| Raw hex (dark) | Raw hex (light) | Token | Dark | Light | Role |
|---|---|---|---|---|---|
| `#d6d5c9` | `#151816` | `--cream` | `#d6d5c9` | `#151816` | Primary text + all headings |
| `#b9baa3` | `#525955` | `--muted` | `#b9baa3` | `#525955` | Secondary / body copy, nav links |
| — | `#7b8380` | `--faint` | `#7b8380` | `#7b8380` | Tertiary: timestamps, legal line, placeholders |
| `#0a100d` | `#ffffff` | `--on-accent` | `#0a100d` | `#ffffff` | Text sitting **on** an `--accent` / `--crimson` fill |

### Lines

| Raw value (dark) | Raw value (light) | Token | Dark | Light | Role |
|---|---|---|---|---|---|
| `rgba(166,138,86,0.2)` | `#e1e4e1` | `--line` | `rgba(var(--accent-glow), 0.2)` | `#e1e4e1` | Default hairline: header/footer rules, dividers, subtle borders |
| `#6b5837` | `#e1e4e1` | `--line-strong` | `#6b5837` | `#e1e4e1` | Feature-card and section borders |
| `#a68a56` | `#a68a56` | `--line-accent` | `#a68a56` | `#a68a56` | Emphasised (featured / selected) border |

### Elevation

| Raw value (dark) | Raw value (light) | Token |
|---|---|---|
| *(derived)* | `0px 6px 6px rgba(10,16,13,0.04)` | `--shadow-1` |
| *(derived)* | `0px 12px 12px rgba(10,16,13,0.06)` | `--shadow-2` |
| `0px 12px 24px rgba(0,0,0,0.67)` | `0px 12px 24px rgba(10,16,13,0.06)` | `--shadow-3` |
| `0px 8px 24px rgba(0,0,0,0.8)` | *(derived)* | `--shadow-4` |
| `rgba(0,0,0,0.75)` | `rgba(255,255,255,0.9)` | `--scrim` |

Theme-invariant glows (declared once in `:root`):

| Raw value | Token |
|---|---|
| `0px 0px 8px rgba(144,41,35,0.27)` | `--glow-crimson-sm` |
| `0px 0px 48px rgba(144,41,35,0.13)` | `--glow-crimson-lg` |
| `0px 0px 8px 2px rgba(163,138,87,0.4)` | `--glow-accent` |

### MTG mana

The design defines **no MTG mana palette** — its colour pickers use neutral surfaces
(`--void-3`) with the *selected* state filled by `#111` (black) or `#a22c29` (red).
So the legacy mana values are carried over unchanged, in both themes.

| Token | Value | Role |
|---|---|---|
| `--mana-w` | `#f0ead8` | White |
| `--mana-u` | `#1460a8` | Blue |
| `--mana-b` | `#150c05` | Black |
| `--mana-r` | `#c81808` | Red |
| `--mana-g` | `#0f6030` | Green |
| `--mana-c` | `#a89888` | Colourless / generic |

### Deck category accents

| Raw hex | Token | Both themes | Role |
|---|---|---|---|
| `#a22c29` | `--type-creature` | `#a22c29` | Creatures rule / mana-curve bar |
| `#a68a56` | `--type-spell` | `#a68a56` | Instants & sorceries rule / bar |
| `#4a6741` | `--type-land` | `#4a6741` | Lands rule / bar |

---

## Typography

| Token | Value | Design usage |
|---|---|---|
| `--font-display` | `var(--font-dm-serif-text, 'DM Serif Text'), Georgia, 'Times New Roman', serif` | All headings, wordmark, stat numbers, prices, mana pips |
| `--font-ui` | `var(--font-dm-sans, 'DM Sans'), system-ui, …` | Buttons, labels, nav |
| `--font-body` | `var(--font-dm-sans, 'DM Sans'), system-ui, …` | Body copy |
| `--font-mono` | `var(--font-jetbrains-mono, 'JetBrains Mono'), ui-monospace, …` | Not in the design — kept for code/deck-list surfaces |

**Google Fonts Wave 2a must load** (see the comment block at the top of `globals.css`
for the exact `next/font` snippet):

- **DM Serif Text** — weight `400` (the only weight the family ships)
- **DM Sans** — weights `400`, `500`, `600`, `700` (design uses Regular/SemiBold/Bold;
  500 is listed so a Medium exists if a primitive needs one)
- JetBrains Mono — `400`, `500`, **only if** a screen actually uses `--font-mono`

Every DM Sans node in the design carries `font-variation-settings: "opsz" 14`; this is
applied once on `body` in `globals.css`, so components must not repeat it.

### Type scale (px verbatim from the design)

| Token | Size | Design usage |
|---|---|---|
| `--text-pico` | 5px | deck-builder mini-card renders only |
| `--text-nano` | 6px | mini-card art labels |
| `--text-micro` | 7px | mini-card body text |
| `--text-3xs` | 8px | mini-card |
| `--text-2xs` | 9px | mini-card |
| `--text-xs` | 10px | badges, timestamps, curve labels |
| `--text-sm` | 11px | uppercase labels, chips, pill text |
| `--text-md` | 12px | eyebrows, button text, small caps |
| `--text-base` | 13px | body small, card copy, chat text |
| `--text-lg` | 14px | body, nav links, primary button (also the `body` default) |
| `--text-xl` | 15px | footer column headings |
| `--text-2xl` | 16px | lead paragraphs, panel titles |
| `--text-3xl` | 18px | hero lead, panel headings |
| `--text-4xl` | 20px | card headings, footer wordmark |
| `--text-5xl` | 22px | header wordmark |
| `--text-6xl` | 24px | deck title |
| `--text-7xl` | 28px | pricing tier name |
| `--text-8xl` | 38px | large display |
| `--text-9xl` | 40px | stat numbers |
| `--text-10xl` | 44px | section headings, prices |
| `--text-11xl` | 48px | large display |
| `--text-hero` | 56px | hero headline |

### Line heights

| Token | Value | Design usage |
|---|---|---|
| `--leading-tight` | 1.05 | hero headline |
| `--leading-snug` | 1.15 | section headings |
| `--leading-normal` | 1.3 | dense mini-card copy |
| `--leading-body` | 1.4 | chat bubbles |
| `--leading-relaxed` | 1.5 | card + footer copy (body default) |
| `--leading-loose` | 1.6 | lead paragraphs |

### Letter spacing — **assumption, not harvested**

Figma reports no `letterSpacing` anywhere in the file, but every uppercase micro-label
reads as tracked out. `--tracking-normal: 0`, `--tracking-label: 0.04em`,
`--tracking-wide: 0.08em` are an addition.

---

## Spacing scale

Named by px so it can never be misread. The design is strictly on a 2/4px grid.

`--space-2` 2 · `--space-4` 4 · `--space-6` 6 · `--space-8` 8 · `--space-10` 10 ·
`--space-12` 12 · `--space-16` 16 · `--space-20` 20 · `--space-24` 24 · `--space-32` 32 ·
`--space-40` 40 · `--space-48` 48 · `--space-64` 64 · `--space-80` 80 · `--space-100` 100 ·
`--space-120` 120 · `--space-180` 180

Notable design usages: section padding `100px` vertical / `80px` horizontal, hero top
`180px` (dark) / `120px` (light), section stack gap `64px`, card grid gap `32px`,
panel padding `20px`, card padding `16px`, deck-builder gutters `40px`.

---

## Radii

| Token | Value | Design usage |
|---|---|---|
| `--radius-xs` | 1px | 1px category rules |
| `--radius-2xs` | 2px | slider tracks, category bars |
| `--radius-sm` | 4px | buttons, tags, format chips |
| `--radius-md` | 6px | inputs, segmented controls, mini cards, analytics tiles |
| `--radius` | 8px | **default** — chat bubbles, zoom previews, avatars |
| `--radius-lg` | 12px | panels, feature cards, MTG card frames |
| `--radius-xl` | 16px | pricing cards |
| `--radius-pill` | 20px | pills, mana-colour pickers |
| `--radius-full` | 999px | circles |

Also present in the design: `3px` (format dots — use `--radius-2xs`) and `18px`
(one testimonial avatar — use `--radius-pill`).

---

## Layout & motion

| Token | Value | Note |
|---|---|---|
| `--page-max` | 1440px | Figma frame width |
| `--page-pad` | 80px | landing / marketing gutters |
| `--page-pad-app` | 40px | deck-builder / dashboard gutters |
| `--header-h` | 100px | header frames `3:5` / `20:8` |
| `--ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | addition (design specifies no motion) |
| `--dur-fast` / `--dur` / `--dur-slow` | 0.15s / 0.25s / 0.4s | `--dur` matches the legacy standard |
| `--transition` | `all var(--dur) ease` | the project's standard interactive transition |

---

## Keyframes

All keyframes live in `globals.css` only; components reference them from their own CSS.

Ported from legacy: `spinCW`, `spinCCW`, `pulse`, `sealPulse`, `dotPulse`, `messageIn`,
`panelIn`, `hoverIn`, `fadeBreath`, `marquee`, `marquee-reverse`, `toastIn`.

New in v2 (implied by the design): `fadeIn`, `barGrow` (mana-curve bars),
`emberPulse` (crimson live badge), `shimmer` (card-grid skeleton while generating),
`floatY` (tilted hero card frames).

`@media (prefers-reduced-motion: reduce)` neutralises all of them globally.

---

## Where each value came from

| Node | What it gave |
|---|---|
| `3:4` | dark page ground `#0a100d`, full dark hex + radius + type inventory |
| `3:5` | header: wordmark 22px, nav 14px `#b9baa3`, CTA `#a22c29` on `#a68a56` border |
| `3:18` | hero: 56px headline, `#6b1d1a`/`#a22c29` pill, crimson drop shadow, 180px top pad |
| `3:78` | stats band: `#131a16` on `#6b5837` top/bottom borders, 40px numbers |
| `3:91` | feature cards: `#131a16` + `#6b5837`, `12px`/`6px` radii, 44px section heading |
| `3:187` | pricing: `16px` radius, `rgba(166,138,86,0.2)` divider, `#0a100d` text on gold/crimson fills |
| `3:331` | footer: `rgba(166,138,86,0.2)` top border, 15px column headings, 11px legal |
| `20:7` | light page ground `#faf9f6`, full light hex inventory |
| `20:8` | light header: `#151816`, `#525955`, `#e1e4e1`, white text on crimson |
| `20:22` | light hero: `#fbebeb` pill, `rgba(10,16,13,0.04)` shadow, 120px top pad |
| `20:84` | light stats band: `#ffffff` on `#e1e4e1` |
| `20:97` | light feature cards: `#ffffff` + `#e1e4e1` + `0 6px 6px rgba(10,16,13,0.04)` |
| `20:368` | light footer: `#e1e4e1` divider, `#7b8380` legal text |
| `10:22` | dark deck builder: `#101613` inputs, `#1d2520` insets, `#1a1008`/`#2c1810` mini cards, `#8b7a40`, `#4a6741`, `rgba(107,88,55,0.4)`, `rgba(163,138,87,0.4)` glow, `0 8px 24px rgba(0,0,0,0.8)` |
| `20:665` | light deck builder: `#f2f4f1` insets, `#fbebeb` AI bubble, `#7b8380` placeholders, `0 12px 24px rgba(10,16,13,0.06)` |

---

## Unresolved / assumed

Everything the design did **not** state, and what was assumed instead:

1. **`--faint` in dark.** The design only defines a tertiary text colour in light
   (`#7b8380`). Dark reuses the same value — it reads acceptably on `#0a100d`.
2. **Light `--accent-soft` / `--accent-deep`.** The dark deck builder tints its mini
   cards gold (`#1a1008`, `#2c1810`); the light deck builder uses plain neutrals for
   the same elements, so light maps them to `#f2f4f1` / `#e1e4e1` rather than inventing
   pale golds.
3. **Light `--accent-dim`.** Light never uses a mid-gold border, so it collapses to
   `#e1e4e1` (the same as `--line`).
4. **`--shadow-1` / `--shadow-2` in dark and `--shadow-4` in light.** The design only
   specifies two dark shadows and three light ones. The missing rungs are derived to
   keep one ladder usable in both themes.
5. **`#1a1200`** appears once in the dark deck builder as an alternate mini-card badge
   ground. It is folded into `--accent-deep` (`#2c1810`).
6. **Letter spacing.** See the note above — the three `--tracking-*` values are added,
   not measured.
7. **Motion.** The Figma file carries no prototype/motion data, so `--ease`, the
   durations, and the new keyframes are additions consistent with the legacy app.
8. **MTG mana palette.** Not defined by the design; legacy values retained.

---

## How to add a token

1. Decide whether it is **theme-varying**. If yes it must be declared in **all three**
   blocks of `globals.css`: `:root`, `:root[data-theme="light"]`, and the
   `@media (prefers-color-scheme: light)` block. Never let a colour's only definition
   live inside the media query. If it is theme-invariant, declare it once in `:root`,
   below the `Theme-invariant tokens` divider.
2. Put it in the **existing group** it belongs to (Surfaces / Gold accent / Crimson /
   Text / Lines / Elevation / Mana / Category / Fonts / Type / Spacing / Radii /
   Layout / Motion) and keep the group's comment accurate. Add a new group only for a
   genuinely new category.
3. If it is a colour that will ever be used with alpha, add an **RGB tuple** token
   (`232, 199, 106` style, no `rgb()` wrapper) so callers can write
   `rgba(var(--x), 0.4)`. Never hardcode the channels at the call site.
4. Add a row to the matching table in this file, with the raw design hex it came from
   and the node it was harvested on.
5. If the value is **not** in the design, say so in
   [Unresolved / assumed](#unresolved--assumed).
