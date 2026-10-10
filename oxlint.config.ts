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
  overrides: [
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
