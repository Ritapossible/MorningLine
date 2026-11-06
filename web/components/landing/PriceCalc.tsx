"use client";

import Link from "next/link";
import { useState } from "react";
import { IS_DEMO } from "../../lib/contracts";

const TERMS = [7, 14, 30, 90];

/// What a deal costs and what the maintainer can receive. There is no USDC fee: the only cost
/// beyond the sponsorship is one LINE of fuel per daily check.
export function PriceCalc() {
  const [daily, setDaily] = useState(2);
  const [days, setDays] = useState(30);
  const total = daily * days;

  return (
    <div className="calc">
      <div className="calc-top">
        <div className="calc-row">
          <span>Price per day</span>
          <b className="calc-big">${daily.toFixed(2)}</b>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={daily}
          onChange={(e) => setDaily(Number(e.target.value))}
          aria-label="Price per day in USDC"
        />
        <div className="calc-scale small">
          <span>$1.00</span>
          <span>$50.00</span>
        </div>

        <span className="calc-label">The line stays up for</span>
        <div className="seg" role="radiogroup" aria-label="Number of days">
          {TERMS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={days === t}
              className={days === t ? "on" : ""}
              onClick={() => setDays(t)}
            >
              {t}d
            </button>
          ))}
        </div>
      </div>

      <div className="calc-bottom">
        <span className="calc-label">The maintainer can receive</span>
        <b className="calc-huge">${total.toFixed(2)}</b>
        <dl className="calc-lines">
          <dt>Paid out</dt>
          <dd className="mono">${daily.toFixed(2)} after each day is checked</dd>
          <dt>Fuel</dt>
          <dd className="mono">{days} LINE, one per check</dd>
          <dt>USDC fee</dt>
          <dd className="mono">none</dd>
          <dt>Line missing on a day</dt>
          <dd className="mono">that day back to the sponsor</dd>
          <dt>Nobody checks a day</dt>
          <dd className="mono">sponsor reclaims it after the grace period</dd>
        </dl>
        <Link href="/new" className="pill primary wide">
          Open a ${total.toFixed(2)} deal <span aria-hidden="true">→</span>
        </Link>
        <p className="small calc-note">
          USDC on Base. The maintainer pays no fee and no gas: payouts are sent by the daily check.
          {IS_DEMO ? " On this demo deployment a day lasts 3 minutes and the tokens are worthless." : ""}
        </p>
      </div>
    </div>
  );
}
