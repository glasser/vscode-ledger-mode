// Document formatter for ledger files using VSCode's built-in formatting infrastructure
// Integrates with format-on-save and preserves cursor/scroll position automatically

import * as vscode from "vscode";
import { LedgerOrganizer } from "./ledgerOrganizer";

export class LedgerDocumentFormatter
  implements vscode.DocumentFormattingEditProvider
{
  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
  ): Promise<vscode.TextEdit[]> {
    try {
      // Capture the original content at the start to avoid race conditions
      const originalContent = document.getText();
      const organizedContent =
        LedgerOrganizer.formatLedgerContent(originalContent);

      // Only return edits if content actually changed (compare against original)
      if (organizedContent !== originalContent) {
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(originalContent.length),
        );

        return [vscode.TextEdit.replace(fullRange, organizedContent)];
      }
      /* c8 ignore next 2 */

      return [];
      /* c8 ignore next 6 */
    } catch (error) {
      // Don't fail formatting - just log error
      console.error("Failed to format ledger document:", error);
      return [];
    }
  }
}

export function registerDocumentFormatter(context: vscode.ExtensionContext) {
  const formatter = new LedgerDocumentFormatter();

  const disposable = vscode.languages.registerDocumentFormattingEditProvider(
    { language: "ledger" },
    formatter,
  );

  context.subscriptions.push(disposable);
}
