'use client';

import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import './Select.css';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Rendered as a real `<label>` bound with `htmlFor`. */
  label?: ReactNode;
  /** Validation message. Sets `aria-invalid` and joins `aria-describedby`. */
  error?: string;
  /** Always-visible helper text. Also joins `aria-describedby`. */
  hint?: string;
  /** `md` matches the deck-builder strategy select; `sm` the library sort (9:48). */
  size?: 'sm' | 'md';
  /** Convenience list. Ignored when `children` is supplied. */
  options?: SelectOption[];
  /** Disabled, empty-valued leading option. */
  placeholder?: string;
  wrapperClassName?: string;
  children?: ReactNode;
}

export function Select({
  label,
  error,
  hint,
  size = 'md',
  options,
  placeholder,
  id,
  className = '',
  wrapperClassName = '',
  children,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? `select-${autoId}`;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  const { 'aria-describedby': callerDescribedBy, ...selectProps } = rest;
  const describedBy =
    [callerDescribedBy, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={`select-field ${wrapperClassName}`.trim()}>
      {label ? (
        <label className="select-label" htmlFor={selectId}>
          {label}
        </label>
      ) : null}
      <div className="select-shell">
        <select
          id={selectId}
          className={`select-control select-control-${size} ${className}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...selectProps}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {children ??
            options?.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
        </select>
        <svg className="select-chevron" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path
            d="M1 3.2 5 7.2l4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {hint ? (
        <p className="select-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="select-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
