/**
 * The two 14x14 glyphs the pricing screen uses, inlined as SVG so they can be
 * tinted from a token via `currentColor` instead of shipping a themed asset
 * per tier (the Figma export is three identical paths that differ only in
 * `stroke`: #B9BAA3 / #A68A56 / #A22C29).
 *
 *   sparkle  16:223 (hero pill), 16:240 / 16:270 / 16:302 (feature bullets)
 *   plus     16:446 / 16:449 / 16:452 / 16:455 (FAQ disclosure marker)
 *
 * Both are decorative: the adjacent text carries the meaning, so they are
 * hidden from the accessibility tree.
 */

interface IconProps {
  className?: string;
}

const SPARKLE_PATH =
  'M1.40137 12.1982C1.6221 12.1982 1.80078 12.3779 1.80078 12.5986C1.80063 12.8192 1.622 12.998 1.40137 12.998C1.18073 12.998 1.00211 12.8192 1.00195 12.5986C1.00195 12.3779 1.18064 12.1982 1.40137 12.1982ZM7.44043 4.64648C7.52999 5.1206 7.76039 5.55726 8.10156 5.89844C8.44274 6.23961 8.8794 6.47001 9.35352 6.55957L11.6826 7L9.35352 7.44043C8.8794 7.52999 8.44274 7.76039 8.10156 8.10156C7.76039 8.44274 7.52999 8.8794 7.44043 9.35352L7 11.6826L6.55957 9.35352C6.47001 8.8794 6.23961 8.44274 5.89844 8.10156C5.55726 7.76039 5.12059 7.52999 4.64648 7.44043L2.31641 7L4.64648 6.55957C5.1206 6.47001 5.55726 6.23961 5.89844 5.89844C6.23961 5.55726 6.47001 5.1206 6.55957 4.64648L7 2.31641L7.44043 4.64648Z';

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <path d={SPARKLE_PATH} />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.9162 7H11.0838M7 2.9162V11.0838" />
    </svg>
  );
}
