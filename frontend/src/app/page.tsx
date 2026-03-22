"use client";

import { Github, Globe } from "lucide-react";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (token) {
      window.location.href = "/dashboard";
    } else {
      setChecking(false);
    }
  }, []);

  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:2007/api"}/auth/github`;
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30 flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950 -z-10" />

      <main className="container mx-auto px-6 pt-32 pb-16 text-center max-w-4xl flex flex-col items-center justify-center flex-1">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 mb-8 animate-fade-in">
          <Globe className="w-4 h-4" />
          <span className="text-sm font-medium">
            Domainak Registration
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
          Claim Your Custom Subdomain. <br className="hidden md:block" />
          Free & instantly.
        </h1>

        <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          Link your home server, VPS, or tunnel to a readable subdomain.
          Secure authentication, simple management, and built-in visitor
          statistics.
        </p>

        <button
          onClick={handleLogin}
          type="button"
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-medium text-slate-950 bg-white rounded-full transition-all duration-300 hover:bg-slate-100 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          <Github className="w-5 h-5 transition-transform group-hover:-rotate-6" />
          Continue with GitHub
        </button>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left border-t border-slate-800 pt-16">
          {[
            {
              title: "Instant Setup",
              desc: "No DNS propagation delays. Your subdomain works the moment you claim it.",
            },
            {
              title: "Traffic Analytics",
              desc: "View detailed statistics of your domain traffic daily, weekly, and monthly.",
            },
            {
              title: "Free Always",
              desc: "Register domains provided by the platform completely free of charge.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/50"
            >
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-800 py-6">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>
            Made by{" "}
            <a
              href="https://github.com/z44d"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              z44d
            </a>
          </p>
          <a
            href="https://t.me/zaidlab"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-300 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Telegram Channel
          </a>
        </div>
      </footer>
    </div>
  );
}
