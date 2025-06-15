// Handles toggling reconciliation status of transactions and postings

import * as vscode from "vscode";

interface TransactionLineParts {
  date: string;
  status: string;
  rest: string;
}

interface PostingLineParts {
  indent: string;
  status: string;
  rest: string;
}

export class ReconciliationToggler {
  /**
   * Toggle the reconciliation status at the current cursor position
   */
  static async toggleAtCursor(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Try parsing as transaction first, then as posting
    const transactionParsed = this.parseTransactionLine(lineText);
    if (transactionParsed) {
      await this.toggleTransaction(editor, position.line, transactionParsed);
      return;
    }

    const postingParsed = this.parsePostingLine(lineText);
    if (postingParsed) {
      await this.togglePosting(editor, position.line, postingParsed);
    }
  }

  static parseTransactionLine(lineText: string): TransactionLineParts | null {
    const match = lineText.match(/^(\d{4}-\d{2}-\d{2})(?:\s+([*!]))?(.*)$/);
    if (!match) {
      return null;
    }
    return {
      date: match[1],
      status: match[2] || "",
      rest: match[3],
    };
  }

  static parsePostingLine(lineText: string): PostingLineParts | null {
    const match = lineText.match(/^(\s+)([*!]\s+)?(.*)$/);
    if (!match) {
      return null;
    }
    return {
      indent: match[1],
      status: match[2] ? match[2].trim() : "",
      rest: match[3],
    };
  }

  private static buildTransactionLineWithMarker(
    parsed: TransactionLineParts,
    marker: string,
  ): string {
    return marker
      ? `${parsed.date} ${marker}${parsed.rest}`
      : `${parsed.date}${parsed.rest}`;
  }

  private static buildPostingLineWithMarker(
    parsed: PostingLineParts,
    marker: string,
  ): string {
    return marker
      ? `${parsed.indent}${marker} ${parsed.rest}`
      : `${parsed.indent}${parsed.rest}`;
  }

  private static async toggleTransaction(
    editor: vscode.TextEditor,
    lineNumber: number,
    parsed: TransactionLineParts,
  ): Promise<void> {
    const document = editor.document;
    const line = document.lineAt(lineNumber);

    const newMarker = parsed.status === "*" || parsed.status === "!" ? "" : "*";
    const updatedText = this.buildTransactionLineWithMarker(parsed, newMarker);

    await editor.edit((editBuilder) => {
      editBuilder.replace(line.range, updatedText);
    });

    await this.applyMarkerNormalization(editor, lineNumber);
  }

  private static async togglePosting(
    editor: vscode.TextEditor,
    lineNumber: number,
    postingParsed: PostingLineParts,
  ): Promise<void> {
    const document = editor.document;

    const transactionLine = this.findTransactionStart(document, lineNumber);
    if (transactionLine === -1) {
      return;
    }

    const transactionLineText = document.lineAt(transactionLine).text;
    const transactionParsed = this.parseTransactionLine(transactionLineText);

    if (transactionParsed?.status) {
      await this.breakApartConsolidatedTransaction(
        editor,
        lineNumber,
        transactionLine,
        transactionParsed,
      );
    } else {
      await this.toggleIndividualPosting(editor, lineNumber, postingParsed);
    }

    await this.applyMarkerNormalization(editor, transactionLine);
  }

  private static async breakApartConsolidatedTransaction(
    editor: vscode.TextEditor,
    toggledLineNumber: number,
    transactionLineNumber: number,
    transactionParsed: TransactionLineParts,
  ): Promise<void> {
    const document = editor.document;
    const transactionMarker = transactionParsed.status;
    const updatedTransactionText = this.buildTransactionLineWithMarker(
      transactionParsed,
      "",
    );

    const endLine = this.findTransactionEnd(document, transactionLineNumber);
    const edits: { range: vscode.Range; text: string }[] = [];

    // Remove marker from transaction line
    edits.push({
      range: document.lineAt(transactionLineNumber).range,
      text: updatedTransactionText,
    });

    // Add marker to all postings EXCEPT the one being toggled
    for (let i = transactionLineNumber + 1; i <= endLine; i++) {
      const line = document.lineAt(i);
      const parsed = this.parsePostingLine(line.text);
      if (parsed) {
        const newMarker = i === toggledLineNumber ? "" : transactionMarker;
        const updatedPostingText = this.buildPostingLineWithMarker(
          parsed,
          newMarker,
        );
        edits.push({ range: line.range, text: updatedPostingText });
      }
    }

    await editor.edit((editBuilder) => {
      for (const edit of edits) {
        editBuilder.replace(edit.range, edit.text);
      }
    });
  }

