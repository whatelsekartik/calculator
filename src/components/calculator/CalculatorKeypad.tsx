"use client";

import { KEY_ROWS, KeyDef } from "@/lib/calculator/keymap";
import { ArrowLeft, Home, Settings2, BookOpen, Wrench, RefreshCcw } from "lucide-react";

export type KeyHandler = (keyId: string) => void;

function Key({ def, onKey }: { def: KeyDef; onKey: KeyHandler }) {
  const cls =
    def.tone === "num" ? "ck ck-main ck-num" :
    def.tone === "op" ? "ck ck-main ck-op" :
    def.tone === "exe" ? "ck ck-main ck-exe" :
    def.tone === "del" ? "ck ck-main ck-del" :
    def.tone === "ac" ? "ck ck-main ck-ac" :
    "ck ck-main ck-fn";
  return (
    <button
      type="button"
      className={cls}
      aria-label={def.aria}
      onPointerDown={(e) => {
        // pointerdown (not click) avoids touch+click double firing
        e.preventDefault();
        onKey(def.id);
      }}
    >
      {def.shiftLabel && (
        <span className="ck-sub shift" aria-hidden="true">{def.shiftLabel}</span>
      )}
      {def.alphaLabel && (
        <span className="ck-sub alpha" aria-hidden="true">{def.alphaLabel}</span>
      )}
      <span className="ck-prime">{def.label}</span>
    </button>
  );
}

export function CalculatorKeypad({
  onKey,
  onMetal,
  shift,
  alpha,
}: {
  onKey: KeyHandler;
  onMetal: (action: "menu" | "settings" | "catalog" | "tools" | "back" | "help") => void;
  shift: boolean;
  alpha: boolean;
}) {
  return (
    <div className="calc-keypad-panel">
      {/* silver function cluster */}
      <div className="calc-metal">
        <button
          type="button"
          className={`ck ck-metal ck-shift ${shift ? "on" : ""}`}
          style={{ gridArea: "shift" }}
          aria-label="Shift: access yellow secondary functions"
          aria-pressed={shift}
          onPointerDown={(e) => { e.preventDefault(); onKey("shift"); }}
        >
          SHIFT
        </button>
        <button
          type="button"
          className={`ck ck-metal ck-alpha ${alpha ? "on" : ""}`}
          style={{ gridArea: "alpha" }}
          aria-label="Alpha: access red letter variables"
          aria-pressed={alpha}
          onPointerDown={(e) => { e.preventDefault(); onKey("alpha"); }}
        >
          ALPHA
        </button>
        <button
          type="button"
          className="ck ck-metal"
          style={{ gridArea: "home" }}
          aria-label="Home: app menu"
          onPointerDown={(e) => { e.preventDefault(); onMetal("menu"); }}
        >
          <Home size={13} strokeWidth={2.6} aria-hidden />
          <span style={{ marginLeft: 4 }}>HOME</span>
        </button>
        <button
          type="button"
          className="ck ck-metal"
          style={{ gridArea: "back" }}
          aria-label="Back"
          onPointerDown={(e) => { e.preventDefault(); onMetal("back"); }}
        >
          <ArrowLeft size={13} strokeWidth={2.6} aria-hidden />
        </button>
        {/* nav pad */}
        <div className="calc-navpad" role="group" aria-label="Cursor pad">
          {(["up", "down", "left", "right"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              data-dir={dir}
              className="calc-navdir"
              aria-label={`Cursor ${dir}`}
              onPointerDown={(e) => { e.preventDefault(); onKey(`nav-${dir}`); }}
            >
              <svg width="12" height="12" viewBox="0 0 10 8" style={{ transform: `rotate(${dir === "up" ? 0 : dir === "right" ? 90 : dir === "down" ? 180 : 270}deg)` }} aria-hidden>
                <path d="M5 0 L10 8 L0 8 Z" fill="currentColor" />
              </svg>
            </button>
          ))}
          <button
            type="button"
            className="calc-navok"
            aria-label="OK / Execute"
            onPointerDown={(e) => { e.preventDefault(); onKey("exe"); }}
          >
            OK
          </button>
        </div>
        <button
          type="button"
          className="ck ck-metal"
          style={{ gridArea: "s2a" }}
          aria-label="Settings"
          onPointerDown={(e) => { e.preventDefault(); onMetal("settings"); }}
        >
          <Settings2 size={12} strokeWidth={2.4} aria-hidden />
        </button>
        <button
          type="button"
          className="ck ck-metal"
          style={{ gridArea: "s2b" }}
          aria-label="Catalog of functions and constants"
          onPointerDown={(e) => { e.preventDefault(); onMetal("catalog"); }}
        >
          <BookOpen size={12} strokeWidth={2.4} aria-hidden />
          <span style={{ marginLeft: 3 }}>CTLG</span>
        </button>
        <button
          type="button"
          className="ck ck-metal"
          style={{ gridArea: "s2c" }}
          aria-label="Tools"
          onPointerDown={(e) => { e.preventDefault(); onMetal("tools"); }}
        >
          <Wrench size={12} strokeWidth={2.4} aria-hidden />
        </button>
        <button
          type="button"
          className="ck ck-metal"
          style={{ gridArea: "s2d" }}
          aria-label="Format: toggle result between standard and decimal"
          onPointerDown={(e) => { e.preventDefault(); onKey("format"); }}
        >
          <RefreshCcw size={12} strokeWidth={2.4} aria-hidden />
          <span style={{ marginLeft: 3 }}>FMT</span>
        </button>
      </div>

      {/* dark main grid */}
      <div className="calc-keys">
        {KEY_ROWS.map((row) =>
          row.map((def) => <Key key={def.id} def={def} onKey={onKey} />),
        )}
      </div>
    </div>
  );
}
