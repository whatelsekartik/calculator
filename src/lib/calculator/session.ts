/**
 * Session reducer — pure calculator state machine (editing, execution,
 * replay, variables, memory, undo, modifiers). UI-independent and
 * fully testable without React.
 */

import {
  Value, VarName, Fraction, intVal, cleanFloat,
} from "./core";
import { Tok, tok, tokenize } from "./parser";
import { DisplaySettings, DEFAULT_DISPLAY, valueToText, realToNodes, dmsNodes } from "./format";
import { DNode } from "./display";
import { calculate, EngineEnv } from "./engine";
import { evalBaseN, formatBase, Radix } from "./basen";
import { KEY_BY_ID, KeyEffect } from "./keymap";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ModeId =
  | "calc" | "complex" | "matrix" | "vector" | "basen"
  | "stats" | "table" | "equation" | "ineq" | "dist" | "ratio" | "mathbox";

export const MODES: { id: ModeId; name: string }[] = [
  { id: "calc", name: "Calculate" },
  { id: "complex", name: "Complex" },
  { id: "basen", name: "Base-N" },
  { id: "matrix", name: "Matrix" },
  { id: "vector", name: "Vector" },
  { id: "stats", name: "Statistics" },
  { id: "table", name: "Table" },
  { id: "equation", name: "Equation" },
  { id: "ineq", name: "Inequality" },
  { id: "dist", name: "Distribution" },
  { id: "ratio", name: "Ratio" },
  { id: "mathbox", name: "Math Box" },
];

/**
 * Result keeps the FULL-PRECISION value plus a precomputed display text
 * snapshot for history/aria. Display nodes are produced live by the
 * component from `value` under the CURRENT settings so FORMAT/angle
 * changes re-render the result faithfully. `overrideText`/`overrideNodes`
 * are used by one-shot conversions (DMS).
 */
export type ResultView = {
  value: Value;
  text: string;
  hasAlt: boolean;
  showAlt: boolean;
  overrideNodes: DNode[] | null;
  overrideText: string | null;
};

export interface HistoryEntry {
  id: number;
  exprText: string;
  toks: Tok[];
  resultText: string;
  result: Value;
  mode: ModeId;
  ts: number;
}

export interface CalcErrorView {
  code: string;
  message: string;
  position: number | null;
}

export type LcdTheme = "classic" | "amber" | "night";

export interface CalcSettings extends DisplaySettings {
  lcd: LcdTheme;
  haptic: boolean;
}

export const DEFAULT_SETTINGS: CalcSettings = {
  ...DEFAULT_DISPLAY,
  lcd: "classic",
  haptic: false,
};

export interface CalcState {
  mode: ModeId;
  tokens: Tok[];
  cursor: number;
  shift: boolean;
  alpha: boolean;
  settings: CalcSettings;
  vars: Record<string, Value | null>;
  ans: Value;
  result: ResultView | null;
  error: CalcErrorView | null;
  history: HistoryEntry[];
  historyIdx: number | null;
  undo: { tokens: Tok[]; cursor: number }[];
  stoPending: boolean;
  flash: string | null;
  basenRadix: Radix;
  matrices: Record<string, number[][] | null>;
  vectors: Record<string, number[] | null>;
  version: number; // bump on every change (renders)
}

const EMPTY_VARS: Record<string, Value | null> = {
  A: null, B: null, C: null, D: null, E: null, F: null, X: null, Y: null, M: null,
};

export function initialState(): CalcState {
  return {
    mode: "calc",
    tokens: [],
    cursor: 0,
    shift: false,
    alpha: false,
    settings: DEFAULT_SETTINGS,
    vars: { ...EMPTY_VARS },
    ans: intVal(0),
    result: null,
    error: null,
    history: [],
    historyIdx: null,
    undo: [],
    stoPending: false,
    flash: null,
    basenRadix: "dec",
    matrices: { MatA: null, MatB: null, MatC: null, MatD: null },
    vectors: { VctA: null, VctB: null, VctC: null, VctD: null },
    version: 1,
  };
}

/* ------------------------------------------------------------------ */
/* token shaping: merge digit runs into number tokens                  */
/* ------------------------------------------------------------------ */

export interface ShapedTok extends Tok {
  r: number; // raw start index in the editing token array
}

