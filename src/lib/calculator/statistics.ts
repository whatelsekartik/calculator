/**
 * Statistics: 1-variable, 2-variable (with optional frequency column),
 * and the regression set found on ClassWiz-style devices.
 */

import { errMath, errRange } from "./core";
import { solveLinearSystem } from "./solvers";

export interface DataRow {
  x: number;
  y: number | null;
  f: number; // frequency, integer ≥ 1
}

export interface VarSummary {
  n: number;
  sum: number;
  sumSq: number;
  mean: number;
  varPop: number;
  sdPop: number;
  varSample: number;
  sdSample: number;
  min: number;
  q1: number;
  med: number;
  q3: number;
  max: number;
}

function expand(rows: DataRow[], pick: (r: DataRow) => number): number[] {
  const out: number[] = [];
  for (const r of rows) {
    for (let i = 0; i < r.f; i++) out.push(pick(r));
  }
  return out.sort((a, b) => a - b);
}

function quantile(sorted: number[], q: number): number {
  // Casio method: median of halves (median excluded for odd counts)
  const n = sorted.length;
  if (n === 0) throw errMath("No data");
  const pos = q * (n - 1);
  // For Q1/Q3 Casio uses halves medians; approximate via linear interpolation ?No—use halves:
  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));
  const med = (arr: number[]): number => {
    const m = arr.length;
    if (m === 0) return sorted[Math.floor(pos)] ?? 0;
    return m % 2 === 1 ? arr[(m - 1) / 2] : (arr[m / 2 - 1] + arr[m / 2]) / 2;
  };
  if (q === 0.25) return med(lowerHalf);
  if (q === 0.75) return med(upperHalf);
  return med(sorted);
}

export function varSummary(rows: DataRow[], pick: (r: DataRow) => number): VarSummary {
  const total = rows.reduce((acc, r) => acc + r.f, 0);
  if (total === 0) throw errMath("No data");
  if (total > 5000) throw errRange("Frequencies too large");
  let sum = 0;
  let sumSq = 0;
  for (const r of rows) {
    const v = pick(r);
    sum += v * r.f;
    sumSq += v * v * r.f;
  }
  const mean = sum / total;
  const varPop = Math.max(0, sumSq / total - mean * mean);
  const varSample = total > 1 ? Math.max(0, (sumSq - (sum * sum) / total) / (total - 1)) : 0;
  const all = expand(rows, pick);
  return {
    n: total,
    sum,
    sumSq,
    mean,
    varPop,
    sdPop: Math.sqrt(varPop),
    varSample,
    sdSample: Math.sqrt(varSample),
    min: all[0],
    q1: quantile(all, 0.25),
    med: quantile(all, 0.5),
    q3: quantile(all, 0.75),
    max: all[all.length - 1],
  };
}

export const oneVarStats = (rows: DataRow[]): VarSummary => varSummary(rows, (r) => r.x);

export interface TwoVarStats {
  x: VarSummary;
  y: VarSummary;
  sumXY: number;
  r: number; // correlation coefficient
}

export function twoVarStats(rows: DataRow[]): TwoVarStats {
  const ys = rows.filter((r) => r.y !== null);
  if (ys.length === 0) throw errMath("No paired data");
  const xs = varSummary(ys, (r) => r.x);
  const ysu = varSummary(ys, (r) => r.y as number);
  let sumXY = 0;
  for (const r of ys) sumXY += r.x * (r.y as number) * r.f;
  const cov = sumXY / xs.n - xs.mean * ysu.mean;
  const denom = xs.sdPop * ysu.sdPop;
  return { x: xs, y: ysu, sumXY, r: denom > 0 ? Math.max(-1, Math.min(1, cov / denom)) : 0 };
}

/* ------------------------------------------------------------------ */
/* Regressions                                                         */
/* ------------------------------------------------------------------ */

export type RegressionModel = "linear" | "quad" | "log" | "exp" | "abexp" | "power" | "inv";

export interface RegressionResult {
  model: RegressionModel;
  valid: boolean;
  a?: number;
  b?: number;
  c?: number;
  r?: number;
  reason?: string;
  /** display equation hint */
  form: string;
}

export const REGRESSION_FORMS: Record<RegressionModel, string> = {
  linear: "y = a + bx",
  quad: "y = a + bx + cx²",
  log: "y = a + b·ln(x)",
  exp: "y = a·e^(bx)",
  abexp: "y = a·b^x",
  power: "y = a·x^b",
  inv: "y = a + b/x",
};

function linfit(xs: number[], ys: number[], fs: number[]): { a: number; b: number; r: number } {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    const f = fs[i];
    n += f;
    sx += xs[i] * f;
    sy += ys[i] * f;
    sxx += xs[i] * xs[i] * f;
    syy += ys[i] * ys[i] * f;
    sxy += xs[i] * ys[i] * f;
  }
  const denomX = n * sxx - sx * sx;
  if (Math.abs(denomX) < 1e-20) throw errMath("x values have zero variance");
  const b = (n * sxy - sx * sy) / denomX;
  const a = (sy - b * sx) / n;
  const denomY = n * syy - sy * sy;
  const r = denomY > 0 ? Math.max(-1, Math.min(1, (n * sxy - sx * sy) / Math.sqrt(denomX * denomY))) : 0;
  return { a, b, r };
}

