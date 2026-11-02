// @vitest-environment jsdom
/**
 * End-to-end-ish interaction: real DOM, real key clicks, physical keyboard.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act, createElement } from "react";
import { ScientificCalculator } from "@/components/calculator/ScientificCalculator";
import { loadState } from "../session";

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
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function pressKeyboard(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

const resultText = () =>
  container.querySelector(".calc-resultline")?.textContent ?? "";

// Calculator LCD typography uses a mathematical minus (−), which Number()
// does not parse. Normalize only the display glyph before numeric assertions.
const numericResult = () => Number(resultText().replace(/−/g, "-").replace(/,/g, ""));

const inputText = () => container.querySelector(".calc-inputline")?.textContent ?? "";

describe("on-screen keypad → screen", () => {
  it("2+3×4 = 14 via key clicks", () => {
    clickKey("All clear");
    ["Two", "Plus", "Three", "Multiply", "Four", "Execute calculation"].forEach(clickKey);
    expect(resultText()).toBe("14");
    expect(inputText()).toContain("2+3×4");
  });

  it("unclosed parens auto-close at EXE: √(81)=9", () => {
    ["Square root template", "Eight", "One", "Execute calculation"].forEach(clickKey);
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
    clickKey("Toggle exact fraction and decimal display");
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
    clickKey("Execute calculation");
    expect(resultText()).toBe("56");
  });

  it("MODE selects a supported app and SHIFT+MODE opens SETUP", () => {
    clickKey("Mode / Setup");
    pressKeyboard("2");
    expect(container.querySelector(".calc-statusrow")?.textContent).toContain("CMPLX");
    clickKey("Shift: access yellow secondary functions");
    clickKey("Mode / Setup");
    expect(container.querySelector(".calc-overlay")?.textContent).toContain("SETTINGS");
    pressKeyboard("Escape");
    expect(container.querySelector(".calc-overlay")).toBeNull();
  });

  it("typing into a native input inside overlays is not hijacked", () => {
    clickKey("Mode / Setup");
    const menu = container.querySelector(".calc-overlay");
    expect(menu).not.toBeNull();
    pressKeyboard("Escape");
    expect(container.querySelector(".calc-overlay")).toBeNull();
  });
});


function buttonByText(label: string, scope = ".calc-device"): HTMLButtonElement {
  const parent = container.querySelector(scope) ?? container;
  const button = Array.from(parent.querySelectorAll<HTMLButtonElement>("button"))
    .find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`button not found: ${label}`);
  return button;
}

function clickText(label: string, scope = ".calc-device") {
  const button = buttonByText(label, scope);
  act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
}

function pointerDownText(label: string, scope = ".calc-overlay") {
  const button = buttonByText(label, scope);
  act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
}

function clickChip(label: string) {
  const chip = Array.from(container.querySelectorAll<HTMLButtonElement>(".calc-chip"))
    .find((item) => item.textContent?.trim() === label);
  if (!chip) throw new Error(`calculator chip not found: ${label}`);
  act(() => chip.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
}

function fillInput(ariaLabel: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${ariaLabel}"]`);
  if (!input) throw new Error(`input not found: ${ariaLabel}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("mobile-first mode and setup controls", () => {
  it("keeps every calculator app directly selectable without opening the MODE overlay", () => {
    const modes = ["COMP", "CMPLX", "STAT", "BASE-N", "EQN", "MATRIX", "TABLE", "VECTOR"];
    for (const mode of modes) {
      clickText(mode, ".calc-mode-strip");
      expect(container.querySelector(".calc-statusrow")?.textContent).toContain(mode);
      const overlayText = container.querySelector(".calc-overlay")?.textContent ?? "";
      expect(overlayText).not.toContain("CALCULATOR APPS");
    }
  });

  it("opens SETUP from the visible strip and persists DEG/RAD selection", () => {
    clickText("SETUP", ".calc-mode-strip");
    expect(container.querySelector(".calc-overlay")?.textContent).toContain("SETTINGS");
    pointerDownText("RAD");
    expect(loadState()?.settings?.angle).toBe("rad");
    pointerDownText("DEG");
    expect(loadState()?.settings?.angle).toBe("deg");
    pressKeyboard("Escape");
    expect(container.querySelector(".calc-overlay")).toBeNull();
  });

  it("SHIFT + physical MODE opens SETUP and consumes the SHIFT modifier", () => {
    clickKey("Shift: access yellow secondary functions");
    expect(container.querySelector(".calc-badge.active")).not.toBeNull();
    clickKey("Mode / Setup");
    expect(container.querySelector(".calc-overlay")?.textContent).toContain("SETTINGS");
    expect(container.querySelector(".calc-statusrow .calc-badge.active")).toBeNull();
    pressKeyboard("Escape");
  });
});

describe("scientific calculation acceptance through the physical keypad", () => {
  it("evaluates exact fractions, roots and logarithms", () => {
    clickText("COMP", ".calc-mode-strip");
    clickKey("All clear");
    ["One", "Divide", "Three", "Execute calculation"].forEach(clickKey);
    expect(container.querySelector(".calc-resultline .dn-frac")).not.toBeNull();

    clickKey("All clear");
    ["Square root template", "Eight", "One", "Execute calculation"].forEach(clickKey);
    expect(resultText()).toBe("9");

    clickKey("All clear");
    ["Common logarithm", "One", "Zero", "Zero", "Execute calculation"].forEach(clickKey);
    expect(resultText()).toBe("2");
  });

  it("evaluates DEG and RAD trigonometry, including inverse sine", () => {
    clickText("SETUP", ".calc-mode-strip");
    pointerDownText("DEG");
    pressKeyboard("Escape");
    clickKey("All clear");
    ["Sine", "Three", "Zero", "Execute calculation"].forEach(clickKey);
    expect(numericResult()).toBeCloseTo(0.5, 10);

    clickText("SETUP", ".calc-mode-strip");
    pointerDownText("RAD");
    pressKeyboard("Escape");
    clickKey("All clear");
    ["Sine", "Three", "Zero", "Execute calculation"].forEach(clickKey);
    expect(numericResult()).toBeCloseTo(Math.sin(30), 9);

    clickKey("All clear");
    clickKey("Shift: access yellow secondary functions");
    clickKey("Sine"); // SHIFT + sin = asin
    ["Decimal point", "Five", "Execute calculation"].forEach(clickKey);
    expect(numericResult()).toBeCloseTo(Math.asin(0.5), 9);
    expect(loadState()?.settings?.angle).toBe("rad");
  });
});

describe("advanced mode workflows", () => {
  it("saves a matrix in the editor and evaluates its determinant", () => {
    clickText("MATRIX", ".calc-mode-strip");
    pointerDownText("✎ EDIT", ".calc-device");
    fillInput("MatA row 1 column 1", "1");
    fillInput("MatA row 1 column 2", "2");
    fillInput("MatA row 2 column 1", "3");
    fillInput("MatA row 2 column 2", "4");
    pointerDownText("Save MatA");
    expect(container.querySelector(".calc-overlay")).toBeNull();

    clickChip("det(");
    clickChip("MatA");
    clickKey("Close parenthesis");
    clickKey("Execute calculation");
    expect(numericResult()).toBe(-2);
  });

  it("saves a vector and evaluates its magnitude", () => {
    clickText("VECTOR", ".calc-mode-strip");
    pointerDownText("✎ EDIT", ".calc-device");
    fillInput("component 1", "1");
    fillInput("component 2", "2");
    fillInput("component 3", "3");
    pointerDownText("Save VctA");
    clickKey("Shift: access yellow secondary functions");
    clickKey("Negative sign"); // SHIFT + (−) = abs(
    clickChip("VctA");
    clickKey("Close parenthesis");
    clickKey("Execute calculation");
    expect(numericResult()).toBeCloseTo(Math.sqrt(14), 8);
  });

  it("solves a simultaneous equation system and computes STAT results", () => {
    clickText("EQN", ".calc-mode-strip");
    fillInput("equation 1 coefficient x", "2");
    fillInput("equation 1 coefficient y", "1");
    fillInput("equation 1 constant", "5");
    fillInput("equation 2 coefficient x", "1");
    fillInput("equation 2 coefficient y", "-1");
    fillInput("equation 2 constant", "1");
    pointerDownText("Solve");
    const equationOutput = container.querySelector(".calc-overlay-body")?.textContent ?? "";
    expect(equationOutput).toContain("x = 2");
    expect(equationOutput).toContain("y = 1");

    clickText("STAT", ".calc-mode-strip");
    fillInput("row 1 x", "1");
    fillInput("row 2 x", "2");
    fillInput("row 3 x", "3");
    pointerDownText("Results");
    const statsOutput = container.querySelector(".calc-overlay-body")?.textContent ?? "";
    expect(statsOutput).toContain("x̄ mean");
    expect(statsOutput).toContain("2");
  });
});

describe("mode strip and table input safeguards", () => {
  it("does not clear an expression when the active mode is selected again", () => {
    clickText("COMP", ".calc-mode-strip");
    clickKey("All clear");
    pressKeyboard("1");
    pressKeyboard("+");
    clickText("COMP", ".calc-mode-strip");
    expect(inputText()).toContain("1+");
  });

  it("does not treat Enter on a focused mode button as calculator EXE", () => {
    clickText("COMP", ".calc-mode-strip");
    clickKey("All clear");
    pressKeyboard("1");
    pressKeyboard("+");
    const comp = buttonByText("COMP", ".calc-mode-strip");
    act(() => {
      comp.focus();
      comp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(container.querySelector(".calc-errorline")).toBeNull();
    expect(inputText()).toContain("1+");
  });

  it("reports a required-bound error instead of treating an empty bound as zero", () => {
    clickText("TABLE", ".calc-mode-strip");
    fillInput("f(x) =", "x^2");
    fillInput("Start", "");
    pointerDownText("Generate table");
    const alert = container.querySelector('[role="alert"]')?.textContent ?? "";
    expect(alert).toContain("Start is required");
  });
});

describe("modal accessibility and focus handling", () => {
  it("opens a semantic dialog, moves focus inside, and traps keyboard focus", () => {
    clickText("SETUP", ".calc-mode-strip");
    const dialog = container.querySelector<HTMLElement>('.calc-overlay[role="dialog"][aria-modal="true"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.contains(document.activeElement)).toBe(true);

    const focusable = Array.from(dialog!.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
    ));
    expect(focusable.length).toBeGreaterThan(1);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    act(() => {
      last.focus();
      last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(first);
    pressKeyboard("Escape");
  });
});

describe("editor exit and semantic button activation", () => {
  it("returns from full-screen STAT editor to COMP using its close control", () => {
    clickText("STAT", ".calc-mode-strip");
    expect(container.querySelector(".calc-overlay")).not.toBeNull();
    clickKey("Back to calculation");
    expect(container.querySelector(".calc-overlay")).toBeNull();
    expect(container.querySelector(".calc-statusrow")?.textContent).toContain("COMP");
  });

  it("returns from TABLE editor to COMP using Escape", () => {
    clickText("TABLE", ".calc-mode-strip");
    expect(container.querySelector(".calc-overlay")).not.toBeNull();
    pressKeyboard("Escape");
    expect(container.querySelector(".calc-overlay")).toBeNull();
    expect(container.querySelector(".calc-statusrow")?.textContent).toContain("COMP");
  });

  it("Escape closes an editor even while a text field has focus", () => {
    clickText("TABLE", ".calc-mode-strip");
    const input = container.querySelector<HTMLInputElement>('input[aria-label="f(x) ="]');
    expect(input).not.toBeNull();
    act(() => {
      input!.focus();
      input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(container.querySelector(".calc-overlay")).toBeNull();
    expect(container.querySelector(".calc-statusrow")?.textContent).toContain("COMP");
  });

  it("activates settings options from click/keyboard-style button activation", () => {
    clickText("SETUP", ".calc-mode-strip");
    clickText("RAD", ".calc-overlay");
    expect(loadState()?.settings?.angle).toBe("rad");
    clickText("DEG", ".calc-overlay");
    expect(loadState()?.settings?.angle).toBe("deg");
    pressKeyboard("Escape");
  });
});

describe("physical keyboard constants and variables", () => {
  it("maps lowercase e to Euler's constant and uppercase E to variable E", () => {
    clickText("COMP", ".calc-mode-strip");
    clickKey("All clear");
    pressKeyboard("e");
    pressKeyboard("Enter");
    expect(numericResult()).toBeCloseTo(Math.E, 10);

    clickKey("All clear");
    pressKeyboard("E");
    expect(inputText()).toContain("E");
  });
});

describe("keyboard, touch-style controls and persisted state", () => {
  it("supports cursor insertion from the physical keyboard", () => {
    clickText("COMP", ".calc-mode-strip");
    clickKey("All clear");
    pressKeyboard("1");
    pressKeyboard("3");
    pressKeyboard("ArrowLeft");
    pressKeyboard("2");
    pressKeyboard("Enter");
    expect(resultText()).toBe("123");
  });

  it("keeps the mobile mode buttons operable through pointer-generated clicks", () => {
    const button = buttonByText("CMPLX", ".calc-mode-strip");
    act(() => {
      button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector(".calc-statusrow")?.textContent).toContain("CMPLX");
  });
});
