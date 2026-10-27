/**
 * Physical key definitions: primary legend, SHIFT layer (yellow on device),
 * ALPHA layer (red), and the token/action effect of each press.
 * The keypad UI renders from this table and the session reducer dispatches
 * effects — so every visible key is guaranteed to be wired to behavior.
 */

import { Tok, tok } from "./parser";

export type KeyEffect =
  | { kind: "insert"; toks: Tok[] }
  | { kind: "insertFn"; name: string } // function + '(' (2-arg fns add ', )' skeleton)
  | { kind: "action"; action: string }
  | { kind: "sto" };

export interface KeyDef {
  id: string;
  label: string;
  shiftLabel?: string;
  alphaLabel?: string;
  base: KeyEffect;
  shift?: KeyEffect;
  alpha?: KeyEffect;
  aria: string;
  tone: "num" | "fn" | "op" | "exe" | "del" | "ac";
}

const N = (ch: string): KeyEffect => ({ kind: "insert", toks: [tok("num", ch)] });
const O = (s: string): KeyEffect => ({ kind: "insert", toks: [tok("op", s)] });
const P = (s: string, sym: string): KeyEffect => ({ kind: "insert", toks: [tok("post", s)] });
const C = (s: string): KeyEffect => ({ kind: "insert", toks: [tok("const", s)] });
const V = (s: string): KeyEffect => ({ kind: "insert", toks: [tok("var", s)] });
const F = (name: string): KeyEffect => ({ kind: "insertFn", name });

