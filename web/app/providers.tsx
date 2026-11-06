"use client";

// Two ways to sign, chosen at build time:
//
// - With NEXT_PUBLIC_PRIVY_APP_ID set, Privy handles sign-in: email, Google or an existing
//   wallet. Someone without a wallet gets an embedded one, so a sponsor who has never used
//   crypto can still open a deal. Privy's WagmiProvider keeps every wagmi hook in the app
//   working unchanged.
// - Without it, plain wagmi with the Coinbase Wallet and browser-wallet connectors, as before.
//
// A wallet is only needed to sign: opening a deal and reclaiming days. Reading a deal never
// needs one.
import { PrivyProvider } from "@privy-io/react-auth";
import {
  WagmiProvider as PrivyWagmiProvider,
  createConfig as privyCreateConfig,
} from "@privy-io/wagmi";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { CHAIN_ID, chain } from "../lib/contracts";
import { PRIVY_APP_ID } from "../lib/auth";

// Both chains are configured so the types stay concrete; the one this deployment targets is
// listed first, which is the one wagmi connects to by default.
const chains =
  CHAIN_ID === base.id ? ([base, baseSepolia] as const) : ([baseSepolia, base] as const);

const transports = {
  [base.id]: http(CHAIN_ID === base.id ? process.env.NEXT_PUBLIC_RPC_URL : undefined),
  [baseSepolia.id]: http(CHAIN_ID === baseSepolia.id ? process.env.NEXT_PUBLIC_RPC_URL : undefined),
};

const plainConfig = createConfig({
  chains,
  connectors: [
    coinbaseWallet({ appName: "Morning Line", preference: { options: "all" } }),
    injected({ shimDisconnect: true }),
  ],
  transports,
  ssr: true,
});

const privyConfig = privyCreateConfig({ chains, transports, ssr: true });

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  if (PRIVY_APP_ID) {
    return (
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ["email", "google", "wallet"],
          embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
          defaultChain: chain,
          supportedChains: [chain],
          appearance: {
            theme: "light",
            accentColor: "#a85e12",
            landingHeader: "Sign in to Morning Line",
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyConfig}>{children}</PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    );
  }

  return (
    <WagmiProvider config={plainConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
