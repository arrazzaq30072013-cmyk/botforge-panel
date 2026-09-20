'use strict';

/**
 * BotForge API routes.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const os = require('os');

const config = require('./config');
const db = require('./db');
const { encrypt, decrypt, randomId, maskSecret } = require('./crypto');
const { signToken, requireAuth, requireAdmin } = require('./auth');
const render = require('./renderClient');
const demoEngine = require('./demoEngine');
const templates = require('./templates');
const pinger = require('./pinger');
const runner = require('./runner');

const router = express.Router();

// ---------- helpers ----------
function getClient(user) {
  const key = (user && user.renderApiKeyEnc) ? decrypt(user.renderApiKeyEnc) : '';
  if (config.forceDemo || demoEngine.isDemoKey(key)) return { api: demoEngine.demo, mode: 'demo' };
  return { api: render, mode: 'live', key };
}

function serviceView(s, userId) {
  const isOwner = !userId || s.userId === userId;
  return {
    id: s.id,
    name: s.name,
    platform: s.platform,
    templateId: s.templateId,
    template: s.template ? { id: s.template.id, name: s.template.name, icon: s.template.icon, platform: s.template.platform } : null,
    repo: s.repo,
    branch: s.branch,
    region: s.region,
    plan: s.plan,
    target: s.target || 'render',
    runtime: s.runtime,
    startCommand: s.startCommand,
    buildCommand: s.buildCommand,
    keepAlive: s.keepAlive,
    url: s.url,
    localUrl: s.target === 'local' ? `/svc/${s.name}` : undefined,
    localPort: isOwner ? s.localPort : undefined,
    status: s.status,
    renderServiceId: isOwner ? s.renderServiceId : undefined,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    lastDeployAt: s.lastDeployAt,
    lastPingOk: s.lastPingOk,
    error: isOwner ? s.error : undefined,
    envKeys: (s.env ? Object.keys(s.env) : []),
    userId: s.userId
  };
}

function envView(s) {
  const env = s.env || {};
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = maskSecret(String(v));
  }
  return out;
}

function classifyLogLine(message) {
  const line = String(message);
  const lower = line.toLowerCase();
  const artifacts = {
    qr: null,
    qr_ascii: null,
    pair_code: null,
    connected: false
  };
  // Pairing code patterns
  const pairMatch = demoEngine.extractPairCode(line);
  if (pairMatch) artifacts.pair_code = pairMatch;
  // QR mention
  if (/scan this qr/i.test(line) || /qr code/i.test(line)) artifacts.qr = true;
  // Connected
  if (/connected successfully/i.test(line) || /logged in/i.test(line) || /bot (is )?ready/i.test(line)) artifacts.connected = true;
  return artifacts;
}

// ---------- public ----------
router.get('/health', (req, res) => {
  res.json({ ok: true, name: config.brand.name, version: config.brand.version, time: new Date().toISOString() });
});

router.get('/templates', (req, res) => {
  res.json(templates);
});

router.get('/stats', (req, res) => {
  res.json(db.stats());
});

// ---------- auth ----------
router.post('/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const cleanEmail = String(email).toLowerCase().trim();
  if (db.findUserByEmail(cleanEmail)) return res.status(409).json({ error: 'An account with this email already exists' });
  const isFirst = db.getDb().users.length === 0;
  const role = (config.adminEmail && cleanEmail === config.adminEmail) || isFirst ? 'admin' : 'user';
  const user = {
    id: randomId('usr-'),
    email: cleanEmail,
    name: (name || cleanEmail.split('@')[0]).slice(0, 60),
    passwordHash: bcrypt.hashSync(String(password), 10),
    role,
    renderApiKeyEnc: '',
    ownerId: '',
    createdAt: new Date().toISOString()
  };
  db.insertUser(user);
  res.status(201).json({ token: signToken(user), user: db.sanitizeUser(user) });
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.findUserByEmail(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user), user: db.sanitizeUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const { passwordHash, renderApiKeyEnc, ...safe } = req.user;
  res.json({
    user: safe,
    hasRenderKey: Boolean(renderApiKeyEnc && decrypt(renderApiKeyEnc)),
    renderKeyMasked: renderApiKeyEnc ? maskSecret(decrypt(renderApiKeyEnc)) : '',
    mode: getClient(req.user).mode
  });
});

// ---------- Render connection ----------
router.post('/render/validate', requireAuth, async (req, res) => {
  const key = String((req.body || {}).apiKey || '').trim();
  if (!key) return res.status(400).json({ error: 'apiKey is required' });
  try {
    const result = await render.validateApiKey(key);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/render/connect', requireAuth, async (req, res) => {
  const key = String((req.body || {}).apiKey || '').trim();
  if (!key) return res.status(400).json({ error: 'apiKey is required' });
  if (demoEngine.isDemoKey(key)) return res.status(400).json({ error: 'That is a demo key. Paste a real rnd_… key from dashboard.render.com → Account Settings → API Keys.' });
  let workspaces;
  try {
    const result = await render.validateApiKey(key);
    if (!result.ok) return res.status(400).json(result);
    workspaces = await render.listWorkspaces(key);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  // save key (encrypted)
  db.updateUser(req.user.id, { renderApiKeyEnc: encrypt(key) });
  // default ownerId if user hasn't picked one
  const user = db.findUserById(req.user.id);
  if (!user.ownerId && workspaces.length) db.updateUser(req.user.id, { ownerId: workspaces[0].id });
  res.json({
    ok: true,
    workspaces,
    ownerId: db.findUserById(req.user.id).ownerId
  });
});

router.post('/render/disconnect', requireAuth, (req, res) => {
  db.updateUser(req.user.id, { renderApiKeyEnc: '', ownerId: '' });
  res.json({ ok: true });
});

router.get('/render/workspaces', requireAuth, async (req, res) => {
  const { api, key, mode } = getClient(req.user);
  try {
    const workspaces = await api.listWorkspaces(key);
    res.json({ workspaces, mode });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/render/owner', requireAuth, (req, res) => {
  const ownerId = String((req.body || {}).ownerId || '').trim();
  if (!ownerId) return res.status(400).json({ error: 'ownerId is required' });
  db.updateUser(req.user.id, { ownerId });
  res.json({ ok: true, ownerId });
});

// ---------- services ----------
router.get('/services', requireAuth, async (req, res) => {
  const mine = db.listServicesByUser(req.user.id);
  res.json(mine.map(s => serviceView(s)));
});

router.post('/services', requireAuth, async (req, res) => {
  const body = req.body || {};
  const { api, key, mode } = getClient(req.user);

  const name = String(body.name || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40);
  if (!name) return res.status(400).json({ error: 'Service name is required' });
  if (db.listServices().some(s => s.name === name)) return res.status(409).json({ error: 'You already have a service with this name' });

  // template or custom repo
  let template = null;
  if (body.templateId) {
    template = templates.find(t => t.id === body.templateId);
    if (!template) return res.status(400).json({ error: 'Unknown template: ' + body.templateId });
  }
  const repo = body.repo || (template && template.repo);
  if (!repo) return res.status(400).json({ error: 'A GitHub repo is required' });
  if (!/^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/.test(repo)) {
    return res.status(400).json({ error: 'Repo must be a GitHub URL (https://github.com/owner/name)' });
  }

  const user = db.findUserById(req.user.id);
  const ownerId = body.ownerId || user.ownerId;
  if (mode === 'live' && !ownerId) {
    return res.status(400).json({ error: 'No Render workspace selected. Connect your Render account first (Settings).' });
  }

  // env vars
  const env = {};
  if (Array.isArray(body.env)) {
    for (const item of body.env) {
      if (item && item.key && item.value !== undefined) env[item.key] = String(item.value);
    }
  } else if (body.env && typeof body.env === 'object') {
    for (const [k, v] of Object.entries(body.env)) env[k] = String(v);
  }

  // required env checks
  if (template) {
    for (const spec of template.env || []) {
      if (spec.required && !env[spec.key]) {
        return res.status(400).json({ error: `Missing required environment variable: ${spec.key}` });
      }
    }
  }

  const plan = body.plan || (template ? template.plan : 'free') || 'free';
  const startCommand = String(body.startCommand || (template ? template.startCommand : '') || 'node index.js');
  const buildCommand = String(body.buildCommand || (template ? template.buildCommand : '') || 'npm install');
  const keepAlive = body.keepAlive !== undefined ? Boolean(body.keepAlive) : (template ? template.keepAlive !== false : true);
  const region = ['oregon', 'frankfurt', 'ohio', 'singapore', 'virginia', 'virginia-2'].includes(body.region) ? body.region : 'oregon';
  const target = body.target === 'local' ? 'local' : 'render';

  const record = {
    id: randomId('svc-'),
    userId: req.user.id,
    name,
    platform: template ? template.platform : (body.platform || 'custom'),
    templateId: template ? template.id : null,
    template: template ? {
      id: template.id, name: template.name, icon: template.icon,
      platform: template.platform, env: template.env, keepAlive: template.keepAlive,
      description: template.description
    } : null,
    repo, branch: body.branch || (template ? template.branch : 'main') || 'main',
    region, plan, runtime: template ? template.runtime : (body.runtime || 'node'),
    target, startCommand, buildCommand, keepAlive,
    env,
    status: 'creating',
    renderServiceId: null,
    localPort: null,
    url: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // ---- run on our own site (local runner) vs delegate to Render ----
  try {
    if (target === 'local') {
      // LOCAL: clone + build + spawn right here on this server
      db.insertService(record);
      res.status(201).json({
        service: serviceView(record),
        mode: 'local',
        deployStarted: true,
        note: 'Deploy started on our own server — cloning repo and installing dependencies. First build takes 1–3 minutes; watch Live Logs.'
      });
      // build+spawn in background (route already responded)
      runner.start(record, { rebuild: true }).catch(e => {
        // status/error already recorded by runner via db
      });
      return;
    }
    let created;
    if (mode === 'live') {
      const payload = {
        type: plan === 'worker' ? 'worker' : 'web_service',
        name,
        ownerId,
        repo,
        branch: record.branch,
        autoDeploy: 'yes',
        envVars: Object.entries(env).map(([key, value]) => ({ key, value })),
        serviceDetails: {
          plan: 'free',
          region,
          buildCommand,
          startCommand
        }
      };
      created = await api.createService(key, payload);
      record.renderServiceId = created.id;
      record.status = 'deploying';
      const url = (created.serviceDetails && created.serviceDetails.url) || null;
      record.url = url ? `https://${url.replace(/^https?:\/\//, '')}` : `https://${name}.onrender.com`;
      // On free tier, attach a disk? No — free has no disks. Just record.
    } else {
      // demo
      const created = await api.createService(key, {
        name,
        serviceDetails: { plan, region, buildCommand, startCommand }
      });
      record.renderServiceId = created.id;
      record.status = 'deploying';
      record.url = `https://${name}.onrender.com`;
    }
  } catch (e) {
    record.status = 'failed';
    record.error = e.message;
    db.insertService(record);
    return res.status(502).json({ error: `Render deploy failed: ${e.message}`, service: serviceView(record) });
  }

  db.insertService(record);

  if (mode === 'demo') {
    demoEngine.boot(record);
    // simulate deploy progression
    setTimeout(() => {
      const fresh = db.findServiceById(record.id);
      if (fresh && fresh.status === 'deploying') db.updateService(record.id, { status: 'live', lastDeployAt: new Date().toISOString() });
    }, 9000);
  }

  res.status(201).json({
    service: serviceView(record),
    mode,
    deployStarted: true,
    note: mode === 'demo'
      ? 'Demo deploy started — service will be live in a few seconds (simulated).'
      : 'Render deploy triggered. First build usually takes 3–8 minutes.'
  });
});

router.get('/services/:id', requireAuth, async (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });
  const { api, key, mode } = getClient(req.user);
  let live = null;
  if (mode === 'live' && s.renderServiceId) {
    try { live = await api.getService(key, s.renderServiceId); } catch { live = null; }
  }
  res.json({ service: serviceView(s, req.user.id), env: envView(s), mode, live });
});

router.delete('/services/:id', requireAuth, async (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });
  const { api, key, mode } = getClient(req.user);
  if (s.target === 'local') {
    await runner.destroy(s.id);
    db.deleteService(s.id);
    return res.json({ ok: true, deleted: s.id, note: 'Local service removed — code, process and data deleted from server.' });
  }
  if (mode === 'live' && s.renderServiceId) {
    try { await api.deleteService(key, s.renderServiceId); } catch (e) {
      return res.status(502).json({ error: `Failed to delete on Render: ${e.message}` });
    }
  }
  demoEngine.halt(s.id);
  db.deleteService(s.id);
  res.json({ ok: true, deleted: s.id });
});

// actions: suspend / resume / restart
router.post('/services/:id/action', requireAuth, async (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });

  const action = String((req.body || {}).action || '');
  const { api, key, mode } = getClient(req.user);

  try {
    if (s.target === 'local') {
      if (action === 'suspend') {
        runner.stop(s.id);
        db.updateService(s.id, { status: 'suspended', updatedAt: new Date().toISOString() });
        return res.json({ ok: true, status: 'suspended', note: 'Process stopped on our server. Code and session data kept.' });
      }
      if (action === 'restart') {
        runner.restart(s);
        return res.json({ ok: true, status: 'live', note: 'Restarting the process with current env vars…' });
      }
      if (action === 'resume') {
        const fresh = db.findServiceById(s.id);
        await runner.start(fresh, { rebuild: false });
        return res.json({ ok: true, status: 'live', note: 'Process resumed on our server.' });
      }
      return res.status(400).json({ error: 'Unknown action. Use suspend, resume or restart.' });
    }
    if (action === 'suspend') {
      if (mode === 'live' && s.renderServiceId) await api.suspendService(key, s.renderServiceId);
      demoEngine.halt(s.id);
      db.updateService(s.id, { status: 'suspended', updatedAt: new Date().toISOString() });
      return res.json({ ok: true, status: 'suspended' });
    }
    if (action === 'resume' || action === 'restart') {
      if (mode === 'live' && s.renderServiceId) {
        if (action === 'resume' && s.status === 'suspended') await api.resumeService(key, s.renderServiceId);
        else await api.triggerDeploy(key, s.renderServiceId);
      }
      db.updateService(s.id, { status: 'live', updatedAt: new Date().toISOString() });
      if (mode === 'demo') {
        const fresh = db.findServiceById(s.id);
        fresh.status = 'live';
        demoEngine.boot(fresh);
      }
      return res.json({ ok: true, status: 'live' });
    }
    return res.status(400).json({ error: 'Unknown action. Use suspend, resume or restart.' });
  } catch (e) {
    return res.status(502).json({ error: `Render action failed: ${e.message}` });
  }
});

// env vars management
router.get('/services/:id/env', requireAuth, (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });
  res.json({ env: envView(s) });
});

router.put('/services/:id/env', requireAuth, async (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });

  const incoming = req.body && (req.body.env || req.body);
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'env object required' });

  const env = { ...(s.env || {}) };
  let changed = 0;
  for (const [k, v] of Object.entries(incoming)) {
    const key = String(k).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!key) continue;
    // masked value => unchanged
    if (String(v).includes('*')) continue;
    if (env[key] !== String(v)) changed++;
    env[key] = String(v);
  }
  db.updateService(s.id, { env, updatedAt: new Date().toISOString() });

  // local services: env is applied to the child on next start/restart
  if (s.target === 'local') {
    const rst = runner.state(s.id);
    const running = Boolean(rst && rst.running);
    return res.json({ ok: true, changed, running, note: running ? 'Env saved. Restart the service to apply the new values to the running process.' : 'Env saved. It will be applied when the service starts.', env: envView(db.findServiceById(s.id)) });
  }

  const { api, key, mode } = getClient(req.user);
  if (mode === 'live' && s.renderServiceId && changed > 0) {
    try {
      await api.updateEnvVars(key, s.renderServiceId, Object.entries(env).map(([k2, v2]) => ({ key: k2, value: v2 })));
      await api.triggerDeploy(key, s.renderServiceId);
    } catch (e) {
      return res.status(502).json({ error: `Saved locally, but Render sync failed: ${e.message}` });
    }
  }
  res.json({ ok: true, changed, env: envView(db.findServiceById(s.id)) });
});

// logs
router.get('/services/:id/logs', requireAuth, async (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });

  const { api, key, mode } = getClient(req.user);
  try {
    let logs = [];
    if (s.target === 'local') {
      const rlogs = runner.logs(s.id);
      const rstate = runner.state(s.id);
      if (rlogs.length) {
        logs = rlogs;
      } else if (rstate && rstate.building) {
        logs = [{ message: 'Building on our server — cloning repo and installing dependencies…', timestamp: new Date().toISOString(), level: 'build' }];
      } else if (s.status === 'suspended') {
        logs = [{ message: 'Service is suspended. Resume it to start the process again.', timestamp: new Date().toISOString(), level: 'warn' }];
      } else {
        logs = [{ message: 'No logs yet — the process has not produced output.', timestamp: new Date().toISOString(), level: 'warn' }];
      }
    } else if (mode === 'live' && s.renderServiceId) {
      const r = await api.listLogs(key, s.renderServiceId, { limit: 100 });
      logs = (r.logs || []).map(l => ({
        message: l.message,
        timestamp: l.timestamp,
        level: /error|fail/i.test(l.message || '') ? 'error' : 'info'
      }));
    } else {
      const proc = demoEngine.state(s.id);
      if (proc) {
        logs = proc.logs.map(l => ({ ...l }));
      } else {
        logs = [{ message: 'Service is not running. Resume or restart it to see logs.', timestamp: new Date().toISOString(), level: 'warn' }];
      }
    }
    // detect QR / pair code artifacts
    const artifacts = { qr: false, qr_ascii: null, pair_code: null, connected: false };
    const lines = logs.map(l => {
      const a = classifyLogLine(l.message);
      if (a.qr) artifacts.qr = true;
      if (a.pair_code) artifacts.pair_code = a.pair_code;
      if (a.connected) artifacts.connected = true;
      return { ...l, artifacts: a };
    });
    // local runner has a live QR handle
    if (s.target === 'local') {
      const rst = runner.state(s.id);
      if (rst && rst.hasQR) artifacts.qr = true;
      if (rst && rst.pairCode) artifacts.pair_code = rst.pairCode;
      if (rst && rst.sessionStringReady) artifacts.connected = true;
    }
    res.json({ logs: lines, artifacts, mode: s.target === 'local' ? 'local' : mode });
  } catch (e) {
    res.status(502).json({ error: `Failed to fetch logs: ${e.message}` });
  }
});

// generate QR image for a WhatsApp service from the latest ASCII QR in logs
// NOTE: <img> tags cannot send Authorization headers, so this one route also
// accepts the JWT via ?token= query param.
router.get('/services/:id/qr.png', (req, res, next) => {
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, requireAuth, async (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });

  const { api, key, mode } = getClient(req.user);
  let logs = [];
  if (s.target === 'local') {
    // prefer the runner's live QR handle (set by the qrshim hook)
    const raw = runner.qr(s.id);
    if (raw) {
      const QRCode = require('qrcode');
      const buf = await QRCode.toBuffer(raw, { width: 320, margin: 2 });
      res.setHeader('Content-Type', 'image/png');
      return res.send(buf);
    }
    // fall back to scanning local logs
    const rlogs = runner.logs(s.id);
    const rraw = extractRawQR(rlogs.map(l => l.message));
    if (rraw) {
      const QRCode = require('qrcode');
      const buf = await QRCode.toBuffer(rraw, { width: 320, margin: 2 });
      res.setHeader('Content-Type', 'image/png');
      return res.send(buf);
    }
    return res.status(404).json({ error: 'No QR yet — the bot has not printed a WhatsApp QR. Wait for "Scan this QR code" in the logs.' });
  }
  if (mode === 'live' && s.renderServiceId) {
    try {
      const r = await api.listLogs(key, s.renderServiceId, { limit: 100 });
      logs = (r.logs || []).map(l => l.message || '');
    } catch { logs = []; }
  } else {
    const proc = demoEngine.state(s.id);
    logs = proc ? proc.logs.map(l => l.message) : [];
  }
  // find QR content: either an ASCII QR block or an explicit raw string
  const raw = extractRawQR(logs);
  if (raw) {
    const QRCode = require('qrcode');
    const buf = await QRCode.toBuffer(raw, { width: 320, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    return res.send(buf);
  }
  res.status(404).json({ error: 'No QR in recent logs yet. Wait for the bot to print a QR code.' });
});

// extract raw QR string from log lines
function extractRawQR(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = String(lines[i] || '');
    // Baileys logs raw QR as a long base64-ish string (2@...,xxx)
    const m = line.match(/2@[A-Za-z0-9+/=]{40,},[A-Za-z0-9+/=]{40,}/);
    if (m) return m[0];
    // generic long token
    if (/^[A-Za-z0-9+/=]{80,}$/.test(line.trim())) return line.trim();
  }
  return null;
}

// deploys history
router.get('/services/:id/deploys', requireAuth, async (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });
  const { api, key, mode } = getClient(req.user);
  try {
    let deploys = [];
    if (s.target === 'local') {
      deploys = [
        { id: 'dep-local-' + (s.lastDeployAt || s.createdAt).replace(/\W/g, '').slice(-8), status: s.status === 'failed' ? 'build_failed' : (s.status === 'live' ? 'live' : 'deactivated'), trigger: 'api', createdAt: s.createdAt, finishedAt: s.lastDeployAt }
      ];
      return res.json({ deploys, mode: 'local' });
    }
    if (mode === 'live' && s.renderServiceId) {
      deploys = await api.listDeploys(key, s.renderServiceId, 20);
    } else {
      deploys = [
        { id: 'dep-initial', status: 'live', trigger: 'api', createdAt: s.createdAt, finishedAt: s.lastDeployAt },
      ];
    }
    res.json({ deploys, mode });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---------- keep-alive / uptime tools ----------
router.get('/uptime', requireAuth, (req, res) => {
  const rows = db.listServicesByUser(req.user.id).map(s => ({
    id: s.id,
    name: s.name,
    platform: s.platform,
    status: s.status,
    keepAlive: s.keepAlive,
    url: s.url,
    lastPingOk: s.lastPingOk
  }));
  res.json({ services: rows, pinger: { enabled: config.pingerEnabled, interval: config.pingInterval, stats: pinger.stats } });
});

// ---------- admin ----------
router.get('/admin/stats', requireAuth, requireAdmin, (req, res) => {
  res.json({ ...db.stats(), users: db.listUsers().map(u => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt, hasRenderKey: Boolean(u.renderApiKeyEnc) })) });
});

router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  res.json(db.listUsers().map(u => ({ ...db.sanitizeUser(u), hasRenderKey: Boolean(u.renderApiKeyEnc) })));
});

router.post('/admin/users/:id/role', requireAuth, requireAdmin, (req, res) => {
  const role = (req.body || {}).role;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be user or admin' });
  const u = db.updateUser(req.params.id, { role });
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true, user: db.sanitizeUser(u) });
});

// ---------- misc ----------
router.get('/system', (req, res) => {
  res.json({
    brand: config.brand,
    node: process.version,
    uptime: os.uptime(),
    memory: { total: Math.round(os.totalmem() / 1e6), free: Math.round(os.freemem() / 1e6) },
    pinger: { enabled: config.pingerEnabled, interval: config.pingInterval },
    runner: runner.stats(),
    demoMode: config.forceDemo
  });
});

// session string (local runner mints this after a successful QR pairing)
router.get('/services/:id/session', requireAuth, async (req, res) => {
  const s = db.findServiceById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  if (s.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your service' });
  if (s.target !== 'local') return res.status(400).json({ error: 'Session strings are minted for locally-run services only.' });
  const rst = runner.state(s.id);
  if (!rst || !rst.sessionStringReady) return res.status(404).json({ error: 'No session yet. Pair via QR first — the string appears after the bot connects.' });
  // full string lives on the runner state; fetch from logs ring
  const lines = runner.logs(s.id).map(l => l.message);
  const m = lines.find(x => /^KnightBot!/.test(x));
  if (!m) return res.status(404).json({ error: 'Session string not found in recent logs.' });
  res.json({ session: m });
});

module.exports = router;
