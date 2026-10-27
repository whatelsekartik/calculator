/**
 * Tokenizer + recursive-descent parser for the calculator input language.
 * Grammar mirrors physical Casio precedence:
 *   expr    := logic
 *   logic   := andLevel (('or'|'xor'|'xnor') andLevel)*
 *   and     := additive ('and' additive)*
 *   additive:= multiplicative (('+'|'-') multiplicative)*
 *   mult    := unary (('*'|'/'|'P'|'C'|'gcd'|'lcm'| IMPLICIT) unary)*
 *   unary   := ('-'|'+')* power            (so -2^2 = -4)
 *   power   := postfix (('^'|'E10'|'angle') unary)?   (right side may be signed)
 *   postfix := primary (('!'|'%'|'sq'|'cube'|'recip'))*
 *   primary := number [dms] | const | var | func '(' args ')' | '(' expr ')'
 */

import { CalcError, errSyntax, VAR_NAMES } from "./core";

export type TokKind =
  | "num" // s = literal text
  | "var" // s = A..F X Y M Ans MatA.. VctA..
  | "const" // s = 'pi' | 'e' | 'i'
  | "func" // s = function name, followed by '(' unless arity 0 (ran#)
  | "op" // s = '+','-','*','/','^','E10','angle','P','C','gcd','lcm','and','or','xor','xnor'
  | "post" // s = '!','%','sq','cube','recip'
  | "lp"
  | "rp"
  | "comma"
  | "dms" // degrees separator °
  | "mixed"; // mixed-fraction separator ⌟

export interface Tok {
  t: TokKind;
  s: string;
}

export const tok = (t: TokKind, s: string): Tok => ({ t, s });

/* ------------------------------------------------------------------ */
/* Function registry: name -> arg count                                */
/* ------------------------------------------------------------------ */

export const FUNC_ARITY: Record<string, number> = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1,
  sinh: 1, cosh: 1, tanh: 1, asinh: 1, acosh: 1, atanh: 1,
  ln: 1, log: 1, logb: 2, expe: 1, exp10: 1,
  sqrt: 1, cbrt: 1, xroot: 2,
  abs: 1, arg: 1, conjg: 1,
  "ran#": 0, ranint: 2, primefact: 1,
  sigma: 3, // Σ(body, start, end) with X as index variable
  integ: 3, // ∫(f(x), lower, upper) — numeric (adaptive Simpson)
  diff: 2, // d/dx(f(x), point) — numeric central difference
  pol: 2, rec: 2, // coordinate conversion -> vector
  det: 1, tr: 1, // matrix determinant / trace
  dot: 2, cross: 2, vangle: 2, unitvec: 1,
};

const FUNC_NAMES = Object.keys(FUNC_ARITY).sort((a, b) => b.length - a.length);

/** infix word operators usable in typed source */
const WORD_OPS: Record<string, string> = {
  gcd: "gcd", lcm: "lcm", and: "and", or: "or", xor: "xor", xnor: "xnor",
};

/* ------------------------------------------------------------------ */
/* AST                                                                 */
/* ------------------------------------------------------------------ */

export type Ast =
  | { t: "num"; v: number; raw: string; pos: number }
  | { t: "const"; name: "pi" | "e" | "i"; pos: number }
  | { t: "var"; name: string; pos: number }
  | { t: "group"; e: Ast; open: boolean; pos: number; closePos?: number }
  | { t: "unary"; op: "-"; e: Ast; pos: number }
  | { t: "binary"; op: string; l: Ast; r: Ast; pos: number }
  | { t: "postfix"; op: string; e: Ast; pos: number }
  | { t: "func"; name: string; args: Ast[]; pos: number; closePos?: number }
  | { t: "dms"; parts: Ast[]; pos: number }
  | { t: "mixed"; whole: Ast; num: Ast; den: Ast; pos: number }
  | { t: "empty"; pos: number };

/* ------------------------------------------------------------------ */
/* String tokenizer (used by tests, table/equation inputs, replay)     */
/* ------------------------------------------------------------------ */

