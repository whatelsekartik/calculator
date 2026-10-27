/**
 * AST evaluator. Produces typed values with an exact rational path for
 * pure fraction arithmetic. Never uses eval/Function.
 */

import {
  AngleUnit, Value, Complex, Fraction, CalcError,
  errMath, errArg, errDim, errRange, errSyntax, errOverflow,
  numVal, intVal, fracVal, cxVal, vecVal, matVal, textVal,
  asReal, asComplex, asInt,
  cx, cxAdd, cxSub, cxMul, cxDiv, cxAbs, cxArg, cxConj, cxPolar, cxPow,
  cxExp, cxLn, cxSqrt, cxSin, cxCos, cxClean, cleanFloat, checkRange,
  toRadians, fromRadians, gcdInt, lcmInt, primeFactorize, factorizationText,
} from "./core";
import { Ast } from "./parser";
import {
  matAdd, matMul, matScalar, matDet, matInverse, matPow, matTranspose, matDims,
  vecAdd, vecScalar, vecDot, vecCross, vecNorm, vecUnit, vecAngle,
} from "./matrix";
import { integrate, derivative } from "./calculus";

export interface EvalCtx {
  angle: AngleUnit;
  vars: Record<string, Value | null>;
  complexMode: boolean;
  rand: () => number;
}

/* ------------------------------------------------------------------ */
/* numeric binary ops                                                  */
/* ------------------------------------------------------------------ */

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw errMath("Factorial needs an integer ≥ 0");
  if (n > 170) throw errOverflow();
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function nPr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
    throw errMath("nPr needs integers with 0 ≤ r ≤ n");
  }
  let out = 1;
  for (let i = 0; i < r; i++) out *= n - i;
  return checkRange(out);
}
function nCr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
    throw errMath("nCr needs integers with 0 ≤ r ≤ n");
  }
  r = Math.min(r, n - r);
  let out = 1;
  for (let i = 1; i <= r; i++) out = (out * (n - r + i)) / i;
  return checkRange(Math.round(out));
}

function logicOp(op: string, a: number, b: number): number {
  const x = a | 0; // 32-bit signed, like the hardware
  const y = b | 0;
  switch (op) {
    case "and": return x & y;
    case "or": return x | y;
    case "xor": return x ^ y;
    case "xnor": return ~(x ^ y);
    default: throw errSyntax();
  }
}

function powReal(a: number, b: number, ctx: EvalCtx): Value {
  if (a === 0) {
    if (b === 0) return intVal(1);
    if (b < 0) throw errMath("Division by zero");
    return intVal(0);
  }
  if (a < 0 && !Number.isInteger(b)) {
    if (ctx.complexMode) return cxVal(cxPow(cx(a, 0), cx(b, 0)));
    throw errMath("Negative base with non-integer exponent");
  }
  const r = Math.pow(a, b);
  return numVal(cleanFloat(checkRange(r)));
}

