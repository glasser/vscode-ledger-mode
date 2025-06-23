// Data-driven tests for the visual "now" marker functionality
// Tests position detection using file-based test cases

import * as assert from "assert";
import * as vscode from "vscode";
import { readFileSync } from "fs";
import { NowMarkerProvider } from "../../../src/nowMarker";
import { getTestCaseFiles } from "../../testUtils";

suite("Now Marker Data-Driven Tests", () => {
  let nowMarkerProvider: NowMarkerProvider;

  setup(() => {
    nowMarkerProvider = new NowMarkerProvider(new Date("2015-12-23T10:00:00"));
  });

  teardown(() => {
    nowMarkerProvider.dispose();
  });

  // Get all test case files matching the pattern - will throw if none found
  const testCases = getTestCaseFiles(
    "nowMarker",
    /^(\S+)-to-line-(\d+)\.ledger$/,
  );

  testCases.forEach(({ match, fullPath }) => {
    const title = match[1];
    const expectedLine = +match[2];
    const content = readFileSync(fullPath, "utf8");
    test(`${title} jumps to line ${expectedLine}`, async () => {
      const document = await vscode.workspace.openTextDocument({
        content,
        language: "ledger",
      });
      await vscode.window.showTextDocument(document);
      nowMarkerProvider.jumpToNow();
      assert.equal(
        vscode.window.activeTextEditor?.selection.active.line,
        // Subtract one because humans (and VSCode's display) thinks in 1-based lines.
        expectedLine - 1,
      );
    });
  });
});
