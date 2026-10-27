/**
 * Base-N arithmetic: BIN / OCT / DEC / HEX with 32-bit signed two's-complement
 * semantics (matching physical devices), logical ops, truncating division.
 */

import { CalcError, errMath, errSyntax } from "./core";
import { Tok } from "./parser";

export type Radix = "dec" | "hex" | "bin" | "oct";

export const RADIX_BASE: Record<Radix, number> = { dec: 10, hex: 16, bin: 2, oct: 8 };

const DIGIT_OK: Record<Radix, RegExp> = {
  dec: /^[0-9]+$/,
  hex: /^[0-9A-F]+$/i,
  bin: /^[01]+$/,
  oct: /^[0-7]+$/,
};

const as32 = (v: number): number => v | 0; // two's-complement 32-bit wrap

export interface BaseNOutcome {
  ok: boolean;
  value?: number;
  code?: string;
  message?: string;
}

/** Evaluate a Base-N token expression. Number tokens carry raw digit text. */
export function evalBaseN(toks: Tok[], radix: Radix): BaseNOutcome {
  try {
    const p = new BaseNParser(toks, radix);
    const v = p.parse();
    return { ok: true, value: as32(v) };
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, code: e.code, message: e.message };
    return { ok: false, code: "MATH", message: "Math ERROR" };
  }
}

class BaseNParser {
  pos = 0;
  constructor(private toks: Tok[], private radix: Radix) {}

  peek(): Tok | null {
    return this.toks[this.pos] ?? null;
  }
  next(): Tok {
    const t = this.toks[this.pos];
    if (!t) throw errSyntax("Unexpected end", this.pos);
    this.pos++;
    return t;
  }

  parse(): number {
    if (this.toks.length === 0) throw errSyntax("Nothing to calculate");
    const v = this.parseOr();
    if (this.pos < this.toks.length) throw errSyntax("Syntax ERROR", this.pos);
    return v;
  }

  parseOr(): number {
    let l = this.parseAnd();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.s === "or" || p.s === "xor" || p.s === "xnor")) {
        this.next();
        const r = this.parseAnd();
        l = p.s === "or" ? as32(l | r) : p.s === "xor" ? as32(l ^ r) : as32(~(l ^ r));
      } else return l;
    }
  }
  parseAnd(): number {
    let l = this.parseAdd();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && p.s === "and") {
        this.next();
        l = as32(l & this.parseAdd());
      } else return l;
    }
  }
  parseAdd(): number {
    let l = this.parseMul();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.s === "+" || p.s === "-")) {
        this.next();
        const r = this.parseMul();
        l = as32(p.s === "+" ? l + r : l - r);
      } else return l;
    }
  }
  parseMul(): number {
    let l = this.parseUnary();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.s === "*" || p.s === "/")) {
        this.next();
        const r = this.parseUnary();
        if (p.s === "*") l = as32(l * r);
        else {
          if (r === 0) throw errMath("Division by zero");
          l = as32(Math.trunc(l / r)); // hardware truncates toward zero
        }
      } else return l;
    }
  }
  parseUnary(): number {
    const p = this.peek();
    if (p && p.t === "op" && p.s === "-") {
      this.next();
      return as32(-this.parseUnary());
    }
    if (p && p.t === "op" && p.s === "+") {
      this.next();
      return this.parseUnary();
    }
    if (p && p.t === "func" && p.s === "neg") {
      this.next();
      if (!this.peek() || this.peek()!.t !== "lp") throw errSyntax("Neg needs (", this.pos);
      this.next();
      const v = this.parseOr();
      const rp = this.peek();
      if (rp && rp.t === "rp") this.next();
      else throw errSyntax("Missing )", this.pos);
      return as32(~v);
    }
    return this.parsePrimary();
  }
  parsePrimary(): number {
    const p = this.peek();
    if (!p) throw errSyntax("Syntax ERROR", this.pos);
    if (p.t === "lp") {
      this.next();
      const v = this.parseOr();
      const rp = this.peek();
      if (rp && rp.t === "rp") this.next();
      else throw errSyntax("Missing )", this.pos);
      return v;
    }
    // digits may arrive as 'num' tokens or hex letters as loose tokens
    if (p.t === "num" || (p.t === "var" && /^[A-F]$/.test(p.s))) {
      // gather adjacent digit tokens — tokenizer splits hex letters from digits
      let raw = "";
      while (true) {
        const q = this.peek();
        if (q && q.t === "num") {
          raw += q.s;
          this.next();
        } else if (q && q.t === "var" && /^[A-F]$/.test(q.s)) {
          raw += q.s;
          this.next();
        } else break;
      }
      if (!DIGIT_OK[this.radix].test(raw)) {
        throw new CalcError("SYNTAX", `Digit not valid in ${this.radix.toUpperCase()}`, this.pos);
      }
      return parseInt(raw, RADIX_BASE[this.radix]);
    }
    throw errSyntax("Syntax ERROR", this.pos);
  }
}

/** format an int32 in a radix with hardware-style two's complement */
export function formatBase(v: number, radix: Radix): string {
  const i = v | 0;
  if (radix === "dec") return String(i);
  const u = i >>> 0;
  if (i >= 0) {
    if (radix === "hex") return i.toString(16).toUpperCase();
    if (radix === "oct") return i.toString(8);
    return i.toString(2);
  }
  if (radix === "hex") return u.toString(16).toUpperCase().padStart(8, "0");
  if (radix === "oct") return u.toString(8).padStart(11, "0");
  return u.toString(2).padStart(32, "0");
}

/** group binary into nibbles for readability */
export function groupBin(s: string): string {
  const pad = s.length % 4 === 0 ? s : "0".repeat(4 - (s.length % 4)) + s;
  return pad.replace(/(.{4})/g, "$1 ").trim();
}

/** build Base-N tokens from a digit string like "FF" or "1010" (tests & UI) */
export function baseTokens(digits: string): Tok[] {
  return [...digits].map((ch) =>
    /[0-9]/.test(ch) ? { t: "num" as const, s: ch } : { t: "var" as const, s: ch.toUpperCase() },
  );
}
