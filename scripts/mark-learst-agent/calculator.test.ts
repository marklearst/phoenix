import assert from "node:assert/strict";
import { test } from "node:test";

import { divideNumbers } from "./calculator.js";

test("divides positive, negative, and fractional operands", () => {
  assert.equal(divideNumbers({ numerator: 84, denominator: 7 }), 12);
  assert.equal(divideNumbers({ numerator: -9, denominator: 2 }), -4.5);
  assert.equal(divideNumbers({ numerator: 0, denominator: 2 }), 0);
});

test("zero divisors produce an actionable multiline error, including negative zero", () => {
  for (const denominator of [0, -0]) {
    assert.throws(
      () => divideNumbers({ numerator: 84, denominator }),
      (error: unknown) => {
        assert.ok(error instanceof RangeError);
        assert.match(error.message, /Cannot divide by zero/);
        assert.match(error.message, /\nReceived numerator=84, denominator=0\./);
        assert.match(error.message, /Ask for a nonzero denominator/);
        return true;
      }
    );
  }
});

test("rejects nonfinite operands and overflow instead of returning Infinity", () => {
  assert.throws(
    () => divideNumbers({ numerator: Infinity, denominator: 2 }),
    RangeError
  );
  assert.throws(
    () => divideNumbers({ numerator: 2, denominator: NaN }),
    RangeError
  );
  assert.throws(
    () =>
      divideNumbers({
        numerator: Number.MAX_VALUE,
        denominator: Number.MIN_VALUE,
      }),
    RangeError
  );
});
