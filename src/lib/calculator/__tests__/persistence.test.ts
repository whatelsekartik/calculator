import { afterEach, describe, expect, it } from "vitest";
import { initialState, loadState, saveState, clearPersisted, setBasenRadix, setMode, typeKeys } from "../session";
import { resetCalculatorPersistence, setCalculatorPersistence } from "../persistence";

afterEach(resetCalculatorPersistence);

describe("pluggable client persistence", () => {
  it("round-trips serialized calculator preferences and answer through the adapter", () => {
    const values = new Map<string, string>();
    setCalculatorPersistence({
      read: (key) => values.get(key) ?? null,
      write: (key, value) => { values.set(key, value); },
      remove: (key) => { values.delete(key); },
    });
    const state = initialState();
    saveState(state);
    expect(loadState()?.settings?.angle).toBe("deg");
    clearPersisted();
    expect(loadState()).toBeNull();
  });

  it("persists BASE-N radix and STAT/TABLE editor drafts across reloads", () => {
    const values = new Map<string, string>();
    setCalculatorPersistence({
      read: (key) => values.get(key) ?? null,
      write: (key, value) => { values.set(key, value); },
      remove: (key) => { values.delete(key); },
    });

    let state = setMode(initialState(), "basen");
    state = setBasenRadix(state, "hex");
    saveState(state, {
      statsData: {
        twoVar: true,
        freqOn: true,
        rows: [
          { x: "1", y: "3", f: "2" },
          { x: "2", y: "5", f: "1" },
        ],
      },
      tableCfg: { f: "x^2", g: "sin(x)", start: "-2", end: "2", step: "0.25" },
    });

    const restored = loadState();
    expect(restored?.mode).toBe("basen");
    expect(restored?.basenRadix).toBe("hex");
    expect(restored?.statsData?.twoVar).toBe(true);
    expect(restored?.statsData?.rows[1].y).toBe("5");
    expect(restored?.tableCfg).toEqual({
      f: "x^2", g: "sin(x)", start: "-2", end: "2", step: "0.25",
    });
  });

  it("advances history IDs past persisted entries to avoid replay-key collisions", () => {
    const values = new Map<string, string>();
    setCalculatorPersistence({
      read: (key) => values.get(key) ?? null,
      write: (key, value) => { values.set(key, value); },
      remove: (key) => { values.delete(key); },
    });
    const calculated = typeKeys(initialState(), ["d2", "exe"]);
    const historic = {
      ...calculated.history[0],
      id: 900_000,
    };
    saveState({ ...calculated, history: [historic] });
    expect(loadState()?.history?.[0].id).toBe(900_000);

    const next = typeKeys(initialState(), ["d3", "exe"]);
    expect(next.history[0].id).toBeGreaterThan(900_000);
  });

  it("recovers cleanly when the selected storage adapter throws", () => {
    setCalculatorPersistence({
      read: () => { throw new Error("storage blocked"); },
      write: () => { throw new Error("quota exceeded"); },
      remove: () => { throw new Error("storage blocked"); },
    });
    expect(() => saveState(initialState())).not.toThrow();
    expect(loadState()).toBeNull();
    expect(() => clearPersisted()).not.toThrow();
  });
});
