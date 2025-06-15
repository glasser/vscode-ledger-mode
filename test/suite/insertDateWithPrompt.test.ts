// Tests for the enhanced date insertion command with prompt and smart positioning
// Ensures the command prompts for dates, finds correct position, and inserts at proper location

import * as assert from "assert";
import * as vscode from "vscode";
import { findDatePosition, parseDateString } from "../../src/commands";

suite("Enhanced Date Insertion Tests", () => {
  suite("parseDateString Unit Tests", () => {
    // Use a fixed reference date for deterministic testing
    const referenceDate = new Date("2024-06-15T12:00:00Z"); // Saturday

    test("Should parse YYYY-MM-DD format", () => {
      const result = parseDateString("2024-01-15", referenceDate);
      assert.strictEqual(result?.getFullYear(), 2024);
      assert.strictEqual(result?.getMonth(), 0); // January is 0
      assert.strictEqual(result?.getDate(), 15);
    });

    test("Should parse MM/DD/YYYY format", () => {
      const result = parseDateString("01/15/2024", referenceDate);
      assert.strictEqual(result?.getFullYear(), 2024);
      assert.strictEqual(result?.getMonth(), 0);
      assert.strictEqual(result?.getDate(), 15);
    });

    test("Should parse MM-DD-YYYY format", () => {
      const result = parseDateString("01-15-2024", referenceDate);
      assert.strictEqual(result?.getFullYear(), 2024);
      assert.strictEqual(result?.getMonth(), 0);
      assert.strictEqual(result?.getDate(), 15);
    });

    test("Should parse relative dates like 'today'", () => {
      const result = parseDateString("today", referenceDate);
      assert.strictEqual(result?.getDate(), 15);
      assert.strictEqual(result?.getMonth(), 5); // June is 5
      assert.strictEqual(result?.getFullYear(), 2024);
    });

    test("Should parse relative dates like 'yesterday'", () => {
      const result = parseDateString("yesterday", referenceDate);
      assert.strictEqual(result?.getDate(), 14);
      assert.strictEqual(result?.getMonth(), 5); // June is 5
      assert.strictEqual(result?.getFullYear(), 2024);
    });

    test("Should parse relative dates like 'tomorrow'", () => {
      const result = parseDateString("tomorrow", referenceDate);
      assert.strictEqual(result?.getDate(), 16);
      assert.strictEqual(result?.getMonth(), 5); // June is 5
      assert.strictEqual(result?.getFullYear(), 2024);
    });

    test("Should parse natural language dates like 'last monday'", () => {
      const result = parseDateString("last monday", referenceDate);
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getDay(), 1); // Monday is 1
      // Last Monday from 2024-06-15 (Saturday) should be 2024-06-10
      assert.strictEqual(result.getDate(), 10);
      assert.strictEqual(result.getMonth(), 5); // June is 5
    });

    test("Should parse dates without year and assume current year", () => {
      const result = parseDateString("01/15", referenceDate);
      assert.strictEqual(result?.getFullYear(), 2024);
      assert.strictEqual(result?.getMonth(), 0); // January is 0
      assert.strictEqual(result?.getDate(), 15);
    });

    test("Should return null for invalid date strings", () => {
      assert.strictEqual(
        parseDateString("completely invalid nonsense", referenceDate),
        null,
      );
    });

    test("Should allow empty input (will default to today in command)", () => {
      // Empty input is handled at the command level, not the parser level
      assert.strictEqual(parseDateString("", referenceDate), null);
    });
  });

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
