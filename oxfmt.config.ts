import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: {
    groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
  },
  sortPackageJson: {
    sortScripts: true,
  },
});