  private static async toggleIndividualPosting(
    editor: vscode.TextEditor,
    lineNumber: number,
    parsed: PostingLineParts,
  ): Promise<void> {
    const document = editor.document;
    const line = document.lineAt(lineNumber);

    const newMarker = parsed.status === "*" || parsed.status === "!" ? "" : "*";
    const updatedText = this.buildPostingLineWithMarker(parsed, newMarker);

    await editor.edit((editBuilder) => {
      editBuilder.replace(line.range, updatedText);
    });
  }

  private static findTransactionStart(
    document: vscode.TextDocument,
    fromLine: number,
  ): number {
    // Work backwards to find the transaction line
    for (let i = fromLine; i >= 0; i--) {
      const lineText = document.lineAt(i).text;
      if (this.parseTransactionLine(lineText)) {
        return i;
      }
    }
    return -1;
  }

  private static findTransactionEnd(
    document: vscode.TextDocument,
    fromLine: number,
  ): number {
    // Work forwards to find the end of the transaction
    for (let i = fromLine + 1; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;
      // Empty line or new transaction marks the end
      // NOTE: This correctly follows ledger syntax where blank lines terminate transactions.
      // This is different from LedgerOrganizer which intentionally skips blank lines.
      if (lineText.trim() === "" || this.parseTransactionLine(lineText)) {
        return i - 1;
      }
    }
    return document.lineCount - 1;
  }

  static normalizeTransactionMarkersInText(transactionText: string): string {
    const lines = transactionText.split("\n");
    /* c8 ignore start */
    if (lines.length === 0) {
      return transactionText;
    }
    /* c8 ignore stop */

    const transactionLine = lines[0];
    const postingLines = lines.slice(1);

    // Check what markers exist on postings
    const postingMarkers = new Set<string>();
    let hasPostings = false;

    for (const lineText of postingLines) {
      const parsed = this.parsePostingLine(lineText);
      if (parsed) {
        hasPostings = true;
        if (parsed.status) {
          postingMarkers.add(parsed.status);
        } else {
          postingMarkers.add(""); // unreconciled
        }
      }
    }

    let normalizedTransactionLine = transactionLine;
    let normalizedPostingLines = postingLines;

    // If all postings have the same marker (and there are postings), move it to transaction
    if (hasPostings && postingMarkers.size === 1) {
      const commonMarker = Array.from(postingMarkers)[0];
      if (commonMarker) {
        // Add marker to transaction line
        const transParsed = this.parseTransactionLine(transactionLine);
        if (transParsed && !transParsed.status) {
          normalizedTransactionLine = `${transParsed.date} ${commonMarker}${transParsed.rest}`;
        }
      }
    }

    // If transaction has a marker, remove all markers from postings
    const transParsed = this.parseTransactionLine(normalizedTransactionLine);
    if (transParsed?.status) {
      normalizedPostingLines = postingLines.map((lineText) => {
        const parsed = this.parsePostingLine(lineText);
        if (parsed && parsed.status) {
          return `${parsed.indent}${parsed.rest}`;
        }
        return lineText;
      });
    }

    return [normalizedTransactionLine, ...normalizedPostingLines].join("\n");
  }

  private static async applyMarkerNormalization(
    editor: vscode.TextEditor,
    transactionLine: number,
  ): Promise<void> {
    const document = editor.document;
    const endLine = this.findTransactionEnd(document, transactionLine);

    // Get transaction text
    const transactionLines = [];
    for (let i = transactionLine; i <= endLine; i++) {
      transactionLines.push(document.lineAt(i).text);
    }
    const originalText = transactionLines.join("\n");

    // Normalize the text
    const normalizedText = this.normalizeTransactionMarkersInText(originalText);

    // Apply changes if different
    if (originalText !== normalizedText) {
      const normalizedLines = normalizedText.split("\n");
      await editor.edit((editBuilder) => {
        for (let i = 0; i < normalizedLines.length; i++) {
          const lineIndex = transactionLine + i;
          const line = document.lineAt(lineIndex);
          if (line.text !== normalizedLines[i]) {
            editBuilder.replace(line.range, normalizedLines[i]);
          }
        }
      });
    }
  }
}
