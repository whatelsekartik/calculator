"use client";

/**
 * Mode editors rendered on the LCD area (like CW apps):
 * matrix / vector / statistics / table / equation / inequality /
 * distribution / ratio / math box.
 */

import { Fragment, useMemo, useState } from "react";
import { X } from "lucide-react";
import { CalcState, CalcSettings } from "@/lib/calculator/session";
import { realToText, valueToText } from "@/lib/calculator/format";
import { cxVal, Value } from "@/lib/calculator/core";
import { solveLinearSystem, polynomialRoots, solveInequality, solveNewton, IneqSense } from "@/lib/calculator/solvers";
import { compileFunction, tableValues } from "@/lib/calculator/calculus";
import {
  DataRow, oneVarStats, twoVarStats, computeRegression, estimateY, estimateX,
  RegressionModel, REGRESSION_FORMS,
} from "@/lib/calculator/statistics";
import {
  normalPDF, normalCD, invNormalCDF, binomialPD, binomialCD, poissonPD, poissonCD,
} from "@/lib/calculator/solvers";

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="calc-overlay-head">
      <span>{title}</span>
      <span style={{ flex: 1 }} />
      <button type="button" className="closex" aria-label="Back to calculation" onPointerDown={(e) => { e.preventDefault(); onClose(); }}>
        <X size={11} strokeWidth={3} aria-hidden />
      </button>
    </div>
  );
}

