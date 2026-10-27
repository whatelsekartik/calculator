/**
 * Matrix / vector / complex advanced arithmetic tests.
 */
import { describe, it, expect } from "vitest";
import { calculate, calculateString, EngineEnv } from "../engine";
import { Value, asReal } from "../core";
import { DEFAULT_SETTINGS } from "../session";
import { tok } from "../parser";

const env = (vars: Record<string, Value | null>, over: Partial<EngineEnv> = {}): EngineEnv => ({
  settings: { ...DEFAULT_SETTINGS, angle: "deg" },
  vars,
  complexMode: false,
  rand: () => 0.5,
  ...over,
});

const A: Value = { kind: "matrix", m: [[1, 2], [3, 4]] };
const B: Value = { kind: "matrix", m: [[5, 6], [7, 8]] };

function run(src: string, e: EngineEnv): Value {
  const r = calculateString(src, e);
  if (!r.ok) throw new Error(`"${src}" → ${r.message}`);
  return r.value;
}

describe("matrix arithmetic", () => {
  const e = env({ MatA: A, MatB: B });
  it("MatA + MatB", () => {
    const v = run("MatA+MatB", e);
    if (v.kind !== "matrix") throw new Error();
    expect(v.m).toEqual([[6, 8], [10, 12]]);
  });
  it("MatA × MatB (row × column)", () => {
    const v = run("MatA*MatB", e);
    if (v.kind !== "matrix") throw new Error();
    expect(v.m).toEqual([[19, 22], [43, 50]]);
  });
  it("scalar multiplication both sides", () => {
    const v = run("2MatA", e);
    if (v.kind !== "matrix") throw new Error();
    expect(v.m).toEqual([[2, 4], [6, 8]]);
    const v2 = run("MatA*3", e);
    if (v2.kind !== "matrix") throw new Error();
    expect(v2.m).toEqual([[3, 6], [9, 12]]);
  });
  it("det(MatA) = −2 exactly", () => expect(asReal(run("det(MatA)", e))).toBe(-2));
  it("MatA⁻² … MatA^(−1) inverse exact halves", () => {
    const v = run("MatA^-1", e);
    if (v.kind !== "matrix") throw new Error();
    expect(v.m[0][0]).toBeCloseTo(-2, 12);
    expect(v.m[0][1]).toBeCloseTo(1, 12);
    expect(v.m[1][0]).toBeCloseTo(1.5, 12);
    expect(v.m[1][1]).toBeCloseTo(-0.5, 12);
  });
  it("MatA squared via postfix", () => {
    const r = calculate([tok("var", "MatA"), tok("post", "sq")], e);
    if (!r.ok) throw new Error(r.message);
    if (r.value.kind !== "matrix") throw new Error();
    expect(r.value.m).toEqual([[7, 10], [15, 22]]);
  });
  it("transpose via MatA^T postfix", () => {
    const r = calculate([tok("var", "MatA"), tok("post", "T")], e);
    if (!r.ok) throw new Error(r.message);
    if (r.value.kind !== "matrix") throw new Error();
    expect(r.value.m).toEqual([[1, 3], [2, 4]]);
  });
  it("MatA must equal identity when MatA × MatA⁻¹", () => {
    const v = run("det(MatA*MatA^-1)", e);
    expect(asReal(v)).toBeCloseTo(1, 9);
  });
  it("singular matrix inverse → MATH error, not garbage", () => {
    const sing: Value = { kind: "matrix", m: [[1, 2], [2, 4]] };
    const r = calculateString("MatC^-1", env({ MatC: sing }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("MATH");
      expect(r.message.toLowerCase()).toContain("singular");
    }
  });
  it("undefined matrix variable → VARIABLE error", () => {
    const r = calculateString("MatC+MatA", env({ MatA: A }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("VARIABLE");
  });
  it("dimension mismatch is rejected", () => {
    const C: Value = { kind: "matrix", m: [[1, 2, 3]] };
    const r = calculateString("MatA+MatC", env({ MatA: A, MatC: C }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("DIM");
  });
  it("det of 3×3 exact via Bareiss", () => {
    const M: Value = { kind: "matrix", m: [[2, 0, 1], [1, 3, 2], [1, 0, 1]] };
    expect(asReal(run("det(MatD)", env({ MatD: M })))).toBe(3);
  });
});

describe("vectors", () => {
  const VA: Value = { kind: "vector", v: [1, 2, 3] };
  const VB: Value = { kind: "vector", v: [4, -5, 6] };
  const e = env({ VctA: VA, VctB: VB });
  it("dot product: 4−10+18 = 12", () => {
    expect(asReal(run("dot(VctA,VctB)", e))).toBe(12);
  });
  it("cross product", () => {
    const v = run("cross(VctA,VctB)", e);
    if (v.kind !== "vector") throw new Error();
    expect(v.v[0]).toBeCloseTo(2 * 6 - 3 * -5, 12); // 27
    expect(v.v[1]).toBeCloseTo(3 * 4 - 1 * 6, 12); // 6
    expect(v.v[2]).toBeCloseTo(1 * -5 - 2 * 4, 12); // -13
  });
  it("cross of 2-D vectors → Dimension ERROR", () => {
    const e2 = env({ VctA: { kind: "vector", v: [1, 2] }, VctB: { kind: "vector", v: [3, 4] } });
    const r = calculateString("cross(VctA,VctB)", e2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("DIM");
  });
  it("abs(VctA) = √14", () => {
    expect(asReal(run("abs(VctA)", e))).toBeCloseTo(Math.sqrt(14), 12);
  });
  it("angle between [1,0] and [0,1] = 90°", () => {
    const e2 = env({ VctA: { kind: "vector", v: [1, 0] }, VctB: { kind: "vector", v: [0, 1] } });
    expect(asReal(run("vangle(VctA,VctB)", e2))).toBeCloseTo(90, 10);
  });
  it("vector addition / scalar multiply", () => {
    const v = run("VctA+VctB", e);
    if (v.kind !== "vector") throw new Error();
    expect(v.v).toEqual([5, -3, 9]);
    const w = run("2VctA", e);
    if (w.kind !== "vector") throw new Error();
    expect(w.v).toEqual([2, 4, 6]);
  });
  it("unit vector of [3,4] → [0.6,0.8]", () => {
    const e2 = env({ VctA: { kind: "vector", v: [3, 4] } });
    const v = run("unitvec(VctA)", e2);
    if (v.kind !== "vector") throw new Error();
    expect(v.v[0]).toBeCloseTo(0.6, 12);
    expect(v.v[1]).toBeCloseTo(0.8, 12);
  });
});
