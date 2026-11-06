/// The mark: a sun half risen over a single line. Morning, and the line it pays for. Two flat
/// colours, no gradient, and three short rays so it reads as a sunrise even at favicon size.
/// The baseline takes the text colour, so it works on paper and on night.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none", display: "block" }}
    >
      <g stroke="var(--dawn)" strokeWidth="1.75" strokeLinecap="round">
        <path d="M12 4v2.4M5.6 7.2l1.6 1.6M18.4 7.2l-1.6 1.6" />
      </g>
      <path d="M6.5 16a5.5 5.5 0 0 1 11 0Z" fill="var(--dawn)" />
      <rect x="2" y="18" width="20" height="2.4" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <>
      <LogoMark />
      <span>Morning Line</span>
    </>
  );
}
