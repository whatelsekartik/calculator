/**
 * The fx-991ES PLUS 2nd edition physical key layout. This is the sole source
 * of truth for visible legends and executable primary/SHIFT/ALPHA actions.
 */
import { Tok, tok } from "./parser";

export type KeyEffect =
  | { kind: "insert"; toks: Tok[] }
  | { kind: "insertFn"; name: string }
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
const N = (s: string): KeyEffect => ({ kind: "insert", toks: [...s].map((c) => tok("num", c)) });
const O = (s: string): KeyEffect => ({ kind: "insert", toks: [tok("op", s)] });
const V = (s: string): KeyEffect => ({ kind: "insert", toks: [tok("var", s)] });
const C = (s: string): KeyEffect => ({ kind: "insert", toks: [tok("const", s)] });
const F = (name: string): KeyEffect => ({ kind: "insertFn", name });
const A = (action: string): KeyEffect => ({ kind: "action", action });
const P = (name: string): KeyEffect => ({ kind: "insert", toks: [tok("post", name)] });
const K = (id: string, label: string, aria: string, tone: KeyDef["tone"], base: KeyEffect,
  opts: Partial<Pick<KeyDef, "shiftLabel" | "alphaLabel" | "shift" | "alpha">> = {}): KeyDef =>
  ({ id, label, aria, tone, base, ...opts });

export const KEY_ROWS: KeyDef[][] = [
  // MODE-specific CALC / integral row, above the six-wide scientific keyboard.
  [
    K("calc", "CALC", "CALC: evaluate expression with current variable values", "fn", A("calc"), { shiftLabel: "SOLVE", shift: A("solve") }),
    K("integ", "∫", "Numerical integration template", "fn", F("integ"), { shiftLabel: "d/dx", shift: F("diff") }),
  ],
  [
    K("frac", "□/□", "Fraction template", "fn", O("/"), { shiftLabel: "ab/c", shift: { kind: "insert", toks: [tok("mixed", "⌟")] } }),
    K("sqrt", "√□", "Square root template", "fn", F("sqrt"), { shiftLabel: "∛□", shift: F("cbrt") }),
    K("sq", "x²", "Square", "fn", P("sq"), { shiftLabel: "x³", shift: P("cube") }),
    K("pow", "x□", "Power template", "fn", O("^"), { shiftLabel: "x√", shift: F("xroot") }),
    K("log", "log", "Common logarithm", "fn", F("log"), { shiftLabel: "10ˣ", shift: F("exp10") }),
    K("ln", "ln", "Natural logarithm", "fn", F("ln"), { shiftLabel: "eˣ", shift: F("expe") }),
  ],
  [
    K("neg", "(−)", "Negative sign", "fn", O("-"), { shiftLabel: "Abs", shift: F("abs"), alphaLabel: "A", alpha: V("A") }),
    K("dms", "° ′ ″", "Degrees minutes seconds", "fn", { kind: "insert", toks: [tok("dms", "°")] }, { shiftLabel: "DMS", shift: A("dms-conv"), alphaLabel: "B", alpha: V("B") }),
    K("hyp", "hyp", "Hyperbolic function prefix", "fn", A("hyp"), { shiftLabel: "x!", shift: P("!"), alphaLabel: "C", alpha: V("C") }),
    K("sin", "sin", "Sine", "fn", F("sin"), { shiftLabel: "sin⁻¹", shift: F("asin"), alphaLabel: "D", alpha: V("D") }),
    K("cos", "cos", "Cosine", "fn", F("cos"), { shiftLabel: "cos⁻¹", shift: F("acos"), alphaLabel: "E", alpha: V("E") }),
    K("tan", "tan", "Tangent", "fn", F("tan"), { shiftLabel: "tan⁻¹", shift: F("atan"), alphaLabel: "F", alpha: V("F") }),
  ],
  [
    K("rcl", "RCL", "Recall variable", "fn", A("rcl"), { shiftLabel: "STO", shift: A("sto") }),
    K("eng", "ENG", "Engineering notation", "fn", A("eng"), { shiftLabel: "%", shift: P("%") }),
    K("lp", "(", "Open parenthesis", "fn", { kind: "insert", toks: [tok("lp", "(")] }, { alphaLabel: "Y", alpha: V("Y") }),
    K("rp", ")", "Close parenthesis", "fn", { kind: "insert", toks: [tok("rp", ")")] }, { alphaLabel: "X", alpha: V("X") }),
    K("format", "S⇔D", "Toggle exact fraction and decimal display", "fn", A("format"), { shiftLabel: "∠", shift: { kind: "insert", toks: [tok("op", "angle")] } }),
    K("mplus", "M+", "Add displayed or entered value to independent memory", "fn", A("mplus"), { shiftLabel: "M−", shift: A("mminus") }),
  ],
  [
    K("d7", "7", "Seven", "num", N("7")), K("d8", "8", "Eight", "num", N("8")), K("d9", "9", "Nine", "num", N("9")),
    K("del", "DEL", "Delete before cursor", "del", A("del"), { shiftLabel: "UNDO", shift: A("undo") }),
    K("ac", "AC", "All clear", "ac", A("ac"), { shiftLabel: "OFF", shift: A("off") }),
  ],
  [
    K("d4", "4", "Four", "num", N("4")), K("d5", "5", "Five", "num", N("5")), K("d6", "6", "Six", "num", N("6")),
    K("mul", "×", "Multiply", "op", O("*"), { shiftLabel: "nPr", shift: O("P") }),
    K("div", "÷", "Divide", "op", O("/"), { shiftLabel: "nCr", shift: O("C") }),
  ],
  [
    K("d1", "1", "One", "num", N("1")), K("d2", "2", "Two", "num", N("2")), K("d3", "3", "Three", "num", N("3")),
    K("add", "+", "Plus", "op", O("+"), { shiftLabel: "Pol", shift: F("pol") }),
    K("sub", "−", "Subtract", "op", O("-"), { shiftLabel: "Rec", shift: F("rec") }),
  ],
  [
    K("d0", "0", "Zero", "num", N("0"), { alphaLabel: "M", alpha: V("M") }),
    K("dot", ".", "Decimal point", "num", N("."), { shiftLabel: "Ran#", shift: F("ran#") }),
    K("exp10", "×10ˣ", "Scientific notation exponent", "fn", { kind: "insert", toks: [tok("op", "E10"), tok("lp", "(")] }),
    K("ans", "Ans", "Previous answer", "fn", V("Ans"), { shiftLabel: "π", shift: C("pi") }),
    K("exe", "=", "Execute calculation", "exe", A("exe")),
  ],
];
export const ALL_KEYS = KEY_ROWS.flat();
export const KEY_BY_ID: Record<string, KeyDef> = Object.fromEntries(ALL_KEYS.map((k) => [k.id, k]));
