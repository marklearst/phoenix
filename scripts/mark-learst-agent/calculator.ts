/**
 * Divide two finite numbers, rejecting undefined or unrepresentable results.
 * @param params - the operands supplied to the local tool
 * @param params.numerator - the number to divide
 * @param params.denominator - the divisor, which must be nonzero
 */
export function divideNumbers({
  numerator,
  denominator,
}: {
  numerator: number;
  denominator: number;
}): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new RangeError("Both operands must be finite numbers.");
  }
  if (denominator === 0) {
    throw new RangeError(
      [
        "Cannot divide by zero: the calculator needs a nonzero denominator.",
        `Received numerator=${numerator}, denominator=${denominator}.`,
        "No result was produced. Ask for a nonzero denominator before calculating again.",
      ].join("\n")
    );
  }
  const result = numerator / denominator;
  if (!Number.isFinite(result)) {
    throw new RangeError("The quotient exceeds the range of a finite number.");
  }
  return result;
}
