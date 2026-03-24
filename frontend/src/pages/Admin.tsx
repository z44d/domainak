import {
  AlertCircle,
  Ban,
  Loader2,
  ServerOff,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import type { Domain, User } from "../lib/types";
import { getErrorMessage } from "../lib/utils";

export default function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ipToBan, setIpToBan] = useState("");
  const [banReason, setBanReason] = useState("");
  const [isBanningIp, setIsBanningIp] = useState(false);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pendingDomainId, setPendingDomainId] = useState<number | null>(
    null,
  );
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

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

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setPageError("");
        const { data: userData } = await api.get("/auth/me", { signal });
        if (!userData.isAdmin) {
          navigate("/dashboard", { replace: true });
          return;
        }

        setUser(userData);
        const res = await api.get("/admin/domains", { signal });
        setDomains(res.data.domains);
      } catch (error: unknown) {
        if (
          (error as { response?: { status: number } })?.response
            ?.status === 401
        ) {
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
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [fetchData]);

  const handleDeleteDomain = async (id: number) => {
    setPendingDomainId(id);
    try {
      await api.delete(`/admin/domains/${id}`);
      setDomains(domains.filter((domain) => domain.id !== id));
      setTransientFeedback("Domain removed from the global list.");
    } catch (error: unknown) {
      setFeedback(
        getErrorMessage(error, "We could not remove that domain."),
      );
    } finally {
      setPendingDomainId(null);
    }
  };

  const handleToggleUserBan = async (
    userId: number,
    currentStatus: boolean,
  ) => {
    const action = currentStatus ? "unban" : "ban";

    setPendingUserId(userId);
    try {
      await api.post(`/admin/users/${userId}/ban`, {
        isBanned: !currentStatus,
      });
      setTransientFeedback(`User ${action} complete.`);
      fetchData();
    } catch (error: unknown) {
      setFeedback(
        getErrorMessage(error, `We could not ${action} that user.`),
      );
    } finally {
      setPendingUserId(null);
    }
  };

  const handleBanIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipToBan) return;

    const trimmedIp = ipToBan.trim();
    const trimmedReason = banReason.trim();

    if (trimmedIp.length < 3) {
      setFeedback("Enter a longer IP address or hostname.");
      return;
    }

    setIsBanningIp(true);
    try {
      await api.post("/admin/ips/ban", {
        ip: trimmedIp,
        reason: trimmedReason,
      });
      setTransientFeedback("IP address blocked.");
      setIpToBan("");
      setBanReason("");
    } catch (error: unknown) {
      setFeedback(
        getErrorMessage(error, "We could not block that address."),
      );
    } finally {
      setIsBanningIp(false);
    }
  };

  if (isLoading) {
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
        <header className="page-header surface-enter">
          <div className="eyebrow">
            <ShieldAlert className="w-4 h-4" /> Admin control
          </div>
          <h1 className="page-title page-title--compact">Moderation</h1>
          <p className="page-copy">
            Review recent domains, remove routes that should not stay live,
            and block abusive addresses with the same calm control surface
            used in the rest of the product.
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
                  setIsLoading(true);
                  fetchData();
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

        {!pageError ? (
          <section className="field-grid field-grid--two surface-enter">
            <div className="stack-lg">
              <div className="panel__header">
                <p className="eyebrow">Recent domains</p>
                <h2 className="panel__title">Latest registrations</h2>
                <p className="panel__copy">
                  The list stays dense but readable, with only the actions
                  that matter in moderation moments.
                </p>
              </div>

              <div className="table-shell">
                <div className="table-scroll">
                  <table className="data-table">
                    <caption className="sr-only">
                      Recently registered domains and moderation actions.
                    </caption>
                    <thead>
                      <tr>
                        <th>Subdomain</th>
                        <th>Target</th>
                        <th>User</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domains.map((domain) => (
                        <tr key={domain.id}>
                          <td>
                            <strong
                              className="text-wrap-anywhere"
                              dir="auto"
                            >
                              {domain.subdomain}
                            </strong>
                          </td>
                          <td className="text-wrap-anywhere" dir="auto">
                            {domain.hostname}:{domain.port}
                          </td>
                          <td
                            title={domain.user?.email}
                            className="text-wrap-anywhere"
                            dir="auto"
                          >
                            {domain.user?.name}
                          </td>
                          <td>
                            <AdminRowActions
                              domain={domain}
                              onBanUser={handleToggleUserBan}
                              onDeleteDomain={handleDeleteDomain}
                              isDeleting={pendingDomainId === domain.id}
                              isUpdatingUser={
                                pendingUserId === domain.user?.id
                              }
                            />
                          </td>
                        </tr>
                      ))}
                      {domains.length === 0 && (
                        <tr>
                          <td colSpan={4}>
                            <div className="empty-panel">
                              <h3 className="empty-panel__title">
                                No domains to review
                              </h3>
                              <p className="empty-panel__copy">
                                New registrations will appear here when
                                they are created.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="panel panel--soft">
              <div className="panel__header">
                <p className="eyebrow">
                  <ServerOff className="w-4 h-4" /> Network control
                </p>
                <h2 className="panel__title">Block an IP or hostname</h2>
                <p className="panel__copy">
                  Use this when a source should stop reaching the service
                  across the entire platform.
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
                  disabled={isBanningIp || !ipToBan}
                  className="button button-danger"
                >
                  {isBanningIp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Block address
                </button>
              </form>
            </aside>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function AdminRowActions({
  domain,
  onBanUser,
  onDeleteDomain,
  isDeleting,
  isUpdatingUser,
}: {
  domain: Domain;
  onBanUser: (userId: number, currentStatus: boolean) => Promise<void>;
  onDeleteDomain: (id: number) => Promise<void>;
  isDeleting: boolean;
  isUpdatingUser: boolean;
}) {
  const [confirming, setConfirming] = useState<"user" | "domain" | null>(
    null,
  );

  return confirming === null ? (
    <div className="nav-actions">
      <button
        type="button"
        onClick={() => {
          if (domain.user?.id != null) {
            setConfirming("user");
          }
        }}
        className="button button-ghost"
        disabled={domain.user?.id == null || isDeleting || isUpdatingUser}
      >
        <Ban className="w-4 h-4" /> Ban user
      </button>
      <button
        type="button"
        onClick={() => setConfirming("domain")}
        className="button button-danger"
        disabled={isDeleting || isUpdatingUser}
      >
        <Trash2 className="w-4 h-4" /> Remove
      </button>
    </div>
  ) : (
    <div
      className="confirm-actions"
      role="group"
      aria-label="Confirm moderation action"
    >
      {confirming === "user" ? (
        <button
          type="button"
          onClick={async () => {
            if (domain.user?.id != null) {
              await onBanUser(domain.user.id, false);
              setConfirming(null);
            }
          }}
          className="button button-danger"
          disabled={isUpdatingUser || isDeleting}
        >
          {isUpdatingUser ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Ban className="w-4 h-4" />
          )}
          Confirm ban
        </button>
      ) : (
        <button
          type="button"
          onClick={async () => {
            await onDeleteDomain(domain.id);
            setConfirming(null);
          }}
          className="button button-danger"
          disabled={isDeleting || isUpdatingUser}
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Confirm remove
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirming(null)}
        className="button button-ghost"
        disabled={isDeleting || isUpdatingUser}
      >
        Cancel
      </button>
    </div>
  );
}
