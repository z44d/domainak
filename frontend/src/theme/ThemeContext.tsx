import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ACCENTS, getAccent, type AccentKey } from "./accents";
import { AppThemeContext } from "./appThemeContext";
import { createAppTheme, type ThemeMode } from "./theme";

const MODE_STORAGE_KEY = "domainak_theme_mode";
const ACCENT_STORAGE_KEY = "domainak_accent";

const DARK_BACKGROUND = "#0B0F17";
const LIGHT_BACKGROUND = "#F5F7FB";

function readStoredMode(): ThemeMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    // Storage can be unavailable in private browsing contexts.
    return "dark";
  }
}

function readStoredAccent(): AccentKey {
  try {
    return getAccent(localStorage.getItem(ACCENT_STORAGE_KEY)).key;
  } catch {
    return getAccent(null).key;
  }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);
  const [accentKey, setAccentKey] = useState<AccentKey>(readStoredAccent);

  const accent = getAccent(accentKey);
  const accentColors = accent[mode];
  const theme = useMemo(
    () => createAppTheme(mode, accentColors),
    [mode, accentColors],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = mode;
    root.style.backgroundColor =
      mode === "dark" ? DARK_BACKGROUND : LIGHT_BACKGROUND;
    root.style.setProperty("--app-accent", accentColors.main);

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        mode === "dark" ? DARK_BACKGROUND : LIGHT_BACKGROUND,
      );

    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
      localStorage.setItem(ACCENT_STORAGE_KEY, accentKey);
    } catch {
      // Ignore storage failures; the theme still works for this session.
    }
  }, [mode, accentKey, accentColors]);

  const toggleMode = useCallback(() => {
    setMode((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const changeAccent = useCallback((key: AccentKey) => {
    setAccentKey(getAccent(key).key);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      accentKey,
      accents: ACCENTS,
      toggleMode,
      setAccentKey: changeAccent,
    }),
    [mode, accentKey, toggleMode, changeAccent],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}
