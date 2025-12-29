// File editing operations for updating reconciliation status markers
// Handles smart status updates with transaction-level normalization

import * as fs from "fs";

type Status = "" | "!" | "*";

export class ReconcileFileEditor {
  constructor(private ledgerFile: string) {}

  /**
   * Update status markers for a set of postings, with safety check.
   * Ensures all specified postings currently have the expected status before making changes.
   * Intelligently uses transaction headers vs individual postings.
   *
   * @param postingLineNumbers - 1-based line numbers of postings to update
   * @param expectedCurrentStatus - Status all postings must currently have
   * @param newStatus - New status to set
   * @returns true if update was successful, false if precondition failed or error occurred
   */
  updatePostingsStatus(
    postingLineNumbers: number[],
    expectedCurrentStatus: Status,
    newStatus: Status,
  ): boolean {
    if (postingLineNumbers.length === 0) {
      return true;
    }

    try {
      const content = fs.readFileSync(this.ledgerFile, "utf-8");
      const lines = content.split("\n");

      // Validate all postings and check preconditions
      if (
        !this.validatePostings(lines, postingLineNumbers, expectedCurrentStatus)
      ) {
        return false;
      }

      // Group postings by transaction and apply updates
      const transactions = this.groupPostingsByTransaction(
        lines,
        postingLineNumbers,
      );
      if (transactions === null) {
        return false;
      }

      // Process each transaction
      this.applyStatusUpdates(lines, transactions, newStatus);

      // Write the file
      fs.writeFileSync(this.ledgerFile, lines.join("\n"), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  private validatePostings(
    lines: string[],
    postingLineNumbers: number[],
    expectedStatus: Status,
  ): boolean {
    for (const lineNum of postingLineNumbers) {
      if (lineNum < 1 || lineNum > lines.length) {
        return false;
      }
      if (!this.isValidPostingLine(lines[lineNum - 1])) {
        return false;
      }
      const transLineNum = this.findTransactionForPosting(lines, lineNum);
      if (transLineNum === null) {
        return false;
      }
      const currentStatus = this.getEffectivePostingStatus(
        lines,
        lineNum,
        transLineNum,
      );
      if (currentStatus !== expectedStatus) {
        return false;
      }
    }
    return true;
  }

  private groupPostingsByTransaction(
    lines: string[],
    postingLineNumbers: number[],
  ): Map<number, number[]> | null {
    const transactions = new Map<number, number[]>();
    for (const postingLineNum of postingLineNumbers) {
      const transLineNum = this.findTransactionForPosting(
        lines,
        postingLineNum,
      );
      if (transLineNum === null) {
        return null;
      }
      if (!transactions.has(transLineNum)) {
        transactions.set(transLineNum, []);
      }
      transactions.get(transLineNum)!.push(postingLineNum);
    }
    return transactions;
  }

  private applyStatusUpdates(
    lines: string[],
    transactions: Map<number, number[]>,
    newStatus: Status,
  ): void {
    for (const [transLineNum, postingLinesInTrans] of transactions) {
      const allPostingLines = this.findAllPostingsForTransaction(
        lines,
        transLineNum,
      );

      // Determine final status for each posting
      const finalStatuses = new Map<number, Status>();
      for (const postingLine of allPostingLines) {
        if (postingLinesInTrans.includes(postingLine)) {
          finalStatuses.set(postingLine, newStatus);
        } else {
          finalStatuses.set(
            postingLine,
            this.getEffectivePostingStatus(lines, postingLine, transLineNum),
          );
        }
      }

      // Choose representation based on whether all postings have same status
      const uniqueStatuses = new Set(finalStatuses.values());
      const useTransactionHeader =
        uniqueStatuses.size === 1 && allPostingLines.length > 0;

      const transIdx = transLineNum - 1;
      if (useTransactionHeader) {
        // Use transaction header representation
        lines[transIdx] = this.updateTransactionLine(
          lines[transIdx],
          newStatus,
        );
        // Clear status from all posting lines
        for (const postingLine of allPostingLines) {
          lines[postingLine - 1] = this.updatePostingLine(
            lines[postingLine - 1],
            "",
          );
        }
      } else {
        // Use individual posting representation
        lines[transIdx] = this.updateTransactionLine(lines[transIdx], "");
        // Set appropriate status on each posting
        for (const [postingLine, status] of finalStatuses) {
          lines[postingLine - 1] = this.updatePostingLine(
            lines[postingLine - 1],
            status,
          );
        }
      }
    }
  }

  private findTransactionForPosting(
    lines: string[],
    postingLineNum: number,
  ): number | null {
    // Search backwards for transaction header
    for (let i = postingLineNum - 2; i >= 0; i--) {
      const line = lines[i];
      if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(line.trim())) {
        return i + 1; // Convert to 1-based
      }
      if (!line.trim()) {
        // Empty line before finding transaction - something's wrong
        return null;
      }
    }
    return null;
  }

  private findAllPostingsForTransaction(
    lines: string[],
    transLineNum: number,
  ): number[] {
    const postingLines: number[] = [];
    let i = transLineNum; // Start after transaction header (1-based)

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        // Empty line - end of transaction
        break;
      }
      if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(line.trim())) {
        // Next transaction - end of current transaction
        break;
      }
      if (line.trimStart() && !line.startsWith(" ") && !line.startsWith("\t")) {
        // Non-indented line that's not a date - end of transaction
        break;
      }

      // Check if this is a valid posting line (indented, non-comment)
      if (line.trim() && this.isValidPostingLine(line)) {
        postingLines.push(i + 1); // Convert to 1-based
      }
      i++;
    }

