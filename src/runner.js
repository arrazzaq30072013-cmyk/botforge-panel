'use strict';

/**
 * BotForge built-in local runner.
 *
 * Runs deployed services ON THIS SERVER (our own site) instead of handing
 * them to Render. For every service with target === 'local':
 *
 *   1. prepare()  — git clone into data/apps/<id>, install dependencies
 *   2. spawn()    — run the bot's start command as a managed child process
 *                   (with the qrshim so raw WhatsApp QR strings reach the logs)
 *   3. monitor()  — stream stdout/stderr into a ring buffer, capture the QR,
 *                   auto-extract a session string after pairing, auto-restart
 *                   on crash (max 5), track uptime
 *   4. proxy()    — expose web services on our own domain at /svc/<name>
 *
 * No Render account or API key is needed for local services.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');

const config = require('./config');
const db = require('./db');

const APPS_DIR = path.join(config.dataDir, 'apps');
const SHIM_PATH = path.join(__dirname, 'qrshim.js');
const PORT_START = parseInt(env('LOCAL_PORT_START', '10001'), 10);
const PORT_END = PORT_START + 99;
const MAX_LOCAL_SERVICES = parseInt(env('MAX_LOCAL_SERVICES', '10'), 10);
const PREPARE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min build cap
const MAX_RESTARTS = 5;

function env(k, f) { const v = process.env[k]; return v === undefined || v === '' ? f : v; }

// id -> proc state
// { child, port, logs[], rawQR, qrAt, pairCode, sessionString, restarts,
//   startedAt, building, intentionalStop, lastExitCode }
const procs = new Map();

function nowISO() { return new Date().toISOString(); }

function ensure(id) {
  let p = procs.get(id);
  if (!p) {
    p = { child: null, port: null, logs: [], rawQR: null, qrAt: null, pairCode: null, sessionString: null, restarts: 0, startedAt: null, building: false, intentionalStop: false, lastExitCode: null };
    procs.set(id, p);
  }
  return p;
}

function log(id, message, level = 'info') {
  const p = ensure(id);
  const line = String(message).slice(0, 4000);
  p.logs.push({ message: line, timestamp: nowISO(), level });
  if (p.logs.length > 600) p.logs.splice(0, p.logs.length - 600);
  // also tee build/spawn events to server console (trim long lines)
  if (level === 'error' || level === 'build' || level === 'system') {
    console.log(`[runner:${id}] ${line.slice(0, 160)}`);
  }
  return p;
}

function ringLines(id) {
  const p = procs.get(id);
  return p ? p.logs.map(l => ({ ...l })) : [];
}

// ---------- port allocation ----------
function allocPort(service) {
  const used = new Set();
  for (const s of db.listServices()) if (s.localPort && s.id !== service.id) used.add(s.localPort);
  for (const p of procs.values()) if (p.port) used.add(p.port);
  for (let port = PORT_START; port <= PORT_END; port++) {
    if (!used.has(port)) return port;
  }
  return null;
}

// ---------- child env ----------
function childEnv(service) {
  // minimal, scrubbed env — child bots never see platform secrets
  const envObj = {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: appDir(service.id),
    LANG: process.env.LANG || 'en_US.UTF-8',
    TERM: 'dumb',
    APP_ENV: 'botforge-local',
    // QR shim: makes bots emit raw QR strings we can render as PNG
    NODE_OPTIONS: SHIM_PATH.includes(' ') ? '' : `--require ${SHIM_PATH}`,
    ...(service.env || {})
  };
  // every local service gets its own port; web bots bind it, others ignore it
  const p = procs.get(service.id);
  if (p && p.port) envObj.PORT = String(p.port);
  return envObj;
}

function appDir(id) { return path.join(APPS_DIR, id); }

// ---------- 1. prepare: clone + install ----------
function runCapture(cmd, args, opts, id, level) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, cwd: opts.cwd || APPS_DIR });
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error('Timed out after 10 minutes'));
    }, PREPARE_TIMEOUT_MS);
    const onData = (buf) => {
      for (const line of String(buf).split('\n')) {
        const t = line.trim();
        if (t) log(id, t, level);
      }
    };
    child.stdout && child.stdout.on('data', onData);
    child.stderr && child.stderr.on('data', onData);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return; // reject already fired
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function prepare(service) {
  const id = service.id;
  const dir = appDir(id);
  fs.mkdirSync(APPS_DIR, { recursive: true });
  log(id, `[botforge] 📦 Cloning ${service.repo} (${service.branch || 'main'})…`, 'build');
  fs.rmSync(dir, { recursive: true, force: true });
  await runCapture('git', ['clone', '--depth', '1', '--branch', service.branch || 'main', '--single-branch', service.repo, dir], { cwd: APPS_DIR }, id, 'build');
  log(id, '[botforge] ✓ Source code fetched', 'build');

  const runtime = service.runtime || 'node';
  if (runtime === 'node') {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      log(id, '[botforge] ⚙️ Installing Node dependencies (npm install --omit=dev)… this can take a few minutes', 'build');
      await runCapture('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--loglevel', 'error'], {
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          HOME: dir,
          PUPPETEER_SKIP_DOWNLOAD: 'true',
          PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'true',
          npm_config_loglevel: 'error'
        }
      }, id, 'build');
      log(id, '[botforge] ✓ Dependencies installed', 'build');
    } else {
      log(id, '[botforge] No package.json found — skipping install step', 'build');
    }
  } else if (runtime === 'python') {
    log(id, '[botforge] ⚙️ Creating Python venv + installing requirements…', 'build');
    await runCapture('python3', ['-m', 'venv', 'venv'], { cwd: dir, env: { PATH: process.env.PATH, HOME: dir } }, id, 'build');
    const pip = path.join(dir, 'venv', 'bin', 'pip');
    if (fs.existsSync(path.join(dir, 'requirements.txt'))) {
      await runCapture(pip, ['install', '-r', 'requirements.txt'], { cwd: dir, env: { PATH: process.env.PATH, HOME: dir, VIRTUAL_ENV: path.join(dir, 'venv') } }, id, 'build');
    }
    log(id, '[botforge] ✓ Python environment ready', 'build');
  }
}

// ---------- 2. spawn the bot ----------
function resolveStartCommand(service) {
  const runtime = service.runtime || 'node';
  let cmd = String(service.startCommand || (runtime === 'python' ? 'python bot.py' : 'node index.js'));
  if (runtime === 'python') {
    // route python through the service venv when it exists
    const vpy = path.join(appDir(service.id), 'venv', 'bin');
    if (fs.existsSync(vpy)) {
      cmd = cmd.replace(/\bpython3?\b/g, 'venv/bin/python');
    }
  }
  return cmd;
}

function spawnChild(service) {
  const id = service.id;
  const dir = appDir(id);
  if (!fs.existsSync(dir)) throw new Error('App directory missing — re-deploy required');

  const p = ensure(id);
  p.intentionalStop = false;
  p.rawQR = null;
  p.pairCode = null;
  p.sessionString = null;
  p.startedAt = nowISO();

  const cmd = resolveStartCommand(service);
  log(id, `[botforge] ▶ Starting: ${cmd}`, 'system');

  const child = spawn('/bin/sh', ['-c', cmd], {
    cwd: dir,
    env: childEnv(service),
    detached: true // own process group → we can kill the whole tree
  });
  p.child = child;
  p.logs = p.logs || [];
  db.updateService(id, { childPid: child.pid });

  const onData = (buf) => {
    const chunks = String(buf).split('\n');
    for (const line of chunks) {
      const t = line.replace(/\r$/, '');
      if (!t.trim()) continue;
      inspectLine(id, t);
    }
  };
  child.stdout && child.stdout.on('data', onData);
  child.stderr && child.stderr.on('data', onData);

  child.on('error', (e) => {
    log(id, `[botforge] ✗ Failed to start: ${e.message}`, 'error');
    db.updateService(id, { status: 'failed', error: e.message, updatedAt: nowISO() });
  });

  child.on('exit', (code, signal) => {
    const cur = procs.get(id);
    if (!cur || cur.child !== child) return; // stale event
    cur.child = null;
    cur.lastExitCode = code;
    if (cur.intentionalStop) {
      log(id, `[botforge] ⏹ Process stopped (signal ${signal || code})`, 'system');
      return;
    }
    log(id, `[botforge] ⚠️ Process exited unexpectedly (code ${code}). Crash-restart ${cur.restarts + 1}/${MAX_RESTARTS}…`, 'warn');
    if (cur.restarts < MAX_RESTARTS) {
      cur.restarts++;
      setTimeout(() => {
        const s = db.findServiceById(id);
        if (!s || s.status === 'suspended') return;
        try { spawnChild(s); } catch (e) { log(id, `[botforge] ✗ Restart failed: ${e.message}`, 'error'); }
      }, 3000);
    } else {
      log(id, '[botforge] ✗ Too many crashes — service marked failed. Fix the error and hit Restart.', 'error');
      db.updateService(id, { status: 'failed', updatedAt: nowISO() });
    }
  });

  return child;
}

// ---------- 3. line inspection: QR / pair code / session / connected ----------
const PAIR_PATTERNS = [
  /your\s+pairing\s+code\s*(?:is)?\s*[:\-]?\s*([A-Z0-9]{8}(?:-[A-Z0-9]{4})?)/i,
  /pairing\s*code\s*(?:is)?\s*[:\-]?\s*([A-Z0-9]{8}(?:-[A-Z0-9]{4})?)/i,
  /pair\s*code\s*(?:is)?\s*[:\-]?\s*([A-Z0-9]{8}(?:-[A-Z0-9]{4})?)/i
];

function inspectLine(id, line) {
  const p = procs.get(id);
  if (!p) return;
  // 1. raw QR from our shim (bots that use qrcode-terminal)
  const qrMatch = line.match(/\[botforge:qr\]\s*(\S+)/);
  if (qrMatch) {
    p.rawQR = qrMatch[1];
    p.qrAt = nowISO();
    log(id, `📱 WhatsApp QR captured — open the QR Pairing tab to scan it. Refreshes automatically.`, 'info');
    return;
  }
  // 2. raw Baileys QR printed directly (2@...,...)
  const raw = line.match(/2@[A-Za-z0-9+/=]{40,},[A-Za-z0-9+/=]{40,}/);
  if (raw) {
    p.rawQR = raw[0];
    p.qrAt = nowISO();
    log(id, `📱 WhatsApp QR captured — open the QR Pairing tab to scan it.`, 'info');
    return;
  }
  // 3. pair code
  for (const rx of PAIR_PATTERNS) {
    const m = line.match(rx);
    if (m) { p.pairCode = m[1]; break; }
  }
  // 4. connected → try to mint a session string
  if (/connected successfully|logged in|bot connected|connection opened/i.test(line)) {
    log(id, '✅ Bot connected — WhatsApp session established!', 'system');
    setTimeout(() => mintSessionString(id), 1500);
  }
  log(id, line, /error|fail|✗|⚠/i.test(line) ? 'error' : 'info');
}

// KnightBot-compatible session string: KnightBot!<base64(gzip(creds.json))>
function mintSessionString(id) {
  const p = procs.get(id);
  if (!p || p.sessionString) return;
  const dir = appDir(id);
  const candidates = [];
  (function walk(d, depth) {
    if (depth > 3) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'venv' || e.name.startsWith('.')) continue;
      if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
      else if (e.name === 'creds.json') candidates.push(path.join(d, e.name));
    }
  })(dir, 0);
  if (!candidates.length) return;
  try {
    const creds = fs.readFileSync(candidates[0]);
    const b64 = zlib.gzipSync(creds).toString('base64');
    p.sessionString = `KnightBot!${b64}`;
    log(id, `🔑 SESSION STRING GENERATED — save this now (Settings → env → SESSION_ID) so the bot survives restarts without re-scanning:`, 'system');
    log(id, p.sessionString, 'system');
  } catch (e) {
    log(id, `[botforge] Could not build session string: ${e.message}`, 'warn');
  }
}

// ---------- 4. lifecycle ----------
async function start(service, { rebuild = false } = {}) {
  const id = service.id;
  const dir = appDir(id);
  const count = runningCount();
  if (count >= MAX_LOCAL_SERVICES && !procs.has(id)) {
    throw new Error(`Local runner is full (${count}/${MAX_LOCAL_SERVICES} services). Suspend one first or deploy to Render instead.`);
  }
  // allocate + persist port
  const p0 = ensure(id);
  if (!p0.port) {
    const port = allocPort(service);
    if (!port) throw new Error('No free ports in the local pool');
    p0.port = port;
    db.updateService(id, { localPort: port });
    service = db.findServiceById(id) || service;
  }

  const needsBuild = rebuild || !fs.existsSync(dir) || !fs.existsSync(path.join(dir, '.git'));
  if (needsBuild) {
    p0.building = true;
    db.updateService(id, { status: 'building', updatedAt: nowISO() });
    try {
      await prepare(service);
    } catch (e) {
      p0.building = false;
      db.updateService(id, { status: 'failed', error: e.message, updatedAt: nowISO() });
      log(id, `[botforge] ✗ Build failed: ${e.message}`, 'error');
      throw e;
    }
    p0.building = false;
  }
  p0.restarts = 0;
  spawnChild(service);
  db.updateService(id, { status: 'live', updatedAt: nowISO(), lastDeployAt: nowISO() });
  return true;
}

function stop(id, { intentional = true } = {}) {
  const p = procs.get(id);
  if (!p) return;
  p.intentionalStop = intentional;
  if (p.child && p.child.pid) {
    try { process.kill(-p.child.pid, 'SIGTERM'); } catch { /* already gone */ }
    const pid = p.child.pid;
    setTimeout(() => { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } }, 5000).unref();
  }
  if (intentional) {
    p.child = null;
  }
}

