// Tests for reconciliation ledger interface
// These tests require ledger CLI to be installed

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { LedgerCli } from "../../src/ledgerCli";
import { ReconcileLedgerInterface } from "../../src/reconcileLedgerInterface";
import { getTestCaseDirectories } from "../testUtils";

suite("ReconcileLedgerInterface", () => {
  const testCaseDirs = getTestCaseDirectories("reconcile-ledger-interface");

  // Fail fast if ledger CLI is not available
  suiteSetup(async function () {
    const ledgerCli = new LedgerCli();
    const isAvailable = await ledgerCli.isLedgerAvailable();
    if (!isAvailable) {
      throw new Error(
        "Ledger CLI is required for reconciliation tests but is not available",
      );
    }
  });

  for (const testCaseDir of testCaseDirs) {
    const testName = path.basename(testCaseDir);
    const configPath = path.join(testCaseDir, "config.yaml");
    const inputPath = path.join(testCaseDir, "input.ledger");

    if (!fs.existsSync(configPath) || !fs.existsSync(inputPath)) {
      continue;
    }

    test(`${testName}`, async () => {
      const configContent = fs.readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      const ledgerInterface = new ReconcileLedgerInterface(inputPath);

      // Test get_accounts if expected_accounts is defined
      if (config.expected_accounts) {
        const accounts = await ledgerInterface.getAccounts();
        assert.deepStrictEqual(
          accounts,
          config.expected_accounts,
          `Accounts mismatch for ${testName}`,
        );
      }

      // Test get_uncleared_transactions_for_account if account and expected array are defined
      if (config.account && Array.isArray(config.expected)) {
        const transactions =
          await ledgerInterface.getUnclearedTransactionsForAccount(
            config.account,
          );

        assert.strictEqual(
          transactions.length,
          config.expected.length,
          `Transaction count mismatch for ${testName}: got ${transactions.length}, expected ${config.expected.length}`,
        );

        for (let i = 0; i < config.expected.length; i++) {
          const expected = config.expected[i];
          const actual = transactions[i];

          assert.strictEqual(
            actual.lineNumber,
            expected.line_number,
            `Line number mismatch for transaction ${i} in ${testName}`,
          );
          assert.strictEqual(
            actual.date,
            expected.date,
            `Date mismatch for transaction ${i} in ${testName}`,
          );
          assert.strictEqual(
            actual.description,
            expected.description,
            `Description mismatch for transaction ${i} in ${testName}`,
          );

          // Check account postings
          assert.strictEqual(
            actual.accountPostings.length,
            expected.account_postings.length,
            `Posting count mismatch for transaction ${i} in ${testName}`,
          );

          for (let j = 0; j < expected.account_postings.length; j++) {
            const expectedPosting = expected.account_postings[j];
            const actualPosting = actual.accountPostings[j];

            assert.strictEqual(
              actualPosting.account,
              expectedPosting.account,
              `Posting account mismatch for transaction ${i}, posting ${j} in ${testName}`,
            );
            assert.strictEqual(
              actualPosting.amount,
              expectedPosting.amount,
              `Posting amount mismatch for transaction ${i}, posting ${j} in ${testName}`,
            );
            assert.strictEqual(
              actualPosting.status,
              expectedPosting.status,
              `Posting status mismatch for transaction ${i}, posting ${j} in ${testName}`,
            );
            assert.strictEqual(
              actualPosting.lineNumber,
              expectedPosting.line_number,
              `Posting line number mismatch for transaction ${i}, posting ${j} in ${testName}`,
            );
          }
        }
      }

      // Test cleared_and_pending_balance if defined (object format)
      if (
        config.account &&
        config.expected?.cleared_and_pending_balance !== undefined
      ) {
        const balance = await ledgerInterface.getClearedAndPendingBalance(
          config.account,
        );
        assert.strictEqual(
          balance,
          config.expected.cleared_and_pending_balance,
          `Balance mismatch for ${testName}`,
        );
      }
    });
  }
});
