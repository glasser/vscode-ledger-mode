// Shared utilities for data-driven tests
// Ensures test cases are found and fails if directories are empty

import * as path from "path";
import * as fs from "fs";

/**
 * Get test case directories for a specific test type.
 * Throws an error if no test cases are found to prevent silent test failures.
 *
 * @param testType - The name of the test directory (e.g., 'organize-ledger', 'tokenization')
 * @returns Array of test case directory paths
 */
export function getTestCaseDirectories(testType: string): string[] {
  // From compiled output (out/test/testUtils.js), go up to project root, then to test/data/X
  const testDataDir = path.join(__dirname, `../../test/data/${testType}`);

  if (!fs.existsSync(testDataDir)) {
    throw new Error(`Test data directory does not exist: ${testDataDir}`);
  }

  const entries = fs.readdirSync(testDataDir, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(testDataDir, entry.name));

  if (directories.length === 0) {
    throw new Error(`No test case directories found in: ${testDataDir}`);
  }

  return directories;
}

/**
 * Get test case files matching a pattern for a specific test type.
 * Throws an error if no test cases are found to prevent silent test failures.
 *
 * @param testType - The name of the test directory (e.g., 'nowMarker', 'tokenization')
 * @param pattern - RegExp pattern to match filenames
 * @returns Array of test case objects with filename info
 */
export function getTestCaseFiles(
  testType: string,
  pattern: RegExp,
): Array<{ filename: string; fullPath: string; match: RegExpMatchArray }> {
  // From compiled output (out/test/testUtils.js), go up to project root, then to test/data/X
  const testDataDir = path.join(__dirname, `../../test/data/${testType}`);

  if (!fs.existsSync(testDataDir)) {
    throw new Error(`Test data directory does not exist: ${testDataDir}`);
  }

  const files = fs.readdirSync(testDataDir);
  const testCases = files
    .map((filename) => {
      const match = filename.match(pattern);
      return match
        ? {
            filename,
            fullPath: path.join(testDataDir, filename),
            match,
          }
        : null;
    })
    .filter(
      (testCase): testCase is NonNullable<typeof testCase> => testCase !== null,
    );

  if (testCases.length === 0) {
    throw new Error(
      `No test case files matching pattern ${pattern} found in: ${testDataDir}`,
    );
  }

  return testCases;
}

/**
 * Read JSON test cases from a file.
 * Throws an error if file doesn't exist or is empty.
 *
 * @param testType - The name of the test directory
 * @param filename - The JSON filename
 * @returns Parsed JSON test cases
 */
export function getJsonTestCases(testType: string, filename: string): any[] {
  // From compiled output (out/test/testUtils.js), go up to project root, then to test/data/X
  const filePath = path.join(
    __dirname,
    `../../test/data/${testType}/${filename}`,
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Test case file does not exist: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const testCases = JSON.parse(content);

  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error(`No test cases found in: ${filePath}`);
  }

  return testCases;
}
