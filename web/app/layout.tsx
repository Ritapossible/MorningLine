import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { Wallet } from "../components/Wallet";
import { MORNINGLINE, addressUrl, chain, IS_DEMO } from "../lib/contracts";

export const metadata: Metadata = {
  title: "Morning Line",
  description:
    "Sponsor a GitHub README and pay only for the days your line stays up. Each day is settled on Base against the file at a named commit.",
};

const REPO = "https://github.com/Ritapossible/MorningLine";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="masthead">
            <div className="wrap masthead-in">
              <Link href="/" className="wordmark">
                <span className="sun" aria-hidden="true" />
                Morning Line
              </Link>
              <span className={IS_DEMO ? "net-badge demo" : "net-badge"}>
                {IS_DEMO ? `Demo on ${chain.name}` : chain.name}
              </span>
              <nav>
                <Link href="/#how" className="nav-link">
                  How it works
                </Link>
                <Link href="/docs" className="nav-link">
                  Docs
                </Link>
                <Link href="/new" className="nav-link">
                  Open a deal
                </Link>
                <Wallet />
              </nav>
            </div>
          </header>

          <main className="wrap page">{children}</main>

          <footer className="foot">
            <div className="wrap">
              <Link href="/" className="wordmark foot-mark">
                <span className="sun" aria-hidden="true" />
                Morning Line
              </Link>
              <p className="foot-note">
                Not affiliated with GitHub or Base. Sponsor lines should be disclosed as
                sponsorships. Nothing here is financial advice.
                {IS_DEMO ? " This deployment uses short days and worthless tokens for demonstration." : ""}
              </p>

              <div className="foot-cols">
                <div>
                  <h4>Product</h4>
                  <Link href="/new">Open a deal</Link>
                  <Link href="/#maintainers">For maintainers</Link>
                  <Link href="/#pricing">Pricing</Link>
                </div>
                <div>
                  <h4>Learn</h4>
                  <Link href="/docs">Docs</Link>
                  <Link href="/#how">How it works</Link>
                  <Link href="/#limits">What it does not promise</Link>
                  <a href={`${REPO}/blob/main/docs/SECURITY.md`}>Security</a>
                  <a href={`${REPO}/blob/main/docs/DECISIONS.md`}>Decisions</a>
                </div>
                <div>
                  <h4>Network</h4>
                  <span className="foot-net">
                    <i className="cell live" aria-hidden="true" />
                    {chain.name}
                  </span>
                  <a href={addressUrl(MORNINGLINE)} target="_blank" rel="noreferrer">
                    Escrow contract ↗
                  </a>
                  <a href={REPO} target="_blank" rel="noreferrer">
                    Source ↗
                  </a>
                </div>
              </div>

              <p className="foot-copy">
                © 2026 Morning Line · MIT licensed · Built with Claude · The contracts have no owner
                and no upgrade path
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
