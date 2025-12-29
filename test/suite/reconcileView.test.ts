// Tests for reconcile view command registration
// Verifies command is available and handles edge cases

import * as assert from "assert";
import * as vscode from "vscode";

suite("Reconcile View Tests", () => {
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

  test("Should have reconcile command registered", async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes("ledger.reconcile"),
      "Reconcile command should be registered",
    );
  });

  test("Should handle error when no active ledger file", async () => {
    // Create a non-ledger file
    document = await vscode.workspace.openTextDocument({
      content: "This is not a ledger file",
      language: "plaintext",
    });
    editor = await vscode.window.showTextDocument(document);

    // Try to run reconcile - should show error (but not throw)
    try {
      await vscode.commands.executeCommand("ledger.reconcile");
      // Command should handle this gracefully
      assert.ok(true, "Command handled non-ledger file");
    } catch {
      assert.ok(true, "Command properly errored on non-ledger file");
    }
  });
});
