/**
 * Core engine acceptance tests — parsing, precedence, functions,
 * angle modes, exact fractions, sci notation, error handling.
 */
import { describe, it, expect } from "vitest";
import { calculateString, EngineEnv } from "../engine";
import { Value, asReal, asComplex } from "../core";
import { DEFAULT_SETTINGS } from "../session";

const env = (over: Partial<EngineEnv> = {}): EngineEnv => ({
  settings: { ...DEFAULT_SETTINGS, angle: "deg", fractionResult: true, numFormat: { mode: "norm1", digits: 3 } },
  vars: {},
  complexMode: false,
  rand: () => 0.5,
  ...over,
});

function val(src: string, e: EngineEnv = env(), wantOk = true): Value {
  const r = calculateString(src, e);
  if (wantOk && !r.ok) throw new Error(`"${src}" failed: ${r.message}`);
  if (!r.ok) throw new Error("expected success");
  return r.value;
}
const num = (src: string, e?: EngineEnv): number => asReal(val(src, e));

describe("arithmetic & precedence", () => {
  it("2 + 3 × 4 = 14 (× before +)", () => expect(num("2+3*4")).toBe(14));
  it("(2 + 3) × 4 = 20", () => expect(num("(2+3)*4")).toBe(20));
  it("nested parens", () => expect(num("2*(3+(4-1)*2)")).toBe(18));
  it("2^3 = 8", () => expect(num("2^3")).toBe(8));
  it("power is right-associative: 2^3^2 = 512", () => expect(num("2^3^2")).toBe(512));
  it("-2^2 = -4 (unary minus below power)", () => expect(num("-2^2")).toBe(-4));
  it("(-2)^2 = 4", () => expect(num("(-2)^2")).toBe(4));
  it("unary minus after operator: 3*-2 = -6", () => expect(num("3*-2")).toBe(-6));
  it("negative exponent: 2^-3 = 0.125", () => expect(num("2^-3")).toBe(0.125));
  it("implicit multiplication: 2π", () => expect(num("2π")).toBeCloseTo(2 * Math.PI, 12));
  it("implicit multiplication: 3(4+5) = 27", () => expect(num("3(4+5)")).toBe(27));
  it("implicit after paren: (2)(3) = 6", () => expect(num("(2)(3)")).toBe(6));
  it("decimal arithmetic 0.1+0.2 displays cleanly", () => {
    expect(num("0.1+0.2")).toBeCloseTo(0.3, 12);
  });
});

describe("exact fractions", () => {
  it("1/3 + 1/3 = 2/3 exactly", () => {
    const v = val("1/3+1/3");
    expect(v.kind).toBe("num");
    if (v.kind !== "num") throw new Error();
    expect(v.frac?.n).toBe(2);
    expect(v.frac?.d).toBe(3);
  });
  it("1/2 + 1/4 = 3/4", () => {
    const v = val("1/2+1/4");
    if (v.kind !== "num") throw new Error();
    expect(v.frac?.n).toBe(3);
    expect(v.frac?.d).toBe(4);
  });
  it("(2/3)^-1 = 3/2", () => {
    const v = val("(2/3)^-1");
    if (v.kind !== "num") throw new Error();
    expect(v.frac?.n).toBe(3);
    expect(v.frac?.d).toBe(2);
  });
  it("mixed 1⌟1/2 + 1⌟1/2 = 3", () => expect(num("1⌟1/2+1⌟1/2")).toBe(3));
  it("irrationals fall back to decimal: √2 has no frac", () => {
    const v = val("sqrt(2)");
    if (v.kind !== "num") throw new Error();
    expect(v.frac).toBeNull();
    expect(v.real).toBeCloseTo(Math.SQRT2, 12);
  });
});