function numBinary(op: string, l: Extract<Value, { kind: "num" }>, r: Extract<Value, { kind: "num" }>, ctx: EvalCtx): Value {
  const lf = l.frac;
  const rf = r.frac;
  const exact = !!(lf && rf && lf.isSafeWith(rf));
  switch (op) {
    case "+":
    case "imp":
    case "*":
      if (op === "+") {
        if (exact) return fracVal(lf!.add(rf!));
        return numVal(cleanFloat(checkRange(l.real + r.real)));
      }
      if (exact) return fracVal(lf!.mul(rf!));
      return numVal(cleanFloat(checkRange(l.real * r.real)));
    case "-":
      if (exact) return fracVal(lf!.sub(rf!));
      return numVal(cleanFloat(checkRange(l.real - r.real)));
    case "/":
      if (r.real === 0) throw errMath("Division by zero");
      if (exact) return fracVal(lf!.div(rf!));
      return numVal(cleanFloat(checkRange(l.real / r.real)));
    case "^": {
      if (exact && rf!.isInteger() && Math.abs(rf!.n) <= 64) {
        try {
          const f = lf!.pow(rf!.n);
          if (f.isSafeWith(Fraction.of(1))) return fracVal(f);
        } catch (e) {
          if (e instanceof CalcError && e.code === "MATH") throw e;
        }
      }
      return powReal(l.real, r.real, ctx);
    }
    case "E10": {
      const p = Math.pow(10, r.real);
      if (!Number.isFinite(p)) throw errOverflow();
      if (exact && rf!.isInteger() && Math.abs(rf!.n) <= 14 && rf!.n >= -14) {
        const k = rf!.n;
        const f = k >= 0 ? lf!.mul(new Fraction(Math.pow(10, k), 1)) : lf!.div(new Fraction(Math.pow(10, -k), 1));
        if (f.isSafeWith(Fraction.of(1))) return fracVal(f);
      }
      return numVal(cleanFloat(checkRange(l.real * p)));
    }
    case "P": return numVal(nPr(asInt({ kind: "num", real: l.real, frac: l.frac }), asInt({ kind: "num", real: r.real, frac: r.frac })));
    case "C": return numVal(nCr(asInt({ kind: "num", real: l.real, frac: l.frac }), asInt({ kind: "num", real: r.real, frac: r.frac })));
    case "gcd": return intVal(gcdInt(asInt({ kind: "num", real: l.real, frac: l.frac }), asInt({ kind: "num", real: r.real, frac: r.frac })));
    case "lcm": return intVal(lcmInt(asInt({ kind: "num", real: l.real, frac: l.frac }), asInt({ kind: "num", real: r.real, frac: r.frac })));
    case "and": case "or": case "xor": case "xnor":
      return numVal(logicOp(op, asInt({ kind: "num", real: l.real, frac: l.frac }, "32-bit integer"), asInt({ kind: "num", real: r.real, frac: r.frac }, "32-bit integer")));
    case "angle":
      throw errMath("Polar input requires complex handling");
    default:
      throw errSyntax(`Unknown operator ${op}`);
  }
}

/* ------------------------------------------------------------------ */
/* main evaluator                                                      */
/* ------------------------------------------------------------------ */

export function evaluate(node: Ast, ctx: EvalCtx): Value {
  switch (node.t) {
    case "empty":
      throw errSyntax("Incomplete expression", node.pos);
    case "num": {
      const { v } = node;
      if (Number.isInteger(v) && Math.abs(v) < 9e14) return intVal(v);
      return numVal(v);
    }
    case "const":
      if (node.name === "pi") return numVal(Math.PI);
      if (node.name === "e") return numVal(Math.E);
      return cxVal(cx(0, 1));
    case "var": {
      const v = ctx.vars[node.name];
      if (v === undefined || v === null) {
        if (node.name.startsWith("Mat") || node.name.startsWith("Vct")) {
          throw new CalcError("VARIABLE", `${node.name} is not defined yet`);
        }
        if (node.name === "Ans") return intVal(0);
        return intVal(0); // fresh variables start at 0 like the hardware
      }
      return v;
    }
    case "group":
      return evaluate(node.e, ctx);
    case "unary": {
      const v = evaluate(node.e, ctx);
      return vNeg(v);
    }
    case "postfix":
      return evalPostfix(node.op, evaluate(node.e, ctx));
    case "binary":
      return evalBinary(node.op, evaluate(node.l, ctx), evaluate(node.r, ctx), ctx);
    case "mixed": {
      const w = evaluate(node.whole, ctx);
      const n = evaluate(node.num, ctx);
      const d = evaluate(node.den, ctx);
      if (w.kind !== "num" || n.kind !== "num" || d.kind !== "num") throw errMath("Mixed fraction needs numbers");
      if (w.frac && n.frac && d.frac) {
        // exact: whole + num/den (sign carried by whole)
        const f = w.frac.add(n.frac.div(d.frac).mul(Fraction.of(Math.sign(w.frac.n) === 0 ? 1 : Math.sign(w.frac.n))));
        return fracVal(f);
      }
      const r = w.real + Math.sign(w.real || 1) * (n.real / d.real);
      return numVal(cleanFloat(checkRange(r)));
    }
    case "dms": {
      const parts = node.parts.slice(0, 3).map((p) => asReal(evaluate(p, ctx)));
      const a = parts[0] ?? 0;
      const b = parts[1] ?? 0;
      const c = parts[2] ?? 0;
      if (b < 0 || b >= 60 || c < 0 || c >= 60) {
        throw errMath("Minutes/seconds must be in [0, 60)");
      }
      const sign = a < 0 ? -1 : 1;
      return numVal(checkRange(a + sign * (b / 60 + c / 3600)));
    }
    case "func":
      return evalFunc(node.name, node.args, ctx, node.pos);
    default:
      throw errSyntax();
  }
}