const MULTI_OPS: Array<[string, string]> = [
  ["×10^", "E10"],
  ["×10^(", "E10"], // tolerate paren form
  ["nPr", "P"],
  ["nCr", "C"],
];

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/\s+/g, "");
  while (i < s.length) {
    const c = s[i];
    // numbers (with optional scientific e notation: 1.25e-3)
    if (/[0-9.]/.test(c)) {
      let j = i;
      let seenDot = false;
      while (j < s.length && /[0-9.]/.test(s[j])) {
        if (s[j] === ".") {
          if (seenDot) throw errSyntax("Multiple decimal points", j);
          seenDot = true;
        }
        j++;
      }
      let raw = s.slice(i, j);
      // scientific notation inside numeric literal
      if (j < s.length && (s[j] === "e" || s[j] === "E")) {
        if (j + 1 < s.length && /[0-9+\-]/.test(s[j + 1]) && /[0-9]/.test(raw)) {
          let k = j + 1;
          if (s[k] === "+" || s[k] === "-") k++;
          const d0 = k;
          while (k < s.length && /[0-9]/.test(s[k])) k++;
          if (k > d0) {
            raw = s.slice(i, k);
            j = k;
          }
        }
      }
      if (raw === ".") throw errSyntax("Bad number", i);
      out.push({ t: "num", s: raw });
      i = j;
      continue;
    }
    // multi-char ops
    let matched = false;
    for (const [sym, code] of MULTI_OPS) {
      if (s.startsWith(sym, i)) {
        out.push({ t: "op", s: code });
        i += sym.length;
        if (sym.endsWith("(")) out.push({ t: "lp", s: "(" });
        matched = true;
        break;
      }
    }
    if (matched) continue;
    // single chars
    if (c === "+") { out.push(tok("op", "+")); i++; continue; }
    if (c === "-" || c === "−") { out.push(tok("op", "-")); i++; continue; }
    if (c === "*" || c === "×") { out.push(tok("op", "*")); i++; continue; }
    if (c === "/" || c === "÷") { out.push(tok("op", "/")); i++; continue; }
    if (c === "^") { out.push(tok("op", "^")); i++; continue; }
    if (c === "∠") { out.push(tok("op", "angle")); i++; continue; }
    if (c === "°") { out.push(tok("dms", "°")); i++; continue; }
    if (c === "⌟") { out.push(tok("mixed", "⌟")); i++; continue; }
    if (c === "(" || c === "[" ) { out.push(tok("lp", "(")); i++; continue; }
    if (c === ")" || c === "]") { out.push(tok("rp", ")")); i++; continue; }
    if (c === ",") { out.push(tok("comma", ",")); i++; continue; }
    if (c === "!") { out.push(tok("post", "!")); i++; continue; }
    if (c === "%") { out.push(tok("post", "%")); i++; continue; }
    if (c === "²") { out.push(tok("post", "sq")); i++; continue; }
    if (c === "³") { out.push(tok("post", "cube")); i++; continue; }
    if (c === "√") { out.push(tok("func", "sqrt")); i++; continue; }
    if (c === "π") { out.push(tok("const", "pi")); i++; continue; }
    // words: functions, constants, variables
    if (/[A-Za-z#]/.test(c)) {
      const sub = s.slice(i);
      const special = sub.match(/^(Ans|Mat[ABCD]|Vct[ABCD])/);
      if (special) {
        out.push(tok("var", special[1]));
        i += special[1].length;
        continue;
      }
      if (/[a-z#]/.test(c)) {
        // lowercase word, may contain digits (exp10) and '#'
        let j = i;
        while (j < s.length && /[a-z0-9#]/.test(s[j])) j++;
        const word = s.slice(i, j);
        const fn = FUNC_NAMES.find((f) => word.startsWith(f));
        if (fn) {
          out.push(tok("func", fn));
          i += fn.length;
          continue;
        }
        const wop = Object.keys(WORD_OPS)
          .filter((w) => word.startsWith(w))
          .sort((a, b) => b.length - a.length)[0];
        if (wop) {
          out.push(tok("op", wop));
          i += wop.length;
          continue;
        }
        if (word.startsWith("pi")) { out.push(tok("const", "pi")); i += 2; continue; }
        if (word === "e") { out.push(tok("const", "e")); i++; continue; }
        if (word === "i") { out.push(tok("const", "i")); i++; continue; }
        throw errSyntax(`Unknown name "${word}"`, i);
      }
      // uppercase run: variables like A, XY, or E10
      let j = i;
      while (j < s.length && /[A-Z#]/.test(s[j])) j++;
      const word = s.slice(i, j);
      if (word === "E10") { out.push(tok("op", "E10")); i = j; continue; }
      if (/^[A-FXYM]+$/.test(word)) {
        for (const ch of word) out.push(tok("var", ch));
        i = j;
        continue;
      }
      throw errSyntax(`Unknown name "${word}"`, i);
    }
    throw errSyntax(`Unexpected character "${c}"`, i);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

const IMPLICIT_STARTERS: TokKind[] = ["num", "var", "const", "func", "lp"];

export class Parser {
  toks: Tok[];
  i = 0;
  tolerant: boolean;

  constructor(toks: Tok[], tolerant = false) {
    this.toks = toks;
    this.tolerant = tolerant;
  }

  peek(): Tok | null {
    return this.toks[this.i] ?? null;
  }
  /** map shaped index back to raw editing index when available */
  posAt(i: number): number {
    const t = this.toks[i] as (Tok & { r?: number }) | undefined;
    return t && typeof t.r === "number" ? t.r : i;
  }
  peekPos(): number {
    return this.posAt(this.i);
  }
  next(): Tok {
    const t = this.toks[this.i];
    if (!t) throw errSyntax("Unexpected end of expression", this.posAt(this.i));
    this.i++;
    return t;
  }
  atOp(...ops: string[]): boolean {
    const p = this.peek();
    return !!p && p.t === "op" && ops.includes(p.s);
  }
  at(kind: TokKind, s?: string): boolean {
    const p = this.peek();
    if (!p || p.t !== kind) return false;
    if (s !== undefined && p.s !== s) return false;
    return true;
  }

  parse(): Ast {
    if (this.toks.length === 0) return { t: "empty", pos: 0 };
    const e = this.parseLogic();
    if (this.i < this.toks.length) {
      // leftover tokens (e.g. stray ')') — tolerated in live display mode
      if (!this.tolerant) throw errSyntax("Syntax ERROR", this.peek() ? this.posAt(this.i) : this.posAt(this.i - 1));
    }
    return e;
  }

  parseLogic(): Ast {
    let l = this.parseAnd();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.s === "or" || p.s === "xor" || p.s === "xnor")) {
        this.next();
        const r = this.parseAnd();
        l = { t: "binary", op: p.s, l, r, pos: this.posAt(this.i) };
      } else return l;
    }
  }
  parseAnd(): Ast {
    let l = this.parseAdd();
    while (this.atOp("and")) {
      this.next();
      const r = this.parseAdd();
      l = { t: "binary", op: "and", l, r, pos: this.posAt(this.i) };
    }
    return l;
  }
  parseAdd(): Ast {
    let l = this.parseMul();
    for (;;) {
      if (this.atOp("+", "-")) {
        const opTok = this.next();
        const r = this.parseMul();
        l = { t: "binary", op: opTok.s, l, r, pos: this.posAt(this.i) };
      } else return l;
    }
  }
  parseMul(): Ast {
    let l = this.parseUnary();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.s === "*" || p.s === "/" || p.s === "P" || p.s === "C" || p.s === "gcd" || p.s === "lcm")) {
        this.next();
        const r = this.parseUnary();
        l = { t: "binary", op: p.s, l, r, pos: this.posAt(this.i) };
        continue;
      }
      // implicit multiplication: e.g. 2π, 3(4+5), )(, 2sin(30), 2Ans
      if (p && IMPLICIT_STARTERS.includes(p.t)) {
        const r = this.parseUnary();
        l = { t: "binary", op: "imp", l, r, pos: this.posAt(this.i) };
        continue;
      }
      return l;
    }
  }
  parseUnary(): Ast {
    if (this.atOp("-")) {
      const p = this.posAt(this.i);
      this.next();
      const e = this.parseUnary();
      return { t: "unary", op: "-", e, pos: p };
    }
    if (this.atOp("+")) {
      this.next();
      return this.parseUnary();
    }
    return this.parsePower();
  }
  parsePower(): Ast {
    const base = this.parsePostfix();
    const p = this.peek();
    if (p && p.t === "op" && (p.s === "^" || p.s === "E10" || p.s === "angle")) {
      this.next();
      const exp = this.parseUnary();
      return { t: "binary", op: p.s, l: base, r: exp, pos: this.posAt(this.i) };
    }
    return base;
  }
  parsePostfix(): Ast {
    let e = this.parsePrimary();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "post") {
        this.next();
        e = { t: "postfix", op: p.s, e, pos: this.posAt(this.i) };
        continue;
      }
      return e;
    }
  }
  parsePrimary(): Ast {
    const p = this.peek();
    const pos = this.posAt(this.i);
    if (!p) {
      if (this.tolerant) return { t: "empty", pos };
      throw errSyntax("Syntax ERROR", pos);
    }
    if (p.t === "num") {
      this.next();
      const raw = p.s;
      const v = Number(raw);
      if (!Number.isFinite(v)) throw errSyntax("Bad number", pos);
      // DMS chain: a°b°c[°]
      if (this.at("dms")) {
        const parts: Ast[] = [{ t: "num", v, raw, pos }];
        while (this.at("dms")) {
          this.next();
          const q = this.peek();
          if (q && q.t === "num") {
            this.next();
            parts.push({ t: "num", v: Number(q.s), raw: q.s, pos });
          } else break;
        }
        return { t: "dms", parts, pos };
      }
      // mixed fraction: whole⌟num/den
      if (this.at("mixed")) {
        this.next();
        const readPart = (): Ast => {
          const q = this.peek();
          if (q && q.t === "num") {
            this.next();
            return { t: "num", v: Number(q.s), raw: q.s, pos };
          }
          if (this.tolerant) return { t: "empty", pos: this.posAt(this.i) };
          throw errSyntax("Mixed fraction needs integers", this.posAt(this.i));
        };
        const numP = readPart();
        if (this.atOp("/")) this.next();
        else if (!this.tolerant) throw errSyntax("Mixed fraction needs ⌟a/b", this.posAt(this.i));
        let denP: Ast;
        const qq = this.peek();
        if (qq && qq.t === "num") denP = readPart();
        else if (this.tolerant) denP = { t: "empty", pos: this.posAt(this.i) };
        else throw errSyntax("Mixed fraction needs ⌟a/b", this.posAt(this.i));
        return { t: "mixed", whole: { t: "num", v, raw, pos }, num: numP, den: denP, pos };
      }
      return { t: "num", v, raw, pos };
    }
    if (p.t === "const") {
      this.next();
      const name = p.s === "pi" || p.s === "e" || p.s === "i" ? p.s : "pi";
      return { t: "const", name, pos };
    }
    if (p.t === "var") {
      this.next();
      return { t: "var", name: p.s, pos };
    }
    if (p.t === "func") {
      this.next();
      const name = p.s;
      const arity = FUNC_ARITY[name] ?? 0;
      if (arity === 0) {
        // ran# — no parens required; tolerate optional ()
        if (this.at("lp")) {
          this.next();
          if (this.at("rp")) this.next();
        }
        return { t: "func", name, args: [], pos };
      }
      if (!this.at("lp")) {
        if (this.tolerant) return { t: "func", name, args: [{ t: "empty", pos: this.posAt(this.i) }], pos };
        throw errSyntax("Missing (", this.posAt(this.i));
      }
      this.next(); // consume (
      const args: Ast[] = [];
      let closePos: number | undefined;
      for (;;) {
        if (this.at("rp")) {
          closePos = this.posAt(this.i);
          this.next();
          break;
        }
        args.push(this.parseLogic());
        if (this.at("comma")) {
          this.next();
          continue;
        }
        if (this.at("rp")) {
          closePos = this.posAt(this.i);
          this.next();
          break;
        }
        if (!this.peek()) {
          if (this.tolerant) break;
          throw errSyntax("Missing )", this.posAt(this.i));
        }
        if (this.tolerant) break;
        throw errSyntax("Expected , or )", this.posAt(this.i));
      }
      return { t: "func", name, args, pos, closePos };
    }
    if (p.t === "lp") {
      this.next();
      const e = this.parseLogic();
      if (this.at("rp")) {
        const closePos = this.posAt(this.i);
        this.next();
        return { t: "group", e, open: false, pos, closePos };
      }
      if (this.tolerant) return { t: "group", e, open: true, pos };
      throw errSyntax("Missing )", this.posAt(this.i));
    }
    if (p.t === "rp" || p.t === "comma") {
      if (this.tolerant) return { t: "empty", pos };
      throw errSyntax("Syntax ERROR", pos);
    }
    // stray operator where a value was expected
    if (this.tolerant) return { t: "empty", pos };
    throw errSyntax("Syntax ERROR", pos);
  }
}

export function parseTokens(toks: Tok[], tolerant = false): Ast {
  return new Parser(toks, tolerant).parse();
}

export function parseString(src: string): Ast {
  return new Parser(tokenize(src), false).parse();
}
