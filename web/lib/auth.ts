/// Privy's App ID is public (it ships in the page), not a secret. Set it in the Vercel project
/// to turn on email and social sign-in with embedded wallets; leave it unset for plain wallets.
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