function vNeg(v: Value): Value {
  switch (v.kind) {
    case "num":
      return v.frac ? fracVal(v.frac.neg()) : numVal(-v.real);
    case "complex":
      return cxVal(cx(-v.z.re, -v.z.im));
    case "matrix":
      return matVal(matScalar(v.m, -1));
    case "vector":
      return vecVal(vecScalar(v.v, -1));
    default:
      throw errMath("Cannot negate");
  }
}

function evalPostfix(op: string, v: Value): Value {
  if (op === "!") {
    const n = asReal(v);
    const r = factorial(n);
    return n <= 18 ? intVal(Math.round(r)) : numVal(r);
  }
  if (op === "%") {
    if (v.kind !== "num") throw errMath("% needs a real number");
    if (v.frac) return fracVal(v.frac.div(Fraction.of(100)));
    return numVal(v.real / 100);
  }
  if (op === "sq" || op === "cube") {
    const k = op === "sq" ? 2 : 3;
    if (v.kind === "matrix") return matVal(matPow(v.m, k));
    if (v.kind === "vector") throw errMath("Cannot square a vector (use dot product)");
    if (v.kind === "complex") return cxVal(cxPow(v.z, cx(k, 0)));
    if (v.kind !== "num") throw errMath("Power needs a number");
    if (v.frac) {
      const f = v.frac.pow(k);
      if (f.isSafeWith(Fraction.of(1))) return fracVal(f);
    }
    return numVal(cleanFloat(checkRange(Math.pow(v.real, k))));
  }
  if (op === "T") {
    if (v.kind !== "matrix") throw errDim("Transpose needs a matrix");
    return matVal(matTranspose(v.m));
  }
  if (op === "recip") {
    if (v.kind === "matrix") return matVal(matInverse(v.m));
    if (v.kind === "complex") return cxVal(cxDiv(cx(1, 0), v.z));
    if (v.kind !== "num") throw errMath("Reciprocal needs a number");
    if (v.real === 0) throw errMath("Division by zero");
    if (v.frac) return fracVal(v.frac.div(Fraction.of(1)));
    return numVal(cleanFloat(checkRange(1 / v.real)));
  }
  throw errSyntax("Bad postfix");
}

/* ------------------------------------------------------------------ */

function promoteComplex(a: Value, b: Value): [Complex, Complex] {
  return [asComplex(a), asComplex(b)];
}

function evalBinary(op: string, l: Value, r: Value, ctx: EvalCtx): Value {
  if (l.kind === "text" || r.kind === "text") throw errMath("Text cannot be used in arithmetic");

  // angle operator
  if (op === "angle") {
    if (l.kind !== "num" || r.kind !== "num") throw errMath("Polar form needs real radius and angle");
    return cxVal(cxPolar(l.real, toRadians(r.real, ctx.angle)));
  }

  // matrix involvement
  if (l.kind === "matrix" || r.kind === "matrix") {
    return matrixBinary(op, l, r, ctx);
  }
  if (l.kind === "vector" || r.kind === "vector") {
    return vectorBinary(op, l, r);
  }

  // complex involvement
  if (l.kind === "complex" || r.kind === "complex") {
    const [a, b] = promoteComplex(l, r);
    switch (op) {
      case "+": return cxVal(cxAdd(a, b));
      case "-": return cxVal(cxSub(a, b));
      case "*": case "imp": return cxVal(cxMul(a, b));
      case "/": {
        if (Math.abs(b.re) < 1e-300 && Math.abs(b.im) < 1e-300) throw errMath("Division by zero");
        return cxVal(cxDiv(a, b));
      }
      case "^": return cxVal(cxPow(a, b));
      case "E10": {
        if (b.im !== 0) throw errMath("×10^ exponent must be real");
        return cxVal(cxMul(a, cx(Math.pow(10, b.re), 0)));
      }
      default:
        throw errMath("Operation not defined for complex values");
    }
  }

  return numBinary(op, l as Extract<Value, { kind: "num" }>, r as Extract<Value, { kind: "num" }>, ctx);
}