/** merge adjacent single-char digit/dot tokens into a number token */
export function shapeTokens(toks: Tok[]): ShapedTok[] {
  const out: ShapedTok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === "num") {
      const start = i;
      let raw = t.s;
      while (i + 1 < toks.length && toks[i + 1].t === "num") {
        raw += toks[i + 1].s;
        i++;
      }
      out.push({ t: "num", s: raw, r: start });
    } else {
      out.push({ ...t, r: i });
    }
  }
  return out;
}

/** readable source line for a token list (history / aria) */
export function tokensToSource(toks: Tok[]): string {
  const shaped = shapeTokens(toks);
  let out = "";
  for (const t of shaped) {
    switch (t.t) {
      case "num": out += t.s; break;
      case "var": out += t.s; break;
      case "const": out += t.s === "pi" ? "π" : t.s === "e" ? "e" : "i"; break;
      case "op":
        out += (
          t.s === "*" ? "×" :
          t.s === "/" ? "÷" :
          t.s === "-" ? "−" :
          t.s === "+" ? "+" :
          t.s === "^" ? "^" :
          t.s === "E10" ? "×10^(" :
          t.s === "angle" ? "∠" :
          t.s === "P" ? " nPr " :
          t.s === "C" ? " nCr " :
          ` ${t.s} `
        );
        break;
      case "post": out += t.s === "sq" ? "²" : t.s === "cube" ? "³" : t.s === "recip" ? "⁻¹" : t.s; break;
      case "func": out += FUNC_TEXT[t.s] ?? t.s; break;
      case "lp": out += "("; break;
      case "rp": out += ")"; break;
      case "comma": out += ","; break;
      case "dms": out += "°"; break;
      case "mixed": out += "⌟"; break;
    }
  }
  return out;
}

const FUNC_TEXT: Record<string, string> = {
  asin: "sin⁻¹(", acos: "cos⁻¹(", atan: "tan⁻¹(",
  asinh: "sinh⁻¹(", acosh: "cosh⁻¹(", atanh: "tanh⁻¹(",
  sqrt: "√(", cbrt: "∛(", xroot: "√(", logb: "log(",
  exp10: "10^(", expe: "e^(", sigma: "Σ(",
  "ran#": "Ran#", ranint: "RanInt#(", primefact: "FACT(",
};

/* ------------------------------------------------------------------ */
/* value serialization (persistence-safe)                              */
/* ------------------------------------------------------------------ */

type SerValue =
  | { kind: "num"; real: number; frac: { n: number; d: number } | null }
  | { kind: "complex"; re: number; im: number }
  | { kind: "matrix"; m: number[][] }
  | { kind: "vector"; v: number[] }
  | { kind: "text"; s: string };

export function serializeValue(v: Value): SerValue {
  switch (v.kind) {
    case "num": return { kind: "num", real: v.real, frac: v.frac ? { n: v.frac.n, d: v.frac.d } : null };
    case "complex": return { kind: "complex", re: v.z.re, im: v.z.im };
    case "matrix": return { kind: "matrix", m: v.m };
    case "vector": return { kind: "vector", v: v.v };
    case "text": return { kind: "text", s: v.s };
  }
}

export function deserializeValue(v: SerValue): Value {
  switch (v.kind) {
    case "num": return { kind: "num", real: v.real, frac: v.frac ? new Fraction(v.frac.n, v.frac.d) : null };
    case "complex": return { kind: "complex", z: { re: v.re, im: v.im } };
    case "matrix": return { kind: "matrix", m: v.m };
    case "vector": return { kind: "vector", v: v.v };
    case "text": return { kind: "text", s: v.s };
  }
}

export interface Persisted {
  settings: CalcSettings;
  vars: Record<string, SerValue | null>;
  ans: SerValue;
  history: Array<Omit<HistoryEntry, "result"> & { result: SerValue }>;
  mode: ModeId;
  matrices: Record<string, number[][] | null>;
  vectors: Record<string, number[] | null>;
}

const STORAGE_KEY = "campusplus.calculator.v1";

export function saveState(s: CalcState): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const p: Persisted = {
      settings: s.settings,
      vars: Object.fromEntries(Object.entries(s.vars).map(([k, v]) => [k, v ? serializeValue(v) : null])),
      ans: serializeValue(s.ans),
      history: s.history.slice(0, 50).map((h) => ({ ...h, result: serializeValue(h.result) })),
      mode: s.mode,
      matrices: s.matrices,
      vectors: s.vectors,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — run in-memory */
  }
}

