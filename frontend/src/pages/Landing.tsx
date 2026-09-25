import {
  FlashOnRounded,
  GitHub,
  LanguageRounded,
  QueryStatsRounded,
  RouterRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { getGithubAuthUrl } from "../lib/api";
import { savePendingClaimHost } from "../lib/claim";
import { FONT_DISPLAY, FONT_MONO } from "../theme/theme";

const features = [
  {
    tone: "primary",
    kicker: "Fast claim",
    title: "Claim a domain in one pass",
    desc: "Choose a subdomain, pick an available suffix, and connect it without working through a long onboarding flow.",
    icon: <FlashOnRounded />,
  },
  {
    tone: "warning",
    kicker: "Real infra",
    title: "Route to real infrastructure",
    desc: "Point traffic at a home server, VPS, tunnel endpoint, or internal hostname using the same form pattern every time.",
    icon: <RouterRounded />,
  },
  {
    tone: "success",
    kicker: "Measured review",
    title: "Review traffic when it matters",
    desc: "Open analytics only when you need them, so the main workspace stays focused on routing decisions.",
    icon: <QueryStatsRounded />,
  },
] as const;

const previewRoutes = [
  { name: "api.domainak.com", target: "192.168.1.5:8080" },
  { name: "home.domainak.com", target: "10.0.0.2:3000" },
  { name: "docs.domainak.com", target: "traefik.internal:443" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  // Set when arriving from the proxy's "subdomain not registered" page.
  const claimHost = searchParams.get("subdomain")?.trim() ?? "";

  useEffect(() => {
    if (claimHost) {
      savePendingClaimHost(claimHost);
    }

    const token = localStorage.getItem("session_token");
    if (token) {
      navigate("/dashboard", { replace: true });
    }
  }, [claimHost, navigate]);

  const handleLogin = () => {
    window.location.href = getGithubAuthUrl();
  };

  return (
    <AppShell user={null}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 0.85fr" },
          gap: { xs: 4, md: 6 },
          alignItems: "center",
          pt: { xs: 1, md: 3 },
        }}
      >
        <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <Chip
              icon={<LanguageRounded />}
              label="Domain routing for personal apps"
              variant="outlined"
              color="primary"
              size="small"
            />
            {claimHost ? (
              <Chip
                label={`Ready to claim ${claimHost}`}
                variant="filled"
                color="primary"
                size="small"
                sx={{ fontFamily: FONT_MONO, maxWidth: "100%" }}
              />
            ) : null}
          </Stack>

          <Typography variant="h1" component="h1">
            Claim a clean subdomain and point it where your service lives.
          </Typography>

          <Typography
            variant="body1"
            color="textSecondary"
            sx={{ maxWidth: 560, fontSize: { xs: "1rem", md: "1.08rem" } }}
          >
            Domainak gives mixed technical teams one{" "}
            <Box
              component="span"
              sx={{ color: "primary.main", fontWeight: 600 }}
            >
              calm place
            </Box>{" "}
            to register a readable hostname, connect it to a tunnel or server,
            and confirm that traffic is reaching the{" "}
            <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
              right destination
            </Box>
            .
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              startIcon={<GitHub />}
              onClick={handleLogin}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              Continue with GitHub
            </Button>
            <Button
              variant="outlined"
              size="large"
              href="#features"
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              See how it works
            </Button>
          </Stack>

          <Typography variant="caption" color="textSecondary">
            Free for personal projects · Sign in with GitHub
          </Typography>
        </Box>

        <Card
          sx={{
            minWidth: 0,
            boxShadow: isDark
              ? "0 24px 60px rgba(0, 0, 0, 0.45)"
              : "0 24px 60px rgba(13, 21, 36, 0.12)",
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.09),
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="overline" color="textSecondary">
              Active routes
            </Typography>
            <Chip label="Live" color="success" size="small" variant="outlined" />
          </Box>

          <Stack divider={<Divider />} sx={{ px: 2.5, py: 0.25 }}>
            {previewRoutes.map((route) => (
              <Box
                key={route.name}
                sx={{
                  py: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    dir="auto"
                    sx={{
                      fontFamily: FONT_MONO,
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {route.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    dir="auto"
                    sx={{
                      display: "block",
                      fontFamily: FONT_MONO,
                      overflowWrap: "anywhere",
                    }}
                  >
                    → {route.target}
                  </Typography>
                </Box>
                <Chip
                  label="Active"
                  color="success"
                  size="small"
                  variant="outlined"
                  sx={{ flexShrink: 0 }}
                />
              </Box>
            ))}
          </Stack>

          <Divider />

          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              display: "flex",
              gap: 4,
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="overline" color="textSecondary">
                Requests today
              </Typography>
              <Typography
                variant="h4"
                sx={{ fontFamily: FONT_DISPLAY, fontSize: "1.25rem" }}
              >
                1,204
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="overline" color="textSecondary">
                Uptime
              </Typography>
              <Typography
                variant="h4"
                sx={{ fontFamily: FONT_DISPLAY, fontSize: "1.25rem" }}
              >
                99.9%
              </Typography>
            </Box>
          </Box>
        </Card>
      </Box>

      <Box
        id="features"
        sx={{ scrollMarginTop: { xs: 80, md: 96 }, mt: { xs: 8, md: 12 } }}
      >
        <Stack
          spacing={1.25}
          sx={{ textAlign: "center", mb: 4, alignItems: "center" }}
        >
          <Chip label="Built for routing" size="small" variant="outlined" />
          <Typography variant="h2">Fast setup, clear control</Typography>
          <Typography
            variant="body1"
            color="textSecondary"
            sx={{ maxWidth: 560 }}
          >
            Built for people who want routing to feel operational, not
            theatrical.
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2.5,
          }}
        >
          {features.map((feature) => (
            <Card key={feature.title} sx={{ height: "100%" }}>
              <CardContent>
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    mb: 2,
                    color: `${feature.tone}.main`,
                    bgcolor: alpha(theme.palette[feature.tone].main, 0.14),
                  }}
                >
                  {feature.icon}
                </Box>
                <Typography
                  variant="overline"
                  sx={{ color: `${feature.tone}.main` }}
                >
                  {feature.kicker}
                </Typography>
                <Typography
                  variant="h4"
                  component="h3"
                  sx={{ mt: 0.5, mb: 1 }}
                >
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {feature.desc}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    </AppShell>
  );
}
