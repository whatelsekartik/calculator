/**
 * Solvers: linear systems, polynomials, inequalities, Newton, distributions.
 */
import { describe, it, expect } from "vitest";
import {
  solveLinearSystem, polynomialRoots, solveInequality, solveNewton,
  normalPDF, normalCDF, normalCD, invNormalCDF, binomialPD, binomialCD, poissonPD, poissonCD,
} from "../solvers";

describe("simultaneous linear equations", () => {
  it("2x+y=5, x−y=1 → x=2, y=1", () => {
    const r = solveLinearSystem([[2, 1], [1, -1]], [5, 1]);
    if (r.type !== "unique") throw new Error("expected unique");
    expect(r.x[0]).toBeCloseTo(2, 10);
    expect(r.x[1]).toBeCloseTo(1, 10);
  });
  it("3×3 system with known solution (1,2,3)", () => {
    const r = solveLinearSystem(
      [[1, 1, 1], [2, -1, 1], [3, 1, -1]],
      [6, 3, 2], // rows check: 1+2+3=6, 2−2+3=3, 3+2−3=2
    );
    if (r.type !== "unique") throw new Error();
    expect(r.x[0]).toBeCloseTo(1, 9);
    expect(r.x[1]).toBeCloseTo(2, 9);
    expect(r.x[2]).toBeCloseTo(3, 9);
  });
  it("inconsistent system → none", () => {
    const r = solveLinearSystem([[1, 1], [1, 1]], [2, 5]);
    expect(r.type).toBe("none");
  });
  it("dependent system → infinite", () => {
    const r = solveLinearSystem([[1, 1], [2, 2]], [2, 4]);
    expect(r.type).toBe("infinite");
  });
  it("4×4 system", () => {
    // w+x+y+z=10, 2w−x=3, x+y=4, z=1
    const r = solveLinearSystem(
      [[1, 1, 1, 1], [2, -1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 1]],
      [10, 3, 4, 1],
    );
    if (r.type !== "unique") throw new Error();
    const [w, x, y, z] = r.x;
    expect(z).toBeCloseTo(1, 9);
    expect(2 * w - x).toBeCloseTo(3, 8);
    expect(x + y).toBeCloseTo(4, 8);
    expect(w + x + y + z).toBeCloseTo(10, 8);
  });
});

describe("polynomial roots", () => {
  it("x² − 5x + 6 = 0 → 2, 3", () => {
    const r = polynomialRoots([1, -5, 6]);
    const rs = r.roots.map((x) => x.root.re).sort((a, b) => a - b);
    expect(rs[0]).toBeCloseTo(2, 10);
    expect(rs[1]).toBeCloseTo(3, 10);
  });
  it("(x−1)² = 0 → repeated root 1 (multiplicity 2)", () => {
    const r = polynomialRoots([1, -2, 1]);
    expect(r.roots.length).toBe(1);
    expect(r.roots[0].multiplicity).toBe(2);
    expect(r.repeated).toBe(true);
  });
  it("x² + 1 = 0 → ±i (complex roots)", () => {
    const r = polynomialRoots([1, 0, 1]);
    const im = Math.abs(r.roots[0].root.im);
    expect(im).toBeCloseTo(1, 10);
    expect(r.roots[0].root.re).toBeCloseTo(0, 10);
  });
  it("x³ − 6x² + 11x − 6 = 0 → 1, 2, 3", () => {
    const r = polynomialRoots([1, -6, 11, -6]);
    const rs = r.roots.map((x) => x.root.re).sort((a, b) => a - b);
    expect(rs[0]).toBeCloseTo(1, 8);
    expect(rs[1]).toBeCloseTo(2, 8);
    expect(rs[2]).toBeCloseTo(3, 8);
    expect(r.roots.every((x) => Math.abs(x.root.im) < 1e-7)).toBe(true);
  });
  it("(x−1)³ triple root", () => {
    const r = polynomialRoots([1, -3, 3, -1]);
    expect(r.roots[0].multiplicity).toBe(3);
    expect(r.roots[0].root.re).toBeCloseTo(1, 8);
  });
  it("x³ + x + 1: one real ≈ −0.68233, complex pair", () => {
    const r = polynomialRoots([1, 0, 1, 1]);
    const reals = r.roots.filter((x) => Math.abs(x.root.im) < 1e-9);
    expect(reals.length).toBe(1);
    expect(reals[0].root.re).toBeCloseTo(-0.6823278, 6);
    expect(r.roots.some((x) => Math.abs(x.root.im) > 0.5)).toBe(true);
  });
  it("quartic (x−1)(x−2)(x−3)(x−4) → 1,2,3,4", () => {
    const r = polynomialRoots([1, -10, 35, -50, 24]);
    const rs = r.roots.map((x) => x.root.re).sort((a, b) => a - b);
    expect(rs[0]).toBeCloseTo(1, 6);
    expect(rs[1]).toBeCloseTo(2, 6);
    expect(rs[2]).toBeCloseTo(3, 6);
    expect(rs[3]).toBeCloseTo(4, 6);
  });
});

