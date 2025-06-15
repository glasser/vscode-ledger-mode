// CSS constants for error formatting - shared between implementation and preview

export const ERROR_FORMATTING_CSS = `
        .file-link {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: underline;
            border-radius: 3px;
            padding: 1px 3px;
            background-color: rgba(var(--vscode-textLink-foreground), 0.1);
        }
        .file-link:hover {
            color: var(--vscode-textLink-activeForeground);
            background-color: rgba(var(--vscode-textLink-foreground), 0.2);
        }
        .error-message {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            padding: 2px 4px;
            border-radius: 3px;
            border-left: 3px solid var(--vscode-errorForeground);
        }
        .quoted-block {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            margin: 4px 0;
            display: block;
            font-family: var(--vscode-editor-font-family);
            white-space: pre;
        }
        .context-label {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
`;
