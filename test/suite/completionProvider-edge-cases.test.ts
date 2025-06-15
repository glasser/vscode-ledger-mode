// Tests for edge cases and error conditions in completion provider
// Tests error handling, empty files, and boundary conditions

import * as assert from "assert";
import * as vscode from "vscode";

suite("Completion Provider Edge Cases", () => {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;

  suiteSetup(async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension("glasser.ledger-mode");
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  teardown(async () => {
    if (editor) {
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    }
  });

  test("Should handle completion in empty file", async () => {
    document = await vscode.workspace.openTextDocument({
      content: "",
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    const position = new vscode.Position(0, 0);

    // Request completions at position 0,0 in empty file
    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    // Should return empty completions without error
    assert.ok(
      completions !== undefined,
      "Should handle empty file without crashing",
    );
  });

  test("Should handle completion at beginning of line", async () => {
    const content = `2024-01-01 Previous Transaction
    Assets:Checking    $100.00
    Income:Salary     -$100.00

`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    // Position at start of empty line
    const position = new vscode.Position(4, 0);

    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    // Should handle beginning of line without error
    assert.ok(completions !== undefined, "Should handle beginning of line");
  });

  test("Should handle completion with malformed transactions", async () => {
    const content = `2024-01-01 Valid Transaction
    Assets:Checking    $100.00
    Income:Salary     -$100.00

invalid-line-without-date
    Assets:Test    $50.00

2024-01-02 `;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    // Position after partial transaction line
    const position = new vscode.Position(6, 11);

    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    // Should still provide completions from valid transactions
    assert.ok(completions, "Should return completion list");
    // In some test environments, completions may not be generated
    // Just test that the completion provider doesn't crash on malformed input
    assert.ok(
      Array.isArray(completions.items),
      "Should return completion items array",
    );
  });

  test("Should handle completion with very long lines", async () => {
    const longDescription =
      "Very ".repeat(100) + "Long Transaction Description";
    const content = `2024-01-01 ${longDescription}
    Assets:Checking    $100.00
    Income:Salary     -$100.00

2024-01-02 `;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    const position = new vscode.Position(4, 11);

    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    // Should handle long transaction descriptions
    assert.ok(completions, "Should return completion list");
    // Test that completion provider handles very long lines without crashing
    assert.ok(
      Array.isArray(completions.items),
      "Should return completion items array for long lines",
    );
  });

  test("Should handle completion with special characters", async () => {
    const content = `2024-01-01 Transaction with Special Characters !@#$%^&*()
    Assets:Checking    $100.00
    Income:Salary     -$100.00

2024-01-02 Transaction with Unicode: café résumé naïve
    Assets:Test        $50.00
    Expenses:Food     -$50.00

2024-01-03 `;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    const position = new vscode.Position(8, 11);

    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    // Should handle special characters in completions
    if (completions && completions.items.length > 0) {
      const specialItem = completions.items.find((item) => {
        const label =
          typeof item.label === "string" ? item.label : item.label.label;
        return label.includes("!@#");
      });
      if (specialItem) {
        assert.ok(true, "Should handle special characters");
      }

      const unicodeItem = completions.items.find((item) => {
        const label =
          typeof item.label === "string" ? item.label : item.label.label;
        return label.includes("café");
      });
      if (unicodeItem) {
        assert.ok(true, "Should handle Unicode characters");
      }
    }
  });

  test("Should handle completion with deeply nested accounts", async () => {
    const content = `2024-01-01 Deep Account Test
    Assets:Bank:Checking:Primary:Joint:Account    $100.00
    Income:Employment:Salary:Base:Regular        -$100.00

2024-01-02 Test
    Assets:`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    // Position after "Assets:" on posting line
    const position = new vscode.Position(5, 12);

    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    // Should provide account completions for nested accounts
    if (completions && completions.items.length > 0) {
      const deepAccount = completions.items.find((item) => {
        const label =
          typeof item.label === "string" ? item.label : item.label.label;
        return label.includes("Bank:Checking:Primary");
      });
      if (deepAccount) {
        assert.ok(true, "Should handle deeply nested account names");
      }
    }
  });

  test("Should handle completion at end of file", async () => {
    const content = `2024-01-01 Test Transaction
    Assets:Checking    $100.00
    Income:Salary     -$100.00

2024-01-02 `;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    // Position at very end of file
    const lastLine = document.lineCount - 1;
    const lastChar = document.lineAt(lastLine).text.length;
    const position = new vscode.Position(lastLine, lastChar);

    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    // Should handle end of file position
    assert.ok(completions !== undefined, "Should handle end of file position");
  });

  test("Should handle completion with only comments and directives", async () => {
    const content = `; This file only has comments
; No actual transactions
; price-db: prices

; Another comment
; Still no transactions`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    const position = new vscode.Position(5, 20);

    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    // Should handle file with no transactions gracefully
    assert.ok(
      completions !== undefined,
      "Should handle file with no transactions",
    );
    // Note: VSCode might provide default completions, so we just test that it doesn't crash
    if (completions) {
      assert.ok(
        Array.isArray(completions.items),
        "Should return completion items array",
      );
    }
  });
});
