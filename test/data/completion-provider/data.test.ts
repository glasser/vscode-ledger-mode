// Data-driven tests for completion provider functionality
// Tests completion providers using real files and expected results

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { getTestCaseDirectories } from "../../testUtils";

interface CompletionTestConfig {
  description: string;
  cursorLine: number;
  cursorColumn: number;
  expectedCompletions: Array<{
    label: string;
    kind: string;
    detail: string;
    expectedRange?: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
  }>;
  completionType: string;
  noPayeeCompletions?: boolean;
  noAccountCompletions?: boolean;
}

suite("Completion Provider Data-Driven Tests", () => {
  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("completion-provider");

  testCaseDirectories.forEach((testCaseDir) => {
    const testCase = path.basename(testCaseDir);
    test(`${testCase}`, async () => {
      const testDir = testCaseDir;
      const inputPath = path.join(testDir, "input.ledger");
      const configPath = path.join(testDir, "config.yaml");

      // Read test files
      const inputContent = fs.readFileSync(inputPath, "utf8");
      const config: CompletionTestConfig = yaml.load(
        fs.readFileSync(configPath, "utf8"),
      ) as CompletionTestConfig;

      // Create a temporary file so our completion providers can process it
      const tempPath = path.join(__dirname, `../../../test-${testCase}.ledger`);
      fs.writeFileSync(tempPath, inputContent);

      try {
        const document = await vscode.workspace.openTextDocument(tempPath);
        const position = new vscode.Position(
          config.cursorLine,
          config.cursorColumn,
        );

        // Small delay to ensure extension providers are fully registered
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Get completions
        const completions =
          await vscode.commands.executeCommand<vscode.CompletionList>(
            "vscode.executeCompletionItemProvider",
            document.uri,
            position,
          );

        assert.ok(completions, "Should return completion list");
        assert.ok(completions.items, "Should have completion items");

        // Filter to only ledger-mode completions (those with "Account" or "Payee" detail)
        const ledgerCompletions = completions.items.filter(
          (item) => item.detail === "Account" || item.detail === "Payee",
        );

        // Check exact count and order
        assert.strictEqual(
          ledgerCompletions.length,
          config.expectedCompletions.length,
          `Should have exactly ${config.expectedCompletions.length} ledger completions, got ${ledgerCompletions.length}. ` +
            `Actual completions: ${ledgerCompletions.map((c) => c.label).join(", ")}`,
        );

        // Check each completion in order
        for (let i = 0; i < config.expectedCompletions.length; i++) {
          const expected = config.expectedCompletions[i];
          const actual = ledgerCompletions[i];

          assert.strictEqual(
            actual.label.toString(),
            expected.label,
            `Completion ${i} should be "${expected.label}", got "${actual.label}"`,
          );

          const completion = actual;

          // Check kind (convert string to VSCode enum)
          let expectedKind: vscode.CompletionItemKind;
          switch (expected.kind) {
            case "Value":
              expectedKind = vscode.CompletionItemKind.Value;
              break;
            case "Module":
              expectedKind = vscode.CompletionItemKind.Module;
              break;
            default:
              throw new Error(`Unknown completion kind: ${expected.kind}`);
          }

          assert.strictEqual(
            completion.kind,
            expectedKind,
            `Completion should have ${expected.kind} kind`,
          );

          assert.strictEqual(
            completion.detail,
            expected.detail,
            `Completion should have ${expected.detail} detail`,
          );

          // Check range if specified
          if (expected.expectedRange) {
            assert.ok(
              completion.range,
              `Completion should have range for text replacement`,
            );

            if (completion.range) {
              const range =
                completion.range instanceof vscode.Range
                  ? completion.range
                  : completion.range.replacing;

              assert.strictEqual(
                range.start.line,
                expected.expectedRange.startLine,
                `Range start line should be ${expected.expectedRange.startLine}`,
              );
              assert.strictEqual(
                range.start.character,
                expected.expectedRange.startColumn,
                `Range start column should be ${expected.expectedRange.startColumn}`,
              );
              assert.strictEqual(
                range.end.line,
                expected.expectedRange.endLine,
                `Range end line should be ${expected.expectedRange.endLine}`,
              );
              assert.strictEqual(
                range.end.character,
                expected.expectedRange.endColumn,
                `Range end column should be ${expected.expectedRange.endColumn}`,
              );
            }
          }
        }

        // Check negative assertions
        if (config.noPayeeCompletions) {
          const payeeCompletions = completions.items.filter(
            (item) => item.detail === "Payee",
          );
          assert.strictEqual(
            payeeCompletions.length,
            0,
            "Should not have any payee completions",
          );
        }

        if (config.noAccountCompletions) {
          const accountCompletions = completions.items.filter(
            (item) => item.detail === "Account",
          );
          assert.strictEqual(
            accountCompletions.length,
            0,
            "Should not have any account completions",
          );
        }
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    });
  });
});
