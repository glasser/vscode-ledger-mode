// Main entry point for the VSCode Ledger extension
// Registers all providers and commands for Ledger file support

import * as vscode from "vscode";
import { registerCompletionProviders } from "./completionProvider";
import { registerDiagnosticProvider } from "./diagnosticProvider";
import { registerCommands } from "./commands";
import { registerDocumentFormatter } from "./documentFormatter";
import { NowMarkerProvider } from "./nowMarker";

export function activate(context: vscode.ExtensionContext) {
  console.log("Ledger extension is now active");

  // Register completion providers for merchants and accounts
  registerCompletionProviders(context);

  // Register diagnostic provider for ledger errors
  registerDiagnosticProvider(context);

  // Create and register the now marker provider
  const nowMarkerProvider = new NowMarkerProvider();
  context.subscriptions.push(nowMarkerProvider);

  // Register commands (pass nowMarkerProvider for jump command)
  registerCommands(context, nowMarkerProvider);

  // Register document formatter (enables format-on-save)
  registerDocumentFormatter(context);
}

export function deactivate() {}
