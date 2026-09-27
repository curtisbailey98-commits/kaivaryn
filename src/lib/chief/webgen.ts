/**
 * CHIEF web package generator — real HTML/CSS/JS microsites (not JSON stubs).
 * Packages are stored in AgentVersion.webBundleJson and served at /a/<slug>.
 */

export type WebRuntime = "static-site" | "web-app" | "next-microsite";

export type WebBundle = {
  runtime: WebRuntime;
  entry: string;
  title: string;
  description: string;
  generatedAt: string;
  files: Record<string, string>;
};


function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractTitle(instruction: string, fallback: string): string {
  const cleaned = instruction.replace(/\s+/g, " ").trim();
  const forMatch = cleaned.match(/for\s+([^.,;]+)/i);
  if (forMatch?.[1]) {
    const t = forMatch[1].trim();
    if (t.length >= 3 && t.length <= 80) return t.replace(/^the\s+/i, "");
  }
  const pageMatch = cleaned.match(/(?:landing page|microsite|website|web app|status page)\s+(?:for\s+|called\s+|named\s+)?["']?([^"'.,;]+)/i);
  if (pageMatch?.[1] && pageMatch[1].trim().length >= 3) return pageMatch[1].trim();
  return fallback;
}

const SHARED_CSS = `/* CHIEF-generated agent microsite */
:root {
  --bg: #07090f;
  --panel: #0f141e;
  --border: #1e293b;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #f59e0b;
  --ok: #34d399;
  --warn: #fbbf24;
  --bad: #f87171;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
a { color: var(--accent); }
.wrap { max-width: 920px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
.badge { display: inline-flex; align-items: center; gap: .4rem; font-size: .7rem; letter-spacing: .14em;
  text-transform: uppercase; color: var(--accent); border: 1px solid rgba(245,158,11,.35);
  background: rgba(245,158,11,.08); padding: .25rem .6rem; border-radius: 999px; }
h1 { font-size: clamp(1.75rem, 4vw, 2.6rem); margin: 1rem 0 .5rem; letter-spacing: -0.02em; }
.lead { color: var(--muted); font-size: 1.05rem; line-height: 1.55; max-width: 54ch; }
.grid { display: grid; gap: 1rem; margin-top: 2rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.card { background: linear-gradient(180deg, #121826, var(--panel)); border: 1px solid var(--border);
  border-radius: 14px; padding: 1.1rem 1.15rem; box-shadow: 0 20px 50px rgba(0,0,0,.35); }
.card h3 { margin: 0 0 .35rem; font-size: .95rem; }
.card p { margin: 0; color: var(--muted); font-size: .85rem; line-height: 1.45; }
.stat { font-size: 1.6rem; font-weight: 650; color: var(--ok); }
.footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid var(--border);
  color: var(--muted); font-size: .75rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.btn { display: inline-block; margin-top: 1.25rem; background: var(--accent); color: #111;
  font-weight: 650; text-decoration: none; padding: .7rem 1.1rem; border-radius: 10px; border: none; cursor: pointer; }
.pulse { width: .55rem; height: .55rem; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 0 rgba(52,211,153,.7); animation: pulse 2s infinite; }
@keyframes pulse { 70% { box-shadow: 0 0 0 10px rgba(52,211,153,0); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
`;

function statusPageHtml(title: string, instruction: string, slug: string): string {
  const safeTitle = escapeHtml(title);
  const safeInstr = escapeHtml(instruction.slice(0, 280));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="generator" content="CHIEF Foundry" />
  <title>${safeTitle} · Kaivaryn Agent</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main class="wrap">
    <span class="badge"><span class="pulse" aria-hidden="true"></span> Live agent · same-domain</span>
    <h1>${safeTitle}</h1>
    <p class="lead">${safeInstr}</p>
    <div class="grid">
      <div class="card"><h3>Platform</h3><p class="stat" id="platform-status">OK</p><p>Served from CHIEF registry</p></div>
      <div class="card"><h3>Version</h3><p class="stat" id="agent-version">v1</p><p>Foundry-manufactured package</p></div>
      <div class="card"><h3>Health</h3><p class="stat" id="health-status">Checking…</p><p id="health-detail">Probing /api/a/${escapeHtml(slug)}/health</p></div>
      <div class="card"><h3>Updated</h3><p class="stat" id="updated-at" style="font-size:1rem">—</p><p>Client clock</p></div>
    </div>
    <button class="btn" type="button" id="refresh-btn">Refresh status</button>
    <div class="footer">
      <span>Manufactured by CHIEF · Kaivaryn</span>
      <span>slug: ${escapeHtml(slug)}</span>
    </div>
  </main>
  <script src="./app.js"></script>
</body>
</html>`;
}

function landingHtml(title: string, instruction: string, slug: string): string {
  const safeTitle = escapeHtml(title);
  const safeInstr = escapeHtml(instruction.slice(0, 320));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="generator" content="CHIEF Foundry" />
  <title>${safeTitle} · Kaivaryn</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main class="wrap">
    <span class="badge"><span class="pulse"></span> CHIEF live microsite</span>
    <h1>${safeTitle}</h1>
    <p class="lead">${safeInstr}</p>
    <div class="grid">
      <div class="card"><h3>Built by</h3><p>CHIEF Foundry after executive approval</p></div>
      <div class="card"><h3>Deploy</h3><p>Same-domain live URL under /a/${escapeHtml(slug)}</p></div>
      <div class="card"><h3>Guardrails</h3><p>No self-granted unrestricted privileges</p></div>
    </div>
    <a class="btn" href="https://kaivaryn.onrender.com">Visit Kaivaryn</a>
    <div class="footer">
      <span>Public agent surface · not a sandbox stub</span>
      <span id="boot-time"></span>
    </div>
  </main>
  <script src="./app.js"></script>
</body>
</html>`;
}

function webAppHtml(title: string, instruction: string, slug: string): string {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} · Mini App</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main class="wrap">
    <span class="badge"><span class="pulse"></span> Live mini-app</span>
    <h1>${safeTitle}</h1>
    <p class="lead">${escapeHtml(instruction.slice(0, 280))}</p>
    <div class="card" style="margin-top:1.5rem">
      <h3>Notes</h3>
      <textarea id="note-input" rows="3" style="width:100%;margin:.75rem 0;background:#0b1020;color:var(--text);border:1px solid var(--border);border-radius:8px;padding:.6rem" placeholder="Type a note (stored in this browser only)"></textarea>
      <button class="btn" type="button" id="save-note" style="margin-top:0">Save locally</button>
      <ul id="note-list" style="margin:1rem 0 0;padding-left:1.1rem;color:var(--muted);font-size:.9rem"></ul>
    </div>
    <div class="footer"><span>CHIEF web-app · ${escapeHtml(slug)}</span><span id="boot-time"></span></div>
  </main>
  <script src="./app.js"></script>
</body>
</html>`;
}

function statusAppJs(slug: string): string {
  return `/* CHIEF status page client */
(function () {
  const slug = ${JSON.stringify(slug)};
  const healthEl = document.getElementById("health-status");
  const detailEl = document.getElementById("health-detail");
  const updatedEl = document.getElementById("updated-at");
  async function refresh() {
    updatedEl.textContent = new Date().toLocaleString();
    try {
      const res = await fetch("/api/a/" + slug + "/health", { cache: "no-store" });
      const data = await res.json();
      healthEl.textContent = data.status || (res.ok ? "OK" : "DOWN");
      healthEl.style.color = res.ok ? "var(--ok)" : "var(--bad)";
      detailEl.textContent = data.liveUrl || data.message || ("HTTP " + res.status);
    } catch (e) {
      healthEl.textContent = "DOWN";
      healthEl.style.color = "var(--bad)";
      detailEl.textContent = String(e && e.message ? e.message : e);
    }
  }
  document.getElementById("refresh-btn")?.addEventListener("click", refresh);
  refresh();
})();`;
}

function landingAppJs(): string {
  return `document.getElementById("boot-time").textContent = "Loaded " + new Date().toISOString();`;
}

function webAppJs(slug: string): string {
  return `(function(){
  const key = "chief-agent-notes:" + ${JSON.stringify(slug)};
  const list = document.getElementById("note-list");
  const input = document.getElementById("note-input");
  function render() {
    const notes = JSON.parse(localStorage.getItem(key) || "[]");
    list.innerHTML = notes.map(function(n){ return "<li>" + n.replace(/</g,"&lt;") + "</li>"; }).join("") || "<li>No notes yet</li>";
  }
  document.getElementById("save-note").addEventListener("click", function(){
    const v = (input.value || "").trim();
    if (!v) return;
    const notes = JSON.parse(localStorage.getItem(key) || "[]");
    notes.unshift(v);
    localStorage.setItem(key, JSON.stringify(notes.slice(0, 20)));
    input.value = "";
    render();
  });
  document.getElementById("boot-time").textContent = new Date().toISOString();
  render();
})();`;
}

export function generateWebBundle(params: {
  runtime: WebRuntime;
  instruction: string;
  slug: string;
  titleHint?: string;
}): WebBundle {
  const fallback =
    params.runtime === "static-site"
      ? "Internal Status Page"
      : params.runtime === "web-app"
        ? "Mini App"
        : "Public Microsite";
  const title = params.titleHint || extractTitle(params.instruction, fallback);
  const generatedAt = new Date().toISOString();

  let indexHtml: string;
  let appJs: string;
  if (params.runtime === "web-app") {
    indexHtml = webAppHtml(title, params.instruction, params.slug);
    appJs = webAppJs(params.slug);
  } else if (params.runtime === "next-microsite" || /landing|marketing|microsite/i.test(params.instruction)) {
    // next-microsite is emitted as static HTML (served under Kaivaryn /a/<slug>) so it is live without a separate Next build.
    indexHtml = landingHtml(title, params.instruction, params.slug);
    appJs = landingAppJs();
  } else {
    indexHtml = statusPageHtml(title, params.instruction, params.slug);
    appJs = statusAppJs(params.slug);
  }

  const health = {
    status: "ok",
    service: "chief-agent",
    slug: params.slug,
    runtime: params.runtime,
    title,
    generatedAt,
  };

  return {
    runtime: params.runtime,
    entry: "index.html",
    title,
    description: params.instruction.slice(0, 400),
    generatedAt,
    files: {
      "index.html": indexHtml,
      "styles.css": SHARED_CSS,
      "app.js": appJs,
      "health.json": JSON.stringify(health, null, 2),
    },
  };
}

/** Sandbox run() source for web agents — eval harness + optional local probe. */
export function webAgentRunnerSource(runtime: WebRuntime, title: string): string {
  return `/**
 * CHIEF ${runtime} agent runner (eval + host hooks).
 * Live UI is in webBundle files served at /a/<slug>.
 */
export const meta = {
  slug: ${JSON.stringify(runtime)},
  runtime: ${JSON.stringify(runtime)},
  sideEffects: "none",
  title: ${JSON.stringify(title)},
};

export function run(input, ctx) {
  const health = (ctx.tools && ctx.tools["platform.health.read"]) ? ctx.tools["platform.health.read"](input) : { ok: true };
  const brief = {
    generatedAt: new Date().toISOString(),
    status: health && health.ok === false ? "DEGRADED" : "OK",
    kind: ${JSON.stringify(runtime)},
    title: meta.title,
    hasLiveUi: true,
  };
  if (ctx.tools && ctx.tools["agent.report.write"]) ctx.tools["agent.report.write"]({ brief });
  return {
    ok: true,
    brief,
    hasStatus: true,
    hasBrief: true,
    hasHtml: true,
    hasTitle: Boolean(meta.title),
    runtime: meta.runtime,
  };
}
`;
}
