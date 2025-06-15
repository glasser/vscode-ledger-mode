# Syntax Highlighting Test Data

This directory contains TextMate grammar test files (`.test.ledger`) for testing syntax highlighting.

## Testing Approach

These files are designed to be used with the `vscode-tmgrammar-test` tool, which validates that specific tokens in the source files receive the expected TextMate scopes.

## Test File Format

Each `.test.ledger` file contains:
- Ledger source code to be highlighted
- Comments with assertions about expected scopes
- Caret markers (`^`) indicating where to check scopes

Example:
```
2024-01-15 * Grocery Store
;          ^ meta.transaction.cleared.ledger
;^^^^^^^^^ constant.numeric.date.ledger
```

## Running Tests

These tests are run separately using:
```bash
npm run test:syntax
```

This command uses the `vscode-tmgrammar-test` CLI tool to validate all `.test.ledger` files against the grammar defined in `syntaxes/ledger.tmLanguage.json`.

## Note

The `data.test.ts` file in this directory is not used for actual testing - the real tests are performed by the external tool as part of the test:syntax npm script.