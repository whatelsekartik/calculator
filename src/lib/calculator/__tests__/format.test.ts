/**
 * Display formatting: Norm/Fix/Sci, engineering, separators,
 * fractions & mixed numbers, DMS, polar/rect complex.
 */
import { describe, it, expect } from "vitest";
import { realToText, valueToText, valueToNodes, DisplaySettings, dmsNodes } from "../format";
import { Fraction } from "../core";

const S = (over: Partial<DisplaySettings> = {}): DisplaySettings => ({
  angle: "deg",
  numFormat: { mode: "norm1", digits: 3 },
  eng: false,
  thousandsSep: false,
  fractionResult: true,
  mixedFractions: false,
  complexForm: "rect",
  ...over,
});

describe("number formatting", () => {
  it("Norm1 keeps plain decimals", () => {
    expect(realToText(0.30000000000000004, S())).toBe("0.3");
    expect(realToText(123456789, S())).toBe("123456789");
  });
  it("Norm1 switches to ×10^ outside [10^-2, 10^10)", () => {
    expect(realToText(12345678901, S())).toBe("1.23456789×10^10");
    expect(realToText(0.01, S())).toBe("0.01"); // boundary stays plain
    expect(realToText(0.001, S())).toBe("1×10^-3"); // below 10^-2 → sci
    expect(realToText(0.0001, S())).toBe("1×10^-4");
  });
  it("Norm2 widens the small range", () => {
    const s = S({ numFormat: { mode: "norm2", digits: 3 } });
    expect(realToText(0.00001, s)).toBe("0.00001");
  });
  it("Fix rounds to decimals with trailing zeros kept", () => {
    const s = S({ numFormat: { mode: "fix", digits: 2 } });
    expect(realToText(1 / 3, s)).toBe("0.33");
    expect(realToText(5, s)).toBe("5.00");
  });
  it("Sci: significant figures with exponent", () => {
    const s = S({ numFormat: { mode: "sci", digits: 4 } });
    expect(realToText(12345.678, s)).toBe("1.235×10^4");
  });
  it("Engineering notation forces multiple-of-3 exponents", () => {
    const s = S({ eng: true });
    expect(realToText(12345678, s)).toBe("12.345678×10^6");
    expect(realToText(0.000123, s)).toBe("123×10^-6");
  });
  it("thousands separators (spaces)", () => {
    const s = S({ thousandsSep: true });
    expect(realToText(1234567.89, s)).toBe("1 234 567.89");
  });
  it("negative numbers", () => {
    expect(realToText(-42.5, S())).toBe("-42.5");
  });
  it("large & tiny fall to exponents", () => {
    expect(realToText(9.99e99, S())).toContain("×10^99");
  });
});

describe("value formatting", () => {
  it("improper fraction 7/3", () => {
    const v = { kind: "num" as const, real: 7 / 3, frac: new Fraction(7, 3) };
    expect(valueToText(v, S())).toBe("(7)/(3)");
    const nodes = valueToNodes(v, S());
    expect(nodes.some((n) => n.t === "frac")).toBe(true);
  });
  it("mixed fraction style shows 2⌟1/3 parts", () => {
    const v = { kind: "num" as const, real: 7 / 3, frac: new Fraction(7, 3) };
    const nodes = valueToNodes(v, S({ mixedFractions: true }));
    const texts = nodes.filter((n) => n.t === "text").map((n) => (n as { s: string }).s);
    expect(texts).toContain("2");
    expect(nodes.some((n) => n.t === "frac")).toBe(true);
  });
  it("forceDecimal shows 0.333.. instead of fraction", () => {
    const v = { kind: "num" as const, real: 1 / 3, frac: new Fraction(1, 3) };
    const t = valueToText(v, S(), true);
    expect(t).toContain("0.333");
  });
  it("complex rect & polar", () => {
    const v = { kind: "complex" as const, z: { re: 1, im: 1 } };
    expect(valueToText(v, S())).toBe("1+1i");
    const p = valueToText(v, S({ complexForm: "polar" }));
    expect(p).toContain("∠45");
  });
  it("pure imaginary drops the real part", () => {
    const v = { kind: "complex" as const, z: { re: 0, im: 2 } };
    expect(valueToText(v, S())).toBe("2i");
  });
  it("DMS output 1.5041666 → 1°30′15″", () => {
    const nodes = dmsNodes(1 + 30 / 60 + 15 / 3600, S());
    const txt = nodes.map((n) => (n.t === "text" ? n.s : "")).join("");
    expect(txt).toBe("1°30′15″");
  });
});
