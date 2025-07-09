// Data-driven tests for date parsing functionality
import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { parseDateString } from "../../../src/commands";
import { getTestCaseDirectories } from "../../testUtils";

interface TestConfig {
  description: string;
  referenceDate: string;
  testCases: Array<{
    input: string;
    expected: string | null;
  }>;
}

suite("Date Parsing Data Tests", () => {
  // Get all test case directories - will throw if none found
  const testCaseDirectories = getTestCaseDirectories("date-parsing");

  for (const testCaseDir of testCaseDirectories) {
    const testCase = path.basename(testCaseDir);
    test(`Should parse dates correctly: ${testCase}`, () => {
      const configPath = path.join(testCaseDir, "config.yaml");

      // Read test configuration
      const configContent = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(configContent) as TestConfig;

      const referenceDate = new Date(config.referenceDate);
      // Test each case
      config.testCases.forEach((testCase) => {
        const result = parseDateString(testCase.input, referenceDate);
        const resultStr = result ? result.toISOString().split("T")[0] : null;

        assert.strictEqual(
          resultStr,
          testCase.expected,
          `Failed for input "${testCase.input}" with reference date ${config.referenceDate}`,
        );
      });
    });
  }
});
