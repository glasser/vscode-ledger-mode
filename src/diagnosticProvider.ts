// Provides error diagnostics by running ledger CLI on the file
// Shows errors in VSCode's Problems panel

import * as vscode from "vscode";
import { LedgerCli } from "./ledgerCli";

export function registerDiagnosticProvider(context: vscode.ExtensionContext) {
  const ledgerCli = new LedgerCli();
  const collection = vscode.languages.createDiagnosticCollection("ledger");
  const diagnosticProvider = new LedgerDiagnosticProvider(
    ledgerCli,
    collection,
  );

  // Check diagnostics when document is opened, saved, or changed
  vscode.workspace.onDidOpenTextDocument(
    (doc) => {
      if (doc.languageId === "ledger") {
        diagnosticProvider.updateDiagnostics(doc);
      }
    },
    null,
    context.subscriptions,
  );

  vscode.workspace.onDidSaveTextDocument(
    (doc) => {
      /* c8 ignore next 3 */
      if (doc.languageId === "ledger") {
        diagnosticProvider.updateDiagnostics(doc);
      }
    },
    null,
    context.subscriptions,
  );

  // Also check on document change, but debounced
  let timeout: NodeJS.Timeout | undefined;
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (event.document.languageId === "ledger") {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          diagnosticProvider.updateDiagnostics(event.document);
        }, 1000); // 1 second debounce
      }
    },
    null,
    context.subscriptions,
  );

  // Clear diagnostics when document is closed
  vscode.workspace.onDidCloseTextDocument(
    (doc) => {
      collection.delete(doc.uri);
    },
    null,
    context.subscriptions,
  );

  // Check all open ledger documents
  /* c8 ignore next 5 */
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.languageId === "ledger") {
      diagnosticProvider.updateDiagnostics(doc);
    }
  });

  context.subscriptions.push(collection);
}

class LedgerDiagnosticProvider {
  constructor(
    private ledgerCli: LedgerCli,
    private collection: vscode.DiagnosticCollection,
  ) {}

  async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    /* c8 ignore next 3 */
    if (document.languageId !== "ledger") {
      return;
    }

    try {
      const errors = await this.ledgerCli.validateFile(document.fileName);
      const diagnostics: vscode.Diagnostic[] = errors.map((error) => {
        const range =
          error.line !== undefined
            ? error.column !== undefined
              ? /* c8 ignore next 5 */
                new vscode.Range(
                  error.line,
                  error.column,
                  error.line,
                  error.column + 1,
                )
              : new vscode.Range(
                  error.line,
                  0,
                  error.line,
                  Math.max(1, document.lineAt(error.line).text.length),
                )
            : /* c8 ignore next */
              new vscode.Range(
                0,
                0,
                0,
                Math.max(1, document.lineAt(0).text.length),
              );

        const severity =
          error.severity === "warning"
            ? /* c8 ignore next */
              vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Error;

        const diagnostic = new vscode.Diagnostic(
          range,
          error.message,
          severity,
        );
        diagnostic.source = "ledger";
        return diagnostic;
      });

      this.collection.set(document.uri, diagnostics);
      /* c8 ignore next 5 */
    } catch (error) {
      console.error("Failed to validate ledger file:", error);
      // Clear diagnostics if validation fails due to ledger not being available
      this.collection.set(document.uri, []);
    }
  }
}
