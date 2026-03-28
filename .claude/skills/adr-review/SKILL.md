---
name: adr-review
description: "Review a new or draft ADR against all existing ADRs for inconsistencies, contradictions, and redundancies before merging. Triggers on: review adr, check adr, adr inconsistency, validate adr, adr conflict."
user-invocable: true
---

# ADR Review

Read the new/draft ADR and all existing ADRs, then produce a consistency report before the decision is merged.

---

## Your Role

You are a senior architect auditing a proposed ADR against the project's established decisions. You surface contradictions, redundancies, and gaps — without blocking good decisions. Be direct: if something conflicts, say so clearly. If everything is consistent, say that too.

---

## The Flow

### Step 1 — Identify the ADR to review

The user will either:
- Pass a file path (e.g. `/adr-review docs/adr/ADR-0003-foo.md`)
- Describe the decision in natural language

If they passed a path, read that file. If they described a decision in natural language, ask them to paste the draft content or point to the file.

---

### Step 2 — Load all existing ADRs

1. Read `docs/adr/index.md` to get the list of all accepted ADRs.
2. Read each ADR file listed in the index.
3. Build a mental model of the established decisions, focusing on:
   - **Technologies chosen** (languages, frameworks, libraries, services)
   - **Patterns mandated** (async-only, no sync ORM, DTOs over ORM exposure, etc.)
   - **Constraints accepted** (vendor lock-in, auth strategy, caching rules, etc.)
   - **Options explicitly rejected** and why

---

### Step 3 — Analyze the draft ADR

Check the draft against every existing ADR for:

| Issue Type | What to look for |
|---|---|
| **Direct contradiction** | Draft chooses X; an existing ADR chose not-X and the reasoning still applies |
| **Redundancy** | Draft re-decides something already decided; no new context justifies reopening it |
| **Dependency conflict** | Draft assumes a stack/service that was explicitly rejected or not yet adopted |
| **Gap / missing link** | Draft decision affects an area covered by an existing ADR but doesn't reference it |
| **Supersession** | Draft intentionally overrides a prior decision — needs to be marked clearly |

---

### Step 4 — Output the review report

Structure the report as follows:

```
## ADR Review: {Draft Title}

### Verdict
{One of: ✅ Consistent | ⚠️ Minor issues | ❌ Conflicts found}

{One sentence summary of overall finding.}

---

### Conflicts
{If none: "No direct conflicts found."}

{If conflicts exist, for each one:}

**[CONFLICT]** Draft proposes X — contradicts **ADR-{id}** which decided Y because {reason}.
> Suggestion: {how to resolve — either align with prior decision, or explicitly supersede it}

---

### Redundancies
{If none: "No redundancies found."}

{If any:}

**[REDUNDANT]** Section "{section}" re-decides {topic} already covered in **ADR-{id}**.
> Suggestion: Remove or reference the existing decision instead.

---

### Missing References
{If none: "No missing cross-references."}

{If any:}

**[LINK]** This decision touches {topic} covered in **ADR-{id}** — add it to the Related section.

---

### Supersessions
{If none: "No prior decisions are overridden."}

{If any:}

**[SUPERSEDES]** This ADR replaces **ADR-{id}** ({title}). Mark that ADR as `Superseded` and add a forward reference.

---

### Summary

{2–4 sentences: overall health of the draft, what must change before merge (if anything), and what is fine as-is.}
```

---

### Step 5 — Offer to fix issues

After the report, ask:

```
Would you like me to:
A. Update the draft ADR to add missing references and fix minor issues
B. Open the conflicting ADRs to update their status (e.g. mark as Superseded)
C. Both
D. No changes — just the report is enough
```

Apply only what the user confirms.

---

## Tone Guidelines

- Flag real problems clearly. Don't soften a conflict into a "consideration."
- Don't invent problems. If an ADR is consistent, say it plainly.
- Be specific: reference ADR IDs and quote relevant sections, don't be vague.
- A draft that supersedes a prior decision is not a conflict — it's expected. Just make sure it's explicit.
