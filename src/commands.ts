// Registers all commands for the extension
// Including balance report viewing and transaction completion

import * as vscode from "vscode";
import { BalanceReportViewProvider } from "./balanceReportView";
import { TransactionCompleter } from "./transactionCompletion";
import { LedgerOrganizer } from "./ledgerOrganizer";
import { NowMarkerProvider } from "./nowMarker";
import { ReconciliationToggler } from "./reconciliationToggler";
const chrono = require("chrono-node");
import { RecurringTransactionProcessor } from "./recurringTransactions";
import { ReconcileViewProvider } from "./reconcileView";

export function formatDateForLedger(date?: Date): string {
  const today = date || new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} `;
}

export function parseDateString(
  input: string,
  referenceDate?: Date,
): Date | null {
  if (!input || input.trim() === "") {
    return null;
  }

  const trimmed = input.trim();

  // Check if input is a single integer (day of month)
  if (/^\d{1,2}$/.test(trimmed)) {
    const dayOfMonth = parseInt(trimmed, 10);

    // Validate day is in valid range
    if (dayOfMonth >= 1 && dayOfMonth <= 31) {
      const today = referenceDate || new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Find the most recent occurrence of this day
      let candidateYear = currentYear;
      let candidateMonth = currentMonth;

      // First try current month
      let candidateDate = new Date(candidateYear, candidateMonth, dayOfMonth);

      // If the day is in the future this month, or if the day doesn't exist (overflow), go back
      // Use date-only comparison to avoid time-of-day issues
      const todayDate = today.getDate();
      if (dayOfMonth > todayDate || candidateDate.getDate() !== dayOfMonth) {
        candidateMonth--;
        candidateDate = new Date(candidateYear, candidateMonth, dayOfMonth);
      }

      // Keep going back until we find a valid month with this day
      let attempts = 0;
      while (candidateDate.getDate() !== dayOfMonth && attempts < 12) {
        candidateMonth--;
        if (candidateMonth < 0) {
          candidateMonth = 11;
          candidateYear--;
        }
        candidateDate = new Date(candidateYear, candidateMonth, dayOfMonth);
        attempts++;
      }

      // If we couldn't find the day after 12 attempts, return null (invalid day)
      if (candidateDate.getDate() !== dayOfMonth) {
        return null;
      }

      return candidateDate;
    }
  }

  // Use chrono-node for natural language date parsing
  const results = chrono.parseDate(trimmed, referenceDate);

  if (results) {
    return results;
  }

  return null;
}

function startOfDay(date: Date): Date {
  const [day, time] = date.toISOString().split("T");
  const zeroTime = time.replace(/\d/g, "0");
  return new Date(`${day}T${zeroTime}`);
}

export function findDatePosition(content: string, targetDate: Date): number {
  const lines = content.split("\n");
  const target = startOfDay(targetDate);

  // Find the position where target date would go
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(/^(\d{4}[/-]\d{2}[/-]\d{2})/);

    if (dateMatch) {
      const dateStr = dateMatch[1].replace("/", "-");
      const lineDate = startOfDay(new Date(dateStr));

      // If we find a date that's after target, insert before this line
      if (lineDate > target) {
        // Prefer the blank line before the transaction
        if (i > 0 && lines[i - 1].trim() === "") {
          return i - 1;
        }
        return i;
      }
    }
  }

  // If all dates are in the past, insert at the end
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  nowMarkerProvider?: NowMarkerProvider,
) {
  const balanceReportProvider = new BalanceReportViewProvider(context);

  // Register balance report command
  const balanceCommand = vscode.commands.registerCommand(
    "ledger.showBalanceReport",
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      /* c8 ignore next 4 */
      if (!activeEditor || activeEditor.document.languageId !== "ledger") {
        vscode.window.showErrorMessage("No active Ledger file");
        return;
      }

      try {
        await balanceReportProvider.show(activeEditor.document.fileName);
      } catch (error) {
        /* c8 ignore next 4 */
        vscode.window.showErrorMessage(
          `Failed to generate balance report: ${error}`,
        );
      }
    },
  );

  // Register transaction completion command
  const transactionCompletionCommand = vscode.commands.registerCommand(
    "ledger.completeTransaction",
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      /* c8 ignore next 4 */
      if (!activeEditor || activeEditor.document.languageId !== "ledger") {
        vscode.window.showErrorMessage("No active Ledger file");
        return;
      }

      try {
        const success = await TransactionCompleter.completeTransaction(
          activeEditor.document,
          activeEditor.selection.active,
        );

        /* c8 ignore next 3 */
        if (success) {
          vscode.window.showInformationMessage("Transaction completed");
        }
      } catch (error) {
        /* c8 ignore next 4 */
        vscode.window.showErrorMessage(
          `Failed to complete transaction: ${error}`,
        );
      }
    },
  );

  // Register date insertion command with prompt and smart positioning
  const insertDateCommand = vscode.commands.registerCommand(
    "ledger.insertDate",
    /* c8 ignore start */
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.languageId !== "ledger") {
        vscode.window.showErrorMessage("No active Ledger file");
        return;
      }

      try {
        // Prompt user for date input
        const dateInput = await vscode.window.showInputBox({
          prompt:
            "Enter date (natural language supported: 'last wednesday', '3 days ago', '2024-01-15', or just '15' for most recent 15th) or press Enter for today",
          placeHolder: "today",
          validateInput: (value: string) => {
            // If empty, show today preview as info
            if (!value || value.trim() === "") {
              const today = new Date();
              const dayName = today.toLocaleDateString("en-US", {
                weekday: "long",
              });
              return {
                severity: vscode.InputBoxValidationSeverity.Info,
                message: `Will insert: ${formatDateForLedger(today).trim()} (${dayName})`,
              };
            }

            const parsed = parseDateString(value);
            if (!parsed) {
              return {
                severity: vscode.InputBoxValidationSeverity.Error,
                message:
                  "Invalid date format. Try natural language like 'last monday', 'yesterday', or specific dates like '2024-01-15'",
              };
            }

            // Show preview for valid dates as info
            const dayName = parsed.toLocaleDateString("en-US", {
              weekday: "long",
            });
            return {
              severity: vscode.InputBoxValidationSeverity.Info,
              message: `Will insert: ${formatDateForLedger(parsed).trim()} (${dayName})`,
            };
          },
        });

        if (dateInput === undefined) {
          // User cancelled
          return;
        }

        // If empty input, default to today
        let targetDate: Date;
        if (!dateInput || dateInput.trim() === "") {
          targetDate = new Date();
        } else {
          const parsed = parseDateString(dateInput);
          if (!parsed) {
            /* c8 ignore next 2 */
            vscode.window.showErrorMessage("Invalid date format");
            return;
          }
          targetDate = parsed;
        }

        const content = activeEditor.document.getText();
        const lines = content.split("\n");
        const targetLineNumber = findDatePosition(content, targetDate);
        const dateString = formatDateForLedger(targetDate);

        // Determine what to insert based on surrounding content
        let insertText = dateString;
        let blankLinesBefore = 0;

        // Add blank line before if the previous line isn't already blank
        if (
          targetLineNumber > 0 &&
          (targetLineNumber >= lines.length ||
            lines[targetLineNumber - 1].trim() !== "")
        ) {
          insertText = "\n" + insertText;
          blankLinesBefore = 1;
        }

        // Add blank line after only if there's content following and it's not already blank
        if (
          targetLineNumber < lines.length &&
          lines[targetLineNumber] &&
          lines[targetLineNumber].trim() !== ""
        ) {
          // Next line has content - add blank line after (two newlines: end line + blank line)
          insertText = insertText + "\n\n";
        } else {
          // At end of file or next line is already blank - just end the current line
          insertText = insertText + "\n";
        }

        // Move cursor to the target position and insert the date with proper spacing
        const targetPosition = new vscode.Position(targetLineNumber, 0);

        await activeEditor.edit((editBuilder) => {
          editBuilder.insert(targetPosition, insertText);
        });

        // Move cursor to after the space after the date
        // When inserting at end of file, the actual line number will be different
        const actualLineNumber =
          targetLineNumber >= lines.length
            ? lines.length + blankLinesBefore
            : targetLineNumber + blankLinesBefore;
        const newPosition = new vscode.Position(
          actualLineNumber,
          dateString.length, // This positions after the trailing space
        );
        activeEditor.selection = new vscode.Selection(newPosition, newPosition);

        // Reveal the position in the editor
        activeEditor.revealRange(
          new vscode.Range(newPosition, newPosition),
          vscode.TextEditorRevealType.InCenter,
        );

        // Trigger completion for payee names
        await vscode.commands.executeCommand("editor.action.triggerSuggest");
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to insert date: ${error}`);
      }
    },
    /* c8 ignore stop */
  );

  // Register sort file command
  const sortFileCommand = vscode.commands.registerCommand(
    "ledger.sortFile",
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      /* c8 ignore next 4 */
      if (!activeEditor || activeEditor.document.languageId !== "ledger") {
        vscode.window.showErrorMessage("No active Ledger file");
        return;
      }

      try {
        const originalContent = activeEditor.document.getText();
        const sortedContent =
          LedgerOrganizer.sortLedgerContent(originalContent);

        if (sortedContent !== originalContent) {
          const fullRange = new vscode.Range(
            activeEditor.document.positionAt(0),
            activeEditor.document.positionAt(originalContent.length),
          );

          await activeEditor.edit((editBuilder) => {
            editBuilder.replace(fullRange, sortedContent);
          });

          vscode.window.showInformationMessage(
            "Ledger file sorted and formatted",
          );
          /* c8 ignore next 3 */
        } else {
          vscode.window.showInformationMessage("Ledger file is already sorted");
        }
        /* c8 ignore next 4 */
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to sort ledger file: ${error}`);
      }
    },
  );

  // Register jump to now command
  const jumpToNowCommand = vscode.commands.registerCommand(
    "ledger.jumpToNow",
    async () => {
      if (nowMarkerProvider) {
        nowMarkerProvider.jumpToNow();
      } else {
        /* c8 ignore next 3 */
        vscode.window.showErrorMessage("Now marker provider not available");
      }
    },
  );

  // Register toggle reconciliation command
  const toggleReconciliationCommand = vscode.commands.registerCommand(
    "ledger.toggleReconciliation",
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      /* c8 ignore next 4 */
      if (!activeEditor || activeEditor.document.languageId !== "ledger") {
        vscode.window.showErrorMessage("No active Ledger file");
        return;
      }

      try {
        await ReconciliationToggler.toggleAtCursor(activeEditor);
      } catch (error) {
        /* c8 ignore next 4 */
        vscode.window.showErrorMessage(
          `Failed to toggle reconciliation: ${error}`,
        );
      }
    },
  );

  // Register reconcile view command
  const reconcileViewProvider = new ReconcileViewProvider(context);

  // Warm the account cache for any already-open ledger files
  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === "ledger") {
      reconcileViewProvider.warmCache(document.fileName);
    }
  }

  const reconcileViewCommand = vscode.commands.registerCommand(
    "ledger.reconcile",
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      /* c8 ignore next 4 */
      if (!activeEditor || activeEditor.document.languageId !== "ledger") {
        vscode.window.showErrorMessage("No active Ledger file");
        return;
      }

      try {
        await reconcileViewProvider.show(activeEditor.document.fileName);
      } catch (error) {
        /* c8 ignore next 4 */
        vscode.window.showErrorMessage(
          `Failed to open reconcile view: ${error}`,
        );
      }
    },
  );

  // Register recurring transactions command
  const recurringTransactionsCommand = vscode.commands.registerCommand(
    "ledger.generateRecurringTransactions",
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.languageId !== "ledger") {
        vscode.window.showErrorMessage("No active Ledger file");
        return;
      }

      try {
        // Prompt user for target date (similar to insertDate)
        const dateInput = await vscode.window.showInputBox({
          prompt:
            "Generate recurring transactions up to date (natural language supported: 'next month', '2024-12-31') or press Enter for two months from today",
          placeHolder: "two months from today",
          validateInput: (value: string) => {
            // If empty, show two months from today preview as info
            if (!value || value.trim() === "") {
              const twoMonthsFromToday = new Date();
              twoMonthsFromToday.setMonth(twoMonthsFromToday.getMonth() + 2);
              const dayName = twoMonthsFromToday.toLocaleDateString("en-US", {
                weekday: "long",
              });
              return {
                severity: vscode.InputBoxValidationSeverity.Info,
                message: `Will generate up to: ${formatDateForLedger(twoMonthsFromToday).trim()} (${dayName})`,
              };
            }

            const parsed = parseDateString(value);
            if (!parsed) {
              return {
                severity: vscode.InputBoxValidationSeverity.Error,
                message:
                  "Invalid date format. Try natural language like 'next month', 'end of year', or specific dates like '2024-12-31'",
              };
            }

            // Show preview for valid dates as info
            const dayName = parsed.toLocaleDateString("en-US", {
              weekday: "long",
            });
            return {
              severity: vscode.InputBoxValidationSeverity.Info,
              message: `Will generate up to: ${formatDateForLedger(parsed).trim()} (${dayName})`,
            };
          },
        });

        if (dateInput === undefined) {
          // User cancelled
          return;
        }

        // If empty input, default to two months from today
        let targetDate: Date;
        if (!dateInput || dateInput.trim() === "") {
          targetDate = new Date();
          targetDate.setMonth(targetDate.getMonth() + 2);
        } else {
          const parsed = parseDateString(dateInput);
          if (!parsed) {
            vscode.window.showErrorMessage("Invalid date format");
            return;
          }
          targetDate = parsed;
        }

        const content = activeEditor.document.getText();
        const processor = new RecurringTransactionProcessor();
        const result = await processor.processRecurringTransactions(
          content,
          targetDate,
        );

        if (result !== content) {
          const fullRange = new vscode.Range(
            activeEditor.document.positionAt(0),
            activeEditor.document.positionAt(content.length),
          );

          await activeEditor.edit((editBuilder) => {
            editBuilder.replace(fullRange, result);
          });

          vscode.window.showInformationMessage(
            "Recurring transactions generated successfully",
          );
        } else {
          vscode.window.showInformationMessage(
            "No recurring transactions found or all are already up to date",
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate recurring transactions: ${error}`,
        );
      }
    },
  );

  context.subscriptions.push(
    balanceCommand,
    transactionCompletionCommand,
    insertDateCommand,
    sortFileCommand,
    jumpToNowCommand,
    toggleReconciliationCommand,
    reconcileViewCommand,
    recurringTransactionsCommand,
  );
}
