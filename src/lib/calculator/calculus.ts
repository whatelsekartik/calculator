/**
 * Numerical calculus: definite integration (adaptive Simpson),
 * differentiation (4th-order central difference), function tables.
 * These are numeric approximations — flagged as such to the user.
 */

import { Value, asReal, errMath, errRange, cleanFloat } from "./core";
import { tokenize, parseTokens, Tok } from "./parser";
import { evaluate, EvalCtx } from "./evaluator";

/** Compile an expression string like "x^2+2x+1" into a function of X. */
export function compileFunction(
  src: string,
  vars: Record<string, Value | null>,
  angle: "deg" | "rad" | "grad",
): (x: number) => number {
  const toks = tokenize(src);
  return compileFunctionFromTokens(toks, vars, angle);
}

/** Compile current input tokens (already shaped) into a function of X. */
export function compileFunctionFromTokens(
  toks: Tok[],
  vars: Record<string, Value | null>,
  angle: "deg" | "rad" | "grad",
): (x: number) => number {
  const ast = parseTokens(toks, false);
  return (x: number): number => {
    const ctx: EvalCtx = {
      angle,
      vars: { ...vars, X: { kind: "num", real: x, frac: null } },
      complexMode: false,
      rand: Math.random,
    };
    return asReal(evaluate(ast, ctx));
  };
}

/** Adaptive Simpson integration with tolerance control. */
export function integrate(f: (x: number) => number, a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw errMath("Bounds must be finite");
  if (a === b) return 0;
  if (a > b) return -integrate(f, b, a);
  const evalSafe = (x: number): number => {
    const v = f(x);
    if (!Number.isFinite(v)) throw errMath("Function is not finite within the bounds");
    return v;
  };
  const simpson = (fa: number, fm: number, fb: number, a2: number, b2: number): number =>
    ((b2 - a2) / 6) * (fa + 4 * fm + fb);

  let fa = evalSafe(a);
  let fb = evalSafe(b);
  let m = (a + b) / 2;
  let fm = evalSafe(m);
  let whole = simpson(fa, fm, fb, a, b);

  const tol = 1e-9;
  const maxDepth = 16;

  const rec = (a2: number, b2: number, fa2: number, fm2: number, fb2: number, S: number, depth: number): number => {
    const m2 = (a2 + b2) / 2;
    const lm = (a2 + m2) / 2;
    const rm = (m2 + b2) / 2;
    const flm = evalSafe(lm);
    const frm = evalSafe(rm);
    const left = simpson(fa2, flm, fm2, a2, m2);
    const right = simpson(fm2, frm, fb2, m2, b2);
    const delta = left + right - S;
    if (depth <= 0 || Math.abs(delta) <= 15 * tol * Math.max(1, Math.abs(left + right))) {
      return left + right + delta / 15;
    }
    return (
      rec(a2, m2, fa2, flm, fm2, left, depth - 1) +
      rec(m2, b2, fm2, frm, fb2, right, depth - 1)
    );
  };

  const result = rec(a, b, fa, fm, fb, whole, maxDepth);
  return cleanFloat(result);
}

/** 4th-order central difference derivative — a numerical approximation. */
export function derivative(f: (x: number) => number, x: number): number {
  if (!Number.isFinite(x)) throw errMath("Point must be finite");
  const evalSafe = (v: number): number => {
    const y = f(v);
    if (!Number.isFinite(y)) throw errMath("Function not finite near the point");
    return y;
  };
  let h = 1e-4 * Math.max(1, Math.abs(x));
  let prev = Infinity;
  for (let attempt = 0; attempt < 6; attempt++) {
    const d =
      (evalSafe(x - 2 * h) - 8 * evalSafe(x - h) + 8 * evalSafe(x + h) - evalSafe(x + 2 * h)) /
      (12 * h);
    if (Math.abs(d - prev) < Math.max(1e-10, 1e-8 * Math.abs(d))) return cleanFloat(d);
    prev = d;
    h /= 2;
  }
  return cleanFloat(prev);
}

export interface TableRow {
  x: number;
  fx: number | null;
  gx: number | null;
}

export function tableValues(
  f: (x: number) => number,
  g: ((x: number) => number) | null,
  start: number,
  end: number,
  step: number,
): TableRow[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step)) {
    throw errMath("Start/End/Step must be finite");
  }
  if (step === 0) throw errMath("Step cannot be 0");
  const span = end - start;
  const count = Math.floor(span / step) + 1;
  if (count <= 0 || span / step < 0) throw errMath("Step sign must match the Start→End direction");
  if (count > 45) throw errRange("Table is limited to 45 rows — increase the step");
  const rows: TableRow[] = [];
  for (let i = 0; i < count; i++) {
    const x = cleanFloat(start + i * step);
    let fx: number | null = null;
    let gx: number | null = null;
    try {
      fx = cleanFloat(f(x));
      if (!Number.isFinite(fx)) fx = null;
    } catch {
      fx = null;
    }
    if (g) {
      try {
        gx = cleanFloat(g(x));
        if (!Number.isFinite(gx)) gx = null;
      } catch {
        gx = null;
      }
    }
    rows.push({ x, fx, gx });
  }
  return rows;
}
