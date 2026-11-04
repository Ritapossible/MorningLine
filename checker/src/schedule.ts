// When inside a day the check happens. The offset is derived from a private seed, so the
// maintainer cannot predict it and put the line up only for the check (SECURITY: "Maintainer
// removes the line after a check").
import { encodeAbiParameters, keccak256, parseAbiParameters } from "viem";

/// A stable pseudo-random offset in `[0, dayLength)` for one deal-day.
export function checkOffset(
  seed: `0x${string}`,
  dealId: bigint,
  day: bigint,
  dayLength: bigint,
): bigint {
  const digest = keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, uint256, uint256"), [seed, dealId, day]),
  );
  return BigInt(digest) % dayLength;
}

/// The unix second at which this deal-day should be checked.
export function checkAt(
  seed: `0x${string}`,
  dealId: bigint,
  day: bigint,
  opens: bigint,
  dayLength: bigint,
): bigint {
  return opens + checkOffset(seed, dealId, day, dayLength);
}

/// Whether to act now: the check minute has arrived and the report window is still open.
///
/// `closes` is `opens + dayLength + reportGrace`, so a day whose offset has passed is still
/// reportable during the grace period. That matters after an outage: the checker catches up
/// instead of silently letting the day lapse into a reclaim.
export function isDue(now: bigint, due: bigint, closes: bigint): boolean {
  return now >= due && now < closes;
}
