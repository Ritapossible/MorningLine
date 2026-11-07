import { classifyChecker } from "../lib/checker";
import { CHECKER, RETIRED_CHECKERS } from "../lib/contracts";
import { CheckerStatus } from "./CheckerStatus";

/// Renders the finding from classifyChecker, which carries the reasoning and the tests.


type Props = { checker: string; buyer: string; payee: string };

export function CheckerNotice({ checker, buyer, payee }: Props) {
  const kind = classifyChecker(checker, buyer, payee, CHECKER, RETIRED_CHECKERS);

  if (kind === "payee") {
    return (
      <section className="card" style={{ marginTop: 18, borderColor: "var(--danger)" }}>
        <h3 style={{ color: "var(--danger)" }}>The maintainer checks their own line</h3>
        <p style={{ marginBottom: 6 }}>
          This deal names the maintainer as its checker, so they can report the line present
          every day and pay themselves the whole escrow whether or not it was ever there. The
          days below prove nothing about the file.
        </p>
        <p className="small" style={{ marginBottom: 0 }}>
          The contract allows it: the checker is chosen by the sponsor when the deal is opened
          and cannot be changed afterwards. Deals opened on this site never do this.
        </p>
      </section>
    );
  }

  if (kind === "buyer") {
    return (
      <section className="card" style={{ marginTop: 18, borderColor: "var(--danger)" }}>
        <h3 style={{ color: "var(--danger)" }}>The sponsor checks the line they are paying for</h3>
        <p style={{ marginBottom: 6 }}>
          This deal names the sponsor as its checker, so they can report the line missing on a
          day it was up and take the money back. A maintainer who adds the line here can do the
          work and be paid nothing.
        </p>
        <p className="small" style={{ marginBottom: 0 }}>
          The contract allows it: the checker is chosen by the sponsor when the deal is opened
          and cannot be changed afterwards. Deals opened on this site never do this.
        </p>
      </section>
    );
  }

  if (kind === "unfamiliar") {
    return (
      <section className="card" style={{ marginTop: 18 }}>
        <h3>An unfamiliar checker</h3>
        <p className="small" style={{ marginBottom: 0 }}>
          This deal was not opened here, and its checker is not the one this site runs. It is
          not the sponsor or the maintainer, so it is not obviously self dealing, but nothing
          vouches for it either. Judge the reports on the commits they name.
        </p>
      </section>
    );
  }

  if (kind === "retired") {
    return (
      <p className="small" style={{ marginTop: 14 }}>
        Opened with an earlier Morning Line checker, which has since been retired. It is neither
        the sponsor nor the maintainer. Any day it no longer reports goes back to the sponsor once
        its window closes.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <CheckerStatus />
      <p className="small" style={{ marginTop: 8 }}>
        Checked by the Morning Line checker, which is neither the sponsor nor the maintainer. It
        can only choose, per day, between paying the maintainer and refunding the sponsor.
      </p>
    </div>
  );
}
