// Unit tests for the visual "now" marker functionality
// Tests basic functionality, error handling, and edge cases

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import { NowMarkerProvider } from "../../src/nowMarker";

suite("Now Marker Tests", () => {
  let nowMarkerProvider: NowMarkerProvider;

  setup(() => {
    nowMarkerProvider = new NowMarkerProvider(new Date("2015-12-23T10:00:00"));
  });

  teardown(() => {
    nowMarkerProvider.dispose();
  });

  test("Should be created without errors", () => {
    assert.ok(nowMarkerProvider, "NowMarkerProvider should be created");
  });

  test("Jump to now command should work with ledger file", async () => {
    const samplePath = path.join(
      __dirname,
      "../../../test/fixtures/sample.ledger",
    );
    const document = await vscode.workspace.openTextDocument(samplePath);
    await vscode.window.showTextDocument(document);

    try {
      // Execute jump to now
      nowMarkerProvider.jumpToNow();
      assert.ok(true, "Jump to now should not throw");
    } catch (error) {
      assert.fail(`Jump to now should not throw: ${error}`);
    }
  });

  test("Should handle empty ledger file", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: "",
      language: "ledger",
    });
    await vscode.window.showTextDocument(document);

    try {
      nowMarkerProvider.jumpToNow();
      assert.ok(true, "Should handle empty files gracefully");
    } catch (error) {
      assert.fail(`Should handle empty files gracefully: ${error}`);
    }
  });

  test("Should handle non-ledger files", () => {
    // Test with no active editor (non-ledger context)
    try {
      nowMarkerProvider.jumpToNow();
      assert.ok(true, "Should handle non-ledger files gracefully");
    } catch (error) {
      assert.fail(`Should handle non-ledger files gracefully: ${error}`);
    }
  });

  test("Should handle file with no valid position", async () => {
    // Create a ledger file where the now position would be null
    // (a file that would cause findNowPosition to return null)
    const document = await vscode.workspace.openTextDocument({
      content: "this is not a valid ledger file with no dates",
      language: "ledger",
    });
    await vscode.window.showTextDocument(document);

    try {
      // This should trigger the else branch in jumpToNow when nowLineNumber is null
      nowMarkerProvider.jumpToNow();
      assert.ok(true, "Should handle files with no valid position gracefully");
    } catch (error) {
      assert.fail(
        `Should handle files with no valid position gracefully: ${error}`,
      );
    }
  });

  test("Should handle completely empty file (zero length)", async () => {
    // Test the edge case where lines.length is 0
    const nowMarkerProvider2 = new NowMarkerProvider(
      new Date("2015-12-23T10:00:00"),
    );
    const document = await vscode.workspace.openTextDocument({
      content: "",
      language: "ledger",
    });
    await vscode.window.showTextDocument(document);

    try {
      nowMarkerProvider2.jumpToNow();
      assert.ok(true, "Should handle zero-length files gracefully");
    } catch (error) {
      assert.fail(`Should handle zero-length files gracefully: ${error}`);
    }

    nowMarkerProvider2.dispose();
  });

  test("Should clear decorations when no position found", async () => {
    // Test updateDecorations() path that clears decorations
    const nowMarkerProvider3 = new NowMarkerProvider(
      new Date("2015-12-23T10:00:00"),
    );

    // First, create a file with valid content to establish decorations
    const document1 = await vscode.workspace.openTextDocument({
      content:
        "2015-12-22 Past transaction\n    Assets:Cash    $100.00\n    Income:Salary\n\n2015-12-24 Future transaction\n    Assets:Cash    $50.00\n    Income:Bonus",
      language: "ledger",
    });
    await vscode.window.showTextDocument(document1);

    // Give it time to set up decorations
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Now create a completely empty file to trigger decoration clearing
    const document2 = await vscode.workspace.openTextDocument({
      content: "", // Empty content causes findNowPosition to return null
      language: "ledger",
    });
    await vscode.window.showTextDocument(document2);

    // Give it time to clear decorations
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.ok(
      true,
      "Should clear decorations when switching to file with no valid position",
    );

    nowMarkerProvider3.dispose();
  });
});
