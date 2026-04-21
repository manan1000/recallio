import { nodeConfig } from "@repo/eslint-config/node";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nodeConfig,
  {
    name: "apps/api/overrides",
    // App-specific overrides
    rules: {
       // Example: backend might allow larger file sizes or different naming conventions
    }
  }
];
