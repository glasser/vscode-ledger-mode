// Provides quick fixes for small balance errors in transactions
// Adds a rounding posting when transactions are off by less than $1

import * as vscode from "vscode";

export class BalanceQuickFixProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] | undefined {
    // Only provide quick fixes for diagnostics
    const diagnostics = context.diagnostics.filter(
      (diagnostic) => diagnostic.source === "ledger",
    );

    const codeActions: vscode.CodeAction[] = [];

    for (const diagnostic of diagnostics) {
      // Check if this is a balance error with an amount
      const match = diagnostic.message.match(
        /Transaction does not balance \(off by ([+-]?\$?[\d,]+\.?\d*)\)/,
      );

      if (match) {
        const offByAmount = this.parseAmount(match[1]);
        if (offByAmount !== null && Math.abs(offByAmount) < 1.0) {
          const fix = this.createRoundingFix(document, diagnostic, offByAmount);
          if (fix) {
            codeActions.push(fix);
          }
        }
      }
    }

    return codeActions;
  }

  private parseAmount(amountStr: string): number | null {
    // Remove dollar sign and commas, handle negative amounts
    const cleanAmount = amountStr.replace(/[$,]/g, "").trim();
    const amount = parseFloat(cleanAmount);
    return isNaN(amount) ? null : amount;
  }

  private createRoundingFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    offByAmount: number,
  ): vscode.CodeAction | undefined {
    // Find the transaction that has the error
    const transactionRange = this.findTransactionRange(
      document,
      diagnostic.range.start.line,
    );
    if (!transactionRange) {
      return undefined;
    }

    // Create the rounding posting with the opposite amount
    const roundingAmount = -offByAmount;
    const formattedAmount = this.formatAmount(roundingAmount);
    const roundingPosting = ` Expenses:Personal:Rounding                           ${formattedAmount}`;

    // Find where to insert the rounding posting (at the end of the transaction)
    const insertPosition = new vscode.Position(transactionRange.end.line, 0);

    const fix = new vscode.CodeAction(
      `Add rounding posting of ${formattedAmount}`,
      vscode.CodeActionKind.QuickFix,
    );
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.insert(document.uri, insertPosition, roundingPosting + "\n");
    fix.diagnostics = [diagnostic];
    fix.isPreferred = true;

    return fix;
  }

  private findTransactionRange(
    document: vscode.TextDocument,
    errorLine: number,
  ): vscode.Range | undefined {
    // Find the start of the transaction (date line)
    let startLine = errorLine;
    while (startLine >= 0) {
      const line = document.lineAt(startLine).text;
      // Check if this is a transaction date line (starts with a date)
      if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(line.trim())) {
        break;
      }
      startLine--;
    }

    if (startLine < 0) {
      return undefined;
    }

    // Find the end of the transaction (next blank line or next transaction)
    let endLine = startLine + 1;
    while (endLine < document.lineCount) {
      const line = document.lineAt(endLine).text;

      // Stop at blank line
      if (line.trim() === "") {
        break;
      }

      // Stop at next transaction
      if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(line.trim())) {
        break;
      }

      endLine++;
    }

    return new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, 0),
    );
  }

  private formatAmount(amount: number): string {
    // Format the amount with dollar sign and two decimal places
    const sign = amount < 0 ? "-" : "";
    const absAmount = Math.abs(amount);
    return `${sign}$${absAmount.toFixed(2)}`;
  }
}
