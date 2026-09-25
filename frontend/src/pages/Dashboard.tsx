import {
  AddRounded,
  CloseRounded,
  DeleteOutlineRounded,
  LanguageRounded,
  QueryStatsRounded,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  type FormEvent,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingScreen } from "../components/LoadingScreen";
import { ApiError, api } from "../lib/api";
import { subdomainFromHost, takePendingClaimHost } from "../lib/claim";
import type { Domain, Stats, User } from "../lib/types";
import { formatNumber, getErrorMessage } from "../lib/utils";
import { FONT_DISPLAY, FONT_MONO } from "../theme/theme";

type DomainsResponse = { domains: Domain[] };
type AvailableDomainsResponse = { available: string[] };

interface Feedback {
  message: string;
  severity: "success" | "error";
}

const DomainStatsChart = lazy(
  () => import("../components/DomainStatsChart"),
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    subdomain: "",
    domain: "",
    hostname: "",
    port: "",
  });
  const [addError, setAddError] = useState("");
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const setTransientFeedback = useCallback(
    (message: string, severity: Feedback["severity"] = "success") => {
      setFeedback({ message, severity });
    },
    [],
  );

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setPageError("");
        const { data: userData } = await api.get<User>("/auth/me", {
          signal,
        });
        setUser(userData);

        const [domainsRes, availableRes] = await Promise.all([
          api.get<DomainsResponse>("/domains", { signal }),
          api.get<AvailableDomainsResponse>("/domains/available", {
            signal,
          }),
        ]);

        setDomains(domainsRes.data.domains);
        setAvailableDomains(availableRes.data.available);
        if (availableRes.data.available.length > 0) {
          const firstAvailableDomain =
            availableRes.data.available[0] ?? "";
          setFormData((prev) => ({
            ...prev,
            domain: firstAvailableDomain,
          }));
        }

        // Prefill the claim form when arriving from the proxy's
        // "subdomain not registered" page.
        const pendingHost = takePendingClaimHost();

        if (pendingHost) {
          const claimedSubdomain = subdomainFromHost(
            pendingHost,
            availableRes.data.available,
          );

          if (claimedSubdomain.length >= 2) {
            setFormData((prev) => ({
              ...prev,
              subdomain: claimedSubdomain,
            }));
            setShowAddForm(true);
          }
        }
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem("session_token");
          navigate("/", { replace: true });
        } else if (!signal?.aborted) {
          setPageError(
            getErrorMessage(
              error,
              "We could not load your workspace right now.",
            ),
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [navigate],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  const handleAddSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setAddError("");
      setFeedback(null);

      const trimmedSubdomain = formData.subdomain.trim();
      const trimmedHostname = formData.hostname.trim();
      const parsedPort = Number(formData.port);

      if (!trimmedSubdomain || !trimmedHostname) {
        setAddError("Enter a subdomain and destination host to continue.");
        return;
      }

      if (trimmedSubdomain.length < 2) {
        setAddError("Use at least 2 characters for the subdomain.");
        return;
      }

      if (
        Number.isNaN(parsedPort) ||
        parsedPort < 1 ||
        parsedPort > 65535
      ) {
        setAddError("Use a port between 1 and 65535.");
        return;
      }

      if (!formData.domain) {
        setAddError("There are no available domain suffixes right now.");
        return;
      }

      setIsSubmitting(true);

      try {
        await api.post("/domains", {
          ...formData,
          subdomain: trimmedSubdomain,
          hostname: trimmedHostname,
          port: parsedPort.toString(),
        });
        setShowAddForm(false);
        setFormData({
          subdomain: "",
          domain: availableDomains[0] || "",
          hostname: "",
          port: "",
        });
        setTransientFeedback("Domain registered successfully.");
        await fetchData();
      } catch (error: unknown) {
        setAddError(
          getErrorMessage(error, "We could not register that domain yet."),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [availableDomains, fetchData, formData, setTransientFeedback],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      setFeedback(null);
      setDeletingId(id);
      try {
        await api.delete(`/domains/${id}`);
        setDomains((current) =>
          current.filter((domain) => domain.id !== id),
        );
        setTransientFeedback("Domain removed from your workspace.");
      } catch (error: unknown) {
        setFeedback({
          message: getErrorMessage(error, "We could not remove that domain."),
          severity: "error",
        });
      } finally {
        setDeletingId(null);
      }
    },
    [setTransientFeedback],
  );

  if (isLoading) {
    return <LoadingScreen label="Loading your domains..." />;
  }

  return (
    <AppShell user={user}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "flex-end" },
          gap: 2,
          mb: 4,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Chip
            label="Workspace"
            size="small"
            variant="outlined"
            color="primary"
            sx={{ mb: 1.5 }}
          />
          <Typography variant="h1" component="h1">
            Domains
          </Typography>
          <Typography
            variant="body1"
            color="textSecondary"
            sx={{ mt: 1, maxWidth: 640 }}
          >
            Register a destination, review traffic only when you need it, and
            keep the day-to-day workspace focused on routing decisions.
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={showAddForm ? <CloseRounded /> : <AddRounded />}
          onClick={() => setShowAddForm((current) => !current)}
          sx={{ width: { xs: "100%", md: "auto" } }}
        >
          {showAddForm ? "Hide form" : "New domain"}
        </Button>
      </Box>

      {pageError ? (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setIsLoading(true);
                fetchData();
              }}
            >
              Try again
            </Button>
          }
        >
          <Typography variant="subtitle2">Workspace unavailable</Typography>
          <Typography variant="body2" dir="auto">
            {pageError}
          </Typography>
        </Alert>
      ) : null}

      <Collapse in={showAddForm && !pageError} unmountOnExit>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Create route
            </Typography>
            <Typography variant="h3" component="h2" sx={{ mt: 0.25 }}>
              Register a new subdomain
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ mt: 0.75, mb: 2.5, maxWidth: 640 }}
            >
              Use the same format every time: choose a name, confirm the
              suffix, and point it at the host that should receive traffic.
            </Typography>

            {addError ? (
              <Alert severity="error" sx={{ mb: 2.5 }} role="alert">
                {addError}
              </Alert>
            ) : null}

            <Box
              component="form"
              onSubmit={handleAddSubmit}
              sx={{ display: "grid", gap: 2.5 }}
            >
              <Box
                sx={{
                  display: "grid",
                  gap: 2.5,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "1.3fr 1.3fr 0.7fr",
                  },
                }}
              >
                <TextField
                  label="Subdomain"
                  required
                  fullWidth
                  placeholder="my-app"
                  value={formData.subdomain}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      subdomain: event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, ""),
                    })
                  }
                  helperText="Keep it short and easy to recognize."
                  slotProps={{
                    htmlInput: {
                      minLength: 2,
                      maxLength: 63,
                      autoCapitalize: "none",
                      autoCorrect: "off",
                      spellCheck: false,
                      dir: "auto",
                    },
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Select
                            value={formData.domain}
                            onChange={(event) =>
                              setFormData({
                                ...formData,
                                domain: String(event.target.value),
                              })
                            }
                            disabled={availableDomains.length === 0}
                            aria-label="Available domain suffix"
                            variant="standard"
                            disableUnderline
                            sx={{
                              color: "text.secondary",
                              fontWeight: 600,
                              ml: 1,
                              mr: -0.5,
                            }}
                          >
                            {availableDomains.map((domain) => (
                              <MenuItem key={domain} value={domain}>
                                .{domain}
                              </MenuItem>
                            ))}
                          </Select>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  label="Destination host"
                  required
                  fullWidth
                  placeholder="192.168.1.5 or app.example.net"
                  value={formData.hostname}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      hostname: event.target.value,
                    })
                  }
                  helperText="IP address, hostname, or tunnel endpoint."
                  slotProps={{
                    htmlInput: {
                      maxLength: 255,
                      autoCapitalize: "none",
                      autoCorrect: "off",
                      spellCheck: false,
                      dir: "auto",
                    },
                  }}
                />

                <TextField
                  label="Destination port"
                  required
                  fullWidth
                  type="number"
                  placeholder="8080"
                  value={formData.port}
                  onChange={(event) =>
                    setFormData({ ...formData, port: event.target.value })
                  }
                  helperText="The service port that receives requests."
                  slotProps={{
                    htmlInput: {
                      min: 1,
                      max: 65535,
                      inputMode: "numeric",
                    },
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: {
                    xs: "column-reverse",
                    sm: "row",
                  },
                  justifyContent: "space-between",
                  alignItems: { xs: "stretch", sm: "center" },
                  gap: 1.5,
                }}
              >
                <Typography variant="caption" color="textSecondary">
                  {availableDomains.length > 0
                    ? "Changes take effect immediately after registration."
                    : "No domain suffixes are available right now."}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    type="button"
                    color="inherit"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      isSubmitting || availableDomains.length === 0
                    }
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : undefined
                    }
                  >
                    Register domain
                  </Button>
                </Stack>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Collapse>

      {!pageError && domains.length === 0 ? (
        <Card
          sx={{
            borderStyle: "dashed",
            textAlign: "center",
            py: 6,
            px: 3,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              mx: "auto",
              display: "grid",
              placeItems: "center",
              bgcolor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            <LanguageRounded />
          </Box>
          <Typography variant="h3" component="h2" sx={{ mt: 2 }}>
            No routes yet
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ maxWidth: 420, mx: "auto", mt: 1 }}
          >
            Start by registering a subdomain, then point it at the service or
            tunnel you want to expose.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => setShowAddForm(true)}
            sx={{ mt: 2.5 }}
          >
            Register your first domain
          </Button>
        </Card>
      ) : !pageError ? (
        <Box sx={{ display: "grid", gap: 2.5 }}>
          {domains.map((domain) => (
            <DomainRow
              key={domain.id}
              domain={domain}
              onDelete={handleDelete}
              isDeleting={deletingId === domain.id}
            />
          ))}
        </Box>
      ) : null}

      <Snackbar
        open={feedback !== null}
        autoHideDuration={4000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setFeedback(null)}
          severity={feedback?.severity ?? "success"}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {feedback?.message}
        </Alert>
      </Snackbar>
    </AppShell>
  );
}

