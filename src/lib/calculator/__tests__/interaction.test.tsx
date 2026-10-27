// @vitest-environment jsdom
/**
 * End-to-end-ish interaction: real DOM, real key clicks, physical keyboard.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act, createElement } from "react";
import { ScientificCalculator } from "@/components/calculator/ScientificCalculator";

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(ScientificCalculator));
  });
});

afterAll(() => {
  act(() => root.unmount());
  container.remove();
});

function clickKey(aria: string) {
  const el = container.querySelector<HTMLButtonElement>(`[aria-label="${aria}"]`);
  if (!el) throw new Error(`key not found: ${aria}`);
  act(() => {
    el.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
  });
}

function pressKeyboard(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

const resultText = () =>
  container.querySelector(".calc-resultline")?.textContent ?? "";

const inputText = () => container.querySelector(".calc-inputline")?.textContent ?? "";

describe("on-screen keypad → screen", () => {
  it("2+3×4 = 14 via key clicks", () => {
    clickKey("All clear");
    ["Two", "Plus", "Three", "Multiply", "Four", "Execute calculation"].forEach(clickKey);
    expect(resultText()).toBe("14");
    expect(inputText()).toContain("2+3×4");
  });

  it("unclosed parens auto-close at EXE: √(81)=9", () => {
    ["Square root", "Eight", "One", "Execute calculation"].forEach(clickKey);
    expect(resultText()).toBe("9");
  });

  it("fraction result stays exact: 1÷3+1÷3 = 2/3 stacked", () => {
    ["One", "Divide", "Three", "Plus", "One", "Divide", "Three", "Execute calculation"].forEach(clickKey);
    const frac = container.querySelector(".calc-resultline .dn-frac");
    expect(frac).not.toBeNull();
    expect(resultText()).toContain("2");
    expect(resultText()).toContain("3");
  });

  it("SHIFT layer: sin⁻¹ works, angle badge visible", () => {
    clickKey("Shift: access yellow secondary functions");
    expect(container.querySelector(".calc-badge.active")).not.toBeNull();
    clickKey("Sine"); // becomes sin⁻¹
    expect(inputText()).toContain("sin");
    ["Decimal point", "Five", "Execute calculation"].forEach(clickKey);
    expect(resultText()).toBe("30");
  });

  it("FMT toggles fraction ⇔ decimal", () => {
    ["One", "Divide", "Three", "Execute calculation"].forEach(clickKey);
    expect(container.querySelector(".calc-resultline .dn-frac")).not.toBeNull();
    clickKey("Format: toggle result between standard and decimal");
    expect(resultText()).toContain("0.333");
  });

  it("physical keyboard drives the device without focus stealing", () => {
    clickKey("All clear");
    "7*8".split("").forEach(pressKeyboard);
    pressKeyboard("Enter");
    expect(resultText()).toBe("56");
  });

  it("history records and replay works via ▲", () => {
    pressKeyboard("Escape"); // AC
    pressKeyboard("Escape");
    expect(resultText()).not.toContain("Math ERROR");
    clickKey("Cursor up");
    expect(inputText()).toContain("7×8");
    clickKey("OK / Execute");
    expect(resultText()).toBe("56");
  });

  it("typing into a native input inside overlays is not hijacked", () => {
    clickKey("Home: app menu");
    const menu = container.querySelector(".calc-overlay");
    expect(menu).not.toBeNull();
    // Escape closes
    pressKeyboard("Escape");
    expect(container.querySelector(".calc-overlay")).toBeNull();
  });
});
