// Tests for LedgerCli error parsing functionality
// Verifies that various error formats are properly parsed into diagnostics

import * as assert from "assert";
import { LedgerCli } from "../../src/ledgerCli";

suite("LedgerCli Error Parsing Tests", () => {
  test("Should parse ledger balance error format", () => {
    const cli = new LedgerCli();
    const errorOutput = `While parsing file "/path/to/file.ledger", line 10:
Error: Transaction does not balance`;

    // Access private method through type assertion
    const errors = cli.parseErrors(errorOutput);

    // The function processes all lines, including the Error: line
    assert.ok(errors.length >= 1);
    assert.strictEqual(errors[0].message, "Transaction does not balance");
    assert.strictEqual(errors[0].line, 9); // 0-based
  });

  test("Should handle multiple ledger balance errors", () => {
    const cli = new LedgerCli();
    const errorOutput = `While parsing file "/path/to/file.ledger", line 10:
Error: Transaction does not balance

While parsing file "/path/to/file.ledger", line 20:
Error: Invalid date format`;

    const errors = cli.parseErrors(errorOutput);

    // Find the actual parsed errors
    const balanceErrors = errors.filter((e: any) =>
      e.message.includes("Transaction does not balance"),
    );
    const dateErrors = errors.filter((e: any) =>
      e.message.includes("Invalid date format"),
    );

    assert.ok(balanceErrors.length >= 1);
    assert.ok(dateErrors.length >= 1);
    assert.strictEqual(balanceErrors[0].line, 9);
    assert.strictEqual(dateErrors[0].line, 19);
  });

  test("Should handle ledger error without Error: prefix", () => {
    const cli = new LedgerCli();
    const errorOutput = `While parsing file "/path/to/file.ledger", line 10:
Some other message
Not an error line`;

    const errors = cli.parseErrors(errorOutput);

    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].message, "Transaction error"); // Default message
  });

  test("Should handle mixed error formats", () => {
    const cli = new LedgerCli();
    const errorOutput = `/path/to/file.ledger:5:10: Error: Syntax error
While parsing file "/path/to/another.ledger", line 15:
Error: Invalid amount`;

    const errors = cli.parseErrors(errorOutput);

    // Find specific errors
    const syntaxError = errors.find((e: any) => e.message === "Syntax error");
    const amountError = errors.find((e: any) => e.message === "Invalid amount");

    assert.ok(syntaxError);
    assert.strictEqual(syntaxError.line, 4); // 0-based
    assert.strictEqual(syntaxError.column, 9); // 0-based
    assert.ok(amountError);
    assert.strictEqual(amountError.line, 14);
  });

  test("Should handle error output with empty lines", () => {
    const cli = new LedgerCli();
    const errorOutput = `

/path/to/file.ledger:5:10: Error: Syntax error

`;

    const errors = cli.parseErrors(errorOutput);

    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].message, "Syntax error");
  });

  test("Should parse balance error with transaction details", () => {
    const cli = new LedgerCli();
    const errorOutput = `While parsing file "/path/to/file.ledger", line 3:
While balancing transaction from "/path/to/file.ledger", lines 1-3:
> 2024-01-01 Test transaction
>     Assets:Cash       $100
>     Expenses:Food     $50
Unbalanced remainder is:
                $150
Amount to balance against:
                $150
Error: Transaction does not balance`;

    const errors = cli.parseErrors(errorOutput);

    assert.ok(errors.length >= 1);
    const balanceError = errors.find((e: any) =>
      e.message.includes("Transaction does not balance"),
    );
    assert.ok(balanceError);
    assert.strictEqual(
      balanceError.message,
      "Transaction does not balance (off by $150)",
    );
    assert.strictEqual(balanceError.line, 2); // line 3, 0-based = 2
  });

  test("Should include balance details in error message", () => {
    const cli = new LedgerCli();
    const errorOutput = `While parsing file "/path/to/file.ledger", line 3:
While balancing transaction from "/path/to/file.ledger", lines 1-3:
> 2024-01-01 Test transaction
>     Assets:Cash       $100
>     Expenses:Food     $50
Unbalanced remainder is:
                $-50
Amount to balance against:
                $150
Error: Transaction does not balance`;

    const errors = cli.parseErrors(errorOutput);

    // Check if the error message includes balance details
    const balanceError = errors.find((e: any) =>
      e.message.includes("Transaction does not balance"),
    );
    assert.ok(balanceError);
    assert.strictEqual(
      balanceError.message,
      "Transaction does not balance (off by $-50)",
    );
    assert.strictEqual(balanceError.line, 2);
  });

  test("Should not create duplicate errors from structured error output", () => {
    const cli = new LedgerCli();
    const errorOutput = `While parsing file "/path/to/file.ledger", line 5:
While balancing transaction from "/path/to/file.ledger", lines 3-5:
> 2024-01-01 Test transaction
>     Assets:Cash       $100
>     Expenses:Food     $50
Unbalanced remainder is:
                $150
Amount to balance against:
                $150
Error: Transaction does not balance`;

    const errors = cli.parseErrors(errorOutput);

    // Should only have ONE error, not multiple
    assert.strictEqual(
      errors.length,
      1,
      "Should only have one error, not duplicates",
    );

    // The single error should be the enhanced version
    assert.strictEqual(
      errors[0].message,
      "Transaction does not balance (off by $150)",
    );
    assert.strictEqual(errors[0].line, 4); // line 5, 0-based = 4

    // Verify we don't have any plain "Error: Transaction does not balance" entries
    const plainErrors = errors.filter(
      (e: any) => e.message === "Error: Transaction does not balance",
    );
    assert.strictEqual(
      plainErrors.length,
      0,
      'Should not have any plain "Error:" entries',
    );
  });
});
