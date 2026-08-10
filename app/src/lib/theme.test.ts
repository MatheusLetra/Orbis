import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  DEFAULT_PREFERENCES,
  loadPreferences,
  resolveTheme,
  savePreferences,
} from "./theme";

const STORAGE_KEY = "orbis:appearance";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-accent");
  document.documentElement.removeAttribute("data-density");
});

describe("theme", () => {
  it("resolve tema system para dark quando preferência do sistema é dark", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
    }) as unknown as typeof window.matchMedia;

    expect(resolveTheme("system")).toBe("dark");
  });

  it("aplica tema dark adicionando a classe dark", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persiste e carrega preferências", () => {
    savePreferences({ ...DEFAULT_PREFERENCES, theme: "dark", density: "compact" });
    expect(loadPreferences()).toEqual({
      ...DEFAULT_PREFERENCES,
      theme: "dark",
      density: "compact",
    });
  });

  it("retorna preferências padrão quando nada foi salvo", () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("retorna preferências padrão quando o armazenamento está corrompido", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json");
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});
