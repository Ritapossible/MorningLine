"use client";

import { useEffect, useState } from "react";
import { IS_DEMO } from "../lib/contracts";

type Status =
  | { reachable: false }
  | { reachable: true; lastSuccessAt: string | null; failing: boolean; matches: boolean; reportsSent: number };

/// How long without a successful run before it counts as stalled. The demo checks every 20
/// seconds against 3-minute days; production every 10 minutes against 24-hour days.
const STALE_MS = IS_DEMO ? 2 * 60_000 : 30 * 60_000;

/// One quiet line saying whether the checker is running. If it stops, nobody's money is stuck:
/// unreported days go back to the sponsor once their window closes. Silence is shown, not hidden.
export function CheckerStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/checker")
        .then((r) => r.json())
        .then((s: Status) => alive && setStatus(s))
        .catch(() => alive && setStatus({ reachable: false }));
    void load();
    const poll = setInterval(load, 15_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  if (status === null) return null;

  let cell = "live";
  let text: string;
  if (!status.reachable) {
    cell = "due";
    text = "Checker status unavailable";
  } else if (!status.matches) {
    cell = "reclaimed";
    text = "The running checker is not the one this site opens deals with";
  } else if (status.lastSuccessAt === null) {
    cell = "due";
    text = "Checker starting";
  } else {
    const ago = Math.max(0, now - Date.parse(status.lastSuccessAt));
    if (ago > STALE_MS) {
      cell = "reclaimed";
      text = `Checker has not run for ${ageText(ago)}. Unreported days go back to the sponsor`;
    } else {
      text = `Checker ran ${ageText(ago)} ago`;
    }
  }

  return (
    <span className={`checker-status${className ? ` ${className}` : ""}`} role="status">
      <i className={`cell ${cell}`} aria-hidden="true" />
      {text}
    </span>
  );
}

function ageText(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.round(m / 60)} h`;
}
