// Provides automatic indentation for transaction lines in Ledger files
// When pressing Enter on a transaction line, adds a single space indent

import * as vscode from "vscode";

export class LedgerIndentationProvider {
  async handleEnterKey(): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "ledger") {
      return false;
    }

    const position = editor.selection.active;
    const currentLine = editor.document.lineAt(position.line);
    const currentLineText = currentLine.text;

    // Check if the current line looks like a transaction line (date pattern)
    // AND is not already indented (posting lines start with whitespace)
    const transactionLinePattern = /^\d{4}[/-]\d{2}[/-]\d{2}.*$/;
    const isAlreadyIndented = /^\s/.test(currentLineText);

    if (transactionLinePattern.test(currentLineText) && !isAlreadyIndented) {
      // Insert newline with single space indentation
      await editor.edit((editBuilder) => {
        editBuilder.insert(position, "\n ");
      });
      return true;
    }

    return false;
  }
}

export function registerIndentationProvider(context: vscode.ExtensionContext) {
  const provider = new LedgerIndentationProvider();

  // Register a command for Enter key that adds indentation
  const enterCommand = vscode.commands.registerCommand(
    "ledger.handleEnter",
    async () => {
      const handled = await provider.handleEnterKey();
      if (!handled) {
        // Fall back to default Enter behavior
        await vscode.commands.executeCommand("default:type", { text: "\n" });
      }
    },
  );

  context.subscriptions.push(enterCommand);
}
