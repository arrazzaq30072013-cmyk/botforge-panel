'use strict';

/**
 * Minimal, dependency-free client for the Render Public API (v1).
 * Docs: https://api-docs.render.com/
 * Base: https://api.render.com/v1
 */

const RENDER_API = 'https://api.render.com/v1';

class RenderApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'RenderApiError';
    this.status = status;
    this.body = body;
  }
}

async function call(method, path, apiKey, body, query) {
  const url = new URL(RENDER_API + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  let res;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new RenderApiError(`Network error contacting Render API: ${e.message}`, 502, null);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const msg = (data && data.message) || `Render API ${method} ${path} failed with ${res.status}`;
    throw new RenderApiError(msg, res.status, data);
  }
  return data;
}

// ---- Workspaces (formerly "owners") ----
async function listWorkspaces(apiKey) {
  const out = await call('GET', '/owners', apiKey);
  return out.map(o => (o && o.owner) ? o.owner : o).filter(Boolean);
}

// ---- Services ----
async function listServices(apiKey, ownerId) {
  const q = { limit: 100 };
  if (ownerId) q.ownerId = ownerId;
  const out = await call('GET', '/services', apiKey, undefined, q);
  return out.map(x => (x && x.service) ? x.service : x).filter(Boolean);
}

async function getService(apiKey, serviceId) {
  return call('GET', `/services/${encodeURIComponent(serviceId)}`, apiKey);
}

async function createService(apiKey, payload) {
  return call('POST', '/services', apiKey, payload);
}

async function updateService(apiKey, serviceId, patch) {
  return call('PATCH', `/services/${encodeURIComponent(serviceId)}`, apiKey, patch);
}

async function deleteService(apiKey, serviceId) {
  return call('DELETE', `/services/${encodeURIComponent(serviceId)}`, apiKey);
}

async function suspendService(apiKey, serviceId) {
  return call('POST', `/services/${encodeURIComponent(serviceId)}/suspend`, apiKey, {});
}

async function resumeService(apiKey, serviceId) {
  return call('POST', `/services/${encodeURIComponent(serviceId)}/resume`, apiKey, {});
}

// ---- Deploys ----
async function listDeploys(apiKey, serviceId, limit = 20) {
  const out = await call('GET', `/services/${encodeURIComponent(serviceId)}/deploys`, apiKey, undefined, { limit });
  return out.map(x => (x && x.deploy) ? x.deploy : x).filter(Boolean);
}

async function triggerDeploy(apiKey, serviceId, clearCache = false) {
  return call('POST', `/services/${encodeURIComponent(serviceId)}/deploys`, apiKey, {
    clearCache: clearCache ? 'clear' : 'do_not_clear'
  });
}

// ---- Env vars ----
async function listEnvVars(apiKey, serviceId) {
  const out = await call('GET', `/services/${encodeURIComponent(serviceId)}/env-vars`, apiKey, undefined, { limit: 100 });
  return out.map(x => (x && x.envVar) ? x.envVar : x).filter(Boolean);
}

async function updateEnvVars(apiKey, serviceId, vars) {
  // PUT replaces all env vars. Merge existing ones with ours first.
  const existing = await listEnvVars(apiKey, serviceId);
  const payload = existing
    .filter(v => !v.key.startsWith('RENDER_')) // never touch Render-injected vars
    .map(v => ({ key: v.key, value: v.value }))
    .concat(vars.map(v => ({ key: v.key, value: v.value })));
  // dedupe by key, ours win
  const byKey = new Map();
  for (const v of payload) byKey.set(v.key, v);
  return call('PUT', `/services/${encodeURIComponent(serviceId)}/env-vars`, apiKey, Array.from(byKey.values()));
}

async function deleteEnvVar(apiKey, serviceId, key) {
  return call('DELETE', `/services/${encodeURIComponent(serviceId)}/env-vars/${encodeURIComponent(key)}`, apiKey);
}

// ---- Logs ----
async function listLogs(apiKey, serviceId, opts = {}) {
  const filter = {
    service: serviceId,
    limit: opts.limit || 100
  };
  if (opts.startTime) filter.startTime = new Date(opts.startTime).toISOString();
  if (opts.endTime) filter.endTime = new Date(opts.endTime).toISOString();
  const q = { filter: JSON.stringify(filter) };
  if (opts.cursor) q.cursor = opts.cursor;
  const out = await call('GET', '/logs', apiKey, undefined, q);
  const logs = Array.isArray(out) ? out.map(x => (x && x.log) ? x.log : x).filter(Boolean) : [];
  return { logs, cursor: null };
}

// ---- Validation ----
async function validateApiKey(apiKey) {
  try {
    const me = await call('GET', '/users', apiKey);
    return { ok: true, user: me };
  } catch (e) {
    if (e.status === 401) return { ok: false, error: 'Invalid API key (unauthorized)' };
    if (e.status === 403) return { ok: false, encryptedkey: false, error: 'API key lacks permission' };
    throw e;
  }
}

module.exports = {
  RenderApiError,
  listWorkspaces,
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
  suspendService,
  resumeService,
  listDeploys,
  triggerDeploy,
  listEnvVars,
  updateEnvVars,
  deleteEnvVar,
  listLogs,
  validateApiKey
};
