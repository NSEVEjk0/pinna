/**
 * The Pinna mark: a single tall fern frond, drawn geometrically — a stem with
 * leaflets stepping up its length, tapering to a point. Sage on charcoal.
 */
export function Fern({ size = 40, className }: { size?: number; className?: string }) {
  const leaflets = Array.from({ length: 7 }, (_, i) => i);
  return (
    <svg
      width={size}
      height={size * 1.45}
      viewBox="0 0 60 87"
      fill="none"
      className={className}
      role="img"
      aria-label="Pinna"
    >
      <g stroke="#7A9A7E" strokeWidth="1.6" strokeLinecap="round">
        <path d="M30 84 L30 15" />
        {leaflets.map((i) => {
          const y = 70 - i * 9;
          const reach = 19 - i * 2.1;
          return (
            <g key={i}>
              <path d={`M30 ${y} L${30 - reach} ${y - reach * 0.62}`} />
              <path d={`M30 ${y} L${30 + reach} ${y - reach * 0.62}`} />
            </g>
          );
        })}
        <path d="M30 15 L25 6" strokeWidth="1.2" />
        <path d="M30 15 L35 6" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
      <Fern size={17} />
      <span
        className="display"
        style={{ fontSize: "1.45rem", letterSpacing: "-0.01em", lineHeight: 1 }}
      >
        Pinna
      </span>
    </span>
  );
}
