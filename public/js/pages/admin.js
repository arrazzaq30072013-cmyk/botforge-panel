/* ══════════════════════════════════════════════════════════════════════
   BotForge — admin panel
   ══════════════════════════════════════════════════════════════════════ */

'use strict';

route('/admin', async (app) => {
  if (!state.user || state.user.role !== 'admin') {
    app.innerHTML = `<div class="container center" style="padding:80px 20px">
      <div style="font-size:3rem">🚫</div>
      <h2>Admin only</h2>
      <p class="muted">You need an admin account to open this page.</p>
      <a href="/dashboard" class="btn btn-ghost mt-1" data-link>← Dashboard</a>
    </div>`;
    return;
  }

  app.innerHTML = '<div class="spin-lg"></div>';
  const stats = await api('/admin/stats');
  const users = stats.users || [];
  const system = await api('/system').catch(() => null);

  const render_ = () => {
    const admins = users.filter(u => u.role === 'admin').length;
    app.innerHTML = `
    <div class="container dash-wrap">
      <div class="dash-head">
        <div class="dash-title">
          <h1>Admin panel 🛡️</h1>
          <p>Platform overview across ${users.length} user${users.length === 1 ? '' : 's'} and ${stats.services} service${stats.services === 1 ? '' : 's'}.</p>
        </div>
        <a href="/dashboard" class="btn btn-ghost" data-link>← Dashboard</a>
      </div>

      <div class="stat-grid">
        <div class="card stat-card"><div class="sicon">👥</div><div class="sval">${users.length}</div><div class="slbl">Users</div></div>
        <div class="card stat-card"><div class="sicon">🤖</div><div class="sval">${stats.services}</div><div class="slbl">Total bots</div></div>
        <div class="card stat-card"><div class="sicon">🟢</div><div class="sval" style="color:var(--green)">${stats.running}</div><div class="slbl">Running</div></div>
        <div class="card stat-card"><div class="sicon">⏸️</div><div class="sval" style="color:var(--yellow)">${stats.suspended}</div><div class="slbl">Suspended</div></div>
        ${stats.byPlatform && stats.byPlatform.whatsapp ? `<div class="card stat-card"><div class="sicon">📱</div><div class="sval" style="color:var(--green)">${stats.byPlatform.whatsapp}</div><div class="slbl">WhatsApp bots</div></div>` : ''}
        <div class="card stat-card"><div class="sicon">🛡️</div><div class="sval">${admins}</div><div class="slbl">Admins</div></div>
      </div>

      <div class="card panel mt-1" style="padding:26px;margin-top:20px">
        <h3 style="margin-bottom:14px">👥 Users</h3>
        <div style="overflow-x:auto">
        <table class="admin-table">
          <thead><tr><th>User</th><th>Role</th><th>Render</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
          ${users.map(u => `<tr>
            <td>
              <div class="flex" style="gap:10px;align-items:center">
                <span class="nav-avatar">${esc((u.name || '?')[0].toUpperCase())}</span>
                <div>
                  <div><b>${esc(u.name || '—')}</b></div>
                  <div class="muted small mono">${esc(u.email)}</div>
                </div>
              </div>
            </td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-purple' : 'badge-gray'}">${esc(u.role)}</span></td>
            <td>${u.hasRenderKey ? '<span class="badge badge-green">connected</span>' : '<span class="badge badge-gray">demo</span>'}</td>
          <td class="small">${fmtDate(u.createdAt)}</td>
            <td>
              <button class="btn btn-ghost btn-sm" data-role="${esc(u.id)}" data-next="${u.role === 'admin' ? 'user' : 'admin'}">
                ${u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
              </button>
            </td>
          </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>

      <div class="card panel mt-1" style="padding:26px;margin-top:20px">
        <h3 style="margin-bottom:6px">🖥 System</h3>
        ${system ? `
        <div class="kv-grid">
          <div class="kv"><div class="k">Version</div><div class="v">${esc(system.brand && system.brand.version || '—')}</div></div>
          <div class="kv"><div class="k">Node</div><div class="v">${esc(system.node)}</div></div>
          <div class="kv"><div class="k">Pinger</div><div class="v">${system.pinger.enabled ? `on · every ${system.pinger.interval}s` : 'off'}</div></div>
          <div class="kv"><div class="k">Server uptime</div><div class="v">${Math.floor(system.uptime / 3600)}h ${Math.floor((system.uptime % 3600) / 60)}m</div></div>
          <div class="kv"><div class="k">Memory</div><div class="v">${esc(system.memory.free)} / ${esc(system.memory.total)} MB free</div></div>
          <div class="kv"><div class="k">Mode</div><div class="v">${system.demoMode ? 'demo forced' : 'auto (live keys win)'}</div></div>
        </div>` : '<p class="muted">System info unavailable.</p>'}
      </div>
    </div>`;

    app.querySelectorAll('[data-role]').forEach(btn => {
      btn.onclick = async () => {
        const ok = await confirmModal(
          'Change role?',
          `Set this user to ${btn.dataset.next}?`,
          btn.dataset.next === 'admin' ? 'Promote' : 'Demote'
        );
        if (!ok) return;
        setLoading(btn, true, '…');
        try {
          await api('/admin/users/' + btn.dataset.role + '/role', { method: 'POST', body: { role: btn.dataset.next } });
          toast('Role updated', 'ok');
          render_();
        } catch (e) { toast(e.message, 'err'); setLoading(btn, false); }
      };
    });
  };

  render_();
});
