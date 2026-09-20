/* ══════════════════════════════════════════════════════════════════════
   BotForge — docs: full deployment & usage guide
   ══════════════════════════════════════════════════════════════════════ */

'use strict';

route('/docs', async (app) => {
  app.innerHTML = `
  <div class="container" style="max-width:900px">
    <div style="padding:44px 0 10px">
      <h1>📚 Documentation</h1>
      <p class="muted">Everything you need to deploy BotForge itself, connect your Render account and ship your first WhatsApp bot.</p>
    </div>

    <div class="doc-toc">
      <b>On this page</b>
      <a href="#deploy-knightbot">📱 Deploy KnightBot Mini (WhatsApp) — 2 minutes</a>
      <a href="#local-runner">🖥️ Run bots on our site (built-in runner)</a>
      <a href="#pair-qr">🔗 Pair via QR code or pairing code</a>
      <a href="#self-host">🛠 Deploy BotForge itself on Render</a>
      <a href="#render-key">🔑 Get a Render API key</a>
      <a href="#env-api">⚙️ Environment variables</a>
      <a href="#api">🌐 REST API reference</a>
      <a href="#keepalive">💓 24/7 keep-alive</a>
      <a href="#faq-tech">🧯 Troubleshooting</a>
    </div>

    <div class="doc-body">

      <h2 id="deploy-knightbot">📱 Deploy KnightBot Mini (WhatsApp)</h2>
      <p>KnightBot Mini is a Baileys-based WhatsApp MD bot with 200+ commands. BotForge deploys it from the official repo <code>mruniquehacker/KnightBot-Mini</code> in one flow:</p>
      <ol>
        <li>Create a BotForge account (first account becomes <b>admin</b>).</li>
        <li>Open <b>Deploy → KnightBot Mini</b> (or click its card on the home page).</li>
        <li>(Optional) Paste a <code>SESSION_ID</code> session string if you already have one — otherwise skip and pair with QR.</li>
        <li>Pick where it runs: <b>🖥️ Run on our site</b> (recommended — executes right on the BotForge server, no Render account needed) or <b>☁️ Deploy to Render</b> (3–8 minute build).</li>
        <li>Open the service → <b>📱 QR Pairing</b> tab → scan the QR with WhatsApp → Linked Devices.</li>
      </ol>
      <p>When you see <b>✅ WhatsApp connected</b> in the QR tab, your bot is live on your number, 24/7.</p>

      <h3>Session string format</h3>
      <p>KnightBot reads the <code>SESSION_ID</code> env var and expects <code>KnightBot!</code> followed by a base64 gzip of <code>creds.json</code>:</p>
      <pre><code>SESSION_ID = "KnightBot!" + base64( gzip( JSON.stringify(creds.json) ) )</code></pre>
      <p>If you deploy with a valid session string, no QR scan is needed — the bot logs in instantly. You can get one by pairing once with QR, then copying the session from the logs or the repo's own pair tool.</p>

      <h2 id="local-runner">🖥️ Run bots on our site (built-in runner)</h2>
      <p>Besides deploying to Render, BotForge has its own <b>built-in runner</b>: services deployed with
      <b>“Run on our site”</b> execute <i>on the BotForge server itself</i>. No second hosting account, no
      API key, no separate dashboard — the panel clones the repo, installs dependencies and runs the app
      as a managed child process.</p>

      <h3>How it works</h3>
      <ol>
        <li><b>Clone</b> — the repo is fetched into <code>data/apps/&lt;service-id&gt;</code> (Node deps with
        <code>npm install --omit=dev</code>, or a Python venv for Python apps).</li>
        <li><b>Spawn</b> — the app’s start command runs as a detached child with its own process group,
        a scrubbed environment and a dedicated port from the <code>LOCAL_PORT_START</code> pool.</li>
        <li><b>Monitor</b> — stdout/stderr stream into the service’s Logs tab; the runner captures QR codes,
        pairing codes and login events, auto-restarts on crash (up to 5 times) and tracks uptime.</li>
        <li><b>Serve</b> — web services are exposed on the panel’s own domain at
        <code>/svc/&lt;service-name&gt;</code> via a built-in reverse proxy.</li>
      </ol>

      <h3>WhatsApp pairing, zero extra tools</h3>
      <p>For Baileys-based bots like KnightBot, the runner injects a tiny module hook (<code>src/qrshim.js</code>)
      that captures the <b>raw QR string</b> before it is printed as ASCII art. The QR Pairing tab renders it as a
      real scannable image, refreshed automatically. After you scan it and the bot connects, the runner zips
      <code>creds.json</code> into a <code>KnightBot!…</code> session string for you — copy it from the
      service page and future deploys boot straight into a logged-in session, no scan needed.</p>

      <h3>Runner capacity &amp; lifecycle</h3>
      <ul>
        <li><b>Capacity</b> — up to <code>MAX_LOCAL_SERVICES</code> (default 10) services run at once, each on
        its own port. Suspend one to free a slot.</li>
        <li><b>Suspend / Resume / Restart</b> work like any other service; environment variables are applied on
        the next start.</li>
        <li><b>Panel restarts</b> — local services come back automatically (stale processes are cleaned up by
        PID before respawn), and on shutdown the runner stops every child gracefully.</li>
        <li><b>Persistence</b> — apps live in <code>data/apps/</code>. On Render, attach a disk
        (mount <code>/data</code>, set <code>DATA_DIR=/data</code>) or re-deploy after each restart.</li>
      </ul>

      <p class="muted">Good to know: local services share the BotForge server’s CPU and memory. For heavy bots
      or guaranteed uptime SLAs, the ☁️ Render target is still one click away.</p>

      <h2 id="pair-qr">🔗 Pair via QR code</h2>
      <p>WhatsApp multi-device bots authenticate by QR (or an 8-digit pairing code). BotForge watches your service logs and:</p>
      <ul>
        <li>Renders the printed QR as a <b>scannable image</b> in the QR Pairing tab (via <code>/api/services/:id/qr.png</code>).</li>
        <li>Detects <b>pairing codes</b> in logs and shows them in a big readable box.</li>
        <li>Detects <b>connected / logged-in</b> events and confirms success.</li>
      </ul>
      <p>On your phone: <b>WhatsApp → Settings → Linked Devices → Link a Device</b> (or "Link with phone number" for pairing codes).</p>

      <h2 id="self-host">🛠 Deploy BotForge itself on Render</h2>
      <p>BotForge is a single Node.js web service with a small JSON database. Two ways to deploy:</p>

      <h3>Option A — Blueprint (recommended)</h3>
      <p>The repo ships a <code>render.yaml</code>. On Render:</p>
      <ol>
        <li>Push this project to your GitHub.</li>
        <li>Render dashboard → <b>New → Blueprint</b> → select your repo.</li>
        <li>Render auto-detects <code>render.yaml</code>, generates <code>JWT_SECRET</code> and <code>ENCRYPTION_KEY</code>, attaches a 1&nbsp;GB persistent disk at <code>/var/data</code>, and deploys.</li>
        <li>Open the URL → the first registered account becomes admin.</li>
      </ol>

      <h3>Option B — Manual web service</h3>
      <ol>
        <li>Render dashboard → <b>New → Web Service</b> → connect your repo.</li>
        <li>Runtime: <b>Node</b>, Build: <code>npm install</code>, Start: <code>npm start</code>.</li>
        <li>Add env vars (see table below) — <code>JWT_SECRET</code> and <code>ENCRYPTION_KEY</code> must be long random strings.</li>
        <li>Attach a persistent disk: mount <b>/var/data</b> (1 GB, free-tier friendly on paid instances) so users/db survive restarts and deploys.</li>
        <li>Health check path: <code>/api/health</code>.</li>
      </ol>

      <h3>Free tier note</h3>
      <p>Render free web services spin down after 15 minutes of inactivity — which would pause BotForge's keep-alive pinger too. For true 24/7 hosting either upgrade the BotForge instance to Starter, or set <code>SELF_PING_URL</code> to your BotForge URL so an external uptime service (or another pinger) keeps it awake.</p>

      <h2 id="render-key">🔑 Get a Render API key</h2>
      <ol>
        <li>Go to <a href="https://dashboard.render.com/settings" target="_blank" rel="noopener">dashboard.render.com → Account Settings</a>.</li>
        <li>Open the <b>API Keys</b> section → <b>Create API Key</b> → name it <code>botforge</code>.</li>
        <li>Copy the <code>rnd_…</code> key immediately (shown once).</li>
        <li>Paste it in BotForge <b>Settings → Render account</b>. It's validated live and stored encrypted (AES-256-GCM) — never shown again in full.</li>
      </ol>
      <p>Without a key, BotForge runs in <b>demo mode</b>: the entire platform works, deploys are simulated locally with realistic build logs, QR codes and pairing codes. Perfect for trying it out or demoing.</p>

      <h2 id="env-api">⚙️ Environment variables</h2>
      <table>
        <thead><tr><th>Var</th><th>Default</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>PORT</td><td>10000 (Render)</td><td>HTTP port</td></tr>
          <tr><td>JWT_SECRET</td><td>random dev value</td><td>Signs auth tokens. <b>Set a long random string in production.</b></td></tr>
          <tr><td>ENCRYPTION_KEY</td><td>random dev value</td><td>AES-256-GCM key for storing Render API keys / env secrets at rest</td></tr>
          <tr><td>DATA_DIR</td><td>./data</td><td>Where the JSON database lives. On Render point at the persistent disk mount (<code>/var/data/botforge</code>)</td></tr>
          <tr><td>ADMIN_EMAIL</td><td>—</td><td>Force this email to admin on registration</td></tr>
          <tr><td>DEMO_MODE</td><td>false</td><td>Force demo mode even for users with valid keys</td></tr>
          <tr><td>PINGER_ENABLED</td><td>true</td><td>Enable the 24/7 keep-alive pinger</td></tr>
          <tr><td>PING_INTERVAL</td><td>240</td><td>Seconds between keep-alive pings (min 60)</td></tr>
          <tr><td>SELF_PING_URL</td><td>—</td><td>Also ping this URL (e.g. BotForge itself on free tier)</td></tr>
        </tbody>
      </table>

      <h2 id="api">🌐 REST API</h2>
      <p>All endpoints live under <code>/api</code>. Authenticate with <code>Authorization: Bearer &lt;jwt&gt;</code>.</p>
      <table>
        <thead><tr><th>Endpoint</th><th>Method</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>/api/health</td><td>GET</td><td>Health check (Render healthCheckPath)</td></tr>
          <tr><td>/api/templates</td><td>GET</td><td>Bot template catalog</td></tr>
          <tr><td>/api/stats</td><td>GET</td><td>Public platform stats</td></tr>
          <tr><td>/api/auth/register</td><td>POST</td><td>{email, password, name?} → {token, user}</td></tr>
          <tr><td>/api/auth/login</td><td>POST</td><td>{email, password} → {token, user}</td></tr>
          <tr><td>/api/me</td><td>GET</td><td>Current user, mode, masked key</td></tr>
          <tr><td>/api/render/validate</td><td>POST</td><td>{apiKey} → validity check</td></tr>
          <tr><td>/api/render/connect</td><td>POST</td><td>{apiKey} → stores encrypted, returns workspaces</td></tr>
          <tr><td>/api/render/disconnect</td><td>POST</td><td>Forgets the key</td></tr>
          <tr><td>/api/render/workspaces</td><td>GET</td><td>List Render workspaces (owners)</td></tr>
          <tr><td>/api/render/owner</td><td>POST</td><td>{ownerId} → select workspace for new services</td></tr>
          <tr><td>/api/services</td><td>GET / POST</td><td>List your services / deploy new bot</td></tr>
          <tr><td>/api/services/:id</td><td>GET / DELETE</td><td>Service detail / destroy (also on Render)</td></tr>
          <tr><td>/api/services/:id/action</td><td>POST</td><td>{action: suspend|resume|restart}</td></tr>
          <tr><td>/api/services/:id/env</td><td>GET / PUT</td><td>Read (masked) / update env vars (redeploys)</td></tr>
          <tr><td>/api/services/:id/logs</td><td>GET</td><td>Live logs + QR/pairing artifacts</td></tr>
          <tr><td>/api/services/:id/qr.png</td><td>GET</td><td>Scannable QR image from latest QR in logs</td></tr>
          <tr><td>/api/services/:id/deploys</td><td>GET</td><td>Deploy history</td></tr>
          <tr><td>/api/uptime</td><td>GET</td><td>Keep-alive status for your services</td></tr>
          <tr><td>/api/admin/stats · /api/admin/users</td><td>GET</td><td>Admin overview (role required)</td></tr>
          <tr><td>/api/admin/users/:id/role</td><td>POST</td><td>{role: user|admin}</td></tr>
        </tbody>
      </table>

      <h2 id="keepalive">💓 24/7 keep-alive</h2>
      <p>Render's free tier puts services to sleep after 15 minutes without traffic. BotForge's pinger solves this:</p>
      <ul>
        <li>Every <code>PING_INTERVAL</code> seconds it requests the URL of every non-suspended service with keep-alive enabled.</li>
        <li>It also pings <code>SELF_PING_URL</code> (set it to your BotForge URL to keep the pinger itself awake).</li>
        <li>Results are recorded per-service (<code>lastPingOk</code>) and visible in the dashboard and uptime endpoint.</li>
      </ul>
      <p><b>Note for WhatsApp bots:</b> if the bot doesn't bind an HTTP port (KnightBot doesn't), deploy it as a <b>worker</b> or give it a tiny health server. BotForge's templates flag this and the pinger keeps web services awake.</p>

      <h2 id="faq-tech">🧯 Troubleshooting</h2>
      <h3>Deploy fails with "no port binding"</h3>
      <p>Free web services must bind <code>PORT</code>. If your bot is a pure WebSocket/protocol bot with no HTTP server, either switch it to a worker-type service, or add a 5-line Express server that binds <code>process.env.PORT || 3000</code>.</p>
      <h3>QR expired (8 attempts)</h3>
      <p>Restart the service from the service manager — a fresh QR is printed a few seconds later. QR codes refresh every ~40 seconds.</p>
      <h3>"Render deploy failed" on live mode</h3>
      <p>Check the service name (globally unique on Render), the workspace selection in Settings, and that your API key has service-create permissions.</p>
      <h3>Logs show nothing</h3>
      <p>New builds take a few minutes before first logs. In live mode Render's log API can lag ~30 seconds. In demo mode, restart the service to re-run the simulated boot sequence.</p>

      <div class="divider"></div>
      <p class="muted small">BotForge is an independent self-hosted platform. Not affiliated with Render.com, WhatsApp or KnightBot's authors. Use bots responsibly and follow WhatsApp's terms of service.</p>
    </div>
  </div>`;
});