const fmt = (x: number, s: CalcSettings) => realToText(x, s);
const parseN = (t: string): number | null => {
  if (t.trim() === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
};

/* ============================ MATRIX ============================ */

function matRows(m: number[][] | null) { return m ? m.length : 2; }
function matCols(m: number[][] | null) { return m ? m[0].length : 2; }
function mkMatrixCells(m: number[][] | null, r: number, c: number): string[][] {
  return Array.from({ length: r }, (_, i) =>
    Array.from({ length: c }, (_, j) => (m && m[i] && m[i][j] !== undefined ? String(m[i][j]) : "0")),
  );
}
function cellsToMatrix(cs: string[][]): number[][] | null {
  const m: number[][] = [];
  for (const row of cs) {
    const outRow: number[] = [];
    for (const cStr of row) {
      const v = parseN(cStr);
      if (v === null || Number.isNaN(v)) return null;
      outRow.push(v);
    }
    m.push(outRow);
  }
  return m;
}

export function MatrixEditor({
  state, onSave, onClose,
}: {
  state: CalcState;
  onSave: (name: string, m: number[][] | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("MatA");
  const existing = state.matrices[name];
  const [rows, setRows] = useState(() => matRows(existing));
  const [cols, setCols] = useState(() => matCols(existing));
  const [cells, setCells] = useState<string[][]>(() => mkMatrixCells(existing, matRows(existing), matCols(existing)));
  const [err, setErr] = useState<string | null>(null);

  const selectName = (n: string) => {
    const m = state.matrices[n];
    setName(n);
    const r = matRows(m);
    const c = matCols(m);
    setRows(r);
    setCols(c);
    setCells(mkMatrixCells(m, r, c));
    setErr(null);
  };
  const resize = (r: number, c: number) => {
    setCells(mkMatrixCells(cellsToMatrix(cells) ?? null, r, c));
    setRows(r);
    setCols(c);
  };
  const save = () => {
    const m = cellsToMatrix(cells);
    if (!m) {
      setErr("All cells must be valid numbers");
      return;
    }
    onSave(name, m);
    onClose();
  };
  return (
    <>
      <Header title="MATRIX EDITOR" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-tabrow">
          {["MatA", "MatB", "MatC", "MatD"].map((n) => (
            <button key={n} type="button" className={`calc-tab ${name === n ? "on" : ""}`}
              onPointerDown={(e) => { e.preventDefault(); selectName(n); }}>
              {n}{state.matrices[n] ? "" : " ∅"}
            </button>
          ))}
        </div>
        <div className="calc-field">
          <span className="flabel">Size</span>
          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <select value={rows} onChange={(e) => resize(Number(e.target.value), cols)} aria-label="Rows">
              {[1, 2, 3, 4].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            ×
            <select value={cols} onChange={(e) => resize(rows, Number(e.target.value))} aria-label="Columns">
              {[1, 2, 3, 4].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </span>
        </div>
        <div
          className="calc-grid-inputs"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, margin: "8px 0" }}
        >
          {cells.flatMap((row, i) =>
            row.map((cs, j) => (
              <input
                key={`${i}-${j}`}
                inputMode="decimal"
                aria-label={`${name} row ${i + 1} column ${j + 1}`}
                value={cs}
                onChange={(e) => {
                  const next = cells.map((r) => r.slice());
                  next[i][j] = e.target.value;
                  setCells(next);
                }}
              />
            )),
          )}
        </div>
        {err && <p className="calc-note" role="alert">{err}</p>}
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); save(); }}>
            Save {name}
          </button>
          <button type="button" className="calc-mini-btn" aria-label={`Delete ${name}`}
            onPointerDown={(e) => { e.preventDefault(); onSave(name, null); onClose(); }}>
            Delete
          </button>
        </div>
        <p className="calc-note">Use MatA…MatD in expressions: MatA+MatB, MatA×MatB, det(, Tr(, MatA^2, MatA⁻¹.</p>
      </div>
    </>
  );
}

/* ============================ VECTOR ============================ */

export function VectorEditor({
  state, onSave, onClose,
}: {
  state: CalcState;
  onSave: (name: string, v: number[] | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("VctA");
  const existing = state.vectors[name];
  const [dim, setDim] = useState(existing ? existing.length : 3);
  const [cells, setCells] = useState<string[]>(() =>
    Array.from({ length: existing ? existing.length : 3 }, (_, i) =>
      existing && existing[i] !== undefined ? String(existing[i]) : "0",
    ),
  );
  const [err, setErr] = useState<string | null>(null);

  const selectName = (n: string) => {
    const v = state.vectors[n];
    setName(n);
    const d = v ? v.length : 3;
    setDim(d);
    setCells(Array.from({ length: d }, (_, i) => (v && v[i] !== undefined ? String(v[i]) : "0")));
    setErr(null);
  };
  const save = () => {
    const out: number[] = [];
    for (const cStr of cells) {
      const v = parseN(cStr);
      if (v === null || Number.isNaN(v)) {
        setErr("All components must be valid numbers");
        return;
      }
      out.push(v);
    }
    onSave(name, out);
    onClose();
  };
  return (
    <>
      <Header title="VECTOR EDITOR" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-tabrow">
          {["VctA", "VctB", "VctC", "VctD"].map((n) => (
            <button key={n} type="button" className={`calc-tab ${name === n ? "on" : ""}`}
              onPointerDown={(e) => { e.preventDefault(); selectName(n); }}>
              {n}{state.vectors[n] ? "" : " ∅"}
            </button>
          ))}
        </div>
        <div className="calc-field">
          <span className="flabel">Dimension</span>
          <span>
            {[2, 3].map((d) => (
              <button key={d} type="button" className={`calc-tab ${dim === d ? "on" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDim(d);
                  setCells(Array.from({ length: d }, (_, i) => cells[i] ?? "0"));
                }}>
                {d}-D
              </button>
            ))}
          </span>
        </div>
        <div className="calc-grid-inputs" style={{ gridTemplateColumns: `repeat(${dim}, 1fr)`, margin: "10px 0" }}>
          {cells.map((cStr, i) => (
            <input key={i} inputMode="decimal" aria-label={`component ${i + 1}`} value={cStr}
              onChange={(e) => {
                const next = cells.slice();
                next[i] = e.target.value;
                setCells(next);
              }} />
          ))}
        </div>
        {err && <p className="calc-note" role="alert">{err}</p>}
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); save(); }}>Save {name}</button>
          <button type="button" className="calc-mini-btn" aria-label={`Delete ${name}`}
            onPointerDown={(e) => { e.preventDefault(); onSave(name, null); onClose(); }}>
            Delete
          </button>
        </div>
        <p className="calc-note">VctA+VctB, 3VctA, Dot(, Cross( (3-D), Angle(, UnitV(, abs(VctA) for magnitude.</p>
      </div>
    </>
  );
}

/* ========================== STATISTICS ========================== */

export interface StatsData {
  twoVar: boolean;
  freqOn: boolean;
  rows: { x: string; y: string; f: string }[];
}

export const emptyStats = (): StatsData => ({
  twoVar: false,
  freqOn: false,
  rows: [{ x: "", y: "", f: "1" }, { x: "", y: "", f: "1" }, { x: "", y: "", f: "1" }],
});

export function StatsEditor({
  state, data, onData, onClose,
}: {
  state: CalcState;
  data: StatsData;
  onData: (d: StatsData) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"edit" | "result">("edit");
  const [model, setModel] = useState<RegressionModel>("linear");
  const [estIn, setEstIn] = useState("");

  const parsed = useMemo((): { rows: DataRow[]; error: string | null } => {
    const rows: DataRow[] = [];
    for (const r of data.rows) {
      if (r.x.trim() === "" && r.y.trim() === "") continue;
      const x = parseN(r.x);
      const y = data.twoVar ? parseN(r.y) : null;
      const f = data.freqOn ? parseN(r.f) ?? 1 : 1;
      if (x === null || Number.isNaN(x)) return { rows: [], error: "x must be numeric" };
      if (data.twoVar && (y === null || Number.isNaN(y))) return { rows: [], error: "y must be numeric" };
      if (!Number.isInteger(f) || f < 1 || f > 999) return { rows: [], error: "Freq must be an integer 1–999" };
      rows.push({ x, y, f });
    }
    if (rows.length === 0) return { rows: [], error: "Enter at least one row" };
    return { rows, error: null };
  }, [data]);

  const setRow = (i: number, patch: Partial<{ x: string; y: string; f: string }>) => {
    onData({ ...data, rows: data.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  };

  const oneStats = useMemo(() => {
    if (parsed.error || parsed.rows.length === 0) return null;
    try {
      return data.twoVar ? null : oneVarStats(parsed.rows);
    } catch {
      return null;
    }
  }, [parsed, data.twoVar]);

  const twoStats = useMemo(() => {
    if (parsed.error || !data.twoVar || parsed.rows.length < 2) return null;
    try {
      return twoVarStats(parsed.rows);
    } catch {
      return null;
    }
  }, [parsed, data.twoVar]);

  const reg = useMemo(
    () => (data.twoVar && !parsed.error ? computeRegression(parsed.rows, model) : null),
    [parsed, data.twoVar, model],
  );

  return (
    <>
      <Header title={`STATISTICS — ${data.twoVar ? "y=a+bx data" : "1-VARIABLE"}`} onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-tabrow">
          <button type="button" className={`calc-tab ${view === "edit" ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); setView("edit"); }}>Data</button>
          <button type="button" className={`calc-tab ${view === "result" ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); setView("result"); }}>Results</button>
          <span style={{ flex: 1 }} />
          <button type="button" className={`calc-tab ${!data.twoVar ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); onData({ ...data, twoVar: false }); }}>1-var</button>
          <button type="button" className={`calc-tab ${data.twoVar ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); onData({ ...data, twoVar: true }); }}>2-var</button>
          <button type="button" className={`calc-tab ${data.freqOn ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); onData({ ...data, freqOn: !data.freqOn }); }}>Freq</button>
        </div>

        {view === "edit" && (
          <>
            <div
              className="calc-grid-inputs"
              style={{
                gridTemplateColumns: `18px repeat(${1 + (data.twoVar ? 1 : 0) + (data.freqOn ? 1 : 0)}, 1fr) 30px`,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800 }}>#</span>
              <span style={{ fontSize: 10, fontWeight: 800, textAlign: "right" }}>x</span>
              {data.twoVar && <span style={{ fontSize: 10, fontWeight: 800, textAlign: "right" }}>y</span>}
              {data.freqOn && <span style={{ fontSize: 10, fontWeight: 800, textAlign: "right" }}>Fq</span>}
              <span />
              {data.rows.map((r, i) => (
                <Fragment key={i}>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{i + 1}</span>
                  <input inputMode="decimal" value={r.x} aria-label={`row ${i + 1} x`}
                    onChange={(e) => setRow(i, { x: e.target.value })} />
                  {data.twoVar && (
                    <input inputMode="decimal" value={r.y} aria-label={`row ${i + 1} y`}
                      onChange={(e) => setRow(i, { y: e.target.value })} />
                  )}
                  {data.freqOn && (
                    <input inputMode="numeric" value={r.f} aria-label={`row ${i + 1} frequency`}
                      onChange={(e) => setRow(i, { f: e.target.value })} />
                  )}
                  <button type="button" className="calc-mini-btn" aria-label={`Delete row ${i + 1}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onData({ ...data, rows: data.rows.filter((_, k) => k !== i) });
                    }}>
                    ×
                  </button>
                </Fragment>
              ))}
            </div>
            {parsed.error && <p className="calc-note" role="alert">{parsed.error}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="button" className="calc-mini-btn"
                disabled={data.rows.length >= 80}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onData({ ...data, rows: [...data.rows, { x: "", y: "", f: "1" }] });
                }}>
                + row
              </button>
              <button type="button" className="calc-mini-btn" aria-label="Reset data"
                onPointerDown={(e) => { e.preventDefault(); onData(emptyStats()); }}>
                Reset
              </button>
            </div>
          </>
        )}

        {view === "result" && parsed.error && <p className="calc-note" role="alert">{parsed.error}</p>}
        {view === "result" && !parsed.error && !data.twoVar && oneStats && (
          <>
            {([
              ["n (count)", oneStats.n],
              ["Σx", oneStats.sum],
              ["Σx²", oneStats.sumSq],
              ["x̄ mean", oneStats.mean],
              ["σx population SD", oneStats.sdPop],
              ["sx sample SD", oneStats.sdSample],
              ["σ²x population var", oneStats.varPop],
              ["s²x sample var", oneStats.varSample],
              ["minX", oneStats.min],
              ["Q1", oneStats.q1],
              ["med", oneStats.med],
              ["Q3", oneStats.q3],
              ["maxX", oneStats.max],
            ] as [string, number][]).map(([label, v]) => (
              <div key={label} className="calc-stat-res"><span>{label}</span><b>{fmt(v, state.settings)}</b></div>
            ))}
            <p className="calc-note">σx divides by n; sx divides by n−1 (like the hardware’s two SDs).</p>
          </>
        )}
        {view === "result" && !parsed.error && data.twoVar && twoStats && (
          <>
            {([
              ["n", twoStats.x.n],
              ["x̄", twoStats.x.mean],
              ["σx", twoStats.x.sdPop],
              ["sx", twoStats.x.sdSample],
              ["ȳ", twoStats.y.mean],
              ["σy", twoStats.y.sdPop],
              ["sy", twoStats.y.sdSample],
              ["Σx", twoStats.x.sum],
              ["Σy", twoStats.y.sum],
              ["Σx²", twoStats.x.sumSq],
              ["Σy²", twoStats.y.sumSq],
              ["Σxy", twoStats.sumXY],
              ["r", twoStats.r],
            ] as [string, number][]).map(([label, v]) => (
              <div key={label} className="calc-stat-res"><span>{label}</span><b>{fmt(v, state.settings)}</b></div>
            ))}
            <p className="calc-note" style={{ fontWeight: 800, marginTop: 8 }}>Regression model</p>
            <div className="calc-tabrow">
              {(Object.keys(REGRESSION_FORMS) as RegressionModel[]).map((m) => (
                <button key={m} type="button" className={`calc-tab ${model === m ? "on" : ""}`}
                  onPointerDown={(e) => { e.preventDefault(); setModel(m); }}>
                  {m}
                </button>
              ))}
            </div>
            {reg && !reg.valid && <p className="calc-note" role="alert">{reg.reason}</p>}
            {reg && reg.valid && (
              <>
                <div className="calc-stat-res"><span>{reg.form}</span><span /></div>
                <div className="calc-stat-res"><span>a</span><b>{fmt(reg.a!, state.settings)}</b></div>
                <div className="calc-stat-res"><span>b</span><b>{fmt(reg.b!, state.settings)}</b></div>
                {reg.c !== undefined && <div className="calc-stat-res"><span>c</span><b>{fmt(reg.c, state.settings)}</b></div>}
                {reg.r !== undefined && <div className="calc-stat-res"><span>r</span><b>{fmt(reg.r, state.settings)}</b></div>}
                {model !== "quad" && (
                  <div className="calc-field">
                    <span className="flabel">Estimate</span>
                    <input type="number" value={estIn} onChange={(e) => setEstIn(e.target.value)} aria-label="Estimation input" />
                  </div>
                )}
                {model !== "quad" && estIn.trim() !== "" && Number.isFinite(Number(estIn)) && reg.a !== undefined && reg.b !== undefined && (
                  <div className="calc-stat-res">
                    <span>ŷ = f({estIn})</span>
                    <b>{(() => {
                      const y = estimateY(reg, Number(estIn));
                      return y === null ? "undefined" : fmt(y, state.settings);
                    })()}</b>
                  </div>
                )}
                {model !== "quad" && reg.a !== undefined && reg.b !== undefined && estIn.trim() !== "" && Number.isFinite(Number(estIn)) && (
                  <div className="calc-stat-res">
                    <span>x̂ from y={estIn}</span>
                    <b>{(() => {
                      const x = estimateX(reg, Number(estIn));
                      return x === null ? "undefined" : fmt(x, state.settings);
                    })()}</b>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {view === "result" && !parsed.error && data.twoVar && !twoStats && (
          <p className="calc-note">Add at least 2 complete (x, y) rows.</p>
        )}
      </div>
    </>
  );
}

/* ============================= TABLE ============================ */

export interface TableCfg {
  f: string;
  g: string;
  start: string;
  end: string;
  step: string;
}

export const emptyTable = (): TableCfg => ({ f: "", g: "", start: "-1", end: "1", step: "0.5" });

export function TableEditor({
  state, cfg, onCfg, onClose,
}: {
  state: CalcState;
  cfg: TableCfg;
  onCfg: (c: TableCfg) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<{ x: number; fx: number | null; gx: number | null }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const generate = () => {
    try {
      if (cfg.f.trim() === "") {
        setErr("Enter f(x) first — e.g. x^2+1");
        setRows(null);
        return;
      }
      const start = Number(cfg.start);
      const end = Number(cfg.end);
      const step = Number(cfg.step);
      const f = compileFunction(cfg.f, { ...state.vars }, state.settings.angle);
      const g = cfg.g.trim() !== "" ? compileFunction(cfg.g, { ...state.vars }, state.settings.angle) : null;
      const r = tableValues(f, g, start, end, step);
      setRows(r);
      setErr(null);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Invalid configuration");
      setRows(null);
    }
  };

  return (
    <>
      <Header title="TABLE (numeric function values)" onClose={onClose} />
      <div className="calc-overlay-body">
        {([["f(x) =", "f"], ["g(x) = (optional)", "g"]] as const).map(([label, k]) => (
          <div key={k} className="calc-field">
            <span className="flabel">{label}</span>
            <input type="text" value={cfg[k]} placeholder="x^2+sin(x)"
              onChange={(e) => onCfg({ ...cfg, [k]: e.target.value })} aria-label={label} />
          </div>
        ))}
        <div className="calc-field">
          <span className="flabel">Start</span>
          <input type="number" value={cfg.start} onChange={(e) => onCfg({ ...cfg, start: e.target.value })} aria-label="Start" />
        </div>
        <div className="calc-field">
          <span className="flabel">End</span>
          <input type="number" value={cfg.end} onChange={(e) => onCfg({ ...cfg, end: e.target.value })} aria-label="End" />
        </div>
        <div className="calc-field">
          <span className="flabel">Step</span>
          <input type="number" value={cfg.step} onChange={(e) => onCfg({ ...cfg, step: e.target.value })} aria-label="Step" />
        </div>
        <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); generate(); }}>
          Generate table
        </button>
        {err && <p className="calc-note" role="alert">{err}</p>}
        {rows && rows.length > 0 && (
          <div className="calc-grid-inputs" style={{ gridTemplateColumns: `1fr 1fr${cfg.g.trim() ? " 1fr" : ""}`, marginTop: 8 }}>
            <b style={{ textAlign: "right" }}>x</b>
            <b style={{ textAlign: "right" }}>f(x)</b>
            {cfg.g.trim() && <b style={{ textAlign: "right" }}>g(x)</b>}
            {rows.map((r, i) => (
              <Fragment key={i}>
                <span style={{ textAlign: "right" }}>{fmt(r.x, state.settings)}</span>
                <span style={{ textAlign: "right" }}>{r.fx === null ? "ERROR" : fmt(r.fx, state.settings)}</span>
                {cfg.g.trim() && <span style={{ textAlign: "right" }}>{r.gx === null ? "ERROR" : fmt(r.gx, state.settings)}</span>}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* =========================== EQUATION =========================== */

export function EquationEditor({ state, onClose }: { state: CalcState; onClose: () => void }) {
  const [tab, setTab] = useState<"simul" | "poly" | "solve">("simul");
  const [n, setN] = useState(2);
  const [deg, setDeg] = useState(2);
  const [coef, setCoef] = useState<string[]>(Array(6).fill("") as string[]);
  const [out, setOut] = useState<string[] | null>(null);
  const [solveF, setSolveF] = useState("x^2-2");
  const [solveX0, setSolveX0] = useState("1");
  const s = state.settings;

  const VAR_LETTERS = ["x", "y", "z", "w"];

  const runSimul = () => {
    const rows: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        const v = parseN(coef[i * (n + 1) + j] ?? "");
        if (v === null || Number.isNaN(v)) {
          setOut([`Cell r${i + 1} c${j + 1} is not a number`]);
          return;
        }
        row.push(v);
      }
      const bv = parseN(coef[i * (n + 1) + n] ?? "");
      if (bv === null || Number.isNaN(bv)) {
        setOut([`Row ${i + 1} constant is not a number`]);
        return;
      }
      rows.push(row);
      b.push(bv);
    }
    try {
      const r = solveLinearSystem(rows, b);
      if (r.type === "none") setOut(["No solution (system is inconsistent)"]);
      else if (r.type === "infinite") setOut(["Infinitely many solutions (dependent equations)"]);
      else setOut(r.x.map((xv, i) => `${VAR_LETTERS[i]} = ${fmt(xv, s)}`));
    } catch (e2) {
      setOut([e2 instanceof Error ? e2.message : "Solve error"]);
    }
  };

  const runPoly = () => {
    const coeffs: number[] = [];
    for (let i = 0; i <= deg; i++) {
      const v = parseN(coef[i] ?? "");
      if (v === null || Number.isNaN(v)) {
        setOut([`Coefficient ${VAR_LETTERS[i] ?? i} is not a number`]);
        return;
      }
      coeffs.push(v);
    }
    if (coeffs[0] === 0) {
      setOut(["Leading coefficient must be ≠ 0"]);
      return;
    }
    try {
      const r = polynomialRoots(coeffs);
      setOut(
        r.roots.map((ro, i) => {
          const x = ro.root;
          const v: Value = Math.abs(x.im) < 1e-10
            ? { kind: "num", real: x.re, frac: null }
            : cxVal(x);
          const mult = ro.multiplicity > 1 ? `  (×${ro.multiplicity})` : "";
          return `x${r.roots.length > 1 ? i + 1 : ""} = ${valueToText(v, s)}${mult}`;
        }),
      );
    } catch (e2) {
      setOut([e2 instanceof Error ? e2.message : "Solve error"]);
    }
  };

  const runSolve = () => {
    try {
      const f = compileFunction(solveF, { ...state.vars }, s.angle);
      const r = solveNewton(f, Number(solveX0));
      if (!Number.isFinite(Number(solveX0))) {
        setOut(["Initial value must be numeric"]);
        return;
      }
      setOut(
        r.converged
          ? [`x = ${fmt(r.root, s)}`, `converged in ${r.iterations} iterations`]
          : ["Newton–Raphson did not converge — try a different start value"],
      );
    } catch (e2) {
      setOut([e2 instanceof Error ? e2.message : "Solve error"]);
    }
  };

  return (
    <>
      <Header title="EQUATION / FUNC" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-tabrow">
          <button type="button" className={`calc-tab ${tab === "simul" ? "on" : ""}`} onPointerDown={(e) => { e.preventDefault(); setTab("simul"); setOut(null); }}>Simul</button>
          <button type="button" className={`calc-tab ${tab === "poly" ? "on" : ""}`} onPointerDown={(e) => { e.preventDefault(); setTab("poly"); setOut(null); }}>Polynomial</button>
          <button type="button" className={`calc-tab ${tab === "solve" ? "on" : ""}`} onPointerDown={(e) => { e.preventDefault(); setTab("solve"); setOut(null); }}>Solver</button>
        </div>

        {tab === "simul" && (
          <>
            <div className="calc-field">
              <span className="flabel">Unknowns</span>
              <span>
                {[2, 3, 4].map((k) => (
                  <button key={k} type="button" className={`calc-tab ${n === k ? "on" : ""}`}
                    onPointerDown={(e) => { e.preventDefault(); setN(k); setCoef(Array(20).fill("")); setOut(null); }}>
                    {k}
                  </button>
                ))}
              </span>
            </div>
            <p className="calc-note">
              Each row: a₁x + a₂y{n > 2 ? " + a₃z" : ""}{n > 3 ? " + a₄w" : ""} = c
            </p>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="calc-grid-inputs"
                style={{ gridTemplateColumns: `repeat(${n}, 1fr) 14px 1fr`, margin: "4px 0", alignItems: "center" }}>
                {Array.from({ length: n }, (_, j) => (
                  <input key={j} inputMode="decimal" aria-label={`equation ${i + 1} coefficient ${VAR_LETTERS[j]}`}
                    value={coef[i * (n + 1) + j] ?? ""}
                    onChange={(e) => {
                      const next = coef.slice();
                      next[i * (n + 1) + j] = e.target.value;
                      setCoef(next);
                    }} />
                ))}
                <span>=</span>
                <input inputMode="decimal" aria-label={`equation ${i + 1} constant`}
                  value={coef[i * (n + 1) + n] ?? ""}
                  onChange={(e) => {
                    const next = coef.slice();
                    next[i * (n + 1) + n] = e.target.value;
                    setCoef(next);
                  }} />
              </div>
            ))}
            <button type="button" className="calc-mini-btn" style={{ marginTop: 6 }}
              onPointerDown={(e) => { e.preventDefault(); runSimul(); }}>Solve</button>
          </>
        )}

        {tab === "poly" && (
          <>
            <div className="calc-field">
              <span className="flabel">Degree</span>
              <span>
                {[2, 3, 4].map((k) => (
                  <button key={k} type="button" className={`calc-tab ${deg === k ? "on" : ""}`}
                    onPointerDown={(e) => { e.preventDefault(); setDeg(k); setCoef(Array(20).fill("")); setOut(null); }}>
                    {k}
                  </button>
                ))}
              </span>
            </div>
            <p className="calc-note">
              ax² + bx + c = 0 {deg === 3 ? "  (a,x³…d)" : ""}{deg === 4 ? "  (a,x⁴…e)" : ""}
            </p>
            <div className="calc-grid-inputs" style={{ gridTemplateColumns: `repeat(${deg + 1}, 1fr)` }}>
              {Array.from({ length: deg + 1 }, (_, i) => (
                <input key={i} inputMode="decimal" aria-label={`coefficient ${"abcde"[i]}`}
                  placeholder={`${"abcde"[i]}`}
                  value={coef[i] ?? ""}
                  onChange={(e) => {
                    const next = coef.slice();
                    next[i] = e.target.value;
                    setCoef(next);
                  }} />
              ))}
            </div>
            <p className="calc-note">degree-4 roots via Durand–Kerner iteration (numeric)</p>
            <button type="button" className="calc-mini-btn" style={{ marginTop: 6 }}
              onPointerDown={(e) => { e.preventDefault(); runPoly(); }}>Solve</button>
          </>
        )}

        {tab === "solve" && (
          <>
            <div className="calc-field">
              <span className="flabel">f(x) =</span>
              <input type="text" value={solveF} onChange={(e) => setSolveF(e.target.value)} aria-label="f of x" />
            </div>
            <div className="calc-field">
              <span className="flabel">initial x₀</span>
              <input type="number" value={solveX0} onChange={(e) => setSolveX0(e.target.value)} aria-label="initial x" />
            </div>
            <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); runSolve(); }}>Solve</button>
            <p className="calc-note">Numeric Newton solve — reports when convergence fails.</p>
            {out === null && (
              <button type="button" className="calc-mini-btn" aria-label="Store root to X"
                disabled
                style={{ opacity: 0.4 }}>
                —
              </button>
            )}
          </>
        )}

        {out && (
          <div style={{ marginTop: 8, borderTop: "1.5px solid currentColor", paddingTop: 4 }}>
            {out.map((line, i) => (
              <div key={i} className="calc-stat-res"><span>{line}</span></div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ========================== INEQUALITY ========================== */

export function IneqEditor({ state, onClose }: { state: CalcState; onClose: () => void }) {
  const [deg, setDeg] = useState<1 | 2 | 3>(2);
  const [sense, setSense] = useState<IneqSense>(">");
  const [coef, setCoef] = useState<string[]>(["", "", "", ""]);
  const [out, setOut] = useState<string[] | null>(null);

  const run = () => {
    const coeffs: number[] = [];
    for (let i = 0; i <= deg; i++) {
      const v = parseN(coef[i]);
      if (v === null || Number.isNaN(v)) {
        setOut([`Coefficient ${"abcd"[i]} is not a number`]);
        return;
      }
      coeffs.push(v);
    }
    if (coeffs[0] === 0) {
      setOut(["Leading coefficient must be ≠ 0"]);
      return;
    }
    try {
      const r = solveInequality(coeffs, sense, deg);
      setOut(r.intervals.length === 0 ? ["No solution"] : r.intervals.map(intervalText(r.sense)));
    } catch (e2) {
      setOut([e2 instanceof Error ? e2.message : "Error"]);
    }
  };

  function intervalText(sg: IneqSense) {
    const isEq = sg === "<=" || sg === ">=";
    const lt = isEq ? "≤" : "<";
    const gt = isEq ? "≥" : ">";
    return ([lo, hi]: [number, number]): string => {
      const f = (v: number) => fmt(v, state.settings);
      if (lo === -Infinity && hi === Infinity) return "All real numbers";
      if (lo === -Infinity) return `x ${lt} ${f(hi)}`;
      if (hi === Infinity) return `x ${gt} ${f(lo)}`;
      if (lo === hi) return `x = ${fmt(lo, state.settings)}`;
      return `${fmt(lo, state.settings)} ${lt} x ${lt} ${f(hi)}`;
    };
  }

  return (
    <>
      <Header title="INEQUALITY  p(x) □ 0" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-field">
          <span className="flabel">Degree</span>
          <span>
            {([1, 2, 3] as const).map((k) => (
              <button key={k} type="button" className={`calc-tab ${deg === k ? "on" : ""}`}
                onPointerDown={(e) => { e.preventDefault(); setDeg(k); setOut(null); }}>
                {k}
              </button>
            ))}
          </span>
        </div>
        <div className="calc-field">
          <span className="flabel">Sign</span>
          <span>
            {([">", ">=", "<", "<="] as IneqSense[]).map((k) => (
              <button key={k} type="button" className={`calc-tab ${sense === k ? "on" : ""}`}
                onPointerDown={(e) => { e.preventDefault(); setSense(k); setOut(null); }}>
                {k === ">=" ? "≥" : k === "<=" ? "≤" : k}
              </button>
            ))}
          </span>
        </div>
        <div className="calc-grid-inputs" style={{ gridTemplateColumns: `repeat(${deg + 1}, 1fr)`, margin: "6px 0" }}>
          {Array.from({ length: deg + 1 }, (_, i) => (
            <input key={i} inputMode="decimal" placeholder={`${"abcd"[i]}`} aria-label={`coefficient ${"abcd"[i]}`}
              value={coef[i]}
              onChange={(e) => {
                const next = coef.slice();
                next[i] = e.target.value;
                setCoef(next);
              }} />
          ))}
        </div>
        <p className="calc-note">{"abcd".slice(0, deg + 1)} — coefficients of x^{deg}…x⁰</p>
        <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); run(); }}>Solve</button>
        {out && (
          <div style={{ marginTop: 8, borderTop: "1.5px solid currentColor", paddingTop: 4 }}>
            {out.map((line, i) => (
              <div key={i} className="calc-stat-res"><span>{line}</span></div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ========================= DISTRIBUTION ========================= */

const DIST_DEFS: { id: string; name: string; params: [string, string][]; run: (v: number[]) => number }[] = [
  { id: "npd", name: "Normal PD", params: [["x", "1"], ["μ", "0"], ["σ", "1"]], run: ([x, m, sg]) => normalPDF(x, m, sg) },
  { id: "ncd", name: "Normal CD", params: [["lower", "-1"], ["upper", "1"], ["μ", "0"], ["σ", "1"]], run: ([l, u, m, sg]) => normalCD(l, u, m, sg) },
  { id: "ninv", name: "Inverse Normal (area⇒x)", params: [["area", "0.975"], ["μ", "0"], ["σ", "1"]], run: ([p, m, sg]) => invNormalCDF(p, m, sg) },
  { id: "bpd", name: "Binomial PD", params: [["x", "2"], ["n", "4"], ["p", "0.5"]], run: ([x, n2, p]) => binomialPD(x, n2, p) },
  { id: "bcd", name: "Binomial CD", params: [["x", "2"], ["n", "4"], ["p", "0.5"]], run: ([x, n2, p]) => binomialCD(x, n2, p) },
  { id: "ppd", name: "Poisson PD", params: [["x", "2"], ["λ", "3"]], run: ([x, l]) => poissonPD(x, l) },
  { id: "pcd", name: "Poisson CD", params: [["x", "2"], ["λ", "3"]], run: ([x, l]) => poissonCD(x, l) },
];

export function DistEditor({ state, onClose }: { state: CalcState; onClose: () => void }) {
  const [id, setId] = useState("ncd");
  const def = DIST_DEFS.find((d) => d.id === id)!;
  const [vals, setVals] = useState<string[]>(def.params.map((p) => p[1]));
  const [out, setOut] = useState<string | null>(null);

  const run = () => {
    const nums: number[] = [];
    for (let i = 0; i < def.params.length; i++) {
      const v = parseN(vals[i]);
      if (v === null || Number.isNaN(v)) {
        setOut(`${def.params[i][0]} is not a number`);
        return;
      }
      nums.push(v);
    }
    try {
      const r = def.run(nums);
      setOut(`${def.name} = ${fmt(r, state.settings)}`);
    } catch (e2) {
      setOut(e2 instanceof Error ? e2.message : "Math ERROR");
    }
  };

  return (
    <>
      <Header title="DISTRIBUTION" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-tabrow">
          {DIST_DEFS.map((d) => (
            <button key={d.id} type="button" className={`calc-tab ${id === d.id ? "on" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                setId(d.id);
                setVals(d.params.map((p) => p[1]));
                setOut(null);
              }}>
              {d.name}
            </button>
          ))}
        </div>
        {def.params.map(([label, _], i) => (
          <div key={label} className="calc-field">
            <span className="flabel">{label}</span>
            <input type="number" value={vals[i]}
              onChange={(e) => {
                const next = vals.slice();
                next[i] = e.target.value;
                setVals(next);
              }}
              aria-label={label} />
          </div>
        ))}
        <button type="button" className="calc-mini-btn" style={{ marginTop: 6 }}
          onPointerDown={(e) => { e.preventDefault(); run(); }}>Calculate</button>
        {out && <div className="calc-stat-res" style={{ marginTop: 8 }}><span>{out}</span></div>}
        <p className="calc-note">Normal CDF via erf approximation (|ε| ≤ 1.5e-7); inverse via Acklam + Halley step.</p>
      </div>
    </>
  );
}

/* ============================= RATIO ============================ */

export function RatioEditor({ state, onClose }: { state: CalcState; onClose: () => void }) {
  const [vals, setVals] = useState(["1", "", "2", "6"]);
  const [unk, setUnk] = useState(1);
  const [out, setOut] = useState<string | null>(null);

  const run = () => {
    const nums = vals.map((v, i) => (i === unk ? NaN : parseN(v)));
    for (let i = 0; i < 4; i++) {
      if (i !== unk && (nums[i] === null || Number.isNaN(nums[i]))) {
        setOut(`Value ${"ABCD"[i]} is not a number`);
        return;
      }
    }
    const [a, b, c, d] = nums as number[];
    // A : B = C : D  →  A/B = C/D
    try {
      let x: number;
      if (unk === 0) x = (b! * c!) / d!;
      else if (unk === 1) x = (a! * d!) / c!;
      else if (unk === 2) x = (a! * d!) / b!;
      else x = (b! * c!) / a!;
      if (!Number.isFinite(x)) throw new Error("Division by zero in ratio");
      setOut(`X = ${fmt(x, state.settings)}`);
    } catch (e2) {
      setOut(e2 instanceof Error ? e2.message : "Cannot solve");
    }
  };

  return (
    <>
      <Header title="RATIO   A : B = C : X" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-field">
          <span className="flabel">Solve for</span>
          <span>
            {([0, 1, 2, 3] as const).map((k) => (
              <button key={k} type="button" className={`calc-tab ${unk === k ? "on" : ""}`}
                aria-label={`Solve for X at position ${"ABCD"[k]}`}
                onPointerDown={(e) => { e.preventDefault(); setUnk(k); setOut(null); }}>
                {"ABCD"[k]}
              </button>
            ))}
          </span>
        </div>
        <div className="calc-grid-inputs" style={{ gridTemplateColumns: "1fr 14px 1fr 20px 1fr 14px 1fr", alignItems: "center", margin: "8px 0" }}>
          {vals.map((v, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i === unk ? (
                <span style={{ textAlign: "center", fontWeight: 800 }}>X</span>
              ) : (
                <input inputMode="decimal" aria-label={`value ${"ABCD"[i]}`} value={v}
                  onChange={(e) => {
                    const next = vals.slice();
                    next[i] = e.target.value;
                    setVals(next);
                  }} />
              )}
              {(i === 0 || i === 2) && <span style={{ textAlign: "center" }}>:</span>}
              {i === 1 && <span style={{ textAlign: "center" }}>=</span>}
            </span>
          ))}
        </div>
        <button type="button" className="calc-mini-btn" onPointerDown={(e) => { e.preventDefault(); run(); }}>Solve</button>
        {out && <div className="calc-stat-res" style={{ marginTop: 8 }}><span>{out}</span></div>}
      </div>
    </>
  );
}

/* ============================ MATH BOX ========================== */

export function MathBoxEditor({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<"dice" | "coin">("dice");
  const [count, setCount] = useState(2);
  const [out, setOut] = useState<number[] | null>(null);
  const [coins, setCoins] = useState<("H" | "T")[] | null>(null);

  return (
    <>
      <Header title="MATH BOX" onClose={onClose} />
      <div className="calc-overlay-body">
        <div className="calc-tabrow">
          <button type="button" className={`calc-tab ${kind === "dice" ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); setKind("dice"); }}>Dice</button>
          <button type="button" className={`calc-tab ${kind === "coin" ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); setKind("coin"); }}>Coin toss</button>
          {[1, 2, 3].map((k) => (
            <button key={k} type="button" className={`calc-tab ${count === k ? "on" : ""}`}
              onPointerDown={(e) => { e.preventDefault(); setCount(k); }}>
              ×{k}
            </button>
          ))}
        </div>
        <button type="button" className="calc-mini-btn" style={{ fontSize: 13, padding: "6px 14px" }}
          onPointerDown={(e) => {
            e.preventDefault();
            if (kind === "dice") {
              setOut(Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6)));
              setCoins(null);
            } else {
              setCoins(Array.from({ length: count }, () => (Math.random() < 0.5 ? "H" : "T")));
              setOut(null);
            }
          }}>
          {kind === "dice" ? "Roll" : "Toss"}
        </button>
        {out && (
          <div style={{ marginTop: 10, fontSize: 20, fontWeight: 800, letterSpacing: 4 }} aria-live="polite">
            {out.map((d) => ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][d - 1]).join(" ")}
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0 }}>Σ = {out.reduce((a, b) => a + b, 0)}</div>
          </div>
        )}
        {coins && (
          <div style={{ marginTop: 10, fontSize: 20, fontWeight: 800, letterSpacing: 8 }} aria-live="polite">
            {coins.join(" ")}
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0 }}>
              Heads: {coins.filter((c) => c === "H").length}, Tails: {coins.filter((c) => c === "T").length}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
