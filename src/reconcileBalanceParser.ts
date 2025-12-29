// Parser for target balance amounts entered by user
// Handles various currency input formats and provides formatted output

export class BalanceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceParseError";
  }
}

/**
 * Parse a target balance amount from user input.
 *
 * Supports formats like:
 * - $1234.56
 * - $1,234.56
 * - 1234.56
 * - -$500.00
 * - $100 (adds .00)
 *
 * @param inputText - The raw user input
 * @returns The parsed amount as a number
 * @throws BalanceParseError if the input cannot be parsed as a valid amount
 */
export function parseBalance(inputText: string): number {
  if (!inputText || !inputText.trim()) {
    throw new BalanceParseError("Empty input");
  }

  // Clean up whitespace
  let text = inputText.trim();

  // Check for negative sign at the beginning
  const isNegative = text.startsWith("-");
  if (isNegative) {
    text = text.slice(1).trim();
  }

  // Remove dollar sign if present
  if (text.startsWith("$")) {
    text = text.slice(1).trim();
  }

  // Remove commas and spaces (handles bad copy-paste, OCR, etc.)
  text = text.replace(/,/g, "").replace(/ /g, "");

  // Validate that what's left is a valid number
  const amount = parseFloat(text);
  if (isNaN(amount)) {
    throw new BalanceParseError(`Invalid number format: ${inputText}`);
  }

  // Apply negative sign
  return isNegative ? -amount : amount;
}

/**
 * Format a number amount as a currency string.
 *
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "$1,234.56" or "-$500.00")
 */
export function formatBalance(amount: number): string {
  const absAmount = Math.abs(amount);

  // Format with commas and 2 decimal places
  const formatted = absAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (amount < 0) {
    return `-$${formatted}`;
  } else {
    return `$${formatted}`;
  }
}

export class TargetBalanceParser {
  /**
   * Parse a target balance amount from user input.
   *
   * @param inputText - The raw user input
   * @returns Tuple of [amount, formatted_display]
   */
  parse(inputText: string): [number, string] {
    const amount = parseBalance(inputText);
    const formatted = formatBalance(amount);
    return [amount, formatted];
  }
}
