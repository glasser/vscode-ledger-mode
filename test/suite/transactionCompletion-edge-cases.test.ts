// Additional tests for TransactionCompletion to improve coverage
// Tests edge cases, error conditions, and TransactionCompleter class

import * as assert from "assert";
import * as vscode from "vscode";
import { TransactionParser } from "../../src/transactionCompletion";

suite("Transaction Completion Edge Cases", () => {
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

  test("Should handle malformed transaction lines", async () => {
    const testDoc = await vscode.workspace.openTextDocument({
      content: "Test document",
      language: "ledger",
    });

    const malformedLines = [
      "not-a-date Invalid Transaction",
      "", // Empty line
      "   ", // Whitespace only
    ];

    const validButWeirdLines = [
      "2024/13/45 Invalid Date", // Regex matches but date is invalid
      "2024-01-01", // Just date, no payee - valid format
      "2024-01-01 * (unclosed paren Payee", // Valid except for unclosed paren
    ];

    malformedLines.forEach((line, index) => {
      const result = TransactionParser.parseTransaction(line, index, testDoc);
      // These should return null for malformed input
      assert.strictEqual(
        result,
        null,
        `Expected null for malformed line: "${line}"`,
      );
    });

    validButWeirdLines.forEach((line, index) => {
      const result = TransactionParser.parseTransaction(line, index, testDoc);
      // These may parse successfully even if semantically weird
      // We're testing that the parser doesn't crash on edge cases
      if (line === "2024-01-01") {
        assert.ok(
          result === null || result.payee === "",
          "Date-only line should have empty payee or be null",
        );
      }
    });
  });

  test("Should handle malformed posting lines", () => {
    const malformedPostings = [
      "Assets:Test", // No leading whitespace
      "", // Empty line
      "   ", // Whitespace only
      "not-indented-posting",
      "    ", // Just whitespace
    ];

    malformedPostings.forEach((line) => {
      const result = TransactionParser.parsePosting(line);
      if (line.trim() === "" || !line.match(/^\s+/)) {
        assert.strictEqual(
          result,
          null,
          `Expected null for malformed posting: "${line}"`,
        );
      }
    });
  });

  test("Should handle complex posting patterns", () => {
    const complexPostings = [
      "    Assets:Bank:Checking:Primary    $1,234.56",
      "    Expenses:Food:Restaurants:FastFood    USD 25.99  ; lunch",
      "    Liabilities:CreditCard    -$500.00  ; payment",
      "    Assets:Investment    5.4447 VBILX @ $11.40",
      "    Income:Salary:Base    -$5,000.00",
    ];

    complexPostings.forEach((line) => {
      const result = TransactionParser.parsePosting(line);
      assert.ok(result, `Should parse complex posting: "${line}"`);
      assert.ok(result.account, "Should have account");
      if (line.includes("$") || line.includes("USD")) {
        assert.ok(result.amount, "Should have amount for monetary postings");
      }
    });
  });

  test("Should serialize posting patterns correctly", async () => {
    const content = `2024-01-01 Test Pattern
    Expenses:Food    $20.00
    Assets:Bank     -$20.00

2024-01-02 Test Pattern  
    Assets:Bank     -$30.00
    Expenses:Food    $30.00

2024-01-03 Different Pattern
    Expenses:Gas     $40.00
    Assets:Bank     -$40.00`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });

    const templates = TransactionParser.findTransactionTemplates(
      "Test Pattern",
      doc,
    );

    // Should group by pattern (account names only, order-independent)
    assert.strictEqual(
      templates.length,
      1,
      "Should group transactions with same accounts",
    );
    assert.strictEqual(
      templates[0].frequency,
      2,
      "Should count frequency correctly",
    );

    const differentTemplates = TransactionParser.findTransactionTemplates(
      "Different Pattern",
      doc,
    );
    assert.strictEqual(
      differentTemplates.length,
      1,
      "Should create separate pattern for different accounts",
    );
  });

  test("Should handle documents with no transactions", async () => {
    const content = `; Just comments
; No actual transactions
; price-db: prices

; Another comment`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });

    const transactions = TransactionParser.getAllTransactions(doc);
    assert.strictEqual(
      transactions.length,
      0,
      "Should return empty array for no transactions",
    );

    const templates = TransactionParser.findTransactionTemplates(
      "Any Payee",
      doc,
    );
    assert.strictEqual(
      templates.length,
      0,
      "Should return empty templates for no transactions",
    );
  });

  test("Should handle transactions with no postings", async () => {
    const content = `2024-01-01 Standalone Transaction

2024-01-02 Another Transaction

2024-01-03 Transaction With Posting
    Assets:Test    $10.00`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });

    const transactions = TransactionParser.getAllTransactions(doc);
    assert.ok(transactions.length >= 2, "Should find transactions");

    // Transactions without postings should still be parsed
    const standalone = transactions.find(
      (t) => t.payee === "Standalone Transaction",
    );
    assert.ok(standalone, "Should parse transaction without postings");
    assert.strictEqual(
      standalone.postings.length,
      0,
      "Should have no postings",
    );
  });

  test("Should handle very long account names", () => {
    const longAccount =
      "Assets:Bank:Checking:Business:Operating:Primary:Account:With:Very:Long:Name";
    const line = `    ${longAccount}    $100.00`;

    const result = TransactionParser.parsePosting(line);
    assert.ok(result, "Should parse very long account names");
    assert.strictEqual(
      result.account,
      longAccount,
      "Should preserve long account name",
    );
  });

  test("Should handle amounts with various currencies and formats", () => {
    const amountFormats = [
      "    Assets:Test    $1,234.56",
      "    Assets:Test    USD 1234.56",
      "    Assets:Test    EUR 1.234,56",
      "    Assets:Test    ¥ 1000",
      "    Assets:Test    £ 500.00",
      "    Assets:Test    -$50.00",
      "    Assets:Test    ($25.00)",
    ];

    amountFormats.forEach((line) => {
      const result = TransactionParser.parsePosting(line);
      assert.ok(result, `Should parse amount format: "${line}"`);
      assert.ok(result.amount, "Should extract amount");
    });
  });

  test("Should complete transaction when valid payee exists", async () => {
    const content = `2024-01-01 * Grocery Store
    Expenses:Food    $45.67
    Assets:Checking  -$45.67

2024-01-15 Grocery Store`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
    editor = await vscode.window.showTextDocument(document);

    // Test that completeTransaction finds the template
    const templates = TransactionParser.findTransactionTemplates(
      "Grocery Store",
      document,
    );
    assert.ok(templates.length > 0, "Should find existing templates");

    // The actual completion would require user interaction, so we test the components
    const transaction = TransactionParser.parseTransaction(
      "2024-01-15 Grocery Store",
      4,
      document,
    );
    assert.ok(transaction, "Should parse incomplete transaction");
    assert.strictEqual(
      transaction.payee,
      "Grocery Store",
      "Should extract payee correctly",
    );
  });

  test("Should handle case insensitive payee matching", async () => {
    const content = `2024-01-01 Grocery Store
    Expenses:Food    $45.67
    Assets:Checking  -$45.67`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });

    const lowerTemplates = TransactionParser.findTransactionTemplates(
      "grocery store",
      doc,
    );
    const upperTemplates = TransactionParser.findTransactionTemplates(
      "GROCERY STORE",
      doc,
    );
    const mixedTemplates = TransactionParser.findTransactionTemplates(
      "Grocery STORE",
      doc,
    );

    assert.strictEqual(
      lowerTemplates.length,
      upperTemplates.length,
      "Case insensitive matching",
    );
    assert.strictEqual(
      lowerTemplates.length,
      mixedTemplates.length,
      "Mixed case matching",
    );
    assert.ok(
      lowerTemplates.length > 0,
      "Should find templates regardless of case",
    );
  });

  test("Should sort templates by frequency and recency", async () => {
    const content = `2024-01-01 Test Payee
    Expenses:A    $10.00
    Assets:Bank  -$10.00

2024-01-02 Test Payee  
    Expenses:A    $20.00
    Assets:Bank  -$20.00

2024-01-03 Test Payee
    Expenses:B    $30.00  
    Assets:Bank  -$30.00

2024-01-04 Test Payee
    Expenses:B    $40.00
    Assets:Bank  -$40.00

2024-01-05 Test Payee
    Expenses:B    $50.00
    Assets:Bank  -$50.00`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });

    const templates = TransactionParser.findTransactionTemplates(
      "Test Payee",
      doc,
    );

    // Should have 2 patterns: Expenses:A and Expenses:B
    assert.strictEqual(templates.length, 2, "Should group by posting pattern");

    // Expenses:B should be first (frequency 3 vs 2)
    assert.ok(
      templates[0].frequency >= templates[1].frequency,
      "Should sort by frequency",
    );
    if (templates[0].frequency === templates[1].frequency) {
      assert.ok(
        templates[0].lastSeen >= templates[1].lastSeen,
        "Should sort by recency for ties",
      );
    }
  });

  test("Should handle transactions with effective dates and codes", async () => {
    const testDoc = await vscode.workspace.openTextDocument({
      content: "Test document",
      language: "ledger",
    });

    const complexTransaction =
      "2024-01-15=2024-01-20 ! (CHECK001) Monthly Rent Payment";
    const result = TransactionParser.parseTransaction(
      complexTransaction,
      0,
      testDoc,
    );

    assert.ok(result, "Should parse complex transaction");
    assert.strictEqual(result.date, "2024-01-15", "Should extract date");
    assert.strictEqual(
      result.effectiveDate,
      "2024-01-20",
      "Should extract effective date",
    );
    assert.strictEqual(result.state, "!", "Should extract state");
    assert.strictEqual(result.code, "CHECK001", "Should extract code");
    assert.strictEqual(
      result.payee,
      "Monthly Rent Payment",
      "Should extract payee",
    );
  });

  test("Should handle posting lines with comments", () => {
    const postingWithComment =
      "    Expenses:Food:Groceries    $45.67  ; weekly shopping trip";
    const result = TransactionParser.parsePosting(postingWithComment);

    assert.ok(result, "Should parse posting with comment");
    assert.strictEqual(
      result.account,
      "Expenses:Food:Groceries",
      "Should extract account",
    );
    assert.strictEqual(result.amount, "$45.67", "Should extract amount");
    assert.strictEqual(
      result.comment,
      "; weekly shopping trip",
      "Should extract comment",
    );
  });

  test("Should handle empty or whitespace-only documents", async () => {
    const emptyContents = ["", "   ", "\n\n\n", "   \n   \n   "];

    for (const content of emptyContents) {
      const doc = await vscode.workspace.openTextDocument({
        content,
        language: "ledger",
      });

      const transactions = TransactionParser.getAllTransactions(doc);
      assert.strictEqual(
        transactions.length,
        0,
        "Should handle empty content gracefully",
      );
    }
  });
});
