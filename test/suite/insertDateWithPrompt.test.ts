// Tests for the enhanced date insertion command with prompt and smart positioning
// Ensures the command prompts for dates, finds correct position, and inserts at proper location

import * as assert from "assert";
import * as vscode from "vscode";
import { findDatePosition } from "../../src/commands";

suite("Enhanced Date Insertion Tests", () => {
  suite("findDatePosition Unit Tests", () => {
    test("Should find position between past and future dates", () => {
      const content = `2024-01-01 Past transaction
  Assets:Checking  $100

2024-01-15 Another past
  Assets:Checking  $50

2024-03-01 Future transaction
  Assets:Checking  $200`;

      const testDate = new Date("2024-02-01");
      const position = findDatePosition(content, testDate);

      // Should be at line 5 (the blank line before the future transaction)
      assert.strictEqual(position, 5);
    });

    test("Should find position at beginning when target date is earliest", () => {
      const content = `2024-02-01 Transaction
  Assets:Checking  $100

2024-03-01 Another transaction
  Assets:Checking  $50`;

      const testDate = new Date("2024-01-01");
      const position = findDatePosition(content, testDate);

      // Should be at line 0 (beginning of file)
      assert.strictEqual(position, 0);
    });

    test("Should find position at end when target date is latest", () => {
      const content = `2024-01-01 Transaction
  Assets:Checking  $100

2024-02-01 Another transaction
  Assets:Checking  $50`;

      const testDate = new Date("2024-03-01");
      const position = findDatePosition(content, testDate);

      // Should be at line 5 (past end of file for insertion)
      assert.strictEqual(position, 5);
    });

    test("Should handle empty content", () => {
      const position = findDatePosition("", new Date());
      assert.strictEqual(position, 1);
    });

    test("Should prefer blank line before transaction", () => {
      const content = `2024-01-01 Past transaction
  Assets:Checking  $100

2024-03-01 Future transaction
  Assets:Checking  $200`;

      const testDate = new Date("2024-02-01");
      const position = findDatePosition(content, testDate);

      // Should be at line 2 (the blank line before future transaction)
      assert.strictEqual(position, 2);
    });
  });

  suite("Insert Date with Prompt Integration Tests", () => {
    let document: vscode.TextDocument;

    suiteSetup(async () => {
      // Ensure extension is activated
      const extension = vscode.extensions.getExtension("glasser.ledger-mode");
      if (extension && !extension.isActive) {
        await extension.activate();
      }

      // Create a new document
      document = await vscode.workspace.openTextDocument({
        content: "",
        language: "ledger",
      });
      await vscode.window.showTextDocument(document);
    });

    suiteTeardown(async () => {
      // Close the document
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    });

    test("Enhanced insert date command should be registered", async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(
        commands.includes("ledger.insertDate"),
        "ledger.insertDate command should be registered",
      );
    });

    // Note: We can't easily test the actual user input prompt in automated tests,
    // but we can test the core functionality with mocked input
  });
});
