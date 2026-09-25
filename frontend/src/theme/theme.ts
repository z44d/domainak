import { createTheme, type Theme } from "@mui/material/styles";
import type { AccentColors } from "./accents";

export type ThemeMode = "light" | "dark";

export const FONT_SANS =
  '"Inter", "Helvetica Neue", Arial, sans-serif';
export const FONT_DISPLAY =
  '"Space Grotesk", "Inter", Arial, sans-serif';
export const FONT_MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export function createAppTheme(
  mode: ThemeMode,
  accent: AccentColors,
): Theme {
  const isDark = mode === "dark";

  const divider = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(13, 21, 36, 0.1)";
  const subtleSurface = isDark
    ? "rgba(255, 255, 255, 0.04)"
    : "rgba(13, 21, 36, 0.03)";
  const textSecondary = isDark ? "#9DAAC0" : "#4C5A70";

  return createTheme({
    palette: {
      mode,
      primary: accent,
      secondary: { ...accent },
      background: {
        default: isDark ? "#0B0F17" : "#F5F7FB",
        paper: isDark ? "#121A28" : "#FFFFFF",
      },
      text: {
        primary: isDark ? "#E9EEF7" : "#0D1524",
        secondary: textSecondary,
      },
      divider,
      error: { main: isDark ? "#FF7A7A" : "#DC2626" },
      warning: { main: isDark ? "#FBBF24" : "#D97706" },
      success: { main: isDark ? "#4ADE80" : "#16A34A" },
      info: { main: isDark ? "#38BDF8" : "#0284C7" },
    },
    shape: {
      borderRadius: 14,
    },
    typography: {
      fontFamily: FONT_SANS,
      fontSize: 15,
      h1: {
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        lineHeight: 1.04,
        letterSpacing: "-0.035em",
        fontSize: "2.3rem",
        "@media (min-width:600px)": { fontSize: "2.85rem" },
        "@media (min-width:900px)": { fontSize: "3.35rem" },
      },
      h2: {
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        lineHeight: 1.12,
        letterSpacing: "-0.03em",
        fontSize: "1.75rem",
        "@media (min-width:900px)": { fontSize: "2.2rem" },
      },
      h3: {
        fontFamily: FONT_DISPLAY,
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: "-0.02em",
        fontSize: "1.3rem",
        "@media (min-width:900px)": { fontSize: "1.45rem" },
      },
      h4: {
        fontFamily: FONT_DISPLAY,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        fontSize: "1.15rem",
      },
      h5: {
        fontWeight: 700,
        letterSpacing: "-0.01em",
        fontSize: "1.05rem",
      },
      h6: {
        fontWeight: 600,
        fontSize: "1rem",
      },
      body1: {
        fontSize: "1rem",
        lineHeight: 1.65,
      },
      body2: {
        fontSize: "0.925rem",
        lineHeight: 1.6,
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
      },
      overline: {
        fontWeight: 700,
        letterSpacing: "0.12em",
        fontSize: "0.7rem",
      },
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 999,
            minHeight: 42,
            paddingLeft: 18,
            paddingRight: 18,
            letterSpacing: "-0.01em",
          },
          sizeSmall: {
            minHeight: 34,
            paddingLeft: 13,
            paddingRight: 13,
          },
          sizeLarge: {
            minHeight: 50,
            paddingLeft: 26,
            paddingRight: 26,
            fontSize: "1rem",
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderRadius: 20,
            border: `1px solid ${divider}`,
            overflow: "hidden",
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: "20px 24px",
            "@media (max-width:600px)": { padding: "18px 18px" },
            "&:last-child": { paddingBottom: 20 },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: subtleSurface,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontWeight: 600,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            fontSize: "0.925rem",
            alignItems: "flex-start",
          },
        },
      },
      MuiAppBar: {
        defaultProps: {
          color: "transparent",
          elevation: 0,
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 24,
            border: `1px solid ${divider}`,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: `1px solid ${divider}`,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 18,
            border: `1px solid ${divider}`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${divider}`,
          },
          head: {
            backgroundColor: "transparent",
            color: textSecondary,
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            borderBottom: `1px solid ${divider}`,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            minHeight: 50,
          },
        },
      },
      MuiPagination: {
        defaultProps: {
          shape: "rounded",
          color: "primary",
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            fontWeight: 700,
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
        },
      },
    },
  });
}
