-- Lua initialization for Domainak's OpenResty proxy.
--
-- This lives in its own file instead of an inline `init_by_lua_block` in
-- nginx.conf because nginx parses inline *_by_lua_block code through its
-- small config-file buffer (8 KB). The HTML template below is much larger,
-- so the nginx Lua parser cannot find the closing long bracket and refuses
-- to start with "Lua code block missing the closing long bracket".
--
-- The file is mounted into the container next to nginx.conf (see
-- docker-compose.yaml) and downloaded by setup.sh for deployments.

domainak_unregistered = {
    app_url = "https://domainak.z44d.com",
    app_host = "domainak.z44d.com",
    page = [==[
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#0B0F17" />
    <meta name="robots" content="noindex" />
    <title>@@host@@ · subdomain not registered</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --bg: #0b0f17;
        --bg-soft: #121a28;
        --card: rgba(18, 26, 40, 0.82);
        --border: rgba(255, 255, 255, 0.08);
        --text: #e9eef7;
        --muted: #9daac0;
        --accent: #22d3ee;
        --accent-soft: rgba(34, 211, 238, 0.14);
        --shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
      }

      @media (prefers-color-scheme: light) {
        :root {
          --bg: #f5f7fb;
          --bg-soft: #ffffff;
          --card: rgba(255, 255, 255, 0.9);
          --border: rgba(13, 21, 36, 0.1);
          --text: #0d1524;
          --muted: #4c5a70;
          --accent: #0891b2;
          --accent-soft: rgba(8, 145, 178, 0.12);
          --shadow: 0 24px 60px rgba(13, 21, 36, 0.12);
        }
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
      }

      body {
        background: var(--bg);
        color: var(--text);
        font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
        font-size: 16px;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 20px;
        position: relative;
        overflow-x: hidden;
      }

      body::before,
      body::after {
        content: "";
        position: fixed;
        border-radius: 50%;
        filter: blur(90px);
        opacity: 0.5;
        pointer-events: none;
        z-index: 0;
      }

      body::before {
        width: 520px;
        height: 520px;
        top: -180px;
        left: -140px;
        background: radial-gradient(
          circle,
          var(--accent-soft),
          transparent 70%
        );
      }

      body::after {
        width: 460px;
        height: 460px;
        bottom: -200px;
        right: -120px;
        background: radial-gradient(
          circle,
          rgba(139, 92, 246, 0.22),
          transparent 70%
        );
      }

      .wrap {
        position: relative;
        z-index: 1;
        width: 100%;
        max-width: 620px;
      }

      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 22px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px) saturate(150%);
        -webkit-backdrop-filter: blur(14px) saturate(150%);
        padding: 30px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        color: inherit;
      }

      .mark {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 12px;
        display: grid;
        place-items: center;
        color: #062a33;
        background: linear-gradient(135deg, #67e8f9, #22d3ee);
        box-shadow: 0 6px 18px rgba(34, 211, 238, 0.35);
      }

      .brand-name {
        font-family: "Space Grotesk", "Inter", Arial, sans-serif;
        font-weight: 700;
        font-size: 1.12rem;
        line-height: 1.15;
        letter-spacing: -0.02em;
      }

      .brand-sub {
        display: block;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.2;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 26px 0 16px;
        padding: 5px 13px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .badge-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 0 4px var(--accent-soft);
      }

      h1 {
        margin: 0 0 12px;
        font-family: "Space Grotesk", "Inter", Arial, sans-serif;
        font-size: 2.1rem;
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -0.035em;
      }

      .lede {
        margin: 0;
        max-width: 46ch;
        color: var(--muted);
      }

      .lede strong {
        color: var(--text);
        font-weight: 600;
      }

      .field {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 22px 0 24px;
        padding: 12px 12px 12px 16px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: rgba(13, 21, 36, 0.28);
      }

      @media (prefers-color-scheme: light) {
        .field {
          background: rgba(13, 21, 36, 0.03);
        }
      }

      .field-host {
        flex: 1;
        min-width: 0;
        font-family: "JetBrains Mono", ui-monospace, SFMono-Regular,
          Menlo, monospace;
        font-size: 0.95rem;
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .copy {
        flex-shrink: 0;
        padding: 7px 14px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: transparent;
        color: var(--muted);
        font: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.18s ease, border-color 0.18s ease;
      }

      .copy:hover,
      .copy:focus-visible {
        color: var(--accent);
        border-color: var(--accent);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 46px;
        padding: 0 24px;
        border-radius: 999px;
        font-weight: 600;
        text-decoration: none;
        transition: transform 0.18s ease, box-shadow 0.18s ease,
          background 0.18s ease;
      }

      .btn-primary {
        background: linear-gradient(135deg, #67e8f9, #22d3ee);
        color: #062a33;
        box-shadow: 0 10px 26px rgba(34, 211, 238, 0.28);
      }

      .btn-primary:hover,
      .btn-primary:focus-visible {
        transform: translateY(-1px);
        box-shadow: 0 14px 32px rgba(34, 211, 238, 0.36);
      }

      .btn-ghost {
        border: 1px solid var(--border);
        color: var(--muted);
      }

      .btn-ghost:hover,
      .btn-ghost:focus-visible {
        color: var(--text);
        border-color: var(--accent);
      }

      .steps {
        display: grid;
        gap: 10px;
        margin: 26px 0 0;
        padding: 22px 0 0;
        border-top: 1px solid var(--border);
        list-style: none;
      }

      .steps li {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        color: var(--muted);
        font-size: 0.92rem;
      }

      .step-index {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .steps b {
        color: var(--text);
        font-weight: 600;
      }

      footer {
        margin-top: 18px;
        text-align: center;
        color: var(--muted);
        font-size: 0.8rem;
      }

      footer a {
        color: inherit;
        text-decoration: none;
      }

      footer a:hover,
      footer a:focus-visible {
        color: var(--accent);
      }

      @media (max-width: 560px) {
        .card {
          padding: 24px 20px;
        }

        h1 {
          font-size: 1.7rem;
        }

        .actions .btn {
          width: 100%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          animation: none !important;
          transition: none !important;
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="card">
        <a class="brand" href="@@app_url@@">
          <span class="mark" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18" />
              <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
            </svg>
          </span>
          <span>
            <span class="brand-name">Domainak</span>
            <span class="brand-sub">routing control</span>
          </span>
        </a>

        <div class="badge">
          <span class="badge-dot" aria-hidden="true"></span>
          404 · no route
        </div>

        <h1>This subdomain isn&rsquo;t claimed yet.</h1>
        <p class="lede">
          <strong>@@host@@</strong> is not registered on Domainak, so there is
          no destination behind it. Reserve the name, point it at your server
          or tunnel, and it starts serving traffic in under a minute.
        </p>

        <div class="field">
          <span class="field-host" id="host">@@host@@</span>
          <button
            class="copy"
            type="button"
            data-copy="@@host@@"
            data-copy-label
          >
            Copy
          </button>
        </div>

        <div class="actions">
          <a class="btn btn-primary" href="@@claim_url@@">
            Reserve this subdomain
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </a>
          <a class="btn btn-ghost" href="@@app_url@@">
            Go to @@app_host@@
          </a>
        </div>

        <ol class="steps">
          <li>
            <span class="step-index">1</span>
            <span>Sign in with GitHub to open your workspace.</span>
          </li>
          <li>
            <span class="step-index">2</span>
            <span>
              Claim <b>@@host@@</b> and enter a destination host and port, or a
              redirect target.
            </span>
          </li>
          <li>
            <span class="step-index">3</span>
            <span>Domainak proxies the hostname, with traffic stats per route.</span>
          </li>
        </ol>
      </div>

      <footer>
        Served by Domainak ·
        <a href="https://github.com/z44d">github.com/z44d</a>
      </footer>
    </main>

    <script>
      (function () {
        var button = document.querySelector("[data-copy]");
        if (!button) {
          return;
        }

        var value = button.getAttribute("data-copy") || "";
        var label = button.querySelector("[data-copy-label]");
        var original = label ? label.textContent : "";

        function announce(ok) {
          if (!label) {
            return;
          }
          label.textContent = ok ? "Copied" : "Ctrl+C";
          window.setTimeout(function () {
            label.textContent = original;
          }, 1600);
        }

        button.addEventListener("click", function () {
          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(value).then(
              function () {
                announce(true);
              },
              function () {
                announce(false);
              },
            );
            return;
          }

          var field = document.createElement("textarea");
          field.value = value;
          field.setAttribute("readonly", "");
          field.style.position = "fixed";
          field.style.opacity = "0";
          document.body.appendChild(field);
          field.select();

          try {
            announce(document.execCommand("copy"));
          } catch (error) {
            announce(false);
          }

          document.body.removeChild(field);
        });
      })();
    </script>
  </body>
</html>
]==],
}

-- Replaces @@key@@ placeholders in the page template with values[key].
function domainak_render(template, values)
    return (template:gsub("@@([%w_]+)@@", function(key)
        return values[key] or ""
    end))
end
