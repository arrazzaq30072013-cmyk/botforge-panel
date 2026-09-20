/* ════════════════════════════════════════════════════════════════
   BotForge SPA — app core: router, api, auth, ui helpers
   ════════════════════════════════════════════════════════════════ */

'use strict';

// ────────────── state ──────────────
const state = {
  user: null,
  token: localStorage.getItem('bf_token') || null,
  templates: [],
  mode: null // 'live' | 'demo'
};

// ────────────── api helper ──────────────
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    if (res.status === 401 && state.token) {
      // session expired
      logout(false);
    }
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ────────────── toasts ──────────────
function toast(msg, type = 'ok', ms = 3800) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'ok' ? 'ok' : 'err');
  el.innerHTML = `<span class="ticon">${type === 'ok' ? '✅' : '⚠️'}</span><span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, ms);
}

// ────────────── esc helper ──────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ────────────── auth ──────────────
function logout(callApi = true) {
  state.token = null;
  state.user = null;
  localStorage.removeItem('bf_token');
  if (callApi) toast('Logged out', 'ok');
  navigate('/');
  renderNav();
}

async function refreshMe() {
  if (!state.token) { state.user = null; return false; }
  try {
    const me = await api('/me');
    state.user = me.user;
    state.mode = me.mode;
    state.hasRenderKey = me.hasRenderKey;
    return true;
  } catch {
    state.user = null;
    state.token = null;
    localStorage.removeItem('bf_token');
    return false;
  }
}

// ────────────── router ──────────────
const routes = {};
function route(path, handler) { routes[path] = handler; }

async function navigate(path, { replace = false, silent = false } = {}) {
  const clean = path.split('#')[0] || '/';
  if (location.pathname !== clean) {
    if (replace) history.replaceState({}, '', clean);
    else history.pushState({}, '', clean);
  }
  if (!silent) await render();
  // scroll behavior
  const hash = path.split('#')[1];
  if (hash) {
    setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  } else {
    window.scrollTo(0, 0);
  }
}

// page cleanups: pages register pollers here; they run on every navigation
window.__pageCleanups = [];
function onPageCleanup(fn) { window.__pageCleanups.push(fn); }

async function render() {
  const app = document.getElementById('app');
  const path = location.pathname;

  // stop any pollers / listeners from the previous page
  while (window.__pageCleanups.length) {
    try { window.__pageCleanups.pop()(); } catch {}
  }

  await refreshNavData();

  const showFooter = ['/', '/docs', '/pricing'].includes(path);
  document.getElementById('footer').classList.toggle('hidden', !showFooter);

  // guarded pages
  const guarded = ['/dashboard', '/deploy', '/services', '/settings', '/admin'];
  if (guarded.some(g => path.startsWith(g)) && !state.user) {
    toast('Please log in first', 'err');
    return navigate('/login', { replace: true, silent: true });
  }

  let handler = routes[path];
  if (!handler) {
    // dynamic: /services/:id
    if (path.startsWith('/services/')) handler = routes['/services/:id'];
  }
  if (handler) await handler(app);
  else await routes['404'](app);
  renderNav();
}

async function refreshNavData() {
  if (state.token && !state.user) await refreshMe();
}

function renderNav() {
  const actions = document.getElementById('navActions');
  const links = document.getElementById('navLinks');
  if (state.user) {
    actions.innerHTML = `
      <div class="nav-user">
        <span class="nav-avatar">${esc((state.user.name || '?')[0].toUpperCase())}</span>
        <span class="hidden-mobile" style="color:var(--text-dim)">${esc(state.user.name || state.user.email)}</span>
        ${state.user.role === 'admin' ? '<span class="badge badge-purple">admin</span>' : ''}
      </div>
      <a href="/dashboard" class="btn btn-ghost btn-sm" data-link>Dashboard</a>
      <button class="btn btn-primary btn-sm" id="logoutBtn">Logout</button>`;
    document.getElementById('logoutBtn').onclick = () => logout();
    links.innerHTML = `
      <a href="/dashboard" data-link>Dashboard</a>
      <a href="/deploy" data-link>Deploy</a>
      <a href="/#templates" data-link>Templates</a>
      <a href="/docs" data-link>Docs</a>
      ${state.user.role === 'admin' ? '<a href="/admin" data-link>Admin</a>' : ''}`;
  } else {
    actions.innerHTML = `
      <a href="/login" class="btn btn-ghost btn-sm" data-link>Login</a>
      <a href="/register" class="btn btn-primary btn-sm" data-link>Get started</a>`;
    links.innerHTML = `
      <a href="/#features" data-link>Features</a>
      <a href="/#templates" data-link>Templates</a>
      <a href="/#how" data-link>How it works</a>
      <a href="/#pricing" data-link>Pricing</a>
      <a href="/docs" data-link>Docs</a>`;
  }
  // active link highlighting
  const path = location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    const target = a.getAttribute('href');
    a.classList.toggle('active', target === path || (target !== '/' && path.startsWith(target)));
  });
}

// intercept link clicks
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('http')) return;
  e.preventDefault();
  navigate(href);
});

window.addEventListener('popstate', () => render());

// ────────────── shared ui ──────────────
function setLoading(btn, on, label) {
  if (!btn) return;
  btn.classList.toggle('loading', on);
  const lbl = btn.querySelector('.btn-label') || btn;
  if (label && lbl) lbl.textContent = label;
  if (on) btn.disabled = true; else btn.disabled = false;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function platformBadge(p) {
  const map = {
    whatsapp: ['🟢 WhatsApp', 'badge-green'],
    discord: ['🎮 Discord', 'badge-blue'],
    telegram: ['✈️ Telegram', 'badge-blue'],
    web: ['🌐 Web/Worker', 'badge-purple'],
    custom: ['📦 Custom', 'badge-gray']
  };
  const [label, cls] = map[p] || ['📦 Custom', 'badge-gray'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function statusBadge(status) {
  const map = {
    live: ['● Live', 'badge-green'],
    deploying: ['● Deploying', 'badge-orange'],
    creating: ['● Creating', 'badge-orange'],
    suspended: ['● Suspended', 'badge-yellow'],
    failed: ['● Failed', 'badge-red']
  };
  const [label, cls] = map[status] || ['● ' + status, 'badge-gray'];
  const pulse = (status === 'live' || status === 'deploying') ? 'pulse' : '';
  return `<span class="badge ${cls}"><span class="dot ${pulse}"></span>${label}</span>`;
}

function modal(html) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  return backdrop;
}

function confirmModal(title, text, dangerLabel = 'Delete') {
  return new Promise(resolve => {
    const bd = modal(`
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="mCancel">Cancel</button>
        <button class="btn btn-danger" id="mOk">${esc(dangerLabel)}</button>
      </div>`);
    bd.querySelector('#mCancel').onclick = () => { bd.remove(); resolve(false); };
    bd.querySelector('#mOk').onclick = () => { bd.remove(); resolve(true); };
  });
}

async function loadTemplates() {
  if (state.templates.length) return state.templates;
  try {
    state.templates = await api('/templates');
  } catch {
    state.templates = [];
  }
  return state.templates;
}

// pause helper for async flows
const sleep = ms => new Promise(r => setTimeout(r, ms));

document.getElementById('year').textContent = new Date().getFullYear();

// NOTE: initial boot render is triggered by boot.js (loaded last,
// after all page files have registered their routes).