export function computeRegression(rows: DataRow[], model: RegressionModel): RegressionResult {
  const valid = rows.filter((r) => r.y !== null);
  const form = REGRESSION_FORMS[model];
  const fail = (reason: string): RegressionResult => ({ model, valid: false, reason, form });
  if (valid.length < (model === "quad" ? 3 : 2)) return fail("Not enough data points");
  const xs = valid.map((r) => r.x);
  const ys = valid.map((r) => r.y as number);
  const fs = valid.map((r) => r.f);
  try {
    switch (model) {
      case "linear": {
        const { a, b, r } = linfit(xs, ys, fs);
        return { model, valid: true, a, b, r, form };
      }
      case "log": {
        if (xs.some((x) => x <= 0)) return fail("All x must be > 0");
        const lx = xs.map(Math.log);
        const { a, b, r } = linfit(lx, ys, fs);
        return { model, valid: true, a, b, r, form };
      }
      case "exp": {
        if (ys.some((y) => y <= 0)) return fail("All y must be > 0");
        const ly = ys.map(Math.log);
        const { a, b, r } = linfit(xs, ly, fs);
        return { model, valid: true, a: Math.exp(a), b, r, form };
      }
      case "abexp": {
        if (ys.some((y) => y <= 0)) return fail("All y must be > 0");
        const ly = ys.map(Math.log);
        const { a, b, r } = linfit(xs, ly, fs);
        return { model, valid: true, a: Math.exp(a), b: Math.exp(b), r, form };
      }
      case "power": {
        if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) return fail("All x,y must be > 0");
        const lx = xs.map(Math.log);
        const ly = ys.map(Math.log);
        const { a, b, r } = linfit(lx, ly, fs);
        return { model, valid: true, a: Math.exp(a), b, r, form };
      }
      case "inv": {
        if (xs.some((x) => x === 0)) return fail("All x must be ≠ 0");
        const ix = xs.map((x) => 1 / x);
        const { a, b, r } = linfit(ix, ys, fs);
        return { model, valid: true, a, b, r, form };
      }
      case "quad": {
        // normal equations for y = a + bx + cx²
        let n = 0;
        let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0;
        for (let i = 0; i < xs.length; i++) {
          const f = fs[i];
          const x = xs[i];
          const y = ys[i];
          const x2 = x * x;
          n += f;
          sx += x * f;
          sx2 += x2 * f;
          sx3 += x2 * x * f;
          sx4 += x2 * x2 * f;
          sy += y * f;
          sxy += x * y * f;
          sx2y += x2 * y * f;
        }
        const A = [
          [n, sx, sx2],
          [sx, sx2, sx3],
          [sx2, sx3, sx4],
        ];
        const sol = solveLinearSystem(A, [sy, sxy, sx2y]);
        if (sol.type !== "unique") return fail("Data cannot determine a unique quadratic");
        return { model, valid: true, a: sol.x[0], b: sol.x[1], c: sol.x[2], form };
      }
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Regression failed");
  }
}

/** predicted y for fitted model */
export function estimateY(result: RegressionResult, x: number): number | null {
  if (!result.valid || result.a === undefined || result.b === undefined) return null;
  switch (result.model) {
    case "linear": return result.a + result.b * x;
    case "quad": return result.a + result.b * x + (result.c ?? 0) * x * x;
    case "log": return x > 0 ? result.a + result.b * Math.log(x) : null;
    case "exp": return result.a * Math.exp(result.b * x);
    case "abexp": return result.a * Math.pow(result.b, x);
    case "power": return x > 0 ? result.a * Math.pow(x, result.b) : null;
    case "inv": return x !== 0 ? result.a + result.b / x : null;
  }
}

/** predicted x from y (quad unsupported — like the hardware) */
export function estimateX(result: RegressionResult, y: number): number | null {
  if (!result.valid || result.a === undefined || result.b === undefined) return null;
  const { a, b } = result;
  switch (result.model) {
    case "linear": return b !== 0 ? (y - a) / b : null;
    case "log": return b !== 0 ? Math.exp((y - a) / b) : null;
    case "exp": case "abexp": {
      const ratio = y / a;
      const base = result.model === "exp" ? Math.E : b;
      return ratio > 0 && base > 0 && base !== 1 ? Math.log(ratio) / Math.log(base) : null;
    }
    case "power": {
      const ratio = y / a;
      return ratio > 0 && b !== 0 ? Math.pow(ratio, 1 / b) : null;
    }
    case "inv": return y !== a ? b / (y - a) : null;
    case "quad": return null;
  }
}
