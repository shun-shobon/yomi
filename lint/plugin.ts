import type { RuleTester } from "oxlint/plugins-dev";

// oxlint は Rule 型を直接 export していない
type Rule = Parameters<RuleTester["run"]>[1];

const COMPARISON_OPERATORS = new Set(["===", "!==", "==", "!=", "<", "<=", ">", ">="]);

export const noNullishDefaultComparison: Rule = {
  meta: {
    type: "suggestion",
    messages: {
      defaultComparison: "`??` で既定値に落としてから比較せず、null チェックの後に比較してください",
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (!COMPARISON_OPERATORS.has(node.operator)) return;
        for (const side of [node.left, node.right]) {
          if (side.type === "LogicalExpression" && side.operator === "??") {
            context.report({ node: side, messageId: "defaultComparison" });
          }
        }
      },
    };
  },
};

export default {
  meta: { name: "yomi" },
  rules: {
    "no-nullish-default-comparison": noNullishDefaultComparison,
  },
};
