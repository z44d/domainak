export type AccentKey =
  | "cyan"
  | "blue"
  | "violet"
  | "rose"
  | "amber"
  | "emerald";

export interface AccentColors {
  main: string;
  light: string;
  dark: string;
  contrastText: string;
}

export interface AccentPreset {
  key: AccentKey;
  label: string;
  swatch: string;
  light: AccentColors;
  dark: AccentColors;
}

const PRESETS: Record<AccentKey, AccentPreset> = {
  cyan: {
    key: "cyan",
    label: "Cyan",
    swatch: "#06B6D4",
    light: {
      main: "#0891B2",
      light: "#22D3EE",
      dark: "#0E7490",
      contrastText: "#FFFFFF",
    },
    dark: {
      main: "#22D3EE",
      light: "#67E8F9",
      dark: "#06B6D4",
      contrastText: "#062A33",
    },
  },
  blue: {
    key: "blue",
    label: "Blue",
    swatch: "#3B82F6",
    light: {
      main: "#2563EB",
      light: "#60A5FA",
      dark: "#1D4ED8",
      contrastText: "#FFFFFF",
    },
    dark: {
      main: "#60A5FA",
      light: "#93C5FD",
      dark: "#3B82F6",
      contrastText: "#08152B",
    },
  },
  violet: {
    key: "violet",
    label: "Violet",
    swatch: "#8B5CF6",
    light: {
      main: "#7C3AED",
      light: "#A78BFA",
      dark: "#6D28D9",
      contrastText: "#FFFFFF",
    },
    dark: {
      main: "#A78BFA",
      light: "#C4B5FD",
      dark: "#8B5CF6",
      contrastText: "#1A0B33",
    },
  },
  rose: {
    key: "rose",
    label: "Rose",
    swatch: "#F43F5E",
    light: {
      main: "#E11D48",
      light: "#FB7185",
      dark: "#BE123C",
      contrastText: "#FFFFFF",
    },
    dark: {
      main: "#FB7185",
      light: "#FDA4AF",
      dark: "#F43F5E",
      contrastText: "#33060F",
    },
  },
  amber: {
    key: "amber",
    label: "Amber",
    swatch: "#F59E0B",
    light: {
      main: "#D97706",
      light: "#FBBF24",
      dark: "#B45309",
      contrastText: "#FFFFFF",
    },
    dark: {
      main: "#FBBF24",
      light: "#FCD34D",
      dark: "#F59E0B",
      contrastText: "#2E1B00",
    },
  },
  emerald: {
    key: "emerald",
    label: "Emerald",
    swatch: "#10B981",
    light: {
      main: "#059669",
      light: "#34D399",
      dark: "#047857",
      contrastText: "#FFFFFF",
    },
    dark: {
      main: "#34D399",
      light: "#6EE7B7",
      dark: "#10B981",
      contrastText: "#04241A",
    },
  },
};

export const DEFAULT_ACCENT: AccentPreset = PRESETS.cyan;

export const ACCENTS: AccentPreset[] = Object.values(PRESETS);

export function getAccent(key: string | null | undefined): AccentPreset {
  if (key && Object.prototype.hasOwnProperty.call(PRESETS, key)) {
    return PRESETS[key as AccentKey];
  }

  return DEFAULT_ACCENT;
}
