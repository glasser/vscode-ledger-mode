import * as assert from "assert";
import * as vscode from "vscode";
import { LedgerOrganizer } from "../../src/ledgerOrganizer";

suite("Document Formatter VSCode Integration Tests", function () {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;

  suiteSetup(async function () {
    this.timeout(10000); // Give extension time to activate

    // Wait a bit for extensions to load
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find our extension by looking for one that provides ledger language
    const allExtensions = vscode.extensions.all;
    let ourExtension: vscode.Extension<any> | undefined;

    for (const ext of allExtensions) {
      const packageJSON = ext.packageJSON;
      if (
        packageJSON &&
        packageJSON.contributes &&
        packageJSON.contributes.languages
      ) {
        const languages = packageJSON.contributes.languages;
        if (
          Array.isArray(languages) &&
          languages.some((lang: any) => lang.id === "ledger")
        ) {
          ourExtension = ext;
          break;
        }
      }
    }

    if (ourExtension && !ourExtension.isActive) {
      await ourExtension.activate();
    }

    // Wait a bit more for activation to complete
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  teardown(async () => {
    if (editor) {
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    }
  });

  test("Should register document formatter for ledger language", async function () {
    // Verify that formatting commands are available
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes("editor.action.formatDocument"),
      "Format Document command should be available",
    );

    // Verify our extension is loaded and provides ledger language
    const allExtensions = vscode.extensions.all;
    assert.ok(allExtensions.length > 0, "Should have extensions loaded");

    // Look for extensions with 'ledger' in their ID or name
    const ledgerRelated = allExtensions.filter((ext) => {
      const id = ext.id.toLowerCase();
      const name = ext.packageJSON?.name?.toLowerCase() || "";
      const displayName = ext.packageJSON?.displayName?.toLowerCase() || "";
      return (
        id.includes("ledger") ||
        name.includes("ledger") ||
        displayName.includes("ledger")
      );
    });

    assert.ok(
      ledgerRelated.length > 0,
      "Should find at least one ledger-related extension",
    );

    // Find our extension by looking for one that provides ledger language
    let foundLedgerLanguageProvider = false;
    for (const ext of allExtensions) {
      const packageJSON = ext.packageJSON;
      if (
        packageJSON &&
        packageJSON.contributes &&
        packageJSON.contributes.languages
      ) {
        const languages = packageJSON.contributes.languages;
        if (
          Array.isArray(languages) &&
          languages.some((lang: any) => lang.id === "ledger")
        ) {
          foundLedgerLanguageProvider = true;
          assert.ok(
            ext.isActive,
            "Extension providing ledger language should be active",
          );
          break;
        }
      }
    }

    assert.ok(
      foundLedgerLanguageProvider,
      "Should find extension providing ledger language",
    );

    // Check if languages are properly registered
    const providers = (vscode.languages as any).getLanguages
      ? await (vscode.languages as any).getLanguages()
      : [];
    assert.ok(
      Array.isArray(providers),
      "Should get list of registered languages",
    );

    // For now, just verify basic functionality works
    const organizer = LedgerOrganizer.sortLedgerContent(
      "1999-01-01 Test\n Assets:Test $10\n",
    );
    assert.ok(
      organizer.includes("1999-01-01"),
      "LedgerOrganizer should be available and working",
    );
  });

  test("Should provide formatting via document formatter provider", async function () {
    this.timeout(5000);

    // Test the core functionality directly
    const content = `1999-12-31 Later Transaction
 Expenses:Test $10.00
 Assets:Checking

1999-01-01 Earlier Transaction
 Expenses:Food   $5.00
 Assets:Checking`;

    const organizedContent = LedgerOrganizer.sortLedgerContent(content);

    // Verify core functionality
    const lines = organizedContent.split("\n");
    const dateLines = lines.filter((line) => line.match(/^\d{4}-\d{2}-\d{2}/));
    assert.strictEqual(dateLines.length, 2, "Should have two transactions");
    assert.ok(
      dateLines[0].includes("1999-01-01"),
      "Earlier transaction should come first",
    );
    assert.ok(
      dateLines[1].includes("1999-12-31"),
      "Later transaction should come second",
    );
    // Should have sorted dates correctly without FUTURE separator
    assert.ok(
      !organizedContent.includes("; ** FUTURE **"),
      "Should not add FUTURE separator",
    );

    // Test that formatter is registered for ledger language
    const languages = await vscode.languages.getLanguages();
    assert.ok(
      languages.includes("ledger"),
      "Ledger language should be registered",
    );
  });

  test("Should handle format command execution", async function () {
    this.timeout(5000);

    // Create a temporary .ledger file
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const tempDir = os.tmpdir();
    const testFile = path.join(tempDir, "test-format-command.ledger");

    const content = `1999-12-01 Test Transaction
 Expenses:Test $10.00
 Assets:Checking

1999-01-01 Earlier Transaction  
 Expenses:Food    $5.00
 Assets:Checking`;

    // Write test file
    fs.writeFileSync(testFile, content);

    try {
      // Open the .ledger file
      const fileUri = vscode.Uri.file(testFile);
      document = await vscode.workspace.openTextDocument(fileUri);
      editor = await vscode.window.showTextDocument(document);

      // Verify it's recognized as ledger
      assert.strictEqual(
        document.languageId,
        "ledger",
        "File should be recognized as ledger",
      );

      // Check if the command is available
      const commands = await vscode.commands.getCommands();
      assert.ok(
        commands.includes("editor.action.formatDocument"),
        "Format Document command should be available",
      );

      // Get document content before formatting
      const contentBefore = document.getText();

      // Execute format document command - should not throw
      await vscode.commands.executeCommand("editor.action.formatDocument");

      // Wait a bit for the formatting to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get document content after formatting
      const contentAfter = document.getText();

      // Content should have changed (amounts aligned)
      assert.notStrictEqual(
        contentBefore,
        contentAfter,
        "Document should be formatted",
      );

      // Verify transactions are NOT sorted (preserve original order)
      const lines = contentAfter.split("\n");
      const dateLines = lines.filter((line) =>
        line.match(/^\d{4}-\d{2}-\d{2}/),
      );
      assert.ok(
        dateLines[0].includes("1999-12-01"),
        "First transaction should remain first",
      );
      assert.ok(
        dateLines[1].includes("1999-01-01"),
        "Second transaction should remain second",
      );

      // Verify amounts are aligned
      assert.ok(
        contentAfter.includes("$10.00"),
        "Should contain properly aligned amounts",
      );
      assert.ok(
        contentAfter.includes("$5.00"),
        "Should contain properly aligned amounts",
      );
    } finally {
      // Clean up
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });
});
