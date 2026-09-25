import { useContext } from "react";
import {
  AppThemeContext,
  type AppThemeContextValue,
} from "./appThemeContext";

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }

  return context;
}
