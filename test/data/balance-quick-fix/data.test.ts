import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { BalanceQuickFixProvider } from "../../../src/balanceQuickFix";
import { getTestCaseDirectories } from "../../testUtils";

interface QuickFixTestConfig {
  description: string;
  diagnostic: string;
  expectQuickFix: boolean;
}

suite("Balance Quick Fix Data Tests", () => {
  const testCaseDirectories = getTestCaseDirectories("balance-quick-fix");

  testCaseDirectories.forEach((testCaseDir) => {
    const testCase = path.basename(testCaseDir);
    test(`Should handle quick fix: ${testCase}`, async () => {
      const inputPath = path.join(testCaseDir, "input.ledger");
      const expectedPath = path.join(testCaseDir, "expected.ledger");
      const configPath = path.join(testCaseDir, "config.yaml");

      // Read test configuration
      const configContent = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(configContent) as QuickFixTestConfig;

      // Read input and expected content
      const inputContent = fs.readFileSync(inputPath, "utf8");
      const expectedContent = fs.readFileSync(expectedPath, "utf8");

      // Create a document from the input
      const document = await vscode.workspace.openTextDocument({
        content: inputContent,
        language: "ledger",
      });

      // Create the quick fix provider
      const provider = new BalanceQuickFixProvider();

      // Create diagnostic from config
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 20),
        config.diagnostic,
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = "ledger";

      const context: vscode.CodeActionContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Automatic,
      };

      // Get code actions
      const actions = provider.provideCodeActions(
        document,
        new vscode.Range(0, 0, 0, 20),
        context,
      );

      if (!config.expectQuickFix) {
        // Should not provide a fix
        assert.ok(
          !actions || actions.length === 0,
          `Should not provide fix for ${testCase}`,
        );
      } else {
        // Should provide a fix
        assert.ok(
          actions && actions.length > 0,
          `Should provide a quick fix for ${testCase}`,
        );

        // Apply the fix and compare with expected
        const action = actions[0];
        assert.ok(action.edit, "Action should have an edit");

        const edits = action.edit.get(document.uri);
        assert.ok(edits && edits.length > 0, "Should have edit operations");

        // Apply edits to get result
        let resultContent = inputContent;
        const sortedEdits = edits.sort(
          (a, b) => b.range.start.line - a.range.start.line,
        );

        for (const edit of sortedEdits) {
          const lines = resultContent.split("\n");
          lines.splice(edit.range.start.line, 0, edit.newText.trimEnd());
          resultContent = lines.join("\n");
        }

        assert.strictEqual(
          resultContent.trim(),
          expectedContent.trim(),
          `Quick fix result doesn't match expected for ${testCase}`,
        );
      }

      // Clean up
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    });
  });
});
