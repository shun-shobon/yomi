import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { noDoubleNegation, noNullishDefaultComparison, nullishComparison } from "./plugin";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

tester.run("nullish-comparison", nullishComparison, {
  valid: ["a == null", "a != null", "a === 0", "a !== ''", "typeof a === 'undefined'"],
  invalid: [
    { code: "a === null", output: "a == null", errors: [{ messageId: "loose" }] },
    { code: "a !== null", output: "a != null", errors: [{ messageId: "loose" }] },
    { code: "a === undefined", output: "a == null", errors: [{ messageId: "loose" }] },
    { code: "a.b !== undefined", output: "a.b != null", errors: [{ messageId: "loose" }] },
    { code: "null === f(x)", output: "f(x) == null", errors: [{ messageId: "loose" }] },
  ],
});

tester.run("no-double-negation", noDoubleNegation, {
  valid: ["!a", "!(a && b)", "-(-a)"],
  invalid: [
    { code: "!!a", errors: [{ messageId: "doubleNegation" }] },
    { code: "f(!!a?.b)", errors: [{ messageId: "doubleNegation" }] },
  ],
});

tester.run("no-nullish-default-comparison", noNullishDefaultComparison, {
  valid: ["const x = a ?? 0", "a != null && a > 0", "f(a ?? '') === b"],
  invalid: [
    { code: "(a ?? '') === ''", errors: [{ messageId: "defaultComparison" }] },
    { code: "(a?.b ?? 0) > 0", errors: [{ messageId: "defaultComparison" }] },
    { code: "0 !== (a ?? 0)", errors: [{ messageId: "defaultComparison" }] },
  ],
});
