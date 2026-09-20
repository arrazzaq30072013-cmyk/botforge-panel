'use strict';

/**
 * Demo engine — simulates a full Render deployment pipeline locally
 * so the platform is fully functional without a Render API key.
 * Services simulate: build → deploy → running, log streams (incl.
 * WhatsApp QR + pairing-code artifacts), suspend/resume/restart,
 * env var changes, and free-tier sleep cycles.
 */

const crypto = require('crypto');

const DEMO_KEY_HINT = 'rnd_';

function isDemoKey(key) {
  return !key || String(key).trim() === '' || String(key).startsWith(DEMO_KEY_HINT);
}

// ---- simulated lifecycle ----
const timers = new Map();      // serviceId -> interval
const processes = new Map();   // serviceId -> { startedAt, qrPhase, logs[] }

const QR_LINES = [
  '📱 Scan this QR code with WhatsApp:',
  'Scan this QR code with WhatsApp',
  'Scan this QR to login in WhatsApp'
];

const PAIR_PATTERNS = [
  /your\s+pairing\s+code\s*(?:is)?\s*[:\-]?\s*([A-Z0-9]{8}(?:-[A-Z0-9]{4})?)/i,
  /pairing\s+code\s*(?:is)?\s*[:\-]?\s*([A-Z0-9]{8}(?:-[A-Z0-9]{4})?)/i,
  /pair\s*code\s*(?:is)?\s*[:\-]?\s*([A-Z0-9]{8}(?:-[A-Z0-9]{4})?)/i
];

function looksLikePairCode(line) {
  return PAIR_PATTERNS.some(rx => rx.test(line));
}

function extractPairCode(line) {
  for (const rx of PAIR_PATTERNS) {
    const m = line.match(rx);
    if (m) return m[1];
  }
  return null;
}

function genName(base) {
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}

function buildStartCommand(template, customStart) {
  if (customStart) return customStart;
  if (template && template.keepAlive) {
    return template.startCommand;
  }
  return template ? template.startCommand : 'node index.js';
}

function nowISO() { return new Date().toISOString(); }

function emit(service, line, level = 'info') {
  const proc = processes.get(service.id);
  if (!proc) return;
  proc.logs.push({ message: line, timestamp: nowISO(), level });
  if (proc.logs.length > 400) proc.logs.splice(0, proc.logs.length - 400);
  if (looksLikePairCode(line)) {
    proc.pairCode = extractPairCode(line);
    proc.qrPhase = 'pairing';
  }
}

function startProcess(service) {
  stopProcess(service.id);
  const proc = {
    startedAt: nowISO(),
    qrPhase: null,
    pairCode: null,
    qrCount: 0,
    logs: []
  };
  processes.set(service.id, proc);
  const procTimers = [];
  timers.set(service.id, procTimers);

  const t = service.template || {};
  const name = t.name || 'Bot';

  emit(service, `[${name}] Container starting…`, 'info');
  emit(service, `=> Build complete — image pushed to registry`, 'info');
  emit(service, `=> Starting service with command: ${service.startCommand || 'node index.js'}`, 'info');

  const steps = [
    ['[node] Node.js v20.11.1 detected', 400],
    [`[npm] ${t.runtime === 'python' ? 'pip install -r requirements.txt …' : 'npm ci --omit=dev …'}`, 900],
    [`[${name}] Initializing ${t.platform === 'whatsapp' ? 'WhatsApp multi-device engine (Baileys)' : 'bot runtime'}…`, 1600],
  ];

  let delay = 500;
  for (const [line, wait] of steps) {
    setTimeout(() => {
      if (processes.get(service.id) === proc) emit(service, line);
    }, delay);
    delay += wait;
  }

  // WhatsApp QR flow simulation
  if (t.platform === 'whatsapp' && !hasSession(service)) {
    setTimeout(() => {
      const p = processes.get(service.id);
      if (!p || p !== proc) return;
      p.qrPhase = 'qr';
      p.qrCount = 1;
      p.lastRawQR = genRawQR();
      emit(service, '📱 Scan this QR code with WhatsApp:', 'info');
      emit(service, QR_ASCII, 'info');
      // raw QR string like real Baileys logs (used by /qr.png to render a scannable image)
      emit(service, `[baileys] qr: ${p.lastRawQR}`, 'info');
    }, 2600);
    // regenerate QR every ~40s until linked (like real Baileys)
    const qrTimer = setInterval(() => {
      const p = processes.get(service.id);
      if (!p || p !== proc) return;
      if (p.qrPhase === 'qr') {
        p.qrCount++;
        if (p.qrCount > 8) {
          p.qrPhase = null;
          emit(service, '⚠️ QR expired after 8 attempts. Restart the service to pair again.', 'warn');
          return;
        }
        emit(service, `🔄 QR refreshed (${p.qrCount}/8) — scan with WhatsApp → Linked Devices`, 'info');
        p.lastRawQR = genRawQR();
        emit(service, QR_ASCII, 'info');
        emit(service, `[baileys] qr: ${p.lastRawQR}`, 'info');
      }
    }, 40000);
    procTimers.push(qrTimer);
  }

  // heartbeat logs
  const hb = setInterval(() => {
    const p = processes.get(service.id);
    if (!p || p !== proc) return;
    emit(service, `[${name}] 💓 alive — uptime ${formatUptime(p.startedAt)} | mem ${(40 + Math.random() * 25).toFixed(0)}% | cpu ${(2 + Math.random() * 6).toFixed(1)}%`, 'info');
  }, 30000);
  procTimers.push(hb);
}

