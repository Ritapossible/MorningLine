/// Privy's App ID is public (it ships in the page), not a secret. Set it in the Vercel project
/// to turn on email and social sign-in with embedded wallets; leave it unset for plain wallets.
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/// Turn on only after enabling "Sponsor gas fees", the chain, and "Allow transactions from the
/// client" under Fee sponsorship in the Privy dashboard. Then the app pays gas for embedded
/// wallets; external wallets still pay their own.
export const SPONSOR_GAS = process.env.NEXT_PUBLIC_PRIVY_SPONSOR_GAS === "true";
