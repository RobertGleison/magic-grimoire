import './Spinner.css';

interface SpinnerProps {
  /** Ring diameter. `xs` is sized to sit inline inside a button label. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /**
   * Screen-reader text announced while the ring spins. Pass an empty string
   * when the surrounding element already carries the loading semantics
   * (a `Button` with `aria-busy`, for instance).
   */
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label = 'Loading', className = '' }: SpinnerProps) {
  return (
    <span className={`spinner spinner-${size} ${className}`.trim()} role="status">
      <span className="spinner-ring" aria-hidden="true" />
      {label ? <span className="visually-hidden">{label}</span> : null}
    </span>
  );
}
