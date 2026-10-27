/**
 * Matrix and vector linear algebra.
 * Exact-path determinant/inverse (Bareiss / Gauss–Jordan over Fraction)
 * when every entry is integral; otherwise float with partial pivoting.
 */

import {
  CalcError, Value, Fraction, errMath, errDim, matVal, vecVal,
} from "./core";

export const isMatrixValue = (v: Value): v is { kind: "matrix"; m: number[][] } => v.kind === "matrix";
export const isVectorValue = (v: Value): v is { kind: "vector"; m?: never; v: number[] } => v.kind === "vector";

export function matDims(m: number[][]): { r: number; c: number } {
  return { r: m.length, c: m[0]?.length ?? 0 };
}

export function identity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
}

function sameDims(a: number[][], b: number[][]): boolean {
  const da = matDims(a);
  const db = matDims(b);
  return da.r === db.r && da.c === db.c;
}

export function matAdd(a: number[][], b: number[][], sign = 1): number[][] {
  if (!sameDims(a, b)) throw errDim("Matrices must have identical dimensions");
  return a.map((row, i) => row.map((x, j) => x + sign * b[i][j]));
}

export function matScalar(a: number[][], k: number): number[][] {
  return a.map((row) => row.map((x) => k * x));
}

export function matMul(a: number[][], b: number[][]): number[][] {
  const da = matDims(a);
  const db = matDims(b);
  if (da.c !== db.r) throw errDim(`Cannot multiply ${da.r}×${da.c} by ${db.r}×${db.c}`);
  const out = Array.from({ length: da.r }, () => new Array<number>(db.c).fill(0));
  for (let i = 0; i < da.r; i++) {
    for (let k = 0; k < da.c; k++) {
      const aik = a[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < db.c; j++) out[i][j] += aik * b[k][j];
    }
  }
  return out;
}

export function matTranspose(a: number[][]): number[][] {
  const { r, c } = matDims(a);
  return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => a[i][j]));
}

function allIntegers(a: number[][]): boolean {
  return a.every((row) => row.every((x) => Number.isInteger(x)));
}

/** Bareiss algorithm — exact determinant for integer matrices */
function detBareiss(a: number[][]): number {
  const n = a.length;
  let M: Fraction[][] = a.map((row) => row.map((x) => Fraction.of(x)));
  let sign = 1;
  let prev = Fraction.of(1);
  for (let i = 0; i < n - 1; i++) {
    if (M[i][i].isZero()) {
      let k = -1;
      for (let r = i + 1; r < n; r++) if (!M[r][i].isZero()) { k = r; break; }
      if (k === -1) return 0;
      [M[i], M[k]] = [M[k], M[i]];
      sign = -sign;
    }
    const pivot = M[i][i];
    const next: Fraction[][] = M.map((row) => row.slice());
    for (let r = i + 1; r < n; r++) {
      for (let c = i + 1; c < n; c++) {
        next[r][c] = M[r][c].mul(pivot).sub(M[r][i].mul(M[i][c])).div(prev);
      }
    }
    for (let r = i + 1; r < n; r++) {
      next[r][i] = Fraction.of(0);
      next[i][r] = M[i][r];
    }
    M = next;
    prev = pivot;
  }
  return sign * M[n - 1][n - 1].toNumber();
}

function detFloat(a: number[][]): number {
  const n = a.length;
  const M = a.map((row) => row.slice());
  let det = 1;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-14) return 0;
    if (p !== i) {
      [M[i], M[p]] = [M[p], M[i]];
      det = -det;
    }
    det *= M[i][i];
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      for (let c = i; c < n; c++) M[r][c] -= f * M[i][c];
    }
  }
  return det;
}

export function matDet(a: number[][]): number {
  const { r, c } = matDims(a);
  if (r !== c) throw errDim("Determinant needs a square matrix");
  if (r === 0) throw errDim("Empty matrix");
  if (allIntegers(a) && r <= 10) {
    const d = detBareiss(a);
    if (Number.isFinite(d) && Math.abs(d) < 9e14) return d;
  }
  const d = detFloat(a);
  if (!Number.isFinite(d)) throw errMath("Determinant overflow");
  const rounded = Math.round(d);
  if (Math.abs(d - rounded) < 1e-9 * Math.max(1, Math.abs(d))) return rounded;
  return d;
}

