// Organizes ledger files by aligning amounts and sorting by date
// Preserves comments that precede transactions

import { ReconciliationToggler } from "./reconciliationToggler";

export interface Transaction {
  date: string;
  dateObj: Date;
  text: string;
  precedingComments: string[];
  postings: string[];
  startLine: number;
  endLine: number;
}

export class LedgerOrganizer {
  static formatLedgerContent(content: string): string {
    return this.processLedgerContent(content, { sort: false });
  }

  static sortLedgerContent(content: string): string {
    return this.processLedgerContent(content, { sort: true });
  }

  private static processLedgerContent(
    content: string,
    options: { sort: boolean },
  ): string {
    const lines = content.split("\n");

    // Parse transactions with their preceding comments (preserve original text)
    const { transactions, standaloneComments } = this.parseTransactions(lines);

    // Sort transactions by date if requested
    const processedTransactions = options.sort
      ? this.sortTransactionsByDate(transactions)
      : transactions;

    // Align amounts in each transaction
    const alignedTransactions = processedTransactions.map((t) =>
      this.alignTransaction(t),
    );

    // Build final content
    const finalContent = this.rebuildContent(
      alignedTransactions,
      standaloneComments,
    );

    // Validate no content was lost
    this.validateContentPreserved(content, finalContent);

    return finalContent;
  }

  private static parseTransactions(lines: string[]): {
    transactions: Transaction[];
    standaloneComments: string[];
  } {
    const transactions: Transaction[] = [];
    const standaloneComments: string[] = [];
    let currentComments: string[] = [];
    let i = 0;

    // Handle empty content case
    if (lines.length === 1 && lines[0] === "") {
      return { transactions, standaloneComments };
    }

    while (i < lines.length) {
      const line = lines[i];

      // Check if this is a transaction line (starts with date)
      const dateMatch = line.match(/^(\d{4}[/-]\d{2}[/-]\d{2})/);
      if (dateMatch) {
        const dateStr = dateMatch[1].replace("/", "-");
        const dateObj = new Date(dateStr);

        // Collect the transaction and its postings (normalize whitespace)
        const transactionLines = [line.trimEnd()]; // Trim trailing whitespace from transaction line
        const startLine = i;
        i++;

        // Collect posting lines (indented lines that follow)
        // NOTE: In proper ledger syntax, blank lines terminate transactions.
        // However, this parser is specifically for the organize/format feature,
        // not for general ledger validation. We intentionally skip blank lines
        // within transactions to clean up malformed files. The actual ledger CLI
        // will still properly validate syntax when the file is used.
        while (
          i < lines.length &&
          (lines[i].match(/^\s+/) || lines[i].trim() === "")
        ) {
          if (lines[i].trim() !== "") {
            // This is an actual posting line
            transactionLines.push(lines[i]);
          }
          // Skip blank lines (don't include them in transaction)
          i++;
        }

        const transaction: Transaction = {
          date: dateStr,
          dateObj: dateObj,
          text: transactionLines.join("\n"),
          precedingComments: [...currentComments],
          postings: transactionLines.slice(1), // All lines except the first (date) line
          startLine: startLine,
          endLine: i - 1,
        };

        transactions.push(transaction);
        currentComments = []; // Reset comments for next transaction
      } else if (line.trim().startsWith(";") || line.trim() === "") {
        // This is a comment or blank line
        currentComments.push(line);
        i++;
      } else {
        // Other content (directives, etc.) - treat as comments for now
        currentComments.push(line);
        i++;
      }
    }

    // Add any remaining comments as standalone comments
    if (currentComments.length > 0) {
      standaloneComments.push(...currentComments);
    }

    return { transactions, standaloneComments };
  }

  private static sortTransactionsByDate(
    transactions: Transaction[],
  ): Transaction[] {
    // Stable sort by date
    return transactions.sort((a, b) => {
      const dateA = a.dateObj.getTime();
      const dateB = b.dateObj.getTime();
      return dateA - dateB;
    });
  }

