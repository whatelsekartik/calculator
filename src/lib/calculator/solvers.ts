/**
 * Equation solving: simultaneous linear systems, polynomials (deg 1-4),
 * linear/quadratic/cubic inequalities, Newton–Raphson numeric solve.
 */

import { Complex, cx, errMath, errRange, cleanFloat } from "./core";

export type LinSolveResult =
  | { type: "unique"; x: number[] }
  | { type: "none" }
  | { type: "infinite" };

/** Solve A x = b for square A (n ≤ 6). Gaussian elimination with pivoting. */
export function solveLinearSystem(A: number[][], b: number[]): LinSolveResult {
  const n = A.length;
  if (n === 0 || A.some((row) => row.length !== n) || b.length !== n) {
    throw errMath("System must have n equations and n unknowns");
  }
  if (n > 6) throw errRange("Systems up to 6 unknowns supported");
  const M = A.map((row, i) => [...row, b[i]]);
  let rank = 0;
  for (let col = 0; col < n; col++) {
    let p = rank;
    for (let r = rank + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[p][col])) p = r;
    if (Math.abs(M[p][col]) < 1e-12) continue; // free variable
    [M[rank], M[p]] = [M[p], M[rank]];
    for (let r = 0; r < n; r++) {
      if (r === rank) continue;
      const f = M[r][col] / M[rank][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[rank][c];
    }
    rank++;
  }
  for (let r = 0; r < n; r++) {
    const allZero = M[r].slice(0, n).every((v) => Math.abs(v) < 1e-10);
    if (allZero && Math.abs(M[r][n]) > 1e-10) return { type: "none" };
  }
  if (rank < n) return { type: "infinite" };
  // back substitution (reduced form)
  const x = new Array<number>(n).fill(0);
  const pivotColForRow: number[] = [];
  let row = 0;
  for (let col = 0; col < n && row < n; col++, row++) {
    while (Math.abs(M[row][col]) < 1e-12 && col < n) col++;
    if (col >= n) break;
    pivotColForRow.push(col);
  }
  for (let r = 0; r < n; r++) {
    const col = pivotColForRow[r];
    if (col === undefined) break;
    x[col] = cleanFloat(M[r][n] / M[r][col]);
  }
  return { type: "unique", x };
}

/* ------------------------------------------------------------------ */
/* Polynomial roots                                                    */
/* ------------------------------------------------------------------ */

export interface PolyRoot {
  root: Complex;
  multiplicity: number;
}

export interface PolyResult {
  degree: number;
  roots: PolyRoot[];
  repeated: boolean;
  note?: string;
}

const cbrtR = (x: number): number => Math.cbrt(x);

function quadraticRoots(a: number, b: number, c: number): PolyRoot[] {
  const d = b * b - 4 * a * c;
  if (d > 1e-14 * Math.max(1, Math.abs(b * b))) {
    const sq = Math.sqrt(d);
    // numerically stable form
    const q = -0.5 * (b + Math.sign(b) * sq);
    const r1 = q / a;
    const r2 = c / q;
    return [
      { root: cx(cleanFloat(r1)), multiplicity: 1 },
      { root: cx(cleanFloat(r2)), multiplicity: 1 },
    ].sort((p, q2) => p.root.re - q2.root.re);
  }
  if (Math.abs(d) <= 1e-14 * Math.max(1, b * b)) {
    const r = cleanFloat(-b / (2 * a));
    return [{ root: cx(r), multiplicity: 2 }];
  }
  const re = cleanFloat(-b / (2 * a));
  const im = Math.sqrt(-d) / (2 * a);
  return [
    { root: cx(re, im), multiplicity: 1 },
    { root: cx(re, -im), multiplicity: 1 },
  ];
}

function cubicRoots(a: number, b: number, c: number, d: number): PolyRoot[] {
  // depressed cubic: t^3 + pt + q, x = t - b/(3a)
  const p = (3 * a * c - b * b) / (3 * a * a);
  const q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);
  const shift = -b / (3 * a);
  const disc = (q * q) / 4 + (p * p * p) / 27;
  const scale = Math.max(1, Math.abs(q * q) / 4, Math.abs(p * p * p) / 27);
  if (disc > 1e-12 * scale) {
    // one real, two complex
    const sq = Math.sqrt(disc);
    const u = cbrtR(-q / 2 + sq);
    const v = cbrtR(-q / 2 - sq);
    const re = -(u + v) / 2;
    const im = (Math.sqrt(3) / 2) * (u - v);
    return [
      { root: cx(cleanFloat(u + v + shift)), multiplicity: 1 },
      { root: cx(cleanFloat(re + shift), im), multiplicity: 1 },
      { root: cx(cleanFloat(re + shift), -im), multiplicity: 1 },
    ].sort((r1, r2) => r1.root.im - r2.root.im || r1.root.re - r2.root.re);
  }
  if (Math.abs(disc) <= 1e-12 * scale) {
    // multiple root
    const u = cbrtR(-q / 2);
    const r1 = cleanFloat(2 * u + shift);
    const r2 = cleanFloat(-u + shift);
    if (Math.abs(r1 - r2) < 1e-10) {
      return [{ root: cx(r1), multiplicity: 3 }];
    }
    return [
      { root: cx(r1), multiplicity: 1 },
      { root: cx(r2), multiplicity: 2 },
    ].sort((x, y) => x.root.re - y.root.re);
  }
  // three distinct real roots — trigonometric method
  const m = 2 * Math.sqrt(-p / 3);
  const arg = (3 * q) / (2 * p) * Math.sqrt(-3 / p);
  const theta = Math.acos(Math.min(1, Math.max(-1, arg))) / 3;
  const roots: PolyRoot[] = [];
  for (let k = 0; k < 3; k++) {
    const r = cleanFloat(m * Math.cos(theta - (2 * Math.PI * k) / 3) + shift);
    roots.push({ root: cx(r), multiplicity: 1 });
  }
  return roots.sort((x, y) => x.root.re - y.root.re);
}