function matrixBinary(op: string, l: Value, r: Value, ctx: EvalCtx): Value {
  const lm = l.kind === "matrix" ? l.m : null;
  const rm = r.kind === "matrix" ? r.m : null;
  const lv = l.kind === "vector" ? l.v : null;
  const rv = r.kind === "vector" ? r.v : null;

  if (op === "+" || op === "-") {
    if (!lm || !rm) throw errDim("Both operands must be matrices");
    return matVal(matAdd(lm, rm, op === "+" ? 1 : -1));
  }
  if (op === "*" || op === "imp") {
    if (lm && rm) return matVal(matMul(lm, rm));
    if (lm && rv) {
      const res = matMul(lm, rv.map((x) => [x]));
      return vecVal(res.map((row) => row[0]));
    }
    if (lm && r.kind === "num") return matVal(matScalar(lm, asReal(r)));
    if (l.kind === "num" && rm) return matVal(matScalar(rm, asReal(l)));
    throw errDim("Invalid matrix multiplication");
  }
  if (op === "/") {
    if (lm && r.kind === "num") {
      const d = asReal(r);
      if (d === 0) throw errMath("Division by zero");
      return matVal(matScalar(lm, 1 / d));
    }
    if (lm && rm) return matVal(matMul(lm, matInverse(rm)));
    throw errDim("Invalid matrix division");
  }
  if (op === "^") {
    if (!lm) throw errDim("Matrix power needs a matrix base");
    const k = asInt(r);
    return matVal(matPow(lm, k));
  }
  throw errMath(`Operator ${op} not defined for matrices`);
}

function vectorBinary(op: string, l: Value, r: Value): Value {
  const lv = l.kind === "vector" ? l.v : null;
  const rv = r.kind === "vector" ? r.v : null;
  if ((op === "+" || op === "-") && lv && rv) return vecVal(vecAdd(lv, rv, op === "+" ? 1 : -1));
  if ((op === "*" || op === "imp")) {
    if (lv && l.kind === "vector" && r.kind === "num") return vecVal(vecScalar(lv, asReal(r)));
    if (rv && r.kind === "vector" && l.kind === "num") return vecVal(vecScalar(rv, asReal(l)));
    if (lv && rv) throw errMath("Use dot( or cross( for vector products");
  }
  if (op === "/" && lv && r.kind === "num") {
    const d = asReal(r);
    if (d === 0) throw errMath("Division by zero");
    return vecVal(vecScalar(lv, 1 / d));
  }
  throw errMath(`Operator ${op} not defined for vectors`);
}

/* ------------------------------------------------------------------ */
/* functions                                                           */
/* ------------------------------------------------------------------ */

function trigSnap(v: number): number {
  // snap to exact multiples of 0.5 when IEEE residue is detected
  // (sin 30° = 0.5, tan 45° = 1, sin 180° = 0 …) like the hardware does
  const m = Math.round(v * 2) / 2;
  if (Math.abs(v - m) < 1e-13 && Math.abs(m) <= 2) return m;
  return v;
}

