// Transaction completion logic for C-c TAB feature
// Analyzes existing transactions to suggest completions based on payee patterns

import * as vscode from "vscode";

export interface ParsedTransaction {
  date: string;
  effectiveDate?: string;
  state?: "*" | "!";
  code?: string;
  payee: string;
  postings: ParsedPosting[];
  lineNumber: number;
  firstLineAfterTransaction: number; // First line number after this transaction
}

export interface ParsedPosting {
  account: string;
  amount?: string;
  comment?: string;
  state?: "*" | "!";
}

export interface TransactionTemplate {
  payee: string;
  postings: ParsedPosting[];
  frequency: number;
  lastSeen: number; // line number for recency tie-breaking
}

export class TransactionParser {
  static parseTransaction(
    line: string,
    lineNumber: number,
    document: vscode.TextDocument,
  ): ParsedTransaction | null {
    // Match transaction line: date [=effectiveDate] [state] [(code)] payee
    const match = line.match(
      /^(\d{4}[/-]\d{2}[/-]\d{2})(?:=(\d{4}[/-]\d{2}[/-]\d{2}))?\s*(\*|!)?\s*(?:\(([^)]+)\))?\s*(.+)$/,
    );
    if (!match) {
      return null;
    }

    const [, date, effectiveDate, state, code, payee] = match;
    const transaction: ParsedTransaction = {
      date,
      effectiveDate,
      state: state as "*" | "!" | undefined,
      code,
      payee: payee.trim(),
      postings: [],
      lineNumber,
      firstLineAfterTransaction: lineNumber + 1, // Will be updated as we parse postings
    };

    // Parse following posting lines
    let currentLine = lineNumber + 1;
    while (currentLine < document.lineCount) {
      const postingLine = document.lineAt(currentLine).text;

      // Empty line or non-indented line ends the transaction
      // NOTE: This correctly follows ledger syntax where blank lines terminate transactions.
      // This is different from LedgerOrganizer which intentionally skips blank lines
      // to clean up malformed files.
      if (!postingLine.trim() || !postingLine.match(/^\s+/)) {
        break;
      }

      const posting = this.parsePosting(postingLine);
      if (posting) {
        transaction.postings.push(posting);
      }

      currentLine++;
    }

    // Update to point to first line after this transaction
    transaction.firstLineAfterTransaction = currentLine;
    return transaction;
  }

  static parsePosting(line: string): ParsedPosting | null {
    // Match posting line: whitespace + optional state + account + optional amount + optional comment
    const match = line.match(
      /^\s+([*!]?)?\s*([^\s;]+(?:\s+[^\s;]+)*?)(?:\s{2,}([^;]+?))?(?:\s*(;.*))?$/,
    );
    if (!match) {
      return null;
    }

    const [, state, account, amount, comment] = match;
    return {
      account: account.trim(),
      amount: amount?.trim(),
      comment: comment?.trim(),
      state: (state as "*" | "!" | "") || undefined,
    };
  }

  static getAllTransactions(
    document: vscode.TextDocument,
  ): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    let lineNumber = 0;
    while (lineNumber < document.lineCount) {
      const line = document.lineAt(lineNumber).text;
      const transaction = this.parseTransaction(line, lineNumber, document);
      if (transaction) {
        transactions.push(transaction);
        // Skip to the line after this transaction ends
        lineNumber = transaction.firstLineAfterTransaction;
      } else {
        lineNumber++;
      }
    }

    return transactions;
  }

  static findTransactionTemplates(
    payee: string,
    document: vscode.TextDocument,
  ): TransactionTemplate[] {
    const allTransactions = this.getAllTransactions(document);
    const matchingTransactions = allTransactions.filter(
      (t) =>
        t.payee.toLowerCase() === payee.toLowerCase() && t.postings.length > 0, // Only consider transactions with postings as templates
    );

    if (matchingTransactions.length === 0) {
      return [];
    }

    // Group by posting pattern (serialize postings for comparison)
    const patternGroups = new Map<string, ParsedTransaction[]>();

    for (const transaction of matchingTransactions) {
      const pattern = this.serializePostingPattern(transaction.postings);
      if (!patternGroups.has(pattern)) {
        patternGroups.set(pattern, []);
      }
      patternGroups.get(pattern)!.push(transaction);
    }

    // Convert to templates with frequency and recency
    const templates: TransactionTemplate[] = [];
    for (const transactions of patternGroups.values()) {
      const mostRecent = transactions.reduce((latest, current) =>
        current.lineNumber > latest.lineNumber
          ? current
          : /* c8 ignore next */ latest,
      );

      templates.push({
        payee,
        postings: mostRecent.postings, // Use most recent example for the pattern
        frequency: transactions.length,
        lastSeen: mostRecent.lineNumber,
      });
    }

    // Sort by frequency (descending), then by recency (descending)
    templates.sort((a, b) => {
      if (a.frequency !== b.frequency) {
        return b.frequency - a.frequency;
      }
      return b.lastSeen - a.lastSeen;
    });

    return templates;
  }

  private static serializePostingPattern(postings: ParsedPosting[]): string {
    // Create a pattern string based on accounts only (ignore amounts and comments)
    return postings
      .map((p) => p.account)
      .sort()
      .join("|");
  }
}

