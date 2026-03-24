import {
  Activity,
  AlertCircle,
  Calendar,
  Globe,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import type { Domain, Stats, User } from "../lib/types";
import { formatNumber, getErrorMessage } from "../lib/utils";

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
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
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
        setUser(userData);

        const [domainsRes, availableRes] = await Promise.all([
          api.get("/domains", { signal }),
          api.get("/domains/available", { signal }),
        ]);

        setDomains(domainsRes.data.domains);
        setAvailableDomains(availableRes.data.available);
        if (availableRes.data.available.length > 0) {
          setFormData((prev) => ({
            ...prev,
            domain: availableRes.data.available[0],
          }));
        }
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
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [fetchData]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setFeedback("");

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

    if (Number.isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
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
      fetchData();
    } catch (error: unknown) {
      setAddError(
        getErrorMessage(error, "We could not register that domain yet."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setFeedback("");
    setDeletingId(id);
    try {
      await api.delete(`/domains/${id}`);
      setDomains(domains.filter((domain) => domain.id !== id));
      setTransientFeedback("Domain removed from your workspace.");
    } catch (error: unknown) {
      setFeedback(
        getErrorMessage(error, "We could not remove that domain."),
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-screen" aria-live="polite" aria-busy="true">
        <div className="loading-stack">
          <div className="spinner" aria-hidden="true" />
          <p>Loading your domains...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar user={user} />

      <main className="app-main stack-lg">
        <header className="page-header page-header--split surface-enter">
          <div>
            <div className="eyebrow">Workspace</div>
            <h1 className="page-title page-title--compact">Domains</h1>
            <p className="page-copy">
              Register a destination, review traffic only when you need it,
              and keep the day-to-day workspace focused on routing
              decisions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((current) => !current)}
            className="button button-primary"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? "Hide form" : "New domain"}
          </button>
        </header>

        {pageError ? (
          <section className="panel surface-enter">
            <div
              className="status-banner status-banner--danger"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="stack-sm">
                <strong>Workspace unavailable</strong>
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

        {!pageError && showAddForm && (
          <section className="panel panel--soft surface-enter">
            <div className="panel__header">
              <p className="eyebrow">Create route</p>
              <h2 className="panel__title">Register a new subdomain</h2>
              <p className="panel__copy">
                Use the same format every time: choose a name, confirm the
                suffix, and point it at the host that should receive
                traffic.
              </p>
            </div>

            {addError && (
              <div
                className="status-banner status-banner--danger"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="field-grid mt-6">
              <div className="field-grid field-grid--two">
                <div className="field">
                  <label htmlFor="subdomainInput" className="field-label">
                    Subdomain
                  </label>
                  <span className="field-hint">
                    Keep it short and easy to recognize.
                  </span>
                  <div className="split-field">
                    <input
                      id="subdomainInput"
                      type="text"
                      required
                      minLength={2}
                      maxLength={63}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="my-app"
                      value={formData.subdomain}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subdomain: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        })
                      }
                      className="text-field"
                    />
                    <select
                      aria-label="Available domain suffix"
                      value={formData.domain}
                      disabled={availableDomains.length === 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          domain: e.target.value,
                        })
                      }
                      className="select-field"
                    >
                      {availableDomains.map((domain) => (
                        <option key={domain} value={domain}>
                          .{domain}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="hostnameInput" className="field-label">
                    Destination host
                  </label>
                  <span className="field-hint">
                    IP address, hostname, or tunnel endpoint.
                  </span>
                  <input
                    id="hostnameInput"
                    type="text"
                    required
                    maxLength={255}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    dir="auto"
                    placeholder="192.168.1.5 or app.example.net"
                    value={formData.hostname}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hostname: e.target.value,
                      })
                    }
                    className="text-field"
                  />
                </div>

                <div className="field">
                  <label htmlFor="portInput" className="field-label">
                    Destination port
                  </label>
                  <span className="field-hint">
                    Enter the service port that should receive requests.
                  </span>
                  <input
                    id="portInput"
                    type="number"
                    required
                    inputMode="numeric"
                    min={1}
                    max={65535}
                    placeholder="8080"
                    value={formData.port}
                    onChange={(e) =>
                      setFormData({ ...formData, port: e.target.value })
                    }
                    className="text-field"
                  />
                </div>
              </div>

              <div className="subtle-row">
                <p className="field-hint">
                  {availableDomains.length > 0
                    ? "Changes take effect immediately after registration."
                    : "No domain suffixes are available right now."}
                </p>
                <div className="nav-actions">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="button button-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSubmitting || availableDomains.length === 0
                    }
                    className="button button-primary"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Register domain
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {!pageError && domains.length === 0 ? (
          <section className="empty-panel surface-enter">
            <div className="eyebrow">
              <Globe className="w-4 h-4" /> Empty workspace
            </div>
            <h2 className="empty-panel__title">No routes yet</h2>
            <p className="empty-panel__copy">
              Start by registering a subdomain, then point it at the
              service or tunnel you want to expose.
            </p>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="button button-secondary"
            >
              Register your first domain
            </button>
          </section>
        ) : !pageError ? (
          <section className="domains-list surface-enter">
            {domains.map((domain) => (
              <DomainRow
                key={domain.id}
                domain={domain}
                onDelete={handleDelete}
                isDeleting={deletingId === domain.id}
              />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function DomainRow({
  domain,
  onDelete,
  isDeleting,
}: {
  domain: Domain;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
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
      const res = await api.get(
        `/stats/${domain.id}?year=${selectedYear}`,
      );
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

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextYear = e.target.value;
    setYear(nextYear);
    if (showStats) {
      fetchStats(nextYear);
    }
  };

  return (
    <article className="domain-row">
      <div className="domain-row__top">
        <div className="domain-row__identity">
          <div className="eyebrow">
            <Globe className="w-4 h-4" /> Active route
          </div>
          <h2 className="domain-row__name text-wrap-anywhere" dir="auto">
            {domain.subdomain}
          </h2>
          <p className="domain-row__meta text-wrap-anywhere" dir="auto">
            Traffic is sent to {domain.hostname}:{domain.port}
          </p>
        </div>

        <div className="nav-actions">
          <button
            type="button"
            onClick={toggleStats}
            className={`button ${showStats ? "button-secondary" : "button-ghost"}`}
            aria-expanded={showStats}
            disabled={isDeleting}
          >
            <Activity className="w-4 h-4" />
            {showStats ? "Hide analytics" : "View analytics"}
          </button>
          {confirmDelete ? (
            <div
              className="confirm-actions"
              role="group"
              aria-label="Confirm domain removal"
            >
              <button
                type="button"
                onClick={() => onDelete(domain.id)}
                className="button button-danger"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Confirm remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="button button-ghost"
                disabled={isDeleting}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="button button-danger"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          )}
        </div>
      </div>

      {showStats && (
        <section className="chart-shell surface-enter">
          <div className="subtle-row">
            <div>
              <div className="eyebrow">
                <Activity className="w-4 h-4" /> Traffic review
              </div>
              <p className="page-copy text-wrap-balance">
                Open yearly traffic only when you need it. The default view
                keeps the main list easier to scan.
              </p>
            </div>

            <div className="field">
              <label htmlFor={`year-${domain.id}`} className="field-label">
                Year
              </label>
              <div className="split-field">
                <span className="text-field flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Reporting period
                </span>
                <select
                  id={`year-${domain.id}`}
                  value={year}
                  onChange={handleYearChange}
                  className="select-field"
                >
                  {years.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {statsError ? (
            <div
              className="status-banner status-banner--danger"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="stack-sm">
                <span>{statsError}</span>
                <button
                  type="button"
                  onClick={() => fetchStats(year)}
                  className="button button-ghost"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : isLoadingStats && !stats ? (
            <div className="loading-stack py-8" aria-live="polite">
              <div className="spinner" aria-hidden="true" />
              <p>Loading analytics...</p>
            </div>
          ) : stats ? (
            <div className="stack-lg">
              <div className="metric-grid">
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
              </div>

              <div className="panel">
                <div className="panel__header">
                  <h3 className="panel__title">Monthly visitors</h3>
                  <p className="panel__copy">
                    A compact view of traffic over the selected year.
                  </p>
                </div>
                <div className="h-64 w-full">
                  <Suspense
                    fallback={
                      <div
                        className="loading-stack h-full"
                        aria-live="polite"
                      >
                        <div className="spinner" aria-hidden="true" />
                        <p>Preparing chart...</p>
                      </div>
                    }
                  >
                    <DomainStatsChart chartData={stats.chartData} />
                  </Suspense>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </article>
  );
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric-card${accent ? " metric-card--accent" : ""}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}