    return postingLines;
  }

  private extractPostingStatus(line: string): Status {
    const stripped = line.trimStart();
    if (stripped.startsWith("!")) {
      return "!";
    }
    if (stripped.startsWith("*")) {
      return "*";
    }
    return "";
  }

  private getEffectivePostingStatus(
    lines: string[],
    postingLineNum: number,
    transLineNum: number,
  ): Status {
    // First check if posting has explicit status
    const postingStatus = this.extractPostingStatus(lines[postingLineNum - 1]);
    if (postingStatus) {
      return postingStatus;
    }

    // Otherwise, check transaction header status
    const transLine = lines[transLineNum - 1];
    const match = transLine.trim().match(/^\d{4}[-/]\d{2}[-/]\d{2}\s*([!*]?)/);
    if (match && match[1]) {
      return match[1] as Status;
    }

    return "";
  }

  private isValidPostingLine(line: string): boolean {
    const stripped = line.trim();
    if (!stripped) {
      return false; // Empty line
    }
    if (stripped.startsWith(";")) {
      return false; // Comment line
    }
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(stripped)) {
      return false; // Transaction header line
    }
    return line.startsWith(" ") || line.startsWith("\t"); // Must be indented
  }

  private updateTransactionLine(line: string, newStatus: Status): string {
    const lineWithoutNewline = line.replace(/\n$/, "");
    const match = lineWithoutNewline
      .trim()
      .match(/^(\d{4}[-/]\d{2}[-/]\d{2})\s*([!*]?)\s*(.*)$/);
    if (!match) {
      return line;
    }

    const date = match[1];
    const description = match[3];

    // Preserve original whitespace structure
    const leadingWs = lineWithoutNewline.slice(
      0,
      lineWithoutNewline.length - lineWithoutNewline.trimStart().length,
    );
    const hasNewline = line.endsWith("\n");

    // Build new line
    let newLine: string;
    if (newStatus) {
      newLine = `${leadingWs}${date} ${newStatus} ${description}`;
    } else {
      newLine = `${leadingWs}${date} ${description}`;
    }

    if (hasNewline) {
      newLine += "\n";
    }

    return newLine;
  }

  private updatePostingLine(line: string, newStatus: Status): string {
    if (!line.trim()) {
      return line;
    }

    const lineWithoutNewline = line.replace(/\n$/, "");
    const leadingWs = lineWithoutNewline.slice(
      0,
      lineWithoutNewline.length - lineWithoutNewline.trimStart().length,
    );
    let stripped = lineWithoutNewline.trimStart();
    const hasNewline = line.endsWith("\n");

    // Check if line has existing status
    const hasExistingStatus =
      stripped.startsWith("!") || stripped.startsWith("*");

    // Remove existing status if present
    if (hasExistingStatus) {
      stripped = stripped.slice(1).trimStart();
    }

    // If no new status and no existing status, return line unchanged
    if (!newStatus && !hasExistingStatus) {
      return line;
    }

    // Build new line
    let newLine: string;
    if (newStatus) {
      newLine = `${leadingWs}${newStatus} ${stripped}`;
    } else {
      newLine = `${leadingWs}${stripped}`;
    }

    if (hasNewline) {
      newLine += "\n";
    }

    return newLine;
  }
}
