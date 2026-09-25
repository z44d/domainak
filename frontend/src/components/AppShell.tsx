import {
  AdminPanelSettingsRounded,
  CheckRounded,
  CloseRounded,
  DarkModeRounded,
  DnsRounded,
  GitHub,
  LanguageRounded,
  LightModeRounded,
  LogoutRounded,
  MenuRounded,
  PaletteRounded,
  Telegram,
} from "@mui/icons-material";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  Link as MuiLink,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Snackbar,
  Toolbar,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type ReactNode, useEffect, useState } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { api, getGithubAuthUrl } from "../lib/api";
import type { User } from "../lib/types";
import { getErrorMessage } from "../lib/utils";
import type { AccentKey, AccentPreset } from "../theme/accents";
import { useAppTheme } from "../theme/useAppTheme";
import { FONT_DISPLAY } from "../theme/theme";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

function AccentSwatches({
  accents,
  accentKey,
  onSelect,
}: {
  accents: AccentPreset[];
  accentKey: AccentKey;
  onSelect: (key: AccentKey) => void;
}) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {accents.map((accent) => {
        const selected = accent.key === accentKey;

        return (
          <IconButton
            key={accent.key}
            aria-label={`${accent.label} accent color`}
            aria-pressed={selected}
            onClick={() => onSelect(accent.key)}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: alpha(accent.swatch, selected ? 0.3 : 0.15),
              border: `2px solid ${selected ? accent.swatch : "transparent"}`,
              "&:hover": {
                bgcolor: alpha(accent.swatch, 0.4),
              },
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                bgcolor: accent.swatch,
                display: "grid",
                placeItems: "center",
              }}
            >
              {selected ? (
                <CheckRounded sx={{ fontSize: 13, color: "#0B0F17" }} />
              ) : null}
            </Box>
          </IconButton>
        );
      })}
    </Stack>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { mode, toggleMode, accents, accentKey, setAccentKey } =
    useAppTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [accentAnchor, setAccentAnchor] = useState<HTMLElement | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const navItems: NavItem[] = [
    {
      to: "/dashboard",
      label: "Domains",
      icon: <DnsRounded fontSize="small" />,
    },
    ...(user?.isAdmin
      ? [
          {
            to: "/admin",
            label: "Admin",
            icon: <AdminPanelSettingsRounded fontSize="small" />,
          },
        ]
      : []),
  ];

  const handleLogin = () => {
    window.location.href = getGithubAuthUrl();
  };

  const handleLogout = async () => {
    setLogoutError("");
    setIsLoggingOut(true);

    try {
      await api.post("/auth/logout");
      localStorage.removeItem("session_token");
      setAccountAnchor(null);
      setDrawerOpen(false);
      navigate("/");
    } catch (error: unknown) {
      setLogoutError(
        getErrorMessage(
          error,
          "We could not reach the server. Try signing out again.",
        ),
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navButtonSx = (active: boolean) => ({
    color: active ? "primary.main" : "text.secondary",
    bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : "transparent",
    "&:hover": {
      bgcolor: alpha(theme.palette.primary.main, active ? 0.18 : 0.08),
      color: active ? "primary.main" : "text.primary",
    },
  });

  const appearanceControls = (
    <Box>
      <Typography variant="overline" color="textSecondary">
        Appearance
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={toggleMode}
        sx={{ mt: 1, mb: 1.5 }}
        startIcon={
          mode === "dark" ? (
            <LightModeRounded fontSize="small" />
          ) : (
            <DarkModeRounded fontSize="small" />
          )
        }
      >
        {mode === "dark" ? "Light mode" : "Dark mode"}
      </Button>
      <AccentSwatches
        accents={accents}
        accentKey={accentKey}
        onSelect={setAccentKey}
      />
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <AppBar
        position="sticky"
        color="transparent"
        sx={{
          bgcolor: alpha(theme.palette.background.default, 0.82),
          backdropFilter: "blur(14px) saturate(150%)",
          WebkitBackdropFilter: "blur(14px) saturate(150%)",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 60, md: 68 },
            gap: { xs: 0.5, sm: 1 },
            px: { xs: 1.5, sm: 2.5 },
          }}
        >
          {!isDesktop ? (
            <IconButton
              edge="start"
              aria-label="Open navigation menu"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuRounded />
            </IconButton>
          ) : null}

          <Box
            component={RouterLink}
            to="/"
            aria-label="Domainak home"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              mr: 1,
              minWidth: 0,
              color: "text.primary",
              textDecoration: "none",
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: "12px",
                display: "grid",
                placeItems: "center",
                color: "primary.contrastText",
                background: `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                boxShadow: `0 6px 18px ${alpha(
                  theme.palette.primary.main,
                  0.35,
                )}`,
              }}
            >
              <LanguageRounded fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                }}
              >
                Domainak
              </Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.2 }}
              >
                routing control
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {isDesktop ? (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: "center" }}
            >
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  startIcon={item.icon}
                  sx={navButtonSx(isActive(item.to))}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
          ) : null}

          <Divider
            orientation="vertical"
            flexItem
            sx={{ my: 1.5, display: { xs: "none", sm: "block" } }}
          />

          <Tooltip
            title={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <IconButton
              aria-label="Toggle color theme"
              onClick={toggleMode}
              sx={{ color: "text.secondary" }}
            >
              {mode === "dark" ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Accent color">
            <IconButton
              aria-label="Choose accent color"
              onClick={(event) => setAccentAnchor(event.currentTarget)}
              sx={{ color: "text.secondary" }}
            >
              <PaletteRounded />
            </IconButton>
          </Tooltip>

          {user ? (
            <IconButton
              aria-label="Open account menu"
              onClick={(event) => setAccountAnchor(event.currentTarget)}
              sx={{ p: 0.75 }}
            >
              <Avatar
                src={`https://avatars.githubusercontent.com/u/${user.githubId}?v=4`}
                alt={user.name}
                sx={{
                  width: 36,
                  height: 36,
                  border: `2px solid ${alpha(
                    theme.palette.primary.main,
                    0.45,
                  )}`,
                }}
              />
            </IconButton>
          ) : isDesktop ? (
            <Button
              variant="contained"
              size="small"
              onClick={handleLogin}
              startIcon={<GitHub />}
            >
              Continue with GitHub
            </Button>
          ) : null}
        </Toolbar>
      </AppBar>

      <Popover
        open={Boolean(accentAnchor)}
        anchorEl={accentAnchor}
        onClose={() => setAccentAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 2, width: 212 }}>
          <Typography variant="overline" color="textSecondary">
            Accent color
          </Typography>
          <Box sx={{ mt: 1 }}>
            <AccentSwatches
              accents={accents}
              accentKey={accentKey}
              onSelect={setAccentKey}
            />
          </Box>
        </Box>
      </Popover>

      <Menu
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
        slotProps={{ paper: { sx: { mt: 1, width: 264 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, minWidth: 0 }}>
          <Typography
            noWrap
            dir="auto"
            title={user?.name}
            sx={{ fontWeight: 700 }}
          >
            {user?.name}
          </Typography>
          <Typography
            variant="caption"
            color="textSecondary"
            noWrap
            dir="auto"
            title={user?.email}
          >
            {user?.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          component={RouterLink}
          to="/dashboard"
          onClick={() => setAccountAnchor(null)}
          sx={{ gap: 1.5 }}
        >
          <DnsRounded fontSize="small" /> Domains
        </MenuItem>
        {user?.isAdmin ? (
          <MenuItem
            component={RouterLink}
            to="/admin"
            onClick={() => setAccountAnchor(null)}
            sx={{ gap: 1.5 }}
          >
            <AdminPanelSettingsRounded fontSize="small" /> Admin
          </MenuItem>
        ) : null}
        <Divider />
        <MenuItem
          onClick={() => {
            void handleLogout();
          }}
          disabled={isLoggingOut}
          sx={{ gap: 1.5, color: "error.main" }}
        >
          <LogoutRounded fontSize="small" />
          {isLoggingOut ? "Signing out..." : "Log out"}
        </MenuItem>
      </Menu>

      <Drawer
        anchor="left"
        open={!isDesktop && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 300, borderRight: "none" } } }}
      >
        <Box
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            px: 2,
            pt: 1.5,
            pb: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: "1.1rem",
                letterSpacing: "-0.02em",
              }}
            >
              Domainak
            </Typography>
            <IconButton
              aria-label="Close navigation menu"
              onClick={() => setDrawerOpen(false)}
            >
              <CloseRounded />
            </IconButton>
          </Box>

          <Divider />

          <Stack spacing={0.5} sx={{ my: 1.5 }}>
            {navItems.map((item) => (
              <Button
                key={item.to}
                component={RouterLink}
                to={item.to}
                onClick={() => setDrawerOpen(false)}
                startIcon={item.icon}
                fullWidth
                sx={{
                  justifyContent: "flex-start",
                  py: 1,
                  ...navButtonSx(isActive(item.to)),
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>

          <Divider />

          <Box sx={{ py: 1.5 }}>{appearanceControls}</Box>

          <Box sx={{ flexGrow: 1 }} />

          <Divider sx={{ mb: 1.5 }} />

          {user ? (
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  minWidth: 0,
                }}
              >
                <Avatar
                  src={`https://avatars.githubusercontent.com/u/${user.githubId}?v=4`}
                  alt={user.name}
                  sx={{ width: 36, height: 36 }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    noWrap
                    sx={{ fontWeight: 700, fontSize: "0.9rem" }}
                  >
                    {user.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    noWrap
                    dir="auto"
                  >
                    {user.email}
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                color="error"
                startIcon={<LogoutRounded />}
                onClick={() => {
                  void handleLogout();
                }}
                disabled={isLoggingOut}
                fullWidth
              >
                {isLoggingOut ? "Signing out..." : "Log out"}
              </Button>
            </Box>
          ) : (
            <Button
              variant="contained"
              startIcon={<GitHub />}
              onClick={handleLogin}
              fullWidth
            >
              Continue with GitHub
            </Button>
          )}
        </Box>
      </Drawer>

      <Container
        component="main"
        maxWidth="lg"
        sx={{
          flex: 1,
          width: "100%",
          py: { xs: 3, md: 5 },
          px: { xs: 2, sm: 3 },
        }}
      >
        {children}
      </Container>

      <Box
        component="footer"
        sx={{ borderTop: `1px solid ${theme.palette.divider}`, mt: "auto" }}
      >
        <Container
          maxWidth="lg"
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 1.5,
            py: { xs: 2.5, md: 3 },
            pb: "max(20px, env(safe-area-inset-bottom))",
          }}
        >
          <Typography variant="caption" color="textSecondary">
            Domainak — routing control for personal apps.
          </Typography>
          <Stack
            direction="row"
            spacing={2.5}
            useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "center" }}
          >
            <MuiLink
              href="https://github.com/z44d"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              variant="caption"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                color: "text.secondary",
              }}
            >
              <GitHub sx={{ fontSize: 16 }} /> Built by z44d
            </MuiLink>
            <MuiLink
              href="https://t.me/zaidlab"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              variant="caption"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                color: "text.secondary",
              }}
            >
              <Telegram sx={{ fontSize: 16 }} /> Release notes
            </MuiLink>
          </Stack>
        </Container>
      </Box>

      <Snackbar
        open={Boolean(logoutError)}
        autoHideDuration={5000}
        onClose={() => setLogoutError("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setLogoutError("")}
        >
          {logoutError}
        </Alert>
      </Snackbar>
    </Box>
  );
}
