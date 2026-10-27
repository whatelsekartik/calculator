/**
 * Statistics, regression, numerical calculus, Base-N, conversions.
 */
import { describe, it, expect } from "vitest";
import {
  DataRow, oneVarStats, twoVarStats, computeRegression, estimateY, estimateX,
} from "../statistics";
import { integrate, derivative, tableValues, compileFunction } from "../calculus";
import { evalBaseN, formatBase, baseTokens, groupBin } from "../basen";
import { convertUnit, CONSTANTS } from "../constants";
import { tok } from "../parser";

const rows = (xs: number[]): DataRow[] => xs.map((x) => ({ x, y: null, f: 1 }));

describe("one-variable statistics", () => {
  const s = oneVarStats(rows([1, 2, 3, 4, 5]));
  it("n, Σx, Σx², mean", () => {
    expect(s.n).toBe(5);
    expect(s.sum).toBe(15);
    expect(s.sumSq).toBe(55);
    expect(s.mean).toBe(3);
  });
  it("population vs sample spread are distinct and labeled", () => {
    expect(s.varPop).toBeCloseTo(2, 12);
    expect(s.sdPop).toBeCloseTo(Math.SQRT2, 12);
    expect(s.varSample).toBeCloseTo(2.5, 12);
    expect(s.sdSample).toBeCloseTo(Math.sqrt(2.5), 12);
  });
  it("min/q1/med/q3/max", () => {
    expect(s.min).toBe(1);
    expect(s.q1).toBe(1.5);
    expect(s.med).toBe(3);
    expect(s.q3).toBe(4.5);
    expect(s.max).toBe(5);
  });
  it("frequency column respected", () => {
    const f = oneVarStats([{ x: 1, y: null, f: 2 }, { x: 3, y: null, f: 2 }]);
    expect(f.n).toBe(4);
    expect(f.mean).toBe(2);
  });
});

describe("two-variable regression", () => {
  const data: DataRow[] = [
    { x: 1, y: 3, f: 1 },
    { x: 2, y: 5, f: 1 },
    { x: 3, y: 7, f: 1 },
  ];
  it("linear y = a + bx through collinear data", () => {
    const r = computeRegression(data, "linear");
    expect(r.valid).toBe(true);
    expect(r.a).toBeCloseTo(1, 10);
    expect(r.b).toBeCloseTo(2, 10);
    expect(r.r).toBeCloseTo(1, 12);
  });
  it("ŷ / x̂ estimation works on linear model", () => {
    const r = computeRegression(data, "linear");
    expect(estimateY(r, 4)).toBeCloseTo(9, 10);
    expect(estimateX(r, 9)).toBeCloseTo(4, 10);
  });
  it("quadratic regression recovers 1 + 2x + 3x²", () => {
    const q: DataRow[] = [0, 1, 2, 3].map((x) => ({ x, y: 1 + 2 * x + 3 * x * x, f: 1 }));
    const r = computeRegression(q, "quad");
    expect(r.valid).toBe(true);
    expect(r.a).toBeCloseTo(1, 6);
    expect(r.b).toBeCloseTo(2, 6);
    expect(r.c).toBeCloseTo(3, 6);
  });
  it("power regression recovers y = 2·x^3", () => {
    const q: DataRow[] = [1, 2, 3, 4].map((x) => ({ x, y: 2 * Math.pow(x, 3), f: 1 }));
    const r = computeRegression(q, "power");
    expect(r.valid).toBe(true);
    expect(r.a).toBeCloseTo(2, 6);
    expect(r.b).toBeCloseTo(3, 6);
  });
  it("exponential regression rejects y ≤ 0 with explanation", () => {
    const q: DataRow[] = [
      { x: 1, y: -2, f: 1 },
      { x: 2, y: 5, f: 1 },
    ];
    const r = computeRegression(q, "exp");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/y must be > 0/);
  });
  it("two-var summary & correlation", () => {
    const t = twoVarStats(data);
    expect(t.r).toBeCloseTo(1, 12);
    expect(t.x.mean).toBeCloseTo(2, 12);
    expect(t.y.mean).toBeCloseTo(5, 12);
    expect(t.sumXY).toBe(34); // 1·3 + 2·5 + 3·7 = 34
  });
});

