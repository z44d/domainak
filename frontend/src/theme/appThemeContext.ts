import { createContext } from "react";
import type { AccentKey, AccentPreset } from "./accents";
import type { ThemeMode } from "./theme";

export interface AppThemeContextValue {
  mode: ThemeMode;
  accentKey: AccentKey;
  accents: AccentPreset[];
  toggleMode: () => void;
  setAccentKey: (key: AccentKey) => void;
}

export const AppThemeContext = createContext<AppThemeContextValue | null>(
  null,
);
