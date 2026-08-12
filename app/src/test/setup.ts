import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const storage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "localStorage", {
  value: storage,
  writable: true,
  configurable: true,
});

const sessionStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
})();

Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorage,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorage,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "matchMedia", {
  value: vi.fn().mockReturnValue({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
  writable: true,
  configurable: true,
});
