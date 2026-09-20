/* ═════════════════════════════   BotForge — service manager   ═════════════════════════════
   Route: /services/:id
   Tabs: Overview | Environment | Live Logs | QR Pairing | Deploys
   ══════════════════════════════════════════════════════════════════ */

'use strict';

route('/services/:id', async (app) => {
  const id = location.pathname.split('/').pop();
  app.innerHTML = '<div class="spin-lg"></div>';

  let data;
  try {
    data = await api('/services/' + id);
  } catch (e) {
    app.innerHTML = `<div class="container center" style="padding:80px 20px">
      <div style="font-size:3rem">🫥</div>
      <h2>Service not found</h2>
      <p class="muted">${esc(e.message)}</p>
      <a href="/dashboard" class="btn btn-ghost mt-1" data-link>← Dashboard</a>
    </div>`;
    return;
  }

  const { service: s, env, mode } = data;
  const isWhatsapp = s.platform === 'whatsapp' || (s.template && s.template.platform === 'whatsapp');
  let activeTab = 'overview';

  function head() {
    return `
    <div class="svc-detail-head">
      <div class="flex" style="gap:16px;align-items:center">
        <div class="tcard-icon" style="font-size:2rem">${s.template ? esc(s.template.icon) : '📦'}</div>
        <div>
          <h1 style="margin-bottom:6px">${esc(s.name)}</h1>
          <div class="flex gap-2" style="flex-wrap:wrap">
            ${platformBadge(s.platform)}
            ${statusBadge(s.status)}
            ${s.target === 'local' ? '<span class="badge badge-runtime-local">🖥️ runs on our site</span>' : '<span class="badge badge-runtime-render">☁️ on Render</span>'}
            ${s.target !== 'local' ? `<span class="badge badge-gray">${esc(s.plan || 'free')} plan</span>` : ''}
            ${s.keepAlive ? '<span class="badge badge-green">💓 keep-alive on</span>' : '<span class="badge badge-gray">keep-alive off</span>'}
            ${mode === 'demo' ? '<span class="badge badge-purple">🧪 demo</span>' : ''}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        ${s.target === 'local' ? `<a href="/svc/${esc(s.name)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">↗ /svc/${esc(s.name)}</a>` : (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">↗ Open URL</a>` : '')}
        ${s.status === 'suspended' ? `<button class="btn btn-green btn-sm" id="btnResume">▶ Resume</button>` : ''}
        ${s.status !== 'suspended' ? `<button class="btn btn-ghost btn-sm" id="btnRestart">↻ Restart</button>` : ''}
        ${s.status !== 'suspended' ? `<button class="btn btn-ghost btn-sm" id="btnSuspend">⏸ Suspend</button>` : ''}
        <button class="btn btn-danger btn-sm" id="btnDelete">🗑 Delete</button>
      </div>
    </div>`;
  }

  function tabs() {
    const tabs = [
      ['overview', '📋 Overview'],
      ['env', '🔐 Environment'],
      ['logs', '📜 Live Logs'],
      ...(isWhatsapp ? [['qr', '📱 QR Pairing']] : []),
      ['deploys', '📦 Deploys']
    ];
    return `<div class="detail-tabs" id="detailTabs">
      ${tabs.map(([tid, label]) => `<div class="dtab ${activeTab === tid ? 'active' : ''}" data-tab="${tid}">${label}</div>`).join('')}
    </div>`;
  }

  async function r() {
    app.innerHTML = `<div class="container dash-wrap">${head()}${tabs()}<div id="tabBody"></div></div>`;
    wireActions();
    document.querySelectorAll('#detailTabs .dtab').forEach(el => {
      el.onclick = () => { activeTab = el.dataset.tab; renderTab(); document.querySelectorAll('#detailTabs .dtab').forEach(d => d.classList.toggle('active', d.dataset.tab === activeTab)); };
    });
    renderTab();
  }

  function wireActions() {
    const act = (btn, action, label) => {
      const el = document.getElementById(btn);
      if (!el) return;
      el.onclick = async () => {
        setLoading(el, true, '…');
        try {
          await api('/services/' + id + '/action', { method: 'POST', body: { action } });
          toast(label + ' ✓', 'ok');
          window.__pageCleanups = [];
          await reload();
        } catch (e) { toast(e.message, 'err', 6000); setLoading(el, false, label); }
      };
    };
    act('btnSuspend', 'suspend', 'Suspended');
    act('btnResume', 'resume', 'Resumed');
    act('btnRestart', 'restart', 'Restart triggered');
    const del = document.getElementById('btnDelete');
    if (del) del.onclick = async () => {
      const ok = await confirmModal('Delete ' + s.name + '?', s.target === 'local' ? 'This stops the process and deletes its code, dependencies and session data from our server. This cannot be undone.' : 'This destroys the service on Render and removes all local history. This cannot be undone.', 'Delete service');
      if (!ok) return;
      setLoading(del, true, 'Deleting…');
      try {
        await api('/services/' + id, { method: 'DELETE' });
        toast('Service deleted', 'ok');
        navigate('/dashboard');
      } catch (e) { toast(e.message, 'err', 6000); setLoading(del, false, '🗑 Delete'); }
    };
  }

  async function reload() {
    try {
      const fresh = await api('/services/' + id);
      Object.assign(s, fresh.service);
      Object.assign(env, fresh.env);
    } catch { return; }
    await r();
  }

  // ─── tab: overview ───
  function tabOverview() {
    const body = document.getElementById('tabBody');
    body.innerHTML = `
    <div class="kv-grid">
      <div class="kv"><div class="k">Repo</div><div class="v"><a href="${esc(s.repo)}" target="_blank" rel="noopener" style="color:var(--accent-2)">${esc(s.repo.replace('https://github.com/', ''))} ↗</a></div></div>
      <div class="kv"><div class="k">Branch</div><div class="v">${esc(s.branch || 'main')}</div></div>
      ${s.target === 'local' ? `
      <div class="kv"><div class="k">Runs on</div><div class="v"><span class="badge badge-runtime-local">our server · port ${esc(String(s.localPort || 'auto'))}</span></div></div>` : `
      <div class="kv"><div class="k">Region</div><div class="v">${esc(s.region || 'oregon')}</div></div>
      <div class="kv"><div class="k">Plan</div><div class="v">${esc(s.plan || 'free')}</div></div>`}
      <div class="kv"><div class="k">Runtime</div><div class="v">${esc(s.runtime || 'node')}</div></div>
      <div class="kv"><div class="k">Service URL</div><div class="v">${s.target === 'local' ? `<a href="/svc/${esc(s.name)}" target="_blank" rel="noopener" style="color:var(--accent-2)">${esc(location.origin + '/svc/' + s.name)} ↗</a>` : (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:var(--accent-2)">${esc(s.url)} ↗</a>` : '—')}</div></div>
      ${s.error ? `<div class="kv"><div class="k">Last error</div><div class="v" style="color:#f87171">${esc(s.error)}</div></div>` : ''}
      <div class="kv"><div class="k">Created</div><div class="v">${fmtDate(s.createdAt)}</div></div>
      <div class="kv"><div class="k">Last deploy</div><div class="v">${fmtDate(s.lastDeployAt)}</div></div>
      <div class="kv"><div class="k">Keep-alive</div><div class="v">${s.keepAlive ? '💓 every few minutes' : 'off'}</div></div>
      <div class="kv"><div class="k">Last ping</div><div class="v">${s.lastPingOk ? '✅ ' + timeAgo(s.lastPingOk) : '—'}</div></div>
      <div class="kv"><div class="k">Env vars</div><div class="v">${(s.envKeys || []).length} configured</div></div>
      ${s.target === 'local' ? `
      <div class="kv"><div class="k">Managed by</div><div class="v">BotForge built-in runner</div></div>` : `
      <div class="kv"><div class="k">Render ID</div><div class="v">${s.renderServiceId ? esc(s.renderServiceId) : (mode === 'demo' ? 'simulated' : '—')}</div></div>`}
    </div>
    ${s.template && s.template.description ? `
    <div class="card panel" style="padding:22px">
      <h3 style="margin-bottom:8px">${esc(s.template.icon || '')} About this bot</h3>
      <p class="muted">${esc(s.template.description)}</p>
    </div>` : ''}`;
  }

  // ─── tab: env ───
  function tabEnv() {
    const body = document.getElementById('tabBody');
    const rows = Object.entries(env || {}).map(([k, v]) => ({ key: k, value: v }));
    if (!rows.length) rows.push({ key: '', value: '' });
    let local = rows;

    body.innerHTML = `
    <div class="card panel" style="padding:26px">
      <h3 style="margin-bottom:6px">🔐 Environment variables</h3>
      <p class="muted small">Secrets are stored encrypted and shown masked. Leave a value as-is (with asterisks) to keep it unchanged. ${s.target === 'local' ? 'Saved vars are applied to the process on its next start — hit ↻ Restart to apply now.' : 'Changes redeploy the service automatically' + (mode === 'demo' ? ' (demo)' : '') + '.'}</p>
      <div id="envRows" style="margin-top:16px"></div>
      <button class="btn btn-ghost btn-sm" id="addEnv">+ Add variable</button>
      <div class="divider"></div>
      <div class="flex" style="justify-content:flex-end">
        <button class="btn btn-primary" id="saveEnv"><span class="btn-label">💾 Save & sync</span></button>
      </div>
    </div>`;

    const draw = () => {
      const box = document.getElementById('envRows');
      box.innerHTML = local.map((row, i) => `
      <div class="env-row">
        <input class="input mono" placeholder="KEY" value="${esc(row.key)}" data-ek="${i}">
        <div class="input-group">
          <input class="input mono" placeholder="value (leave masked to keep)" value="${esc(row.value)}" data-ev="${i}" ${String(row.value).includes('*') ? 'type="password" readonly' : 'type="text"'} ${String(row.value).includes('*') ? 'onclick="this.blur()" style="cursor:not-allowed"' : ''}>
        </div>
        <button class="env-del btn btn-danger" data-ed="${i}">✕</button>
      </div>`).join('');
      box.querySelectorAll('[data-ek]').forEach(el => el.oninput = e => local[+e.target.dataset.ek].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
      box.querySelectorAll('[data-ev]').forEach(el => el.oninput = e => local[+e.target.dataset.ev].value = e.target.value);
      box.querySelectorAll('[data-ed]').forEach(el => el.onclick = () => { local.splice(+el.dataset.ed, 1); if (!local.length) local = [{ key: '', value: '' }]; draw(); });
    };
    draw();
    document.getElementById('addEnv').onclick = () => { local.push({ key: '', value: '' }); draw(); };
    document.getElementById('saveEnv').onclick = async (e) => {
      const btn = e.currentTarget;
      const payload = {};
      for (const r of local) {
        if (!r.key) continue;
        if (String(r.value).includes('*')) continue; // keep masked
        payload[r.key] = r.value;
      }
      if (!Object.keys(payload).length) return toast('Nothing to save — edit some values first', 'err');
      setLoading(btn, true, 'Saving…');
      try {
        const res = await api('/services/' + id + '/env', { method: 'PUT', body: payload });
        toast(`Saved ${res.changed} var${res.changed === 1 ? '' : 's'}${res.changed ? ' & redeploy triggered' : ''}`, 'ok', 5000);
        await reload();
      } catch (err) { toast(err.message, 'err', 6000); setLoading(btn, false, '💾 Save & sync'); }
    };
  }

  // ─── tab: logs ───
  function tabLogs() {
    const body = document.getElementById('tabBody');
    let follow = true;
    let autoscroll = true;

    body.innerHTML = `
    <div class="console">
      <div class="console-bar">
        <div class="console-title">📜 ${esc(s.name)} — live logs</div>
        <div class="flex gap-2">
          <label class="flex small" style="gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="logFollow" checked> follow</label>
          <label class="flex small" style="gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="logScroll" checked> autoscroll</label>
          <button class="btn btn-ghost btn-sm" id="logClear">Clear</button>
          <button class="btn btn-ghost btn-sm" id="logCopy">Copy</button>
        </div>
      </div>
      <div class="console-body" id="logBody"></div>
    </div>
    ${isWhatsapp ? `<p class="muted small mt-1" style="margin-top:10px">📱 Looking for the WhatsApp QR code? Check the <b>QR Pairing</b> tab — it renders the scannable QR from logs automatically.</p>` : ''}`;

    const con = document.getElementById('logBody');
    const logFollowEl = document.getElementById('logFollow');
    const logScrollEl = document.getElementById('logScroll');
    logFollowEl.onchange = e => follow = e.target.checked;
    logScrollEl.onchange = e => autoscroll = e.target.checked;
    document.getElementById('logClear').onclick = () => { con.innerHTML = ''; };
    document.getElementById('logCopy').onclick = () => {
      const text = con.innerText;
      navigator.clipboard.writeText(text).then(() => toast('Logs copied')).catch(() => toast('Copy failed', 'err'));
    };

    const levelClass = l => l === 'error' ? 'error' : l === 'warn' ? 'warn' : '';
    const draw = (logs) => {
      con.innerHTML = logs.map(l => {
        const cls = [levelClass(l.level), l.artifacts && l.artifacts.qr ? 'qr' : ''].filter(Boolean).join(' ');
        const ts = l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : '';
        return `<div class="log-line ${cls}"><span class="log-ts">${esc(ts)}</span><span class="log-msg">${esc(l.message)}</span></div>`;
      }).join('');
      if (autoscroll) con.scrollTop = con.scrollHeight;
    };

    const tick = async () => {
      if (!follow) return;
      try {
        const r = await api('/services/' + id + '/logs');
        draw(r.logs);
      } catch { /* transient */ }
    };
    tick();
    const timer = setInterval(tick, 3000);
    onPageCleanup(() => clearInterval(timer));
  }

  // ┬
  // tab: QR pairing
  function tabQr() {
    const body = document.getElementById('tabBody');
    body.innerHTML = `
    <div class="card panel qr-panel" id="qrBox">
      <div style="font-size:2rem">📱</div>
      <p class="muted">Loading QR…</p>
    </div>`;

    const refresh = async () => {
      let logsData;
      try { logsData = await api('/services/' + id + '/logs'); }
      catch { logsBox(false, 'Failed to fetch logs'); return; }

      const a = logsData.artifacts || {};
      const box = document.getElementById('qrBox');
      if (!box) return;

      if (a.connected) {
        if (s.target === 'local') {
          // try to fetch the minted session string
          let sessionHtml = '<p class="muted">Session authenticated — the bot is online on our server.</p>';
          try {
            const sess = await api('/services/' + id + '/session');
            if (sess && sess.session) {
              sessionHtml = `
              <div class="session-card" style="text-align:left;margin-top:14px">
                <div class="flex" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                  <b>🔑 Session string (save this!)</b>
                  <span class="flex gap-2">
                    <button class="btn btn-ghost btn-sm" id="copySession">Copy</button>
                    <button class="btn btn-ghost btn-sm" id="dlSession">Download .txt</button>
                  </span>
                </div>
                <p class="muted small" style="margin:8px 0">Paste this into SESSION_ID (Environment tab) so the bot re-authenticates after any restart without re-scanning.</p>
                <textarea class="input mono" id="sessionVal" readonly rows="4" style="width:100%;font-size:.72rem;word-break:break-all">${esc(sess.session)}</textarea>
              </div>`;
            }
          } catch { /* no session yet */ }
          box.innerHTML = `
          <div style="font-size:2.6rem">✅</div>
          <h3 style="margin:10px 0 6px">WhatsApp connected!</h3>
          ${sessionHtml}`;
          const cp = document.getElementById('copySession');
          if (cp) cp.onclick = () => {
            const v = document.getElementById('sessionVal').value;
            navigator.clipboard.writeText(v).then(() => toast('Session string copied ✓', 'ok'), () => toast('Copy failed — select the text manually', 'err'));
          };
          const dl = document.getElementById('dlSession');
          if (dl) dl.onclick = () => {
            const v = document.getElementById('sessionVal').value;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([v], { type: 'text/plain' }));
            a.download = s.name + '-session.txt';
            a.click();
          };
        } else {
          box.innerHTML = `
          <div style="font-size:2.6rem">✅</div>
          <h3 style="margin:10px 0 6px">WhatsApp connected!</h3>
          <p class="muted">Session is authenticated and the bot is online. Your session string was saved server-side on Render.</p>`;
        }
        return;
      }
      if (a.pair_code) {
        box.innerHTML = `
        <div style="font-size:2rem">🔗</div>
        <h3 style="margin:10px 0 4px">Pairing code detected</h3>
        <p class="muted small">WhatsApp → Settings → Linked Devices → <b>Link with phone number</b>, then enter this code:</p>
        <div class="paircode-box">${esc(a.pair_code)}</div>`;
        return;
      }
      if (a.qr) {
        box.innerHTML = `
        <div style="font-size:2rem">📱</div>
        <h3 style="margin:10px 0 10px">Scan this QR code</h3>
        <img id="qrImg" alt="WhatsApp QR code" src="/api/services/${esc(id)}/qr.png?token=${encodeURIComponent(state.token)}&_=${Date.now()}" style="max-width:280px">
        <p class="qr-hint">Open <b>WhatsApp → Settings → Linked Devices → Link a Device</b> and point your camera at the QR. It refreshes every ~40 seconds until you scan it.</p>
        <button class="btn btn-ghost btn-sm mt-1" id="qrRefresh">↻ Refresh QR</button>`;
        const rb = document.getElementById('qrRefresh');
        const bump = () => { const im = box.querySelector('img'); if (im) im.src = '/api/services/' + id + '/qr.png?token=' + encodeURIComponent(state.token) + '&_=' + Date.now(); };
        if (rb) rb.onclick = bump;
        const imgTimer = setInterval(() => { if (document.getElementById('qrImg')) bump(); }, 8000);
        onPageCleanup(() => clearInterval(imgTimer));
        // 404 → broken image → show fallback
        const img = box.querySelector('img');
        img.onerror = () => {
          box.innerHTML = `
          <div style="font-size:2rem">📱</div>
          <h3 style="margin:10px 0 6px">QR is in the logs</h3>
          <p class="muted">The bot printed an ASCII QR code. Open the <b>Live Logs</b> tab and scan it there (or copy it into your phone's WhatsApp scanner via the console).</p>`;
        };
        return;
      }
      logsBox(false, null);
    };
    function logsBox(hasQr, msg) {
      const box = document.getElementById('qrBox');
      if (!box) return;
      box.innerHTML = `
      <div style="font-size:2rem">⏳</div>
      <h3 style="margin:10px 0 6px">No QR yet</h3>
      <p class="muted">${esc(msg || 'Waiting for the bot to start and print a QR code. This usually takes 5–30 seconds after deploy. The QR refreshes every ~40s.')}</p>
      <div class="console mt-1" style="text-align:left;max-width:640px;margin:16px auto 0">
        <div class="console-body" id="qrConsole" style="height:200px"></div>
      </div>`;
      api('/services/' + id + '/logs').then(r => {
        const c = document.getElementById('qrConsole');
        if (!c) return;
        c.innerHTML = r.logs.slice(-12).map(l => `<div class="log-line"><span class="log-ts">${l.timestamp ? esc(new Date(l.timestamp).toLocaleTimeString()) : ''}</span><span class="log-msg">${esc(l.message)}</span></div>`).join('');
        c.scrollTop = c.scrollHeight;
      }).catch(() => {});
    }

    refresh();
    const timer = setInterval(refresh, 4000);
    onPageCleanup(() => clearInterval(timer));
  }

  // ─── tab: deploys ───
  function tabDeploys() {
    const body = document.getElementById('tabBody');
    body.innerHTML = '<div class="spin-lg"></div>';
    api('/services/' + id + '/deploys').then(r => {
      const rows = r.deploys || [];
      if (!rows.length) {
        body.innerHTML = `<div class="empty-state"><div class="big">📦</div><h3>No deploy history</h3><p>Deploys appear here once the service is created on Render.</p></div>`;
        return;
      }
      body.innerHTML = `
      <div class="card panel" style="padding:0;overflow:hidden">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Status</th><th>Trigger</th><th>Started</th><th>Finished</th></tr></thead>
          <tbody>
          ${rows.map(d => {
            const st = String(d.status || '').toLowerCase();
            const badge = st === 'live' || st === 'deployed' ? 'badge-green' : st === 'building' || st === 'build_in_progress' || st === 'created' ? 'badge-orange' : st === 'deactivated' ? 'badge-gray' : 'badge-gray';
            return `<tr>
              <td class="mono small">${esc(String(d.id || '').slice(0, 14))}</td>
              <td><span class="badge ${badge}">${esc(d.status || '—')}</span></td>
              <td>${esc(d.trigger || '—')}</td>
              <td class="small">${fmtDate(d.createdAt)}</td>
              <td class="small">${fmtDate(d.finishedAt)}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>`;
    }).catch(e => {
      body.innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    });
  }

  function renderTab() {
    if (activeTab === 'overview') tabOverview();
    else if (activeTab === 'env') tabEnv();
    else if (activeTab === 'logs') tabLogs();
    else if (activeTab === 'qr') tabQr();
    else if (activeTab === 'deploys') tabDeploys();
  }

  await r();
});

// (session-card styling lives in styles.css)
