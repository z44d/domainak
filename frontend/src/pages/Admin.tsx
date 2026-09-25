import {
  BlockRounded,
  CheckCircleRounded,
  DeleteOutlineRounded,
  InboxRounded,
  PeopleRounded,
  PublicOffRounded,
  ShieldRounded,
  WifiOffRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingScreen } from "../components/LoadingScreen";
import { ApiError, api } from "../lib/api";
import type {
  AdminUserRow,
  BannedDomain,
  BannedIp,
  Domain,
  PaginatedResponse,
  PaginationMeta,
  User,
} from "../lib/types";
import { formatDate, getErrorMessage } from "../lib/utils";
import { FONT_MONO } from "../theme/theme";

type AdminView =
  | "domains"
  | "users"
  | "banned-users"
  | "banned-domains"
  | "banned-ips";

type AdminItem = Domain | AdminUserRow | BannedDomain | BannedIp;

interface Feedback {
  message: string;
  severity: "success" | "error";
}

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

const PAGE_SIZE = 20;

const viewMeta: Record<
  AdminView,
  {
    title: string;
    eyebrow: string;
    description: string;
    emptyTitle: string;
    emptyCopy: string;
    endpoint: string;
    icon: ReactElement;
  }
> = {
  domains: {
    title: "Domains",
    eyebrow: "Routing inventory",
    description:
      "Review every registered route, remove it, or escalate it into a domain ban without being limited to the latest 100 entries.",
    emptyTitle: "No domains to review",
    emptyCopy: "New registrations will appear here as they are created.",
    endpoint: "/admin/domains",
    icon: <ShieldRounded fontSize="small" />,
  },
  users: {
    title: "Users",
    eyebrow: "Account inventory",
    description:
      "Browse every account, see how many domains each user owns, and react quickly when someone needs moderation.",
    emptyTitle: "No users yet",
    emptyCopy: "User accounts will appear here after the first login.",
    endpoint: "/admin/users",
    icon: <PeopleRounded fontSize="small" />,
  },
  "banned-users": {
    title: "Banned users",
    eyebrow: "Restricted accounts",
    description:
      "Audit blocked accounts separately so unban decisions stay fast and deliberate.",
    emptyTitle: "No banned users",
    emptyCopy:
      "Banned accounts will appear here when moderation actions are taken.",
    endpoint: "/admin/banned-users",
    icon: <BlockRounded fontSize="small" />,
  },
  "banned-domains": {
    title: "Banned domains",
    eyebrow: "Blocked routes",
    description:
      "Track domains that can no longer be registered and reverse the block when the incident is resolved.",
    emptyTitle: "No banned domains",
    emptyCopy: "Blocked domains will appear here after you ban them.",
    endpoint: "/admin/banned-domains",
    icon: <PublicOffRounded fontSize="small" />,
  },
  "banned-ips": {
    title: "Blocked IPs",
    eyebrow: "Network blocks",
    description:
      "Keep a clean list of abusive sources, review reasons, and unblock them when needed.",
    emptyTitle: "No blocked IPs",
    emptyCopy:
      "Blocked IP addresses and hostnames will appear here after you add them.",
    endpoint: "/admin/ips",
    icon: <WifiOffRounded fontSize="small" />,
  },
};

