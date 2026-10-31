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
  Card,
  CardContent,
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
import { api } from "../lib/api";
import {
  composeRecordValue,
  defaultFieldsFor,
  DNS_RECORD_TYPES,
  parseRecordValue,
  previewFqdn,
  relativeName,
  STRUCTURED_KIND,
  TYPE_COLOR,
  TYPE_META,
} from "../lib/dns-records";
import type {
  DnsRecordType,
  DnsSyncStatus,
  Domain,
  DomainDnsRecord,
  DomainRecordsResponse,
} from "../lib/types";
import { getErrorMessage } from "../lib/utils";
import { FONT_MONO } from "../theme/theme";
import { ConfirmDialog } from "./ConfirmDialog";

interface RecordRow {
  record: DomainDnsRecord;
  domainId: number;
  domain: string;
}

interface FormState {
  domainId: number | "";
  name: string;
  type: DnsRecordType;
  fields: Record<string, string>;
  ttl: string;
  comment: string;
}

function emptyForm(domainId: number | ""): FormState {
  return {
    domainId,
    name: "",
    type: "A",
    fields: defaultFieldsFor("A"),
    ttl: "300",
    comment: "",
  };
}

const FIELD_LABELS: Record<string, string> = {
  priority: "Priority",
  weight: "Weight",
  port: "Port",
  target: "Target",
  flags: "Flags",
  tag: "Tag",
  value: "Value",
  keyTag: "Key tag",
  algorithm: "Algorithm",
  digestType: "Digest type",
  digest: "Digest",
  fingerprintType: "Fingerprint type",
  fingerprint: "Fingerprint",
  usage: "Usage",
  selector: "Selector",
  matchingType: "Matching type",
  data: "Data",
  params: "Parameters",
};

const NUMBER_FIELDS = new Set([
  "priority",
  "weight",
  "port",
  "flags",
  "keyTag",
  "algorithm",
  "digestType",
  "fingerprintType",
  "usage",
  "selector",
  "matchingType",
]);

const SYNC_META: Record<
  DnsSyncStatus,
  { label: string; color: "success" | "warning" | "error" }
> = {
  synced: { label: "Published", color: "success" },
  pending: { label: "Not published", color: "warning" },
  failed: { label: "Publish failed", color: "error" },
};

interface DnsRecordsPanelProps {
  onFeedback: (message: string, severity: "success" | "error") => void;
}

