export type Theme = "light" | "dark" | "system";

export type AppearancePreferences = {
  theme: Theme;
  accent: string;
  density: "compact" | "comfortable";
};

export const DEFAULT_PREFERENCES: AppearancePreferences = {
  theme: "system",
  accent: "default",
  density: "comfortable",
};

const STORAGE_KEY = "orbis:appearance";

function isSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(preference: Theme): "light" | "dark" {
  if (preference === "system") {
    return isSystemDark() ? "dark" : "light";
  }
  return preference;
}

export function applyTheme(theme: "light" | "dark"): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function applyAccent(accent: string): void {
  const root = document.documentElement;
  root.dataset.accent = accent;
}

export function applyDensity(density: "compact" | "comfortable"): void {
  const root = document.documentElement;
  root.dataset.density = density;
}

export function loadPreferences(): AppearancePreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<AppearancePreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: AppearancePreferences): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function applyPreferences(preferences: AppearancePreferences): void {
  applyTheme(resolveTheme(preferences.theme));
  applyAccent(preferences.accent);
  applyDensity(preferences.density);
}

export function watchSystemTheme(onChange: (dark: boolean) => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
