// Data-driven tests for transaction completion
// Tests exact formatting including newlines and spacing

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getTestCaseDirectories } from "../../testUtils";

suite("Transaction Completion Data-Driven Tests", () => {
  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("transaction-completion");

  testCaseDirectories.forEach((testCaseDir) => {
    const testCase = path.basename(testCaseDir);
    test(`Should complete transaction correctly: ${testCase}`, async () => {
      const testDir = testCaseDir;
      const inputPath = path.join(testDir, "input.ledger");
      const expectedPath = path.join(testDir, "expected.ledger");
      const configPath = path.join(testDir, "config.json");

      // Read test files
      const inputContent = fs.readFileSync(inputPath, "utf8");
      const expectedContent = fs.readFileSync(expectedPath, "utf8");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

      // Create a document with the input content
      const document = await vscode.workspace.openTextDocument({
        content: inputContent,
        language: "ledger",
      });
      const editor = await vscode.window.showTextDocument(document);

      // Position cursor as specified in config
      const position = new vscode.Position(
        config.cursorLine,
        config.cursorColumn,
      );
      editor.selection = new vscode.Selection(position, position);

      // Execute the completion command
      await vscode.commands.executeCommand("ledger.completeTransaction");

      // Get the result
      const result = document.getText();

      // Compare with expected output (exact match including newlines)
      assert.strictEqual(
        result,
        expectedContent,
        `Test case ${testCase} failed.\nExpected:\n${JSON.stringify(expectedContent)}\nActual:\n${JSON.stringify(result)}`,
      );

      // Close the document
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    });
  });
});
