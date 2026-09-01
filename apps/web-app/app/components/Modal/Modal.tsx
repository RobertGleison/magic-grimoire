'use client';

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

/**
 * Anything tabbable. `:not([disabled])` keeps the trap from parking focus on a
 * dead control, and it is deliberately not filtered by visibility — jsdom
 * reports every element as unrendered, which would empty the list in tests.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalProps {
  open: boolean;
  /** Called for Escape, the scrim, and the close button. */
  onClose: () => void;
  /** Becomes the dialog's accessible name via `aria-labelledby`. */
  title: string;
  /** Optional sub-heading, wired up with `aria-describedby`. */
  description?: string;
  /** `sm` 420 / `md` 560 / `lg` 720 max width. */
  size?: 'sm' | 'md' | 'lg';
  /** Set false for destructive flows that must not be dismissed by accident. */
  closeOnScrimClick?: boolean;
  /** Right-aligned action row. */
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnScrimClick = true,
  footer,
  className = '',
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const autoId = useId();
  const titleId = `modal-title-${autoId}`;
  const descriptionId = `modal-description-${autoId}`;

  // Portals need a document; this component still renders on the server.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Move focus in on open, hand it back to the trigger on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const target = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? dialog;
    target?.focus();
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open, mounted]);

  // Freeze the page behind the dialog.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Escape to close, Tab cycling clamped to the dialog's own controls.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === dialog || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const handleScrimClick = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnScrimClick && event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div className="modal-scrim" data-testid="modal-scrim" onClick={handleScrimClick}>
      <div
        ref={dialogRef}
        className={`modal modal-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path
                d="M3 3l8 8M11 3l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {description ? (
          <p className="modal-description" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {children ? <div className="modal-body">{children}</div> : null}
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
