"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Plus, Trash2, Activity, Globe, Loader2, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [domains, setDomains] = useState<any[]>([]);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ subdomain: "", domain: "", hostname: "", port: "" });
  const [addError, setAddError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: userData } = await api.get("/auth/me");
      setUser(userData);
      
      const [domainsRes, availableRes] = await Promise.all([
        api.get("/domains"),
        api.get("/domains/available")
      ]);
      
      setDomains(domainsRes.data.domains);
      setAvailableDomains(availableRes.data.available);
      if (availableRes.data.available.length > 0) {
        setFormData(prev => ({ ...prev, domain: availableRes.data.available[0] }));
      }
    } catch (error) {
      window.location.href = "/";
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setIsSubmitting(true);
    try {
      await api.post("/domains", formData);
      setShowAddForm(false);
      setFormData({ subdomain: "", domain: availableDomains[0] || "", hostname: "", port: "" });
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
      setDomains(domains.filter(d => d.id !== id));
    } catch (error) {
      alert("Failed to delete domain");
    }
  };

  const DomainCard = ({ domain }: { domain: any }) => {
    const [stats, setStats] = useState<any>(null);
    const [showStats, setShowStats] = useState(false);

    const toggleStats = async () => {
      if (!showStats && !stats) {
        try {
          const res = await api.get(`/stats/${domain.id}`);
          setStats(res.data);
        } catch (error) {
          console.error("Failed to load stats");
        }
      }
      setShowStats(!showStats);
    };

    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{domain.subdomain}</h3>
              <p className="text-sm text-slate-400">Points to: {domain.hostname}:{domain.port}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleStats} className="p-2 text-slate-400 hover:text-indigo-400 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors">
              <Activity className="w-4 h-4" />
            </button>
            <button onClick={() => handleDelete(domain.id)} className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showStats && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-4" style={{ animation: "fadeIn 0.2s ease-out" }}>
            <div className="text-center p-3 bg-slate-950/50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Daily</p>
              <p className="text-xl font-semibold text-white">{stats?.daily || 0}</p>
            </div>
            <div className="text-center p-3 bg-slate-950/50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Weekly</p>
              <p className="text-xl font-semibold text-white">{stats?.weekly || 0}</p>
            </div>
            <div className="text-center p-3 bg-slate-950/50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Monthly</p>
              <p className="text-xl font-semibold text-white">{stats?.monthly || 0}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar user={user} />
      
      <main className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Your Domains</h1>
            <p className="text-slate-400">Manage your connected subdomains and view traffic analytics.</p>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> Add Domain
          </button>
        </div>

        {showAddForm && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 animate-fade-in shadow-xl shadow-black/50">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Register New Subdomain
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
                  <label className="text-sm font-medium text-slate-300">Subdomain</label>
                  <div className="flex rounded-lg shadow-sm">
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. my-app"
                      value={formData.subdomain}
                      onChange={e => setFormData({...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-l-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <select 
                      value={formData.domain}
                      onChange={e => setFormData({...formData, domain: e.target.value})}
                      className="bg-slate-800 border-y border-r border-slate-700 rounded-r-lg px-4 py-2.5 text-slate-300 focus:outline-none"
                    >
                      {availableDomains.map(d => <option key={d} value={d}>.{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Destination IP / Hostname</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 192.168.1.5 or my.tunnel.com"
                    value={formData.hostname}
                    onChange={e => setFormData({...formData, hostname: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Destination Port</label>
                  <input 
                    type="number" 
                    required
                    min={1} max={65535}
                    placeholder="e.g. 8080"
                    value={formData.port}
                    onChange={e => setFormData({...formData, port: e.target.value})}
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
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Register Subdomain
                </button>
              </div>
            </form>
          </div>
        )}

        {domains.length === 0 ? (
          <div className="text-center py-20 border border-slate-800 border-dashed rounded-2xl bg-slate-900/20">
            <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No domains yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto">You haven't registered any subdomains yet. Click the button above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {domains.map(domain => (
              <DomainCard key={domain.id} domain={domain} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