export class TransactionCompleter {
  static async completeTransaction(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<boolean> {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Parse the current transaction line to get the payee
    const transaction = TransactionParser.parseTransaction(
      lineText,
      position.line,
      document,
    );
    if (!transaction) {
      vscode.window.showErrorMessage("Not on a valid transaction line");
      return false;
    }

    // Find templates for this payee
    const templates = TransactionParser.findTransactionTemplates(
      transaction.payee,
      document,
    );
    /* c8 ignore next 4 */
    if (templates.length === 0) {
      vscode.window.showInformationMessage(
        `No existing transactions found for payee: ${transaction.payee}`,
      );
      return false;
    }

    let selectedTemplate: TransactionTemplate;

    if (templates.length === 1) {
      selectedTemplate = templates[0];
    } else {
      // Show quick pick for multiple options
      const items = templates.map((template, index) => ({
        label: `Pattern ${index + 1} (${template.frequency} times)`,
        detail: template.postings
          .map(
            (p) =>
              `${p.account}${p.amount ? ` ${p.amount}` : /* c8 ignore next */ ""}`,
          )
          .join(", "),
        template,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Choose transaction pattern to complete",
      });

      if (!selected) {
        return false; // User cancelled
      }

      /* c8 ignore next */
      selectedTemplate = selected.template;
    }

    // Apply the completion
    return this.applyCompletion(
      document,
      position,
      transaction,
      selectedTemplate,
    );
  }

  private static async applyCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    currentTransaction: ParsedTransaction,
    template: TransactionTemplate,
  ): Promise<boolean> {
    const edit = new vscode.WorkspaceEdit();

    // Create unreconciled transaction (new transactions should start unreconciled)
    const newTransactionLine = this.buildTransactionLine(
      currentTransaction.date,
      currentTransaction.effectiveDate,
      undefined, // No state marker - new transactions are unreconciled
      currentTransaction.code,
      template.payee,
    );

    // Replace the current transaction line
    const transactionRange = new vscode.Range(
      position.line,
      0,
      position.line,
      document.lineAt(position.line).text.length,
    );
    edit.replace(document.uri, transactionRange, newTransactionLine);

    // Add posting lines
    const postingLines = template.postings.map((posting) =>
      this.buildPostingLine(posting),
    );

    let firstDollarPosition: vscode.Position | null = null;
    let amountEndPosition: vscode.Position | null = null;

    if (postingLines.length > 0) {
      const transactionLine = document.lineAt(position.line);
      const insertPosition = new vscode.Position(
        position.line,
        transactionLine.text.length,
      );

      // Check if there's content on the next line
      const hasNextLineContent =
        position.line + 1 < document.lineCount &&
        document.lineAt(position.line + 1).text.trim().length > 0;

      const postingText =
        "\n" + postingLines.join("\n") + (hasNextLineContent ? "" : "\n");
      edit.insert(document.uri, insertPosition, postingText);

      // Find the first dollar sign position in the posting lines
      for (let i = 0; i < postingLines.length; i++) {
        const dollarIndex = postingLines[i].indexOf("$");
        if (dollarIndex !== -1 && firstDollarPosition === null) {
          // Calculate the position after the edit
          const lineNumber = position.line + 1 + i;
          const columnNumber = dollarIndex + 1; // Position after the $
          firstDollarPosition = new vscode.Position(lineNumber, columnNumber);

          // Find the end of the amount (number after $)
          const amountMatch = postingLines[i]
            .substring(dollarIndex + 1)
            .match(/^[\d,.-]+/);
          if (amountMatch) {
            amountEndPosition = new vscode.Position(
              lineNumber,
              columnNumber + amountMatch[0].length,
            );
          }
          break;
        }
      }
    }

    const success = await vscode.workspace.applyEdit(edit);

    // If we found a dollar amount, select the number part after applying the edit
    if (success && firstDollarPosition && amountEndPosition) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        editor.selection = new vscode.Selection(
          firstDollarPosition,
          amountEndPosition,
        );
        editor.revealRange(
          new vscode.Range(firstDollarPosition, amountEndPosition),
          vscode.TextEditorRevealType.InCenter,
        );
      }
    }

    return success;
  }

  private static buildTransactionLine(
    date: string,
    effectiveDate?: string,
    state?: "*" | "!",
    code?: string,
    payee?: string,
  ): string {
    let line = date;

    if (effectiveDate) {
      line += `=${effectiveDate}`;
    }

    if (state) {
      line += ` ${state}`;
    }

    if (code) {
      line += ` (${code})`;
    }

    if (payee) {
      line += ` ${payee}`;
    }

    return line;
  }

  private static buildPostingLine(posting: ParsedPosting): string {
    // Always create unreconciled postings (ignore posting.state)
    // New transactions should start unreconciled regardless of template
    let line = ` ${posting.account}`;

    if (posting.amount) {
      // Align amount to column 50 (adjust as needed)
      const padding = Math.max(2, 50 - line.length);
      line += " ".repeat(padding) + posting.amount;
    }

    if (posting.comment) {
      line += `  ${posting.comment}`;
    }

    return line;
  }
}
