// Tests for ANSI color CSS integration in balance report view
// Tests that the HTML output includes proper CSS for color styling

import * as assert from "assert";
import { BalanceReportViewProvider } from "../../src/balanceReportView";

suite("Balance Report ANSI Color Integration Tests", () => {
  test("Should include ANSI color CSS in HTML output", () => {
    const provider = new BalanceReportViewProvider({} as any);

    const sampleReport =
      "\x1b[31m$-1000.00\x1b[0m  \x1b[34mEquity:Opening-Balances\x1b[0m";
    const html = provider.getReportHtml(sampleReport);

    // Should include CSS for ANSI colors
    assert.ok(html.includes(".ansi-red"), "Should include ansi-red CSS class");

    assert.ok(
      html.includes(".ansi-blue"),
      "Should include ansi-blue CSS class",
    );

    // Should have color styling
    assert.ok(html.includes("color:"), "Should include color CSS property");
  });
});
