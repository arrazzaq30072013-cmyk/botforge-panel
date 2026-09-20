'use strict';

const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./db');
const routes = require('./routes');
const pinger = require('./pinger');
const runner = require('./runner');

const app = express();
app.disable('x-powered-by');
app.use(compression());

// --- security headers (relaxed for same-origin SPA) ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// --- webhook-safe body parsing (raw for anything not JSON) ---
app.use(express.json({ limit: '1mb', type: ['application/json', 'text/plain']}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- tiny request log ---
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// --- reverse proxy: /svc/<name> → locally-run services on our own site ---
app.use(runner.proxyFactory());

// --- API ---
app.use('/api', routes);

// --- static frontend ---
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, {
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (/\.js$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// --- SPA fallback ---
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const index = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Frontend not built.');
});

// --- errors ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// --- boot ---
db.load();

// demo mode: restore simulated processes for services that were "live"
// before a server restart (in-memory demo engine lost its processes).
(function restoreDemo() {
  try {
    const demoEngine = require('./demoEngine');
    let restored = 0;
    for (const s of db.listServices()) {
      if (s.status === 'live' && !s.renderServiceId?.startsWith?.('rnd') && s.renderServiceId && s.renderServiceId.startsWith('svc-demo-')) {
        demoEngine.boot(s);
        restored++;
      }
    }
    if (restored) console.log(`[demo] restored ${restored} simulated live service${restored === 1 ? '' : 's'} after restart`);
  } catch (e) { console.warn('[demo] restore failed:', e.message); }
})();

// local runner: restart processes for services that run on our own site
runner.restoreAll().catch(e => console.warn('[runner] restore failed:', e.message));
let server;
if (require.main === module) {
  server = app.listen(config.port, '0.0.0.0', () => {
    console.log('-'.repeat(60));
    console.log(`  ${config.brand.name} v${config.brand.version}`);
    console.log(`  listening on http://0.0.0.0:${config.port}`);
    console.log(`  data dir: ${config.dataDir}`);
    console.log('-'.repeat(60));
  });
  pinger.start(db);
}

module.exports = app;
