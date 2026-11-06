/// The hero's night-mode deal card. It is an illustration, labelled as an example, and every
/// number on it is consistent: 30 days at $1.00, 26 paid, 2 refunded, 2 still to come.
export function DealCardMock() {
  const days: ("paid" | "refunded" | "due" | "waiting")[] = Array.from({ length: 30 }, (_, i) => {
    if (i === 11 || i === 12) return "refunded";
    if (i < 28) return "paid";
    if (i === 28) return "due";
    return "waiting";
  });
  const paid = days.filter((d) => d === "paid").length;
  const back = days.filter((d) => d === "refunded").length;

  return (
    <div className="night-card" role="img" aria-label="Example deal card">
      <div className="night-top">
        <span className="night-id mono">EXAMPLE DEAL · 0007</span>
        <span className="status-pill tone-dawn on-night">Paying daily</span>
      </div>

      <div className="night-parties">
        <span className="avatar a">A</span>
        <span>acme</span>
        <span className="arrow" aria-hidden="true">
          →
        </span>
        <span className="avatar m">M</span>
        <span>maintainer.base.eth</span>
      </div>

      <div className="night-amount">$30.00</div>
      <p className="night-terms">30 days · $1.00 a day · USDC on Base</p>

      <div className="night-days" aria-hidden="true">
        {days.map((d, i) => (
          <i key={i} className={d} />
        ))}
      </div>
      <p className="night-tally mono">
        {paid} paid · {back} back to sponsor · {30 - paid - back} to go
      </p>

      <div className="night-file">
        <div className="night-file-head mono">
          <span>octo/sdk</span>
          <span>main · README.md</span>
        </div>
        <pre className="mono">
          <span className="dim">## Sponsors</span>
          {"\n"}
          <span className="hit">Sponsored by [Acme](https://acme.xyz)</span>
        </pre>
      </div>

      <div className="night-checks">
        <span>✓ exact line</span>
        <span>✓ pinned file</span>
        <span>✓ commit 3f2a1c9</span>
      </div>

      <div className="night-paid">✓ $1.00 sent to the maintainer today</div>
    </div>
  );
}
