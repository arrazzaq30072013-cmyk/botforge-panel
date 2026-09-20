'use strict';

const path = require('path');

const env = (key, fallback) => {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
};

const config = {
  port: parseInt(env('PORT', 3000), 10),
  nodeEnv: env('NODE_ENV', 'development'),
  isProd: env('NODE_ENV', '') === 'production',

  // Secrets
  jwtSecret: env('JWT_SECRET', 'botforge-dev-jwt-secret-do-not-use-in-prod'),
  encryptionKey: env('ENCRYPTION_KEY', env('JWT_SECRET', 'botforge-dev-enc-key')),

  // Data
  dataDir: path.resolve(env('DATA_DIR', 'data')),

  // Admin bootstrap
  adminEmail: env('ADMIN_EMAIL', '').toLowerCase(),

  // Demo mode
  forceDemo: env('DEMO_MODE', 'false') === 'true',

  // Keep-alive pinger
  pingerEnabled: env('PINGER_ENABLED', 'true') === 'true',
  pingInterval: Math.max(60, parseInt(env('PING_INTERVAL', 240), 10)),
  selfPingUrl: env('SELF_PING_URL', ''),

  brand: {
    name: 'BotForge',
    tagline: 'Deploy bots to Render in seconds',
    version: '1.0.0'
  }
};

if (config.isProd && config.jwtSecret.startsWith('botforge-dev')) {
  console.warn('⚠️  WARNING: JWT_SECRET is not set. Using an insecure default. Set JWT_SECRET and ENCRYPTION_KEY env vars!');
}

module.exports = config;
