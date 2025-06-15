// Integration tests for ledger CLI functionality
// Tests basic CLI availability and balance report generation

import * as assert from "assert";
import * as path from "path";
import { LedgerCli } from "../../src/ledgerCli";

suite("Ledger CLI Integration Tests", () => {
  let ledgerCli: LedgerCli;
  let sampleLedgerPath: string;

  suiteSetup(async () => {
    ledgerCli = new LedgerCli();
    sampleLedgerPath = path.join(
      __dirname,
      "../../../test/fixtures/clean-sample.ledger",
    );

    // Fail fast if ledger CLI is not available
    const isAvailable = await ledgerCli.isLedgerAvailable();
    if (!isAvailable) {
      throw new Error(
        "Ledger CLI is required for these tests but is not available",
      );
    }
  });

  test("Should check if ledger is available", async function () {
    this.timeout(5000);
    const isAvailable = await ledgerCli.isLedgerAvailable();
    assert.ok(isAvailable, "Ledger CLI should be available for these tests");
  });

  test("Should generate balance report", async function () {
    this.timeout(10000);

    const report = await ledgerCli.getBalanceReport(sampleLedgerPath);
    assert.strictEqual(typeof report, "string");
    assert.ok(report.length > 0);

    // Balance report should contain account names and amounts
    assert.ok(report.includes("Assets") || report.includes("Expenses"));
  });
});
