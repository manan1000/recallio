// library.js (or node.js)
import globals from "globals";
import { baseConfig } from "./base.js";

/** @type {import("eslint").Linter.Config[]} */
export const nodeConfig = [
  ...baseConfig,
  {
    name: "repo/node/setup",
    languageOptions: {
      globals: {
        ...globals.node, // Enables process, __dirname, etc.
        ...globals.express, // Optional: if you want express-specific globals
      },
    },
    rules: {
      // Add node-specific rules here
      "no-console": "off", // Usually allowed in backends for logging
    },
  },
];
