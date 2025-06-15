// Tests for the insert date command
// Ensures the command inserts today's date in YYYY-MM-DD format

import * as assert from "assert";
import * as vscode from "vscode";
import { formatDateForLedger } from "../../src/commands";

suite("formatDateForLedger Unit Tests", () => {
  test("Should format dates correctly in YYYY-MM-DD format with trailing space", () => {
    const testDate = new Date("2023-07-15T12:00:00Z");
    const result = formatDateForLedger(testDate);
    assert.strictEqual(result, "2023-07-15 ");
  });

  test("Should handle single-digit months and days with zero padding", () => {
    const testDate = new Date("2023-01-05T12:00:00Z");
    const result = formatDateForLedger(testDate);
    assert.strictEqual(result, "2023-01-05 ");
  });

  test("Should handle leap year dates correctly", () => {
    const leapYearDate = new Date("2024-02-29T12:00:00Z");
    const result = formatDateForLedger(leapYearDate);
    assert.strictEqual(result, "2024-02-29 ");
  });

  test("Should handle year boundary dates", () => {
    const newYearDate = new Date("2024-01-01T12:00:00Z");
    const result = formatDateForLedger(newYearDate);
    assert.strictEqual(result, "2024-01-01 ");

    const newYearEve = new Date("2023-12-31T12:00:00Z");
    const result2 = formatDateForLedger(newYearEve);
    assert.strictEqual(result2, "2023-12-31 ");
  });

  test("Should default to current date when no parameter provided", () => {
    const result = formatDateForLedger();
    const dateRegex = /^\d{4}-\d{2}-\d{2} $/;
    assert.match(result, dateRegex);
  });
});

suite("Insert Date Command Integration Tests", () => {
  test("Insert date command should be registered", async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension("glasser.ledger-mode");
    if (extension && !extension.isActive) {
      await extension.activate();
    }

    // Ensure command is available
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes("ledger.insertDate"),
      "ledger.insertDate command should be registered",
    );
  });

  // Note: The enhanced insert date command now prompts for user input,
  // so we can't easily test the interactive behavior in automated tests.
  // The core functionality is tested in insertDateWithPrompt.test.ts
});