/** Durand–Kerner for quartic (and general fallback) */
function durandKerner(coeffs: number[]): Complex[] {
  const n = coeffs.length - 1;
  const a = coeffs.map((c) => c / coeffs[0]);
  const evalP = (z: Complex): Complex => {
    let acc: Complex = cx(0, 0);
    for (let i = 0; i <= n; i++) {
      acc = { re: acc.re * z.re - acc.im * z.im + a[i], im: acc.re * z.im + acc.im * z.re };
    }
    return acc;
  };
  let roots: Complex[] = [];
  for (let k = 0; k < n; k++) {
    const ang = (2 * Math.PI * k) / n + 0.4;
    roots.push(cx(1.3 * Math.cos(ang), 1.3 * Math.sin(ang)));
  }
  for (let iter = 0; iter < 300; iter++) {
    let maxDelta = 0;
    roots = roots.map((rk, k) => {
      let denom: Complex = cx(1, 0);
      for (let j = 0; j < n; j++) {
        if (j === k) continue;
        const d = { re: rk.re - roots[j].re, im: rk.im - roots[j].im };
        denom = { re: denom.re * d.re - denom.im * d.im, im: denom.re * d.im + denom.im * d.re };
      }
      const num = evalP(rk);
      const dd = denom.re * denom.re + denom.im * denom.im || 1e-30;
      const delta = {
        re: (num.re * denom.re + num.im * denom.im) / dd,
        im: (num.im * denom.re - num.re * denom.im) / dd,
      };
      maxDelta = Math.max(maxDelta, Math.abs(delta.re) + Math.abs(delta.im));
      return cx(rk.re - delta.re, rk.im - delta.im);
    });
    if (maxDelta < 1e-12) break;
  }
  // snap near-real / near-integer
  return roots.map((r) =>
    cx(
      cleanFloat(Math.abs(r.im) < 1e-7 ? r.re : r.re),
      Math.abs(r.im) < 1e-7 ? 0 : r.im,
    ),
  );
}

