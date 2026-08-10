import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";

function Controls() {
  const { preferences, setAccent, setDensity, resetPreferences, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="prefs">{JSON.stringify(preferences)}</span>
      <button type="button" onClick={() => setAccent("blue")}>
        set-accent
      </button>
      <button type="button" onClick={() => setDensity("compact")}>
        set-density
      </button>
      <button type="button" onClick={() => resetPreferences()}>
        reset
      </button>
      <button type="button" onClick={() => setTheme("system")}>
        set-system
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <Controls />
    </ThemeProvider>,
  );
}

describe("useTheme", () => {
  it("lança erro quando usado fora do ThemeProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken() {
      useTheme();
      return null;
    }
    expect(() => render(<Broken />)).toThrow("useTheme deve ser usado dentro de <ThemeProvider>");
    vi.mocked(console.error).mockRestore();
  });

  it("permite alterar a cor de destaque", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("set-accent"));
    const prefs = JSON.parse(screen.getByTestId("prefs").textContent ?? "{}") as {
      accent: string;
    };
    expect(prefs.accent).toBe("blue");
  });

  it("permite alterar a densidade", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("set-density"));
    const prefs = JSON.parse(screen.getByTestId("prefs").textContent ?? "{}") as {
      density: string;
    };
    expect(prefs.density).toBe("compact");
  });

  it("reseta as preferências para os padrões", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("set-accent"));
    await user.click(screen.getByText("set-density"));
    await user.click(screen.getByText("reset"));
    const prefs = JSON.parse(screen.getByTestId("prefs").textContent ?? "{}") as {
      accent: string;
      density: string;
    };
    expect(prefs.accent).toBe("default");
    expect(prefs.density).toBe("comfortable");
  });

  it("reage à mudança do tema do sistema quando em modo system", async () => {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    const addEventListener = vi.fn((_type: string, cb: () => void) => {
      listener = cb;
    });
    const removeEventListener = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "",
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("set-system"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      listener?.({ matches: false });
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    act(() => {
      listener?.({ matches: true });
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    expect(removeEventListener).toHaveBeenCalled();
  });
});
