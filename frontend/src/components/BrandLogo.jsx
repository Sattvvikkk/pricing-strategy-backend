/**
 * NextGen BI brand logo — circle with rising arrow + chart nodes.
 * Inline SVG so it inherits color from `currentColor` and scales crisply.
 */
export default function BrandLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Open circle (gap at top-right where arrow exits) */}
      <path
        d="M52 18.5 A26 26 0 1 0 56 36"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Chart line inside the circle */}
      <path
        d="M16 40 L24 32 L32 36 L40 24"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Chart nodes */}
      <circle cx="16" cy="40" r="2.5" fill="currentColor" />
      <circle cx="24" cy="32" r="2.5" fill="currentColor" />
      <circle cx="32" cy="36" r="2.5" fill="currentColor" />
      {/* Rising arrow exiting top-right */}
      <path
        d="M40 24 L56 8"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M44 8 L56 8 L56 20"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
