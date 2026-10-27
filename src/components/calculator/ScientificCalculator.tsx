"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import "./calculator.css";
import {
  CalcState, initialState, loadState, saveState, pressKey, insertTokens,
  setMode, setAngleUnit, updateSettings, clearHistory as clearHistoryAction,
  clearVars, clearMatricesVectors, replayEntry, setMatrix, setVector, setBasenRadix,
  CalcSettings, ModeId, HistoryEntry, MODES,
} from "@/lib/calculator/session";
import { tokenize, tok, Tok } from "@/lib/calculator/parser";
import { formatBase, groupBin, Radix } from "@/lib/calculator/basen";
import { keyIdForChar } from "@/lib/calculator/session";
import { clearPersisted } from "@/lib/calculator/session";
import { FUNC_ARITY } from "@/lib/calculator/parser";
import { CalculatorScreen } from "./CalculatorScreen";
import { CalculatorKeypad } from "./CalculatorKeypad";
import { HomeMenu, SettingsPanel, CatalogPanel, HistoryPanel, ToolsPanel, HelpPanel, CalcActions } from "./Overlays";
import {
  MatrixEditor, VectorEditor, StatsEditor, TableEditor, EquationEditor, IneqEditor,
  DistEditor, RatioEditor, MathBoxEditor, StatsData, TableCfg, emptyStats, emptyTable,
} from "./Editors";

type OverlayId =
  | "menu" | "settings" | "catalog" | "history" | "tools" | "help"
  | "matrix" | "vector"
  | null;

const EDITOR_MODES: ModeId[] = ["stats", "table", "equation", "ineq", "dist", "ratio", "mathbox"];

