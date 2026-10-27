/**
 * Display formatting for calculator values.
 * Keeps the raw value, the display tree and the text form separate —
 * the rounded display string is never fed back into calculations.
 */

import { AngleUnit, Value, Fraction, cleanFloat } from "./core";
import { DNode, tNode } from "./display";

export type NumFormatMode = "norm1" | "norm2" | "fix" | "sci";

export interface DisplaySettings {
  angle: AngleUnit;
  numFormat: { mode: NumFormatMode; digits: number };
  eng: boolean;
  thousandsSep: boolean;
  fractionResult: boolean;
  mixedFractions: boolean;
  complexForm: "rect" | "polar";
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  angle: "deg",
  numFormat: { mode: "norm1", digits: 3 },
  eng: false,
  thousandsSep: false,
  fractionResult: true,
  mixedFractions: false,
  complexForm: "rect",
};

export function roundSig(x: number, sig: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const scale = Math.pow(10, exp - sig + 1);
  return Math.round(x / scale) * scale;
}

function addSeparators(intPart: string): string {
  const neg = intPart.startsWith("-") || intPart.startsWith("−");
  const digits = neg ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (neg ? intPart[0] : "") + grouped;
}

interface RealPieces {
  mantissa: string; // includes sign
  exponent: number | null;
}

export function decomposeReal(xInput: number, s: DisplaySettings): RealPieces {
  let x = cleanFloat(xInput);
  if (x === 0) return { mantissa: "0", exponent: null };
  if (!Number.isFinite(x)) return { mantissa: "Overflow", exponent: null };

  const { mode, digits } = s.numFormat;
  const absExp = Math.floor(Math.log10(Math.abs(x)));

  if (mode === "fix") {
    return { mantissa: x.toFixed(digits), exponent: null };
  }

  if (mode === "sci") {
    const sig = Math.max(1, digits);
    let exp = absExp;
    let mant = (x / Math.pow(10, exp)).toPrecision(sig);
    if (Math.abs(Number(mant)) >= 10) {
      exp += 1;
      mant = (x / Math.pow(10, exp)).toPrecision(sig);
    }
    return { mantissa: trimZeros(mant), exponent: exp };
  }

  // norm1 / norm2 (+ engineering) — toPrecision keeps decimal rounding exact
  const loExp = mode === "norm1" ? -2 : -9;
  let exp: number | null = null;
  if (s.eng) {
    // ENG engages ×10^k for |x| ≥ 10³ or ≤ 10⁻³ with exponents multiple of 3
    if (absExp >= 3 || absExp <= -3) exp = Math.floor(absExp / 3) * 3;
  } else if (absExp >= 10 || absExp < loExp) {
    exp = absExp;
  }
  if (exp === null) {
    return { mantissa: trimZeros(x.toPrecision(10)), exponent: null };
  }
  let mant = trimZeros((x / Math.pow(10, exp)).toPrecision(10));
  const cap = s.eng ? 1000 : 10;
  if (Math.abs(Number(mant)) >= cap) {
    exp += s.eng ? 3 : 1;
    mant = trimZeros((x / Math.pow(10, exp)).toPrecision(10));
  }
  return { mantissa: mant, exponent: exp };
}

function trimZeros(str: string): string {
  if (!str.includes(".") || str.includes("e")) return str;
  return str.replace(/0+$/, "").replace(/\.$/, "");
}

function applySeparators(mant: string, s: DisplaySettings, hasExp: boolean): string {
  if (!s.thousandsSep || hasExp) return mant;
  const dot = mant.indexOf(".");
  const intPart = dot >= 0 ? mant.slice(0, dot) : mant;
  const rest = dot >= 0 ? mant.slice(dot) : "";
  return addSeparators(intPart) + rest;
}

/** real number -> display nodes */
export function realToNodes(x: number, s: DisplaySettings): DNode[] {
  const p = decomposeReal(x, s);
  let mant = p.mantissa.replace("-", "−");
  mant = applySeparators(mant, s, p.exponent !== null);
  if (p.exponent === null) return [tNode(mant)];
  return [
    tNode(mant),
    { t: "sup", base: [tNode("×10")], pow: [tNode(String(p.exponent).replace("-", "−"))] },
  ];
}

export function realToText(x: number, s: DisplaySettings): string {
  const p = decomposeReal(x, s);
  const mant = applySeparators(p.mantissa, s, p.exponent !== null);
  return p.exponent === null ? mant : `${mant}×10^${p.exponent}`;
}

