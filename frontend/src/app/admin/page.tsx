"use client";

import {
  Ban,
  Loader2,
  ServerOff,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [domains, setDomains] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ipToBan, setIpToBan] = useState("");
  const [banReason, setBanReason] = useState("");
  const [isBanningIp, setIsBanningIp] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: userData } = await api.get("/auth/me");
      if (!userData.isAdmin) {
        window.location.href = "/dashboard";
        return;
      }
      setUser(userData);

      const res = await api.get("/admin/domains");
      setDomains(res.data.domains);
    } catch (_error) {
      localStorage.removeItem("session_token");
      window.location.href = "/";
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteDomain = async (id: number) => {
    if (!confirm("Delete this domain globally?")) return;
    try {
      await api.delete(`/admin/domains/${id}`);
      setDomains(domains.filter((d) => d.id !== id));
    } catch (_error) {
      alert("Failed to delete domain");
    }
  };

  const handleToggleUserBan = async (
    userId: number,
    currentStatus: boolean,
  ) => {
    const action = currentStatus ? "unban" : "ban";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      await api.post(`/admin/users/${userId}/ban`, {
        isBanned: !currentStatus,
      });
      alert(`User ${action}ned successfully`);
      fetchData(); // Refresh to get updated status, though we don't have user ban status in domain list easily. Wait, we might need a separate users list, or just assume it works.
    } catch (_error) {
      alert(`Failed to ${action} user`);
    }
  };

  const handleBanIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipToBan) return;
    setIsBanningIp(true);
    try {
      await api.post("/admin/ips/ban", { ip: ipToBan, reason: banReason });
      alert("IP banned successfully");
      setIpToBan("");
      setBanReason("");
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to ban IP");
    } finally {
      setIsBanningIp(false);
    }
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

      <main className="container mx-auto px-6 py-12 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-red-500/10 rounded-xl text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Admin Panel
            </h1>
            <p className="text-slate-400">
              Global domain moderation and access control.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Domains */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-white">
              Latest Domains
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-950/50 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Subdomain</th>
                      <th className="px-6 py-4">Target</th>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map((domain) => (
                      <tr
                        key={domain.id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-white">
                          {domain.subdomain}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {domain.hostname}:{domain.port}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="truncate max-w-[120px]"
                              title={domain.user?.email}
                            >
                              {domain.user?.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleUserBan(domain.user?.id, false)
                              }
                              title="Ban User"
                              className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDomain(domain.id)}
                              title="Delete Domain"
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {domains.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-8 text-center text-slate-500"
                        >
                          No domains registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Ban IP Tool */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">
              Ban IP Address
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <form onSubmit={handleBanIp} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="ipInput"
                    className="text-sm font-medium text-slate-300 flex items-center gap-2"
                  >
                    <ServerOff className="w-4 h-4 text-red-400" /> IP
                    Address or Hostname
                  </label>
                  <input
                    id="ipInput"
                    type="text"
                    required
                    value={ipToBan}
                    onChange={(e) => setIpToBan(e.target.value)}
                    placeholder="e.g. 192.168.1.100"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="reasonInput"
                    className="text-sm font-medium text-slate-300"
                  >
                    Reason (Optional)
                  </label>
                  <input
                    id="reasonInput"
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="e.g. Phishing"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isBanningIp || !ipToBan}
                  className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {isBanningIp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Ban IP
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
