/**
 * Session reducer tests — key sequences, cursor, replay, STO,
 * undo, AC vs full reset, persistence round-trips. UI-independent.
 */
import { describe, it, expect } from "vitest";
import {
  initialState, pressKey, typeKeys, setMode, setAngleUnit, clearHistory,
  tokensToSource, serializeValue, deserializeValue, CalcState, updateSettings,
} from "../session";
import { asReal, Value } from "../core";

const src = (s: CalcState) => tokensToSource(s.tokens).replace(/\s+/g, "");
const resultReal = (s: CalcState): number => {
  if (!s.result) throw new Error("no result");
  return asReal(s.result.value);
};

describe("typing & evaluation", () => {
  it("keys 2+3×4 EXE → 14", () => {
    const s = typeKeys(initialState(), ["d2", "add", "d3", "mul", "d4", "exe"]);
    expect(resultReal(s)).toBe(14);
    expect(s.result!.text).toBe("14");
  });
  it("2+3×4 through shaped tokens keeps precedence", () => {
    const s = typeKeys(initialState(), ["d2", "add", "d3", "mul", "d4"]);
    expect(src(s)).toBe("2+3×4");
  });
  it("×10^x key inserts E10 template: 2×10^3 EXE → 2000", () => {
    const s = typeKeys(initialState(), ["d2", "exp10", "d3", "rp", "exe"]);
    expect(resultReal(s)).toBe(2000);
  });
  it("percent through SHIFT layer: 200×10% = 20", () => {
    const s = typeKeys(initialState(), ["d2", "d0", "d0", "mul", "d1", "d0", "shift", "eng", "exe"]);
    expect(resultReal(s)).toBe(20);
  });
  it("skeleton 2-arg insert: SHIFT+pow (xroot) 3 , 27 with skip → 3", () => {
    // xroot(□,□): type 3, skip comma with ')', type 27, close
    const s = typeKeys(initialState(), ["shift", "pow", "d3", "rp", "d2", "d7", "exe"]);
    expect(resultReal(s)).toBe(3);
  });
  it("typing an operator after a result chains Ans", () => {
    let s = typeKeys(initialState(), ["d5", "exe"]);
    s = typeKeys(s, ["add", "d2", "exe"]);
    expect(resultReal(s)).toBe(7);
    expect(src(s)).toContain("Ans");
  });
  it("typing a digit after a result starts a fresh line", () => {
    let s = typeKeys(initialState(), ["d5", "exe"]);
    s = typeKeys(s, ["d9", "exe"]);
    expect(resultReal(s)).toBe(9);
  });
  it("postfix on empty input applies to Ans", () => {
    let s = typeKeys(initialState(), ["d5", "exe"]);
    s = typeKeys(s, ["sq", "exe"]);
    expect(resultReal(s)).toBe(25);
  });
});

describe("cursor & editing", () => {
  it("left/right navigation & insert mid-expression", () => {
    let s = typeKeys(initialState(), ["d1", "d3"]);
    s = pressKey(s, "nav-left");
    s = pressKey(s, "d2");
    expect(src(s)).toBe("123");
    expect(s.cursor).toBe(2);
  });
  it("DEL removes char before cursor, UNDO restores", () => {
    let s = typeKeys(initialState(), ["d1", "d2", "d3"]);
    s = pressKey(s, "del");
    expect(src(s)).toBe("12");
    s = typeKeys(s, ["shift", "del"]); // SHIFT+DEL = UNDO
    expect(src(s)).toBe("123");
  });
  it("AC clears the line but keeps variables and Ans", () => {
    let s = typeKeys(initialState(), ["d4", "d2", "exe"]);
    s = pressKey(s, "sto");
    s = pressKey(s, "alpha");
    s = pressKey(s, "neg"); // ALPHA+(−) = A
    expect(s.vars.A && (s.vars.A as Value & { kind: "num" }).real).toBe(42);
    s = pressKey(s, "ac");
    expect(src(s)).toBe("");
    expect(s.vars.A).not.toBeNull(); // AC must not clear variables
    expect(resultRealFromAns(s)).toBe(42);
  });
  it("SHIFT+AC behaves as OFF and does not erase stored variables", () => {
    let s = typeKeys(initialState(), ["d9", "exe"]);
    s = pressKey(s, "sto");
    s = pressKey(s, "alpha");
    s = pressKey(s, "neg");
    s = typeKeys(s, ["shift", "ac"]);
    expect(s.vars.A).not.toBeNull();
    expect(asReal(s.ans)).toBe(9);
    expect(src(s)).toBe("");
  });
  it("syntax error position jump with ◀", () => {
    let s = typeKeys(initialState(), ["d1", "add", "mul", "d2", "exe"]);
    expect(s.error).not.toBeNull();
    expect(s.error!.code).toBe("SYNTAX");
    s = pressKey(s, "nav-left");
    expect(s.cursor).toBe(2); // at the offending ×
    expect(s.error).toBeNull();
  });
});

function resultRealFromAns(s: CalcState): number {
  return asReal(s.ans);
}

