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
      <head>
        {/* A refresh starts at the top of the page. Browsers restore the old scroll position on
            reload by default; back and forward keep doing that, and a link to a section such as
            /#how still lands on it. Runs before first paint, so nothing jumps. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var n=performance.getEntriesByType('navigation')[0];if(n&&n.type==='reload'&&!location.hash){history.scrollRestoration='manual';window.scrollTo(0,0);addEventListener('load',function(){window.scrollTo({top:0,left:0,behavior:'instant'});setTimeout(function(){history.scrollRestoration='auto'},0)})}}catch(e){}",
          }}
        />
      </head>
      <body>
        <Providers>
          <header className="masthead">
            <div className="wrap masthead-in">
              <Link href="/" className="wordmark" aria-label="Morning Line, home">
                <Logo />
              </Link>
              <span className={IS_DEMO ? "net-badge demo" : "net-badge"}>
                {IS_DEMO ? `Demo on ${chain.name} · 3-minute days` : chain.name}
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
            <div className="wrap foot-top">
              <div className="foot-brand">
                <Link href="/" className="wordmark" aria-label="Morning Line, home">
                  <Logo />
                </Link>
                <p>Per-day escrow for sponsor lines in GitHub READMEs, settled on Base.</p>
              </div>
              <nav className="foot-links" aria-label="Footer">
                <Link href="/#how">How it works</Link>
                <Link href="/maintainers">For maintainers</Link>
                <Link href="/docs">Docs</Link>
                <a href="https://github.com/Ritapossible/MorningLine" target="_blank" rel="noreferrer">
                  Source
                </a>
              </nav>
            </div>
            <div className="wrap">
              <div className="foot-base">
                <span>© 2026 Morning Line</span>
                <span>Built on Base</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
