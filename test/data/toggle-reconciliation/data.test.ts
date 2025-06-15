// Tests for the reconciliation toggle feature using data-driven testing

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getTestCaseDirectories } from "../../testUtils";

suite("Toggle Reconciliation Data Tests", () => {
  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("toggle-reconciliation");

  testCaseDirectories.forEach((testCaseDir) => {
    const testCase = path.basename(testCaseDir);
    const testDir = testCaseDir;
    const inputPath = path.join(testDir, "input.ledger");

    // Find all expected files in this test case
    const expectedFiles = fs
      .readdirSync(testDir)
      .filter(
        (name) => name.startsWith("expected-line") && name.endsWith(".ledger"),
      );

    expectedFiles.forEach((expectedFile) => {
      // Extract line number from filename (e.g., "expected-line1.ledger" -> 1)
      const lineMatch = expectedFile.match(/expected-line(\d+)\.ledger$/);
      if (!lineMatch) {
        return; // Skip files that don't match the pattern
      }
      const lineNumber = parseInt(lineMatch[1], 10);

      test(`${testCase} - line ${lineNumber}`, async () => {
        const inputContent = fs.readFileSync(inputPath, "utf8");
        const expectedContent = fs.readFileSync(
          path.join(testDir, expectedFile),
          "utf8",
        );

        // Create a new document with the input content
        const document = await vscode.workspace.openTextDocument({
          content: inputContent,
          language: "ledger",
        });

        const editor = await vscode.window.showTextDocument(document);

        // Position cursor on the specified line
        const position = new vscode.Position(lineNumber, 0);
        editor.selection = new vscode.Selection(position, position);

        // Execute the toggle reconciliation command
        await vscode.commands.executeCommand("ledger.toggleReconciliation");

        // Check the result
        const actualContent = document.getText();
        assert.strictEqual(
          actualContent,
          expectedContent,
          `Test case ${testCase} line ${lineNumber} failed.\nExpected:\n${JSON.stringify(expectedContent)}\nActual:\n${JSON.stringify(actualContent)}`,
        );

        // Clean up
        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor",
        );
      });
    });
  });
});