function restart(service) {
  const id = service.id;
  stop(id);
  const p = ensure(id);
  p.restarts = 0;
  // make sure a port is allocated (service may not be in the live map,
  // e.g. failed restore or panel restart) before respawning
  if (!p.port) {
    const port = allocPort(service);
    if (!port) {
      log(id, '[botforge] ✗ No free ports in the local pool', 'error');
      db.updateService(id, { status: 'failed', error: 'No free ports in the local pool', updatedAt: nowISO() });
      return;
    }
    p.port = port;
    db.updateService(id, { localPort: port });
    service = db.findServiceById(id) || service;
  }
  setTimeout(() => {
    const s = db.findServiceById(id);
    if (s) {
      try { spawnChild(s); db.updateService(id, { status: 'live', updatedAt: nowISO() }); }
      catch (e) { log(id, `[botforge] ✗ Restart failed: ${e.message}`, 'error'); db.updateService(id, { status: 'failed', error: e.message, updatedAt: nowISO() }); }
    }
  }, 1200);
}

async function destroy(id) {
  stop(id, { intentional: true });
  procs.delete(id);
  try { fs.rmSync(appDir(id), { recursive: true, force: true }); } catch { /* ignore */ }
}

function runningCount() {
  let n = 0;
  for (const p of procs.values()) if (p.child) n++;
  return n;
}

