import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPreferences,
  DEFAULT_PREFERENCES,
  loadPreferences,
  resolveTheme,
  watchSystemTheme,
} from "./theme";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-accent");
  document.documentElement.removeAttribute("data-density");
});

describe("theme uncovered branches", () => {
  it("resolve system light e retorna preferências explícitas sem consultar o sistema", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;

    expect(resolveTheme("system")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    expect(window.matchMedia).toHaveBeenCalledOnce();
  });

  it("remove dark, configura color-scheme e aplica accent/density", () => {
    document.documentElement.classList.add("dark");

    applyPreferences({ theme: "light", accent: "violet", density: "compact" });

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.documentElement.dataset.accent).toBe("violet");
    expect(document.documentElement.dataset.density).toBe("compact");
  });

  it("combina preferências parciais persistidas com os defaults", () => {
    localStorage.setItem("orbis:appearance", JSON.stringify({ accent: "blue" }));

    expect(loadPreferences()).toEqual({ ...DEFAULT_PREFERENCES, accent: "blue" });
  });

  it("registra e remove o listener do tema do sistema", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener,
      removeEventListener,
    }) as unknown as typeof window.matchMedia;
    const onChange = vi.fn();

    const unsubscribe = watchSystemTheme(onChange);
    const listener = addEventListener.mock.calls[0]?.[1] as (event: { matches: boolean }) => void;
    listener({ matches: true });
    unsubscribe();

    expect(onChange).toHaveBeenCalledWith(true);
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});