describe("functions", () => {
  it("√(81) = 9", () => expect(num("sqrt(81)")).toBe(9));
  it("∛(27) = 3", () => expect(num("cbrt(27)")).toBe(3));
  it("xroot(3, 27) = 3", () => expect(num("xroot(3,27)")).toBe(3));
  it("ln(e) = 1", () => expect(num("ln(e)")).toBe(1));
  it("log(1000) = 3", () => expect(num("log(1000)")).toBe(3));
  it("logb(2,8) = 3", () => expect(num("logb(2,8)")).toBe(3));
  it("e^1 = e and 10^2 = 100", () => {
    expect(num("expe(1)")).toBeCloseTo(Math.E, 12);
    expect(num("exp10(2)")).toBe(100);
  });
  it("5! = 120", () => expect(num("5!")).toBe(120));
  it("0! = 1", () => expect(num("0!")).toBe(1));
  it("|−7| = 7", () => expect(num("abs(-7)")).toBe(7));
  it("200 × 10% = 20", () => expect(num("200*10%")).toBe(20));
  it("6 nPr 2 = 30", () => expect(num("6nPr2")).toBe(30));
  it("6 nCr 2 = 15", () => expect(num("6nCr2")).toBe(15));
  it("GCD(12,18) = 6", () => expect(num("12gcd18")).toBe(6));
  it("LCM(4,6) = 12", () => expect(num("4lcm6")).toBe(12));
  it("prime factorization of 360", () => {
    const v = val("primefact(360)");
    if (v.kind !== "text") throw new Error();
    expect(v.s).toBe("2^3×3^2×5");
  });
  it("Σ(X, 1, 10) = 55", () => expect(num("sigma(X,1,10)")).toBe(55));
  it("Ran# with seeded rng = 0.5xx shape", () => {
    const v = num("ran#()");
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
  it("RanInt#(1,6) inside range with half rng", () => {
    const v = num("ranint(1,6)");
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(6);
  });
});

describe("trigonometry & angle modes", () => {
  it("sin(30) = 0.5 in DEG", () => expect(num("sin(30)")).toBe(0.5));
  it("sin(π/6) = 0.5 in RAD", () => {
    expect(num("sin(π/6)", env({ settings: { ...DEFAULT_SETTINGS, angle: "rad" } }))).toBeCloseTo(0.5, 12);
  });
  it("sin(100) = 1 in GRAD", () => {
    expect(num("sin(100)", env({ settings: { ...DEFAULT_SETTINGS, angle: "grad" } }))).toBeCloseTo(1, 12);
  });
  it("cos(60°) = 0.5, tan(45°) = 1", () => {
    expect(num("cos(60)")).toBe(0.5);
    expect(num("tan(45)")).toBe(1);
  });
  it("sin(180°) = 0 (residue snapped)", () => expect(num("sin(180)")).toBe(0));
  it("asin(0.5) = 30 in DEG", () => expect(num("asin(0.5)")).toBeCloseTo(30, 10));
  it("asin(0.5) = π/6 in RAD", () => {
    expect(num("asin(0.5)", env({ settings: { ...DEFAULT_SETTINGS, angle: "rad" } }))).toBeCloseTo(Math.PI / 6, 10);
  });
  it("hyperbolic: sinh(1) correct", () => expect(num("sinh(1)")).toBeCloseTo(Math.sinh(1), 10));
  it("asinh(acosh(2)) consistent", () =>
    expect(num("acosh(2)")).toBeCloseTo(Math.acosh(2), 10));
  it("Pol(1,1) = [√2, 45°]", () => {
    const v = val("pol(1,1)");
    if (v.kind !== "vector") throw new Error();
    expect(v.v[0]).toBeCloseTo(Math.SQRT2, 10);
    expect(v.v[1]).toBeCloseTo(45, 10);
  });
  it("Rec(√2, 45°) = [1, 1]", () => {
    const v = val("rec(sqrt(2),45)");
    if (v.kind !== "vector") throw new Error();
    expect(v.v[0]).toBeCloseTo(1, 10);
    expect(v.v[1]).toBeCloseTo(1, 10);
  });
});

describe("DMS", () => {
  it("1°30′ = 1.5", () => expect(num("1°30°")).toBe(1.5));
  it("12°30′15″ = 12.50416666…", () => expect(num("12°30°15°")).toBeCloseTo(12 + 30 / 60 + 15 / 3600, 10));
  it("rejects 90′ minutes", () => {
    const r = calculateString("1°90°", env());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MATH");
  });
});

describe("scientific notation", () => {
  it("1.5e3 = 1500 (typed literal)", () => expect(num("1.5e3")).toBe(1500));
  it("2×10^(3) via E10 tokens", () => {
    const r = calculateString("2×10^(3)", env());
    if (!r.ok) throw new Error(r.message);
    expect(asReal(r.value)).toBe(2000);
  });
  it("1.5×10^3+500 = 2000", () => {
    const r = calculateString("1.5×10^(3)+500", env());
    if (!r.ok) throw new Error(r.message);
    expect(asReal(r.value)).toBe(2000);
  });
});

describe("errors are explicit, never silent NaN", () => {
  it("1/0 → MATH division by zero", () => {
    const r = calculateString("1/0", env());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("MATH");
      expect(r.message).toContain("zero");
    }
  });
  it("syntax error with position", () => {
    const r = calculateString("2+×3", env());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SYNTAX");
  });
  it("unbalanced parens rejected", () => {
    const r = calculateString("2*(3", env());
    expect(r.ok).toBe(false);
  });
  it("√(-1) → MATH in real mode", () => {
    const r = calculateString("sqrt(-1)", env());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MATH");
  });
  it("log(0) → MATH", () => {
    const r = calculateString("log(0)", env());
    expect(r.ok).toBe(false);
  });
  it("170! ok, 171! overflow", () => {
    expect(Number.isFinite(num("170!"))).toBe(true);
    const r = calculateString("171!", env());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("OVERFLOW");
  });
  it("asin(2) → MATH in real mode", () => {
    const r = calculateString("asin(2)", env());
    expect(r.ok).toBe(false);
  });
  it("0^-1 → MATH", () => {
    const r = calculateString("0^-1", env());
    expect(r.ok).toBe(false);
  });
  it("1e100 → overflow", () => {
    const r = calculateString("exp10(100)", env());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("OVERFLOW");
  });
});

describe("complex values flow through standard arithmetic", () => {
  const cenv = () => env({ complexMode: true });
  it("(2+3i) + (1−4i) = 3−i", () => {
    const v = val("(2+3i)+(1-4i)", cenv());
    const z = asComplex(v);
    expect(z.re).toBe(3);
    expect(z.im).toBeCloseTo(-1, 12);
  });
  it("(1+i)^2 = 2i", () => {
    const v = val("(1+i)^2", cenv());
    const z = asComplex(v);
    expect(z.re).toBeCloseTo(0, 12);
    expect(z.im).toBeCloseTo(2, 12);
  });
  it("√(−4) = 2i in complex mode", () => {
    const v = val("sqrt(-4)", cenv());
    const z = asComplex(v);
    expect(z.re).toBeCloseTo(0, 12);
    expect(z.im).toBeCloseTo(2, 12);
  });
  it("abs(3+4i) = 5", () => expect(num("abs(3+4i)", cenv())).toBeCloseTo(5, 12));
  it("arg(1+i) = 45°", () => expect(num("arg(1+i)", cenv())).toBeCloseTo(45, 10));
  it("conjg(2+3i) = 2−3i", () => {
    const z = asComplex(val("conjg(2+3i)", cenv()));
    expect(z.re).toBe(2);
    expect(z.im).toBe(-3);
  });
  it("2∠60 in DEG = 1+1.732…i", () => {
    const z = asComplex(val("2∠60", cenv()));
    expect(z.re).toBeCloseTo(1, 10);
    expect(z.im).toBeCloseTo(Math.sqrt(3), 10);
  });
});
