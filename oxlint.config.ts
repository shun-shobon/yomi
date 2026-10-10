import { defineConfig, type OxlintOverride } from "oxlint";

const layer = (name: string) => [`@/${name}`, `@/${name}/**`];

const restrict = (files: string, forbidden: string[]): OxlintOverride => ({
  files: [files],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: forbidden,
            message:
              "レイヤーの依存方向に反します。README の「ディレクトリ構成」を参照してください",
          },
        ],
      },
    ],
  },
});

export default defineConfig({
  options: {
    typeAware: true,
  },
  jsPlugins: ["./lint/plugin.ts"],
  rules: {
    eqeqeq: ["error", "always", { null: "ignore" }],
    "yomi/nullish-comparison": "error",
    "yomi/no-double-negation": "error",
    "yomi/no-nullish-default-comparison": "error",
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-unnecessary-type-assertion": "error",
    "typescript/prefer-nullish-coalescing": "error",
    "typescript/prefer-optional-chain": "error",
    "typescript/return-await": "error",
    "typescript/only-throw-error": "error",
    "typescript/no-deprecated": "error",
    "typescript/use-unknown-in-catch-callback-variable": "error",
    "typescript/restrict-template-expressions": "error",
    "typescript/no-base-to-string": "error",
    "typescript/consistent-type-imports": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/switch-exhaustiveness-check": [
      "error",
      { considerDefaultExhaustiveForUnions: true },
    ],
    "typescript/prefer-promise-reject-errors": "error",
    "typescript/require-await": "error",
    "typescript/no-unnecessary-condition": "error",
    "typescript/strict-boolean-expressions": "error",
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "e2e/**"],
      rules: {
        "typescript/no-unsafe-type-assertion": "off",
        // expect.any などの非対称マッチャーは any を返す
        "typescript/no-unsafe-assignment": "off",
      },
    },
    restrict("src/domain/**", [
      ...layer("infra"),
      ...layer("usecases"),
      ...layer("ui"),
      "#imports",
      "solid-js",
      "solid-js/*",
      "openai",
    ]),
    restrict("src/infra/**", [...layer("usecases"), ...layer("ui"), "solid-js", "solid-js/*"]),
    restrict("src/usecases/**", [...layer("ui"), "solid-js", "solid-js/*"]),
  ],
});
