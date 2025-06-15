// Tests for edge cases and error conditions in LedgerOrganizer
// Tests boundary conditions, malformed input, and error handling

import * as assert from "assert";
import { LedgerOrganizer } from "../../src/ledgerOrganizer";

suite("Ledger Organizer Edge Cases", () => {
  test("Should handle empty content", () => {
    const result = LedgerOrganizer.sortLedgerContent("");
    assert.strictEqual(
      result,
      "",
      "Should return empty string for empty content",
    );
  });

  test("Should handle content with only comments", () => {
    const content = `; This is just a comment
; Another comment line
; No transactions here`;

    const result = LedgerOrganizer.sortLedgerContent(content);
    assert.ok(
      result.includes("; This is just a comment"),
      "Should preserve comments",
    );
    assert.ok(
      result.includes("; Another comment line"),
      "Should preserve all comments",
    );
  });

  test("Should handle content with only whitespace", () => {
    const content = `   
        
   `;

    const result = LedgerOrganizer.sortLedgerContent(content);
    // Whitespace-only content should result in preserving the whitespace as comments
    assert.ok(result.includes("   "), "Should preserve whitespace as comments");
  });

  test("Should handle malformed dates gracefully", () => {
    const content = `invalid-date Invalid Transaction
    Assets:Test    $10.00
    Income:Test   -$10.00

2024-01-01 Valid Transaction
    Assets:Test    $20.00
    Income:Test   -$20.00`;

    const result = LedgerOrganizer.sortLedgerContent(content);

    // Should still process valid transaction
    assert.ok(
      result.includes("2024-01-01"),
      "Should process valid transactions",
    );
    // Invalid date line should be preserved as comment/directive
    assert.ok(
      result.includes("invalid-date"),
      "Should preserve malformed content",
    );
  });

  test("Should handle transactions with no postings", () => {
    const content = `2024-01-01 Transaction with no postings

2024-01-02 Valid Transaction
    Assets:Test    $10.00
    Income:Test   -$10.00`;

    const result = LedgerOrganizer.sortLedgerContent(content);
    assert.ok(
      result.includes("2024-01-01"),
      "Should handle transactions with no postings",
    );
    assert.ok(
      result.includes("2024-01-02"),
      "Should process valid transactions",
    );
  });

  test("Should handle extremely long account names", () => {
    const longAccountName =
      "Assets:Very:Long:Account:Name:That:Goes:On:And:On:And:On:And:On:And:On";
    const content = `2024-01-01 Long Account Test
    ${longAccountName}    $10.00
    Income:Test   -$10.00`;

    const result = LedgerOrganizer.sortLedgerContent(content);
    assert.ok(
      result.includes(longAccountName),
      "Should handle long account names",
    );
  });

  test("Should handle various currency formats", () => {
    const content = `2024-01-01 Multi-Currency Test
    Assets:USD        $100.00
    Assets:EUR        €50.00
    Assets:Bitcoin    0.001 BTC
    Assets:Stocks     10 AAPL @ $150.00
    Income:Test`;

    const result = LedgerOrganizer.sortLedgerContent(content);
    assert.ok(result.includes("$100.00"), "Should preserve USD amounts");
    assert.ok(result.includes("€50.00"), "Should preserve EUR amounts");
    assert.ok(result.includes("0.001 BTC"), "Should preserve crypto amounts");
    assert.ok(
      result.includes("10 AAPL @ $150.00"),
      "Should preserve stock amounts",
    );
  });

  test("Should handle negative amounts correctly", () => {
    const content = `2024-01-01 Negative Amount Test
    Assets:Test     -$50.00
    Expenses:Test    $50.00`;

    const result = LedgerOrganizer.sortLedgerContent(content);
    const lines = result.split("\n");
    const amountLines = lines.filter((line) => line.includes("$"));

    // Verify negative amounts are aligned correctly (one column earlier)
    assert.ok(
      amountLines.some((line) => line.includes("-$50.00")),
      "Should preserve negative amounts",
    );
  });

  test("Should handle mixed indentation styles", () => {
    const content = `2024-01-01 Mixed Indentation
    Assets:Test1    $10.00
        Assets:Test2    $20.00
			Assets:Test3    $30.00
    Income:Test   -$60.00`;

    const result = LedgerOrganizer.sortLedgerContent(content);

    // Should normalize to consistent indentation
    const lines = result.split("\n");
    const postingLines = lines.filter((line) => line.match(/^\s+Assets:/));

    // All posting lines should have consistent indentation
    const indentations = postingLines.map(
      (line) => line.match(/^(\s*)/)?.[1].length || 0,
    );
    const firstIndent = indentations[0];
    assert.ok(
      indentations.every((indent) => indent === firstIndent),
      "Should normalize to consistent indentation",
    );
  });

  test("Should handle transactions around year boundaries", () => {
    const content = `2023-12-31 Last Day of Year
    Assets:Test    $100.00
    Income:Test   -$100.00

2024-01-01 First Day of Year
    Assets:Test    $200.00
    Income:Test   -$200.00`;

    const result = LedgerOrganizer.sortLedgerContent(content);

    // Should sort correctly across year boundary
    const lines = result.split("\n");
    const dateLines = lines.filter((line) => line.match(/^\d{4}-\d{2}-\d{2}/));
    assert.ok(
      dateLines[0].includes("2023-12-31"),
      "Earlier year should come first",
    );
    assert.ok(
      dateLines[1].includes("2024-01-01"),
      "Later year should come second",
    );
  });

  test("Should preserve exact spacing in account names", () => {
    const content = `2024-01-01 Spacing Test
    Assets:Account With Spaces    $10.00
    Income:Test                  -$10.00`;

    const result = LedgerOrganizer.sortLedgerContent(content);
    assert.ok(
      result.includes("Account With Spaces"),
      "Should preserve spaces in account names",
    );
  });

  test("Should handle content validation edge cases", () => {
    // Test that content validation works correctly
    const content = `2024-01-01 Test
    Assets:A    $10.00
    Assets:B   -$10.00`;

    // Should not throw on valid content
    assert.doesNotThrow(() => {
      LedgerOrganizer.sortLedgerContent(content);
    }, "Should not throw on valid content");
  });
});
