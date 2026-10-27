/**
 * Display tree — natural mathematical notation as structured nodes that
 * React renders (stacked fractions, radicals with vinculum, superscripts).
 * Text nodes may carry `idx` = source token index so the editing cursor can
 * be placed at any linear position, even inside a numerator or exponent.
 */

import { Ast } from "./parser";

export type DNode =
  | { t: "text"; s: string; idx?: number }
  | { t: "row"; parts: DNode[] }
  | { t: "frac"; num: DNode[]; den: DNode[] }
  | { t: "sup"; base: DNode[]; pow: DNode[] }
  | { t: "sqrt"; body: DNode[]; index?: DNode[]; closePos?: number }
  | { t: "sub"; base: DNode[]; sub: DNode[] }
  | { t: "abs"; body: DNode[]; closePos?: number }
  | { t: "func"; name: string; args: DNode[][]; closePos?: number }
  | { t: "dms"; parts: DNode[][] }
  | { t: "matrix"; rows: DNode[][][] }
  | { t: "bounds"; lo: DNode[]; hi: DNode[] } // ∫ bounds (lo under hi)
  | { t: "cursor" }
  | { t: "empty"; idx?: number };

export const tNode = (s: string, idx?: number): DNode => ({ t: "text", s, idx });
export const eNode = (idx?: number): DNode => ({ t: "empty", idx });

const FUNC_DISPLAY: Record<string, string> = {
  sin: "sin", cos: "cos", tan: "tan",
  asin: "sin⁻¹", acos: "cos⁻¹", atan: "tan⁻¹",
  sinh: "sinh", cosh: "cosh", tanh: "tanh",
  asinh: "sinh⁻¹", acosh: "cosh⁻¹", atanh: "tanh⁻¹",
  ln: "ln", log: "log", expe: "e^", exp10: "10^",
  abs: "abs", arg: "arg", conjg: "Conjg",
  "ran#": "Ran#", ranint: "RanInt#", primefact: "FACT",
  sigma: "Σ(", pol: "Pol", rec: "Rec",
  integ: "∫", diff: "d/dx",
  det: "det", tr: "Tr", dot: "Dot", cross: "Cross",
  vangle: "Angle", unitvec: "UnitV",
};

const OP_DISPLAY: Record<string, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
  imp: "·",
  P: " nPr ",
  C: " nCr ",
  gcd: " GCD ",
  lcm: " LCM ",
  and: " and ",
  or: " or ",
  xor: " xor ",
  xnor: " xnor ",
  angle: "∠",
};

const VAR_DISPLAY: Record<string, string> = { Ans: "Ans" };