const DomainRow = memo(function DomainRow({
  domain,
  onDelete,
  isDeleting,
}: {
  domain: Domain;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
  const theme = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) =>
        (currentYear - index).toString(),
      ),
    [currentYear],
  );
  const [year, setYear] = useState(currentYear.toString());

  const fetchStats = async (selectedYear: string) => {
    setIsLoadingStats(true);
    setStatsError("");
    try {
      const res = await api.get<Stats>(`/stats/${domain.id}`, {
        params: { year: selectedYear },
      });
      setStats(res.data);
    } catch (error: unknown) {
      setStatsError(
        getErrorMessage(
          error,
          "We could not load analytics for this route.",
        ),
      );
    } finally {
      setIsLoadingStats(false);
    }
  };

  const toggleStats = async () => {
    if (!showStats && !stats) {
      await fetchStats(year);
    }
    setShowStats((current) => !current);
  };

  const handleYearChange = (nextYear: string) => {
    setYear(nextYear);
    if (showStats) {
      fetchStats(nextYear);
    }
  };

  return (
    <Card>
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", gap: 2, minWidth: 0 }}>
          <Avatar
            variant="rounded"
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.15),
              color: "primary.main",
              borderRadius: "14px",
            }}
          >
            <LanguageRounded />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              color="textSecondary"
              sx={{ display: "block", lineHeight: 1.4 }}
            >
              Active route
            </Typography>
            <Typography
              dir="auto"
              sx={{
                fontFamily: FONT_MONO,
                fontWeight: 600,
                fontSize: "1.15rem",
                overflowWrap: "anywhere",
              }}
            >
              {domain.subdomain}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              dir="auto"
              sx={{
                fontFamily: FONT_MONO,
                overflowWrap: "anywhere",
              }}
            >
              → {domain.hostname}:{domain.port}
            </Typography>
          </Box>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexShrink: 0, flexWrap: "wrap" }}
        >
          <Button
            size="small"
            variant={showStats ? "contained" : "outlined"}
            startIcon={<QueryStatsRounded />}
            onClick={() => {
              void toggleStats();
            }}
            disabled={isDeleting}
          >
            {showStats ? "Hide analytics" : "Analytics"}
          </Button>
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={
              isDeleting ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <DeleteOutlineRounded />
              )
            }
            onClick={() => setConfirmDelete(true)}
            disabled={isDeleting}
          >
            Remove
          </Button>
        </Stack>
      </Box>

      {showStats ? (
        <>
          <Divider />
          <CardContent>
            <Stack spacing={2.5}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", sm: "center" },
                  gap: 1.5,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="textSecondary">
                    Traffic review
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{ maxWidth: 520 }}
                  >
                    Open yearly traffic only when you need it. The default view
                    keeps the main list easier to scan.
                  </Typography>
                </Box>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel id={`year-label-${domain.id}`}>
                    Year
                  </InputLabel>
                  <Select
                    labelId={`year-label-${domain.id}`}
                    id={`year-${domain.id}`}
                    value={year}
                    label="Year"
                    onChange={(event) =>
                      handleYearChange(String(event.target.value))
                    }
                  >
                    {years.map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {statsError ? (
                <Alert
                  severity="error"
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        void fetchStats(year);
                      }}
                    >
                      Try again
                    </Button>
                  }
                >
                  {statsError}
                </Alert>
              ) : isLoadingStats && !stats ? (
                <Box
                  sx={{
                    display: "grid",
                    placeItems: "center",
                    gap: 1.5,
                    py: 6,
                  }}
                  aria-live="polite"
                >
                  <CircularProgress size={28} />
                  <Typography variant="body2" color="textSecondary">
                    Loading analytics...
                  </Typography>
                </Box>
              ) : stats ? (
                <Stack spacing={2.5}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "repeat(2, 1fr)",
                        md: "repeat(4, 1fr)",
                      },
                      gap: 1.5,
                    }}
                  >
                    <MetricCard
                      label="Daily"
                      value={formatNumber(stats.daily)}
                    />
                    <MetricCard
                      label="Weekly"
                      value={formatNumber(stats.weekly)}
                    />
                    <MetricCard
                      label="Monthly"
                      value={formatNumber(stats.monthly)}
                    />
                    <MetricCard
                      label="Year total"
                      value={formatNumber(stats.total)}
                      accent
                    />
                  </Box>

                  <Paper
                    variant="outlined"
                    sx={{ borderRadius: 3, overflow: "hidden" }}
                  >
                    <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2 }}>
                      <Typography variant="h6">
                        Monthly visitors
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        A compact view of traffic over the selected year.
                      </Typography>
                      <Box sx={{ height: { xs: 210, sm: 250 }, mt: 1.5 }}>
                        <Suspense
                          fallback={
                            <Box
                              sx={{
                                height: "100%",
                                display: "grid",
                                placeItems: "center",
                              }}
                              aria-live="polite"
                            >
                              <CircularProgress size={28} />
                            </Box>
                          }
                        >
                          <DomainStatsChart chartData={stats.chartData} />
                        </Suspense>
                      </Box>
                    </Box>
                  </Paper>
                </Stack>
              ) : null}
            </Stack>
          </CardContent>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Remove domain?"
        message={`Remove ${domain.subdomain} from your workspace? Traffic to this route stops immediately.`}
        confirmLabel="Remove"
        loading={isDeleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(domain.id);
        }}
      />
    </Card>
  );
});

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 3,
        minWidth: 0,
        bgcolor: accent
          ? alpha(theme.palette.primary.main, 0.1)
          : "transparent",
        borderColor: accent
          ? alpha(theme.palette.primary.main, 0.35)
          : "divider",
      }}
    >
      <Typography
        variant="overline"
        color="textSecondary"
        sx={{ display: "block", lineHeight: 1.5 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontSize: { xs: "1.4rem", md: "1.7rem" },
          mt: 0.25,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Typography>
    </Paper>
  );
}