/** solve polynomial given descending coefficients (leading first) */
export function polynomialRoots(coeffsInput: number[]): PolyResult {
  let coeffs = coeffsInput.slice();
  while (coeffs.length > 1 && coeffs[0] === 0) coeffs = coeffs.slice(1);
  const degree = coeffs.length - 1;
  if (degree < 1) throw errMath("Polynomial degree must be ≥ 1");
  if (degree > 4) throw errRange("Polynomials up to degree 4 supported");
  if (coeffs.some((c) => !Number.isFinite(c))) throw errMath("Non-finite coefficient");
  let roots: PolyRoot[];
  if (degree === 1) {
    roots = [{ root: cx(cleanFloat(-coeffs[1] / coeffs[0])), multiplicity: 1 }];
  } else if (degree === 2) {
    roots = quadraticRoots(coeffs[0], coeffs[1], coeffs[2]);
  } else if (degree === 3) {
    roots = cubicRoots(coeffs[0], coeffs[1], coeffs[2], coeffs[3]);
  } else {
    const rs = durandKerner(coeffs);
    roots = rs.map((r) => ({ root: r, multiplicity: 1 }));
    // refine: group duplicates
  }
  const repeated = roots.some((r) => r.multiplicity > 1);
  const hasComplex = roots.some((r) => Math.abs(r.root.im) > 1e-9);
  return {
    degree,
    roots,
    repeated,
    note: hasComplex ? "Complex conjugate roots included" : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Inequalities (degree 1-3)                                           */
/* ------------------------------------------------------------------ */

export type IneqSense = ">" | ">=" | "<" | "<=";

export interface IneqResult {
  intervals: Array<[number, number]>; // [lo, hi], Infinity allowed
  sense: IneqSense;
  degree: number;
}

/** solve a·x^n + ...  (sense) 0 → solution set as intervals */
export function solveInequality(coeffs: number[], sense: IneqSense, degree: 1 | 2 | 3): IneqResult {
  const use = coeffs.slice(0, degree + 1);
  const res = polynomialRoots(use);
  const realRoots = res.roots
    .filter((r) => Math.abs(r.root.im) < 1e-9)
    .map((r) => r.root.re)
    .sort((a, b) => a - b);
  const f = (x: number): number => {
    let s = 0;
    for (let i = 0; i < use.length; i++) s = s * x + use[i];
    return s;
  };
  const satisfies = (x: number): boolean => {
    const v = f(x);
    switch (sense) {
      case ">": return v > 0;
      case ">=": return v >= -1e-12;
      case "<": return v < 0;
      case "<=": return v <= 1e-12;
    }
  };
  const critical = [-Infinity, ...realRoots, Infinity];
  const intervals: Array<[number, number]> = [];
  for (let i = 0; i < critical.length - 1; i++) {
    const lo = critical[i];
    const hi = critical[i + 1];
    const mid =
      lo === -Infinity && hi === Infinity ? 0 :
      lo === -Infinity ? hi - Math.max(1, Math.abs(hi)) :
      hi === Infinity ? lo + Math.max(1, Math.abs(lo)) :
      (lo + hi) / 2;
    if (satisfies(mid)) intervals.push([lo, hi]);
  }
  // isolated equality points for <= / >= with even multiplicity
  if ((sense === "<=" || sense === ">=") && intervals.length === 0) {
    const singles = realRoots.filter((r) => Math.abs(f(r)) < 1e-9 && satisfies(r));
    for (const r of singles) intervals.push([r, r]);
  }
  return { intervals, sense, degree: res.degree };
}

/* ------------------------------------------------------------------ */
/* Newton–Raphson numeric root finder                                  */
/* ------------------------------------------------------------------ */

export interface NewtonResult {
  root: number;
  iterations: number;
  converged: boolean;
}

export function solveNewton(f: (x: number) => number, x0: number): NewtonResult {
  let x = x0;
  for (let i = 0; i < 100; i++) {
    const fx = f(x);
    if (!Number.isFinite(fx)) {
      return { root: x, iterations: i, converged: false };
    }
    if (Math.abs(fx) < 1e-12) return { root: cleanFloat(x), iterations: i, converged: true };
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const dfx = (f(x + h) - f(x - h)) / (2 * h);
    if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-14) {
      return { root: x, iterations: i, converged: false };
    }
    const step = fx / dfx;
    x -= step;
    if (Math.abs(step) < 1e-12 * Math.max(1, Math.abs(x))) {
      return { root: cleanFloat(x), iterations: i, converged: Math.abs(f(x)) < 1e-9 };
    }
  }
  return { root: x, iterations: 100, converged: false };
}

/* ------------------------------------------------------------------ */
/* Probability distributions                                           */
/* ------------------------------------------------------------------ */

/** Abramowitz–Stegun 7.1.26 erf approximation (|ε| ≤ 1.5e-7) */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t) *
      Math.exp(-x * x);
  return sign * y;
}

export function normalPDF(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) throw errMath("σ must be > 0");
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

export function normalCDF(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) throw errMath("σ must be > 0");
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

export function normalCD(lower: number, upper: number, mu = 0, sigma = 1): number {
  return normalCDF(upper, mu, sigma) - normalCDF(lower, mu, sigma);
}

/** Acklam inverse-normal rational approximation (max |ε| ≈ 1.15e-9 in [-2,2]) */
export function invNormalCDF(p: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) throw errMath("σ must be > 0");
  if (p <= 0 || p >= 1) throw errMath("Area must be in (0, 1)");
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let x: number;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
        ((((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1));
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // one Halley refinement
  const e = normalCDF(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  x = x - u / (1 + (x * u) / 2);
  return mu + sigma * x;
}

export function binomialPD(x: number, n: number, p: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw errMath("n must be an integer 0–999");
  if (!Number.isInteger(x) || x < 0 || x > n) return 0;
  if (p < 0 || p > 1) throw errMath("p must be in [0, 1]");
  // logs for stability
  let logC = 0;
  for (let i = 1; i <= x; i++) logC += Math.log((n - x + i) / i);
  const v = logC + x * Math.log(p || 1e-300) + (n - x) * Math.log(1 - p || 1e-300);
  return Math.min(1, Math.exp(v));
}

export function binomialCD(x: number, n: number, p: number): number {
  let s = 0;
  for (let k = 0; k <= Math.floor(x); k++) s += binomialPD(k, n, p);
  return Math.min(1, s);
}

export function poissonPD(x: number, lambda: number): number {
  if (!Number.isInteger(x) || x < 0) return 0;
  if (!(lambda > 0) || lambda > 999) throw errMath("λ must be in (0, 999]");
  const v = -lambda + x * Math.log(lambda) - logFactorial(x);
  return Math.exp(v);
}

export function poissonCD(x: number, lambda: number): number {
  let s = 0;
  for (let k = 0; k <= Math.floor(x); k++) s += poissonPD(k, lambda);
  return Math.min(1, s);
}

function logFactorial(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}