/** AST -> display nodes (natural notation) */
export function astToNodes(a: Ast): DNode[] {
  switch (a.t) {
    case "empty":
      return [eNode(a.pos)];
    case "num":
      // split into per-character nodes so the editing cursor can sit
      // between digits even though parsing merges the run
      return [...a.raw].map((ch, k) => tNode(ch, a.pos + k));
    case "const":
      return [tNode(a.name === "pi" ? "π" : a.name === "e" ? "e" : "i", a.pos)];
    case "var":
      return [tNode(VAR_DISPLAY[a.name] ?? a.name, a.pos)];
    case "group": {
      const inner = astToNodes(a.e);
      return [
        tNode("(", a.pos),
        ...inner,
        ...(a.open ? [] : [tNode(")", a.closePos)]),
      ];
    }
    case "unary":
      return [tNode("−", a.pos), ...astToNodes(a.e)];
    case "dms": {
      const out: DNode[] = [];
      const marks = ["°", "′", "″"];
      a.parts.forEach((p, i) => {
        out.push(...astToNodes(p), tNode(marks[Math.min(i, 2)]));
      });
      return out;
    }
    case "mixed":
      return [
        ...astToNodes(a.whole),
        tNode(" "),
        { t: "frac", num: astToNodes(a.num), den: astToNodes(a.den) },
      ];
    case "postfix": {
      const base = astToNodes(a.e);
      if (a.op === "sq") return [{ t: "sup", base, pow: [tNode("2", a.pos)] }];
      if (a.op === "cube") return [{ t: "sup", base, pow: [tNode("3", a.pos)] }];
      if (a.op === "recip") return [{ t: "sup", base, pow: [tNode("−1", a.pos)] }];
      if (a.op === "T") return [{ t: "sup", base, pow: [tNode("T", a.pos)] }];
      return [...base, tNode(a.op === "!" ? "!" : "%", a.pos)];
    }
    case "binary": {
      if (a.op === "/") {
        return [{ t: "frac", num: astToNodes(a.l), den: astToNodes(a.r) }];
      }
      if (a.op === "^") {
        return [{ t: "sup", base: astToNodes(a.l), pow: astToNodes(a.r) }];
      }
      if (a.op === "E10") {
        return [
          ...astToNodes(a.l),
          { t: "sup", base: [tNode("×10", a.pos)], pow: astToNodes(a.r) },
        ];
      }
      const l = astToNodes(a.l);
      const r = astToNodes(a.r);
      const sym = OP_DISPLAY[a.op] ?? a.op;
      if (a.op === "imp") {
        return [...l, tNode("  "), ...r];
      }
      return [...l, tNode(sym, a.op === "angle" ? a.pos : a.pos), ...r];
    }
    case "func": {
      const name = a.name;
      if (name === "sqrt" || name === "cbrt") {
        const body = a.args[0] ? astToNodes(a.args[0]) : [eNode(a.pos)];
        const index = name === "cbrt" ? [tNode("3", a.pos)] : undefined;
        return [{ t: "sqrt", body, index, closePos: a.closePos }];
      }
      if (name === "xroot") {
        const idx = a.args[0] ? astToNodes(a.args[0]) : [eNode(a.pos)];
        const body = a.args[1] ? astToNodes(a.args[1]) : [eNode(a.pos)];
        return [{ t: "sqrt", body, index: idx, closePos: a.closePos }];
      }
      if (name === "logb") {
        const base = a.args[0] ? astToNodes(a.args[0]) : [eNode(a.pos)];
        const body = a.args[1] ? astToNodes(a.args[1]) : [eNode(a.pos)];
        return [
          { t: "sub", base: [tNode("log", a.pos)], sub: base },
          tNode("("),
          ...body,
          tNode(")", a.closePos),
        ];
      }
      if (name === "abs") {
        const body = a.args[0] ? astToNodes(a.args[0]) : [eNode(a.pos)];
        return [{ t: "abs", body, closePos: a.closePos }];
      }
      if (name === "expe" || name === "exp10") {
        const body = a.args[0] ? astToNodes(a.args[0]) : [eNode(a.pos)];
        return [{ t: "sup", base: [tNode(name === "expe" ? "e" : "10", a.pos)], pow: body }];
      }
      if (name === "integ") {
        const body = a.args[0] ? astToNodes(a.args[0]) : [eNode(a.pos)];
        const lo = a.args[1] ? astToNodes(a.args[1]) : [eNode(a.pos)];
        const hi = a.args[2] ? astToNodes(a.args[2]) : [eNode(a.pos)];
        return [
          tNode("∫", a.pos),
          { t: "bounds", lo, hi },
          tNode("("),
          ...body,
          tNode(")", a.closePos),
        ];
      }
      const label = FUNC_DISPLAY[name] ?? name;
      const argNodes = a.args.map((x) => astToNodes(x));
      if (argNodes.length === 0) return [tNode(label, a.pos)];
      if (name === "sigma") {
        // Σ(body, start, end)
        return [
          tNode("Σ(", a.pos),
          ...(argNodes[0] ?? []),
          tNode(", "),
          ...(argNodes[1] ?? []),
          tNode(", "),
          ...(argNodes[2] ?? []),
          tNode(")", a.closePos),
        ];
      }
      return [{ t: "func", name: label, args: argNodes, closePos: a.closePos }];
    }
    default:
      return [tNode("?")];
  }
}

/** flatten to plain readable text (for aria labels / clipboard) */
export function nodesToText(nodes: DNode[]): string {
  let out = "";
  for (const n of nodes) {
    switch (n.t) {
      case "text": out += n.s; break;
      case "empty": out += "□"; break;
      case "cursor": out += ""; break;
      case "row": out += nodesToText(n.parts); break;
      case "frac": out += `(${nodesToText(n.num)})/(${nodesToText(n.den)})`; break;
      case "sup": out += `${nodesToText(n.base)}^(${nodesToText(n.pow)})`; break;
      case "sqrt": out += n.index ? `root[${nodesToText(n.index)}](${nodesToText(n.body)})` : `√(${nodesToText(n.body)})`; break;
      case "sub": out += `${nodesToText(n.base)}_(${nodesToText(n.sub)})`; break;
      case "abs": out += `|${nodesToText(n.body)}|`; break;
      case "bounds": out += `_(${nodesToText(n.lo)})^(${nodesToText(n.hi)})`; break;
      case "func": out += `${n.name}(${n.args.map(nodesToText).join(", ")})`; break;
      case "dms": out += n.parts.map(nodesToText).join(":"); break;
      case "matrix": out += `[${n.rows.map((r) => r.map(nodesToText).join(", ")).join("; ")}]`; break;
    }
  }
  return out;
}
