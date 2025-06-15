import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { LedgerCli } from "../../../src/ledgerCli";
import { getTestCaseFiles } from "../../testUtils";

interface ValidationTestCase {
  file: string;
  description: string;
  expectedErrors: {
    message: string;
    line?: number;
    severity: "error" | "warning";
    description: string;
  }[];
}

suite("Ledger CLI Integration Tests", () => {
  let ledgerCli: LedgerCli;

  suiteSetup(async () => {
    ledgerCli = new LedgerCli();

    // Fail fast if ledger CLI is not available
    const isAvailable = await ledgerCli.isLedgerAvailable();
    if (!isAvailable) {
      throw new Error(
        "Ledger CLI is required for these tests but is not available",
      );
    }
  });

  test("Should validate ledger files according to test data", async function () {
    this.timeout(10000);

    // Get all JSON test case files - will throw if none found
    const testCases = getTestCaseFiles("ledger-cli", /^(.+)\.json$/);

    for (const { filename, fullPath } of testCases) {
      const testData: ValidationTestCase = JSON.parse(
        fs.readFileSync(fullPath, "utf8"),
      );

      // Resolve file path relative to test data directory
      const testDataDir = path.dirname(fullPath);
      const ledgerFilePath = path.resolve(testDataDir, testData.file);

      const errors = await ledgerCli.validateFile(ledgerFilePath);
      assert.ok(
        Array.isArray(errors),
        `${filename}: Should return array of errors`,
      );

      // Check that we got the expected number of errors
      assert.strictEqual(
        errors.length,
        testData.expectedErrors.length,
        `${filename}: Expected ${testData.expectedErrors.length} errors but got ${errors.length}. Actual errors: ${JSON.stringify(errors, null, 2)}`,
      );

      // Validate each expected error
      for (let i = 0; i < testData.expectedErrors.length; i++) {
        const expectedError = testData.expectedErrors[i];
        const matchingError = errors.find(
          (error) =>
            error.message === expectedError.message &&
            error.severity === expectedError.severity &&
            (expectedError.line === undefined ||
              error.line === expectedError.line),
        );

        assert.ok(
          matchingError,
          `${filename}: Could not find expected error "${expectedError.description}" with exact message "${expectedError.message}" and severity "${expectedError.severity}"${expectedError.line !== undefined ? ` on line ${expectedError.line}` : ""}. Actual errors: ${JSON.stringify(errors, null, 2)}`,
        );

        // Verify error structure
        assert.strictEqual(
          typeof matchingError.message,
          "string",
          `${filename}: Error message should be string`,
        );
        assert.ok(
          ["error", "warning"].includes(matchingError.severity),
          `${filename}: Error severity should be error or warning`,
        );
        if (expectedError.line !== undefined) {
          assert.strictEqual(
            typeof matchingError.line,
            "number",
            `${filename}: Error line should be number when specified`,
          );
        }
      }
    }
  });
});
