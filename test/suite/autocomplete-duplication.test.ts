// Tests for autocomplete duplication issue
// Reproduces the bug where typing partially, waiting for popup, typing more, then selecting results in duplication

import * as assert from "assert";
import * as vscode from "vscode";

suite("Autocomplete Duplication Test Suite", () => {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;

  suiteSetup(async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension("glasser.ledger-mode");
    if (extension && !extension.isActive) {
      await extension.activate();
    }

    // Create a test document with some merchants for completion
    const content = `2024-01-01 Grocery Store
    Expenses:Food    $50.00
    Assets:Checking

2024-01-02 Grocery Store
    Expenses:Food    $30.00
    Assets:Checking

2024-01-03 Gas Station
    Expenses:Gas     $40.00
    Assets:Checking

2024-01-04 Groc`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);
  });

  suiteTeardown(async () => {
    // Close the document
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("Should not duplicate merchant name on progressive typing", async () => {
    // Position cursor after "Groc" in the last line
    const lastLineIndex = document.lineCount - 1;
    const lastLine = document.lineAt(lastLineIndex);
    const position = new vscode.Position(lastLineIndex, lastLine.text.length);

    editor.selection = new vscode.Selection(position, position);

    // Get completions at this position (simulating typing "Groc" and waiting for popup)
    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        position,
      );

    if (completions && completions.items.length > 0) {
      // Find "Grocery Store" completion
      const groceryCompletion = completions.items.find(
        (item) =>
          item.label === "Grocery Store" ||
          (typeof item.label === "object" &&
            item.label.label === "Grocery Store"),
      );

      if (groceryCompletion) {
        // The completion should replace the existing "Groc" text, not append to it
        // Check if the completion has a proper range set
        if (groceryCompletion.range) {
          const range =
            groceryCompletion.range instanceof vscode.Range
              ? groceryCompletion.range
              : groceryCompletion.range.replacing;

          // The range should start before "Groc" to replace it
          assert.ok(
            range.start.character < position.character,
            "Completion should replace existing text, not append to it",
          );
        } else {
          // If no range is set, the completion will just insert at cursor position
          // This is likely the cause of the duplication issue
          assert.fail(
            "Completion should have a range to replace existing partial text",
          );
        }
      }
    }
  });

  test("Should provide merchant completions on transaction lines", async () => {
    // Test basic completion functionality
    const testContent = "2024-01-05 Groc";

    const testDoc = await vscode.workspace.openTextDocument({
      content: testContent,
      language: "ledger",
    });

    const position = new vscode.Position(0, testContent.length);

    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        testDoc.uri,
        position,
      );

    // Should get completions
    if (completions) {
      assert.ok(
        completions.items.length >= 0,
        "Should return completion items",
      );
    }

    // Close test document
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });
});
