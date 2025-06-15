import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  tests: [
    {
      files: "out/test/**/*.test.js",
      version: "stable",
      mocha: {
        ui: "tdd",
        timeout: 20000,
      },
    },
  ],
  coverage: {
    reporter: ["text", "html", "lcov"],
    exclude: ["**/*test*"],
  },
});
