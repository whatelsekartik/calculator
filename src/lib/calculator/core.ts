/**
 * Campus+ Scientific Calculator — core numeric types.
 * No eval()/Function anywhere in the engine: everything is parsed AST evaluation.
 */

export type AngleUnit = "deg" | "rad" | "grad";

export type VarName = "A" | "B" | "C" | "D" | "E" | "F" | "X" | "Y" | "M";

export const VAR_NAMES: VarName[] = ["A", "B", "C", "D", "E", "F", "X", "Y", "M"];

export type ErrorCode = "SYNTAX" | "MATH" | "ARG" | "DIM" | "OVERFLOW" | "VARIABLE" | "RANGE";

export class CalcError extends Error {
  code: ErrorCode;
  position: number | null;
  constructor(code: ErrorCode, message: string, position: number | null = null) {
    super(message);
    this.name = "CalcError";
    this.code = code;
    this.position = position;
  }
}

export const errSyntax = (msg = "Syntax ERROR", pos: number | null = null) =>
  new CalcError("SYNTAX", msg, pos);
export const errMath = (msg: string) => new CalcError("MATH", msg);
export const errArg = (msg = "Argument ERROR") => new CalcError("ARG", msg);
export const errDim = (msg = "Dimension ERROR") => new CalcError("DIM", msg);
export const errOverflow = () => new CalcError("OVERFLOW", "Overflow ERROR");
export const errRange = (msg = "Range ERROR") => new CalcError("RANGE", msg);

/* ------------------------------------------------------------------ */
/* Exact rational arithmetic                                           */
/* ------------------------------------------------------------------ */