/** Gauss–Jordan inverse. Exact Fraction path for integer matrices. */
export function matInverse(a: number[][]): number[][] {
  const { r, c } = matDims(a);
  if (r !== c) throw errDim("Inverse needs a square matrix");
  const n = r;
  if (allIntegers(a) && n <= 10) return matInverseExact(a);
  const M = a.map((row, i) => [...row, ...identity(n)[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r2 = i + 1; r2 < n; r2++) if (Math.abs(M[r2][i]) > Math.abs(M[p][i])) p = r2;
    if (Math.abs(M[p][i]) < 1e-12) {
      throw errMath("Matrix is singular (det = 0); no inverse exists");
    }
    [M[i], M[p]] = [M[p], M[i]];
    const d = M[i][i];
    for (let c2 = 0; c2 < 2 * n; c2++) M[i][c2] /= d;
    for (let r2 = 0; r2 < n; r2++) {
      if (r2 === i) continue;
      const f = M[r2][i];
      if (f === 0) continue;
      for (let c2 = 0; c2 < 2 * n; c2++) M[r2][c2] -= f * M[i][c2];
    }
  }
  return M.map((row) => row.slice(n));
}

function matInverseExact(a: number[][]): number[][] {
  const n = a.length;
  let M: Fraction[][] = a.map((row, i) => [
    ...row.map((x) => Fraction.of(x)),
    ...identity(n)[i].map((x) => Fraction.of(x)),
  ]);
  for (let i = 0; i < n; i++) {
    let p = i;
    while (p < n && M[p][i].isZero()) p++;
    if (p === n) {
      // integer singular — fall through to float? No: report singular.
      throw errMath("Matrix is singular (det = 0); no inverse exists");
    }
    [M[i], M[p]] = [M[p], M[i]];
    const d = M[i][i];
    let row = M[i].map((x) => x.div(d));
    M[i] = row;
    for (let r2 = 0; r2 < n; r2++) {
      if (r2 === i) continue;
      const f = M[r2][i];
      if (f.isZero()) continue;
      for (let c2 = 0; c2 < 2 * n; c2++) {
        M[r2][c2] = M[r2][c2].sub(f.mul(M[i][c2]));
      }
    }
  }
  const out = M.map((row) => row.slice(n).map((f) => f.toNumber()));
  return out;
}

/** integer power (negative allowed via inverse) */
export function matPow(a: number[][], k: number): number[][] {
  const { r, c } = matDims(a);
  if (r !== c) throw errDim("Matrix power needs a square matrix");
  if (!Number.isInteger(k) || Math.abs(k) > 100) throw errMath("Matrix exponent must be a small integer");
  if (k === 0) return identity(r);
  if (k < 0) {
    const inv = matInverse(a);
    return matPow(inv, -k);
  }
  let result = identity(r);
  let base = a;
  let e = k;
  while (e > 0) {
    if (e % 2 === 1) result = matMul(result, base);
    e = Math.floor(e / 2);
    if (e > 0) base = matMul(base, base);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Vectors                                                             */
/* ------------------------------------------------------------------ */

export function vecAdd(a: number[], b: number[], sign = 1): number[] {
  if (a.length !== b.length) throw errDim("Vectors must have the same dimension");
  return a.map((x, i) => x + sign * (b[i] ?? 0));
}
export function vecScalar(a: number[], k: number): number[] {
  return a.map((x) => k * x);
}
export function vecDot(a: number[], b: number[]): number {
  if (a.length !== b.length) throw errDim("Vectors must have the same dimension");
  return a.reduce((acc, x, i) => acc + x * (b[i] ?? 0), 0);
}
export function vecCross(a: number[], b: number[]): number[] {
  if (a.length !== 3 || b.length !== 3) {
    throw errDim("Cross product requires two 3-D vectors");
  }
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function vecNorm(a: number[]): number {
  return Math.sqrt(a.reduce((acc, x) => acc + x * x, 0));
}
export function vecUnit(a: number[]): number[] {
  const n = vecNorm(a);
  if (n === 0) throw errMath("Cannot normalize a zero vector");
  return a.map((x) => x / n);
}
export function vecAngle(a: number[], b: number[]): number {
  const na = vecNorm(a);
  const nb = vecNorm(b);
  if (na === 0 || nb === 0) throw errMath("Angle undefined for a zero vector");
  let c = vecDot(a, b) / (na * nb);
  c = Math.min(1, Math.max(-1, c));
  return Math.acos(c); // radians — caller converts to angle unit
}
