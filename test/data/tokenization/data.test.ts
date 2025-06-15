// Data-driven tests for ledger parsing and tokenization functionality
// Tests parsing logic using external JSON test cases

import * as assert from "assert";
import * as vscode from "vscode";
import { TransactionParser } from "../../../src/transactionCompletion";
import { ReconciliationToggler } from "../../../src/reconciliationToggler";
import { getJsonTestCases } from "../../testUtils";

suite("Tokenization Data-Driven Tests", () => {
  let document: vscode.TextDocument;

  suiteSetup(async () => {
    // Create a minimal test document for parsing context
    const content = `2024-01-15 * Test Transaction
    Expenses:Test    $10.00
    Assets:Test     -$10.00`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  suite("Transaction Parsing", () => {
    // Load test cases from external JSON file - will throw if none found
    const testCases = getJsonTestCases(
      "tokenization",
      "transaction-parsing-examples.json",
    );

    testCases.forEach((testCase: any) => {
      test(testCase.description, () => {
        const result = TransactionParser.parseTransaction(
          testCase.input,
          999,
          document,
        );

        assert.ok(result, `Should parse: "${testCase.input}"`);

        // Handle null/undefined equivalence from JSON parsing
        const expectedEffectiveDate =
          testCase.expected.effectiveDate === null
            ? undefined
            : testCase.expected.effectiveDate;
        const expectedState =
          testCase.expected.state === null
            ? undefined
            : testCase.expected.state;
        const expectedCode =
          testCase.expected.code === null ? undefined : testCase.expected.code;

        assert.strictEqual(
          result.date,
          testCase.expected.date,
          "Date should match",
        );
        assert.strictEqual(
          result.effectiveDate,
          expectedEffectiveDate,
          "Effective date should match",
        );
        assert.strictEqual(result.state, expectedState, "State should match");
        assert.strictEqual(
          result.payee,
          testCase.expected.payee,
          "Payee should match",
        );
        assert.strictEqual(result.code, expectedCode, "Code should match");
      });
    });
  });

  suite("Posting Line Parsing", () => {
    // Load test cases from external JSON file - will throw if none found
    const testCases = getJsonTestCases(
      "tokenization",
      "posting-parsing-examples.json",
    );

    testCases.forEach((testCase: any) => {
      test(testCase.description, () => {
        const result = TransactionParser.parsePosting(testCase.input);

        assert.ok(result, `Should parse: "${testCase.input}"`);
        // Handle null/undefined equivalence from JSON parsing
        const expectedAmount =
          testCase.expected.amount === null
            ? undefined
            : testCase.expected.amount;
        const expectedState =
          testCase.expected.state === null
            ? undefined
            : testCase.expected.state;
        const expectedComment =
          testCase.expected.comment === null
            ? undefined
            : testCase.expected.comment;

        assert.strictEqual(
          result.account,
          testCase.expected.account,
          "Account should match",
        );
        assert.strictEqual(
          result.amount,
          expectedAmount,
          "Amount should match",
        );
        assert.strictEqual(result.state, expectedState, "State should match");
        assert.strictEqual(
          result.comment,
          expectedComment,
          "Comment should match",
        );
      });
    });
  });

  suite("Invalid Parsing Examples", () => {
    // Load test cases for invalid input from external JSON file - will throw if none found
    const testCases = getJsonTestCases(
      "tokenization",
      "invalid-parsing-examples.json",
    );

    testCases.forEach((testCase: any) => {
      suite(testCase.description, () => {
        testCase.inputs.forEach((input: string) => {
          test(`Should ${testCase.shouldParse ? "parse" : "not parse"}: "${input}"`, () => {
            if (testCase.type === "transaction") {
              const result = TransactionParser.parseTransaction(
                input,
                999,
                document,
              );
              if (testCase.shouldParse) {
                assert.ok(result, `Should parse transaction: "${input}"`);
              } else {
                assert.ok(!result, `Should not parse transaction: "${input}"`);
              }
            } else if (testCase.type === "posting") {
              const result = TransactionParser.parsePosting(input);
              if (testCase.shouldParse) {
                assert.ok(result, `Should parse posting: "${input}"`);
              } else {
                assert.ok(!result, `Should not parse posting: "${input}"`);
              }
            }
          });
        });
      });
    });
  });

  suite("Reconciliation Parsing", () => {
    // Load test cases from external JSON file - will throw if none found
    const testCases = getJsonTestCases(
      "tokenization",
      "reconciliation-parsing-examples.json",
    );

    testCases.forEach((testCase: any) => {
      if (testCase.shouldParse === false) {
        suite(testCase.description, () => {
          testCase.inputs.forEach((input: string) => {
            test(`Should not parse as transaction: "${input}"`, () => {
              const result = ReconciliationToggler.parseTransactionLine(input);
              assert.ok(!result, `Should not parse as transaction: "${input}"`);
            });
          });
        });
      } else {
        test(testCase.description, () => {
          if (testCase.type === "transaction") {
            const result = ReconciliationToggler.parseTransactionLine(
              testCase.input,
            );

            assert.ok(
              result,
              `Should parse transaction line: "${testCase.input}"`,
            );
            assert.strictEqual(result.date, testCase.expected.date);
            assert.strictEqual(result.status, testCase.expected.status);
            assert.strictEqual(result.rest, testCase.expected.rest);
          } else if (testCase.type === "posting") {
            const result = ReconciliationToggler.parsePostingLine(
              testCase.input,
            );

            assert.ok(result, `Should parse posting line: "${testCase.input}"`);
            assert.strictEqual(result.status, testCase.expected.status);
            assert.strictEqual(result.indent, testCase.expected.indent);
            assert.strictEqual(result.rest, testCase.expected.rest);
          }
        });
      }
    });
  });
});
