// Recurring transaction processor for ledger files
// Handles transactions with ; RECUR:period comments

interface RecurringTransaction {
  originalLines: string[];
  dateStr: string;
  date: Date;
  period: string;
  lineIndex: number;
}

interface ParsedPeriod {
  value: number;
  unit: string;
}

export class RecurringTransactionProcessor {
  private readonly RECUR_PATTERN = /;\s*RECUR:(\d+[ymwd])/;
  private readonly DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})/;

  async processRecurringTransactions(
    content: string,
    targetDate: Date,
  ): Promise<string> {
    const lines = content.split("\n");
    const transactions = this.parseTransactions(lines);
    const recurringTransactions = this.findRecurringTransactions(transactions);

    if (recurringTransactions.length === 0) {
      return content;
    }

    // Generate new transactions first
    const generatedTransactions = this.generateTransactions(
      recurringTransactions,
      targetDate,
    );

    // Only proceed with modifications if transactions were actually generated
    if (generatedTransactions.length === 0) {
      return content;
    }

    // Remove RECUR comments from original transactions that had generations
    const transactionsWithGenerations = new Set(
      generatedTransactions.map((g) => g.transaction.lineIndex),
    );
    const updatedLines = this.removeRecurComments(
      lines,
      recurringTransactions.filter((t) =>
        transactionsWithGenerations.has(t.lineIndex),
      ),
    );

    // Append generated transactions
    return this.appendTransactions(updatedLines, generatedTransactions);
  }

  private parseTransactions(lines: string[]): Array<{
    lines: string[];
    startIndex: number;
  }> {
    const transactions: Array<{ lines: string[]; startIndex: number }> = [];
    let currentTransaction: string[] = [];
    let startIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (this.DATE_PATTERN.test(line)) {
        // Start of a new transaction
        if (currentTransaction.length > 0) {
          transactions.push({ lines: currentTransaction, startIndex });
        }
        currentTransaction = [line];
        startIndex = i;
      } else if (currentTransaction.length > 0) {
        // Part of current transaction or blank line after it
        if (line.trim() === "" && i < lines.length - 1) {
          // Blank line not at EOF - ends transaction
          transactions.push({ lines: currentTransaction, startIndex });
          currentTransaction = [];
          startIndex = -1;
        } else {
          currentTransaction.push(line);
        }
      }
    }

    // Don't forget the last transaction
    if (currentTransaction.length > 0) {
      transactions.push({ lines: currentTransaction, startIndex });
    }

    return transactions;
  }

  private findRecurringTransactions(
    transactions: Array<{ lines: string[]; startIndex: number }>,
  ): RecurringTransaction[] {
    const recurring: RecurringTransaction[] = [];

    for (const transaction of transactions) {
      const firstLine = transaction.lines[0];
      const recurMatch = firstLine.match(this.RECUR_PATTERN);

      if (recurMatch) {
        const dateMatch = firstLine.match(this.DATE_PATTERN);
        if (dateMatch) {
          recurring.push({
            originalLines: transaction.lines,
            dateStr: dateMatch[1],
            date: this.parseDate(dateMatch[1]),
            period: recurMatch[1],
            lineIndex: transaction.startIndex,
          });
        }
      }
    }

    return recurring;
  }

  private removeRecurComments(
    lines: string[],
    recurringTransactions: RecurringTransaction[],
  ): string[] {
    const updatedLines = [...lines];

    for (const transaction of recurringTransactions) {
      const lineIndex = transaction.lineIndex;
      // Replace the RECUR comment and its leading/trailing spaces
      updatedLines[lineIndex] = updatedLines[lineIndex].replace(
        /\s*;\s*RECUR:\d+[ymwd]\s*/g,
        "",
      );
    }

    return updatedLines;
  }

  private generateTransactions(
    recurringTransactions: RecurringTransaction[],
    targetDate: Date,
  ): Array<{ transaction: RecurringTransaction; lines: string[] }> {
    const allGenerated: Array<{
      transaction: RecurringTransaction;
      lines: string[];
    }> = [];

    for (const transaction of recurringTransactions) {
      const period = this.parsePeriod(transaction.period);
      let currentDate = new Date(transaction.date);
      const generatedForThisTransaction: string[][] = [];

      // Generate transactions up to target date
      while (true) {
        currentDate = this.addPeriod(currentDate, period);

        if (currentDate > targetDate) {
          break;
        }

        // Create new transaction with updated date and remove reconciliation markers
        const newLines = [...transaction.originalLines];
        const dateStr = this.formatDate(currentDate);

        // Process first line: update date, remove RECUR comment and reconciliation marker
        newLines[0] = newLines[0].replace(/\s*;\s*RECUR:\d+[ymwd]\s*/g, "");
        newLines[0] = newLines[0].replace(this.DATE_PATTERN, dateStr);
        // Remove transaction-level reconciliation markers (* or !)
        newLines[0] = newLines[0].replace(
          /^(\d{4}-\d{2}-\d{2})\s+[*!]\s+/,
          "$1 ",
        );

        // Remove posting-level reconciliation markers from all other lines
        for (let i = 1; i < newLines.length; i++) {
          // Remove leading * or ! from posting lines (with optional spaces)
          newLines[i] = newLines[i].replace(/^(\s*)[*!]\s+/, "$1");
        }

        generatedForThisTransaction.push(newLines);
      }

      // Add RECUR comment to last generated transaction
      if (generatedForThisTransaction.length > 0) {
        const lastTransaction =
          generatedForThisTransaction[generatedForThisTransaction.length - 1];
        lastTransaction[0] =
          lastTransaction[0] + `  ; RECUR:${transaction.period}`;

        // Add all generated transactions
        for (const lines of generatedForThisTransaction) {
          allGenerated.push({ transaction, lines });
        }
      }
    }

    return allGenerated;
  }

  private parsePeriod(period: string): ParsedPeriod {
    const match = period.match(/^(\d+)([ymwd])$/);
    if (!match) {
      throw new Error(`Invalid period format: ${period}`);
    }

    return {
      value: parseInt(match[1], 10),
      unit: match[2],
    };
  }

  private addPeriod(date: Date, period: ParsedPeriod): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    switch (period.unit) {
      case "d":
        return new Date(year, month, day + period.value);
      case "w":
        return new Date(year, month, day + period.value * 7);
      case "m": {
        // JavaScript Date constructor handles month overflow automatically
        const result = new Date(year, month + period.value, day);

        // If the day rolled over (e.g., Jan 31 + 1 month = Mar 3),
        // go to last day of target month
        if (result.getDate() !== day) {
          return new Date(year, month + period.value + 1, 0); // Last day of target month
        }

        return result;
      }
      case "y": {
        // Special case: Feb 29 in leap year -> Feb 28 in non-leap year
        if (month === 1 && day === 29) {
          const newYear = year + period.value;
          const isLeapYear =
            (newYear % 4 === 0 && newYear % 100 !== 0) || newYear % 400 === 0;
          if (!isLeapYear) {
            return new Date(newYear, 1, 28); // Feb 28
          }
        }

        return new Date(year + period.value, month, day);
      }
      default:
        throw new Error(`Unknown period unit: ${period.unit}`);
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private parseDate(dateStr: string): Date {
    // Parse YYYY-MM-DD as local date, not UTC
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  private appendTransactions(
    lines: string[],
    generatedTransactions: Array<{
      transaction: RecurringTransaction;
      lines: string[];
    }>,
  ): string {
    // Sort generated transactions by original order, then by date
    generatedTransactions.sort((a, b) => {
      const indexDiff = a.transaction.lineIndex - b.transaction.lineIndex;
      if (indexDiff !== 0) {
        return indexDiff;
      }
      // If same original transaction, sort by date
      const aDate = new Date(a.lines[0].match(this.DATE_PATTERN)![1]);
      const bDate = new Date(b.lines[0].match(this.DATE_PATTERN)![1]);
      return aDate.getTime() - bDate.getTime();
    });

    // Build result
    let result = lines.join("\n");

    // Append each generated transaction
    for (const { lines: transactionLines } of generatedTransactions) {
      result += "\n\n" + transactionLines.join("\n");
    }

    return result;
  }
}
