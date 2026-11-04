// The deal page previews whether a line is present using the same rule the checker uses to
// move money. If the two ever drift, the preview lies. Keep them byte identical.
import { readFileSync } from "node:fs";

const a = "../checker/src/match.ts";
const b = "lib/match.ts";
const left = readFileSync(a);
const right = readFileSync(b);

if (!left.equals(right)) {
  console.error(`${b} has drifted from ${a}.`);
  console.error("The preview must use exactly the rule that settles days. Copy one over the other.");
  process.exit(1);
}
console.log(`${b} matches ${a}`);
