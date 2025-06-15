// Tests for command error handling edge cases
// Verifies that commands handle missing editors and other error scenarios

import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";

suite("Command Error Handling Tests", () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test("Should handle missing active editor in balance report command", async () => {
    // Close all editors
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    // Mock showErrorMessage to verify it's called
    const showErrorStub = sandbox.stub(vscode.window, "showErrorMessage");

    // Execute balance report command with no active editor
    await vscode.commands.executeCommand("ledger.showBalanceReport");

    // Verify error message was shown (the actual message varies)
    assert.ok(showErrorStub.called, "Error message should be shown");
  });
});
