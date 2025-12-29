// Tests for reconciliation balance parser
// Uses data-driven tests from test/data/reconcile-balance-parser/

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import {
  parseBalance,
  formatBalance,
  BalanceParseError,
} from "../../src/reconcileBalanceParser";
import { getTestCaseDirectories } from "../testUtils";

suite("ReconcileBalanceParser", () => {
  const testCaseDirs = getTestCaseDirectories("reconcile-balance-parser");

  for (const testCaseDir of testCaseDirs) {
    const testName = path.basename(testCaseDir);
    const configPath = path.join(testCaseDir, "config.yaml");

    if (!fs.existsSync(configPath)) {
      continue;
    }

    test(`${testName}`, () => {
      const configContent = fs.readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      // Check if this is an error test case
      if (config.expected?.error) {
        assert.throws(
          () => parseBalance(config.input),
          BalanceParseError,
          `Expected error for ${testName}`,
        );
        return;
      }

      // Normal test case
      const parsedAmount = parseBalance(config.input);
      const formattedDisplay = formatBalance(parsedAmount);

      assert.strictEqual(
        parsedAmount,
        config.expected.parsed_amount,
        `Parsed amount mismatch for ${testName}`,
      );
      assert.strictEqual(
        formattedDisplay,
        config.expected.formatted_display,
        `Formatted display mismatch for ${testName}`,
      );
    });
  }

  suite("edge cases", () => {
    test("throws on empty input", () => {
      assert.throws(() => parseBalance(""), BalanceParseError);
      assert.throws(() => parseBalance("   "), BalanceParseError);
    });

    test("throws on invalid input", () => {
      assert.throws(() => parseBalance("abc"), BalanceParseError);
      assert.throws(() => parseBalance("$abc"), BalanceParseError);
    });

    test("handles whole numbers", () => {
      assert.strictEqual(parseBalance("100"), 100);
      assert.strictEqual(formatBalance(100), "$100.00");
    });
  });
});
