import { Code, Globe } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      tone: "signal",
      kicker: "Fast claim",
      title: "Claim a domain in one pass",
      desc: "Choose a subdomain, pick an available suffix, and connect it without working through a long onboarding flow.",
    },
    {
      tone: "route",
      kicker: "Real infra",
      title: "Route to real infrastructure",
      desc: "Point traffic at a home server, VPS, tunnel endpoint, or internal hostname using the same form pattern every time.",
    },
    {
      tone: "review",
      kicker: "Measured review",
      title: "Review traffic when it matters",
      desc: "Open analytics only when you need them so the main workspace stays focused on routing decisions.",
    },
  ] as const;

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (token) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL?.trim() || "/api"}/auth/github`;
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="hero-layout">
          <div className="hero-copy surface-enter">
            <div className="eyebrow">
              <Globe className="w-4 h-4" /> Domain routing for personal
              apps
            </div>
            <h1 className="page-title">
              Claim a clean subdomain and point it where your service
              lives.
            </h1>
            <p className="hero-note">
              Domainak gives mixed technical teams one{" "}
              <span className="text-highlight">calm place</span> to
              register a readable hostname, connect it to a tunnel or
              server, and confirm that traffic is reaching the{" "}
              <span className="text-highlight text-highlight--warm">
                right destination
              </span>
              .
            </p>
            <div className="hero-actions">
              <button
                onClick={handleLogin}
                type="button"
                className="button button-primary"
              >
                <Code className="w-5 h-5" /> Continue with GitHub
              </button>
            </div>
          </div>

          <aside className="hero-aside surface-enter">
            <div className="panel__header">
              <p className="eyebrow">What you can do</p>
              <h2 className="panel__title">Fast setup, clear control</h2>
              <p className="panel__copy">
                Built for people who want routing to feel operational, not
                theatrical.
              </p>
            </div>

            <div className="feature-list" id="how-it-works">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="feature-item"
                  data-tone={feature.tone}
                >
                  <div className="feature-item__kicker">
                    {feature.kicker}
                  </div>
                  <div className="feature-item__title">
                    {feature.title}
                  </div>
                  <div className="feature-item__copy">{feature.desc}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>

      <footer className="app-main">
        <div className="footer-row">
          <p>
            Built by{" "}
            <a
              href="https://github.com/z44d"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              z44d
            </a>
          </p>
          <a
            href="https://t.me/zaidlab"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            <svg
              className="inline-block w-4 h-4 mr-2"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Follow release notes on Telegram
          </a>
        </div>
      </footer>
    </div>
  );
}
