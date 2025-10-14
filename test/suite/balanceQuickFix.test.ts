// Basic integration test for balance quick fix provider
// Tests the core functionality of the quick fix provider

import * as assert from "assert";
import * as vscode from "vscode";
import { BalanceQuickFixProvider } from "../../src/balanceQuickFix";

suite("Balance Quick Fix Integration Tests", () => {
  test("Should provide quick fix for small balance error", async () => {
    const provider = new BalanceQuickFixProvider();

    // Create a document with an unbalanced transaction
    const document = await vscode.workspace.openTextDocument({
      content: `2024-01-15 Coffee Shop
    Expenses:Food:Coffee    $3.50
    Assets:Cash            -$3.00`,
      language: "ledger",
    });

    // Create a diagnostic for balance error
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 20),
      "Transaction does not balance (off by $0.50)",
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

    // Should provide a quick fix
    assert.ok(actions && actions.length > 0, "Should provide a quick fix");

    const action = actions[0];
    assert.ok(
      action.title.includes("rounding"),
      "Action title should mention rounding",
    );
    assert.ok(
      action.title.includes("-$0.50"),
      "Action title should show the correct amount",
    );
    assert.ok(action.edit, "Action should have an edit");

    // Clean up
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("Should provide quick fix for negative balance error", async () => {
    const provider = new BalanceQuickFixProvider();

    // Create a document with an unbalanced transaction (like 401k purchase)
    const document = await vscode.workspace.openTextDocument({
      content: `2025-10-01 401K purchase
    Retirement:Apollo Vanguard 401k:Shares    15.979 VFIFX @ $58.97
    Retirement:Apollo Vanguard 401k:USD      -$942.33`,
      language: "ledger",
    });

    // Create a diagnostic for balance error (ledger outputs $-0.05 format)
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 20),
      "Transaction does not balance (off by $-0.05)",
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

    // Should provide a quick fix
    assert.ok(actions && actions.length > 0, "Should provide a quick fix");

    const action = actions[0];
    assert.ok(
      action.title.includes("rounding"),
      "Action title should mention rounding",
    );
    assert.ok(
      action.title.includes("$0.05"),
      "Action title should show the correct positive amount",
    );
    assert.ok(action.edit, "Action should have an edit");

    // Clean up
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("Should not provide quick fix for large balance error", async () => {
    const provider = new BalanceQuickFixProvider();

    // Create a document with an unbalanced transaction (large error)
    const document = await vscode.workspace.openTextDocument({
      content: `2024-01-15 Grocery Store
    Expenses:Food    $50.00
    Assets:Cash     -$45.00`,
      language: "ledger",
    });

    // Create a diagnostic for large balance error
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 20),
      "Transaction does not balance (off by $5.00)",
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

    // Should not provide a quick fix for large errors
    assert.ok(
      !actions || actions.length === 0,
      "Should not provide fix for large balance errors",
    );

    // Clean up
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("Should parse various amount formats correctly", async () => {
    const provider = new BalanceQuickFixProvider();

    // Test different amount formats
    const testCases = [
      { input: "$0.50", expected: 0.5 },
      { input: "-$0.25", expected: -0.25 },
      { input: "$-0.05", expected: -0.05 }, // Format ledger actually outputs
      { input: "$1,234.56", expected: 1234.56 },
      { input: "0.01", expected: 0.01 },
      { input: "-0.99", expected: -0.99 },
    ];

    for (const testCase of testCases) {
      const amount = (provider as any).parseAmount(testCase.input);
      assert.strictEqual(
        amount,
        testCase.expected,
        `Failed to parse ${testCase.input}`,
      );
    }
  });
});
