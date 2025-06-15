// Visual "now" marker for ledger files
// Shows where current date would go without modifying file content

import * as vscode from "vscode";
import { findDatePosition } from "./commands";

export class NowMarkerProvider {
  private decorationType: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];
  private currentDateOverrideForTesting: Date | null = null;

  constructor(currentDateOverrideForTesting?: Date) {
    this.currentDateOverrideForTesting = currentDateOverrideForTesting ?? null;

    // Create decoration type for the "now" marker
    this.decorationType = vscode.window.createTextEditorDecorationType({
      before: {
        contentText: "→ NOW ",
        color: "white",
        fontWeight: "bold",
        margin: "0 8px 0 0",
      },
      backgroundColor: new vscode.ThemeColor("gauge.warningBackground"),
      isWholeLine: true,
      rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
    });

    // Update decorations when active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateDecorations();
      }),
    );

    // Update decorations when document content changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document === vscode.window.activeTextEditor?.document) {
          this.updateDecorations();
        }
      }),
    );

    // Initial update
    this.updateDecorations();
  }

  private updateDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "ledger") {
      return;
    }

    const nowLineNumber = this.findNowPosition(editor.document);

    if (nowLineNumber !== null) {
      const range = new vscode.Range(nowLineNumber, 0, nowLineNumber, 0);
      const decoration: vscode.DecorationOptions = { range };
      editor.setDecorations(this.decorationType, [decoration]);
    } else {
      /* c8 ignore next 3 */
      // Clear decorations if no position found
      editor.setDecorations(this.decorationType, []);
    }
  }

  private findNowPosition(document: vscode.TextDocument): number | null {
    const content = document.getText();
    const today = this.currentDateOverrideForTesting ?? new Date();
    const position = findDatePosition(content, today);

    // Convert from insertion position to display position
    // If inserting at end of file, show marker on last line instead
    const lines = content.split("\n");
    if (position >= lines.length) {
      return lines.length > 0 ? lines.length - 1 : /* c8 ignore next */ null;
    }

    return position;
  }

  public jumpToNow(): void {
    const editor = vscode.window.activeTextEditor;
    /* c8 ignore next 4 */
    if (!editor || editor.document.languageId !== "ledger") {
      vscode.window.showErrorMessage("No active Ledger file");
      return;
    }

    const nowLineNumber = this.findNowPosition(editor.document);

    if (nowLineNumber !== null) {
      const position = new vscode.Position(nowLineNumber, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter,
      );
      vscode.window.showInformationMessage("Jumped to current date position");
      /* c8 ignore next 5 */
    } else {
      vscode.window.showInformationMessage(
        "No position found for current date",
      );
    }
  }

  public dispose(): void {
    this.decorationType.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