// Every DNS record across the user's domains, in one place. Records
// still belong to a domain (they are created, edited and published
// through that domain's endpoints), this tab just lists them all
// together — the per-domain panels in the Domains tab show the same
// records under their own domain.
export function DnsRecordsPanel({ onFeedback }: DnsRecordsPanelProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DnsRecordType>(
    "all",
  );
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(""));
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRow, setDeletingRow] = useState<RecordRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data: domainsData } = await api.get<{
        domains: Domain[];
      }>("/domains", { signal });
      if (signal?.aborted) {
        return;
      }
      const owned = domainsData.domains;
      setDomains(owned);
      const results = await Promise.allSettled(
        owned.map((domain) =>
          api.get<DomainRecordsResponse>(
            `/domains/${domain.id}/records`,
            { signal },
          ),
        ),
      );
      if (signal?.aborted) {
        return;
      }
      const next: RecordRow[] = [];
      let firstError: unknown = null;
      results.forEach((result, index) => {
        const domain = owned[index];
        if (!domain) {
          return;
        }
        if (result.status === "fulfilled") {
          for (const record of result.value.data.records) {
            next.push({
              record,
              domainId: domain.id,
              domain: domain.subdomain,
            });
          }
        } else if (!firstError) {
          firstError = result.reason;
        }
      });
      setRows(next);
      setLoadError(
        firstError
          ? getErrorMessage(
              firstError,
              "Some records could not be loaded.",
            )
          : "",
      );
      setForm((current) =>
        current.domainId === ""
          ? { ...current, domainId: owned[0]?.id ?? "" }
          : current,
      );
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      setLoadError(
        getErrorMessage(error, "We could not load your records."),
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
    };
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ record, domain }) => {
      if (typeFilter !== "all" && record.type !== typeFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        record.name.toLowerCase().includes(query) ||
        domain.toLowerCase().includes(query) ||
        record.value.toLowerCase().includes(query) ||
        (record.comment ?? "").toLowerCase().includes(query)
      );
    });
  }, [rows, search, typeFilter]);

  const openCreateForm = useCallback(() => {
    setEditing(null);
    setForm(emptyForm(domains[0]?.id ?? ""));
    setFormError("");
    setShowForm(true);
  }, [domains]);

  const openEditForm = useCallback((row: RecordRow) => {
    setEditing(row);
    setForm({
      domainId: row.domainId,
      name: relativeName(row.record.name, row.domain),
      type: row.record.type,
      fields: parseRecordValue(row.record.type, row.record.value),
      ttl: String(row.record.ttl),
      comment: row.record.comment ?? "",
    });
    setFormError("");
    setShowForm(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  }, []);

  const handleTypeChange = useCallback((type: DnsRecordType) => {
    setForm((current) => ({
      ...current,
      type,
      fields: defaultFieldsFor(type),
    }));
  }, []);

  const fieldsAreStructured = useMemo(() => {
    if (!STRUCTURED_KIND[form.type]) {
      return false;
    }
    return Object.keys(form.fields).some((key) => key !== "value");
  }, [form.fields, form.type]);

  const formValue = useMemo(() => {
    if (fieldsAreStructured) {
      return composeRecordValue(form.type, form.fields);
    }
    return (form.fields.value ?? "").trim();
  }, [fieldsAreStructured, form.fields, form.type]);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setFormError("");
      if (form.domainId === "") {
        setFormError("Pick a domain for the record.");
        return;
      }
      if (!form.name.trim()) {
        setFormError("Enter a name for the record.");
        return;
      }
      if (!formValue) {
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
          name: form.name.trim(),
          type: form.type,
          value: formValue,
          ttl,
          comment: form.comment.trim() || null,
        };
        if (editing === null) {
          const { data } = await api.post<{ record: DomainDnsRecord }>(
            `/domains/${form.domainId}/records`,
            payload,
          );
          onFeedback(
            data.record.syncStatus === "synced"
              ? "Record created and published."
              : "Record saved, but it is not published yet. See its status below.",
            data.record.syncStatus === "synced" ? "success" : "error",
          );
        } else {
          await api.put<{ record: DomainDnsRecord }>(
            `/domains/${editing.domainId}/records/${editing.record.id}`,
            payload,
          );
          onFeedback("Record updated and published.", "success");
        }
        setShowForm(false);
        setEditing(null);
        setForm(emptyForm(domains[0]?.id ?? ""));
        await load();
      } catch (error) {
        setFormError(
          getErrorMessage(error, "Could not save the record."),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [domains, editing, form, formValue, load, onFeedback],
  );

  const handleDelete = useCallback(async () => {
    if (!deletingRow) {
      return;
    }
    setIsDeleting(true);
    try {
      await api.delete(
        `/domains/${deletingRow.domainId}/records/${deletingRow.record.id}`,
      );
      onFeedback("DNS record removed.", "success");
      setDeletingRow(null);
      await load();
    } catch (error) {
      onFeedback(
        getErrorMessage(error, "Could not remove the record."),
        "error",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deletingRow, load, onFeedback]);

  const handleRetry = useCallback(
    async (row: RecordRow) => {
      setRetryingId(row.record.id);
      try {
        await api.post(
          `/domains/${row.domainId}/records/${row.record.id}/retry`,
          {},
        );
        await load();
      } catch (error) {
        onFeedback(
          getErrorMessage(error, "Could not retry publishing."),
          "error",
        );
      } finally {
        setRetryingId(null);
      }
    },
    [load, onFeedback],
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

  const selectedDomain =
    domains.find((domain) => domain.id === form.domainId) ?? null;
  const fqdnPreview = selectedDomain
    ? previewFqdn(form.name, selectedDomain.subdomain)
    : "";

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography
                variant="overline"
                color="textSecondary"
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <DnsRounded fontSize="small" /> Records inventory
              </Typography>
              <Typography variant="h3" component="h2" sx={{ mt: 0.25 }}>
                DNS Records
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ mt: 0.75, maxWidth: 640 }}
              >
                Every record across your domains, published to your own
                PowerDNS. A, AAAA and CNAME records also route through
                the proxy, so a name that reaches this server serves
                its target. Other types are DNS-only.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={showForm ? <CloseRounded /> : <AddRounded />}
              onClick={() =>
                showForm ? setShowForm(false) : openCreateForm()
              }
              disabled={domains.length === 0}
              sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}
            >
              {showForm ? "Hide form" : "New record"}
            </Button>
          </Stack>

          <Collapse in={showForm} unmountOnExit>
            <Box
              ref={formRef}
              component="form"
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
              sx={{
                mt: 3,
                pt: 3,
                borderTop: 1,
                borderColor: "divider",
                display: "grid",
                gap: 2,
              }}
            >
              {formError ? (
                <Alert severity="error" role="alert">
                  {formError}
                </Alert>
              ) : null}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                useFlexGap
              >
                <TextField
                  select
                  label="Domain"
                  required
                  value={form.domainId}
                  disabled={editing !== null}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      domainId: Number(event.target.value),
                    }))
                  }
                  sx={{ flex: 1, minWidth: 200 }}
                  helperText={
                    editing !== null
                      ? "A record stays with its domain."
                      : "Records live under the domain you pick."
                  }
                >
                  {domains.map((domain) => (
                    <MenuItem key={domain.id} value={domain.id}>
                      {domain.subdomain}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Name"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="www"
                  sx={{ flex: 1, minWidth: 160 }}
                  helperText={
                    fqdnPreview
                      ? `Resolves as ${fqdnPreview}. Use @ for the domain itself.`
                      : "Use @ for the domain itself."
                  }
                  slotProps={{
                    htmlInput: {
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
                  sx={{ minWidth: 130 }}
                >
                  {DNS_RECORD_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              {fieldsAreStructured ? (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  useFlexGap
                  sx={{ flexWrap: "wrap" }}
                >
                  {Object.keys(form.fields).map((key) => (
                    <TextField
                      key={key}
                      label={FIELD_LABELS[key] ?? key}
                      value={form.fields[key] ?? ""}
                      type={NUMBER_FIELDS.has(key) ? "number" : "text"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fields: {
                            ...current.fields,
                            [key]: event.target.value,
                          },
                        }))
                      }
                      sx={{ flex: 1, minWidth: 140 }}
                      slotProps={{
                        htmlInput: {
                          autoCapitalize: "none",
                          autoCorrect: "off",
                          spellCheck: false,
                          dir: "auto",
                        },
                      }}
                    />
                  ))}
                </Stack>
              ) : (
                <TextField
                  label="Value"
                  required
                  fullWidth
                  value={form.fields.value ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fields: { value: event.target.value },
                    }))
                  }
                  placeholder={TYPE_META[form.type].placeholder}
                  helperText={TYPE_META[form.type].helper}
                  slotProps={{
                    htmlInput: {
                      autoCapitalize: "none",
                      autoCorrect: "off",
                      spellCheck: false,
                      dir: "auto",
                    },
                  }}
                />
              )}

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                useFlexGap
              >
                <TextField
                  label="TTL (seconds)"
                  type="number"
                  value={form.ttl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ttl: event.target.value,
                    }))
                  }
                  sx={{ maxWidth: { sm: 200 } }}
                  helperText="60 to 86400 seconds."
                />
                <TextField
                  label="Comment (optional)"
                  value={form.comment}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      comment: event.target.value,
                    }))
                  }
                  sx={{ flex: 1 }}
                  helperText="Shown only in this dashboard."
                />
              </Stack>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 1,
                }}
              >
                <Button
                  color="inherit"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
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
                  {editing === null ? "Create record" : "Save record"}
                </Button>
              </Box>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        useFlexGap
      >
        <TextField
          label="Search records"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, domain or value"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded />
                </InputAdornment>
              ),
            },
            htmlInput: {
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
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as "all" | DnsRecordType)
          }
          sx={{ minWidth: { sm: 170 } }}
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
        <Alert severity="error">{loadError}</Alert>
      ) : null}

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : domains.length === 0 ? (
        <Card sx={{ borderStyle: "dashed", textAlign: "center", py: 6 }}>
          <CardContent>
            <Typography variant="h3" component="h2">
              No domains yet
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ mt: 1, maxWidth: 420, mx: "auto" }}
            >
              Register a domain on the Domains tab first, then its
              records will live here.
            </Typography>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card sx={{ borderStyle: "dashed", textAlign: "center", py: 6 }}>
          <CardContent>
            <Typography variant="h3" component="h2">
              No records found
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ mt: 1, maxWidth: 420, mx: "auto" }}
            >
              {rows.length === 0
                ? "Create your first record above, or manage records from a domain on the Domains tab."
                : "Try a different search or type filter."}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((row) => {
            const { record } = row;
            const sync = SYNC_META[record.syncStatus];
            return (
              <Paper
                key={record.id}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  backgroundColor: (theme) =>
                    alpha(theme.palette.background.paper, 0.7),
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      sx={{
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography
                        dir="auto"
                        sx={{
                          fontFamily: FONT_MONO,
                          fontWeight: 600,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {record.name}
                      </Typography>
                      <Chip
                        size="small"
                        variant="filled"
                        label={record.type}
                        color={TYPE_COLOR[record.type]}
                        sx={{ fontFamily: FONT_MONO }}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={sync.label}
                        color={sync.color}
                      />
                    </Stack>
                    <Typography
                      dir="auto"
                      variant="body2"
                      color="textSecondary"
                      sx={{
                        fontFamily: FONT_MONO,
                        overflowWrap: "anywhere",
                        mt: 0.5,
                      }}
                    >
                      {record.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      dir="auto"
                      sx={{ display: "block", mt: 0.5 }}
                    >
                      {row.domain} · TTL {record.ttl}s
                      {record.comment
                        ? ` · ${record.comment}`
                        : ""}
                    </Typography>
                    {record.syncError ? (
                      <Typography
                        variant="caption"
                        color="error"
                        dir="auto"
                        sx={{ display: "block", mt: 0.5 }}
                      >
                        {record.syncError}
                      </Typography>
                    ) : null}
                  </Box>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ flexShrink: 0 }}
                  >
                    <Tooltip title="Copy value">
                      <IconButton
                        size="small"
                        aria-label="Copy value"
                        onClick={() => {
                          void handleCopy(record.value, "Value");
                        }}
                      >
                        <ContentCopyRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {record.syncStatus !== "synced" ? (
                      <Tooltip title="Retry publishing">
                        <IconButton
                          size="small"
                          aria-label="Retry publishing"
                          disabled={retryingId === record.id}
                          onClick={() => {
                            void handleRetry(row);
                          }}
                        >
                          <RefreshRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    <Tooltip title="Edit record">
                      <IconButton
                        size="small"
                        aria-label="Edit record"
                        onClick={() => openEditForm(row)}
                      >
                        <ModeEditOutlineRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete record">
                      <IconButton
                        size="small"
                        aria-label="Delete record"
                        onClick={() => setDeletingRow(row)}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <ConfirmDialog
        open={deletingRow !== null}
        title="Remove DNS record?"
        message={
          deletingRow
            ? `Remove the ${deletingRow.record.type} record for ${deletingRow.record.name}? It will stop resolving and stop routing through the proxy.`
            : ""
        }
        confirmLabel="Remove"
        loading={isDeleting}
        onConfirm={() => {
          void handleDelete();
        }}
        onClose={() => {
          if (!isDeleting) {
            setDeletingRow(null);
          }
        }}
      />
    </Box>
  );
}
