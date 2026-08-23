'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import './Input.css';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Rendered as a real `<label>` bound with `htmlFor`. */
  label?: ReactNode;
  /** Validation message. Sets `aria-invalid` and joins `aria-describedby`. */
  error?: string;
  /** Always-visible helper text. Also joins `aria-describedby`. */
  hint?: string;
  /** `md` matches the auth-card field (16:376); `sm` the library search (9:45). */
  size?: 'sm' | 'md';
  /** Class for the label + control + message wrapper, not the control itself. */
  wrapperClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  size = 'md',
  id,
  className = '',
  wrapperClassName = '',
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? `input-${autoId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const { 'aria-describedby': callerDescribedBy, ...inputProps } = rest;
  const describedBy =
    [callerDescribedBy, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={`input-field ${wrapperClassName}`.trim()}>
      {label ? (
        <label className="input-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`input-control input-control-${size} ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {hint ? (
        <p className="input-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="input-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