const initialPagination = (): PaginationMeta => ({
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

export default function Admin() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AdminView>("domains");
  const [pages, setPages] = useState<Record<AdminView, number>>({
    domains: 1,
    users: 1,
    "banned-users": 1,
    "banned-domains": 1,
    "banned-ips": 1,
  });
  const [viewData, setViewData] = useState<PaginatedResponse<AdminItem>>({
    items: [],
    pagination: initialPagination(),
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmRequest, setConfirmRequest] =
    useState<ConfirmRequest | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [domainToBan, setDomainToBan] = useState("");
  const [domainReason, setDomainReason] = useState("");
  const [ipToBan, setIpToBan] = useState("");
  const [banReason, setBanReason] = useState("");
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(
    null,
  );

  const currentPage = pages[activeView];
  const currentMeta = viewMeta[activeView];

  const setTransientFeedback = useCallback(
    (message: string, severity: Feedback["severity"] = "success") => {
      setFeedback({ message, severity });
    },
    [],
  );

  const ensureAdmin = useCallback(
    async (signal?: AbortSignal) => {
      if (user) {
        return user;
      }

      const { data: userData } = await api.get<User>("/auth/me", {
        signal,
      });
      if (!userData.isAdmin) {
        navigate("/dashboard", { replace: true });
        return null;
      }

      setUser(userData);
      return userData as User;
    },
    [navigate, user],
  );

  const loadView = useCallback(
    async (view: AdminView, page: number, signal?: AbortSignal) => {
      setPageError("");
      setIsViewLoading(true);

      try {
        const res = await api.get<PaginatedResponse<AdminItem>>(
          viewMeta[view].endpoint,
          {
            params: {
              page,
              pageSize: PAGE_SIZE,
            },
            signal,
          },
        );

        setViewData(res.data);
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem("session_token");
          navigate("/", { replace: true });
        } else if (!signal?.aborted) {
          setPageError(
            getErrorMessage(
              error,
              "We could not load moderation tools right now.",
            ),
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsViewLoading(false);
          setIsInitializing(false);
        }
      }
    },
    [navigate],
  );

  const reloadCurrentView = useCallback(
    async (signal?: AbortSignal) => {
      await loadView(activeView, pages[activeView], signal);
    },
    [activeView, loadView, pages],
  );

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const currentUser = await ensureAdmin(controller.signal);
        if (!currentUser || controller.signal.aborted) {
          return;
        }

        await loadView(activeView, currentPage, controller.signal);
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem("session_token");
          navigate("/", { replace: true });
        } else if (!controller.signal.aborted) {
          setPageError(
            getErrorMessage(
              error,
              "We could not load moderation tools right now.",
            ),
          );
          setIsInitializing(false);
          setIsViewLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [activeView, currentPage, ensureAdmin, loadView, navigate]);

  const runAction = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setPendingActionKey(key);
      try {
        await action();
      } finally {
        setPendingActionKey(null);
      }
    },
    [],
  );

  const handleConfirmAction = useCallback(async () => {
    if (!confirmRequest) {
      return;
    }

    setIsConfirming(true);
    try {
      await confirmRequest.action();
    } catch (error: unknown) {
      setFeedback({
        message: getErrorMessage(
          error,
          "The action failed. Try again in a moment.",
        ),
        severity: "error",
      });
    } finally {
      setIsConfirming(false);
      setConfirmRequest(null);
    }
  }, [confirmRequest]);

  const handleDeleteDomain = useCallback(
    (id: number) => {
      setConfirmRequest({
        title: "Remove domain?",
        message:
          "Remove this domain from the global routing list? This cannot be undone.",
        confirmLabel: "Remove",
        action: async () => {
          await runAction(`domain-delete-${id}`, async () => {
            await api.delete(`/admin/domains/${id}`);
            setTransientFeedback("Domain removed from the global list.");
            await reloadCurrentView();
          });
        },
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const handleToggleUserBan = useCallback(
    (userId: number, currentStatus: boolean) => {
      const actionLabel = currentStatus ? "unban" : "ban";

      setConfirmRequest({
        title: currentStatus ? "Restore account?" : "Ban account?",
        message: currentStatus
          ? "Restore this user account?"
          : "Ban this user account and keep them from using the platform?",
        confirmLabel: currentStatus ? "Unban user" : "Ban user",
        action: async () => {
          await runAction(`user-${userId}`, async () => {
            await api.post(`/admin/users/${userId}/ban`, {
              isBanned: !currentStatus,
            });
            setTransientFeedback(`User ${actionLabel} complete.`);
            await reloadCurrentView();
          });
        },
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const handleBanDomain = useCallback(
    (domain: string, reason: string, fromRow = false) => {
      const trimmedDomain = domain.trim().toLowerCase();
      const trimmedReason = reason.trim();

      if (!trimmedDomain) {
        setFeedback({
          message: "Enter a domain before saving the block.",
          severity: "error",
        });
        return;
      }

      setConfirmRequest({
        title: "Block domain",
        message: fromRow
          ? `Ban ${trimmedDomain} and remove it from the active routing list?`
          : `Ban ${trimmedDomain} so it cannot be registered again?`,
        confirmLabel: "Block domain",
        action: async () => {
          await runAction(`ban-domain-${trimmedDomain}`, async () => {
            await api.post("/admin/banned-domains", {
              domain: trimmedDomain,
              reason: trimmedReason,
            });
            setTransientFeedback("Domain blocked.");
            setDomainToBan("");
            setDomainReason("");
            await reloadCurrentView();
          });
        },
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const handleUnbanDomain = useCallback(
    (id: number) => {
      setConfirmRequest({
        title: "Remove block",
        message: "Remove this domain from the banned list?",
        confirmLabel: "Remove block",
        action: async () => {
          await runAction(`unban-domain-${id}`, async () => {
            await api.delete(`/admin/banned-domains/${id}`);
            setTransientFeedback("Domain unblocked.");
            await reloadCurrentView();
          });
        },
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const handleBanIp = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmedIp = ipToBan.trim();
      const trimmedReason = banReason.trim();

      if (trimmedIp.length < 3) {
        setFeedback({
          message: "Enter a longer IP address or hostname.",
          severity: "error",
        });
        return;
      }

      setConfirmRequest({
        title: "Block address",
        message: `Block ${trimmedIp} so it cannot reach the service across the platform?`,
        confirmLabel: "Block address",
        action: async () => {
          await runAction(`ban-ip-${trimmedIp}`, async () => {
            await api.post("/admin/ips/ban", {
              ip: trimmedIp,
              reason: trimmedReason,
            });
            setTransientFeedback("IP address blocked.");
            setIpToBan("");
            setBanReason("");
            await reloadCurrentView();
          });
        },
      });
    },
    [
      banReason,
      ipToBan,
      reloadCurrentView,
      runAction,
      setTransientFeedback,
    ],
  );

  const handleUnbanIp = useCallback(
    (id: number) => {
      setConfirmRequest({
        title: "Remove block",
        message: "Remove this IP or hostname from the blocked list?",
        confirmLabel: "Remove block",
        action: async () => {
          await runAction(`unban-ip-${id}`, async () => {
            await api.delete(`/admin/ips/${id}`);
            setTransientFeedback("Address unblocked.");
            await reloadCurrentView();
          });
        },
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  if (isInitializing) {
    return <LoadingScreen label="Loading moderation tools..." />;
  }

  const rows = viewData.items;

  return (
    <AppShell user={user}>
      <Box sx={{ mb: 4, maxWidth: 720 }}>
        <Chip
          label="Admin control"
          size="small"
          variant="outlined"
          color="primary"
          icon={<ShieldRounded />}
          sx={{ mb: 1.5 }}
        />
        <Typography variant="h1" component="h1">
          Moderation
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
          Move through domains, users, banned users, banned domains, and
          blocked IPs with dedicated paginated views instead of a single
          capped feed.
        </Typography>
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
                void reloadCurrentView();
              }}
            >
              Try again
            </Button>
          }
        >
          <Typography variant="subtitle2">
            Moderation unavailable
          </Typography>
          <Typography variant="body2" dir="auto">
            {pageError}
          </Typography>
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs
          value={activeView}
          onChange={(_event, value: AdminView) => setActiveView(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            px: 1,
            minWidth: 0,
          }}
        >
          {(Object.keys(viewMeta) as AdminView[]).map((view) => (
            <Tab
              key={view}
              value={view}
              icon={viewMeta[view].icon}
              iconPosition="start"
              label={viewMeta[view].title}
            />
          ))}
        </Tabs>

        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
            gap: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="textSecondary">
              {currentMeta.eyebrow}
            </Typography>
            <Typography variant="h4" component="h2">
              {currentMeta.title}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ maxWidth: 620, mt: 0.5 }}
            >
              {currentMeta.description}
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexShrink: 0, flexWrap: "wrap" }}
          >
            <Chip
              label={`${viewData.pagination.total} total entries`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`Page ${viewData.pagination.page} of ${viewData.pagination.totalPages}`}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Box>

        <Divider />

        {isViewLoading ? (
          <Box
            sx={{
              py: 6,
              px: 3,
              display: "grid",
              placeItems: "center",
              gap: 1.5,
            }}
            aria-live="polite"
          >
            <CircularProgress size={28} />
            <Typography variant="body2" color="textSecondary">
              Loading {currentMeta.title.toLowerCase()}...
            </Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, px: 3, textAlign: "center" }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                mx: "auto",
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: "primary.main",
              }}
            >
              <InboxRounded />
            </Box>
            <Typography variant="h6" sx={{ mt: 1.5 }}>
              {currentMeta.emptyTitle}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ maxWidth: 420, mx: "auto", mt: 0.5 }}
            >
              {currentMeta.emptyCopy}
            </Typography>
          </Box>
        ) : activeView === "domains" ? (
          <DomainsTable
            domains={rows as Domain[]}
            pendingActionKey={pendingActionKey}
            onDeleteDomain={handleDeleteDomain}
            onBanDomain={(domain) =>
              handleBanDomain(domain, "", true)
            }
            onToggleUserBan={handleToggleUserBan}
          />
        ) : activeView === "users" ||
          activeView === "banned-users" ? (
          <UsersTable
            users={rows as AdminUserRow[]}
            pendingActionKey={pendingActionKey}
            onToggleUserBan={handleToggleUserBan}
          />
        ) : activeView === "banned-domains" ? (
          <BannedDomainsTable
            domains={rows as BannedDomain[]}
            pendingActionKey={pendingActionKey}
            onUnbanDomain={handleUnbanDomain}
          />
        ) : (
          <BannedIpsTable
            ips={rows as BannedIp[]}
            pendingActionKey={pendingActionKey}
            onUnbanIp={handleUnbanIp}
          />
        )}

        {!isViewLoading && rows.length > 0 ? <Divider /> : null}

        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Typography variant="body2" color="textSecondary">
            Showing up to {viewData.pagination.pageSize} items per page ·{" "}
            {viewData.pagination.total} total entries
          </Typography>
          <Pagination
            count={Math.max(1, viewData.pagination.totalPages)}
            page={viewData.pagination.page}
            onChange={(_event, page) =>
              setPages((prev) => ({ ...prev, [activeView]: page }))
            }
            disabled={isViewLoading}
          />
        </Box>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2.5,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Domain control
            </Typography>
            <Typography variant="h4" component="h2">
              Block a domain
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ mt: 0.5, mb: 2.5 }}
            >
              Prevent a route from being registered again, even if it is not
              in the active domains list right now.
            </Typography>

            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                handleBanDomain(domainToBan, domainReason);
              }}
              sx={{ display: "grid", gap: 2 }}
            >
              <TextField
                label="Full domain"
                required
                fullWidth
                value={domainToBan}
                onChange={(event) => setDomainToBan(event.target.value)}
                placeholder="app.example.com"
                helperText="Example: app.example.com"
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
                label="Reason"
                fullWidth
                value={domainReason}
                onChange={(event) => setDomainReason(event.target.value)}
                placeholder="Malware, abuse, or impersonation"
                helperText="Optional context for future moderation reviews."
                slotProps={{
                  htmlInput: {
                    maxLength: 160,
                    dir: "auto",
                  },
                }}
              />

              <Button
                type="submit"
                color="error"
                variant="contained"
                disabled={
                  pendingActionKey ===
                    `ban-domain-${domainToBan.trim().toLowerCase()}` ||
                  !domainToBan.trim()
                }
                startIcon={
                  pendingActionKey ===
                  `ban-domain-${domainToBan.trim().toLowerCase()}` ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <BlockRounded />
                  )
                }
                sx={{ justifySelf: "start" }}
              >
                Block domain
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Network control
            </Typography>
            <Typography variant="h4" component="h2">
              Block an IP or hostname
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ mt: 0.5, mb: 2.5 }}
            >
              Use this when a source should stop reaching the service across
              the platform.
            </Typography>

            <Box
              component="form"
              onSubmit={handleBanIp}
              sx={{ display: "grid", gap: 2 }}
            >
              <TextField
                label="IP address or hostname"
                required
                fullWidth
                value={ipToBan}
                onChange={(event) => setIpToBan(event.target.value)}
                placeholder="192.168.1.100"
                helperText="Example: 192.168.1.100 or abusive-host.example"
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
                label="Reason"
                fullWidth
                value={banReason}
                onChange={(event) => setBanReason(event.target.value)}
                placeholder="Phishing or repeated abuse"
                helperText="Optional context for future moderation reviews."
                slotProps={{
                  htmlInput: {
                    maxLength: 160,
                    dir: "auto",
                  },
                }}
              />

              <Button
                type="submit"
                color="error"
                variant="contained"
                disabled={
                  pendingActionKey === `ban-ip-${ipToBan.trim()}` ||
                  !ipToBan.trim()
                }
                startIcon={
                  pendingActionKey === `ban-ip-${ipToBan.trim()}` ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <BlockRounded />
                  )
                }
                sx={{ justifySelf: "start" }}
              >
                Block address
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <ConfirmDialog
        open={confirmRequest !== null}
        title={confirmRequest?.title ?? ""}
        message={confirmRequest?.message ?? ""}
        confirmLabel={confirmRequest?.confirmLabel ?? "Confirm"}
        loading={isConfirming}
        onConfirm={() => {
          void handleConfirmAction();
        }}
        onClose={() => setConfirmRequest(null)}
      />

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

