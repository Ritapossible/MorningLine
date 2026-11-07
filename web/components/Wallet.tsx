"use client";

import { useCreateWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { chain } from "../lib/contracts";
import { shortAddress } from "../lib/format";
import { PRIVY_APP_ID } from "../lib/auth";

type Props = {
  /// The header passes this: nothing is shown until someone is signed in. Signing in happens
  /// where it is needed, on the step that signs.
  compact?: boolean;
};

/// Signing in, switching to the right network, and signing out. Privy or plain wagmi is fixed
/// at build time, so the hooks below never change between renders.
export const Wallet = PRIVY_APP_ID ? PrivyWallet : PlainWallet;

/// Set once a wallet creation has started, so the header and the page, which both render this
/// component, never ask Privy for two.
let creating = false;

function PrivyWallet({ compact }: Props) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  // Someone who signs in with email or Google has no wallet yet. Make one for them here rather
  // than relying on the dashboard's create-on-login setting. Privy does it without any screens.
  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || wallets.length > 0 || creating) return;
    creating = true;
    createWallet().catch((err: unknown) => {
      creating = false;
      console.error("could not create a wallet:", err instanceof Error ? err.message : err);
    });
  }, [ready, authenticated, walletsReady, wallets.length, createWallet]);

  if (!ready) return compact ? null : <button disabled>Sign in</button>;

  if (!authenticated) {
    if (compact) return null;
    return (
      <button className="primary" onClick={() => login()}>
        Sign in to continue
      </button>
    );
  }

  if (address && chainId !== chain.id) {
    return (
      <button onClick={() => switchChain({ chainId: chain.id })}>Switch to {chain.name}</button>
    );
  }

  return (
    <button
      onClick={() => {
        creating = false;
        void logout();
      }}
      title="Sign out"
    >
      <span className="mono">{address ? shortAddress(address) : "Setting up wallet"}</span>
    </button>
  );
}

function PlainWallet({ compact }: Props) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    if (compact) return null;
    const first = connectors[0];
    return (
      <button
        className="primary"
        disabled={isPending || first === undefined}
        onClick={() => first && connect({ connector: first })}
      >
        {isPending ? "Connecting" : "Connect a wallet"}
      </button>
    );
  }

  if (chainId !== chain.id) {
    return (
      <button onClick={() => switchChain({ chainId: chain.id })}>Switch to {chain.name}</button>
    );
  }

  return (
    <button onClick={() => disconnect()} title="Disconnect">
      <span className="mono">{address ? shortAddress(address) : ""}</span>
    </button>
  );
}
