import {
  AlertCircle,
  Ban,
  Globe,
  Loader2,
  ServerOff,
  ShieldAlert,
  ShieldOff,
  Trash2,
  Users,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
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

type AdminView =
  | "domains"
  | "users"
  | "banned-users"
  | "banned-domains"
  | "banned-ips";

type AdminItem = Domain | AdminUserRow | BannedDomain | BannedIp;

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
    icon: typeof Globe;
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
    icon: Globe,
  },
  users: {
    title: "Users",
    eyebrow: "Account inventory",
    description:
      "Browse every account, see how many domains each user owns, and react quickly when someone needs moderation.",
    emptyTitle: "No users yet",
    emptyCopy: "User accounts will appear here after the first login.",
    endpoint: "/admin/users",
    icon: Users,
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
    icon: Ban,
  },
  "banned-domains": {
    title: "Banned domains",
    eyebrow: "Blocked routes",
    description:
      "Track domains that can no longer be registered and reverse the block when the incident is resolved.",
    emptyTitle: "No banned domains",
    emptyCopy: "Blocked domains will appear here after you ban them.",
    endpoint: "/admin/banned-domains",
    icon: ShieldAlert,
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
    icon: ServerOff,
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
  const [feedback, setFeedback] = useState("");
  const [domainToBan, setDomainToBan] = useState("");
  const [domainReason, setDomainReason] = useState("");
  const [ipToBan, setIpToBan] = useState("");
  const [banReason, setBanReason] = useState("");
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(
    null,
  );
  const feedbackTimeoutRef = useRef<number | null>(null);

  const currentPage = pages[activeView];
  const currentMeta = viewMeta[activeView];

  const setTransientFeedback = useCallback((message: string) => {
    setFeedback(message);
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback("");
      feedbackTimeoutRef.current = null;
    }, 4000);
  }, []);

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
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
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

  const handleDeleteDomain = useCallback(
    async (id: number) => {
      if (
        !window.confirm("Remove this domain from the global routing list?")
      ) {
        return;
      }

      await runAction(`domain-delete-${id}`, async () => {
        await api.delete(`/admin/domains/${id}`);
        setTransientFeedback("Domain removed from the global list.");
        await reloadCurrentView();
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const handleToggleUserBan = useCallback(
    async (userId: number, currentStatus: boolean) => {
      const actionLabel = currentStatus ? "unban" : "ban";
      if (
        !window.confirm(
          currentStatus
            ? "Restore this user account?"
            : "Ban this user account and keep them from using the platform?",
        )
      ) {
        return;
      }

      await runAction(`user-${userId}`, async () => {
        await api.post(`/admin/users/${userId}/ban`, {
          isBanned: !currentStatus,
        });
        setTransientFeedback(`User ${actionLabel} complete.`);
        await reloadCurrentView();
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const handleBanDomain = useCallback(
    async (domain: string, reason: string, fromRow = false) => {
      const trimmedDomain = domain.trim().toLowerCase();
      const trimmedReason = reason.trim();

      if (!trimmedDomain) {
        setFeedback("Enter a domain before saving the block.");
        return;
      }

      if (
        !window.confirm(
          fromRow
            ? `Ban ${trimmedDomain} and remove it from the active routing list?`
            : `Ban ${trimmedDomain} so it cannot be registered again?`,
        )
      ) {
        return;
      }

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
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const handleUnbanDomain = useCallback(
    async (id: number) => {
      if (!window.confirm("Remove this domain from the banned list?")) {
        return;
      }

      await runAction(`unban-domain-${id}`, async () => {
        await api.delete(`/admin/banned-domains/${id}`);
        setTransientFeedback("Domain unblocked.");
        await reloadCurrentView();
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const handleBanIp = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmedIp = ipToBan.trim();
      const trimmedReason = banReason.trim();

      if (trimmedIp.length < 3) {
        setFeedback("Enter a longer IP address or hostname.");
        return;
      }

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
    [
      banReason,
      ipToBan,
      reloadCurrentView,
      runAction,
      setTransientFeedback,
    ],
  );

  const handleUnbanIp = useCallback(
    async (id: number) => {
      if (
        !window.confirm(
          "Remove this IP or hostname from the blocked list?",
        )
      ) {
        return;
      }

      await runAction(`unban-ip-${id}`, async () => {
        await api.delete(`/admin/ips/${id}`);
        setTransientFeedback("Address unblocked.");
        await reloadCurrentView();
      });
    },
    [reloadCurrentView, runAction, setTransientFeedback],
  );

  const rows = useMemo(() => viewData.items, [viewData.items]);

  if (isInitializing) {
    return (
      <div className="loading-screen" aria-live="polite" aria-busy="true">
        <div className="loading-stack">
          <div className="spinner" aria-hidden="true" />
          <p>Loading moderation tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar user={user} />

      <main className="app-main stack-lg">
        <header className="page-header surface-enter moderation-header">
          <div className="eyebrow">
            <ShieldAlert className="w-4 h-4" /> Admin control
          </div>
          <h1 className="page-title page-title--compact">Moderation</h1>
          <p className="page-copy">
            Move through domains, users, banned users, banned domains, and
            blocked IPs with dedicated paginated views instead of a single
            capped feed.
          </p>
        </header>

        {pageError ? (
          <section className="panel surface-enter">
            <div
              className="status-banner status-banner--danger"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="stack-sm">
                <strong>Moderation unavailable</strong>
                <span>{pageError}</span>
              </div>
            </div>
            <div className="panel-actions mt-6">
              <button
                type="button"
                onClick={() => {
                  void reloadCurrentView();
                }}
                className="button button-secondary"
              >
                Try again
              </button>
            </div>
          </section>
        ) : null}

        {feedback ? (
          <div className="status-banner" role="status" aria-live="polite">
            <span>{feedback}</span>
          </div>
        ) : null}

        <section className="panel surface-enter moderation-queue-panel">
          <div className="panel__header">
            <p className="eyebrow">Moderation queues</p>
            <h2 className="panel__title">Choose a paginated view</h2>
            <p className="panel__copy">
              Each queue loads its own page so large installations stay
              responsive.
            </p>
          </div>

          <div className="admin-view-grid">
            {(Object.keys(viewMeta) as AdminView[]).map((view) => {
              const Icon = viewMeta[view].icon;
              const isActive = activeView === view;

              return (
                <button
                  key={view}
                  type="button"
                  className={`button admin-view-button ${isActive ? "button-secondary admin-view-button--active" : "button-ghost"}`}
                  onClick={() => setActiveView(view)}
                >
                  <span className="admin-view-button__title">
                    <Icon className="w-4 h-4" /> {viewMeta[view].title}
                  </span>
                  <span className="admin-view-button__copy">
                    {viewMeta[view].eyebrow}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="field-grid field-grid--two surface-enter">
          <div className="stack-lg">
            <div className="table-shell">
              <div className="table-toolbar">
                <div>
                  <p className="eyebrow">{currentMeta.eyebrow}</p>
                  <h2 className="panel__title">{currentMeta.title}</h2>
                  <p className="panel__copy">{currentMeta.description}</p>
                </div>
                <div className="table-toolbar__meta">
                  <span className="tag">
                    {viewData.pagination.total} total entries
                  </span>
                  <span className="tag">
                    Page {viewData.pagination.page} of{" "}
                    {viewData.pagination.totalPages}
                  </span>
                </div>
              </div>

              <div className="table-scroll">
                {isViewLoading ? (
                  <div className="empty-panel">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <h3 className="empty-panel__title">
                      Loading {currentMeta.title.toLowerCase()}...
                    </h3>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="empty-panel">
                    <h3 className="empty-panel__title">
                      {currentMeta.emptyTitle}
                    </h3>
                    <p className="empty-panel__copy">
                      {currentMeta.emptyCopy}
                    </p>
                  </div>
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
              </div>

              <PaginationControls
                pagination={viewData.pagination}
                isLoading={isViewLoading}
                onPageChange={(page) => {
                  setPages((prev) => ({
                    ...prev,
                    [activeView]: page,
                  }));
                }}
              />
            </div>
          </div>

          <aside className="admin-side-panel">
            <section className="panel panel--soft moderation-side-panel moderation-side-panel--domain">
              <div className="panel__header">
                <p className="eyebrow">
                  <ShieldAlert className="w-4 h-4" /> Domain control
                </p>
                <h2 className="panel__title">Block a domain</h2>
                <p className="panel__copy">
                  Prevent a route from being registered again, even if it
                  is not in the active domains list right now.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleBanDomain(domainToBan, domainReason);
                }}
                className="field-grid"
              >
                <div className="field">
                  <label htmlFor="domainInput" className="field-label">
                    Full domain
                  </label>
                  <span className="field-hint">
                    Example: app.example.com
                  </span>
                  <input
                    id="domainInput"
                    type="text"
                    required
                    maxLength={255}
                    value={domainToBan}
                    onChange={(e) => setDomainToBan(e.target.value)}
                    placeholder="app.example.com"
                    className="text-field"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    dir="auto"
                  />
                </div>

                <div className="field">
                  <label
                    htmlFor="domainReasonInput"
                    className="field-label"
                  >
                    Reason
                  </label>
                  <span className="field-hint">
                    Optional context for future moderation reviews.
                  </span>
                  <input
                    id="domainReasonInput"
                    type="text"
                    maxLength={160}
                    value={domainReason}
                    onChange={(e) => setDomainReason(e.target.value)}
                    placeholder="Malware, abuse, or impersonation"
                    className="text-field"
                    dir="auto"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    pendingActionKey ===
                      `ban-domain-${domainToBan.trim().toLowerCase()}` ||
                    !domainToBan.trim()
                  }
                  className="button button-danger"
                >
                  {pendingActionKey ===
                  `ban-domain-${domainToBan.trim().toLowerCase()}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Block domain
                </button>
              </form>
            </section>

            <section className="panel panel--soft moderation-side-panel moderation-side-panel--network">
              <div className="panel__header">
                <p className="eyebrow">
                  <ServerOff className="w-4 h-4" /> Network control
                </p>
                <h2 className="panel__title">Block an IP or hostname</h2>
                <p className="panel__copy">
                  Use this when a source should stop reaching the service
                  across the platform.
                </p>
              </div>

              <form onSubmit={handleBanIp} className="field-grid">
                <div className="field">
                  <label htmlFor="ipInput" className="field-label">
                    IP address or hostname
                  </label>
                  <span className="field-hint">
                    Example: 192.168.1.100 or abusive-host.example
                  </span>
                  <input
                    id="ipInput"
                    type="text"
                    required
                    maxLength={255}
                    value={ipToBan}
                    onChange={(e) => setIpToBan(e.target.value)}
                    placeholder="192.168.1.100"
                    className="text-field"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    dir="auto"
                  />
                </div>

                <div className="field">
                  <label htmlFor="reasonInput" className="field-label">
                    Reason
                  </label>
                  <span className="field-hint">
                    Optional context for future moderation reviews.
                  </span>
                  <input
                    id="reasonInput"
                    type="text"
                    maxLength={160}
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Phishing or repeated abuse"
                    className="text-field"
                    dir="auto"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    pendingActionKey === `ban-ip-${ipToBan.trim()}` ||
                    !ipToBan.trim()
                  }
                  className="button button-danger"
                >
                  {pendingActionKey === `ban-ip-${ipToBan.trim()}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Block address
                </button>
              </form>
            </section>
          </aside>
        </section>
      </main>
    </div>
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
  onDeleteDomain: (id: number) => Promise<void>;
  onBanDomain: (domain: string) => Promise<void>;
  onToggleUserBan: (
    userId: number,
    currentStatus: boolean,
  ) => Promise<void>;
}) {
  return (
    <table className="data-table">
      <caption className="sr-only">
        Registered domains and moderation actions.
      </caption>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Target</th>
          <th>User</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {domains.map((domain) => {
          const userId = domain.user?.id;
          const isUserBanned = domain.user?.isBanned ?? false;

          return (
            <tr key={domain.id}>
              <td>
                <strong className="text-wrap-anywhere" dir="auto">
                  {domain.subdomain}
                </strong>
              </td>
              <td className="text-wrap-anywhere" dir="auto">
                {domain.hostname}:{domain.port}
              </td>
              <td className="text-wrap-anywhere" dir="auto">
                <strong>{domain.user?.name || "Unknown user"}</strong>
                <div className="table-note">
                  {domain.user?.email || "No email"}
                </div>
              </td>
              <td>
                {domain.createdAt ? formatDate(domain.createdAt) : "-"}
              </td>
              <td>
                <div className="nav-actions">
                  <button
                    type="button"
                    onClick={() => {
                      if (userId != null) {
                        void onToggleUserBan(userId, isUserBanned);
                      }
                    }}
                    className={`button ${isUserBanned ? "button-secondary" : "button-ghost"}`}
                    disabled={
                      userId == null ||
                      pendingActionKey === `user-${userId}`
                    }
                  >
                    {pendingActionKey === `user-${userId}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Ban className="w-4 h-4" />
                    )}
                    {isUserBanned ? "Unban user" : "Ban user"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onBanDomain(domain.subdomain)}
                    className="button button-danger"
                    disabled={
                      pendingActionKey === `ban-domain-${domain.subdomain}`
                    }
                  >
                    {pendingActionKey ===
                    `ban-domain-${domain.subdomain}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" />
                    )}
                    Ban domain
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteDomain(domain.id)}
                    className="button button-secondary"
                    disabled={
                      pendingActionKey === `domain-delete-${domain.id}`
                    }
                  >
                    {pendingActionKey === `domain-delete-${domain.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
  ) => Promise<void>;
}) {
  return (
    <table className="data-table">
      <caption className="sr-only">Users and moderation actions.</caption>
      <thead>
        <tr>
          <th>User</th>
          <th>GitHub ID</th>
          <th>Domains</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((entry) => (
          <tr key={entry.id}>
            <td className="text-wrap-anywhere" dir="auto">
              <strong>{entry.name}</strong>
              <div className="table-note">{entry.email}</div>
            </td>
            <td>{entry.githubId}</td>
            <td>{entry.domainCount}</td>
            <td>
              <span
                className={`tag ${entry.isBanned ? "tag--danger" : "tag--success"}`}
              >
                {entry.isBanned ? "Banned" : "Active"}
              </span>
            </td>
            <td>
              <button
                type="button"
                onClick={() =>
                  void onToggleUserBan(entry.id, entry.isBanned)
                }
                className={
                  entry.isBanned
                    ? "button button-secondary"
                    : "button button-danger"
                }
                disabled={pendingActionKey === `user-${entry.id}`}
              >
                {pendingActionKey === `user-${entry.id}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : entry.isBanned ? (
                  <ShieldOff className="w-4 h-4" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                {entry.isBanned ? "Unban user" : "Ban user"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BannedDomainsTable({
  domains,
  pendingActionKey,
  onUnbanDomain,
}: {
  domains: BannedDomain[];
  pendingActionKey: string | null;
  onUnbanDomain: (id: number) => Promise<void>;
}) {
  return (
    <table className="data-table">
      <caption className="sr-only">
        Blocked domains and unban actions.
      </caption>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Reason</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {domains.map((entry) => (
          <tr key={entry.id}>
            <td className="text-wrap-anywhere" dir="auto">
              <strong className="text-highlight text-highlight--warm">
                {entry.domain}
              </strong>
            </td>
            <td className="text-wrap-anywhere" dir="auto">
              {entry.reason || "No reason recorded"}
            </td>
            <td>{formatDate(entry.createdAt)}</td>
            <td>
              <button
                type="button"
                onClick={() => void onUnbanDomain(entry.id)}
                className="button button-secondary"
                disabled={pendingActionKey === `unban-domain-${entry.id}`}
              >
                {pendingActionKey === `unban-domain-${entry.id}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldOff className="w-4 h-4" />
                )}
                Remove block
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BannedIpsTable({
  ips,
  pendingActionKey,
  onUnbanIp,
}: {
  ips: BannedIp[];
  pendingActionKey: string | null;
  onUnbanIp: (id: number) => Promise<void>;
}) {
  return (
    <table className="data-table">
      <caption className="sr-only">
        Blocked IP addresses and hostnames.
      </caption>
      <thead>
        <tr>
          <th>Address</th>
          <th>Reason</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {ips.map((entry) => (
          <tr key={entry.id}>
            <td className="text-wrap-anywhere" dir="auto">
              <strong className="text-highlight">{entry.ip}</strong>
            </td>
            <td className="text-wrap-anywhere" dir="auto">
              {entry.reason || "No reason recorded"}
            </td>
            <td>{formatDate(entry.createdAt)}</td>
            <td>
              <button
                type="button"
                onClick={() => void onUnbanIp(entry.id)}
                className="button button-secondary"
                disabled={pendingActionKey === `unban-ip-${entry.id}`}
              >
                {pendingActionKey === `unban-ip-${entry.id}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldOff className="w-4 h-4" />
                )}
                Remove block
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaginationControls({
  pagination,
  isLoading,
  onPageChange,
}: {
  pagination: PaginationMeta;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="pagination-bar">
      <div className="pagination-summary">
        Showing up to {pagination.pageSize} items per page.
      </div>
      <div className="panel-actions">
        <button
          type="button"
          className="button button-ghost"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          disabled={!pagination.hasPrevious || isLoading}
        >
          Previous
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={!pagination.hasNext || isLoading}
        >
          Next
        </button>
      </div>
    </div>
  );
}
