'use client';

import { useId, useState, type FormEvent } from 'react';

import { MAX_TAG_LENGTH, MAX_TAGS, normalizeTag } from '../../lib/deckTags';
import { Button } from '../Button/Button';
import './TagEditor.css';

/* ==========================================================================
   TagEditor — the owner's tags on a deck, as removable chips plus an add
   field. Tags are normalised as they are added (lowercase, trimmed, unique),
   with the same limits the API enforces, so the server rarely has to refuse.
   ========================================================================== */

interface TagEditorProps {
  tags: string[];
  /** Called with the full next list. Omit to render the tags read-only. */
  onChange?: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagEditor({ tags, onChange, disabled = false }: TagEditorProps) {
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const full = tags.length >= MAX_TAGS;

  if (!onChange) {
    if (!tags.length) return null;
    return (
      <div className="tag-editor">
        <span className="tag-editor-label">Tags</span>
        <ul className="tag-editor-list">
          {tags.map((tag) => (
            <li key={tag} className="tag-editor-chip tag-editor-chip-static">
              {tag}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const add = (event: FormEvent) => {
    event.preventDefault();
    const tag = normalizeTag(draft);
    if (!tag) return;
    if (tag.length > MAX_TAG_LENGTH) {
      setProblem(`Tags can be at most ${MAX_TAG_LENGTH} characters.`);
      return;
    }
    if (tags.includes(tag)) {
      setProblem(`“${tag}” is already on this deck.`);
      return;
    }
    if (full) {
      setProblem(`A deck can have at most ${MAX_TAGS} tags.`);
      return;
    }
    setProblem(null);
    setDraft('');
    onChange([...tags, tag]);
  };

  return (
    <div className="tag-editor">
      <label className="tag-editor-label" htmlFor={inputId}>
        Tags
      </label>
      {tags.length ? (
        <ul className="tag-editor-list">
          {tags.map((tag) => (
            <li key={tag} className="tag-editor-chip">
              {tag}
              <button
                type="button"
                className="tag-editor-remove"
                aria-label={`Remove tag ${tag}`}
                disabled={disabled}
                onClick={() => onChange(tags.filter((existing) => existing !== tag))}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tag-editor-empty">No tags yet — add a few so others can find this deck.</p>
      )}
      <form className="tag-editor-form" onSubmit={add}>
        <input
          id={inputId}
          className="tag-editor-input"
          value={draft}
          maxLength={MAX_TAG_LENGTH + 8}
          placeholder={full ? 'Tag limit reached' : 'e.g. aggro'}
          disabled={disabled || full}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setProblem(null);
          }}
        />
        <Button type="submit" variant="outline" size="xs" disabled={disabled || full || !draft.trim()}>
          Add tag
        </Button>
      </form>
      {problem ? (
        <p className="tag-editor-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
