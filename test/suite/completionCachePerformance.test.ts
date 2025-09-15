// Tests for completion cache performance and behavior
// This is a non-data-driven test because caching behavior is hard to test with static files

import * as assert from "assert";
import * as vscode from "vscode";
import { CompletionCache } from "../../src/completionCache";

suite("Completion Cache Performance Tests", () => {
  let document: vscode.TextDocument;
  let cache: CompletionCache;

  setup(() => {
    // Create a fresh cache instance for each test
    cache = new CompletionCache();
  });

  teardown(async () => {
    // Close any open documents
    if (document) {
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    }
  });

  test("Should cache results for 10 seconds (time-based TTL)", async function () {
    this.timeout(15000);

    const content = `2024-01-01 Store A
    Expenses:Food    $50.00
    Assets:Cash     -$50.00

2024-01-02 Store B
    Expenses:Clothing    $100.00
    Assets:Bank        -$100.00`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });

    // First call should parse
    const start1 = process.hrtime.bigint();
    const payees1 = cache.getPayees(document);
    const time1 = Number(process.hrtime.bigint() - start1) / 1000000;

    // Second call within 10 seconds should use cache (much faster)
    const start2 = process.hrtime.bigint();
    const payees2 = cache.getPayees(document);
    const time2 = Number(process.hrtime.bigint() - start2) / 1000000;

    // Results should be identical
    assert.deepStrictEqual(
      payees1,
      payees2,
      "Cached results should be identical",
    );
    assert.strictEqual(payees1.size, 2, "Should have 2 payees");

    // Cache should be much faster (at least 2x, often 10x+)
    assert.ok(
      time2 < time1 / 2,
      `Cache should be much faster (parse: ${time1.toFixed(3)}ms, cache: ${time2.toFixed(3)}ms)`,
    );

    console.log(`  Parse time: ${time1.toFixed(3)}ms`);
    console.log(`  Cache time: ${time2.toFixed(3)}ms`);
    console.log(`  Speedup: ${(time1 / time2).toFixed(1)}x`);

    // Wait 11 seconds and verify cache expires
    await new Promise((resolve) => setTimeout(resolve, 11000));

    const start3 = process.hrtime.bigint();
    const payees3 = cache.getPayees(document);
    const time3 = Number(process.hrtime.bigint() - start3) / 1000000;

    // Should be slow again (cache expired)
    assert.ok(
      time3 > time2 * 2,
      `Cache should have expired (cached: ${time2.toFixed(3)}ms, expired: ${time3.toFixed(3)}ms)`,
    );
    assert.deepStrictEqual(
      payees1,
      payees3,
      "Results should still be identical after cache expiry",
    );

    console.log(`  After cache expiry: ${time3.toFixed(3)}ms`);
  });

  test("Should share parsed transactions between payees and accounts", async () => {
    const content = `2024-01-01 Test Store
    Expenses:Food    $25.00
    Assets:Cash     -$25.00`;

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });

    // Get payees first (should parse and cache)
    const start1 = process.hrtime.bigint();
    const payees = cache.getPayees(document);
    const time1 = Number(process.hrtime.bigint() - start1) / 1000000;

    // Get accounts immediately after (should reuse parsed transactions)
    const start2 = process.hrtime.bigint();
    const accounts = cache.getAccounts(document);
    const time2 = Number(process.hrtime.bigint() - start2) / 1000000;

    assert.strictEqual(payees.size, 1, "Should have 1 payee");
    assert.strictEqual(accounts.size, 2, "Should have 2 accounts");

    // Second call should be much faster (reusing cached transactions)
    assert.ok(
      time2 < time1 / 2,
      `Accounts call should reuse cached data (payees: ${time1.toFixed(3)}ms, accounts: ${time2.toFixed(3)}ms)`,
    );

    console.log(`  Payees (parse): ${time1.toFixed(3)}ms`);
    console.log(`  Accounts (cached): ${time2.toFixed(3)}ms`);
  });

  test("Should handle multiple documents independently", async () => {
    const content1 = `2024-01-01 Store One
    Expenses:Food    $10.00
    Assets:Cash     -$10.00`;

    const content2 = `2024-01-01 Store Two
    Expenses:Clothing    $20.00
    Assets:Bank         -$20.00`;

    const doc1 = await vscode.workspace.openTextDocument({
      content: content1,
      language: "ledger",
    });

    const doc2 = await vscode.workspace.openTextDocument({
      content: content2,
      language: "ledger",
    });

    // Cache both documents
    const payees1 = cache.getPayees(doc1);
    const payees2 = cache.getPayees(doc2);

    // Should be different results
    assert.strictEqual(payees1.size, 1);
    assert.strictEqual(payees2.size, 1);
    assert.strictEqual(payees1.get("Store One"), 1);
    assert.strictEqual(payees2.get("Store Two"), 1);
    assert.ok(!payees1.has("Store Two"), "Doc1 shouldn't have doc2's payees");
    assert.ok(!payees2.has("Store One"), "Doc2 shouldn't have doc1's payees");

    // Cleanup
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("Should demonstrate performance with simulated large file", async function () {
    this.timeout(30000); // Increase timeout for large file

    // Generate a large file (5000 transactions, similar scale to your file)
    let content = "";
    for (let i = 1; i <= 5000; i++) {
      const day = ((i - 1) % 28) + 1;
      const date = `2024-01-${String(day).padStart(2, "0")}`;
      const payee = `Store ${i % 10}`; // 10 unique payees
      const account1 = `Expenses:Category${i % 5}`; // 5 expense categories
      const account2 = `Assets:Account${i % 3}`; // 3 asset accounts

      content += `${date} ${payee}\n`;
      content += `    ${account1}    $${i}.00\n`;
      content += `    ${account2}   -$${i}.00\n`;

      if (i < 5000) {
        content += "\n";
      }
    }

    document = await vscode.workspace.openTextDocument({
      content,
      language: "ledger",
    });

    console.log(
      `  Testing with ${content.split("\n").length} lines, 5000 transactions`,
    );

    // Simulate typing session (10 keystrokes)
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = process.hrtime.bigint();
      const payees = cache.getPayees(document);
      const time = Number(process.hrtime.bigint() - start) / 1000000;
      times.push(time);

      if (i === 0) {
        console.log(
          `  First call (parse): ${time.toFixed(3)}ms (${payees.size} payees)`,
        );
      } else if (i === 1) {
        console.log(`  Second call (cache): ${time.toFixed(3)}ms`);
      }
    }

    const parseTime = times[0];
    const avgCacheTime =
      times.slice(1).reduce((a, b) => a + b, 0) / (times.length - 1);

    console.log(`  Average cache time: ${avgCacheTime.toFixed(3)}ms`);
    console.log(
      `  Performance improvement: ${(parseTime / avgCacheTime).toFixed(1)}x faster`,
    );

    // Cache should be significantly faster
    assert.ok(
      avgCacheTime < parseTime / 5,
      `Cache should be at least 5x faster (parse: ${parseTime.toFixed(3)}ms, cache: ${avgCacheTime.toFixed(3)}ms)`,
    );
  });
});
