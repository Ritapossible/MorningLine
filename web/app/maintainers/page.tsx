import type { Metadata } from "next";
import { MaintainerTools } from "./MaintainerTools";

export const metadata: Metadata = {
  title: "For maintainers · Morning Line",
  description:
    "Sell a sponsor line in your README. Make a link for a sponsor, and see every deal paying you.",
};

export default function Maintainers() {
  return (
    <>
      <h1>For maintainers</h1>
      <p className="lede">
        Sell a line in your README and get paid for every day it stays up. You need only an address
        on Base: no account, no fee and no gas. You never sign anything here.
      </p>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>How it works for you</h3>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 8 }}>
            <b>Agree the line with your sponsor</b> and add it to your README, exactly as written,
            on the branch you will keep it on.
          </li>
          <li style={{ marginBottom: 8 }}>
            <b>Make a sponsor link below</b> and send it to them. It opens the deal form with your
            repo, the line, your address and your price already filled in. They check it and pay.
          </li>
          <li>
            <b>Keep the line up.</b> Each day it is there when the check runs, that day&apos;s USDC
            arrives in your wallet. A day it is missing goes back to the sponsor; put it back and
            it earns again from the next check.
          </li>
        </ol>
      </section>

      <MaintainerTools />
    </>
  );
}
