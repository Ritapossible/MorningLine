import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { Wallet } from "../components/Wallet";
import { chain, IS_DEMO } from "../lib/contracts";

export const metadata: Metadata = {
  title: "Morning Line",
  description:
    "Sponsor a GitHub README and pay only for the days your line stays up. Each day is settled on Base against the file at a named commit.",
};

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
                {IS_DEMO ? `demo - ${chain.name}` : chain.name}
              </span>
              <nav>
                <Link href="/new">Open a deal</Link>
                <a href="https://github.com/Ritapossible/MorningLine">Source</a>
                <Wallet />
              </nav>
            </div>
          </header>

          <main className="wrap" style={{ paddingTop: 36 }}>
            {children}
          </main>

          <footer className="foot">
            <div className="wrap">
              Morning Line settles one day at a time on {chain.name}. The contracts have no owner
              and no upgrade path.
              {IS_DEMO ? " This deployment uses short days and worthless tokens for demonstration." : ""}
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