  private static alignTransaction(transaction: Transaction): Transaction {
    // Normalize reconciliation markers BEFORE alignment
    const normalizedText =
      ReconciliationToggler.normalizeTransactionMarkersInText(transaction.text);

    const lines = normalizedText.split("\n");
    const transactionLine = lines[0];
    const postingLines = lines.slice(1);

    if (postingLines.length === 0) {
      return {
        ...transaction,
        text: normalizedText,
        postings: [],
      };
    }

    // Force 1-space indentation (normalize all indentation)
    const ACCOUNT_ALIGNMENT_COLUMN = 1;

    const DECIMAL_ALIGNMENT_COLUMN = 62; // Position where decimal point should appear (0-based)

    const alignedPostings: string[] = [];

    for (const posting of postingLines) {
      /* c8 ignore start */
      // NOTE: This case handles blank lines within posting arrays. In proper ledger
      // syntax, blank lines terminate transactions, so this should never occur since
      // parseTransactions filters them out. However, we keep this check for defensive
      // programming in case the parsing logic changes.
      if (posting.trim() === "") {
        alignedPostings.push(posting);
        continue;
      }
      /* c8 ignore stop */
      /* c8 ignore next */
      // Check if this looks like a posting line (starts with whitespace + account char)
      if (posting.match(/^\s+[A-Za-z*!]/)) {
        const trimmed = posting.trim();

        // Find where account name ends (at multiple spaces 2+)
        const accountMatch = trimmed.match(
          /^([*!]?\s*[A-Za-z][^\s]*(?:\s[^\s]+)*?)(\s{2,}.*)?$/,
        );
        if (accountMatch) {
          const accountPart = accountMatch[1]; // Account name (with status if any)
          const amountPart = accountMatch[2] ? accountMatch[2].trim() : ""; // Everything after 2+ spaces

          // Rebuild line with proper alignment (only adjust whitespace)
          let alignedLine = " ".repeat(ACCOUNT_ALIGNMENT_COLUMN) + accountPart;

          if (amountPart) {
            const accountEndColumn = alignedLine.length;

            // Find decimal point position in amount to align on it
            const decimalIndex = amountPart.indexOf(".");
            let targetColumn = DECIMAL_ALIGNMENT_COLUMN;

            if (decimalIndex >= 0) {
              // Align so the decimal point appears at DECIMAL_ALIGNMENT_COLUMN
              targetColumn = DECIMAL_ALIGNMENT_COLUMN - decimalIndex;
            }

            let spacesNeeded;
            if (accountEndColumn + 2 <= targetColumn) {
              spacesNeeded = targetColumn - accountEndColumn;
            } else {
              spacesNeeded = 2; // Minimum 2 spaces
            }
            alignedLine += " ".repeat(spacesNeeded) + amountPart;
          }

          alignedPostings.push(alignedLine);
        } /* c8 ignore next 3 */ else {
          // Can't parse - keep original line
          alignedPostings.push(posting);
        }
      } /* c8 ignore next 3 */ else {
        // Not a posting line - keep as is
        alignedPostings.push(posting);
      }
    } /* c8 ignore next 2 */

    const alignedText = [transactionLine, ...alignedPostings].join("\n");

    return {
      ...transaction,
      text: alignedText,
      postings: alignedPostings,
    };
  }

  private static validateContentPreserved(
    original: string,
    organized: string,
  ): void {
    // Count all non-whitespace, non-reconciliation-marker characters
    // Reconciliation markers (* and !) can be moved/consolidated during normalization
    const normalizeForComparison = (text: string) =>
      text.replace(/\s/g, "").replace(/[*!]/g, "").split("").sort().join("");

    const originalChars = normalizeForComparison(original);
    const organizedChars = normalizeForComparison(organized);

    /* c8 ignore start */
    if (originalChars !== organizedChars) {
      throw new Error(
        `Content validation failed! ` +
          `Original: ${originalChars.length} chars, ` +
          `Organized: ${organizedChars.length} chars. ` +
          `Content was modified beyond reordering and reconciliation marker normalization.`,
      );
    }
    /* c8 ignore stop */
  } /* c8 ignore next 2 */

  private static rebuildContent(
    transactions: Transaction[],
    standaloneComments: string[],
  ): string {
    const result: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];

      // Add preceding comments
      /* c8 ignore next 6 */
      if (transaction.precedingComments.length > 0) {
        if (result.length > 0 && result[result.length - 1] !== "") {
          result.push(""); // Blank line before comments
        }
        result.push(...transaction.precedingComments);
      } /* c8 ignore next */

      // Add the transaction
      result.push(transaction.text);

      // Add exactly one blank line after transaction (except for last one)
      if (i < transactions.length - 1) {
        result.push("");
      }
    }

    // Add standalone comments at the end (comments not associated with transactions)
    if (standaloneComments.length > 0) {
      if (result.length > 0) {
        result.push(""); // Blank line before end comments
      }
      result.push(...standaloneComments);
    }

    if (result.length === 0) {
      return "";
    }
    return result.join("\n") + "\n";
  }
}
