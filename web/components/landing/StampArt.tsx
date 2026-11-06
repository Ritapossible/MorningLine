import type { ReactNode } from "react";

/// A postage-stamp frame around a painted dawn. The frame's perforated edge and the sky are
/// pure CSS, so the page ships no images. `label` sits in the corner like a stamp's value;
/// `children` float over the painting.
export function StampArt({
  label,
  caption,
  tone = "dawn",
  children,
}: {
  label?: string;
  caption?: string;
  tone?: "dawn" | "dusk" | "lapse";
  children?: ReactNode;
}) {
  return (
    <div className="stamp">
      <div className={`stamp-art tone-${tone}`}>
        <span className="stamp-sun" aria-hidden="true" />
        <span className="stamp-hills" aria-hidden="true" />
        {label ? <span className="stamp-label">{label}</span> : null}
        {caption ? <span className="stamp-caption">{caption}</span> : null}
        {children ? <div className="stamp-over">{children}</div> : null}
      </div>
    </div>
  );
}

/// The small card that floats over a stamp: an icon, two lines, and an optional status,
/// marked with a day cell rather than a coloured pill.
export function FloatChip({
  icon,
  title,
  sub,
  status,
  cell = "paid",
  className,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  status?: string;
  cell?: "paid" | "refunded" | "reclaimed" | "due" | "live";
  className?: string;
}) {
  return (
    <div className={`float-chip${className ? ` ${className}` : ""}`}>
      <span className="float-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="float-text">
        <b>{title}</b>
        <span className="mono">{sub}</span>
      </span>
      {status ? (
        <span className="status">
          <i className={`cell ${cell}`} aria-hidden="true" />
          {status}
        </span>
      ) : null}
    </div>
  );
}

export const Icon = {
  lock: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v4" />
      <rect x="4" y="7.5" width="16" height="11.5" rx="2.5" />
      <path d="M16 13.2h1.5" />
    </svg>
  ),
  commit: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M2 12h6.5M15.5 12H22" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
};