// ---------- restore after server reboot ----------
async function restoreAll() {
  let restored = 0;
  for (const s of db.listServices()) {
    if (s.target !== 'local' || s.status !== 'live') continue;
    // kill any stale child left over from a crash/restart of the panel
    if (s.childPid) {
      try { process.kill(-s.childPid, 'SIGKILL'); } catch { /* already gone */ }
    }
    try {
      await start(s, { rebuild: false });
      restored++;
    } catch (e) {
      log(s.id, `[botforge] Restore failed: ${e.message}`, 'error');
      db.updateService(s.id, { status: 'failed', error: e.message, updatedAt: nowISO() });
    }
  }
  if (restored) console.log(`[runner] restored ${restored} local service${restored === 1 ? '' : 's'} after restart`);
}

// stop everything (server shutdown) — children are killed via process groups
function stopAll() {
  for (const [id, p] of procs) {
    if (p.child && p.child.pid) {
      try { process.kill(-p.child.pid, 'SIGTERM'); } catch { /* gone */ }
      p.intentionalStop = true;
    }
  }
}

// ---------- 5. reverse proxy: /svc/<name> → child port ----------
function proxyFactory() {
  return function proxy(req, res, next) {
    const m = req.url.match(/^\/svc\/([a-z0-9-]+)/i);
    if (!m) return next();
    const name = m[1].toLowerCase();
    const svc = db.listServices().find(s => s.name === name && s.target === 'local');
    if (!svc) return res.status(404).send(`No local service named "${name}".`);
    const p = procs.get(svc.id);
    if (!p || !p.port || !p.child) {
      return res.status(503).send(`Service "${name}" is not running (status: ${svc.status}). Start it from the BotForge dashboard.`);
    }
    const targetPath = req.url.replace(/^\/svc\/[a-z0-9-]+/i, '') || '/';
    const opts = {
      hostname: '127.0.0.1',
      port: p.port,
      path: targetPath,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${p.port}` }
    };
    const upstream = http.request(opts, (ur) => {
      res.writeHead(ur.statusCode || 502, ur.headers);
      ur.pipe(res);
    });
    upstream.on('error', (e) => {
      if (!res.headersSent) res.status(502).send(`Service "${name}" did not respond (${e.message}).`);
    });
    req.pipe(upstream);
  };
}

// ---------- views ----------
function state(id) {
  const p = procs.get(id);
  if (!p) return null;
  return {
    running: Boolean(p.child),
    pid: p.child ? p.child.pid : null,
    port: p.port,
    startedAt: p.startedAt,
    restarts: p.restarts,
    building: p.building,
    hasQR: Boolean(p.rawQR && p.qrAt && Date.now() - new Date(p.qrAt).getTime() < 130000),
    rawQR: p.rawQR,
    pairCode: p.pairCode,
    sessionStringReady: Boolean(p.sessionString)
  };
}

function logs(id) { return ringLines(id); }
function qr(id) {
  const p = procs.get(id);
  return p && p.rawQR ? p.rawQR : null;
}
function stats() {
  let running = 0, building = 0;
  for (const p of procs.values()) { if (p.child) running++; else if (p.building) building++; }
  return { running, building, capacity: MAX_LOCAL_SERVICES, portRange: `${PORT_START}-${PORT_END}` };
}

module.exports = {
  start, stop, restart, destroy, restoreAll, stopAll,
  logs, state, qr, stats,
  proxyFactory, mintSessionString,
  appDir, APPS_DIR
};