function stopProcess(id) {
  const procTimers = timers.get(id);
  if (procTimers) {
    for (const x of procTimers) clearInterval(x);
    timers.delete(id);
  }
  processes.delete(id);
}

function hasSession(service) {
  const env = service.env || {};
  return Boolean(env.SESSION_ID && String(env.SESSION_ID).length > 10);
}

const QR_ASCII = String.raw`
▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄▄▄▄  ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄▄▄▄ ▄▄▄▄▄▄▄
█ ▄▄▄ █ █▀█ ▄█ █ ▄▄▄ █ ▀▄▀  █ ▄▄▄ █ ▀▄▀▄ █▀▄▀▀ █ ▄▄▄ █
█ ███ █ █▄▀ █▄ █ ███ █▄▀█▄▄█ ███ █ ██ █ █▄▄▀▄█ ███ █
█ ▄▄▄█ █▄▄▄█▀ █ ▄▄▄█ ▄ █ █▄█ ▄▄▄█ █▄▄██ █ █ ▄▄▄█
█▄▄▄▄▄█ ▄▄█▀▄▄ █▄▄▄▄▄█ █▄█ ▀▄█▄▄▄▄▄█ █▄██▀▄█ █▄▄▄▄▄█
  ▀▄   ▀▄▀ ▄▄▀▀▄    ▀ ▀▄▀▄▀ ▄▄▀▀  ▄▀▄▀▄   ▀▀▄▀ ▀▄   ▀▄
  ▄▀▄▄▀ ▄▄▄█▀█▀▄  ▄▀▄▀ ▀█▀▄▀▄ ▀▀▄▄▀█▀▄▀▄ ▄▄▀▀▄  ▄▀▄▄▀ ▄▀
 █▀▄█▀ ▄▀▀▄▄▀▄▄█ █▄▄▀▄▀▀▄▀▄█ ▄▄▀▀▄▄▀▄▄▀▄▀▀▄█ █▀▄█▀ █
 █▄▀▄▄ █▄▄▄█▄▄▀▄ █ ▄▄▄▄ █▄▄▄▄█ ▄▄▄▄▄▄▄ █▄▄▀▄▄█ █▄▀▄▄ █
  ▀▀▀▀  ▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀ ▀▀▀▀▀  ▀▀▀▀▀▀▀  ▀▀▀▀▀  ▀▀▀▀
`;

// generate a realistic Baileys-style raw QR string (2@<b64>,<b64>,<b64>)
function genRawQR() {
  return `2@${crypto.randomBytes(48).toString('base64')},${crypto.randomBytes(48).toString('base64')},${crypto.randomBytes(48).toString('base64')}`;
}

function formatUptime(startISO) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(startISO).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

// ---- demo "API" implementing the same interface as renderClient ----
const demo = {
  mode: 'demo',

  async listWorkspaces() {
    return [{
      id: 'tea-demo1234567890abcd',
      name: 'Demo Workspace (BotForge)',
      email: 'demo@botforge.local'
    }];
  },

  async listServices(apiKey, ownerId) {
    return [];
  },

  async createService(apiKey, payload) {
    const name = (payload && payload.name) || genName('bot');
    const id = 'svc-demo-' + crypto.randomBytes(8).toString('hex');
    return {
      id,
      name,
      serviceDetails: payload && payload.serviceDetails,
      suspendable: true,
      suspended: 'not_suspended',
      // demo marker
      _demo: true
    };
  },

  async getService(apiKey, serviceId) {
    return { id: serviceId, _demo: true };
  },

  async suspendService(apiKey, serviceId) { return { id: serviceId, suspended: 'suspended', _demo: true }; },
  async resumeService(apiKey, serviceId) { return { id: serviceId, suspended: 'not_suspended', _demo: true }; },
  async deleteService(apiKey, serviceId) { return true; },
  async updateService(apiKey, serviceId, patch) { return { id: serviceId, ...patch, _demo: true }; },

  async triggerDeploy(apiKey, serviceId) {
    return { id: 'dep-demo-' + crypto.randomBytes(6).toString('hex'), status: 'created' };
  },

  async listDeploys(apiKey, serviceId, limit = 20) {
    return [];
  },

  async listEnvVars(apiKey, serviceId) {
    return [];
  },

  async updateEnvVars(apiKey, serviceId, vars) {
    return vars.map(v => ({ key: v.key, value: '***' }));
  },

  async listLogs(apiKey, serviceId, opts = {}) {
    const proc = processes.get(serviceId);
    let logs = proc ? proc.logs.slice(-80) : [];
    return { logs, cursor: null };
  }
};

// -- control endpoints used by routes (not part of Render API) --
function boot(service) { startProcess(service); }
function halt(serviceId) { stopProcess(serviceId); }
function state(serviceId) { return processes.get(serviceId) || null; }

module.exports = {
  isDemoKey,
  demo,
  boot, halt, state,
  QR_ASCII, QR_LINES, PAIR_PATTERNS, extractPairCode, looksLikePairCode
};
