"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { chain } from "../lib/contracts";
import { shortAddress } from "../lib/format";

export function Wallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    const first = connectors[0];
    return (
      <button
        className="primary"
        disabled={isPending || first === undefined}
        onClick={() => first && connect({ connector: first })}
      >
        {isPending ? "Connecting" : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== chain.id) {
    return (
      <button onClick={() => switchChain({ chainId: chain.id })}>
        Switch to {chain.name}
      </button>
    );
  }

  return (
    <button onClick={() => disconnect()} title="Disconnect">
      <span className="mono">{address ? shortAddress(address) : ""}</span>
    </button>
  );
}
