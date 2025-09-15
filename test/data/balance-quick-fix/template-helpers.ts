// Template helpers for balance quick fix test data
// Provides data transformation for test case presentation

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

export interface QuickFixTestConfig {
  description: string;
  diagnostic: string;
  expectQuickFix: boolean;
}

export interface QuickFixTestCase {
  testCaseName: string;
  config: QuickFixTestConfig;
  input: string;
  expected: string;
}

export function getTestCases(): QuickFixTestCase[] {
  const dataDir = path.join(__dirname, "..");
  const testCaseDirs = fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => name !== "template-helpers.ts" && !name.endsWith(".js"));

  return testCaseDirs.map((testCaseName) => {
    const testCaseDir = path.join(dataDir, testCaseName);
    const configPath = path.join(testCaseDir, "config.yaml");
    const inputPath = path.join(testCaseDir, "input.ledger");
    const expectedPath = path.join(testCaseDir, "expected.ledger");

    const configContent = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(configContent) as QuickFixTestConfig;

    const input = fs.readFileSync(inputPath, "utf8");
    const expected = fs.readFileSync(expectedPath, "utf8");

    return {
      testCaseName,
      config,
      input,
      expected,
    };
  });
}