function evalFunc(name: string, args: Ast[], ctx: EvalCtx, pos: number): Value {
  const vals = args.map((a) => ({ a, evaluated: false as boolean, v: null as Value | null }));
  const get = (k: number): Value => {
    const e = vals[k];
    if (!e) throw errArg(`${name} needs ${k + 1} args`);
    if (!e.evaluated) {
      e.v = evaluate(e.a, ctx);
      e.evaluated = true;
    }
    return e.v!;
  };
  const argc = args.length;
  const need = (n: number) => {
    if (argc !== n) throw errArg(`${name} takes ${n} argument${n === 1 ? "" : "s"}`);
  };

  switch (name) {
    /* ------- trigonometry (angle-unit aware) ------- */
    case "sin": case "cos": case "tan": {
      need(1);
      const v = get(0);
      if (v.kind === "complex") {
        // standard convention: complex trig in radians
        const z = v.z;
        const s = cxSin(z);
        const c = cxCos(z);
        if (name === "sin") return cxVal(s);
        if (name === "cos") return cxVal(c);
        return cxVal(cxClean(cxDiv(s, c)));
      }
      const rad = toRadians(asReal(v), ctx.angle);
      const raw = name === "sin" ? Math.sin(rad) : name === "cos" ? Math.cos(rad) : Math.tan(rad);
      return numVal(cleanFloat(trigSnap(raw)));
    }
    case "asin": case "acos": case "atan": {
      need(1);
      const v = get(0);
      const x = asReal(v);
      let rad: number;
      if (name === "asin") {
        if (x < -1 || x > 1) {
          if (ctx.complexMode) return cxVal(cnAsin(asComplex(v)));
          throw errMath("asin domain is [-1, 1]");
        }
        rad = Math.asin(x);
      } else if (name === "acos") {
        if (x < -1 || x > 1) {
          if (ctx.complexMode) return cxVal(cnAcos(asComplex(v)));
          throw errMath("acos domain is [-1, 1]");
        }
        rad = Math.acos(x);
      } else rad = Math.atan(x);
      return numVal(cleanFloat(trigSnap(fromRadians(rad, ctx.angle))));
    }
    case "sinh": case "cosh": case "tanh": {
      need(1);
      const v = get(0);
      if (v.kind === "complex") {
        const z = v.z;
        const ez = cxExp(z);
        const emz = cxExp(cx(-z.re, -z.im));
        const sh = cxMul(cx(0.5, 0), cxSub(ez, emz));
        const ch = cxMul(cx(0.5, 0), cxAdd(ez, emz));
        if (name === "sinh") return cxVal(sh);
        if (name === "cosh") return cxVal(ch);
        return cxVal(cxClean(cxDiv(sh, ch)));
      }
      const x = asReal(v);
      const raw = name === "sinh" ? Math.sinh(x) : name === "cosh" ? Math.cosh(x) : Math.tanh(x);
      return numVal(cleanFloat(checkRange(raw)));
    }
    case "asinh": case "acosh": case "atanh": {
      need(1);
      const v = get(0);
      const x = asReal(v);
      if (name === "acosh" && x < 1) throw errMath("acosh domain is [1, ∞)");
      if (name === "atanh" && (x <= -1 || x >= 1)) throw errMath("atanh domain is (-1, 1)");
      const raw =
        name === "asinh" ? Math.asinh(x) : name === "acosh" ? Math.acosh(x) : Math.atanh(x);
      return numVal(cleanFloat(raw));
    }

    /* ------- logarithms & exponentials ------- */
    case "ln": {
      need(1);
      const v = get(0);
      if (v.kind === "complex") return cxVal(cxLn(v.z));
      const x = asReal(v);
      if (x === 0) throw errMath("ln(0) is undefined");
      if (x < 0) {
        if (ctx.complexMode) return cxVal(cxLn(cx(x, 0)));
        throw errMath("ln of a negative number");
      }
      return numVal(cleanFloat(Math.log(x)));
    }
    case "log": {
      need(1);
      const v = get(0);
      if (v.kind === "complex") return cxVal(cxDiv(cxLn(v.z), cx(Math.LN10, 0)));
      const x = asReal(v);
      if (x === 0) throw errMath("log(0) is undefined");
      if (x < 0) {
        if (ctx.complexMode) return cxVal(cxDiv(cxLn(cx(x, 0)), cx(Math.LN10, 0)));
        throw errMath("log of a negative number");
      }
      return numVal(cleanFloat(Math.log10(x)));
    }
    case "logb": {
      need(2);
      const base = asReal(get(0));
      const x = asReal(get(1));
      if (base <= 0 || base === 1) throw errMath("Log base must be > 0 and ≠ 1");
      if (x <= 0) throw errMath("Log argument must be > 0");
      return numVal(cleanFloat(Math.log(x) / Math.log(base)));
    }
    case "expe": case "exp10": {
      need(1);
      const v = get(0);
      if (v.kind === "complex") {
        if (name === "expe") return cxVal(cxExp(v.z));
        return cxVal(cxExp(cxMul(v.z, cx(Math.LN10, 0))));
      }
      const x = asReal(v);
      return numVal(cleanFloat(checkRange(name === "expe" ? Math.exp(x) : Math.pow(10, x))));
    }

    /* ------- roots ------- */
    case "sqrt": {
      need(1);
      const v = get(0);
      if (v.kind === "complex") return cxVal(cxSqrt(v.z));
      const x = asReal(v);
      if (x < 0) {
        if (ctx.complexMode) return cxVal(cxSqrt(cx(x, 0)));
        throw errMath("√ of a negative number");
      }
      const r = Math.sqrt(x);
      return numVal(cleanFloat(r));
    }
    case "cbrt": {
      need(1);
      const x = asReal(get(0));
      return numVal(cleanFloat(Math.cbrt(x)));
    }
    case "xroot": {
      need(2);
      const n = asReal(get(0));
      const x = asReal(get(1));
      if (n === 0) throw errMath("Root index cannot be 0");
      if (x < 0 && !Number.isInteger(n)) throw errMath("Even/ir rational root of a negative");
      const r = x < 0 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n);
      return numVal(cleanFloat(checkRange(r)));
    }

    /* ------- complex ------- */
    case "abs": {
      need(1);
      const v = get(0);
      if (v.kind === "num") return v.frac ? fracVal(new Fraction(Math.abs(v.frac.n), v.frac.d)) : numVal(Math.abs(v.real));
      if (v.kind === "complex") return numVal(cleanFloat(cxAbs(v.z)));
      if (v.kind === "vector") return numVal(cleanFloat(vecNorm(v.v)));
      throw errMath("abs needs a number, complex value or vector");
    }
    case "arg": {
      need(1);
      const z = asComplex(get(0));
      if (z.re === 0 && z.im === 0) throw errMath("arg(0) is undefined");
      return numVal(cleanFloat(fromRadians(cxArg(z), ctx.angle)));
    }
    case "conjg": {
      need(1);
      return cxVal(cxConj(asComplex(get(0))));
    }

    /* ------- probability / misc ------- */
    case "ran#": {
      if (argc !== 0) throw errArg("Ran# takes no arguments");
      // hardware style: 0.000 – 0.999
      return numVal(Math.floor(ctx.rand() * 1000) / 1000);
    }
    case "ranint": {
      need(2);
      let a = asInt(get(0));
      let b = asInt(get(1));
      if (a > b) [a, b] = [b, a];
      if (b - a > 1e10) throw errRange("RanInt# range too wide");
      return intVal(a + Math.floor(ctx.rand() * (b - a + 1)));
    }
    case "primefact": {
      need(1);
      const n = asInt(get(0));
      if (n < 1) throw errMath("Prime factorization needs an integer ≥ 1");
      return textVal(factorizationText(primeFactorize(n)));
    }
    case "sigma": {
      if (argc !== 3) throw errArg("Σ takes (expression, start, end)");
      const start = asInt(get(1));
      const end = asInt(get(2));
      if (end < start) throw errMath("Σ: end must be ≥ start");
      if (end - start > 10000) throw errRange("Σ range limited to 10000 terms");
      let sum = 0;
      const prevX = ctx.vars["X"];
      for (let k = start; k <= end; k++) {
        ctx.vars["X"] = intVal(k);
        sum += asReal(evaluate(args[0], ctx));
        if (!Number.isFinite(sum)) {
          ctx.vars["X"] = prevX;
          throw errMath("Σ diverged");
        }
      }
      ctx.vars["X"] = prevX;
      return numVal(cleanFloat(checkRange(sum)));
    }
    case "integ": {
      if (argc !== 3) throw errArg("∫ takes (f(x), lower, upper)");
      const lo = asReal(get(1));
      const hi = asReal(get(2));
      const prevX = ctx.vars["X"];
      const f = (x: number): number => {
        ctx.vars["X"] = numVal(x);
        return asReal(evaluate(args[0], ctx));
      };
      let out: number;
      try {
        out = integrate(f, lo, hi);
      } finally {
        ctx.vars["X"] = prevX;
      }
      return numVal(cleanFloat(checkRange(out)));
    }
    case "diff": {
      if (argc !== 2) throw errArg("d/dx takes (f(x), point)");
      const x0 = asReal(get(1));
      const prevX = ctx.vars["X"];
      const f = (x: number): number => {
        ctx.vars["X"] = numVal(x);
        return asReal(evaluate(args[0], ctx));
      };
      let out: number;
      try {
        out = derivative(f, x0);
      } finally {
        ctx.vars["X"] = prevX;
      }
      return numVal(cleanFloat(checkRange(out)));
    }
    case "pol": {
      need(1 + 1);
      const x = asReal(get(0));
      const y = asReal(get(1));
      const r = Math.sqrt(x * x + y * y);
      let theta = 0;
      if (r !== 0) theta = fromRadians(Math.atan2(y, x), ctx.angle);
      return vecVal([cleanFloat(r), cleanFloat(theta)]);
    }
    case "rec": {
      need(2);
      const r = asReal(get(0));
      const theta = toRadians(asReal(get(1)), ctx.angle);
      return vecVal([cleanFloat(r * Math.cos(theta)), cleanFloat(r * Math.sin(theta))]);
    }

    /* ------- matrix / vector ------- */
    case "det": {
      need(1);
      const v = get(0);
      if (v.kind !== "matrix") throw errDim("det needs a matrix");
      const d = matDet(v.m);
      return Number.isInteger(d) ? intVal(d) : numVal(d);
    }
    case "tr": {
      need(1);
      const v = get(0);
      if (v.kind !== "matrix") throw errDim("Tr needs a matrix");
      const { r: rows, c } = matDims(v.m);
      if (rows !== c) throw errDim("Trace needs a square matrix");
      let s = 0;
      for (let i = 0; i < rows; i++) s += v.m[i][i];
      return numVal(cleanFloat(s));
    }
    case "dot": {
      need(2);
      const a = get(0);
      const b = get(1);
      if (a.kind !== "vector" || b.kind !== "vector") throw errDim("dot( needs two vectors");
      return numVal(cleanFloat(vecDot(a.v, b.v)));
    }
    case "cross": {
      need(2);
      const a = get(0);
      const b = get(1);
      if (a.kind !== "vector" || b.kind !== "vector") throw errDim("cross( needs two vectors");
      return vecVal(vecCross(a.v, b.v).map(cleanFloat));
    }
    case "vangle": {
      need(2);
      const a = get(0);
      const b = get(1);
      if (a.kind !== "vector" || b.kind !== "vector") throw errDim("Angle needs two vectors");
      return numVal(cleanFloat(fromRadians(vecAngle(a.v, b.v), ctx.angle)));
    }
    case "unitvec": {
      need(1);
      const v = get(0);
      if (v.kind !== "vector") throw errDim("UnitV needs a vector");
      return vecVal(vecUnit(v.v).map(cleanFloat));
    }
    default:
      throw errSyntax(`Unknown function ${name}`, pos);
  }
}

/* complex inverse trig helpers */
function cnAsin(z: Complex): Complex {
  // -i ln(iz + sqrt(1 - z^2))
  const iz = cx(-z.im, z.re);
  const z2 = cxMul(z, z);
  const inside = cxAdd(iz, cxSqrt(cxSub(cx(1, 0), z2)));
  return cxClean(cxMul(cx(0, -1), cxLn(inside)));
}
function cnAcos(z: Complex): Complex {
  const rad = cnAsin(z);
  return cxClean(cx(Math.PI / 2 - rad.re, -rad.im));
}

export function transposeValue(v: Value): Value {
  if (v.kind !== "matrix") throw errDim("Transpose needs a matrix");
  return matVal(matTranspose(v.m));
}
