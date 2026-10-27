"use client";

/** On-LCD overlays: HOME menu, settings, catalog, history, tools, help. */

import { useMemo, useState } from "react";
import {
  Calculator, Sigma, Binary, LayoutGrid, MoveUpRight, BarChart3, Table2, Equal,
  ArrowLeftRight, PieChart, Scale, Dices, Search, Trash2, X, Clock,
} from "lucide-react";
import {
  CalcState, ModeId, MODES, CalcSettings, clearPersisted, tokensToSource, shapeTokens,
} from "@/lib/calculator/session";
import { HistoryEntry } from "@/lib/calculator/session";
import { valueToText } from "@/lib/calculator/format";
import { CONSTANTS, CONSTANT_CATEGORIES, CONVERSIONS, convertUnit } from "@/lib/calculator/constants";
import { Value, VarName, VAR_NAMES, factorizationText, primeFactorize, asReal } from "@/lib/calculator/core";
import { compileFunctionFromTokens } from "@/lib/calculator/calculus";
import { solveNewton } from "@/lib/calculator/solvers";
import { tok, Tok } from "@/lib/calculator/parser";

export interface CalcActions {
  press: (keyId: string) => void;
  setMode: (m: ModeId) => void;
  insertToks: (toks: Tok[]) => void;
  insertSource: (src: string) => void;
  updateSettings: (patch: Partial<CalcSettings>) => void;
  clearHistory: () => void;
  clearVars: () => void;
  clearMatrices: () => void;
  hardReset: () => void;
  replayEntry: (e: HistoryEntry) => void;
  openOverlay: (o: string | null) => void;
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="calc-overlay-head">
      <span>{title}</span>
      <span className="spacer" style={{ flex: 1 }} />
      <button type="button" className="closex" aria-label="Back to calculation" onPointerDown={(e) => { e.preventDefault(); onClose(); }}>
        <X size={11} strokeWidth={3} aria-hidden />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- HOME */

const MODE_ICONS: Record<ModeId, typeof Calculator> = {
  calc: Calculator,
  complex: Sigma,
  basen: Binary,
  matrix: LayoutGrid,
  vector: MoveUpRight,
  stats: BarChart3,
  table: Table2,
  equation: Equal,
  ineq: ArrowLeftRight,
  dist: PieChart,
  ratio: Scale,
  mathbox: Dices,
};

export function HomeMenu({ act, onClose }: { act: CalcActions; onClose: () => void }) {
  return (
    <>
      <Header title="CALCULATOR APPS" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-mgrid" role="menu" aria-label="Calculator apps">
          {MODES.map((m, i) => {
            const Icon = MODE_ICONS[m.id];
            return (
              <button
                key={m.id}
                type="button"
                className="calc-mcell"
                role="menuitem"
                onPointerDown={(e) => {
                  e.preventDefault();
                  act.setMode(m.id);
                  onClose();
                }}
              >
                <span className="num">{i + 1}</span>
                <Icon size={20} strokeWidth={1.8} aria-hidden />
                <span className="lbl">{m.name}</span>
              </button>
            );
          })}
        </div>
        <p className="calc-note">Tap an app, or press its number on the physical keyboard.</p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ SETTINGS */

export function SettingsPanel({ state, act, onClose }: { state: CalcState; act: CalcActions; onClose: () => void }) {
  const s = state.settings;
  const set = (patch: Partial<CalcSettings>) => act.updateSettings(patch);
  return (
    <>
      <Header title="SETTINGS" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-field">
          <span className="flabel">Angle unit</span>
          <span>
            {(["deg", "rad", "grad"] as const).map((u) => (
              <button key={u} type="button" className={`calc-tab ${s.angle === u ? "on" : ""}`}
                onPointerDown={(e) => { e.preventDefault(); set({ angle: u }); }}>
                {u.toUpperCase()}
              </button>
            ))}
          </span>
        </div>
        <div className="calc-field">
          <span className="flabel">Number format</span>
          <span>
            {(["norm1", "norm2"] as const).map((m) => (
              <button key={m} type="button" className={`calc-tab ${s.numFormat.mode === m ? "on" : ""}`}
                onPointerDown={(e) => { e.preventDefault(); set({ numFormat: { ...s.numFormat, mode: m } }); }}>
                {m === "norm1" ? "Norm1" : "Norm2"}
              </button>
            ))}
            {(["fix", "sci"] as const).map((m) => (
              <button key={m} type="button" className={`calc-tab ${s.numFormat.mode === m ? "on" : ""}`}
                onPointerDown={(e) => { e.preventDefault(); set({ numFormat: { ...s.numFormat, mode: m } }); }}>
                {m === "fix" ? `Fix` : `Sci`}
              </button>
            ))}
          </span>
        </div>
        {(s.numFormat.mode === "fix" || s.numFormat.mode === "sci") && (
          <div className="calc-field">
            <span className="flabel">{s.numFormat.mode === "fix" ? "Decimals" : "Significant digits"}</span>
            <select
              value={s.numFormat.digits}
              onChange={(e) => set({ numFormat: { ...s.numFormat, digits: Number(e.target.value) } })}
              aria-label="Digits"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        )}
        <div className="calc-field">
          <span className="flabel">Engineering notation</span>
          <button type="button" className={`calc-tab ${s.eng ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); set({ eng: !s.eng }); }}>
            {s.eng ? "ON" : "OFF"}
          </button>
        </div>
        <div className="calc-field">
          <span className="flabel">Fraction results (exact)</span>
          <button type="button" className={`calc-tab ${s.fractionResult ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); set({ fractionResult: !s.fractionResult }); }}>
            {s.fractionResult ? "ON" : "OFF"}
          </button>
        </div>
        <div className="calc-field">
          <span className="flabel">Mixed fractions ab/c→d/c</span>
          <button type="button" className={`calc-tab ${s.mixedFractions ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); set({ mixedFractions: !s.mixedFractions }); }}>
            {s.mixedFractions ? "ON" : "OFF"}
          </button>
        </div>
        <div className="calc-field">
          <span className="flabel">Thousands separators</span>
          <button type="button" className={`calc-tab ${s.thousandsSep ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); set({ thousandsSep: !s.thousandsSep }); }}>
            {s.thousandsSep ? "ON" : "OFF"}
          </button>
        </div>
        <div className="calc-field">
          <span className="flabel">Complex result form</span>
          <span>
            <button type="button" className={`calc-tab ${s.complexForm === "rect" ? "on" : ""}`}
              onPointerDown={(e) => { e.preventDefault(); set({ complexForm: "rect" }); }}>
              a+bi
            </button>
            <button type="button" className={`calc-tab ${s.complexForm === "polar" ? "on" : ""}`}
              onPointerDown={(e) => { e.preventDefault(); set({ complexForm: "polar" }); }}>
              r∠θ
            </button>
          </span>
        </div>
        <div className="calc-field">
          <span className="flabel">Display theme</span>
          <span>
            {(["classic", "amber", "night"] as const).map((t) => (
              <button key={t} type="button" className={`calc-tab ${s.lcd === t ? "on" : ""}`}
                onPointerDown={(e) => { e.preventDefault(); set({ lcd: t }); }}>
                {t === "classic" ? "LCD" : t === "amber" ? "AMB" : "DRK"}
              </button>
            ))}
          </span>
        </div>
        <div className="calc-field">
          <span className="flabel">Key vibration (touch)</span>
          <button type="button" className={`calc-tab ${s.haptic ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); set({ haptic: !s.haptic }); }}>
            {s.haptic ? "ON" : "OFF"}
          </button>
        </div>

        <div style={{ height: 10 }} />
        <div className="calc-list-row">
          <span style={{ flex: 1 }}>Calculation history ({state.history.length})</span>
          <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); act.clearHistory(); }}>
            Clear
          </button>
        </div>
        <div className="calc-list-row">
          <span style={{ flex: 1 }}>Settings & factory reset</span>
          <button
            type="button"
            className="calc-mini-btn"
            aria-label="Reset all settings and memory"
            onPointerDown={(e) => { e.preventDefault(); act.hardReset(); }}
          >
            Reset all
          </button>
        </div>
        <p className="calc-note">
          Preferences, variables and history live only in this browser (localStorage).
          Nothing is sent to any server. Numeric integration/differentiation return
          approximations; physical constants are CODATA values with exact SI entries marked.
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ CATALOG */

const FN_GROUPS: { name: string; modes?: ModeId[]; items: { label: string; src: string; hint: string }[] }[] = [
  {
    name: "Analysis",
    items: [
      { label: "∫(", src: "integ(,,)", hint: "∫(f(X), lower, upper) — numeric" },
      { label: "d/dx(", src: "diff(,)", hint: "derivative at a point — numeric" },
      { label: "Σ(", src: "sigma(,,)", hint: "Σ(f(X), start, end)" },
      { label: "ⁿ√", src: "xroot(,)", hint: "n-th root" },
      { label: "log□(", src: "logb(,)", hint: "logarithm with any base" },
    ],
  },
  {
    name: "Probability",
    items: [
      { label: "nPr", src: "P", hint: "permutations (infix)", op: true },
      { label: "nCr", src: "C", hint: "combinations (infix)", op: true },
      { label: "GCD", src: "gcd", hint: "greatest common divisor (infix)", op: true },
      { label: "LCM", src: "lcm", hint: "least common multiple (infix)", op: true },
      { label: "Ran#", src: "ran#()", hint: "random 0.000–0.999" },
      { label: "RanInt#(", src: "ranint(,)", hint: "random integer a..b" },
      { label: "FACT(", src: "primefact(", hint: "prime factorization" },
    ] as { label: string; src: string; hint: string; op?: boolean }[],
  },
  {
    name: "Hyperbolic",
    items: [
      { label: "sinh(", src: "sinh(", hint: "" }, { label: "cosh(", src: "cosh(", hint: "" },
      { label: "tanh(", src: "tanh(", hint: "" }, { label: "sinh⁻¹(", src: "asinh(", hint: "" },
      { label: "cosh⁻¹(", src: "acosh(", hint: "" }, { label: "tanh⁻¹(", src: "atanh(", hint: "" },
    ],
  },
  {
    name: "Measurement ► Angle / Coord",
    items: [
      { label: "Pol(", src: "pol(,)", hint: "rect → polar (r, θ)" },
      { label: "Rec(", src: "rec(,)", hint: "polar → rect (x, y)" },
    ],
  },
  {
    name: "Complex",
    modes: ["complex", "calc"],
    items: [
      { label: "i", src: "i", hint: "imaginary unit", constTok: true },
      { label: "∠", src: "∠", hint: "polar angle input (r∠θ)", op: true },
      { label: "Conjg(", src: "conjg(", hint: "complex conjugate" },
      { label: "Arg(", src: "arg(", hint: "argument (angle unit aware)" },
      { label: "|x|", src: "abs(", hint: "modulus / absolute" },
    ] as { label: string; src: string; hint: string; constTok?: boolean; op?: boolean }[],
  },
  {
    name: "Matrix / Vector",
    modes: ["matrix", "vector"],
    items: [
      { label: "det(", src: "det(", hint: "determinant" },
      { label: "Tr(", src: "tr(", hint: "trace" },
      { label: "Dot(", src: "dot(,)", hint: "dot product" },
      { label: "Cross(", src: "cross(,)", hint: "cross product (3-D)" },
      { label: "Angle(", src: "vangle(,)", hint: "angle between vectors" },
      { label: "UnitV(", src: "unitvec(", hint: "unit vector" },
    ],
  },
];

export function CatalogPanel({ state, act, onClose }: { state: CalcState; act: CalcActions; onClose: () => void }) {
  const [tab, setTab] = useState<"fn" | "const" | "conv" | "var">("fn");
  return (
    <>
      <Header title="CATALOG" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-tabrow" role="tablist">
          {([["fn", "Functions"], ["const", "Constants"], ["conv", "Convert"], ["var", "Variables"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`calc-tab ${tab === id ? "on" : ""}`}
              onPointerDown={(e) => { e.preventDefault(); setTab(id); }}>
              {label}
            </button>
          ))}
        </div>
        {tab === "fn" && <FnCatalog state={state} act={act} onClose={onClose} />}
        {tab === "const" && <ConstCatalog act={act} onClose={onClose} />}
        {tab === "conv" && <ConvCatalog state={state} act={act} onClose={onClose} />}
        {tab === "var" && <VarCatalog state={state} act={act} onClose={onClose} />}
      </div>
    </>
  );
}

function insertSrc(act: CalcActions, src: string, onClose: () => void, asOp?: string, isConst?: boolean) {
  if (asOp) act.insertToks([tok("op", asOp as "gcd")]);
  else if (isConst) act.insertToks([tok("const", src as "i")]);
  else if (src === "∠") act.insertToks([tok("op", "angle")]);
  else act.insertSource(src);
  onClose();
}

function FnCatalog({ state, act, onClose }: { state: CalcState; act: CalcActions; onClose: () => void }) {
  return (
    <div>
      {FN_GROUPS.filter((g) => !g.modes || g.modes.includes(state.mode)).map((g) => (
        <div key={g.name}>
          <p className="calc-note" style={{ margin: "8px 0 2px", fontWeight: 800 }}>{g.name}</p>
          {g.items.map((it) => (
            <div key={it.src + it.label} className="calc-list-row">
              <button
                type="button"
                className="calc-mini-btn"
                style={{ minWidth: 64, fontWeight: 800 }}
                aria-label={`Insert ${it.label}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  const raw = it as { op?: boolean; constTok?: boolean };
                  insertSrc(act, it.src, onClose, raw.op ? it.src : undefined, raw.constTok);
                }}
              >
                {it.label}
              </button>
              <span style={{ fontSize: 11, opacity: 0.75 }}>{it.hint}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ConstCatalog({ act, onClose }: { act: CalcActions; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      CONSTANTS.filter(
        (c) =>
          q === "" ||
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.symbol.toLowerCase().includes(q.toLowerCase()),
      ),
    [q],
  );
  return (
    <div>
      <div className="calc-field" style={{ border: "none" }}>
        <Search size={12} aria-hidden />
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
          style={{ flex: 1, maxWidth: "none" }} aria-label="Search constants" />
      </div>
      {CONSTANT_CATEGORIES.map((cat) => {
        const rows = list.filter((c) => c.category === cat);
        if (rows.length === 0) return null;
        return (
          <div key={cat}>
            <p className="calc-note" style={{ margin: "8px 0 2px", fontWeight: 800 }}>{cat}</p>
            {rows.map((c) => (
              <div key={c.id} className="calc-list-row">
                <span style={{ width: 34, fontWeight: 800 }}>{c.symbol}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 11 }}>{c.name}</span>
                  <span style={{ display: "block", fontSize: 10, opacity: 0.7 }}>
                    {c.value.toExponential(6).replace("e+", "×10^")} {c.unit}
                    {c.note ? ` · ${c.note}` : ""}
                  </span>
                </span>
                <button type="button" className="calc-mini-btn" aria-label={`Insert ${c.name}`}
                  onPointerDown={(e) => { e.preventDefault(); act.insertSource(String(c.value)); onClose(); }}>
                  Ins
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ConvCatalog({ state, act, onClose }: { state: CalcState; act: CalcActions; onClose: () => void }) {
  const [cat, setCat] = useState("length");
  const category = CONVERSIONS.find((c) => c.id === cat)!;
  const [from, setFrom] = useState(category.units[0].id);
  const [to, setTo] = useState(category.units[1]?.id ?? category.units[0].id);
  const ansVal = state.ans.kind === "num" ? state.ans.real : 1;
  const [value, setValue] = useState(String(Math.round(ansVal * 1e9) / 1e9));
  const [err, setErr] = useState<string | null>(null);
  const c0 = CONVERSIONS.find((c) => c.id === cat)!;
  if (c0 !== category) {
    // reset selectors when category changes
    setFrom(category.units[0].id);
    setTo(category.units[1]?.id ?? category.units[0].id);
  }
  let result: number | null = null;
  try {
    const v = Number(value);
    if (value !== "" && Number.isFinite(v)) {
      result = convertUnit(cat, from, to, v);
      if (err) setErr(null);
    }
  } catch (e2) {
    if (!err) setErr(e2 instanceof Error ? e2.message : "error");
  }
  return (
    <div>
      <div className="calc-field">
        <span className="flabel">Category</span>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Conversion category">
          {CONVERSIONS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="calc-field">
        <span className="flabel">Value</span>
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value to convert" />
      </div>
      <div className="calc-field">
        <span className="flabel">From</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From unit">
          {category.units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div className="calc-field">
        <span className="flabel">To</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="To unit">
          {category.units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      {err && <p className="calc-note" role="alert">{err}</p>}
      <div className="calc-list-row">
        <span style={{ flex: 1, fontWeight: 800 }}>{result !== null ? String(Number(result.toPrecision(10))) : "—"}</span>
        <button type="button" className="calc-mini-btn" disabled={result === null}
          aria-label="Insert conversion result"
          onPointerDown={(e) => {
            e.preventDefault();
            if (result === null) return;
            act.insertSource(String(Number(result.toPrecision(10))));
            onClose();
          }}>
          Ins
        </button>
      </div>
      <p className="calc-note">All conversions via exact/standard SI factors.</p>
    </div>
  );
}

function VarCatalog({ state, act, onClose }: { state: CalcState; act: CalcActions; onClose: () => void }) {
  const names: (VarName | "Ans")[] = [...VAR_NAMES, "Ans"];
  const valOf = (n: string): Value | null => (n === "Ans" ? state.ans : state.vars[n] ?? null);
  return (
    <div>
      {names.map((n) => {
        const v = valOf(n);
        return (
          <div key={n} className="calc-list-row">
            <span style={{ width: 34, fontWeight: 800 }}>{n}</span>
            <span style={{ flex: 1 }}>{v ? valueToText(v, state.settings) : "0"}</span>
            <button type="button" className="calc-mini-btn" aria-label={`Insert variable ${n}`}
              onPointerDown={(e) => {
                e.preventDefault();
                act.insertToks([tok("var", n)]);
                onClose();
              }}>
              Ins
            </button>
          </div>
        );
      })}
      <div style={{ height: 8 }} />
      <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); act.clearVars(); }} aria-label="Clear all variables">
        Clear variables (A–F,X,Y,M)
      </button>
      <p className="calc-note">Store: enter value or EXE, then SHIFT + ( (STO), then ALPHA + letter.</p>
    </div>
  );
}

/* ------------------------------------------------------------ HISTORY */

export function HistoryPanel({ state, act, onClose }: { state: CalcState; act: CalcActions; onClose: () => void }) {
  return (
    <>
      <Header title="HISTORY" onClose={onClose} />
      <div className="calc-overlay-body">
        {state.history.length === 0 && (
          <p className="calc-note">No calculations yet. Press EXE after an expression and it lands here.</p>
        )}
        {state.history.map((h) => (
          <button key={h.id} type="button" className="calc-hist-entry" aria-label={`Replay ${h.exprText} equals ${h.resultText}`}
            onPointerDown={(e) => { e.preventDefault(); act.replayEntry(h); onClose(); }}>
            <span className="calc-hist-expr">{h.exprText}</span>
            <span className="calc-hist-res">= {h.resultText}</span>
          </button>
        ))}
        {state.history.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); act.clearHistory(); }}>
              <Trash2 size={10} aria-hidden /> Clear history
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- TOOLS */

export function ToolsPanel({ state, act, onClose }: { state: CalcState; act: CalcActions; onClose: () => void }) {
  const [x0, setX0] = useState("1");
  const [solveOut, setSolveOut] = useState<string | null>(null);
  const [factOut, setFactOut] = useState<string | null>(null);
  const hasX = useMemo(() => tokensToSource(state.tokens).includes("X"), [state.tokens]);

  const doSolve = () => {
    const guess = Number(x0);
    if (!Number.isFinite(guess)) {
      setSolveOut("Initial value must be a number");
      return;
    }
    try {
      const f = compileFunctionFromTokens(shapeTokens(state.tokens), { ...state.vars }, state.settings.angle);
      const r = solveNewton(f, guess);
      setSolveOut(
        r.converged
          ? `x ≈ ${String(Number(r.root.toPrecision(10)))} (${r.iterations} it.)`
          : "Could not converge — try another initial value",
      );
    } catch (e2) {
      setSolveOut(e2 instanceof Error ? `Error: ${e2.message}` : "Error");
    }
  };
  const doFact = () => {
    try {
      const n = Math.round(asReal(state.ans));
      setFactOut(`${n} = ${factorizationText(primeFactorize(Math.abs(n)))}`);
    } catch (e2) {
      setFactOut(e2 instanceof Error ? e2.message : "FACT needs an integer ≤ 10¹²");
    }
  };

  return (
    <>
      <Header title="TOOLS" onClose={onClose} />
      <div className="calc-overlay-body">
        <p className="calc-note" style={{ fontWeight: 800, marginTop: 0 }}>SOLVE  f(X)=0 on current input (Newton)</p>
        <div className="calc-list-row">
          <span style={{ flex: 1 }}>{hasX ? tokensToSource(state.tokens) : "Type an expression containing X first"}</span>
        </div>
        <div className="calc-field">
          <span className="flabel">Initial x₀</span>
          <input type="number" value={x0} onChange={(e) => setX0(e.target.value)} aria-label="Initial value" />
        </div>
        <button type="button" className="calc-mini-btn" disabled={!hasX}
          onPointerDown={(e) => { e.preventDefault(); doSolve(); }}>
          Solve
        </button>
        {solveOut && <p className="calc-note" role="status">→ {solveOut}</p>}

        <p className="calc-note" style={{ fontWeight: 800, marginTop: 12 }}>FACT  prime factorization of Ans</p>
        <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); doFact(); }}>
          Factor Ans
        </button>
        {factOut && <p className="calc-note" role="status">→ {factOut}</p>}

        <p className="calc-note" style={{ fontWeight: 800, marginTop: 12 }}>RESET</p>
        <div className="calc-list-row">
          <span style={{ flex: 1 }}>Variables & answer memory</span>
          <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); act.clearVars(); }}>Clear</button>
        </div>
        <div className="calc-list-row">
          <span style={{ flex: 1 }}>Matrices & vectors</span>
          <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); act.clearMatrices(); }}>Clear</button>
        </div>
        <div className="calc-list-row">
          <span style={{ flex: 1 }}>Everything (settings + history)</span>
          <button type="button" className="calc-mini-btn" aria-label="Factory reset" onPointerDown={(e) => { e.preventDefault(); act.hardReset(); onClose(); }}>
            Factory reset
          </button>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- HELP */

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ["0–9 . + − * / ^ ( ) !", "digits & operators"],
    ["Enter / =", "EXE (calculate)"],
    ["Backspace / Del", "delete before / at cursor"],
    ["◀ ▶ / ▲ ▼", "move cursor / replay history"],
    ["Esc", "close menu · AC"],
    ["P", "π · E → constant e (keyboard)"],
    ["A–F, X, Y, M", "variables (hex in Base-N)"],
    ["Ctrl+Z", "undo edit"],
    ["SHIFT + key", "yellow secondary function"],
    ["ALPHA + key", "red letter variable"],
    ["SHIFT+(", "STO (store result)"],
  ];
  return (
    <>
      <Header title="KEYBOARD GUIDE" onClose={onClose} />
      <div className="calc-overlay-body">
        {rows.map(([k, d]) => (
          <div key={k} className="calc-list-row">
            <span style={{ width: 130, fontWeight: 800 }}>{k}</span>
            <span style={{ flex: 1, opacity: 0.8 }}>{d}</span>
          </div>
        ))}
        <p className="calc-note">
          This is an independently built simulator inspired by ClassWiz-series devices.
          Not affiliated with Casio. Numerical ∫/d-dx are approximations.
        </p>
      </div>
    </>
  );
}
