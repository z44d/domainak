import { BlockRounded, GitHub, LogoutRounded } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { User } from "../lib/types";
import { FONT_DISPLAY } from "../theme/theme";

interface SuspendedProps {
  user: User | null;
}

// Shown when a banned account reaches the dashboard: fresh OAuth sign-ins
// arrive here through `?error=banned`, already signed-in sessions through
// the isBanned flag on /auth/me. The page itself stays on the error accent
// regardless of the signed-in accent preset.
export default function Suspended({ user }: SuspendedProps) {
  const navigate = useNavigate();
  const [hasSession] = useState(() =>
    Boolean(localStorage.getItem("session_token")),
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem("session_token");
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <AppShell user={user}>
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          py: { xs: 2, md: 6 },
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: 620,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "relative",
              px: { xs: 2.5, sm: 4 },
              py: { xs: 3, sm: 4 },
              display: "grid",
              gap: 2,
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                bgcolor: "error.main",
              },
            }}
          >
            <Chip
              icon={<BlockRounded />}
              label="Access restricted"
              color="error"
              variant="outlined"
              size="small"
              sx={{ justifySelf: "start", fontWeight: 700 }}
            />

            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontFamily: FONT_DISPLAY,
                color: "error.main",
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              Your account is suspended.
            </Typography>

            <Typography variant="body1" color="textSecondary" sx={{ m: 0 }}>
              This account is blocked from Domainak, so it can no longer sign
              in or manage routes from the dashboard. If you think the
              suspension is a mistake, appeal it and a maintainer will review
              your account.
            </Typography>

            <Divider />

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              useFlexGap
            >
              {hasSession ? (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<LogoutRounded />}
                  onClick={clearSession}
                  fullWidth
                >
                  Log out
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  onClick={clearSession}
                  fullWidth
                >
                  Back to Domainak
                </Button>
              )}
              <Button
                variant="outlined"
                href="https://github.com/z44d/domainak"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<GitHub />}
                fullWidth
              >
                Appeal on GitHub
              </Button>
            </Stack>
          </Box>
        </Card>
      </Box>
    </AppShell>
  );
}
