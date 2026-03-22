"use client";

import { Github, Globe } from "lucide-react";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = `${process.env.BACKEND_URL}/api/auth/github`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950 -z-10" />

      <main className="container mx-auto px-6 pt-32 pb-16 text-center max-w-4xl flex flex-col items-center justify-center min-h-[80vh]">
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
    </div>
  );
}
