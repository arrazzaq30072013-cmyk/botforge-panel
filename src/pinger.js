'use strict';

/**
 * Keep-alive pinger.
 * Every PING_INTERVAL seconds, pings the public URL of every
 * active service (and optionally the platform itself) so free-tier
 * Render services never spin down.
 */

const config = require('./config');

const lastPinged = new Map(); // url -> timestamp
const stats = { totalPings: 0, successes: 0, failures: 0, lastRun: null };

async function ping(url, timeoutMs = 10000) {
  if (!url) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'BotForge-KeepAlive/1.0' }
    });
    clearTimeout(t);
    return res.ok || res.status === 404 || res.status === 403 || res.status <= 499;
  } catch {
    return false;
  }
}

async function runPingerCycle(db) {
  const targets = [];
  for (const s of db.listServices()) {
    if (s.status === 'suspended' || !s.url) continue;
    if (s.keepAlive === false) continue;
    targets.push({ id: s.id, name: s.name, url: s.url });
  }
  if (config.selfPingUrl) {
    targets.push({ id: '__self', name: 'BotForge', url: config.selfPingUrl });
  }
  for (const target of targets) {
    const ok = await ping(target.url);
    stats.totalPings++;
    if (ok) stats.successes++; else stats.failures++;
    lastPinged.set(target.url, Date.now());
    if (ok) db.updateService(target.id, { lastPingOk: new Date().toISOString() });
    console.log(`[${new Date().toISOString()}] [pinger] ${ok ? '✅' : '❌'} ${target.name} → ${target.url}`);
  }
  stats.lastRun = new Date().toISOString();
}

function start(db) {
  if (!config.pingerEnabled) {
    console.log('[pinger] disabled (PINGER_ENABLED=false)');
    return;
  }
  console.log(`[pinger] started — pinging every ${config.pingInterval}s`);
  // first run shortly after boot
  setTimeout(() => runPingerCycle(db).catch(() => {}), 15000);
  const iv = setInterval(() => runPingerCycle(db).catch(() => {}), config.pingInterval * 1000);
  // don't keep the process alive just for the pinger
  if (iv.unref) iv.unref();
}

module.exports = { start, runPingerCycle, ping, stats, lastPinged };
