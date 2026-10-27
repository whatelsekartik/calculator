/**
 * Engine facade: token list / source string -> evaluated, formatted result.
 * Separates raw value, exact fraction twin, and display representations.
 */

import { CalcError, ErrorCode, Value, decimalToFraction, Fraction, cleanFloat } from "./core";
import { evaluate, EvalCtx } from "./evaluator";
import { parseTokens, tokenize, Tok, Ast } from "./parser";
const strictParse = parseTokens;
import { DisplaySettings, valueToNodes, valueToText } from "./format";
import { DNode, astToNodes } from "./display";

export interface EngineEnv {
  settings: DisplaySettings;
  vars: Record<string, Value | null>;
  complexMode: boolean;
  rand?: () => number;
}

export interface CalcSuccess {
  ok: true;
  value: Value;
  standard: { nodes: DNode[]; text: string };
  alternate: { nodes: DNode[]; text: string } | null;
}

export interface CalcFailure {
  ok: false;
  code: ErrorCode;
  message: string;
  position: number | null;
}

export type CalcOutcome = CalcSuccess | CalcFailure;

function buildAlternate(value: Value, s: DisplaySettings): { nodes: DNode[]; text: string } | null {
  if (value.kind === "num" && value.frac && value.frac.d !== 1) {
    return {
      nodes: valueToNodes(value, s, true),
      text: valueToText(value, s, true),
    };
  }
  if (value.kind === "num" && !value.frac && value.real !== 0) {
    const f = decimalToFraction(cleanFloat(value.real));
    if (f && f.d !== 1 && f.d < 1e6) {
      const altVal: Value = { kind: "num", real: value.real, frac: f };
      return { nodes: valueToNodes(altVal, s), text: `${f.n}/${f.d}` };
    }
  }
  if (value.kind === "complex" && Math.abs(value.z.im) >= 1e-14) {
    const other: DisplaySettings = {
      ...s,
      complexForm: s.complexForm === "polar" ? "rect" : "polar",
    };
    return { nodes: valueToNodes(value, other), text: valueToText(value, other) };
  }
  return null;
}

export function calculate(toks: Tok[], env: EngineEnv): CalcOutcome {
  try {
    if (toks.length === 0) throw new CalcError("SYNTAX", "Nothing to calculate", 0);
    const ast: Ast = parseTokens(toks, false);
    const ctx: EvalCtx = {
      angle: env.settings.angle,
      vars: env.vars,
      complexMode: env.complexMode,
      rand: env.rand ?? Math.random,
    };
    const value = evaluate(ast, ctx);
    const s = env.settings;
    return {
      ok: true,
      value,
      standard: {
        nodes: valueToNodes(value, s),
        text: valueToText(value, s),
      },
      alternate: buildAlternate(value, s),
    };
  } catch (e) {
    if (e instanceof CalcError) {
      return { ok: false, code: e.code, message: e.message, position: e.position };
    }
    return { ok: false, code: "MATH", message: "Math ERROR", position: null };
  }
}

export function calculateString(src: string, env: EngineEnv): CalcOutcome {
  let toks: Tok[];
  try {
    toks = tokenize(src);
  } catch (e) {
    if (e instanceof CalcError) {
      return { ok: false, code: e.code, message: e.message, position: e.position };
    }
    throw e;
  }
  return calculate(toks, env);
}

/** convenience: evaluate source string and return the raw value (throws CalcError) */
export function evaluateToValue(src: string, env: Omit<EngineEnv, "settings"> & { settings?: DisplaySettings }): Value {
  const toks = tokenize(src);
  const ast = strictParse(toks, false);
  return evaluate(ast, {
    angle: env.settings?.angle ?? "deg",
    vars: env.vars,
    complexMode: env.complexMode,
    rand: env.rand ?? Math.random,
  });
}

export { astToNodes, parseTokens, tokenize };
export type { Ast, Tok };
