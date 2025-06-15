import * as path from "path";

import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // Ensure we're pointing to the project root (where package.json is)
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    console.log("Extension path:", extensionDevelopmentPath);
    console.log("Tests path:", extensionTestsPath);

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error("Failed to run tests");
    process.exit(1);
  }
}

main();
