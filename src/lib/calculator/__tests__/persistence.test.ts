import { afterEach, describe, expect, it } from "vitest";
import { initialState, loadState, saveState, clearPersisted } from "../session";
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