function ActionButton({
  pending,
  color = "primary",
  variant = "outlined",
  startIcon,
  children,
  onClick,
  disabled = false,
}: {
  pending?: boolean;
  color?:
    | "primary"
    | "secondary"
    | "error"
    | "success"
    | "info"
    | "warning"
    | "inherit";
  variant?: "outlined" | "text" | "contained";
  startIcon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      size="small"
      color={color}
      variant={variant}
      onClick={onClick}
      disabled={disabled || pending}
      startIcon={
        pending ? (
          <CircularProgress size={14} color="inherit" />
        ) : (
          startIcon
        )
      }
    >
      {children}
    </Button>
  );
}

function DomainsTable({
  domains,
  pendingActionKey,
  onDeleteDomain,
  onBanDomain,
  onToggleUserBan,
}: {
  domains: Domain[];
  pendingActionKey: string | null;
  onDeleteDomain: (id: number) => void;
  onBanDomain: (domain: string) => void;
  onToggleUserBan: (
    userId: number,
    currentStatus: boolean,
  ) => void;
}) {
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 720 }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Registered domains and moderation actions.
        </caption>
        <TableHead>
          <TableRow>
            <TableCell>Domain</TableCell>
            <TableCell>Target</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {domains.map((domain) => {
            const userId = domain.user?.id;
            const isUserBanned = domain.user?.isBanned ?? false;

            return (
              <TableRow key={domain.id}>
                <TableCell>
                  <Typography
                    dir="auto"
                    sx={{
                      fontFamily: FONT_MONO,
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {domain.subdomain}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    dir="auto"
                    sx={{
                      fontFamily: FONT_MONO,
                      fontSize: "0.85rem",
                      color: "text.secondary",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {domain.hostname}:{domain.port}
                  </Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 160 }}>
                  <Typography
                    dir="auto"
                    sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
                  >
                    {domain.user?.name || "Unknown user"}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    dir="auto"
                    sx={{ display: "block", overflowWrap: "anywhere" }}
                  >
                    {domain.user?.email || "No email"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="textSecondary">
                    {domain.createdAt ? formatDate(domain.createdAt) : "-"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ flexWrap: "wrap" }}
                  >
                    <ActionButton
                      pending={
                        userId != null &&
                        pendingActionKey === `user-${userId}`
                      }
                      color={isUserBanned ? "success" : "error"}
                      startIcon={
                        isUserBanned ? (
                          <CheckCircleRounded fontSize="small" />
                        ) : (
                          <BlockRounded fontSize="small" />
                        )
                      }
                      disabled={userId == null}
                      onClick={() => {
                        if (userId != null) {
                          onToggleUserBan(userId, isUserBanned);
                        }
                      }}
                    >
                      {isUserBanned ? "Unban user" : "Ban user"}
                    </ActionButton>

                    <ActionButton
                      pending={
                        pendingActionKey ===
                        `ban-domain-${domain.subdomain}`
                      }
                      color="error"
                      startIcon={
                        <PublicOffRounded fontSize="small" />
                      }
                      onClick={() => onBanDomain(domain.subdomain)}
                    >
                      Ban domain
                    </ActionButton>

                    <ActionButton
                      pending={
                        pendingActionKey ===
                        `domain-delete-${domain.id}`
                      }
                      variant="text"
                      startIcon={
                        <DeleteOutlineRounded fontSize="small" />
                      }
                      onClick={() => onDeleteDomain(domain.id)}
                    >
                      Remove
                    </ActionButton>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function UsersTable({
  users,
  pendingActionKey,
  onToggleUserBan,
}: {
  users: AdminUserRow[];
  pendingActionKey: string | null;
  onToggleUserBan: (
    userId: number,
    currentStatus: boolean,
  ) => void;
}) {
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 680 }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Users and moderation actions.
        </caption>
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>GitHub ID</TableCell>
            <TableCell>Domains</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell sx={{ minWidth: 180 }}>
                <Typography
                  dir="auto"
                  sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
                >
                  {entry.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  dir="auto"
                  sx={{ display: "block", overflowWrap: "anywhere" }}
                >
                  {entry.email}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  sx={{ fontFamily: FONT_MONO, fontSize: "0.9rem" }}
                >
                  {entry.githubId}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography sx={{ fontWeight: 600 }}>
                  {entry.domainCount}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={entry.isBanned ? "Banned" : "Active"}
                  color={entry.isBanned ? "error" : "success"}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <ActionButton
                  pending={pendingActionKey === `user-${entry.id}`}
                  color={entry.isBanned ? "success" : "error"}
                  startIcon={
                    entry.isBanned ? (
                      <CheckCircleRounded fontSize="small" />
                    ) : (
                      <BlockRounded fontSize="small" />
                    )
                  }
                  onClick={() =>
                    onToggleUserBan(entry.id, entry.isBanned)
                  }
                >
                  {entry.isBanned ? "Unban user" : "Ban user"}
                </ActionButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function BannedDomainsTable({
  domains,
  pendingActionKey,
  onUnbanDomain,
}: {
  domains: BannedDomain[];
  pendingActionKey: string | null;
  onUnbanDomain: (id: number) => void;
}) {
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 640 }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Blocked domains and unban actions.
        </caption>
        <TableHead>
          <TableRow>
            <TableCell>Domain</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {domains.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <Typography
                  dir="auto"
                  sx={{
                    fontFamily: FONT_MONO,
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    overflowWrap: "anywhere",
                  }}
                >
                  {entry.domain}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  dir="auto"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {entry.reason || "No reason recorded"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="textSecondary">
                  {formatDate(entry.createdAt)}
                </Typography>
              </TableCell>
              <TableCell>
                <ActionButton
                  pending={
                    pendingActionKey === `unban-domain-${entry.id}`
                  }
                  startIcon={
                    <CheckCircleRounded fontSize="small" />
                  }
                  onClick={() => onUnbanDomain(entry.id)}
                >
                  Remove block
                </ActionButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function BannedIpsTable({
  ips,
  pendingActionKey,
  onUnbanIp,
}: {
  ips: BannedIp[];
  pendingActionKey: string | null;
  onUnbanIp: (id: number) => void;
}) {
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 640 }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Blocked IP addresses and hostnames.
        </caption>
        <TableHead>
          <TableRow>
            <TableCell>Address</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ips.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <Typography
                  dir="auto"
                  sx={{
                    fontFamily: FONT_MONO,
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    overflowWrap: "anywhere",
                  }}
                >
                  {entry.ip}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  dir="auto"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {entry.reason || "No reason recorded"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="textSecondary">
                  {formatDate(entry.createdAt)}
                </Typography>
              </TableCell>
              <TableCell>
                <ActionButton
                  pending={pendingActionKey === `unban-ip-${entry.id}`}
                  startIcon={
                    <CheckCircleRounded fontSize="small" />
                  }
                  onClick={() => onUnbanIp(entry.id)}
                >
                  Remove block
                </ActionButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
