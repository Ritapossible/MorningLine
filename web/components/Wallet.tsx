"use client";

import { usePrivy } from "@privy-io/react-auth";
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

function PrivyWallet({ compact }: Props) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

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
    <button onClick={() => void logout()} title="Sign out">
      <span className="mono">{address ? shortAddress(address) : "Signed in"}</span>
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
