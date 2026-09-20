# ⚒️ BotForge — Self-Hosted Bot Hosting Panel

> Deploy WhatsApp, Discord & Telegram bots in one click — and run them **right on the panel itself** with the built-in runner, or push them to [Render](https://render.com). Live logs, WhatsApp QR pairing, encrypted secrets, 24/7 keep-alive, multi-user admin — **free forever, $0 platform cost**.

BotForge is a complete, self-hosted control panel you deploy **once** (on Render's free tier, any VPS, or your own server). After that you (and your team, or your whole community) can deploy and manage bots from its web UI — including [KnightBot-Mini](https://github.com/mruniquehacker/KnightBot-Mini), the featured WhatsApp bot template — **without needing any second hosting account**.

---

## ✨ What you get

| Feature | Details |
|---|---|
| 🖥️ **Built-in runner — run bots on our site** | Deploy with **“Run on our site”** and the bot executes *on the BotForge server itself*: repo cloned, deps installed, spawned as a managed process, logs/QR/session tracked, web services served at `/svc/<name>` on the panel’s own domain. No Render account needed. |
| 🚀 **One-click deploys** | Pick a template or paste any GitHub repo. BotForge calls the official Render API to build & launch it. |
| 📱 **WhatsApp QR & pairing** | Deploys KnightBot / any Baileys bot, detects the QR code in logs, renders it as a **scannable QR image**, auto-detects pairing codes & session strings. |
| 📜 **Live log console** | Streams your bot's Render logs in real time, auto-highlights errors, detects QR codes. |
| ⚡ **24/7 keep-alive pinger** | Render free services sleep after 15 min idle. BotForge pings them every few minutes so your bots stay online on $0 plans. |
| 🔐 **Encrypted secrets** | Render API keys & bot env vars are AES-256-GCM encrypted at rest, masked in the UI, never logged. |
| 🎛️ **Full service control** | Suspend / resume / restart / redeploy, edit env vars, deploy history, delete. |
| 👥 **Multi-user + admin panel** | JWT auth, user roles, promote/demote, platform stats. Run it solo or share it. |
| 🧪 **Demo mode** | No Render key? Everything is simulated — deploys, build logs, QR pairing — so you can try the whole platform instantly. |
| 🧩 **6 bot templates** | KnightBot-Mini (WhatsApp, featured), generic Baileys WhatsApp bot, discord.js, Telegram (grammY), always-on Node.js, always-on Python. |

---

## 🚀 Deploy BotForge to Render (2 minutes)

### Option A — Render Blueprint (recommended)

1. Push this `botforge/` folder to a GitHub repo (public or private).
2. In Render, click **New → Blueprint**, select your repo.
3. The included `render.yaml` creates the web service, generates `JWT_SECRET`, `ENCRYPTION_KEY` and `ADMIN_EMAIL`, and attaches a **1 GB persistent disk** at `/var/data` so users & services survive restarts.
4. Click **Apply** — done. Your panel is live at `https://<your-app>.onrender.com`.

### Option B — Manual (web service + disk)

1. Render dashboard → **New → Web Service** → connect your repo.
2. Runtime: **Node**, Build: `npm install`, Start: `npm start`.
3. Add a **Disk**: name `botforge-data`, mount path `/var/data`, size 1 GB.
4. Add environment variables (see table below). Set `DATA_DIR=/var/data`.
5. Create the service.

> **Free tier note:** free web services sleep after 15 min idle. That's fine — the panel wakes in ~30s when someone opens it. Your *bots* are kept awake separately by the built-in pinger (and you can set `SELF_PING_URL` to ping the panel itself).

### Environment variables

| Var | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | auto | `10000` | HTTP port (Render sets this) |
| `JWT_SECRET` | yes | random* | Signs auth tokens. **Set a fixed value** or sessions reset on restart. |
| `ENCRYPTION_KEY` | yes | random* | AES-256-GCM key for API keys & env secrets. **Set a fixed value.** |
| `DATA_DIR` | on Render | `./data` | Writable dir for the JSON DB. Use `/var/data` on Render. |
| `ADMIN_EMAIL` | no | — | The account registered with this email becomes admin (also: first-ever account is admin). |
| `DEMO_MODE` | no | `auto` | `true` forces demo even with live keys; `auto` = demo only when no key. |
| `PINGER_ENABLED` | no | `true` | Enables the keep-alive pinger. |
| `PING_INTERVAL` | no | `240` | Seconds between pings (min 60). |
| `SELF_PING_URL` | no | — | Ping the panel itself to keep *it* awake on free tier. |
| `LOCAL_PORT_START` | no | `10001` | First port of the local runner pool for “Run on our site” services. |
| `MAX_LOCAL_SERVICES` | no | `10` | Max simultaneously-running local services. |

\* Defaults are generated per-boot in dev only — **always set these explicitly in production**.

---

## 📱 Deploy your first WhatsApp bot (KnightBot-Mini)

1. **Register** on your BotForge panel (first account = admin).
2. (Optional) **Settings → paste your Render API key** — from `dashboard.render.com → Account Settings → API Keys`. Without a key everything runs in demo mode.
3. **Deploy → KnightBot Mini** (featured card) or *any* template.
4. Configure: service name, region, plan, env vars. Leave `SESSION_ID` **empty** to pair by QR.
5. Click **🚀 Deploy to Render** → the wizard streams build status → opens the service manager.
6. Open the **📱 QR Pairing** tab → a scannable QR appears (refreshes every ~40 s, up to 8 times).
7. On your phone: **WhatsApp → Settings → Linked Devices → Link a Device** → scan.
8. The bot prints its session string — paste it into the service's `SESSION_ID` env var via the **Environment** tab so restarts don't require re-pairing. Done: 200+ commands live, keep-alive ON.

> **Already have a session string?** Paste it into `SESSION_ID` at deploy time and the bot skips QR entirely.

> **Free plan WhatsApp tip:** KnightBot doesn't bind an HTTP port, and Render free *web* services require one. Two solutions: (a) use a **Starter/Background Worker** plan, or (b) keep the free web service — the QR/console flow still works, but pair quickly while the service is awake. BotForge's pinger maximizes uptime either way.

---

## 🧩 Templates

| Template | Platform | Repo |
|---|---|---|
| **KnightBot Mini** ⭐ | WhatsApp (Baileys) | `mruniquehacker/KnightBot-Mini` |
| Baileys WhatsApp bot | WhatsApp | generic Baileys starter |
| discord.js bot | Discord | discord.js v14 starter |
| Telegram bot | Telegram | grammY starter |
| Node.js 24/7 worker | Any | minimal Express + interval |
| Python 24/7 worker | Any | FastAPI + interval |

Any GitHub repo works too — the deploy wizard accepts custom repos with your own build/start commands, Node or Python runtime.

---

## 🖥️ Run bots on our site — the built-in runner

Besides deploying to Render, every service can run **on the BotForge server itself**. In the deploy wizard
choose **🖥️ Run on our site** instead of ☁️ Deploy to Render — no Render account, API
key or second dashboard required.

**What happens on deploy**

1. **Clone** — the repo is fetched into `data/apps/<service-id>` (`git clone --depth 1`).
2. **Install** — Node apps get `npm install --omit=dev` (with `PUPPETEER_SKIP_DOWNLOAD=true` so Baileys
   installs stay lean); Python apps get a fresh `venv` + `pip install -r requirements.txt`.
3. **Spawn** — the start command runs as a detached child process in its own process group with a scrubbed
   environment (no platform secrets leak into bots) and a dedicated port from the local pool.
4. **Monitor** — stdout/stderr stream into the service’s **Logs** tab in real time. The runner detects
   WhatsApp QR codes, pairing codes and login events, auto-restarts crashed bots (up to 5 times) and tracks uptime.
5. **Serve** — web apps are reverse-proxied on the panel’s own domain at `/svc/<service-name>`.

**WhatsApp pairing on local services**

Local Baileys bots get the QR shim (`src/qrshim.js`) injected via `NODE_OPTIONS=--require`. It hooks
`qrcode-terminal` and emits the **raw QR string** before the ASCII art is printed, so the QR Pairing tab can
render a real scannable image (auto-refreshed). After you scan it and the bot connects, the runner gzips
`creds.json` into a `KnightBot!…` session string and shows it on the service page — copy it once and
future deploys log in instantly with `SESSION_ID`, no scan needed.

**Lifecycle**

- **Suspend / Resume / Restart** work exactly like Render services; env var edits apply on next start.
- **Panel restarts** — local services are restored automatically; stale processes from a crashed panel are
  killed by tracked PID before respawn. On graceful shutdown the runner stops every child.
- **Capacity** — up to `MAX_LOCAL_SERVICES` (default 10) run at once, each on its own port
  (`LOCAL_PORT_START`–`+100`).

**Persistence note (Render)** — apps live in `data/apps/`. On Render's free tier the filesystem is
ephemeral, so attach a disk (mount at `/data`, set `DATA_DIR=/data`) to keep local services across restarts,
otherwise just hit **Redeploy** after a spin-down. The keep-alive pinger keeps the panel itself awake.

---

## 🛠 Local development

```bash
cd botforge
npm install
npm start          # http://localhost:10000  (demo mode, no keys needed)
```

Useful env: `PORT=3000`, `DEMO_MODE=true`, `PING_INTERVAL=60`.

**Smoke tests:** `bash test-api.sh` — 36 API checks (auth, RBAC, deploy, logs, QR PNG, env masking, admin, cross-user 403s).

---

## 🔌 REST API (all under `/api`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health` | — | Liveness probe |
| `GET /templates` | — | Template library |
| `GET /stats` | — | Public counters |
| `POST /auth/register` · `/auth/login` | — | Auth (first user = admin) |
| `GET /me` | JWT | Profile + render key status/mode |
| `POST /render/validate` · `/connect` · `/disconnect` | JWT | Manage Render API key (AES-encrypted) |
| `GET /render/workspaces` · `POST /render/owner` | JWT | List & select Render workspace |
| `GET /services` · `POST /services` | JWT | List own / deploy new service |
| `GET /services/:id` · `DELETE /services/:id` | JWT | Detail / delete (owner or admin) |
| `POST /services/:id/action` | JWT | `suspend` / `resume` / `restart` |
| `GET · PUT /services/:id/env` | JWT | Env vars (masked; `***` = unchanged) |
| `GET /services/:id/logs` | JWT | Live logs + artifacts `{qr, pair_code, connected}` |
| `GET /services/:id/qr.png?token=` | JWT* | Scannable QR image rendered from logs |
| `GET /services/:id/deploys` | JWT | Deploy history |
| `GET /uptime` | JWT | Keep-alive status & pinger stats |
| `GET /admin/stats` · `/admin/users` | admin | Platform overview, users (sanitized) |
| `POST /admin/users/:id/role` | admin | Promote/demote |
| `GET /system` | — | Runtime info |

\* The QR endpoint also accepts the JWT via `?token=` because `<img>` tags can't send headers.

---

## 🏛 Architecture

```
browser ── SPA (vanilla JS, hash/path router)
   │  REST /api (JWT bearer)
   ▼
Express server ── JSON file DB (atomic writes, /var/data on Render)
   │
   ├── renderClient.js ── official Render API v1 (services, env, logs, deploys, suspend/resume)
   │        └── live mode when user has a key, else ↓
   ├── demoEngine.js ── realistic simulation (builds, QR lifecycle, heartbeats, pairing codes)
   ├── pinger.js ── keep-alive loop (all non-suspended services + SELF_PING_URL)
   ├── crypto.js ── AES-256-GCM (scrypt-derived key) for keys & secrets
   └── auth.js ── JWT (7 d), bcryptjs, roles
```

**Security:** JWT auth on every service route with ownership checks (admins bypass), passwords bcrypt-hashed, Render keys & env secrets encrypted at rest and masked in every response, sanitized admin endpoints (no hash/key leakage), cross-user access returns 403.

**QR detection** scans logs for raw Baileys QR strings (`2@<b64>,<b64>,<b64>`), ASCII QR blocks and pairing-code patterns; `/qr.png` renders the latest QR as a real scannable image.

---

## 🩺 Troubleshooting

| Symptom | Fix |
|---|---|
| Deploy fails on live key | Check the key is valid & has workspace access: Settings → connect re-validates. |
| "No QR yet" | QR prints 5–30 s after boot; it refreshes every ~40 s. Restart the service if all 8 QRs expired. |
| 401 on QR image | The panel passes `?token=` automatically; make sure you're logged in and it's *your* service. |
| Logs empty (live mode) | Render only returns logs when the service is running; check it's not suspended. |
| Session lost after restart | Put the `KnightBot!<base64>` session string into `SESSION_ID` via the Environment tab. |
| Bot sleeps on free plan | Keep-alive pinger is ON by default (badge on the service card). Optionally set `SELF_PING_URL`. |

---

## 📜 License

MIT — do whatever you want. Bot templates belong to their respective owners; KnightBot-Mini © [mruniquehacker](https://github.com/mruniquehacker).