/** integer gcd (Euclid) on safe magnitudes */
export function gcdInt(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function lcmInt(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  const g = gcdInt(a, b);
  return Math.abs((Math.round(a) / g) * Math.round(b));
}

const SAFE = 9e14; // keep numerator/denominator well below Number.MAX_SAFE_INTEGER

/** Exact rational number with automatic reduction. Falls back-safe when huge. */
export class Fraction {
  readonly n: number; // numerator (integer, sign carried here)
  readonly d: number; // denominator (positive integer)

  constructor(n: number, d: number) {
    if (!Number.isFinite(n) || !Number.isFinite(d)) {
      throw errMath("Fraction out of range");
    }
    if (d === 0) throw errMath("Division by zero");
    n = Math.round(n);
    d = Math.round(d);
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcdInt(n, d) || 1;
    this.n = n / g;
    this.d = d / g;
  }

  static of(n: number): Fraction {
    return new Fraction(n, 1);
  }

  /** exactness-safe add */
  add(o: Fraction): Fraction {
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Fraction): Fraction {
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Fraction): Fraction {
    return new Fraction(this.n * o.n, this.d * o.d);
  }
  div(o: Fraction): Fraction {
    if (o.n === 0) throw errMath("Division by zero");
    return new Fraction(this.n * o.d, this.d * o.n);
  }
  neg(): Fraction {
    return new Fraction(-this.n, this.d);
  }
  pow(k: number): Fraction {
    if (!Number.isInteger(k) || Math.abs(k) > 999) throw errMath("Non-integer exponent");
    if (this.n === 0 && k < 0) throw errMath("Division by zero");
    if (k >= 0) return new Fraction(Math.pow(this.n, k), Math.pow(this.d, k));
    return new Fraction(Math.pow(this.d, -k), Math.pow(this.n, -k));
  }
  /** stays exact if a multiplication with o keeps parts in safe range */
  isSafeWith(o: Fraction): boolean {
    return (
      Math.abs(this.n * o.d) < SAFE &&
      Math.abs(this.d * o.n) < SAFE &&
      this.d * o.d < SAFE &&
      Math.abs(this.n * o.n) < SAFE
    );
  }
  toNumber(): number {
    return this.n / this.d;
  }
  isInteger(): boolean {
    return this.d === 1;
  }
  isZero(): boolean {
    return this.n === 0;
  }
  sign(): number {
    return Math.sign(this.n);
  }
  absLessThan(o: Fraction): boolean {
    return Math.abs(this.n * o.d) < Math.abs(o.n * this.d);
  }
}

/**
 * Convert a decimal number to an exact Fraction when it is a
 * "clean" short decimal (like calculator d/c conversion). Returns null
 * when no small-denominator fraction matches.
 */
export function decimalToFraction(x: number, maxDen = 1e6): Fraction | null {
  if (!Number.isFinite(x)) return null;
  if (Number.isInteger(x) && Math.abs(x) < SAFE) return Fraction.of(x);
  // continued fractions search
  let bestN = 0;
  let bestD = 1;
  let bestErr = Infinity;
  let [h1, h2, k1, k2] = [1, 0, 0, 1];
  let b = x;
  const sign = x < 0 ? -1 : 1;
  b = Math.abs(x);
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(b);
    const h = a * h1 + h2;
    const k = a * k1 + k2;
    if (k > maxDen || !Number.isFinite(h) || !Number.isFinite(k)) break;
    const err = Math.abs(h / k - Math.abs(x));
    if (err < bestErr) {
      bestErr = err;
      bestN = h;
      bestD = k;
    }
    if (err < 1e-12) return new Fraction(sign * h, k);
    h2 = h1;
    h1 = h;
    k2 = k1;
    k1 = k;
    b = 1 / (b - a);
    if (!Number.isFinite(b)) break;
  }
  if (bestErr < 1e-10 * Math.max(1, Math.abs(x)) && bestD > 1) {
    return new Fraction(sign * bestN, bestD);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Complex numbers                                                     */
/* ------------------------------------------------------------------ */

export interface Complex {
  re: number;
  im: number;
}

export const cx = (re: number, im = 0): Complex => ({ re, im });

export const cxAdd = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
export const cxSub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
export const cxMul = (a: Complex, b: Complex): Complex =>
  cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const cxDiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) throw errMath("Division by zero");
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
export const cxAbs = (a: Complex): number => {
  const { re, im } = a;
  if (re === 0) return Math.abs(im);
  if (im === 0) return Math.abs(re);
  return Math.sqrt(re * re + im * im);
};
export const cxArg = (a: Complex): number => Math.atan2(a.im, a.re); // radians
export const cxConj = (a: Complex): Complex => cx(a.re, -a.im);
export const cxPolar = (r: number, thetaRad: number): Complex =>
  cx(r * Math.cos(thetaRad), r * Math.sin(thetaRad));
export const cxPow = (a: Complex, b: Complex): Complex => {
  if (b.im === 0 && b.re === 0) return cx(1, 0);
  if (a.re === 0 && a.im === 0) {
    if (b.im === 0 && b.re > 0) return cx(0, 0);
    throw errMath("Undefined 0 power");
  }
  // a^b = exp(b * Log(a))
  const r = cxAbs(a);
  const th = cxArg(a);
  const lr = Math.log(r);
  const mag = Math.exp(b.re * lr - b.im * th);
  const ang = b.re * th + b.im * lr;
  return cx(mag * Math.cos(ang), mag * Math.sin(ang));
};
export const cxExp = (a: Complex): Complex => {
  const m = Math.exp(a.re);
  return cx(m * Math.cos(a.im), m * Math.sin(a.im));
};
export const cxLn = (a: Complex): Complex => {
  if (a.re === 0 && a.im === 0) throw errMath("log of zero");
  return cx(Math.log(cxAbs(a)), cxArg(a));
};
export const cxSqrt = (a: Complex): Complex => cxPow(a, cx(0.5, 0));
export const cxSin = (a: Complex): Complex =>
  cx(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
export const cxCos = (a: Complex): Complex =>
  cx(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));
export const cxTan = (a: Complex): Complex => cxDiv(cxSin(a), cxCos(a));

/** clean tiny numeric residue caused by float noise */
export function cxClean(a: Complex): Complex {
  return cx(cleanFloat(a.re), cleanFloat(a.im));
}

/* ------------------------------------------------------------------ */
/* Float hygiene                                                       */
/* ------------------------------------------------------------------ */

/** snap values that are float-noise close to integers (trig boundaries etc.) */
export function cleanFloat(v: number): number {
  if (!Number.isFinite(v)) return v;
  const r = Math.round(v);
  if (Math.abs(v - r) < 1e-12 && Math.abs(r) < 1e12) return r;
  return v;
}

export function checkRange(v: number): number {
  if (Number.isNaN(v)) throw errMath("Math ERROR");
  if (!Number.isFinite(v) || Math.abs(v) >= 1e100) throw errOverflow();
  return v;
}

/* ------------------------------------------------------------------ */
/* Typed calculator values                                             */
/* ------------------------------------------------------------------ */

export type Value =
  | { kind: "num"; real: number; frac: Fraction | null }
  | { kind: "complex"; z: Complex }
  | { kind: "matrix"; m: number[][] }
  | { kind: "vector"; v: number[] }
  | { kind: "text"; s: string };

/** numeric real; may carry exact rational twin */
export const numVal = (real: number, frac: Fraction | null = null): Value => ({
  kind: "num",
  real,
  frac: frac && frac.isSafeWith(Fraction.of(1)) ? frac : frac,
});

export const intVal = (n: number): Value => {
  if (!Number.isInteger(n)) throw errMath("Expected integer");
  return { kind: "num", real: n, frac: Math.abs(n) < SAFE ? Fraction.of(n) : null };
};

export const fracVal = (f: Fraction): Value => ({ kind: "num", real: f.toNumber(), frac: f });
export const cxVal = (z: Complex): Value => ({ kind: "complex", z: cxClean(z) });
export const vecVal = (v: number[]): Value => ({ kind: "vector", v });
export const matVal = (m: number[][]): Value => ({ kind: "matrix", m });
export const textVal = (s: string): Value => ({ kind: "text", s });

/** Extract real number or throw dimension/type error */
export function asReal(v: Value): number {
  if (v.kind === "num") return v.real;
  if (v.kind === "complex") {
    if (Math.abs(v.z.im) < 1e-14) return v.z.re;
    throw errMath("Complex value not allowed here");
  }
  throw errMath("Expected a numeric value");
}

export function asComplex(v: Value): Complex {
  if (v.kind === "complex") return v.z;
  if (v.kind === "num") return cx(v.real, 0);
  throw errMath("Expected a complex value");
}

/** exact integer required */
export function asInt(v: Value, what = "integer"): number {
  const r = asReal(v);
  if (!Number.isInteger(r)) throw errMath(`Expected ${what}`);
  if (Math.abs(r) >= 1e15) throw errRange("Integer too large");
  return r;
}

/* ------------------------------------------------------------------ */
/* Number theory helpers                                               */
/* ------------------------------------------------------------------ */

export function primeFactorize(n: number): number[] {
  if (!Number.isInteger(n) || n < 1 || n >= 1e12) {
    throw errRange("Prime factorization needs an integer in [1, 10^12)");
  }
  const out: number[] = [];
  let rest = n;
  while (rest % 2 === 0) {
    out.push(2);
    rest /= 2;
  }
  for (let p = 3; p * p <= rest; p += 2) {
    while (rest % p === 0) {
      out.push(p);
      rest = rest / p;
    }
  }
  if (rest > 1) out.push(rest);
  return out;
}

/** format prime factor list like 2^3·3·5 */
export function factorizationText(factors: number[]): string {
  if (factors.length === 0) return "1";
  const counts = new Map<number, number>();
  for (const f of factors) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([p, c]) => (c > 1 ? `${p}^${c}` : `${p}`))
    .join("×");
}

/* ------------------------------------------------------------------ */
/* Angle conversion                                                    */
/* ------------------------------------------------------------------ */

export function toRadians(v: number, unit: AngleUnit): number {
  if (unit === "deg") return (v * Math.PI) / 180;
  if (unit === "grad") return (v * Math.PI) / 200;
  return v;
}
export function fromRadians(r: number, unit: AngleUnit): number {
  if (unit === "deg") return (r * 180) / Math.PI;
  if (unit === "grad") return (r * 200) / Math.PI;
  return r;
}

/** decimal degrees -> {d, m, s} */
export function toDMS(deg: number): { d: number; m: number; s: number } {
  const sign = deg < 0 ? -1 : 1;
  let x = Math.abs(deg);
  const d = Math.floor(x);
  x = (x - d) * 60;
  const m = Math.floor(x);
  const s = (x - m) * 60;
  return { d: sign * d, m, s };
}