/** exact fraction -> display nodes (improper or mixed) */
export function fractionToNodes(f: Fraction, s: DisplaySettings): DNode[] {
  const neg = f.n < 0;
  const n = Math.abs(f.n);
  const d = f.d;
  if (d === 1) return [tNode((neg ? "−" : "") + String(n))];
  if (s.mixedFractions && n > d) {
    const whole = Math.floor(n / d);
    const rem = n % d;
    return [
      tNode((neg ? "−" : "") + String(whole)),
      { t: "frac", num: [tNode(String(rem))], den: [tNode(String(d))] },
    ];
  }
  return [
    tNode(neg ? "−" : ""),
    { t: "frac", num: [tNode(String(n))], den: [tNode(String(d))] },
  ];
}

export function valueToNodes(v: Value, s: DisplaySettings, forceDecimal = false): DNode[] {
  switch (v.kind) {
    case "num": {
      if (!forceDecimal && s.fractionResult && v.frac && v.frac.d !== 1) {
        return fractionToNodes(v.frac, s);
      }
      if (!forceDecimal && s.fractionResult && v.frac && v.frac.d === 1) {
        return [tNode(String(v.frac.n))];
      }
      return realToNodes(v.real, s);
    }
    case "complex": {
      const { re, im } = v.z;
      const isReal = Math.abs(im) < 1e-14;
      const isImag = Math.abs(re) < 1e-14;
      if (s.complexForm === "polar" && !isReal) {
        const r = Math.sqrt(re * re + im * im);
        let theta = Math.atan2(im, re);
        if (s.angle === "deg") theta = (theta * 180) / Math.PI;
        if (s.angle === "grad") theta = (theta * 200) / Math.PI;
        return [...realToNodes(r, s), tNode("∠"), ...realToNodes(theta, s)];
      }
      if (isReal) return realToNodes(re, s);
      if (isImag) return [...realToNodes(im, s), tNode("i")];
      const sign = im < 0 ? "−" : "+";
      const absIm = Math.abs(im);
      return [
        ...realToNodes(re, s),
        tNode(sign),
        ...(absIm === 1 ? [] : realToNodes(absIm, s)),
        tNode("i"),
      ];
    }
    case "matrix":
      return [
        {
          t: "matrix",
          rows: v.m.map((row) => row.map((x) => realToNodes(x, { ...s, thousandsSep: false }))),
        },
      ];
    case "vector":
      return [
        {
          t: "matrix",
          rows: v.v.map((x) => [realToNodes(x, { ...s, thousandsSep: false })]),
        },
      ];
    case "text":
      return [tNode(v.s)];
  }
}

export function valueToText(v: Value, s: DisplaySettings, forceDecimal = false): string {
  switch (v.kind) {
    case "num":
      if (!forceDecimal && s.fractionResult && v.frac && v.frac.d !== 1) {
        const f = v.frac;
        return `(${String(f.n)})/(${String(f.d)})`;
      }
      return realToText(v.real, s);
    case "complex": {
      const { re, im } = v.z;
      if (Math.abs(im) < 1e-14) return realToText(re, s);
      if (s.complexForm === "polar") {
        const r = Math.sqrt(re * re + im * im);
        let theta = Math.atan2(im, re);
        if (s.angle === "deg") theta = (theta * 180) / Math.PI;
        if (s.angle === "grad") theta = (theta * 200) / Math.PI;
        return `${realToText(r, s)}∠${realToText(theta, s)}`;
      }
      if (Math.abs(re) < 1e-14) return `${realToText(im, s)}i`;
      return `${realToText(re, s)}${im < 0 ? "-" : "+"}${realToText(Math.abs(im), s)}i`;
    }
    case "matrix":
      return `[${v.m.map((r) => r.map((x) => realToText(x, s)).join(", ")).join("; ")}]`;
    case "vector":
      return `[${v.v.map((x) => realToText(x, s)).join(", ")}]`;
    case "text":
      return v.s;
  }
}

/** decimal value -> DMS display like 12°30′15.24″ */
export function dmsNodes(x: number, s: DisplaySettings): DNode[] {
  const sign = x < 0 ? "−" : "";
  let ax = Math.abs(x);
  const d = Math.floor(ax);
  ax = (ax - d) * 60;
  const m = Math.floor(ax);
  const sec = roundSig((ax - m) * 60, 8);
  const secStr = Number.isInteger(sec) ? String(sec) : String(sec);
  return [tNode(`${sign}${d}°${m}′${secStr}″`)];
}
