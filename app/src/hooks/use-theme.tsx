import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import {
  type AppearancePreferences,
  applyPreferences,
  applyTheme,
  DEFAULT_PREFERENCES,
  loadPreferences,
  resolveTheme,
  savePreferences,
  type Theme,
  watchSystemTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  preferences: AppearancePreferences;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  setAccent: (accent: string) => void;
  setDensity: (density: "compact" | "comfortable") => void;
  resetPreferences: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => loadPreferences());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(preferences.theme),
  );

  useEffect(() => {
    applyPreferences(preferences);
    savePreferences(preferences);

    if (preferences.theme === "system") {
      const unsubscribe = watchSystemTheme((dark) => {
        setResolvedTheme(dark ? "dark" : "light");
        applyTheme(dark ? "dark" : "light");
      });
      return unsubscribe;
    }
  }, [preferences]);

  const update = useCallback((next: Partial<AppearancePreferences>) => {
    setPreferences((current) => ({ ...current, ...next }));
  }, []);

  const setTheme = useCallback(
    (theme: Theme) => {
      setResolvedTheme(resolveTheme(theme));
      update({ theme });
    },
    [update],
  );

  const setAccent = useCallback((accent: string) => update({ accent }), [update]);

  const setDensity = useCallback(
    (density: "compact" | "comfortable") => update({ density }),
    [update],
  );

  const resetPreferences = useCallback(() => {
    setResolvedTheme(resolveTheme(DEFAULT_PREFERENCES.theme));
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        preferences,
        resolvedTheme,
        setTheme,
        setAccent,
        setDensity,
        resetPreferences,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  }
  return context;
}
