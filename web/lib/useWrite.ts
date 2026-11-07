"use client";

// Every transaction the app sends goes through here.
//
// Privy's gas sponsorship only applies to transactions sent with its own sendTransaction and
// `sponsor: true`, from a Privy embedded wallet; wagmi's writeContract never sets that flag. So
// when sponsorship is switched on and the signer is an embedded wallet, the call is encoded here
// and sent through Privy. Anything else (an external wallet, or sponsorship off) goes through
// wagmi exactly as before. The mode is fixed at build time, so the hooks never change.
import { useSendTransaction, useWallets } from "@privy-io/react-auth";
import { encodeFunctionData, type Abi } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { chain } from "./contracts";
import { PRIVY_APP_ID, SPONSOR_GAS } from "./auth";

export type Write = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

export type Writer = {
  write: (w: Write) => Promise<`0x${string}`>;
  /// True when the connected wallet's transactions are paid for by the app.
  sponsored: boolean;
};

export const useWrite: () => Writer = PRIVY_APP_ID && SPONSOR_GAS ? useSponsoredWrite : usePlainWrite;

function usePlainWrite(): Writer {
  const { writeContractAsync } = useWriteContract();
  return {
    write: (w) => writeContractAsync(w as Parameters<typeof writeContractAsync>[0]),
    sponsored: false,
  };
}

function useSponsoredWrite(): Writer {
  const plain = usePlainWrite();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const embedded =
    address !== undefined &&
    wallets.some(
      (w) => w.walletClientType === "privy" && w.address.toLowerCase() === address.toLowerCase(),
    );

  if (!embedded) return plain;

  return {
    sponsored: true,
    write: async (w) => {
      const data = encodeFunctionData({
        abi: w.abi,
        functionName: w.functionName,
        args: w.args ?? [],
      } as Parameters<typeof encodeFunctionData>[0]);
      const { hash } = await sendTransaction(
        { to: w.address, data, chainId: chain.id },
        { sponsor: true, address },
      );
      return hash;
    },
  };
}
