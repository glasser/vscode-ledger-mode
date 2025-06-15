// Data-driven tests for error formatting functionality
// Tests use filesystem directories with input.txt and expected.html files

import * as assert from "assert";
import { BalanceReportViewProvider } from "../../../src/balanceReportView";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getTestCaseDirectories } from "../../testUtils";

suite("Error Formatting Data-Driven Tests", () => {
  let provider: BalanceReportViewProvider;
  let context: vscode.ExtensionContext;

  suiteSetup(() => {
    // Create a minimal context for testing
    context = {
      subscriptions: [],
    } as any;
    provider = new BalanceReportViewProvider(context);
  });

  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("error-formatting");

  testCaseDirectories.forEach((testCaseDir) => {
    const testCaseName = path.basename(testCaseDir);
    test(`Should format error correctly: ${testCaseName}`, () => {
      const inputFile = path.join(testCaseDir, "input.txt");
      const expectedFile = path.join(testCaseDir, "expected.html");

      assert.ok(
        fs.existsSync(inputFile),
        `Input file should exist: ${inputFile}`,
      );
      assert.ok(
        fs.existsSync(expectedFile),
        `Expected file should exist: ${expectedFile}`,
      );

      const input = fs.readFileSync(inputFile, "utf8");
      const expected = fs.readFileSync(expectedFile, "utf8").trim();

      // Test the complete formatLedgerError function
      const result = provider.formatLedgerError(input);

      assert.strictEqual(
        result.trim(),
        expected,
        `Error formatting should match expected output for ${testCaseName}`,
      );
    });
  });
});
