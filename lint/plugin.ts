import type { RuleTester } from "oxlint/plugins-dev";

// oxlint は Rule 型を直接 export していない
type Rule = Parameters<RuleTester["run"]>[1];

export const nullishComparison: Rule = {
  meta: {
    type: "suggestion",
    fixable: "code",
    messages: {
      loose: "null・undefined との比較は `{{operator}} null` で書いてください",
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") return;
        const isNullish = (n: typeof node.left) =>
          (n.type === "Literal" && n.value == null && n.raw === "null") ||
          (n.type === "Identifier" && n.name === "undefined");
        const nullishSide = isNullish(node.right)
          ? node.right
          : isNullish(node.left)
            ? node.left
            : null;
        if (nullishSide == null) return;
        const operator = node.operator === "===" ? "==" : "!=";
        const other = nullishSide === node.right ? node.left : node.right;
        context.report({
          node,
          messageId: "loose",
          data: { operator },
          fix: (fixer) =>
            fixer.replaceText(node, `${context.sourceCode.getText(other)} ${operator} null`),
        });
      },
    };
  },
};

export const noDoubleNegation: Rule = {
  meta: {
    type: "suggestion",
    messages: {
      doubleNegation: "`!!` で真偽値に変換せず、比較や null チェックで条件を書いてください",
    },
  },
  create(context) {
    return {
      UnaryExpression(node) {
        if (node.operator === "!" && node.argument.type === "UnaryExpression") {
          if (node.argument.operator === "!") context.report({ node, messageId: "doubleNegation" });
        }
      },
    };
  },
};

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
    "nullish-comparison": nullishComparison,
    "no-double-negation": noDoubleNegation,
    "no-nullish-default-comparison": noNullishDefaultComparison,
  },
};