describe("STO / variables / recall", () => {
  it("stores & recalls a variable in a later expression", () => {
    let s = typeKeys(initialState(), ["d7", "exe"]);
    s = pressKey(s, "sto");
    s = pressKey(s, "alpha");
    s = pressKey(s, "tan"); // ALPHA+tan = F
    s = pressKey(s, "ac");
    s = typeKeys(s, ["alpha", "tan", "mul", "d2", "exe"]);
    expect(resultReal(s)).toBe(14);
  });
  it("SHIFT and ALPHA indicators behave as sticky-then-release", () => {
    let s = pressKey(initialState(), "shift");
    expect(s.shift).toBe(true);
    s = pressKey(s, "sin"); // SHIFT+sin = sin⁻¹
    expect(s.shift).toBe(false);
    expect(tokensToSource(s.tokens)).toContain("sin⁻¹(");
  });
});

describe("history & replay", () => {
  it("stores entries with full-precision values and replays tokens", () => {
    let s = typeKeys(initialState(), ["d1", "div", "d3", "exe"]);
    s = typeKeys(s, ["d2", "add", "d2", "exe"]);
    expect(s.history.length).toBe(2);
    expect(s.history[1].exprText).toBe("1÷3");
    expect(s.history[1].result.kind).toBe("num");
    const fr = s.history[1].result as Value & { kind: "num" };
    expect(fr.frac?.n).toBe(1);
    expect(fr.frac?.d).toBe(3);
    // ▲ recalls most recent then older
    s = pressKey(s, "nav-up");
    expect(tokensToSource(s.tokens)).toBe("2+2");
    s = pressKey(s, "nav-up");
    expect(tokensToSource(s.tokens)).toBe("1÷3");
    // re-execute replay gives same result
    s = pressKey(s, "exe");
    const v = s.result!.value;
    if (v.kind !== "num") throw new Error();
    expect(v.frac?.n).toBe(1);
    expect(v.frac?.d).toBe(3);
  });
  it("clearHistory empties the list", () => {
    let s = typeKeys(initialState(), ["d1", "exe"]);
    s = clearHistory(s);
    expect(s.history.length).toBe(0);
  });
});

describe("modes & settings", () => {
  it("angle unit switch changes subsequent trig", () => {
    let s = typeKeys(initialState(), ["sin", "d3", "d0", "exe"]);
    expect(resultReal(s)).toBe(0.5);
    s = setAngleUnit(s, "rad");
    s = pressKey(s, "ac");
    s = typeKeys(s, ["sin", "d3", "d0", "exe"]);
    expect(resultReal(s)).not.toBe(0.5);
    expect(resultReal(s)).toBeCloseTo(Math.sin(30), 10); // sin(30 rad) = −0.9880…
  });
  it("complex mode makes √(−1) = i; calculate mode rejects it", () => {
    let s = typeKeys(initialState(), ["sqrt", "sub", "d1", "exe"]);
    expect(s.error!.code).toBe("MATH");
    s = setMode(s, "complex");
    s = typeKeys(s, ["sqrt", "sub", "d1", "exe"]);
    const v = s.result!.value;
    if (v.kind !== "complex") throw new Error();
    expect(v.z.im).toBeCloseTo(1, 12);
  });
  it("base-N mode evaluates in the selected radix", () => {
    let s = setMode(initialState(), "basen");
    s = typeKeys(s, ["d1", "d5", "add", "d1", "exe"]);
    expect(s.result!.text).toBe("16");
    s = { ...s, basenRadix: "hex" };
    s = typeKeys(pressKey(s, "ac"), ["d1", "d5", "add", "d1", "exe"]);
    expect(s.result!.text).toBe("16"); // 0x15 + 1 = 0x16
  });
  it("FORMAT key toggles fraction ↔ decimal", () => {
    let s = typeKeys(initialState(), ["d1", "div", "d3", "exe"]);
    expect(s.result!.hasAlt).toBe(true);
    expect(s.result!.showAlt).toBe(false);
    s = pressKey(s, "format");
    expect(s.result!.showAlt).toBe(true);
  });
  it("DMS conversion shows °′″ on the result", () => {
    let s = typeKeys(initialState(), ["d1", "dot", "d5", "exe"]);
    s = typeKeys(s, ["shift", "dms"]);
    expect(s.result!.overrideText).not.toBeNull();
  });
  it("settings update bumps version", () => {
    const s = updateSettings(initialState(), { thousandsSep: true });
    expect(s.settings.thousandsSep).toBe(true);
    expect(s.version).toBe(2);
  });
});

describe("persistence round-trip", () => {
  it("values serialize and rehydrate exactly", () => {
    const s = initialState();
    const cases: Value[] = [
      { kind: "num", real: 2 / 3, frac: null },
      { kind: "complex", z: { re: 2, im: -3 } },
      { kind: "matrix", m: [[1, 2], [3, 4]] },
      { kind: "vector", v: [1, 2, 3] },
      { kind: "text", s: "2^3×3^2×5" },
    ];
    s.history.forEach(() => undefined);
    for (const v of cases) {
      const back = deserializeValue(serializeValue(v));
      expect(back).toEqual(v);
    }
  });
  it("fraction twins survive serialization", () => {
    const s = typeKeys(initialState(), ["d1", "div", "d3", "exe"]);
    const v = s.result!.value;
    const back = deserializeValue(serializeValue(v));
    if (back.kind !== "num") throw new Error();
    expect(back.frac?.n).toBe(1);
    expect(back.frac?.d).toBe(3);
    expect(back.real).toBeCloseTo(1 / 3, 15);
  });
});
