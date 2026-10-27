/**
 * Render smoke tests (SSR string render): the full device, every overlay,
 * every editor, and natural-display nodes must render without crashing.
 */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { DNodes } from "@/components/calculator/MathNode";
import { CalculatorScreen } from "@/components/calculator/CalculatorScreen";
import { ScientificCalculator } from "@/components/calculator/ScientificCalculator";
import {
  HomeMenu, SettingsPanel, CatalogPanel, HistoryPanel, ToolsPanel, HelpPanel, CalcActions,
} from "@/components/calculator/Overlays";
import {
  MatrixEditor, VectorEditor, StatsEditor, TableEditor, EquationEditor, IneqEditor,
  DistEditor, RatioEditor, MathBoxEditor, emptyStats, emptyTable,
} from "@/components/calculator/Editors";
import {
  initialState, typeKeys, CalcState,
} from "@/lib/calculator/session";
import { formatRealHarness } from "./renderHarness";
import { astToNodes } from "@/lib/calculator/display";
import { parseString } from "@/lib/calculator/parser";
import { valueToNodes } from "@/lib/calculator/format";
import { Fraction } from "@/lib/calculator/core";

const noop = () => undefined;
const act: CalcActions = {
  press: noop, setMode: noop, insertToks: noop, insertSource: noop,
  updateSettings: noop, clearHistory: noop, clearVars: noop, clearMatrices: noop,
  hardReset: noop, replayEntry: noop, openOverlay: noop,
};

describe("calculation display rendering", () => {
  it("device shell renders all 40 physical key positions in model row lengths", () => {
    const html = renderToString(createElement(ScientificCalculator));
    expect(html).toContain("calc-device");
    expect(html).toContain("calc-screen");
    expect(html).toContain("data-key-id=\"exe\"");
    expect(html).toContain("SHIFT");
    expect(html).toContain("×10ˣ");
    expect(html).toContain("CAMPUS+");
    expect((html.match(/data-key-id=/g) || []).length).toBe(40);
    expect((html.match(/calc-scientific-row/g) || []).length).toBe(3);
    expect((html.match(/calc-number-row/g) || []).length).toBe(4);
  });

  it("screen renders input with cursor and stacked fraction", () => {
    let s: CalcState = typeKeys(initialState(), ["d1", "div", "d3", "add", "sqrt", "d2"]);
    const html = renderToString(createElement(CalculatorScreen, { state: s, overlay: null }));
    expect(html).toContain("dn-frac");   // 1/3 shown stacked
    expect(html).toContain("dn-cursor"); // editing cursor visible
    expect(html).toContain("dn-sqrt");   // radical with vinculum
    expect(html).toContain("DEG");       // angle status indicator
  });

  it("superscripts render for powers", () => {
    const s = typeKeys(initialState(), ["d2", "pow", "d1", "d0"]);
    const html = renderToString(createElement(CalculatorScreen, { state: s, overlay: null }));
    expect(html).toContain("dn-pow");
  });

  it("error state renders calculator-style message", () => {
    const s = typeKeys(initialState(), ["d1", "div", "d0", "exe"]);
    const html = renderToString(createElement(CalculatorScreen, { state: s, overlay: null }));
    expect(html).toContain("Math ERROR");
  });

  it("result renders as natural fraction", () => {
    const s = typeKeys(initialState(), ["d1", "div", "d3", "exe"]);
    const html = renderToString(createElement(CalculatorScreen, { state: s, overlay: null }));
    expect(html).toContain("dn-frac");
  });

  it("valueToNodes fraction path produces frac nodes", () => {
    const html = renderToString(
      createElement(DNodes, {
        nodes: valueToNodes(
          { kind: "num", real: 7 / 3, frac: new Fraction(7, 3) },
          { angle: "deg", numFormat: { mode: "norm1", digits: 3 }, eng: false, thousandsSep: false, fractionResult: true, mixedFractions: false, complexForm: "rect" },
        ),
      }),
    );
    expect(html).toContain("dn-frac");
    expect(html).toContain(">7<");
    expect(html).toContain(">3<");
  });

  it("dms tokens render with °′″", () => {
    const nodes = astToNodes(parseString("12°30°15°"));
    const text = formatRealHarness(nodes);
    expect(text).toContain("°");
    expect(text).toContain("′");
  });
});

describe("overlays and editors render", () => {
  const st = typeKeys(initialState(), ["d2", "add", "d2", "exe"]);
  it("MODE menu lists the reference unit's eight implemented modes", () => {
    const html = renderToString(createElement(HomeMenu, { act, onClose: noop }));
    expect(html).toContain("COMP");
    expect(html).toContain("CMPLX");
    expect(html).toContain("BASE-N");
    expect(html).toContain("VECTOR");
    expect((html.match(/calc-mcell/g) || []).length).toBe(8);
  });
  it("settings panel", () => {
    const html = renderToString(createElement(SettingsPanel, { state: st, act, onClose: noop }));
    expect(html).toContain("Angle unit");
    expect(html).toContain("Fraction results");
  });
  it("catalog with constants", () => {
    const html = renderToString(createElement(CatalogPanel, { state: st, act, onClose: noop }));
    expect(html).toContain("CATALOG");
  });
  it("history panel shows past calculations", () => {
    const html = renderToString(createElement(HistoryPanel, { state: st, act, onClose: noop }));
    expect(html).toContain("2+2");
    expect(html).toContain("Replay 2+2 equals 4");
  });
  it("tools panel", () => {
    expect(renderToString(createElement(ToolsPanel, { state: st, act, onClose: noop }))).toContain("TOOLS");
  });
  it("help panel", () => {
    expect(renderToString(createElement(HelpPanel, { onClose: noop }))).toContain("KEYBOARD");
  });
  it("matrix editor", () => {
    expect(renderToString(createElement(MatrixEditor, { state: st, onSave: noop, onClose: noop }))).toContain("MATRIX EDITOR");
  });
  it("vector editor", () => {
    expect(renderToString(createElement(VectorEditor, { state: st, onSave: noop, onClose: noop }))).toContain("VECTOR EDITOR");
  });
  it("stats editor", () => {
    const html = renderToString(createElement(StatsEditor, { state: st, data: emptyStats(), onData: noop, onClose: noop }));
    expect(html).toContain("STATISTICS");
  });
  it("table editor", () => {
    expect(renderToString(createElement(TableEditor, { state: st, cfg: emptyTable(), onCfg: noop, onClose: noop }))).toContain("TABLE");
  });
  it("equation editor", () => {
    expect(renderToString(createElement(EquationEditor, { state: st, onClose: noop }))).toContain("EQUATION");
  });
  it("inequality editor", () => {
    expect(renderToString(createElement(IneqEditor, { state: st, onClose: noop }))).toContain("INEQUALITY");
  });
  it("distribution editor", () => {
    expect(renderToString(createElement(DistEditor, { state: st, onClose: noop }))).toContain("DISTRIBUTION");
  });
  it("ratio editor", () => {
    expect(renderToString(createElement(RatioEditor, { state: st, onClose: noop }))).toContain("RATIO");
  });
  it("math box editor", () => {
    expect(renderToString(createElement(MathBoxEditor, { onClose: noop }))).toContain("MATH BOX");
  });
});
