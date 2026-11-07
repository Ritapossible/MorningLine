/// Who the checker is decides whether a deal's days mean anything.
///
/// The contract fixes the checker when the deal is opened and rejects only the zero address
/// (DECISIONS D4). It does not stop the buyer naming themselves or the payee, and either one
/// turns the check into a formality:
///
///   payee      the maintainer can report their own line present every day and pay themselves
///              out of the sponsor's escrow
///   buyer      the sponsor can report the line missing on days it was up and refund
///              themselves, leaving the maintainer unpaid for work they did
///
/// Because the buyer chooses the checker, the second is the likelier one, and it harms the
/// side that had no say. Deals opened through this app always use the published checker, but
/// anyone can call the contract directly, so a deal page has to say which case it is showing.
export type CheckerKind = "payee" | "buyer" | "unfamiliar" | "published" | "retired";

export function classifyChecker(
  checker: string,
  buyer: string,
  payee: string,
  published: string,
  retired: readonly string[] = [],
): CheckerKind {
  const c = checker.toLowerCase();
  // Self dealing first: it is the finding that changes how the days should be read, and it
  // stays true even when the self dealer is also the published checker.
  if (c === payee.toLowerCase()) return "payee";
  if (c === buyer.toLowerCase()) return "buyer";
  if (c === published.toLowerCase()) return "published";
  if (retired.some((r) => r.toLowerCase() === c)) return "retired";
  return "unfamiliar";
}