describe("numerical calculus", () => {
  const vars = {};
  it("∫₀¹ x² dx = 1/3", () => {
    const f = compileFunction("X^2", vars, "deg");
    expect(integrate(f, 0, 1)).toBeCloseTo(1 / 3, 9);
  });
  it("∫ sin from 0..π = 2 (rad)", () => {
    const f = compileFunction("sin(X)", vars, "rad");
    expect(integrate(f, 0, Math.PI)).toBeCloseTo(2, 9);
  });
  it("∫ in reverse swaps the sign", () => {
    const f = compileFunction("X^2", vars, "deg");
    expect(integrate(f, 1, 0)).toBeCloseTo(-1 / 3, 9);
  });
  it("d/dx(x³) at x=2 = 12", () => {
    const f = compileFunction("X^3", vars, "deg");
    expect(derivative(f, 2)).toBeCloseTo(12, 6);
  });
  it("d/dx(sin) at 0 = 1 (rad)", () => {
    const f = compileFunction("sin(X)", vars, "rad");
    expect(derivative(f, 0)).toBeCloseTo(1, 8);
  });
  it("table values with bounds and step validation", () => {
    const f = compileFunction("X^2", vars, "deg");
    const rows2 = tableValues(f, null, 1, 5, 2);
    expect(rows2.map((r) => [r.x, r.fx])).toEqual([[1, 1], [3, 9], [5, 25]]);
    expect(() => tableValues(f, null, 1, 5, -1)).toThrow(/Step sign/);
    expect(() => tableValues(f, null, 1, 10000, 1)).toThrow(/45 rows/);
  });
  it("∫/d-dx are engine functions too (catalog path)", async () => {
    const { calculateString } = await import("../engine");
    const { DEFAULT_SETTINGS } = await import("../session");
    const r = calculateString("integ(X^2,0,1)", {
      settings: { ...DEFAULT_SETTINGS, angle: "deg" }, vars: {}, complexMode: false,
    });
    if (!r.ok) throw new Error(r.message);
    expect(r.value.kind).toBe("num");
    if (r.value.kind === "num") expect(r.value.real).toBeCloseTo(1 / 3, 9);
    const d = calculateString("diff(X^3,2)", {
      settings: { ...DEFAULT_SETTINGS, angle: "deg" }, vars: {}, complexMode: false,
    });
    if (!d.ok) throw new Error(d.message);
    if (d.value.kind === "num") expect(d.value.real).toBeCloseTo(12, 6);
  });
});

describe("Base-N mode", () => {
  const op = (s: string) => tok("op", s);
  it("hex FF + 1 = 100h", () => {
    const r = evalBaseN([...baseTokens("FF"), op("+"), ...baseTokens("1")], "hex");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(256);
    expect(formatBase(r.value!, "hex")).toBe("100");
  });
  it("bin 1010 and 1100 = 1000", () => {
    const r = evalBaseN([...baseTokens("1010"), op("and"), ...baseTokens("1100")], "bin");
    expect(r.value).toBe(8);
    expect(formatBase(8, "bin")).toBe("1000");
  });
  it("xor / xnor / neg (NOT)", () => {
    expect(evalBaseN([...baseTokens("1010"), op("xor"), ...baseTokens("0110")], "bin").value).toBe(12);
    const a = evalBaseN([...baseTokens("5"), op("xnor"), ...baseTokens("3")], "dec").value!;
    expect(a & 0xffff).toBe(0xffff & ~(5 ^ 3));
    expect(evalBaseN([tok("func", "neg"), tok("lp", "("), ...baseTokens("1"), tok("rp", ")")], "dec").value).toBe(-2);
  });
  it("-1 shown as 32-bit two's complement: FFFFFFFF", () => {
    const r = evalBaseN([...baseTokens("0"), op("-"), ...baseTokens("1")], "dec");
    expect(r.value).toBe(-1);
    expect(formatBase(r.value!, "hex")).toBe("FFFFFFFF");
    expect(formatBase(r.value!, "bin")).toBe("11111111111111111111111111111111");
    expect(formatBase(r.value!, "oct")).toBe("37777777777");
  });
  it("division truncates toward zero (7 ÷ 2 = 3)", () => {
    expect(evalBaseN([...baseTokens("7"), op("/"), ...baseTokens("2")], "dec").value).toBe(3);
  });
  it("digit validation: 2 is invalid in BIN", () => {
    const r = evalBaseN(baseTokens("12"), "bin");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("SYNTAX");
  });
  it("binary grouping for display", () => {
    expect(groupBin("101011")).toBe("0010 1011");
  });
});

describe("constants & conversions", () => {
  it("constants carry name, value, unit", () => {
    const c = CONSTANTS.find((k) => k.id === "c")!;
    expect(c.value).toBe(299792458);
    expect(c.unit).toBe("m/s");
    const na = CONSTANTS.find((k) => k.id === "NA")!;
    expect(na.value).toBeCloseTo(6.02214076e23, 15);
  });
  it("length: 1 mile = 1.609344 km", () => {
    expect(convertUnit("length", "mi", "km", 1)).toBeCloseTo(1.609344, 12);
  });
  it("mass: 1 lb = 453.59237 g", () => {
    expect(convertUnit("mass", "lb", "g", 1)).toBeCloseTo(453.59237, 8);
  });
  it("temperature: 32°F = 0°C, 212°F = 100°C", () => {
    expect(convertUnit("temp", "f", "c", 32)).toBeCloseTo(0, 10);
    expect(convertUnit("temp", "f", "c", 212)).toBeCloseTo(100, 10);
    expect(convertUnit("temp", "c", "k", 0)).toBeCloseTo(273.15, 10);
  });
  it("energy: 1 kWh = 3.6 MJ", () => {
    expect(convertUnit("energy", "kwh", "j", 1)).toBeCloseTo(3.6e6, 0);
  });
  it("pressure: 1 atm = 101325 Pa", () => {
    expect(convertUnit("pressure", "atm", "pa", 1)).toBe(101325);
  });
});
