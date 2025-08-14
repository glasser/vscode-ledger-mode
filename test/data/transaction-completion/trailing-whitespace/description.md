# Trailing Whitespace Test

This test verifies that transaction completion (C-c TAB) includes posting lines that have trailing whitespace.

The first transaction has posting lines with trailing spaces:
- `    Expenses:Food     $50.00   ` (3 trailing spaces)
- `    Assets:Checking  -$50.00   ` (3 trailing spaces)

When completing the third transaction for "Store A", it should include both posting lines from the first transaction, despite the trailing whitespace.

**Bug**: If the parser skips lines with trailing whitespace, the completion might only include postings from the second transaction (which has no trailing whitespace).