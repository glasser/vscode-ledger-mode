// Provides autocompletion for merchant names and account names
// Uses error-tolerant parsing that works even when files have syntax errors

import * as vscode from "vscode";
import { completionCache } from "./completionCache";

export function registerCompletionProviders(context: vscode.ExtensionContext) {
  // Register merchant/payee completion provider with more trigger characters
  const payeeProvider = vscode.languages.registerCompletionItemProvider(
    "ledger",
    new PayeeCompletionProvider(),
    " ", // Trigger on space after date
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
  );

  // Register account completion provider with specific trigger characters
  const accountProvider = vscode.languages.registerCompletionItemProvider(
    "ledger",
    new AccountCompletionProvider(),
    ":", // Trigger on colon for account hierarchies
    " ", // Also trigger on space for account names
    "A",
    "E",
    "I",
    "L",
    "C", // Common account prefixes (Assets, Expenses, Income, Liabilities, CC)
  );

  context.subscriptions.push(payeeProvider, accountProvider);
}

class PayeeCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    const line = document.lineAt(position);
    const lineText = line.text;

    // Check if we're on a transaction line (starts with date)
    const dateMatch = lineText.match(
      /^(\d{4}[/-]\d{2}[/-]\d{2})(?:=\d{4}[/-]\d{2}[/-]\d{2})?\s*(\*|!)?\s*(?:\([^)]*\))?\s*/,
    );
    if (!dateMatch) {
      return [];
    }

    // Check if cursor is after the date/status/code part
    const prefixLength = dateMatch[0].length;
    if (position.character < prefixLength) {
      return [];
    }

    // Extract payees from the document using cached parsing
    const payees = completionCache.getPayees(document);

    const currentText = lineText
      .substring(prefixLength, position.character)
      .trim();

    // Convert to completion items and sort by frequency
    const items = Array.from(payees.entries())
      .filter(
        ([payee]) =>
          payee !== currentText && // Don't include exact match
          payee.toLowerCase().includes(currentText.toLowerCase()),
      )
      .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
      .map(([payee]) => {
        const item = new vscode.CompletionItem(
          payee,
          vscode.CompletionItemKind.Value,
        );
        item.detail = "Payee";
        item.insertText = payee;

        // If there's already some text after the date/status part, replace it
        if (currentText.length > 0) {
          const range = new vscode.Range(
            position.line,
            prefixLength, // Start from after date/status/code
            position.line,
            position.character,
          );
          item.range = range;
        }

        return item;
      });

    return items;
  }
}

class AccountCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    const line = document.lineAt(position);
    const lineText = line.text;

    // Check if we're on a posting line (indented)
    if (!lineText.match(/^\s+/)) {
      return [];
    }

    // Get the account text so far
    const beforeCursor = lineText.substring(0, position.character);
    // Extract potential account text - everything after initial whitespace
    const accountMatch = beforeCursor.match(/^\s+(.*)$/);
    if (!accountMatch) {
      return [];
    }

    const currentAccount = accountMatch[1];

    // Don't provide completions if we've hit multiple spaces (amount area) or semicolon (comment)
    if (/\s{2,}|\;/.test(currentAccount)) {
      return [];
    }

    // Extract accounts from the document using cached parsing
    const accounts = completionCache.getAccounts(document);

    // Convert to array with frequency info
    const accountsArray = Array.from(accounts.entries()).map(
      ([account, frequency]) => ({
        account,
        frequency,
      }),
    );

    // Filter and sort
    const items = accountsArray
      .filter(
        ({ account }) =>
          account !== currentAccount && // Don't include exact match
          (account.toLowerCase().startsWith(currentAccount.toLowerCase()) ||
            account.toLowerCase().includes(currentAccount.toLowerCase())),
      )
      .sort((a, b) => {
        // First sort by whether it starts with the current text (vs just contains)
        const aStarts = a.account
          .toLowerCase()
          .startsWith(currentAccount.toLowerCase());
        const bStarts = b.account
          .toLowerCase()
          .startsWith(currentAccount.toLowerCase());
        /* c8 ignore next 3 */
        if (aStarts !== bStarts) {
          return aStarts ? -1 : 1;
        }
        // Then by frequency
        if (a.frequency !== b.frequency) {
          return b.frequency - a.frequency;
        }
        // Finally alphabetically
        return a.account.localeCompare(b.account);
      })
      .map(({ account }) => {
        const item = new vscode.CompletionItem(
          account,
          vscode.CompletionItemKind.Module,
        );
        item.detail = "Account";
        item.insertText = account + "  ";

        // If there's already some text, replace it
        if (currentAccount.length > 0) {
          const range = new vscode.Range(
            position.line,
            position.character - currentAccount.length,
            position.line,
            position.character,
          );
          item.range = range;
        }

        return item;
      });

    return items;
  }
}
