// Tests for reconciliation file editor
// Uses data-driven tests from test/data/reconcile-file-editor/

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "yaml";
import { ReconcileFileEditor } from "../../src/reconcileFileEditor";
import { getTestCaseDirectories } from "../testUtils";

suite("ReconcileFileEditor", () => {
  const testCaseDirs = getTestCaseDirectories("reconcile-file-editor");

  for (const testCaseDir of testCaseDirs) {
    const testName = path.basename(testCaseDir);
    const configPath = path.join(testCaseDir, "config.yaml");
    const inputPath = path.join(testCaseDir, "input.ledger");

    if (!fs.existsSync(configPath) || !fs.existsSync(inputPath)) {
      continue;
    }

    test(`${testName}`, () => {
      const configContent = fs.readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);
      const testParams = config.test_params;

      assert.ok(testParams, `Missing test_params in config for ${testName}`);

      // Create a temporary copy of the input file
      const inputContent = fs.readFileSync(inputPath, "utf-8");
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-test-"));
      const tempFile = path.join(tempDir, "test.ledger");
      fs.writeFileSync(tempFile, inputContent, "utf-8");

      try {
        const editor = new ReconcileFileEditor(tempFile);

        const result = editor.updatePostingsStatus(
          testParams.posting_line_numbers,
          testParams.expected_current_status,
          testParams.new_status,
        );

        assert.strictEqual(
          result,
          testParams.expected_result,
          `Result mismatch for ${testName}: got ${result}, expected ${testParams.expected_result}`,
        );

        // If successful and there's an expected.ledger, check the output
        const expectedPath = path.join(testCaseDir, "expected.ledger");
        if (result && fs.existsSync(expectedPath)) {
          const actualContent = fs.readFileSync(tempFile, "utf-8");
          const expectedContent = fs.readFileSync(expectedPath, "utf-8");
          assert.strictEqual(
            actualContent,
            expectedContent,
            `Output mismatch for ${testName}`,
          );
        }
      } finally {
        // Clean up
        fs.unlinkSync(tempFile);
        fs.rmdirSync(tempDir);
      }
    });
  }
});