describe("inequalities", () => {
  it("x² − 5x + 6 < 0 → 2 < x < 3", () => {
    const r = solveInequality([1, -5, 6], "<", 2);
    expect(r.intervals.length).toBe(1);
    expect(r.intervals[0][0]).toBeCloseTo(2, 8);
    expect(r.intervals[0][1]).toBeCloseTo(3, 8);
  });
  it("x² − 5x + 6 > 0 → (−∞,2) ∪ (3,∞)", () => {
    const r = solveInequality([1, -5, 6], ">", 2);
    expect(r.intervals.length).toBe(2);
    expect(r.intervals[0]).toEqual([-Infinity, expect.closeTo(2, 8)]);
    expect(r.intervals[1]).toEqual([expect.closeTo(3, 8), Infinity]);
  });
  it("x² + 1 > 0 → all real numbers", () => {
    const r = solveInequality([1, 0, 1], ">", 2);
    expect(r.intervals).toEqual([[-Infinity, Infinity]]);
  });
  it("(x−1)² ≤ 0 → isolated point x=1", () => {
    const r = solveInequality([1, -2, 1], "<=", 2);
    expect(r.intervals.length).toBe(1);
    expect(r.intervals[0][0]).toBeCloseTo(1, 9);
    expect(r.intervals[0][1]).toBeCloseTo(1, 9);
  });
  it("x + 1 < 0 (linear)", () => {
    const r = solveInequality([1, 1], "<", 1);
    expect(r.intervals).toEqual([[-Infinity, -1]]);
  });
});

describe("numeric solve (Newton)", () => {
  it("x² − 2 = 0 from x0=1 → √2", () => {
    const r = solveNewton((x) => x * x - 2, 1);
    expect(r.converged).toBe(true);
    expect(r.root).toBeCloseTo(Math.SQRT2, 8);
  });
  it("cos(x) − x = 0 → 0.739085…", () => {
    const r = solveNewton((x) => Math.cos(x) - x, 0.5);
    expect(r.converged).toBe(true);
    expect(r.root).toBeCloseTo(0.7390851332, 8);
  });
  it("x² + 1 = 0 fails gracefully (no real root)", () => {
    const r = solveNewton((x) => x * x + 1, 0.5);
    expect(r.converged).toBe(false);
  });
});

describe("distributions", () => {
  it("normal PDF at 0 = 1/√2π", () => expect(normalPDF(0)).toBeCloseTo(0.3989422804, 10));
  it("normal CDF(0) = 0.5 (approx, |ε| ≤ 1e-7)", () => expect(normalCDF(0)).toBeCloseTo(0.5, 7));
  it("P(−1.96 < Z < 1.96) ≈ 0.95", () => {
    expect(normalCD(-1.959964, 1.959964)).toBeCloseTo(0.95, 4);
  });
  it("invNormal(0.975) ≈ 1.959964", () => expect(invNormalCDF(0.975)).toBeCloseTo(1.959964, 4));
  it("binomial PD: P(X=2|n=4,p=0.5) = 0.375", () => expect(binomialPD(2, 4, 0.5)).toBeCloseTo(0.375, 12));
  it("binomial CD: P(X≤2|n=4,p=0.5) = 0.6875", () => expect(binomialCD(2, 4, 0.5)).toBeCloseTo(0.6875, 12));
  it("poisson PD: P(X=2|λ=3) ≈ 0.224042", () => expect(poissonPD(2, 3)).toBeCloseTo(0.2240418, 6));
  it("poisson CD: P(X≤2|λ=3) ≈ 0.423190", () => expect(poissonCD(2, 3)).toBeCloseTo(0.4231901, 6));
});
