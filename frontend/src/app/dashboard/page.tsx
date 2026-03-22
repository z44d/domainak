"use client";

import {
  Activity,
  AlertCircle,
  Calendar,
  Globe,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navbar } from "@/components/Navbar";
import { api } from "@/lib/api";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [domains, setDomains] = useState<any[]>([]);
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: userData } = await api.get("/auth/me");
      setUser(userData);

      const [domainsRes, availableRes] = await Promise.all([
        api.get("/domains"),
        api.get("/domains/available"),
      ]);

      setDomains(domainsRes.data.domains);
      setAvailableDomains(availableRes.data.available);
      if (availableRes.data.available.length > 0) {
        setFormData((prev) => ({
          ...prev,
          domain: availableRes.data.available[0],
        }));
      }
    } catch (_error) {
      window.location.href = "/";
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setIsSubmitting(true);
    try {
      await api.post("/domains", formData);
      setShowAddForm(false);
      setFormData({
        subdomain: "",
        domain: availableDomains[0] || "",
        hostname: "",
        port: "",
      });
      fetchData();
    } catch (error: any) {
      setAddError(error.response?.data?.error || "Failed to add domain");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this domain?")) return;
    try {
      await api.delete(`/domains/${id}`);
      setDomains(domains.filter((d) => d.id !== id));
    } catch (_error) {
      alert("Failed to delete domain");
    }
  };

  const DomainCard = ({ domain }: { domain: any }) => {
    const [stats, setStats] = useState<any>(null);
    const [showStats, setShowStats] = useState(false);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // Generate an array of recent years for the dropdown
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) =>
      (currentYear - i).toString(),
    );
    const [year, setYear] = useState<string>(currentYear.toString());

    const fetchStats = async (selectedYear: string) => {
      setIsLoadingStats(true);
      try {
        const res = await api.get(
          `/stats/${domain.id}?year=${selectedYear}`,
        );
        setStats(res.data);
      } catch (_error) {
        console.error("Failed to load stats");
      } finally {
        setIsLoadingStats(false);
      }
    };

    const toggleStats = async () => {
      if (!showStats && !stats) {
        await fetchStats(year);
      }
      setShowStats(!showStats);
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newYear = e.target.value;
      setYear(newYear);
      if (showStats) {
        fetchStats(newYear);
      }
    };

    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {domain.subdomain}
              </h3>
              <p className="text-sm text-slate-400">
                Points to: {domain.hostname}:{domain.port}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleStats}
              className={`p-2 rounded-lg transition-colors ${showStats ? "bg-indigo-500/20 text-indigo-400" : "text-slate-400 hover:text-indigo-400 bg-slate-800/50 hover:bg-slate-800"}`}
            >
              <Activity className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(domain.id)}
              className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showStats && (
          <div className="mt-6 pt-6 border-t border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Visitor Analytics
              </h4>
              <div className="flex items-center gap-2 bg-slate-950 rounded-lg px-3 py-1.5 border border-slate-800">
                <Calendar className="w-4 h-4 text-slate-400" />
                <select
                  value={year}
                  onChange={handleYearChange}
                  className="bg-transparent text-sm text-white focus:outline-none appearance-none cursor-pointer pr-4"
                >
                  {years.map((y) => (
                    <option key={y} value={y} className="bg-slate-900">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoadingStats && !stats ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : stats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-slate-950/50 rounded-xl border border-slate-800/50 hover:border-indigo-500/30 transition-colors">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">
                      Daily
                    </p>
                    <p className="text-2xl font-bold font-mono text-white">
                      {stats.daily.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-slate-950/50 rounded-xl border border-slate-800/50 hover:border-indigo-500/30 transition-colors">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">
                      Weekly
                    </p>
                    <p className="text-2xl font-bold font-mono text-white">
                      {stats.weekly.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-slate-950/50 rounded-xl border border-slate-800/50 hover:border-indigo-500/30 transition-colors">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">
                      Monthly
                    </p>
                    <p className="text-2xl font-bold font-mono text-white">
                      {stats.monthly.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 hover:border-indigo-500/40 transition-colors relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4" />
                    <p className="text-xs text-indigo-400/80 uppercase tracking-wider mb-2 font-medium">
                      Total
                    </p>
                    <p className="text-2xl font-bold font-mono text-indigo-400">
                      {stats.total.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="h-64 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#334155"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          value >= 1000
                            ? `${(value / 1000).toFixed(1)}k`
                            : value
                        }
                      />
                      <Tooltip
                        cursor={{ fill: "#1e293b" }}
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          color: "#f8fafc",
                        }}
                        itemStyle={{ color: "#818cf8", fontWeight: 600 }}
                      />
                      <Bar
                        dataKey="visitors"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                        animationDuration={1000}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar user={user} />

      <main className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Your Domains
            </h1>
            <p className="text-slate-400">
              Manage your connected subdomains and view traffic analytics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> Add Domain
          </button>
        </div>

        {showAddForm && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 animate-fade-in shadow-xl shadow-black/50">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Register New
              Subdomain
            </h2>

            {addError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{addError}</p>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label
                    htmlFor="subdomainInput"
                    className="text-sm font-medium text-slate-300"
                  >
                    Subdomain
                  </label>
                  <div className="flex rounded-lg shadow-sm">
                    <input
                      id="subdomainInput"
                      type="text"
                      required
                      placeholder="e.g. my-app"
                      value={formData.subdomain}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subdomain: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        })
                      }
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-l-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <select
                      value={formData.domain}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          domain: e.target.value,
                        })
                      }
                      className="bg-slate-800 border-y border-r border-slate-700 rounded-r-lg px-4 py-2.5 text-slate-300 focus:outline-none"
                    >
                      {availableDomains.map((d) => (
                        <option key={d} value={d}>
                          .{d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="hostnameInput"
                    className="text-sm font-medium text-slate-300"
                  >
                    Destination IP / Hostname
                  </label>
                  <input
                    id="hostnameInput"
                    type="text"
                    required
                    placeholder="e.g. 192.168.1.5 or my.tunnel.com"
                    value={formData.hostname}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hostname: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="portInput"
                    className="text-sm font-medium text-slate-300"
                  >
                    Destination Port
                  </label>
                  <input
                    id="portInput"
                    type="number"
                    required
                    min={1}
                    max={65535}
                    placeholder="e.g. 8080"
                    value={formData.port}
                    onChange={(e) =>
                      setFormData({ ...formData, port: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2.5 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Register Subdomain
                </button>
              </div>
            </form>
          </div>
        )}

        {domains.length === 0 ? (
          <div className="text-center py-20 border border-slate-800 border-dashed rounded-2xl bg-slate-900/20">
            <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              No domains yet
            </h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              You haven't registered any subdomains yet. Click the button
              above to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {domains.map((domain) => (
              <DomainCard key={domain.id} domain={domain} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
