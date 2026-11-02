"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";
import { CalcState, MODES, tokensToSource, shapeTokens } from "@/lib/calculator/session";
import { parseTokens } from "@/lib/calculator/parser";
import { astToNodes, DNode } from "@/lib/calculator/display";
import { valueToNodes, valueToText } from "@/lib/calculator/format";
import { decimalToFraction, Value } from "@/lib/calculator/core";
import { DNodes } from "./MathNode";

function computeAltNodes(v: Value, s: CalcState["settings"]): DNode[] | null {
  if (v.kind === "num" && v.frac && v.frac.d !== 1) {
    return valueToNodes(v, s, true);
  }
  if (v.kind === "num" && !v.frac && v.real !== 0) {
    const f = decimalToFraction(v.real);
    if (f && f.d !== 1) {
      return valueToNodes({ kind: "num", real: v.real, frac: f }, s);
    }
  }
  if (v.kind === "complex" && Math.abs(v.z.im) >= 1e-14) {
    return valueToNodes(v, {
      ...s,
      complexForm: s.complexForm === "polar" ? "rect" : "polar",
    });
  }
  return null;
}

export function CalculatorScreen({
  state,
  overlay,
}: {
  state: CalcState;
  overlay: ReactNode | null;
}) {
  const inputRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const overlayOpen = Boolean(overlay);

  useEffect(() => {
    if (!overlayOpen) {
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previous?.isConnected) previous.focus();
      return;
    }

    const root = overlayRef.current;
    if (!root) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusable = () => Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ));
    getFocusable()[0]?.focus({ preventScroll: true });

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("keydown", keepFocusInside);
    return () => root.removeEventListener("keydown", keepFocusInside);
  }, [overlayOpen]);

  const inputNodes = useMemo(() => {
    if (state.tokens.length === 0) return [] as DNode[];
    try {
      const ast = parseTokens(shapeTokens(state.tokens), true);
      return astToNodes(ast);
    } catch {
      return [{ t: "text", s: tokensToSource(state.tokens) } as DNode];
    }
  }, [state.tokens]);

  const resultNodes = useMemo(() => {
    if (state.error || !state.result) return null;
    if (state.result.overrideNodes) return state.result.overrideNodes;
    if (state.result.showAlt) {
      const alt = computeAltNodes(state.result.value, state.settings);
      if (alt) return alt;
    }
    return valueToNodes(state.result.value, state.settings);
  }, [state.result, state.error, state.settings]);

  const ariaResult = useMemo(() => {
    if (state.error) return `${state.error.code}: ${state.error.message}`;
    if (!state.result) return "";
    if (state.result.overrideText) return state.result.overrideText;
    return valueToText(state.result.value, state.settings, state.result.showAlt);
  }, [state.error, state.result, state.settings]);

  useEffect(() => {
    const el = inputRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
    const rl = resultRef.current;
    if (rl) rl.scrollLeft = rl.scrollWidth;
  }, [state.version]);

  const modeName = MODES.find((m) => m.id === state.mode)?.name ?? "";
  const s = state.settings;
  const fmtBadge =
    s.eng ? "ENG" :
    s.numFormat.mode === "fix" ? `FIX${s.numFormat.digits}` :
    s.numFormat.mode === "sci" ? `SCI${s.numFormat.digits}` : "NORM";
  const mVal = state.vars.M;
  const hasM = mVal !== null && mVal !== undefined && !(mVal.kind === "num" && mVal.real === 0);

  return (
    <div className="calc-screen" role="application" aria-label="Calculator display">
      <div className="calc-statusrow" aria-hidden="true">
        <span className="calc-badge">{modeName.toUpperCase().slice(0, 6)}</span>
        <span className="calc-badge">{s.angle.toUpperCase()}</span>
        <span className="calc-badge">{fmtBadge}</span>
        {s.complexForm === "polar" && state.mode === "complex" ? <span className="calc-badge">r∠θ</span> : null}
        <span className="spacer" />
        {hasM ? <span className="calc-badge">M</span> : null}
        <span className={`calc-badge ${state.shift ? "active" : ""}`} style={{ opacity: state.shift ? 1 : 0.35 }}>S</span>
        <span className={`calc-badge ${state.alpha ? "active" : ""}`} style={{ opacity: state.alpha ? 1 : 0.35 }}>A</span>
      </div>

      {overlay ? (
        <div ref={overlayRef} className="calc-overlay" role="dialog" aria-modal="true" aria-label="Calculator panel">{overlay}</div>
      ) : state.error ? (
        <div className="calc-errorline" aria-live="assertive">
          <div className="calc-error-code">
            {state.error.code === "SYNTAX" ? "Syntax ERROR" :
             state.error.code === "MATH" ? "Math ERROR" :
             state.error.code === "DIM" ? "Dimension ERROR" :
             state.error.code === "OVERFLOW" ? "Overflow ERROR" :
             state.error.code === "VARIABLE" ? "Variable ERROR" :
             state.error.code === "RANGE" ? "Range ERROR" : state.error.code}
          </div>
          <div className="calc-error-msg">{state.error.message}</div>
          <div className="calc-error-hint">◀ locate cursor · AC to clear</div>
        </div>
      ) : (
        <>
          <div className="calc-inputline" ref={inputRef} role="textbox" aria-label="Expression input" aria-readonly="true" tabIndex={-1}>
            <DNodes nodes={inputNodes} cursorIdx={state.cursor} />
            {state.cursor >= state.tokens.length && <span className="dn-cursor" aria-hidden="true" />}
          </div>
          <div className="calc-flash" aria-hidden="true">
            {state.stoPending ? "STO → variable?" : state.flash ?? ""}
          </div>
          <div className="calc-resultline" ref={resultRef} aria-live="polite" aria-label={ariaResult ? `Result: ${ariaResult}` : "Result"}>
            {resultNodes && <DNodes nodes={resultNodes} />}
          </div>
        </>
      )}
      {/* accessible live mirror */}
      <span className="sr-only" role="status">
        {ariaResult}
      </span>
    </div>
  );
}
