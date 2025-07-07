// Data-driven tests for automatic indentation behavior
// Tests that pressing Enter on transaction lines adds single space indentation

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getTestCaseDirectories } from "../../testUtils";

suite("Indentation Data-Driven Tests", () => {
  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("indentation");

  testCaseDirectories.forEach((testCaseDir) => {
    const testCase = path.basename(testCaseDir);
    test(`Should handle indentation correctly: ${testCase}`, async () => {
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

      // Log debug info to understand what's happening
      console.log("Language ID:", document.languageId);
      console.log("Line text:", document.lineAt(config.cursorLine).text);

      // Use our custom Enter command that adds indentation
      await vscode.commands.executeCommand("ledger.handleEnter");

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
