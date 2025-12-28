// Tests for comment stripping functionality during transaction completion
// Verifies that configured patterns are stripped from comments in inserted postings

import * as assert from "assert";
import { processComment } from "../../src/transactionCompletion";

suite("Comment Stripping", () => {
  suite("processComment()", () => {
    test("Should strip default pattern <<...>> from comment", () => {
      const result = processComment("; category <<food>>", ["<<(.+?)>>"]);
      assert.strictEqual(result, "; category");
    });

    test("Should strip multiple occurrences of pattern", () => {
      const result = processComment("; <<one>> and <<two>> here", [
        "<<(.+?)>>",
      ]);
      assert.strictEqual(result, "; and here");
    });

    test("Should remove comment entirely if only whitespace remains after stripping", () => {
      const result = processComment("; <<remove-me>>", ["<<(.+?)>>"]);
      assert.strictEqual(result, undefined);
    });

    test("Should remove comment if only semicolon and whitespace remain", () => {
      const result = processComment(";  <<tag>>  ", ["<<(.+?)>>"]);
      assert.strictEqual(result, undefined);
    });

    test("Should preserve comment with no matches", () => {
      const result = processComment("; normal comment", ["<<(.+?)>>"]);
      assert.strictEqual(result, "; normal comment");
    });

    test("Should handle multiple patterns", () => {
      const result = processComment("; <<tag1>> [tag2] other", [
        "<<(.+?)>>",
        "\\[(.+?)\\]",
      ]);
      assert.strictEqual(result, "; other");
    });

    test("Should return undefined for undefined input", () => {
      const result = processComment(undefined, ["<<(.+?)>>"]);
      assert.strictEqual(result, undefined);
    });

    test("Should return comment unchanged with empty pattern list", () => {
      const result = processComment("; unchanged <<tag>>", []);
      assert.strictEqual(result, "; unchanged <<tag>>");
    });

    test("Should handle pattern that matches entire comment content", () => {
      const result = processComment("; <<entire-content>>", ["<<(.+?)>>"]);
      assert.strictEqual(result, undefined);
    });

    test("Should trim remaining whitespace properly", () => {
      const result = processComment(";   <<start>>  middle  <<end>>  ", [
        "<<(.+?)>>",
      ]);
      assert.strictEqual(result, "; middle");
    });

    test("Should handle comment with only semicolon", () => {
      const result = processComment(";", ["<<(.+?)>>"]);
      assert.strictEqual(result, ";");
    });

    test("Should handle adjacent pattern matches", () => {
      const result = processComment("; <<one>><<two>>", ["<<(.+?)>>"]);
      assert.strictEqual(result, undefined);
    });

    test("Should handle pattern at end of comment", () => {
      const result = processComment("; some text <<tag>>", ["<<(.+?)>>"]);
      assert.strictEqual(result, "; some text");
    });

    test("Should handle pattern at start of comment content", () => {
      const result = processComment("; <<tag>> some text", ["<<(.+?)>>"]);
      assert.strictEqual(result, "; some text");
    });
  });
});