export function ScientificCalculator() {
  // SSR-disabled at the page level, so we can hydrate from localStorage here
  const [state, setState] = useState<CalcState>(() => {
    const base = initialState();
    if (typeof window === "undefined") return base;
    const saved = loadState();
    return saved ? { ...base, ...saved } : base;
  });
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [statsData, setStatsData] = useState<StatsData>(emptyStats);
  const [tableCfg, setTableCfg] = useState<TableCfg>(emptyTable);

  // persist whenever state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const haptic = useCallback(() => {
    if (state.settings.haptic && typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(6); } catch { /* unsupported */ }
    }
  }, [state.settings.haptic]);

  const press = useCallback((id: string) => {
    setState((s) => pressKey(s, id));
    haptic();
    void id;
  }, [haptic]);

  /** keypad presses are ignored while an on-screen menu/editor is open,
   *  except digits 1–9 which pick apps from the HOME menu (like CW) */
  const pressGuarded = useCallback((id: string) => {
    void setState; // keep state referenced
    if (overlay === "menu" && /^d[1-9]$/.test(id)) {
      const idx = Number(id[1]) - 1;
      if (idx < MODES.length) {
        setState((s) => setMode(s, MODES[idx].id));
        setOverlay(null);
      }
      return;
    }
    if (overlay !== null || EDITOR_MODES.includes(state.mode)) return;
    press(id);
  }, [overlay, state.mode, press]);

  const act = useMemo<CalcActions>(() => ({
    press,
    setMode: (m) =>
      setState((s) => setMode(s, m)),
    insertToks: (toks) => setState((s) => insertTokens(s, toks)),
    insertSource: (src) => {
      try {
        const toks = tokenize(src);
        // split multi-char numbers for editing granularity
        const split: Tok[] = [];
        for (const t of toks) {
          if (t.t === "num" && t.s.length > 1) for (const ch of t.s) split.push(tok("num", ch));
          else split.push(t);
        }
        setState((s) => insertTokens(s, split));
      } catch {
        /* invalid source — ignore */
      }
    },
    updateSettings: (patch) => setState((s) => updateSettings(s, patch)),
    clearHistory: () => setState((s) => clearHistoryAction(s)),
    clearVars: () => setState((s) => clearVars(s)),
    clearMatrices: () => setState((s) => clearMatricesVectors(s)),
    hardReset: () => {
      clearPersisted();
      setState(initialState());
      setOverlay(null);
      setStatsData(emptyStats());
      setTableCfg(emptyTable());
    },
    replayEntry: (e: HistoryEntry) => setState((s) => replayEntry(s, e)),
    openOverlay: (o: string | null) => setOverlay(o as OverlayId),
  }), [press]);

  const onMetal = useCallback((action: "menu" | "settings" | "catalog" | "tools" | "back" | "help") => {
    if (action === "back") {
      setOverlay((o) => {
        if (o !== null) return null;
        return o;
      });
      if (overlay === null) {
        setState((s) => pressKey(s, "ac"));
      }
      return;
    }
    setOverlay((o) => (o === action ? null : (action as OverlayId)));
  }, [overlay]);

  /* ------------------------- physical keyboard ----------------------- */

  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return; // never steal input focus
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
          e.preventDefault();
          setState((s) => pressKey(s, "shift")); // shift+del = undo
          setState((s) => pressKey(s, "del"));
        }
        return; // leave browser shortcuts alone
      }
      // menu overlay quick select
      if (overlay === "menu" && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        const modes = MODES;
        if (idx < modes.length) {
          setState((s) => setMode(s, modes[idx].id));
          setOverlay(null);
        }
        return;
      }
      const blocked = overlay !== null || EDITOR_MODES.includes(state.mode);
      if (blocked) {
        if (e.key === "Escape") {
          e.preventDefault();
          setOverlay(null);
        }
        return;
      }
      const k = e.key;
      let handled = true;
      if (k === "Enter" || k === "=") setState((s) => pressKey(s, "exe"));
      else if (k === "Backspace") setState((s) => pressKey(s, "del"));
      else if (k === "Delete") {
        // forward delete: remove token under cursor
        setState((s) => {
          const right = pressKey(s, "nav-right");
          return pressKey(right, "del");
        });
      } else if (k === "Escape") setState((s) => pressKey(s, "ac"));
      else if (k === "ArrowLeft") setState((s) => pressKey(s, "nav-left"));
      else if (k === "ArrowRight") setState((s) => pressKey(s, "nav-right"));
      else if (k === "ArrowUp") setState((s) => pressKey(s, "nav-up"));
      else if (k === "ArrowDown") setState((s) => pressKey(s, "nav-down"));
      else if (k === "x" || k === "X") setState((s) => insertTokens(s, [tok("var", "X")]));
      else if (k === "y" || k === "Y") setState((s) => insertTokens(s, [tok("var", "Y")]));
      else if (/^[a-fA-F]$/.test(k) || k === "m" || k === "M") {
        // variables / hex letters
        setState((s) => insertTokens(s, [tok("var", k.toUpperCase())]));
      } else if (k === "p" || k.toLowerCase() === "π") setState((s) => insertTokens(s, [tok("const", "pi")]));
      else if (k === "e") setState((s) => insertTokens(s, [tok("const", "e")]));
      else {
        const id = keyIdForChar(k);
        if (id) setState((s) => pressKey(s, id));
        else handled = false;
      }
      if (handled) {
        e.preventDefault();
        haptic();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlay, state.mode, haptic]);

  /* ------------------------- mode toolbars --------------------------- */

  const chips = useMemo(() => {
    interface Chip { label: string; toks: Tok[]; aria: string; hexOnly?: boolean }
    const chip = (label: string, toks: Tok[], aria?: string): Chip => ({ label, toks, aria: aria ?? label });
    if (state.mode === "complex") {
      return [
        chip("i", [tok("const", "i")], "imaginary unit i"),
        chip("∠", [tok("op", "angle")], "polar angle"),
        chip("Conjg(", [tok("func", "conjg"), tok("lp", "(")], "conjugate"),
        chip("arg(", [tok("func", "arg"), tok("lp", "(")], "argument"),
        chip("|x|", [tok("func", "abs"), tok("lp", "(")], "modulus"),
      ];
    }
    if (state.mode === "matrix") {
      return [
        ...(["MatA", "MatB", "MatC", "MatD"] as const).map((n) => chip(n, [tok("var", n)])),
        chip("det(", [tok("func", "det"), tok("lp", "(")], "determinant"),
        chip("Tr(", [tok("func", "tr"), tok("lp", "(")], "trace"),
        { label: "ᵀ", toks: [tok("post", "T")], aria: "transpose" },
      ];
    }
    if (state.mode === "vector") {
      return [
        ...(["VctA", "VctB", "VctC", "VctD"] as const).map((n) => chip(n, [tok("var", n)])),
        chip("Dot(", [tok("func", "dot"), tok("lp", "(")]),
        chip("Cross(", [tok("func", "cross"), tok("lp", "(")]),
        chip("Angle(", [tok("func", "vangle"), tok("lp", "(")]),
        chip("UnitV(", [tok("func", "unitvec"), tok("lp", "(")]),
      ];
    }
    if (state.mode === "basen") {
      return [
        ...(["0x", "and", "or", "xor", "xnor"] as const).map((w) =>
          w === "0x" ? chip("Neg(", [tok("func", "neg"), tok("lp", "(")], "bitwise NOT") : chip(w, [tok("op", w)], `bitwise ${w}`),
        ),
        ...(["A", "B", "C", "D", "E", "F"] as const).map((h) => ({
          label: h,
          toks: [tok("var", h)],
          aria: `hex digit ${h}`,
          hexOnly: true,
        })),
      ];
    }
    return [];
  }, [state.mode]);

  void FUNC_ARITY; // reserved for future catalog filtering

  const baseStrip = state.mode === "basen" && state.result ? (
    <div className="calc-bases" aria-label="Base conversions of result">
      {(["dec", "hex", "oct", "bin"] as Radix[]).map((r) => (
        <span key={r} className={`calc-baserow ${r === state.basenRadix ? "on" : ""}`}>
          <b>{r.toUpperCase()}</b>
          <span className="mono">
            {r === "bin"
              ? groupBin(formatBase(state.result!.value.kind === "num" ? state.result!.value.real : 0, r))
              : formatBase(state.result!.value.kind === "num" ? state.result!.value.real : 0, r)}
          </span>
        </span>
      ))}
    </div>
  ) : null;

  /* ------------------------- overlay content ------------------------- */

  const overlayNode = (() => {
    const close = () => setOverlay(null);
    if (overlay === "menu") return <HomeMenu act={act} onClose={close} />;
    if (overlay === "settings") return <SettingsPanel state={state} act={act} onClose={close} />;
    if (overlay === "catalog") return <CatalogPanel state={state} act={act} onClose={close} />;
    if (overlay === "history") return <HistoryPanel state={state} act={act} onClose={close} />;
    if (overlay === "tools") return <ToolsPanel state={state} act={act} onClose={close} />;
    if (overlay === "help") return <HelpPanel onClose={close} />;
    if (overlay === "matrix") {
      return (
        <MatrixEditor state={state} onClose={close}
          onSave={(n, m) => setState((s) => setMatrix(s, n, m))} />
      );
    }
    if (overlay === "vector") {
      return (
        <VectorEditor state={state} onClose={close}
          onSave={(n, v) => setState((s) => setVector(s, n, v))} />
      );
    }
    // full-screen editor modes
    if (EDITOR_MODES.includes(state.mode)) {
      if (state.mode === "stats") {
        return <StatsEditor state={state} data={statsData} onData={setStatsData} onClose={close} />;
      }
      if (state.mode === "table") {
        return <TableEditor state={state} cfg={tableCfg} onCfg={setTableCfg} onClose={close} />;
      }
      if (state.mode === "equation") return <EquationEditor state={state} onClose={close} />;
      if (state.mode === "ineq") return <IneqEditor state={state} onClose={close} />;
      if (state.mode === "dist") return <DistEditor state={state} onClose={close} />;
      if (state.mode === "ratio") return <RatioEditor state={state} onClose={close} />;
      if (state.mode === "mathbox") return <MathBoxEditor onClose={close} />;
    }
    return null;
  })();

  const editorActive = overlay !== null || EDITOR_MODES.includes(state.mode);

  return (
    <div className="calc-device" data-lcd={state.settings.lcd}>
      {/* upper metallic shell */}
      <div className="calc-shell-top">
        <div className="calc-brandrow">
          <div className="calc-solar" role="img" aria-label="Solar panel (decorative)" />
          <div className="calc-brand">
            <div className="calc-brand-name">CAMPUS+</div>
            <div className="calc-brand-model">SCW-100 SCIENTIFIC</div>
            <div className="calc-brand-sub">TEXTBOOK DISPLAY · 12 APPS</div>
          </div>
        </div>
        <CalculatorScreen state={state} overlay={overlayNode} />
      </div>

      {/* base-N conversion strip */}
      {baseStrip}

      {/* mode chips */}
      {!editorActive || state.mode === "matrix" || state.mode === "vector" || state.mode === "basen" || state.mode === "complex" ? (
        <div style={{ display: "flex", gap: 6, padding: "10px 4px 0", flexWrap: "wrap" }}>
          {(state.mode === "complex" || state.mode === "matrix" || state.mode === "vector" || state.mode === "basen") && chips.map((c2) => (
            <button
              key={c2.label}
              type="button"
              className="calc-chip"
              aria-label={c2.aria}
              disabled={"hexOnly" in c2 && c2.hexOnly && state.basenRadix !== "hex"}
              onPointerDown={(e) => {
                e.preventDefault();
                act.insertToks(c2.toks);
                haptic();
              }}
            >
              {c2.label}
            </button>
          ))}
          {state.mode === "matrix" && (
            <button type="button" className="calc-chip" aria-label="Edit matrices"
              onPointerDown={(e) => { e.preventDefault(); setOverlay("matrix"); }}>
              ✎ EDIT
            </button>
          )}
          {state.mode === "vector" && (
            <button type="button" className="calc-chip" aria-label="Edit vectors"
              onPointerDown={(e) => { e.preventDefault(); setOverlay("vector"); }}>
              ✎ EDIT
            </button>
          )}
          {state.mode === "basen" && (
            <>
              {(["dec", "hex", "oct", "bin"] as Radix[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`calc-chip ${state.basenRadix === r ? "chip-on" : ""}`}
                  aria-label={`${r} mode`}
                  aria-pressed={state.basenRadix === r}
                  onPointerDown={(e) => { e.preventDefault(); setState((s) => setBasenRadix(s, r)); }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button type="button" className="calc-chip" aria-label="Toggle angle unit"
                onPointerDown={(e) => {
                  e.preventDefault();
                  const next = state.settings.angle === "deg" ? "rad" : state.settings.angle === "rad" ? "grad" : "deg";
                  setState((s) => setAngleUnit(s, next));
                }}>
                {state.settings.angle.toUpperCase()}
              </button>
            </>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="calc-chip" aria-label="Keyboard shortcuts and help"
            onPointerDown={(e) => { e.preventDefault(); setOverlay((o) => (o === "help" ? null : "help")); }}>
            ?
          </button>
          {state.mode !== "basen" && (
            <button type="button" className="calc-chip" aria-label="History"
              onPointerDown={(e) => { e.preventDefault(); setOverlay((o) => (o === "history" ? null : "history")); }}>
              <Clock size={11} aria-hidden />
            </button>
          )}
        </div>
      ) : null}

      <CalculatorKeypad onKey={pressGuarded} onMetal={onMetal} shift={state.shift} alpha={state.alpha} />
    </div>
  );
}

