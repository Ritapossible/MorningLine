"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { CHAIN_ID } from "../lib/contracts";

// Both chains are configured so the types stay concrete; the one this deployment targets is
// listed first, which is the one wagmi connects to by default.
const chains = CHAIN_ID === base.id ? ([base, baseSepolia] as const) : ([baseSepolia, base] as const);

const config = createConfig({
  chains,
  connectors: [
    coinbaseWallet({ appName: "Morning Line", preference: "all" }),
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [base.id]: http(CHAIN_ID === base.id ? process.env.NEXT_PUBLIC_RPC_URL : undefined),
    [baseSepolia.id]: http(CHAIN_ID === baseSepolia.id ? process.env.NEXT_PUBLIC_RPC_URL : undefined),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
