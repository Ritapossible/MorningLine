/// USDC has six decimals. Deals here are small, so two decimal places is always enough.
export function usd(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const cents = (amount % 1_000_000n) / 10_000n;
  return `${whole}.${cents.toString().padStart(2, "0")}`;
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export function shortSha(sha: string): string {
  return sha.replace(/^0x/, "").slice(0, 7);
}

/// "1 day", "180 seconds", "48 hours": whichever unit divides cleanly.
export function duration(seconds: bigint): string {
  const s = Number(seconds);
  if (s % 86_400 === 0) return plural(s / 86_400, "day");
  if (s % 3_600 === 0) return plural(s / 3_600, "hour");
  if (s % 60 === 0) return plural(s / 60, "minute");
  return plural(s, "second");
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/// How long until a unix second, or how long since. Deliberately coarse.
export function untilText(target: bigint, now: bigint): string {
  const d = Number(target - now);
  if (d <= 0) return `${duration(BigInt(Math.abs(d)))} ago`;
  return `in ${duration(BigInt(d))}`;
}

export function timestamp(unix: bigint): string {
  return new Date(Number(unix) * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
