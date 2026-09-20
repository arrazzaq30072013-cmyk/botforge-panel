'use strict';

/**
 * AES-256-GCM encryption helpers.
 * Used to encrypt user Render API keys and bot environment
 * variables at rest inside the JSON data store.
 */

const crypto = require('crypto');
const config = require('./config');

const ALGO = 'aes-256-gcm';
const SALT = 'botforge-static-salt-v1';

let cachedKey = null;
function getKey() {
  if (!cachedKey) {
    cachedKey = crypto.scryptSync(config.encryptionKey, SALT, 32);
  }
  return cachedKey;
}

/**
 * Encrypt plaintext -> "v1.<iv>.<tag>.<ciphertext>" (base64url parts)
 */
function encrypt(plain) {
  if (plain === undefined || plain === null) plain = '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
}

/**
 * Decrypt "v1..." string back to plaintext. Returns '' on failure.
 */
function decrypt(payload) {
  try {
    if (!payload || typeof payload !== 'string' || !payload.startsWith('v1.')) return '';
    const [, ivB, tagB, dataB] = payload.split('.');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, 'base64url')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return '';
  }
}

function randomId(prefix, len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return `${prefix}${out}`;
}

function maskSecret(value, visible = 4) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= visible * 2) return '*'.repeat(s.length);
  return `${s.slice(0, visible)}${'*'.repeat(Math.min(12, s.length - visible * 2))}${s.slice(-visible)}`;
}

module.exports = { encrypt, decrypt, randomId, maskSecret };
