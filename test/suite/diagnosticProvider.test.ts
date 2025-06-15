// Tests for the diagnostic provider that validates ledger files
// Tests actual diagnostic generation using ledger CLI

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { LedgerCli } from "../../src/ledgerCli";

suite("Diagnostic Provider Tests", () => {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;
  let ledgerCli: LedgerCli;
  let tempDir: string;

  suiteSetup(async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension("glasser.ledger-mode");
    if (extension && !extension.isActive) {
      await extension.activate();
    }

    // Check if ledger CLI is available
    ledgerCli = new LedgerCli();
    const isAvailable = await ledgerCli.isLedgerAvailable();
    if (!isAvailable) {
      throw new Error(
        "Ledger CLI is required for diagnostic tests but is not available",
      );
    }

    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-test-"));
  });

  teardown(async () => {
    if (editor) {
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    }

    // Clear any diagnostics
    vscode.languages.getDiagnostics().forEach(([uri, diagnostics]) => {
      if (diagnostics.length > 0) {
        vscode.languages.createDiagnosticCollection().delete(uri);
      }
    });
  });

  suiteTeardown(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("Should validate valid ledger file without errors", async () => {
    const content = `2024-01-01 Valid Transaction
    Assets:Checking    $100.00
    Income:Salary     -$100.00

2024-01-02 Another Valid Transaction
    Expenses:Food      $25.00
    Assets:Checking   -$25.00`;

    // Save to temp file so ledger CLI can validate it
    const filePath = path.join(tempDir, "valid.ledger");
    fs.writeFileSync(filePath, content);

    // Test direct CLI validation
    const errors = await ledgerCli.validateFile(filePath);
    assert.strictEqual(errors.length, 0, "Valid file should have no errors");

    // Test through VSCode document
    document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(filePath),
    );
    editor = await vscode.window.showTextDocument(document);

    // Wait for diagnostics to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    assert.strictEqual(
      diagnostics.length,
      0,
      "Valid file should have no diagnostics",
    );
  });

  test("Should detect specific errors in invalid ledger file", async () => {
    interface ExpectedError {
      messageContains: string;
      line?: number;
      severity: vscode.DiagnosticSeverity;
    }

    const testCases: {
      name: string;
      content: string;
      expectedErrors: ExpectedError[];
    }[] = [
      {
        name: "Unbalanced transaction",
        content: `2024-01-01 Unbalanced
    Expenses:Food    $10.00
    Assets:Checking  -$5.00`,
        expectedErrors: [
          {
            messageContains: "does not balance",
            line: 2,
            severity: vscode.DiagnosticSeverity.Error,
          },
        ],
      },
      {
        name: "Invalid date",
        content: `2024-02-30 Invalid Date
    Expenses:Food    $10.00
    Assets:Checking  -$10.00`,
        expectedErrors: [
          {
            messageContains: "Day of month is not valid",
            line: 0,
            severity: vscode.DiagnosticSeverity.Error,
          },
        ],
      },
      {
        name: "Balance assertion failure",
        content: `2024-01-01 Balance Assertion
    Assets:Checking    $100.00 = $50.00
    Income:Salary     -$100.00`,
        expectedErrors: [
          {
            messageContains: "Balance assertion off by",
            line: 1,
            severity: vscode.DiagnosticSeverity.Error,
          },
        ],
      },
    ];

    for (const testCase of testCases) {
      // Save to temp file
      const filePath = path.join(
        tempDir,
        `${testCase.name.replace(/\s+/g, "_")}.ledger`,
      );
      fs.writeFileSync(filePath, testCase.content);

      // Test direct CLI validation
      const errors = await ledgerCli.validateFile(filePath);
      assert.ok(
        errors.length > 0,
        `${testCase.name}: Should detect errors via CLI`,
      );

      // Test through VSCode document
      document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(filePath),
      );
      editor = await vscode.window.showTextDocument(document);

      // Wait for diagnostics to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      assert.ok(
        diagnostics.length > 0,
        `${testCase.name}: Should have diagnostics`,
      );

      // Verify each expected error
      for (const expectedError of testCase.expectedErrors) {
        const matchingDiagnostic = diagnostics.find(
          (d) =>
            d.message.includes(expectedError.messageContains) &&
            (expectedError.line === undefined ||
              d.range.start.line === expectedError.line) &&
            d.severity === expectedError.severity,
        );

        assert.ok(
          matchingDiagnostic,
          `${testCase.name}: Should find diagnostic containing "${expectedError.messageContains}" on line ${expectedError.line}`,
        );
      }

      // Close the document before next test
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    }
  });

  test("Should handle diagnostic clearing on file close", async () => {
    const content = `2024-01-01 Test Transaction
    Assets:Checking    $100.00
    Income:Test       -$100.00`;

    const filePath = path.join(tempDir, "close_test.ledger");
    fs.writeFileSync(filePath, content);

    document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(filePath),
    );
    editor = await vscode.window.showTextDocument(document);

    // Wait for diagnostics to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    const initialDiagnostics = vscode.languages.getDiagnostics(document.uri);
    assert.ok(
      Array.isArray(initialDiagnostics),
      "Should return diagnostics array initially",
    );

    // Close the document
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    editor = undefined as any;

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Diagnostics should be cleared
    const finalDiagnostics = vscode.languages.getDiagnostics(document.uri);
    assert.strictEqual(
      finalDiagnostics.length,
      0,
      "Diagnostics should be cleared after file close",
    );
  });

  test("Should handle non-ledger files gracefully", async () => {
    const content = `This is not a ledger file
Just some random text`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "plaintext", // Not a ledger file
    });
    editor = await vscode.window.showTextDocument(document);

    // Wait a moment for any diagnostics to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(
      document.languageId,
      "plaintext",
      "Document should be plaintext",
    );

    // Non-ledger files should not have diagnostics from our provider
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    // Note: There might be diagnostics from other providers, but none should be from "ledger" source
    const ledgerDiagnostics = diagnostics.filter((d) => d.source === "ledger");
    assert.strictEqual(
      ledgerDiagnostics.length,
      0,
      "Should have no ledger diagnostics for non-ledger files",
    );
  });
});
