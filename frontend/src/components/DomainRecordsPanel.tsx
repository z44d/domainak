import {
  AddRounded,
  CloseRounded,
  ContentCopyRounded,
  DeleteOutlineRounded,
  DnsRounded,
  ModeEditOutlineRounded,
  RefreshRounded,
  SearchRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { api } from "../lib/api";
import {
  DNS_RECORD_TYPES,
  TYPE_COLOR,
  TYPE_META,
  composeRecordValue,
  defaultFieldsFor,
  parseRecordValue,
  previewFqdn,
  relativeName,
} from "../lib/dns-records";
import type {
  DnsDelegationInfo,
  DnsRecordType,
  DnsSyncStatus,
  Domain,
  DomainDnsRecord,
  DomainRecordsResponse,
} from "../lib/types";
import { getErrorMessage } from "../lib/utils";
import { FONT_DISPLAY, FONT_MONO } from "../theme/theme";

const SYNC_META: Record<
  DnsSyncStatus,
  { label: string; color: "success" | "warning" | "error" }
> = {
  synced: { label: "Published", color: "success" },
  pending: { label: "Not published", color: "warning" },
  failed: { label: "Publish failed", color: "error" },
};

const DELEGATION_META: Record<
  DnsDelegationInfo["status"],
  { label: string; color: "success" | "warning" | "default" }
> = {
  delegated: { label: "Delegated", color: "success" },
  pending: { label: "Not delegated", color: "warning" },
  unknown: { label: "Couldn't check", color: "default" },
};

interface FormState {
  name: string;
  type: DnsRecordType;
  ttl: string;
  comment: string;
  fields: Record<string, string>;
}

function emptyForm(type: DnsRecordType = "A"): FormState {
  return {
    name: "",
    type,
    ttl: "300",
    comment: "",
    fields: defaultFieldsFor(type),
  };
}

function formFromRecord(
  record: DomainDnsRecord,
  domain: string,
): FormState {
  return {
    name: relativeName(record.name, domain),
    type: record.type,
    ttl: String(record.ttl),
    comment: record.comment ?? "",
    fields: parseRecordValue(record.type, record.value),
  };
}

interface DomainRecordsPanelProps {
  domain: Domain;
  onFeedback: (message: string, severity: "success" | "error") => void;
  onCountChange?: (count: number) => void;
}

export function DomainRecordsPanel({
  domain,
  onFeedback,
  onCountChange,
}: DomainRecordsPanelProps) {
  const [records, setRecords] = useState<DomainDnsRecord[]>([]);
  const [dnsConfigured, setDnsConfigured] = useState(true);
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [delegation, setDelegation] =
    useState<DnsDelegationInfo | null>(null);
  const [isCheckingDelegation, setIsCheckingDelegation] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DnsRecordType>(
    "all",
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRecord, setDeletingRecord] =
    useState<DomainDnsRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal, forceDelegation = false) => {
      try {
        const { data } =
          await api.get<DomainRecordsResponse>(
            `/domains/${domain.id}/records${forceDelegation ? "?refreshDelegation=1" : ""}`,
            { signal },
          );
        if (signal?.aborted) {
          return;
        }
        setRecords(data.records);
        setDnsConfigured(data.dnsConfigured);
        setNameservers(data.nameservers ?? []);
        setDelegation(data.delegation ?? null);
        setLoadError("");
        onCountChange?.(data.records.length);
      } catch (error) {
        if (signal?.aborted) {
          return;
        }
        setLoadError(
          getErrorMessage(error, "We could not load the records."),
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [domain.id, onCountChange],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
    };
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (typeFilter !== "all" && record.type !== typeFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        record.name.toLowerCase().includes(query) ||
        record.value.toLowerCase().includes(query) ||
        (record.comment ?? "").toLowerCase().includes(query)
      );
    });
  }, [records, search, typeFilter]);

  const openCreateForm = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
    setShowForm(true);
  }, []);

  const openEditForm = useCallback(
    (record: DomainDnsRecord) => {
      setEditingId(record.id);
      setForm(formFromRecord(record, domain.subdomain));
      setFormError("");
      setShowForm(true);
      window.setTimeout(() => {
        formRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 60);
    },
    [domain.subdomain],
  );

  const handleTypeChange = useCallback((type: DnsRecordType) => {
    setForm((current) => ({
      ...current,
      type,
      fields: defaultFieldsFor(type),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setFormError("");

      const name = form.name.trim();
      if (!name) {
        setFormError("Enter a name for the record.");
        return;
      }
      const value = composeRecordValue(form.type, form.fields);
      if (!value) {
        setFormError("Enter a value for the record.");
        return;
      }
      const ttl = Number(form.ttl);
      if (!Number.isInteger(ttl) || ttl < 60 || ttl > 86400) {
        setFormError("TTL must be between 60 and 86400 seconds.");
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = {
          name,
          type: form.type,
          value,
          ttl,
          comment: form.comment.trim() || null,
        };
        if (editingId === null) {
          const { data } = await api.post<{ record: DomainDnsRecord }>(
            `/domains/${domain.id}/records`,
            payload,
          );
          onFeedback(
            data.record.syncStatus === "synced"
              ? "Record created and published."
              : "Record saved, but it is not published yet. See its status below.",
            data.record.syncStatus === "synced"
              ? "success"
              : "error",
          );
        } else {
          await api.put<{ record: DomainDnsRecord }>(
            `/domains/${domain.id}/records/${editingId}`,
            payload,
          );
          onFeedback("Record updated and published.", "success");
        }
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm());
        await load();
      } catch (error) {
        setFormError(
          getErrorMessage(error, "Could not save the record."),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [domain.id, editingId, form, load, onFeedback],
  );

  const handleDelete = useCallback(async () => {
    if (!deletingRecord) {
      return;
    }
    setIsDeleting(true);
    try {
      await api.delete(
        `/domains/${domain.id}/records/${deletingRecord.id}`,
      );
      setDeletingRecord(null);
      onFeedback("Record deleted.", "success");
      await load();
    } catch (error) {
      onFeedback(
        getErrorMessage(error, "Could not delete the record."),
        "error",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deletingRecord, domain.id, load, onFeedback]);

  const handleRetry = useCallback(
    async (record: DomainDnsRecord) => {
      setRetryingId(record.id);
      try {
        const { data } = await api.post<{ record: DomainDnsRecord }>(
          `/domains/${domain.id}/records/${record.id}/retry`,
        );
        setRecords((current) =>
          current.map((item) =>
            item.id === record.id ? data.record : item,
          ),
        );
        if (data.record.syncStatus === "synced") {
          onFeedback("Record published.", "success");
        } else {
          onFeedback(
            data.record.syncError ?? "The record is still not published.",
            "error",
          );
        }
      } catch (error) {
        onFeedback(
          getErrorMessage(error, "Could not retry publishing."),
          "error",
        );
      } finally {
        setRetryingId(null);
      }
    },
    [domain.id, onFeedback],
  );

  const handleCopy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        onFeedback(`${label} copied.`, "success");
      } catch {
        onFeedback("Could not copy to the clipboard.", "error");
      }
    },
    [onFeedback],
  );

  const handleCheckDelegation = useCallback(async () => {
    setIsCheckingDelegation(true);
    try {
      await load(undefined, true);
    } finally {
      setIsCheckingDelegation(false);
    }
  }, [load]);

  const meta = TYPE_META[form.type];
  const fqdnPreview = previewFqdn(form.name, domain.subdomain);
  const isApex = form.name.trim() === "" || form.name.trim() === "@";
  const showApexWarning =
    isApex &&
    (form.type === "A" || form.type === "AAAA" || form.type === "CNAME");

  return (
    <Box ref={formRef} sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5 }}>
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, transparent 70%)`,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mb: 0.75 }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "12px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  flexShrink: 0,
                }}
              >
                <DnsRounded fontSize="small" />
              </Box>
              <Typography variant="overline" color="textSecondary">
                DNS records
              </Typography>
            </Stack>
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontFamily: FONT_DISPLAY }}
            >
              Records for {domain.subdomain}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ mt: 0.5, maxWidth: 640 }}
            >
              Every record lives under this domain: @ is the domain
              itself, www is www.{domain.subdomain}. A, AAAA, CNAME,
              TXT, MX, NS, SRV, CAA, PTR, DS, HTTPS, SVCB, CERT, SSHFP,
              TLSA and NAPTR are all supported.
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}
          >
            <Chip
              size="small"
              variant="outlined"
              label={`${records.length} ${records.length === 1 ? "record" : "records"}`}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={showForm ? <CloseRounded /> : <AddRounded />}
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  setEditingId(null);
                } else {
                  openCreateForm();
                }
              }}
            >
              {showForm ? "Hide form" : "New record"}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {!dnsConfigured && !isLoading ? (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          DNS publishing is not configured on this server: PowerDNS
          is not reachable. Records are saved here and will publish
          once PowerDNS is configured — use Retry on a record
          afterwards.
        </Alert>
      ) : null}

      {!isLoading && delegation ? (
        <Paper
          variant="outlined"
          sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, mb: 2 }}
        >
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              DNS delegation
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center" }}
            >
              <Chip
                size="small"
                label={DELEGATION_META[delegation.status].label}
                color={DELEGATION_META[delegation.status].color}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshRounded />}
                onClick={() => void handleCheckDelegation()}
                disabled={isCheckingDelegation}
              >
                {isCheckingDelegation ? "Checking…" : "Check again"}
              </Button>
            </Stack>
          </Stack>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ mt: 1, maxWidth: 640 }}
          >
            Records publish to this server&apos;s own DNS system. For
            them to resolve publicly, delegate {domain.subdomain} to
            these nameservers with NS records in its parent zone. The
            nameservers also need A (glue) records pointing at this
            server&apos;s public IP.
          </Typography>
          {nameservers.length > 0 ? (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {nameservers.map((nameserver) => {
                const nsRecord =
                  `${domain.subdomain}  NS  ${nameserver}`;
                return (
                  <Stack
                    key={nameserver}
                    direction="row"
                    spacing={1}
                    sx={{ minWidth: 0, alignItems: "center" }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: FONT_MONO,
                        overflowWrap: "anywhere",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {nsRecord}
                    </Typography>
                    <Tooltip title="Copy NS record">
                      <IconButton
                        size="small"
                        aria-label={`Copy NS record for ${nameserver}`}
                        onClick={() =>
                          void handleCopy(nsRecord, "NS record")
                        }
                      >
                        <ContentCopyRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ mt: 1 }}>
              No DNS nameservers are configured on this server yet.
            </Typography>
          )}
        </Paper>
      ) : null}

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2.5 }}>
          {formError ? (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              {formError}
            </Alert>
          ) : null}
          <Paper
            variant="outlined"
            component="form"
            onSubmit={handleSubmit}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 3,
              display: "grid",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "minmax(0, 2fr) minmax(0, 1fr)",
                },
              }}
            >
              <TextField
                label="Name"
                required
                fullWidth
                placeholder="www"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                helperText={`Resolves as ${fqdnPreview}. Use @ for ${domain.subdomain} itself.`}
                slotProps={{
                  htmlInput: {
                    maxLength: 253,
                    autoCapitalize: "none",
                    autoCorrect: "off",
                    spellCheck: false,
                    dir: "auto",
                  },
                }}
              />
              <TextField
                select
                label="Type"
                value={form.type}
                onChange={(event) =>
                  handleTypeChange(event.target.value as DnsRecordType)
                }
                fullWidth
              >
                {DNS_RECORD_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {showApexWarning ? (
              <Alert severity="warning" variant="outlined">
                An @ {form.type} record replaces what {domain.subdomain}{" "}
                resolves to, so the proxy route for this domain stops
                answering at the apex. Sub-names like www are unaffected.
              </Alert>
            ) : null}

            <RecordValueFields
              type={form.type}
              fields={form.fields}
              onChange={(fields) => setForm({ ...form, fields })}
            />

            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ fontFamily: FONT_MONO, overflowWrap: "anywhere" }}
            >
              {form.type}: {composeRecordValue(form.type, form.fields) || meta.example}
            </Typography>

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "minmax(0, 1fr) minmax(0, 2fr)",
                },
              }}
            >
              <TextField
                label="TTL (seconds)"
                type="number"
                fullWidth
                value={form.ttl}
                onChange={(event) =>
                  setForm({ ...form, ttl: event.target.value })
                }
                helperText="60–86400, default 300."
                slotProps={{ htmlInput: { min: 60, max: 86400 } }}
              />
              <TextField
                label="Comment (optional)"
                fullWidth
                value={form.comment}
                onChange={(event) =>
                  setForm({ ...form, comment: event.target.value })
                }
                helperText="Shown only in this dashboard."
                slotProps={{
                  htmlInput: { maxLength: 255, dir: "auto" },
                }}
              />
            </Box>

            <Stack
              direction="row"
              spacing={1.5}
              sx={{ justifyContent: "flex-end" }}
            >
              <Button
                color="inherit"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                startIcon={
                  isSubmitting ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
              >
                {editingId === null ? "Create record" : "Save record"}
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Collapse>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          fullWidth
          placeholder="Search name, value or comment…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { "aria-label": "Search records" },
          }}
        />
        <TextField
          select
          size="small"
          label="Type"
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as "all" | DnsRecordType)
          }
          sx={{ minWidth: { xs: "100%", sm: 150 } }}
        >
          <MenuItem value="all">All types</MenuItem>
          {DNS_RECORD_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loadError ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setIsLoading(true);
                void load();
              }}
            >
              Try again
            </Button>
          }
        >
          {loadError}
        </Alert>
      ) : isLoading ? (
        <Box
          sx={{ display: "grid", placeItems: "center", gap: 1.5, py: 5 }}
          aria-live="polite"
        >
          <CircularProgress size={26} />
          <Typography variant="body2" color="textSecondary">
            Loading records...
          </Typography>
        </Box>
      ) : records.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 4, px: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              mx: "auto",
              display: "grid",
              placeItems: "center",
              bgcolor: "action.hover",
            }}
          >
            <DnsRounded />
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1.5 }}>
            No records yet — create the first one above.
          </Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 4, px: 2 }}>
          <Typography variant="body2" color="textSecondary">
            No records match this search.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 1.25 }}>
          {filtered.map((record) => {
            const sync = SYNC_META[record.syncStatus];
            const relative = relativeName(record.name, domain.subdomain);
            return (
              <Paper
                key={record.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: { xs: "stretch", sm: "center" },
                  gap: 1.5,
                  borderColor:
                    editingId === record.id ? "primary.main" : undefined,
                  transition:
                    "box-shadow 120ms ease, border-color 120ms ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: (theme) =>
                      `0 6px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
                  },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexShrink: 0 }}
                >
                  <Chip
                    label={record.type}
                    size="small"
                    color={TYPE_COLOR[record.type]}
                    variant="filled"
                    sx={{ fontFamily: FONT_MONO, minWidth: 62 }}
                  />
                  <Tooltip
                    title={record.syncError ?? sync.label}
                    disableHoverListener={!record.syncError}
                  >
                    <Chip
                      label={sync.label}
                      size="small"
                      color={sync.color}
                      variant="outlined"
                    />
                  </Tooltip>
                </Stack>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: FONT_MONO,
                      fontWeight: 600,
                      overflowWrap: "anywhere",
                    }}
                    dir="auto"
                  >
                    {relative}
                    <Typography
                      component="span"
                      variant="body2"
                      color="textSecondary"
                      sx={{ fontFamily: FONT_MONO }}
                    >
                      {relative === "@"
                        ? ""
                        : `.${domain.subdomain}`}
                    </Typography>
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{
                      fontFamily: FONT_MONO,
                      overflowWrap: "anywhere",
                    }}
                    dir="auto"
                  >
                    {record.value}
                  </Typography>
                  {record.comment ? (
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      dir="auto"
                      sx={{
                        display: "block",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {record.comment}
                    </Typography>
                  ) : null}
                  {record.syncError ? (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{
                        display: "block",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {record.syncError}
                    </Typography>
                  ) : null}
                </Box>

                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: "center",
                    alignSelf: { xs: "flex-end", sm: "center" },
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{ fontFamily: FONT_MONO, mr: 0.5 }}
                  >
                    {record.ttl}s
                  </Typography>
                  <Tooltip title="Copy value">
                    <IconButton
                      size="small"
                      aria-label={`Copy value of ${record.name}`}
                      onClick={() => {
                        void handleCopy(record.value, "Value");
                      }}
                    >
                      <ContentCopyRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {record.syncStatus !== "synced" && dnsConfigured ? (
                    <Tooltip title="Retry publishing">
                      <IconButton
                        size="small"
                        aria-label={`Retry publishing ${record.name}`}
                        disabled={retryingId === record.id}
                        onClick={() => {
                          void handleRetry(record);
                        }}
                      >
                        {retryingId === record.id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <RefreshRounded fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <Tooltip title="Edit record">
                    <IconButton
                      size="small"
                      aria-label={`Edit record ${record.name}`}
                      onClick={() => openEditForm(record)}
                    >
                      <ModeEditOutlineRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete record">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Delete record ${record.name}`}
                      onClick={() => setDeletingRecord(record)}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}

      <ConfirmDialog
        open={deletingRecord !== null}
        title="Remove DNS record?"
        message={
          deletingRecord
            ? `Remove ${deletingRecord.type} ${deletingRecord.name}? It will stop resolving.`
            : ""
        }
        confirmLabel="Remove"
        loading={isDeleting}
        onClose={() => setDeletingRecord(null)}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </Box>
  );
}

// The value editor for one record type: a single field for most types,
// structured fields for the multi-part types (MX, SRV, CAA, DS, SSHFP,
// TLSA, HTTPS/SVCB) so each part is validated in place.
function RecordValueFields({
  type,
  fields,
  onChange,
}: {
  type: DnsRecordType;
  fields: Record<string, string>;
  onChange: (fields: Record<string, string>) => void;
}) {
  const meta = TYPE_META[type];
  const set = (key: string, value: string) =>
    onChange({ ...fields, [key]: value });

  const numberField = (
    key: string,
    label: string,
    helper?: string,
  ) => (
    <TextField
      key={key}
      label={label}
      type="number"
      fullWidth
      required
      value={fields[key] ?? ""}
      onChange={(event) => set(key, event.target.value)}
      helperText={helper}
      slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
    />
  );

  const textField = (
    key: string,
    label: string,
    placeholder: string,
    helper?: string,
    required = true,
  ) => (
    <TextField
      key={key}
      label={label}
      fullWidth
      required={required}
      placeholder={placeholder}
      value={fields[key] ?? ""}
      onChange={(event) => set(key, event.target.value)}
      helperText={helper}
      slotProps={{
        htmlInput: {
          autoCapitalize: "none",
          autoCorrect: "off",
          spellCheck: false,
          dir: "auto",
        },
      }}
    />
  );

  if (type === "MX") {
    return (
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) minmax(0, 2fr)" },
        }}
      >
        {numberField("priority", "Priority", "Lower is tried first.")}
        {textField(
          "target",
          "Mail server",
          "mail.example.com",
          "Hostname that receives mail for this name.",
        )}
      </Box>
    );
  }

  if (type === "SRV") {
    return (
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr 1fr",
            sm: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {numberField("priority", "Priority")}
        {numberField("weight", "Weight")}
        {numberField("port", "Port")}
        {textField("target", "Target", "target.example.com")}
      </Box>
    );
  }

  if (type === "CAA") {
    return (
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr)",
          },
        }}
      >
        <TextField
          select
          label="Flags"
          value={fields.flags ?? "0"}
          onChange={(event) => set("flags", event.target.value)}
          fullWidth
          helperText="0, or 128 to make it critical."
        >
          <MenuItem value="0">0 — non-critical</MenuItem>
          <MenuItem value="128">128 — critical</MenuItem>
        </TextField>
        <TextField
          select
          label="Tag"
          value={fields.tag ?? "issue"}
          onChange={(event) => set("tag", event.target.value)}
          fullWidth
        >
          <MenuItem value="issue">issue</MenuItem>
          <MenuItem value="issuewild">issuewild</MenuItem>
          <MenuItem value="iodef">iodef</MenuItem>
        </TextField>
        {textField(
          "value",
          "Value",
          "letsencrypt.org",
          "Authority hostname, or a URL/email for iodef.",
        )}
      </Box>
    );
  }

  if (type === "DS" || type === "SSHFP" || type === "TLSA") {
    const labels =
      type === "DS"
        ? ["Key tag", "Algorithm", "Digest type"]
        : type === "SSHFP"
          ? ["Algorithm", "Fingerprint type"]
          : ["Usage", "Selector", "Matching type"];
    const keys =
      type === "DS"
        ? ["keyTag", "algorithm", "digestType"]
        : type === "SSHFP"
          ? ["algorithm", "fingerprintType"]
          : ["usage", "selector", "matchingType"];
    const dataKey =
      type === "DS" ? "digest" : type === "SSHFP" ? "fingerprint" : "data";
    const dataLabel =
      type === "DS" ? "Digest" : type === "SSHFP" ? "Fingerprint" : "Data";
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: `repeat(${keys.length}, minmax(0, 1fr))`,
              sm: `repeat(${keys.length}, minmax(0, 1fr))`,
            },
          }}
        >
          {keys.map((key, index) =>
            numberField(key, labels[index] ?? key),
          )}
        </Box>
        {textField(dataKey, dataLabel, "Hexadecimal data", undefined)}
      </Box>
    );
  }

  if (type === "HTTPS" || type === "SVCB") {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "minmax(0, 1fr) minmax(0, 2fr)",
            },
          }}
        >
          {numberField("priority", "Priority", "0 means alias mode.")}
          {textField(
            "target",
            "Target",
            ".",
            '"." means this name itself.',
          )}
        </Box>
        {textField(
          "params",
          "Parameters (optional)",
          "alpn=h2 port=8443",
          "Space-separated key=value pairs.",
          false,
        )}
      </Box>
    );
  }

  if (type === "TXT") {
    return (
      <TextField
        label="Value"
        fullWidth
        required
        multiline
        minRows={2}
        placeholder={meta.placeholder}
        value={fields.value ?? ""}
        onChange={(event) => set("value", event.target.value)}
        helperText={meta.helper}
        slotProps={{
          htmlInput: {
            maxLength: 1024,
            autoCapitalize: "none",
            autoCorrect: "off",
            spellCheck: false,
            dir: "auto",
          },
        }}
      />
    );
  }

  return textField(
    "value",
    "Value",
    meta.placeholder,
    meta.helper,
  );
}
