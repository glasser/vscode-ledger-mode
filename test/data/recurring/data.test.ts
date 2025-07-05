// Data-driven tests for recurring transaction generation
import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { RecurringTransactionProcessor } from "../../../src/recurringTransactions";
import { getTestCaseDirectories } from "../../testUtils";

interface TestConfig {
  description: string;
  targetDate: string;
}

suite("Recurring Transaction Data Tests", () => {
  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("recurring");

  for (const testCaseDir of testCaseDirectories) {
    const testCase = path.basename(testCaseDir);
    test(`Should process recurring transactions: ${testCase}`, async () => {
      const inputPath = path.join(testCaseDir, "input.ledger");
      const expectedPath = path.join(testCaseDir, "expected.ledger");
      const configPath = path.join(testCaseDir, "config.yaml");

      // Read test configuration
      const configContent = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(configContent) as TestConfig;

      // Read input and expected output
      const input = fs.readFileSync(inputPath, "utf8");
      const expected = fs.readFileSync(expectedPath, "utf8");

      // Process recurring transactions
      const processor = new RecurringTransactionProcessor();
      const result = await processor.processRecurringTransactions(
        input,
        new Date(config.targetDate),
      );

      // Compare results
      assert.strictEqual(
        result,
        expected,
        `Test case "${testCase}" failed: ${config.description}`,
      );
    });
  }
});
