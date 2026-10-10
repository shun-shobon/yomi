import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { noNullishDefaultComparison } from "./plugin";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

tester.run("no-nullish-default-comparison", noNullishDefaultComparison, {
  valid: ["const x = a ?? 0", "a != null && a > 0", "f(a ?? '') === b"],
  invalid: [
    { code: "(a ?? '') === ''", errors: [{ messageId: "defaultComparison" }] },
    { code: "(a?.b ?? 0) > 0", errors: [{ messageId: "defaultComparison" }] },
    { code: "0 !== (a ?? 0)", errors: [{ messageId: "defaultComparison" }] },
  ],
});