/** dark keypad grid (5 columns) */
export const KEY_ROWS: KeyDef[][] = [
  // row 1 — powers & roots
  [
    { id: "frac", label: "⬚/⬚", shiftLabel: "⬚⌟⬚/⬚", aria: "Fraction", tone: "fn",
      base: O("/"), shift: { kind: "insert", toks: [tok("mixed", "⌟")] } },
    { id: "sqrt", label: "√", shiftLabel: "∛", aria: "Square root", tone: "fn",
      base: F("sqrt"), shift: F("cbrt") },
    { id: "sq", label: "x²", shiftLabel: "x³", aria: "Square", tone: "fn",
      base: P("sq", "²"), shift: P("cube", "³") },
    { id: "pow", label: "x^", shiftLabel: "x√", aria: "Power", tone: "fn",
      base: O("^"), shift: F("xroot") },
    { id: "exp10", label: "×10^x", aria: "Times ten to the power", tone: "fn",
      base: { kind: "insert", toks: [tok("op", "E10"), tok("lp", "(")] }, },
  ],
  // row 2 — logs & trig
  [
    { id: "log", label: "log", shiftLabel: "10^x", aria: "Logarithm base 10", tone: "fn",
      base: F("log"), shift: F("exp10") },
    { id: "ln", label: "ln", shiftLabel: "e^x", aria: "Natural logarithm", tone: "fn",
      base: F("ln"), shift: F("expe") },
    { id: "sin", label: "sin", shiftLabel: "sin⁻¹", alphaLabel: "D", aria: "Sine", tone: "fn",
      base: F("sin"), shift: F("asin"), alpha: V("D") },
    { id: "cos", label: "cos", shiftLabel: "cos⁻¹", alphaLabel: "E", aria: "Cosine", tone: "fn",
      base: F("cos"), shift: F("acos"), alpha: V("E") },
    { id: "tan", label: "tan", shiftLabel: "tan⁻¹", alphaLabel: "F", aria: "Tangent", tone: "fn",
      base: F("tan"), shift: F("atan"), alpha: V("F") },
  ],
  // row 3 — sign, dms, factorial, parens
  [
    { id: "neg", label: "(−)", alphaLabel: "A", aria: "Negative sign", tone: "fn",
      base: O("-"), alpha: V("A") },
    { id: "dms", label: "°′″", shiftLabel: "◄DMS", alphaLabel: "B", aria: "Degrees minutes seconds", tone: "fn",
      base: { kind: "insert", toks: [tok("dms", "°")] },
      shift: { kind: "action", action: "dms-conv" },
      alpha: V("B") },
    { id: "fact", label: "x!", shiftLabel: "%", alphaLabel: "C", aria: "Factorial", tone: "fn",
      base: P("!", "!"),
      shift: P("%", "%"),
      alpha: V("C") },
    { id: "lp", label: "(", shiftLabel: "STO→", alphaLabel: "Y", aria: "Open parenthesis", tone: "fn",
      base: { kind: "insert", toks: [tok("lp", "(")] },
      shift: { kind: "action", action: "sto" },
      alpha: V("Y") },
    { id: "rp", label: ")", alphaLabel: "X", aria: "Close parenthesis", tone: "fn",
      base: { kind: "insert", toks: [tok("rp", ")")] }, alpha: V("X") },
  ],
  // row 4 — 7 8 9 DEL AC
  [
    { id: "d7", label: "7", aria: "Seven", tone: "num", base: N("7") },
    { id: "d8", label: "8", aria: "Eight", tone: "num", base: N("8") },
    { id: "d9", label: "9", aria: "Nine", tone: "num", base: N("9") },
    { id: "del", label: "DEL", shiftLabel: "UNDO", aria: "Delete", tone: "del",
      base: { kind: "action", action: "del" }, shift: { kind: "action", action: "undo" } },
    { id: "ac", label: "AC", shiftLabel: "CLR ALL", aria: "All clear", tone: "ac",
      base: { kind: "action", action: "ac" }, shift: { kind: "action", action: "clrall" } },
  ],
  // row 5 — 4 5 6 × ÷
  [
    { id: "d4", label: "4", aria: "Four", tone: "num", base: N("4") },
    { id: "d5", label: "5", aria: "Five", tone: "num", base: N("5") },
    { id: "d6", label: "6", aria: "Six", tone: "num", base: N("6") },
    { id: "mul", label: "×", shiftLabel: "nPr", aria: "Multiply", tone: "op",
      base: O("*"), shift: O("P") },
    { id: "div", label: "÷", shiftLabel: "nCr", aria: "Divide", tone: "op",
      base: O("/"), shift: O("C") },
  ],
  // row 6 — 1 2 3 + −
  [
    { id: "d1", label: "1", aria: "One", tone: "num", base: N("1") },
    { id: "d2", label: "2", aria: "Two", tone: "num", base: N("2") },
    { id: "d3", label: "3", aria: "Three", tone: "num", base: N("3") },
    { id: "add", label: "+", shiftLabel: "GCD", aria: "Plus", tone: "op",
      base: O("+"), shift: O("gcd") },
    { id: "sub", label: "−", shiftLabel: "LCM", aria: "Minus", tone: "op",
      base: O("-"), shift: O("lcm") },
  ],
  // row 7 — 0 . π Ans EXE
  [
    { id: "d0", label: "0", alphaLabel: "M", aria: "Zero", tone: "num",
      base: N("0"), alpha: V("M") },
    { id: "dot", label: ".", shiftLabel: "Ran#", aria: "Decimal point", tone: "num",
      base: N("."), shift: F("ran#") },
    { id: "pi", label: "π", shiftLabel: "e", aria: "Pi", tone: "fn",
      base: C("pi"), shift: C("e") },
    { id: "ans", label: "Ans", aria: "Answer memory", tone: "fn", base: V("Ans") },
    { id: "exe", label: "EXE", aria: "Execute calculation", tone: "exe",
      base: { kind: "action", action: "exe" } },
  ],
];

export const ALL_KEYS: KeyDef[] = KEY_ROWS.flat();

export const KEY_BY_ID: Record<string, KeyDef> = Object.fromEntries(
  ALL_KEYS.map((k) => [k.id, k]),
);
