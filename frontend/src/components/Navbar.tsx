"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

export function Navbar({ user }: { user: any }) {
  const handleLogout = async () => {
    localStorage.removeItem("session_token");
    await api.post("/auth/logout");
    window.location.href = "/";
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent"
        >
          Domainak
        </Link>

        {user && (
          <div className="flex items-center gap-6">
            {user.isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Settings className="w-4 h-4" /> Admin
              </Link>
            )}

            <div className="flex items-center gap-4 pl-6 border-l border-slate-800">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-slate-700"
                />
                <span className="text-sm font-medium text-slate-300 hidden sm:block">
                  {user.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                type="button"
                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
