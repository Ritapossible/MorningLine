"use client";

import { commitUrl } from "../lib/github";
import { timestamp, untilText } from "../lib/format";

export type DayCell = {
  day: number;
  /// paid and refunded came from a check; reclaimed means nobody checked in time.
  state: "paid" | "refunded" | "reclaimed" | "waiting" | "due" | "lapsed";
  sha?: string;
  opens: bigint;
  closes: bigint;
};

const LABEL: Record<DayCell["state"], string> = {
  paid: "the line was there, the maintainer was paid",
  refunded: "the line was missing, the sponsor was refunded",
  reclaimed: "nobody checked in time, the sponsor took this day back",
  waiting: "has not started yet",
  due: "open now, waiting on a check",
  lapsed: "nobody checked and the window has closed, the sponsor can reclaim it",
};

export function DayStrip({
  cells,
  repo,
  now,
}: {
  cells: DayCell[];
  repo: string;
  now: bigint;
}) {
  return (
    <div>
      <div className="strip">
        {cells.map((c) => {
          const when =
            c.state === "waiting"
              ? `opens ${untilText(c.opens, now)}`
              : c.state === "due"
                ? `closes ${untilText(c.closes, now)}`
                : timestamp(c.opens);
          const title = `Day ${c.day + 1}: ${LABEL[c.state]} (${when})`;
          const cls = `day ${c.state === "lapsed" ? "waiting" : c.state}`;

          if (c.sha !== undefined && repo !== "") {
            return (
              <a
                key={c.day}
                className={cls}
                href={commitUrl(repo, c.sha.replace(/^0x/, ""))}
                title={`${title}. Opens the commit that was read.`}
                target="_blank"
                rel="noreferrer"
              >
                {c.day + 1}
              </a>
            );
          }
          return (
            <span key={c.day} className={cls} title={title}>
              {c.day + 1}
            </span>
          );
        })}
      </div>

      <p className="legend" style={{ marginTop: 12 }}>
        <span><i style={{ background: "var(--dawn)" }} />paid</span>
        <span><i style={{ background: "var(--dusk)" }} />refunded</span>
        <span><i style={{ background: "var(--lapse)" }} />reclaimed</span>
        <span><i style={{ border: "1px dashed var(--border-strong)" }} />waiting</span>
      </p>
      <p className="small" style={{ marginTop: 6 }}>
        Every settled day links to the commit the checker read. Open it and the file is there,
        exactly as it was.
      </p>
    </div>
  );
}
