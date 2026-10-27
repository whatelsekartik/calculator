/**
 * Persistence port for calculator preferences, memory and replay history.
 * Core parsing/math never touches storage. The default adapter is synchronous
 * browser localStorage; deployments can replace it with another client-side
 * implementation without changing the engine or page components.
 */
export interface CalculatorPersistence {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export const localCalculatorPersistence: CalculatorPersistence = {
  read(key) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  write(key, value) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  remove(key) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

let activeAdapter: CalculatorPersistence = localCalculatorPersistence;
export function getCalculatorPersistence(): CalculatorPersistence { return activeAdapter; }
export function setCalculatorPersistence(adapter: CalculatorPersistence): void { activeAdapter = adapter; }
export function resetCalculatorPersistence(): void { activeAdapter = localCalculatorPersistence; }
