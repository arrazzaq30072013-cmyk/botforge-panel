/* ════════════════════════════════════════════════════════════════
   BotForge — dashboard
   ════════════════════════════════════════════════════════════════ */

'use strict';

route('/dashboard', async (app) => {
  app.innerHTML = '<div class="spin-lg"></div>';
  const [services, uptime] = await Promise.all([
    api('/services'),
    api('/uptime').catch(() => null)
  ]);

  const running = services.filter(s => s.status === 'live').length;
  const whatsapp = services.filter(s => s.platform === 'whatsapp').length;
  const suspended = services.filter(s => s.status === 'suspended').length;

  app.innerHTML = `
  <div class="container dash-wrap">
    <div class="dash-head">
      <div class="dash-title">
        <h1>Hey, ${esc(state.user.name)} 👋</h1>
        <p>${services.length === 0 ? 'Deploy your first bot to get started.' : `You have ${services.length} service${services.length > 1 ? 's' : ''} under management.`}</p>
      </div>
      <div class="flex gap-2">
        <a href="/deploy" class="btn btn-primary" data-link>+ Deploy new bot</a>
        <a href="/settings" class="btn btn-ghost" data-link>⚙️ Settings</a>
      </div>
    </div>

    ${!state.hasRenderKey ? `
    <div class="notice-strip">
      <span>🖥️</span>
      <span><b>Run bots right here.</b> Deploys with "Run on our site" execute on the BotForge server itself — real processes, real WhatsApp QR pairing, live logs. No Render account needed. <a href="/settings" data-link><b>Settings</b></a> holds a Render API key only if you also want cloud deploys.</span>
    </div>` : ''}

    <div class="stat-grid">
      <div class="card stat-card"><div class="sicon">🤖</div><div class="sval">${services.length}</div><div class="slbl">Total bots</div></div>
      <div class="card stat-card"><div class="sicon">🟢</div><div class="sval" style="color:var(--green)">${running}</div><div class="slbl">Running</div></div>
      <div class="card stat-card"><div class="sicon">📱</div><div class="sval" style="color:var(--green)">${whatsapp}</div><div class="slbl">WhatsApp bots</div></div>
      <div class="card stat-card"><div class="sicon">⏸️</div><div class="sval" style="color:var(--yellow)">${suspended}</div><div class="slbl">Suspended</div></div>
      ${uptime && uptime.pinger ? `<div class="card stat-card"><div class="sicon">💓</div><div class="sval">${uptime.pinger.stats.totalPings}</div><div class="slbl">Keep-alive pings</div></div>` : ''}
    </div>

    ${services.length === 0 ? `
    <div class="empty-state">
      <div class="big">🛡️</div>
      <h3>No bots yet</h3>
      <p>Deploy KnightBot Mini (WhatsApp) in one click, or bring your own repo.</p>
      <a href="/deploy?t=knightbot-mini" class="btn btn-primary" data-link>Deploy KnightBot Mini</a>
      <a href="/deploy" class="btn btn-ghost" data-link style="margin-left:10px" data-link>Choose another template</a>
    </div>` : `
    <div class="svc-grid" id="svcGrid">
      ${services.map(s => svcCardHTML(s)).join('')}
    </div>`}
  </div>`;

  window.svcCardHTML = svcCardHTML;
});

function svcCardHTML(s) {
  return `
  <div class="card card-hover svc-card" onclick="navigate('/services/${s.id}')">
    <div class="svc-top">
      <div>
        <div class="svc-name">${s.template ? s.template.icon + ' ' : '📦 '}${esc(s.name)}</div>
        <div class="svc-meta">
          ${platformBadge(s.platform)}
          ${statusBadge(s.status)}
          <span class="badge badge-gray">${s.plan || 'free'}</span>
        </div>
      </div>
      ${s.keepAlive ? '<span class="badge badge-green" title="Keep-alive enabled">💓 24/7</span>' : ''}
    </div>
    ${s.url || s.target === 'local' ? `<div class="svc-url">${s.target === 'local' ? esc(location.origin + '/svc/' + s.name) : esc(s.url)}</div>` : ''}
    <div class="svc-foot">
      <span class="muted small">created ${timeAgo(s.createdAt)}</span>
      <span class="muted small">${s.target === 'local' ? '<span class="badge badge-runtime-local" style="font-size:.68rem">our site</span> ' : ''}${s.envKeys.length} env var${s.envKeys.length === 1 ? '' : 's'}</span>
    </div>
  </div>`;
}
