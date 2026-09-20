/* ══════════════════════════════════════════════════════════════════════
   BotForge — settings: Render account connection + workspace
   ══════════════════════════════════════════════════════════════════════ */

'use strict';

route('/settings', async (app) => {
  app.innerHTML = '<div class="spin-lg"></div>';
  const me = await api('/me');
  const hasKey = me.hasRenderKey;
  let workspaces = [];

  async function r() {
    const me = await api('/me');
    app.innerHTML = `
    <div class="container dash-wrap">
      <div class="dash-head">
        <div class="dashboard-title" style="display:none"></div>
        <div class="dash-title">
          <h1>Settings ⚙️</h1>
          <p>Connect your Render account, pick where new bots are created.</p>
        </div>
        <a href="/dashboard" class="btn btn-ghost" data-link>← Dashboard</a>
      </div>

      <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Render connection card -->
        <div class="card panel" style="padding:26px;grid-column:1/-1">
          <div class="flex" style="justify-content:space-between;align-items:flex-start">
            <div>
              <h3 style="margin-bottom:4px">🔗 Render account</h3>
              <p class="muted small">${hasKey ? 'Connected — API key stored encrypted (AES-256-GCM).' : 'Not connected. The platform runs in <b>demo mode</b>: deploys, logs and QR pairing are fully simulated on this server.'}</p>
            </div>
            ${me.mode === 'demo' ? '<span class="badge badge-purple">🧪 demo mode</span>' : '<span class="badge badge-green">● live mode</span>'}
          </div>
          <div class="divider"></div>

          ${hasKey ? `
          <div class="kv-grid" style="margin-bottom:0">
            <div class="kv"><div class="k">API key</div><div class="v">${esc(me.renderKeyMasked || 'rnd_••••••')}</div></div>
            <div class="kv"><div class="k">Mode</div><div class="v">${me.mode === 'demo' ? '🧪 demo (simulated)' : '● live (real Render deploys)'}</div></div>
          </div>
          <div class="flex gap-2 mt-1" style="margin-top:18px">
            <button class="btn btn-danger" id="disconnect"><span class="btn-label">Disconnect key</span></button>
          </div>` : `
          <label><b>Render API key</b></label>
          <p class="muted small" style="margin-top:4px">From <a href="https://dashboard.render.com/settings" target="_blank" rel="noopener">dashboard.render.com → Account Settings → API Keys</a>. Create one with a name like "botforge".</p>
          <div class="input-group mt-1" style="margin-top:10px">
            <input class="input mono" id="apiKey" placeholder="rnd_XXXXXXXXXXXXXXXXXXXX" type="password" autocomplete="off">
            <button class="toggle-vis" id="toggleKey">show</button>
          </div>
          <div class="alert alert-err hidden" id="keyErr" style="margin-top:12px"></div>
          <button class="btn btn-primary mt-1" id="connectBtn" style="margin-top:14px"><span class="btn-label">🔌 Connect Render account</span></button>
          <div class="alert alert-info mt-1" style="margin-top:14px">🧪 <b>Tip:</b> leave this empty and just deploy — demo mode simulates everything, no Render account needed to explore the platform.</div>`}
        </div>
      </div>

      <!-- workspace card -->
      ${hasKey ? `
      <div class="card panel mt-1" style="padding:26px;margin-top:20px" id="wsCard">
        <h3 style="margin-bottom:4px">🏢 Render workspace</h3>
        <p class="muted small">New bot services will be created in this workspace (owner).</p>
        <div class="divider"></div>
        <div id="wsList"><div class="spin-lg"></div></div>
      </div>` : ''}
    </div>`;

    // wire
    const dc = document.getElementById('disconnect');
    if (dc) dc.onclick = async () => {
      const ok = await confirmModal('Disconnect Render?', 'BotForge forgets your API key. Existing services stay on Render but can no longer be managed from here.', 'Disconnect');
      if (!ok) return;
      setLoading(dc, true, '…');
      try {
        await api('/render/disconnect', { method: 'POST' });
        toast('Render disconnected — demo mode active', 'ok');
        await refreshMe();
        navigate('/settings', { replace: true });
      } catch (e) { toast(e.message, 'err'); setLoading(dc, false, 'Disconnect key'); }
    };

    const cb = document.getElementById('connectBtn');
    if (cb) cb.onclick = async () => {
      const key = document.getElementById('apiKey').value.trim();
      const errBox = document.getElementById('keyErr');
      errBox.classList.add('hidden');
      if (!key) { errBox.textContent = 'Paste your rnd_… API key first.'; errBox.classList.remove('hidden'); return; }
      setLoading(cb, true, 'Validating & connecting…');
      try {
        const res = await api('/render/connect', { method: 'POST', body: { apiKey: key } });
        toast(`Connected! ${res.workspaces.length} workspace${res.workspaces.length === 1 ? '' : 's'} found`, 'ok', 5000);
        await refreshMe();
        navigate('/settings', { replace: true });
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        setLoading(cb, false, '🔌 Connect Render account');
      }
    };

    const tv = document.getElementById('toggleKey');
    if (tv) tv.onclick = () => {
      const input = document.getElementById('apiKey');
      input.type = input.type === 'password' ? 'text' : 'password';
      tv.textContent = input.type === 'password' ? 'show' : 'hide';
    };

    if (hasKey) loadWorkspaces();
  }

  async function loadWorkspaces() {
    const box = document.getElementById('wsList');
    if (!box) return;
    try {
      const r = await api('/render/workspaces');
      workspaces = r.workspaces || [];
      const cur = (state.user && state.user.ownerId) || '';
      let meFresh;
      try { meFresh = await api('/me'); } catch { meFresh = me; }
      const current = (meFresh && meFresh.user && meFresh.user.ownerId) || cur;
      box.innerHTML = workspaces.length ? `
      <div class="admin-table-wrap">
        ${workspaces.map(w => `
        <div class="flex" style="justify-content:space-between;align-items:center;padding:13px 16px;border-bottom:1px solid var(--border-soft)">
          <div class="flex" style="gap:12px;align-items:center">
            <span style="font-size:1.2rem">🏢</span>
    <div>
              <div><b>${esc(w.name || 'workspace')}</b> ${current === w.id ? '<span class="badge badge-green">active</span>' : ''}</div>
              <div class="muted small mono">${esc(w.id)}</div>
            </div>
          </div>
          ${current === w.id ? '<span class="muted small">selected ✓</span>' : `<button class="btn btn-primary btn-sm" data-ws="${esc(w.id)}">Select</button>`}
        </div>`).join('')}
      </div>` : '<p class="muted">No workspaces found for this key.</p>';
      box.querySelectorAll('[data-ws]').forEach(btn => {
        btn.onclick = async () => {
          setLoading(btn, true, '…');
          try {
            await api('/render/owner', { method: 'POST', body: { ownerId: btn.dataset.ws } });
            toast('Workspace selected', 'ok');
            await refreshMe();
            navigate('/settings', { replace: true });
          } catch (e) { toast(e.message, 'err'); setLoading(btn, false, 'Select'); }
        };
      });
    } catch (e) {
      box.innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    }
  }

  await r();
});
