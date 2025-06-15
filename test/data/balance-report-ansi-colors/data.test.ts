// Tests for ANSI color code conversion in balance report view
// Ensures ANSI color codes from ledger are properly converted to HTML

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { BalanceReportViewProvider } from "../../../src/balanceReportView";
import { getTestCaseFiles } from "../../testUtils";

suite("Balance Report ANSI Color Tests", () => {
  // Get all test case files that match the pattern - will throw if none found
  const testCaseFiles = getTestCaseFiles(
    "balance-report-ansi-colors",
    /^(.+)-input\.txt$/,
  );

  testCaseFiles.forEach((testCaseFile) => {
    const baseName = testCaseFile.match[1];
    const testDataDir = path.dirname(testCaseFile.fullPath);
    const expectedFile = path.join(testDataDir, `${baseName}-expected.html`);

    test(`Should convert ANSI to HTML correctly: ${baseName}`, () => {
      const provider = new BalanceReportViewProvider({} as any);

      const ansiInput = fs.readFileSync(testCaseFile.fullPath, "utf8");
      const expectedHtml = fs.readFileSync(expectedFile, "utf8");

      const actualHtml = provider.ansiToHtml(ansiInput);

      assert.strictEqual(
        actualHtml,
        expectedHtml,
        `ANSI to HTML conversion should match expected output for ${baseName}`,
      );
    });
  });
});
