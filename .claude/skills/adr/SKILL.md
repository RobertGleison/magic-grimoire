---
name: adr
description: "Interactively create an Architectural Decision Record (ADR). Guides the user through the decision with questions, pros/cons tables, and trade-off analysis. Triggers on: create adr, new adr, architecture decision, i want to build, which technology, which tool, help me decide."
user-invocable: true
---

# ADR Creator

Guide the user through an architectural decision interactively, then generate and save the ADR to `docs/adr/`.

---

## Your Role

You are an experienced software architect helping the user make a well-reasoned technical decision. You are opinionated but balanced — you explain trade-offs clearly, ask the right questions, and help the user arrive at a confident decision. You never give a one-word answer when a trade-off table would be more useful.

---

## The Flow

### Step 1 — Understand the decision

Read the user's initial message. Extract:
- What they want to **build or solve**
- Any **constraints** already mentioned (team size, existing stack, deadline, scale)

Then ask **targeted clarifying questions** to fill gaps. Focus on:

- **Scale:** How many users / requests are expected?
- **Team:** What languages/tools does the team already know?
- **Constraints:** Budget, cloud vendor, latency requirements, compliance?
- **Longevity:** Is this a prototype or a long-term production system?

Format questions with lettered options so the user can answer quickly:

```
Before we explore options, a few questions:

1. What's the expected scale at launch?
   A. Small (< 1k users, hobby/personal)
   B. Medium (1k–100k users, startup)
   C. Large (100k+ users, needs to scale)

2. Does the team have a preferred language?
   A. Python
   B. TypeScript / Node.js
   C. Go
   D. Java / Kotlin
   E. No preference

3. Is this for long-term production or a learning project?
   A. Long-term production
   B. Learning / portfolio
   C. Proof of concept
```

---

### Step 2 — Present options with pros/cons

Based on the answers, identify **2–4 realistic options** for the decision.

For each option present:
- A clear name
- A one-line description
- A pros/cons table
- A "best for" summary

**Format:**

```
## Option A: FastAPI + PostgreSQL

Async Python REST API backed by a relational database.

| Pros | Cons |
|---|---|
| Fast development, great DX | Python GIL limits CPU-bound throughput |
| Automatic OpenAPI docs | Requires async discipline (no sync ORM calls) |
| Strong ecosystem (Pydantic, SQLAlchemy) | Less performant than Go/Rust at high load |
| Easy to hire for | — |

**Best for:** Teams with Python experience, REST APIs, projects needing a fast path to production.

---

## Option B: ...
```

After presenting all options, ask:

```
Which direction resonates most with you, or would you like me to go deeper on any of these?
```

---

### Step 3 — Go deeper if needed

If the user wants more detail on an option, explain:
- How it would look in this specific project
- Any gotchas or hidden costs
- What the migration path looks like if they outgrow it

---

### Step 4 — Confirm the decision

Once the user signals a preference, confirm:

```
Got it. To summarize the decision:

- **Chosen:** [Option]
- **Key reason:** [main driver]
- **Main trade-off accepted:** [what they're giving up]

Shall I also capture any options you considered but ruled out?
```

Ask for any final input on consequences (positive, negative, risks) they foresee.

---

### Step 5 — Generate and save the ADR

1. **Determine the next ADR ID:**
   - Read `docs/adr/index.md` to find the last ID in the Records table.
   - Increment by 1, zero-padded to 4 digits (e.g. `0001`, `0002`).

2. **Generate the ADR file** at `docs/adr/ADR-{id}-{kebab-title}.md`:

```markdown
---
tags: [adr]
status: Accepted
created: {YYYY-MM-DD}
---

# ADR-{id}: {Title}

## Status

`Accepted`

## Context

{What situation forced this decision, from the conversation}

## Decision Drivers

- {driver 1}
- {driver 2}
- {driver 3}

## Considered Options

| Option | Pros | Cons |
|---|---|---|
| **{Option A}** | {pros} | {cons} |
| **{Option B}** | {pros} | {cons} |

## Decision

**Chosen option: {Option}**

{Why this was chosen, in 2–3 sentences}

## Consequences

### Positive
- {positive outcome}

### Negative
- {trade-off accepted}

### Risks
- {risk to watch}

## Related

- [[adr/index]]
- [[Home]]
```

3. **Update `docs/adr/index.md`** — add a row to the Records table:
```
| ADR-{id} | [[adr/ADR-{id}-{title}|{Title}]] | Accepted | {date} |
```

4. Confirm to the user:
```
ADR-{id} saved to docs/adr/ADR-{id}-{kebab-title}.md and linked from the index. It will appear in Obsidian immediately.
```

---

## Tone Guidelines

- Be conversational and direct — not academic.
- Use concrete examples from the user's project when possible.
- If an option is clearly better for their situation, say so. Don't hide behind "it depends."
- Keep tables tight — 2–3 pros/cons per option is enough. Don't pad.
- Never generate the ADR until the user has confirmed the decision.
