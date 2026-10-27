import { describe, expect, it } from "vitest";
import { ALL_KEYS, KEY_ROWS, KEY_BY_ID } from "../keymap";
import { initialState, pressKey, typeKeys } from "../session";
import { asReal } from "../core";

describe("fx-991ES PLUS physical layout and action map", () => {
  it("preserves the two CALC controls, three six-key scientific rows, and four five-key numeric rows", () => {
    expect(KEY_ROWS.map((row) => row.length)).toEqual([2, 6, 6, 6, 5, 5, 5, 5]);
    expect(KEY_ROWS[0].map((key) => key.id)).toEqual(["calc", "integ"]);
    expect(KEY_ROWS[1].map((key) => key.id)).toEqual(["frac", "sqrt", "sq", "pow", "log", "ln"]);
    expect(KEY_ROWS[2].map((key) => key.id)).toEqual(["neg", "dms", "hyp", "sin", "cos", "tan"]);
    expect(KEY_ROWS[3].map((key) => key.id)).toEqual(["rcl", "eng", "lp", "rp", "format", "mplus"]);
    expect(KEY_ROWS.slice(4).map((row) => row.map((key) => key.label))).toEqual([
      ["7", "8", "9", "DEL", "AC"], ["4", "5", "6", "×", "÷"],
      ["1", "2", "3", "+", "−"], ["0", ".", "×10ˣ", "Ans", "="],
    ]);
    expect(new Set(ALL_KEYS.map((key) => key.id)).size).toBe(40);
  });

  it("provides executable primary actions and colored secondary mappings for marked legends", () => {
    for (const key of ALL_KEYS) {
      expect(key.base, `${key.id} base action`).toBeDefined();
      if (key.shiftLabel) expect(key.shift, `${key.id} SHIFT mapping`).toBeDefined();
      if (key.alphaLabel) expect(key.alpha, `${key.id} ALPHA mapping`).toBeDefined();
    }
    expect(KEY_BY_ID.sin.shiftLabel).toBe("sin⁻¹");
    expect(KEY_BY_ID.sin.alphaLabel).toBe("D");
    expect(KEY_BY_ID.frac.shiftLabel).toBe("ab/c");
  });

  it("SHIFT+HYP+sin enters inverse hyperbolic mode and HYP+sin evaluates sinh", () => {
    const forward = typeKeys(initialState(), ["hyp", "sin", "d3", "d0", "exe"]);
    // Key IDs represent one physical press; verify this uses the hyperbolic fn.
    expect(asReal(forward.result!.value)).toBeCloseTo(Math.sinh(30), 8);
    const inverse = typeKeys(initialState(), ["hyp", "shift", "sin", "d1", "exe"]);
    expect(inverse.result).not.toBeNull();
    expect(inverse.tokens.some((token) => token.t === "func" && token.s === "asinh")).toBe(true);
  });

  it("SHIFT+CALC numerically solves f(X)=0 with Newton iteration", () => {
    const solved = typeKeys(initialState(), ["alpha", "rp", "sq", "sub", "d4", "shift", "calc"]);
    expect(solved.result).not.toBeNull();
    expect(asReal(solved.result!.value)).toBeCloseTo(2, 8);
  });

  it("M+ is independent memory and AC keeps it", () => {
    let state = typeKeys(initialState(), ["d5", "exe", "mplus", "ac", "alpha", "d0", "exe"]);
    expect(asReal(state.result!.value)).toBe(5);
    state = pressKey(state, "ac");
    expect(state.vars.M && asReal(state.vars.M)).toBe(5);
  });
});
