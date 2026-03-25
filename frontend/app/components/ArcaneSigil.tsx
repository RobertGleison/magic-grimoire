export function ArcaneSigil() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="arcane-bg" aria-hidden="true">
      <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <polygon
        points="100,18 117,72 172,72 128,105 144,158 100,126 56,158 72,105 28,72 83,72"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 100 + 88 * Math.cos(rad);
        const y1 = 100 + 88 * Math.sin(rad);
        const x2 = 100 + 82 * Math.cos(rad);
        const y2 = 100 + 82 * Math.sin(rad);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="0.8" />;
      })}
    </svg>
  );
}
