// Data-driven tests for ledger organization
// Tests both amount alignment and date sorting with various scenarios

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { LedgerOrganizer } from "../../../src/ledgerOrganizer";
import { getTestCaseDirectories } from "../../testUtils";

suite("Organize Ledger Data-Driven Tests", () => {
  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("organize-ledger");

  for (const testCaseDir of testCaseDirectories) {
    const testCase = path.basename(testCaseDir);
    test(`Should organize ledger correctly: ${testCase}`, async () => {
      const inputPath = path.join(testCaseDir, "input.ledger");
      const expectedPath = path.join(testCaseDir, "expected.ledger");

      // Read input and expected files
      const inputContent = fs.readFileSync(inputPath, "utf8");
      const expectedContent = fs.readFileSync(expectedPath, "utf8");

      // Create a document with the input content
      const document = await vscode.workspace.openTextDocument({
        content: inputContent,
        language: "ledger",
      });

      // Organize the content
      const result = LedgerOrganizer.sortLedgerContent(document.getText());

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
  }
});