export function loadState(): Partial<CalcState> | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    return {
      settings: { ...DEFAULT_SETTINGS, ...p.settings },
      vars: Object.fromEntries(
        Object.entries(p.vars ?? {}).map(([k, v]) => [k, v ? deserializeValue(v) : null]),
      ),
      ans: p.ans ? deserializeValue(p.ans) : intVal(0),
      history: Array.isArray(p.history)
        ? p.history.map((h) => ({ ...h, result: deserializeValue(h.result) }))
        : [],
      mode: p.mode && MODES.some((m) => m.id === p.mode) ? p.mode : "calc",
      matrices: p.matrices ?? { MatA: null, MatB: null, MatC: null, MatD: null },
      vectors: p.vectors ?? { VctA: null, VctB: null, VctC: null, VctD: null },
    };
  } catch {
    return null;
  }
}

export function clearPersisted(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* engine environment                                                  */
/* ------------------------------------------------------------------ */

export function engineEnv(s: CalcState): EngineEnv {
  return {
    settings: s.settings,
    vars: {
      ...s.vars,
      Ans: s.ans,
      MatA: s.matrices.MatA ? { kind: "matrix", m: s.matrices.MatA } : null,
      MatB: s.matrices.MatB ? { kind: "matrix", m: s.matrices.MatB } : null,
      MatC: s.matrices.MatC ? { kind: "matrix", m: s.matrices.MatC } : null,
      MatD: s.matrices.MatD ? { kind: "matrix", m: s.matrices.MatD } : null,
      VctA: s.vectors.VctA ? { kind: "vector", v: s.vectors.VctA } : null,
      VctB: s.vectors.VctB ? { kind: "vector", v: s.vectors.VctB } : null,
      VctC: s.vectors.VctC ? { kind: "vector", v: s.vectors.VctC } : null,
      VctD: s.vectors.VctD ? { kind: "vector", v: s.vectors.VctD } : null,
    },
    complexMode: s.mode === "complex",
  };
}

const ENGINE_MODES: ModeId[] = ["calc", "complex", "matrix", "vector"];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const bump = (s: CalcState): CalcState => ({ ...s, version: s.version + 1 });

function pushUndo(s: CalcState): CalcState {
  const undo = [...s.undo.slice(-49), { tokens: s.tokens, cursor: s.cursor }];
  return { ...s, undo };
}

/** split multi-char num tokens into single digits for editing granularity */
export function editorTokens(toks: Tok[]): Tok[] {
  const out: Tok[] = [];
  for (const t of toks) {
    if (t.t === "num" && t.s.length > 1) {
      for (const ch of t.s) out.push(tok("num", ch));
    } else out.push({ ...t });
  }
  return out;
}

function tokensFromSource(src: string): Tok[] {
  return editorTokens(tokenize(src));
}

function chainStart(s: CalcState, insertToks: Tok[]): CalcState {
  // After a result: binary operators continue from Ans; other input starts fresh.
  if (!s.result) return s;
  const first = insertToks[0];
  const chains =
    first.t === "op" && ["+", "-", "*", "/", "^", "E10", "angle", "P", "C", "gcd", "lcm", "and", "or", "xor", "xnor"].includes(first.s);
  if (chains) return pushUndo({ ...s, tokens: [tok("var", "Ans")], cursor: 1, result: null, error: null });
  if (first.t === "post") {
    return pushUndo({ ...s, tokens: [], cursor: 0 }) ;
  }
  return pushUndo({ ...s, tokens: [], cursor: 0, result: null, error: null });
}

export function insertTokens(s: CalcState, insertToks: Tok[]): CalcState {
  let st = chainStart(s, insertToks);
  const first = insertToks[0];
  // postfix with empty fresh input → apply to Ans (hardware behavior)
  if (st.tokens.length === 0 && first.t === "post") {
    st = { ...st, tokens: [tok("var", "Ans")], cursor: 1, result: null, error: null };
  }
  const at = st.cursor;
  // ')' / ',' skip: pressing ) when next token is already ) or ',' just moves past it
  if (first.t === "rp" && insertToks.length === 1 && at < st.tokens.length) {
    const nxt = st.tokens[at];
    if (nxt.t === "rp" || nxt.t === "comma") {
      return bump({ ...st, cursor: at + 1, shift: false, alpha: false });
    }
  }
  const tokens = [...st.tokens.slice(0, at), ...insertToks, ...st.tokens.slice(at)];
  return bump({ ...st, tokens, cursor: at + insertToks.length, error: null });
}

/* ------------------------------------------------------------------ */
/* execution                                                           */
/* ------------------------------------------------------------------ */

let historySeq = 1;

/** hardware behavior: EXE auto-closes unclosed '(' groups */
function balanceTokens(toks: Tok[]): Tok[] {
  let open = 0;
  for (const t of toks) {
    if (t.t === "lp") open++;
    if (t.t === "rp") open = Math.max(0, open - 1);
  }
  if (open === 0) return toks;
  const out = [...toks];
  for (let i = 0; i < open; i++) out.push(tok("rp", ")"));
  return out;
}

export function execute(s: CalcState): CalcState {
  if (s.tokens.length === 0 && !s.result) return s; // nothing
  const balanced = balanceTokens(s.tokens);
  const st = { ...s, tokens: balanced, cursor: Math.min(s.cursor, balanced.length) };
  if (st.tokens.length === 0) return s;

  if (s.mode === "basen") {
    const r = evalBaseN(shapeTokens(st.tokens), s.basenRadix);
    if (!r.ok || r.value === undefined) {
      return bump({ ...st, error: { code: r.code ?? "MATH", message: r.message ?? "Math ERROR", position: null }, result: null });
    }
    const value = intVal(r.value);
    const text = formatBase(r.value, s.basenRadix);
    const result: ResultView = {
      value,
      text,
      hasAlt: false,
      showAlt: false,
      overrideNodes: [{ t: "text", s: text }],
      overrideText: text,
    };
    const entry: HistoryEntry = {
      id: historySeq++,
      exprText: tokensToSource(st.tokens) || "(empty)",
      toks: st.tokens,
      resultText: text + ` (${s.basenRadix.toUpperCase()})`,
      result: value,
      mode: s.mode,
      ts: Date.now(),
    };
    return bump({
      ...st,
      result,
      error: null,
      ans: value,
      history: [entry, ...st.history].slice(0, 50),
      historyIdx: null,
    });
  }

  if (!ENGINE_MODES.includes(s.mode)) return s; // editor-driven modes

  const outcome = calculate(shapeTokens(st.tokens), engineEnv(s));
  if (!outcome.ok) {
    return bump({
      ...st,
      error: { code: outcome.code, message: outcome.message, position: outcome.position },
      result: null,
    });
  }
  const result: ResultView = {
    value: outcome.value,
    text: outcome.standard.text,
    hasAlt: outcome.alternate !== null,
    showAlt: false,
    overrideNodes: null,
    overrideText: null,
  };
  const entry: HistoryEntry = {
    id: historySeq++,
    exprText: tokensToSource(st.tokens),
    toks: st.tokens,
    resultText: outcome.standard.text,
    result: outcome.value,
    mode: s.mode,
    ts: Date.now(),
  };
  return bump({
    ...st,
    result,
    error: null,
    ans: outcome.value,
    vars: { ...st.vars, Ans: outcome.value },
    history: [entry, ...st.history].slice(0, 50),
    historyIdx: null,
  });
}

/* ------------------------------------------------------------------ */
/* main key reducer                                                    */
/* ------------------------------------------------------------------ */

export function pressKey(state: CalcState, keyId: string): CalcState {
  let s = state;

  // hardware modifiers (kept armed across STO-pending like the real device)
  if (keyId === "shift") return bump({ ...s, shift: !s.shift, alpha: false });
  if (keyId === "alpha") return bump({ ...s, alpha: !s.alpha, shift: false });

  // nav & control keys (not layered)
  switch (keyId) {
    case "nav-left": return navLeft(s);
    case "nav-right": return navRight(s);
    case "nav-up": return replay(s, -1);
    case "nav-down": return replay(s, 1);
    case "ok":
    case "exe": return consumeModifiers(execute(s));
    case "format": {
      if (!s.result || !s.result.hasAlt) return s;
      return bump({ ...s, result: { ...s.result, showAlt: !s.result.showAlt } });
    }
    case "sto":
      return bump({ ...s, stoPending: true, flash: s.result ? "value → ?" : "Ans → ?", shift: false, alpha: false });
    default:
      break;
  }

  const def = KEY_BY_ID[keyId];
  if (!def) return s;

  let effect: KeyEffect | undefined;
  if (s.alpha && def.alpha) effect = def.alpha;
  else if (s.shift && def.shift) effect = def.shift;
  else effect = def.base;
  if (!effect) return consumeModifiers(s);

  // STO capture: a variable key press while stoPending stores into the variable
  if (s.stoPending) {
    if (effect.kind === "insert" && effect.toks.length === 1 && effect.toks[0].t === "var") {
      const name = effect.toks[0].s as VarName;
      if (["A", "B", "C", "D", "E", "F", "X", "Y", "M"].includes(name)) {
        return storeVariable(s, name);
      }
    }
    return bump({ ...s, stoPending: false, flash: null });
  }

  s = { ...s, shift: false, alpha: false };

  switch (effect.kind) {
    case "insert":
      return insertTokens(s, effect.toks);
    case "insertFn": {
      // functions open a template; cursor lands right after the '('
      const toks = buildFnTokens(effect.name);
      const st = chainStart(s, toks);
      const pos = st.cursor;
      const merged = [...st.tokens.slice(0, pos), ...toks, ...st.tokens.slice(pos)];
      const offset = effect.name === "ran#" ? toks.length : 2;
      return bump({ ...st, tokens: merged, cursor: pos + offset, error: null });
    }
    case "action":
      return runAction(s, effect.action);
    default:
      return s;
  }
}

const consumeModifiers = (s: CalcState): CalcState =>
  s.shift || s.alpha ? bump({ ...s, shift: false, alpha: false }) : s;

function buildFnTokens(name: string): Tok[] {
  const twoArg = ["logb", "xroot", "ranint", "pol", "rec", "dot", "cross", "vangle"];
  if (name === "ran#") return [tok("func", name)];
  if (twoArg.includes(name)) {
    // skeleton: name(□,□) with cursor after '('; )/,-skip moves past comma
    return [tok("func", name), tok("lp", "("), tok("comma", ","), tok("rp", ")")];
  }
  if (name === "sigma") {
    return [tok("func", name), tok("lp", "("), tok("comma", ","), tok("comma", ","), tok("rp", ")")];
  }
  if (name === "integ") {
    return [tok("func", name), tok("lp", "("), tok("comma", ","), tok("comma", ","), tok("rp", ")")];
  }
  return [tok("func", name), tok("lp", "(")];
}

function navLeft(s: CalcState): CalcState {
  if (s.error && s.error.position !== null) {
    const pos = Math.max(0, Math.min(s.error.position, s.tokens.length));
    return bump({ ...s, cursor: pos, error: null });
  }
  return bump({ ...s, cursor: Math.max(0, s.cursor - 1), stoPending: false });
}
function navRight(s: CalcState): CalcState {
  return bump({ ...s, cursor: Math.min(s.tokens.length, s.cursor + 1), stoPending: false });
}

function replay(s: CalcState, dir: -1 | 1): CalcState {
  if (s.history.length === 0) return s;
  let idx = s.historyIdx;
  if (idx === null) idx = dir === -1 ? 0 : s.history.length - 1;
  else idx = idx + (dir === -1 ? 1 : -1);
  if (idx < 0 || idx >= s.history.length) return s; // stop at ends
  const entry = s.history[idx];
  const tokens = editorTokens(entry.toks);
  return pushIntoEditing(s, tokens, idx);
}

function pushIntoEditing(s: CalcState, tokens: Tok[], idx: number | null): CalcState {
  const st = pushUndo({ ...s, result: null, error: null, historyIdx: idx });
  return bump({ ...st, tokens, cursor: tokens.length, stoPending: false, flash: null });
}

/** replay a specific history entry into the editing line */
export function replayEntry(s: CalcState, entry: HistoryEntry): CalcState {
  const idx = s.history.findIndex((h) => h.id === entry.id);
  return pushIntoEditing(s, editorTokens(entry.toks), idx === -1 ? null : idx);
}

export function clearVars(s: CalcState): CalcState {
  return bump({ ...s, vars: { ...EMPTY_VARS }, ans: intVal(0), flash: "Variables cleared" });
}

export function clearMatricesVectors(s: CalcState): CalcState {
  return bump({
    ...s,
    matrices: { MatA: null, MatB: null, MatC: null, MatD: null },
    vectors: { VctA: null, VctB: null, VctC: null, VctD: null },
    flash: "Matrices & vectors cleared",
  });
}

export function setMatrix(s: CalcState, name: string, m: number[][] | null): CalcState {
  return bump({ ...s, matrices: { ...s.matrices, [name]: m }, flash: m ? `${name} saved` : `${name} cleared` });
}

export function setVector(s: CalcState, name: string, v: number[] | null): CalcState {
  return bump({ ...s, vectors: { ...s.vectors, [name]: v }, flash: v ? `${name} saved` : `${name} cleared` });
}

export function setBasenRadix(s: CalcState, radix: Radix): CalcState {
  return bump({ ...s, basenRadix: radix, result: null, error: null });
}

function storeVariable(s: CalcState, name: VarName): CalcState {
  let value: Value | null = null;
  if (s.result) {
    value = s.result.value;
  } else if (s.tokens.length > 0 && ENGINE_MODES.includes(s.mode)) {
    const outcome = calculate(shapeTokens(s.tokens), engineEnv(s));
    if (!outcome.ok) {
      return bump({ ...s, stoPending: false, flash: "Can't store: " + outcome.message });
    }
    value = outcome.value;
  } else {
    value = s.ans;
  }
  const text = valueToText(value, s.settings);
  return bump({
    ...s,
    vars: { ...s.vars, [name]: value },
    stoPending: false,
    flash: `${text} → ${name}`,
  });
}

function runAction(s: CalcState, action: string): CalcState {
  switch (action) {
    case "sto":
      return bump({ ...s, stoPending: true, flash: s.result ? "value → ?" : "Ans → ?" });
    case "del": {
      if (s.cursor === 0) return s;
      const st = pushUndo(s);
      const tokens = [...st.tokens.slice(0, st.cursor - 1), ...st.tokens.slice(st.cursor)];
      return bump({ ...st, tokens, cursor: st.cursor - 1, error: null });
    }
    case "ac": {
      if (s.tokens.length === 0 && !s.result && !s.error) return s;
      const st = pushUndo(s);
      return bump({ ...st, tokens: [], cursor: 0, result: null, error: null, historyIdx: null });
    }
    case "undo": {
      const last = s.undo[s.undo.length - 1];
      if (!last) return bump({ ...s, flash: "Nothing to undo" });
      const undo = s.undo.slice(0, -1);
      return bump({ ...s, undo, tokens: last.tokens, cursor: last.cursor, result: null, error: null });
    }
    case "clrall": {
      const st = pushUndo(s);
      return bump({
        ...st,
        tokens: [], cursor: 0, result: null, error: null,
        vars: { ...EMPTY_VARS }, ans: intVal(0),
        matrices: { MatA: null, MatB: null, MatC: null, MatD: null },
        vectors: { VctA: null, VctB: null, VctC: null, VctD: null },
        flash: "Variables & matrices cleared",
      });
    }
    case "dms-conv": {
      if (!s.result) return s;
      const v = s.result.value;
      if (v.kind === "num") {
        const nodes = dmsNodes(v.real, s.settings);
        const text = valueToText(v, s.settings);
        return bump({
          ...s,
          result: { ...s.result, overrideNodes: nodes, overrideText: text },
          flash: "Deg°Min′Sec″",
        });
      }
      return bump({ ...s, flash: "DMS needs a real value" });
    }
    case "exe":
      return execute(s);
    default:
      return s;
  }
}

/** change mode — keeps variables/Ans/history (hardware behavior) */
export function setMode(s: CalcState, mode: ModeId): CalcState {
  const st = pushUndo({ ...s, result: null, error: null });
  return bump({ ...st, mode, tokens: [], cursor: 0, shift: false, alpha: false, stoPending: false, historyIdx: null });
}

export function setAngleUnit(s: CalcState, angle: "deg" | "rad" | "grad"): CalcState {
  const settings = { ...s.settings, angle };
  return bump({ ...s, settings });
}

export function clearHistory(s: CalcState): CalcState {
  return bump({ ...s, history: [], historyIdx: null, flash: "History cleared" });
}

export function updateSettings(s: CalcState, patch: Partial<CalcSettings>): CalcState {
  const merged = { ...s.settings, ...patch };
  if (patch.numFormat !== undefined && s.settings.numFormat !== patch.numFormat) {
    merged.numFormat = { ...s.settings.numFormat, ...patch.numFormat };
  }
  return bump({ ...s, settings: merged });
}

/* ---------------- quick utilities used by tests & UI --------------- */

export function typeKeys(s: CalcState, keys: string[]): CalcState {
  let st = s;
  for (const k of keys) st = pressKey(st, k);
  return st;
}

/** map printable keyboard text to key ids (physical keyboard path) */
export function keyIdForChar(ch: string): string | null {
  if (/[0-9]/.test(ch)) return "d" + ch;
  switch (ch) {
    case ".": return "dot";
    case "+": return "add";
    case "-": return "sub";
    case "*": case "x": return "mul";
    case "/": return "div";
    case "^": return "pow";
    case "(": return "lp";
    case ")": return "rp";
    case "!": return "fact";
    case "√": return "sqrt";
    case "π": return "pi";
    default: return null;
  }
}

export { cleanFloat, realToNodes };
