// Tests for S-expression parser used by ledger emacs command output

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { SExpParser, SExpParseError } from "../../src/sexpParser";
import { getTestCaseDirectories } from "../testUtils";

suite("SExpParser", () => {
  // Data-driven tests from test/data/sexp-parser/
  const testCaseDirs = getTestCaseDirectories("sexp-parser");

  for (const testCaseDir of testCaseDirs) {
    const testName = path.basename(testCaseDir);
    const inputPath = path.join(testCaseDir, "input.sexp");
    const outputJsonPath = path.join(testCaseDir, "output.json");
    const outputErrorPath = path.join(testCaseDir, "output.error");

    if (!fs.existsSync(inputPath)) {
      continue;
    }

    const isErrorCase = fs.existsSync(outputErrorPath);
    const hasExpectedOutput = fs.existsSync(outputJsonPath);

    if (!isErrorCase && !hasExpectedOutput) {
      continue;
    }

    if (isErrorCase) {
      test(`throws error for ${testName}`, () => {
        const input = fs.readFileSync(inputPath, "utf-8");
        const parser = new SExpParser();
        assert.throws(() => parser.parse(input), SExpParseError);
      });
    } else {
      test(`parses ${testName}`, () => {
        const input = fs.readFileSync(inputPath, "utf-8");
        const expectedJson = fs.readFileSync(outputJsonPath, "utf-8");
        const expected = JSON.parse(expectedJson);

        const parser = new SExpParser();
        const result = parser.parse(input);

        assert.deepStrictEqual(result, expected);
      });
    }
  }
});
