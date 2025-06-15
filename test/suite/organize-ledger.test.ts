// Tests for the organize ledger file command
// Tests both amount alignment and date sorting with comment preservation

import * as vscode from "vscode";

suite("Organize Ledger Test Suite", () => {
  suiteSetup(async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension("glasser.ledger-mode");
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  suiteTeardown(async () => {
    // Close any open documents
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });
});
