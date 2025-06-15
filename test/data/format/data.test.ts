import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { LedgerOrganizer } from "../../../src/ledgerOrganizer";
import { getTestCaseDirectories } from "../../testUtils";

suite("Format Data-Driven Tests", () => {
  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("format");

  testCaseDirectories.forEach((testCaseDir) => {
    const testCase = path.basename(testCaseDir);
    test(`Should format correctly: ${testCase}`, () => {
      const inputPath = path.join(testCaseDir, "input.ledger");
      const expectedPath = path.join(testCaseDir, "expected.ledger");

      // Read input and expected content
      const inputContent = fs.readFileSync(inputPath, "utf8");
      const expectedContent = fs.readFileSync(expectedPath, "utf8");

      // Format the content (formatting only - no sorting)
      const actualContent = LedgerOrganizer.formatLedgerContent(inputContent);

      // Compare with expected output
      assert.strictEqual(
        actualContent,
        expectedContent,
        `Test case ${testCase} failed.\nExpected:\n${JSON.stringify(expectedContent)}\nActual:\n${JSON.stringify(actualContent)}`,
      );
    });
  });
});
