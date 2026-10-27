"use client";
import { KEY_ROWS, KeyDef } from "@/lib/calculator/keymap";

export type KeyHandler = (keyId: string) => void;
type MetalAction = "menu" | "settings" | "catalog" | "tools" | "back" | "help";

function Key({ def, onKey }: { def: KeyDef; onKey: KeyHandler }) {
  const cls = ["ck", "ck-main", `ck-${def.tone}`].join(" ");
  return (
    <button type="button" className={cls} aria-label={def.aria} data-key-id={def.id} onClick={() => onKey(def.id)}>
      {def.shiftLabel && <span className="ck-sub shift" aria-hidden="true">{def.shiftLabel}</span>}
      {def.alphaLabel && <span className="ck-sub alpha" aria-hidden="true">{def.alphaLabel}</span>}
      <span className="ck-prime">{def.label}</span>
    </button>
  );
}

export function CalculatorKeypad({ onKey, onMetal, shift, alpha }: {
  onKey: KeyHandler;
  onMetal: (action: MetalAction) => void;
  shift: boolean;
  alpha: boolean;
}) {
  return (
    <div className="calc-keypad-panel">
      <div className="calc-metal" aria-label="Calculator controls">
        <button type="button" className={`ck ck-metal ck-shift ${shift ? "on" : ""}`} aria-label="Shift: access yellow secondary functions" aria-pressed={shift} onClick={() => onKey("shift")}>SHIFT</button>
        <button type="button" className={`ck ck-metal ck-alpha ${alpha ? "on" : ""}`} aria-label="Alpha: access red variable functions" aria-pressed={alpha} onClick={() => onKey("alpha")}>ALPHA</button>
        <div className="calc-navpad" role="group" aria-label="Cursor and replay pad">
          {(["up", "down", "left", "right"] as const).map((dir) => (
            <button key={dir} type="button" data-dir={dir} className="calc-navdir" aria-label={`Cursor ${dir}`} onClick={() => onKey(`nav-${dir}`)}>
              <svg width="12" height="12" viewBox="0 0 10 8" style={{ transform: `rotate(${dir === "up" ? 0 : dir === "right" ? 90 : dir === "down" ? 180 : 270}deg)` }} aria-hidden="true"><path d="M5 0 L10 8 L0 8 Z" fill="currentColor" /></svg>
            </button>
          ))}
        </div>
        <button type="button" className="ck ck-metal ck-mode" aria-label="Mode / Setup" onClick={() => onMetal(shift ? "settings" : "menu")}>
          <span className="ck-sub shift">SETUP</span><span>MODE</span>
        </button>
        <button type="button" className="ck ck-metal ck-on" aria-label="ON: wake or clear calculator" onClick={() => onKey("ac")}>ON</button>
      </div>
      <div className="calc-keys">
        {KEY_ROWS.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className={`calc-key-row ${rowIndex === 0 ? "calc-action-row" : rowIndex < 4 ? "calc-scientific-row" : "calc-number-row"}`} data-key-row={rowIndex}>
            {row.map((def: KeyDef) => <Key key={def.id} def={def} onKey={onKey} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
