import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { Wallet } from "../components/Wallet";
import { chain, IS_DEMO } from "../lib/contracts";
import { Logo } from "../components/Logo";
import { PRIVY_APP_ID, SPONSOR_GAS } from "../lib/auth";

export const metadata: Metadata = {
  title: "Morning Line",
  description:
    "Sponsor a GitHub README and pay only for the days your line stays up. Each day is settled on Base against the file at a named commit.",
  // Which sign-in and gas settings this build was made with. Public, and handy for checking a
  // deploy picked up its environment: NEXT_PUBLIC_ values are fixed at build time.
  other: {
    "morningline-build": `privy=${PRIVY_APP_ID ? "on" : "off"} sponsor-gas=${PRIVY_APP_ID && SPONSOR_GAS ? "on" : "off"}`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="masthead">
            <div className="wrap masthead-in">
              <Link href="/" className="wordmark" aria-label="Morning Line, home">
                <Logo />
              </Link>
              <span className={IS_DEMO ? "net-badge demo" : "net-badge"}>
                {IS_DEMO ? `Demo on ${chain.name}` : chain.name}
              </span>
              <nav>
                <Link href="/#how" className="nav-link">
                  How it works
                </Link>
                <Link href="/maintainers" className="nav-link">
                  For maintainers
                </Link>
                <Link href="/docs" className="nav-link">
                  Docs
                </Link>
                <Wallet compact />
                <Link href="/new" className="nav-cta">
                  Open a deal
                </Link>
              </nav>
            </div>
          </header>

          <main className="wrap page">{children}</main>

          <footer className="foot">
            <div className="wrap">© 2026 Morning Line</div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
