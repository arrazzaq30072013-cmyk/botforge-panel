'use strict';

/**
 * Tiny JSON-file database with atomic writes.
 * Good for a single-instance platform service; swap for Postgres
 * by replacing the functions in this module.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_FILE = path.join(config.dataDir, 'db.json');

const DEFAULT_DB = {
  users: [],
  services: [],
  meta: { createdAt: new Date().toISOString(), version: 1 }
};

let db = null;
let writing = false;

function ensureDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function load() {
  ensureDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      db = { ...DEFAULT_DB, ...parsed };
      db.meta = { ...DEFAULT_DB.meta, ...(parsed.meta || {}) };
    } else {
      db = JSON.parse(JSON.stringify(DEFAULT_DB));
      persist();
    }
  } catch (err) {
    console.error('⚠️  Failed to load db.json, starting fresh:', err.message);
    db = JSON.parse(JSON.stringify(DEFAULT_DB));
    try { persist(); } catch { /* ignore */ }
  }
  return db;
}

function persist() {
  if (!db) return;
  if (writing) { // retry later, one level deep
    writing = false;
  }
  writing = true;
  try {
    ensureDir();
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('⚠️  Failed to persist db.json:', err.message);
  } finally {
    writing = false;
  }
}

function getDb() {
  if (!db) load();
  return db;
}

// ---------- users ----------
function findUserByEmail(email) {
  return getDb().users.find(u => u.email === String(email).toLowerCase()) || null;
}
function findUserById(id) {
  return getDb().users.find(u => u.id === id) || null;
}
function insertUser(user) {
  const dbref = getDb();
  dbref.users.push(user);
  persist();
  return user;
}
function updateUser(id, patch) {
  const dbref = getDb();
  const idx = dbref.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  dbref.users[idx] = { ...dbref.users[idx], ...patch, id };
  persist();
  return dbref.users[idx];
}
function listUsers() {
  return getDb().users.map(sanitizeUser);
}
function sanitizeUser(u) {
  if (!u) return null;
  const { passwordHash, renderApiKeyEnc, ...rest } = u;
  return rest;
}

// ---------- services ----------
function listServices() {
  return getDb().services;
}
function listServicesByUser(userId) {
  return getDb().services.filter(s => s.userId === userId);
}
function findServiceById(id) {
  return getDb().services.find(s => s.id === id) || null;
}
function insertService(service) {
  const dbref = getDb();
  dbref.services.push(service);
  persist();
  return service;
}
function updateService(id, patch) {
  const dbref = getDb();
  const idx = dbref.services.findIndex(s => s.id === id);
  if (idx === -1) return null;
  dbref.services[idx] = { ...dbref.services[idx], ...patch, id };
  persist();
  return dbref.services[idx];
}
function deleteService(id) {
  const dbref = getDb();
  const idx = dbref.services.findIndex(s => s.id === id);
  if (idx === -1) return null;
  const [removed] = dbref.services.splice(idx, 1);
  persist();
  return removed;
}

// ---------- stats ----------
function stats() {
  const d = getDb();
  const byPlatform = {};
  let running = 0;
  let suspended = 0;
  for (const s of d.services) {
    byPlatform[s.platform] = (byPlatform[s.platform] || 0) + 1;
    if (s.status === 'suspended') suspended++;
    else running++;
  }
  return {
    users: d.users.length,
    services: d.services.length,
    running,
    suspended,
    byPlatform,
    createdAt: d.meta.createdAt
  };
}

module.exports = {
  load, getDb, persist,
  findUserByEmail, findUserById, insertUser, updateUser, listUsers, sanitizeUser,
  listServices, listServicesByUser, findServiceById, insertService, updateService, deleteService,
  stats,
  DB_FILE
};
