/* ══════════════════════════════════════════════════════════════════════
   BotForge — deploy wizard
   ══════════════════════════════════════════════════════════════════════ */

'use strict';

route('/deploy', async (app) => {
  app.innerHTML = '<div class="spin-lg"></div>';
  const templates = await loadTemplates();
  const params = new URLSearchParams(location.search);
  const presetId = params.get('t') || '';
  const preset = templates.find(t => t.id === presetId) || null;

  // wizard state
  const wiz = {
    step: preset ? 2 : 1,
    template: preset,          // null = custom repo
    name: preset ? preset.id.replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100) : '',
    repo: preset ? preset.repo : '',
    branch: preset ? preset.branch : 'main',
    region: 'oregon',
    plan: 'free',
    runtime: preset ? preset.runtime : 'node',
    target: 'local',
    startCommand: preset ? preset.startCommand : 'node index.js',
    buildCommand: preset ? preset.buildCommand : 'npm install',
    keepAlive: preset ? preset.keepAlive !== false : true,
    envRows: preset ? (preset.env || []).map(e => ({ key: e.key, value: '', spec: e })) : [{ key: '', value: '', spec: null }]
  };

  function stepsHTML() {
    const s = (n, label) => `
      <div class="wstep ${wiz.step === n ? 'active' : ''} ${wiz.step > n ? 'done' : ''}" data-step="${n}">
        <span class="n">${wiz.step > n ? '' : n}</span>${label}
      </div>`;
    return `<div class="wizard-steps">${s(1, 'Choose bot')}${s(2, 'Configure')}${s(3, 'Deploy')}</div>`;
  }

  function render() {
    app.innerHTML = `
    <div class="container dash-wrap">
      <div class="dash-head">
        <div class="dash-title">
          <h1>Deploy a bot 🚀</h1>
          <p>${wiz.template ? `Deploying <b>${esc(wiz.template.name)}</b> from a verified template.` : 'Pick a template or bring your own GitHub repo.'}</p>
        </div>
        ${wiz.step === 2 && !wiz.template ? '<a href="/deploy" class="btn btn-ghost" data-link>← Templates</a>' : ''}
      </div>
      ${stepsHTML()}
      <div id="wizBody"></div>
    </div>`;
    const body = document.getElementById('wizBody');
    if (wiz.step === 1) renderPick(body);
    if (wiz.step === 2) renderConfig(body);
    if (wiz.step === 3) renderDeploying(body);
  }

  // ─── STEP 1: template picker ───
  function renderPick(body) {
    body.innerHTML = `
    <div class="templates-grid">
      ${templates.map(t => `
      <div class="tcard ${t.featured ? 'featured' : ''} card-hover" data-pick="${t.id}">
        ${t.featured ? '<div class="featured-ribbon">Featured</div>' : ''}
        <div class="tcard-head">
          <div class="tcard-icon">${t.icon}</div>
          <div>
            <div class="tcard-title">${esc(t.name)}</div>
            <div class="tcard-badges">${platformBadge(t.platform)}<span class="badge badge-gray">${esc(t.runtime)}</span>${t.plan === 'free' ? '<span class="badge badge-green">free tier</span>' : ''}</div>
          </div>
        </div>
        <div class="tcard-desc">${esc(t.description)}</div>
        <div class="tcard-foot">
          <span class="muted small mono">${esc(t.repo.replace('https://github.com/', ''))}</span>
          <span class="btn btn-primary btn-sm">Select →</span>
        </div>
      </div>`).join('')}
    </div>
    <div class="card mt-1 panel" style="padding:26px" id="customCard">
      <div class="flex" style="justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
        <div>
          <h3 style="margin-bottom:6px">📦 Bring your own repo</h3>
          <p class="muted" style="max-width:560px">Any public GitHub repo with a Node.js or Python bot. You'll set build/start commands and env vars yourself.</p>
        </div>
        <button class="btn btn-ghost" id="customBtn">Use custom repo →</button>
      </div>
    </div>`;

    body.querySelectorAll('[data-pick]').forEach(el => {
      el.onclick = () => {
        const t = templates.find(x => x.id === el.dataset.pick);
        wiz.template = t;
        wiz.name = t.id.replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100);
        wiz.repo = t.repo; wiz.branch = t.branch;
        wiz.runtime = t.runtime; wiz.plan = t.plan || 'free';
        wiz.startCommand = t.startCommand; wiz.buildCommand = t.buildCommand;
        wiz.keepAlive = t.keepAlive !== false;
        wiz.envRows = (t.env || []).map(e => ({ key: e.key, value: '', spec: e }));
        if (!wiz.envRows.length) wiz.envRows = [{ key: '', value: '', spec: null }];
        wiz.step = 2;
        history.replaceState({}, '', '/deploy?t=' + t.id);
        render();
      };
    });
    document.getElementById('customBtn').onclick = () => {
      wiz.template = null;
      wiz.name = ''; wiz.repo = '';
      wiz.envRows = [{ key: '', value: '', spec: null }];
      wiz.step = 2;
      history.replaceState({}, '', '/deploy?custom=1');
      render();
    };
  }

  // ─── STEP 2: configuration ───
  function renderConfig(body) {
    const t = wiz.template;
    body.innerHTML = `
    <div class="card panel" style="padding:26px">

      ${t ? `
      <div class="flex" style="gap:14px;align-items:flex-start;margin-bottom:20px">
        <div class="tcard-icon" style="font-size:1.8rem">${t.icon}</div>
        <div style="flex:1">
          <h3 style="margin-bottom:4px">${esc(t.name)}</h3>
          <p class="muted small">${esc(t.description)}</p>
          ${t.notes ? `<div class="alert alert-info mt-1" style="margin-top:12px">💡 ${esc(t.notes)}</div>` : ''}
        </div>
      </div>` : ''}

      <div class="field"><label>Where should this bot run?</label>
        <div class="target-grid" id="targetGrid">
          <label class="target-opt ${wiz.target === 'local' ? 'selected' : ''}" data-target="local">
            <input type="radio" name="target" value="local" ${wiz.target === 'local' ? 'checked' : ''} style="display:none">
            <div class="to-icon">🖥️</div>
            <div class="to-body">
              <div class="to-title">Run on our site <span class="badge badge-green">recommended</span></div>
              <div class="to-desc">The bot runs <b>on the BotForge server itself</b> — real process, real QR pairing, live logs, ${esc(location.origin)}/svc/&lt;name&gt; URL. No Render account needed.</div>
            </div>
          </label>
          <label class="target-opt ${wiz.target === 'render' ? 'selected' : ''}" data-target="render">
            <input type="radio" name="target" value="render" ${wiz.target === 'render' ? 'checked' : ''} style="display:none">
            <div class="to-icon">☁️</div>
            <div class="to-body">
              <div class="to-title">Deploy to Render</div>
              <div class="to-desc">Provisioned on your Render account. Great for scaling beyond this server — needs a Render API key in Settings.</div>
            </div>
          </label>
        </div>
      </div>

      <div class="field"><label>Service name <span class="badge badge-gray">lowercase, dashes</span></label>
        <div class="repo-pick">
          <input class="input" id="fName" value="${esc(wiz.name)}" placeholder="my-knightbot">
          <span class="muted small mono" style="align-self:center;white-space:nowrap" id="urlPreviewWrap">
            <span id="urlPrefix">→&nbsp;/svc/</span><b id="namePreview">${esc(wiz.name || 'name')}</b><span id="urlSuffix"></span></span>
        </div>
      </div>

      <div class="field"><label>GitHub repo</label>
        <input class="input mono" id="fRepo" value="${esc(wiz.repo)}" placeholder="https://github.com/owner/repo" ${t ? 'readonly style="opacity:.75"' : ''}>
        ${!t ? '<p class="muted small mt-1" style="margin-top:6px">Must be a public GitHub repository.</p>' : ''}
      </div>

      <div class="field"><label>Branch</label>
        <input class="input mono" id="fBranch" value="${esc(wiz.branch)}" placeholder="main">
      </div>

      <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px" id="regionPlanGrid">
        <div class="field" id="regionField"><label>Region <span class="badge badge-gray">Render only</span></label>
          <select class="input select" id="fRegion">
            ${['oregon', 'frankfurt', 'ohio', 'singapore', 'virginia'].map(r => `<option value="${r}" ${wiz.region === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="field" id="planField"><label>Instance plan <span class="badge badge-gray">Render only</span></label>
          <select class="input select" id="fPlan">
            <option value="free" ${wiz.plan === 'free' ? 'selected' : ''}>Free — 512MB, sleeps after idle</option>
            <option value="starter" ${wiz.plan === 'starter' ? 'selected' : ''}>Starter — $7/mo, always on</option>
          </select>
        </div>
      </div>

      ${!t ? `
      <div class="field"><label>Runtime</label>
        <select class="input select" id="fRuntime">
          <option value="node" ${wiz.runtime === 'node' ? 'selected' : ''}>Node.js</option>
          <option value="python" ${wiz.runtime === 'python' ? 'selected' : ''}>Python</option>
        </select>
      </div>` : ''}

      <div class="field"><label>Build command</label>
        <input class="input mono" id="fBuild" value="${esc(wiz.buildCommand)}" placeholder="npm install">
      </div>
      <div class="field"><label>Start command</label>
        <input class="input mono" id="fStart" value="${esc(wiz.startCommand)}" placeholder="node index.js">
      </div>

      <div class="flex" id="kaRow" style="justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:8px 0 18px">
        <div>
          <b>💓 Keep-alive pinger</b>
          <p class="muted small" style="margin-top:3px">Free Render services sleep after 15 min idle. BotForge pings them so they stay online 24/7. Not needed for locally-run services (they never sleep).</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="fKeepAlive" ${wiz.keepAlive ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <label><b>🔐 Environment variables</b></label>
      <p class="muted small" style="margin-top:4px">Values are encrypted at rest and synced to Render on deploy.</p>
      <div id="envRows" style="margin-top:12px"></div>
      <button class="btn btn-ghost btn-sm" id="addEnv">+ Add variable</button>

      <div class="divider"></div>
      <div class="flex" style="justify-content:space-between">
        <a href="/deploy" class="btn btn-ghost" data-link>← Start over</a>
        <button class="btn btn-primary btn-lg" id="doDeploy"><span class="btn-label">🚀 Deploy to Render</span></button>
      </div>
    </div>`;

    const drawRows = () => {
      const box = document.getElementById('envRows');
      box.innerHTML = wiz.envRows.map((row, i) => `
      <div class="env-row">
        <div>
          <input class="input" placeholder="KEY" value="${esc(row.key)}" data-ek="${i}" ${row.spec ? 'readonly' : ''}>
          ${row.spec ? `<p class="muted small" style="margin-top:5px">${row.spec.required ? '<span class="badge badge-red">required</span> ' : ''}${esc(row.spec.description || row.spec.label || '')}</p>` : ''}
        </div>
        <div class="input-group">
          <input class="input" placeholder="${esc((row.spec && row.spec.placeholder) || 'value')}" value="${esc(row.value)}" data-ev="${i}" ${row.spec && row.spec.secret !== false ? 'type="password" autocomplete="off"' : 'type="text"'}>
          ${(row.spec && row.spec.secret) ? '<button class="toggle-vis" data-tv="' + i + '">show</button>' : ''}
        </div>
        <button class="btn btn-danger env-del" data-ed="${i}" ${row.spec && row.spec.required ? 'disabled title="Required"' : ''}>✕</button>
      </div>`).join('');
      box.querySelectorAll('[data-ek]').forEach(el => el.oninput = e => { wiz.envRows[+e.target.dataset.ek].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'); });
      box.querySelectorAll('[data-ev]').forEach(el => el.oninput = e => { wiz.envRows[+e.target.dataset.ev].value = e.target.value; });
      box.querySelectorAll('[data-tv]').forEach(el => el.onclick = () => {
        const input = box.querySelector(`[data-ev="${el.dataset.tv}"]`);
        if (input) { input.type = input.type === 'password' ? 'text' : 'password'; el.textContent = input.type === 'password' ? 'show' : 'hide'; }
      });
      box.querySelectorAll('[data-ed]').forEach(el => el.onclick = () => {
        wiz.envRows.splice(+el.dataset.ed, 1);
        if (!wiz.envRows.length) wiz.envRows = [{ key: '', value: '', spec: null }];
        drawRows();
      });
    };
    drawRows();
    document.getElementById('addEnv').onclick = () => { wiz.envRows.push({ key: '', value: '', spec: null }); drawRows(); };

    // name → preview
    const nameEl = document.getElementById('fName');
    function updateUrlPreview() {
      const prefix = document.getElementById('urlPrefix');
      const suffix = document.getElementById('urlSuffix');
      if (!prefix) return;
      if (wiz.target === 'local') { prefix.textContent = '→ /svc/'; suffix.textContent = ' (this site)'; }
      else { prefix.textContent = '→ https://'; suffix.textContent = '.onrender.com'; }
    }
    nameEl.oninput = () => {
      wiz.name = nameEl.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      document.getElementById('namePreview').textContent = wiz.name || 'name';
    };
    // runtime target picker
    const tgrid = document.getElementById('targetGrid');
    if (tgrid) {
      tgrid.querySelectorAll('.target-opt').forEach(el => {
        el.onclick = (ev) => {
          ev.preventDefault();
          wiz.target = el.dataset.target;
          tgrid.querySelectorAll('.target-opt').forEach(x => x.classList.toggle('selected', x === el));
          updateUrlPreview();
          if (typeof updateDeployLabel === 'function') updateDeployLabel();
          const planField = document.getElementById('planField');
          const regionField = document.getElementById('regionField');
          const kaRow = document.getElementById('kaRow');
          if (planField) planField.style.display = wiz.target === 'local' ? 'none' : '';
          if (regionField) regionField.style.display = wiz.target === 'local' ? 'none' : '';
          if (kaRow) kaRow.style.display = wiz.target === 'local' ? 'none' : '';
        };
      });
    }
    document.getElementById('fRepo').oninput = e => wiz.repo = e.target.value.trim();
    document.getElementById('fBranch').oninput = e => wiz.branch = e.target.value.trim() || 'main';
    document.getElementById('fRegion').onchange = e => wiz.region = e.target.value;
    document.getElementById('fPlan').onchange = e => wiz.plan = e.target.value;
    const rt = document.getElementById('fRuntime'); if (rt) rt.onchange = e => wiz.runtime = e.target.value;
    document.getElementById('fBuild').oninput = e => wiz.buildCommand = e.target.value.trim();
    document.getElementById('fStart').oninput = e => wiz.startCommand = e.target.value.trim();
    document.getElementById('fKeepAlive').onchange = e => wiz.keepAlive = e.target.checked;

    // deploy target toggle updates the button label too
    function updateDeployLabel() {
      const lbl = document.querySelector('#doDeploy .btn-label');
      if (lbl) lbl.textContent = wiz.target === 'local' ? '🖥️ Deploy on our site' : '🚀 Deploy to Render';
    }

    document.getElementById('doDeploy').onclick = async (e) => {
      const btn = e.currentTarget;
      // validation
      if (!wiz.name) return toast('Service name is required', 'err');
      if (!/^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/.test(wiz.repo)) return toast('Enter a valid GitHub repo URL', 'err');
      if (wiz.target === 'render' && !state.hasRenderKey && state.mode !== 'demo') return toast('Connect a Render API key in Settings first, or choose "Run on our site".', 'err', 6000);
      const env = wiz.envRows.filter(r => r.key && r.value).map(r => ({ key: r.key, value: r.value }));
      for (const r of wiz.envRows) {
        if (r.spec && r.spec.required && !r.value) return toast(`${r.key} is required`, 'err');
      }
      setLoading(btn, true, 'Deploying…');
      try {
        const res = await api('/services', {
          method: 'POST',
          body: {
            templateId: wiz.template ? wiz.template.id : null,
            name: wiz.name, repo: wiz.repo, branch: wiz.branch,
            target: wiz.target,
            region: wiz.region, plan: wiz.plan, runtime: wiz.runtime,
            buildCommand: wiz.buildCommand, startCommand: wiz.startCommand,
            keepAlive: wiz.keepAlive, env
          }
        });
        toast(res.note || 'Deploy started!', 'ok', 5000);
        wiz.deployedId = res.service.id;
        wiz.step = 3;
        render();
      } catch (err) {
        toast(err.message, 'err', 6000);
        setLoading(btn, false, wiz.target === 'local' ? '🖥️ Deploy on our site' : '🚀 Deploy to Render');
      }
    };
    updateUrlPreview();
    updateDeployLabel();
    // initial visibility for default target
    (function initTargetUI() {
      const planField = document.getElementById('planField');
      const regionField = document.getElementById('regionField');
      const kaRow = document.getElementById('kaRow');
      if (wiz.target === 'local') {
        if (planField) planField.style.display = 'none';
        if (regionField) regionField.style.display = 'none';
        if (kaRow) kaRow.style.display = 'none';
      }
    })();
  }

  // ─── STEP 3: deploying ───
  function renderDeploying(body) {
    const id = wiz.deployedId;
    if (!id) { wiz.step = 1; render(); return; }
    body.innerHTML = `
    <div class="card panel" style="padding:40px;text-align:center">
      <div style="font-size:3rem">${wiz.target === 'local' ? '🖥️' : '🚀'}</div>
      <h2 style="margin:12px 0 8px">Deploy started</h2>
      <p class="muted">${wiz.target === 'local' ? 'Building <b>on our own server</b> — cloning the repo and installing dependencies now.' : state.mode === 'demo' ? 'Your service is being built (demo mode — simulated build).' : 'Your service is being built on Render. First builds usually take 3–8 minutes.'}</p>
      <div class="console mt-1" style="margin:20px auto;max-width:560px;text-align:left">
        <div class="console-body" id="deployConsole" style="height:220px"></div>
      </div>
      <div class="flex gap-2" style="justify-content:center">
        <a href="/services/${esc(id)}" class="btn btn-primary" data-link>Open service manager →</a>
        <a href="/dashboard" class="btn btn-ghost" data-link>Dashboard</a>
      </div>
    </div>`;
    // poll status → live console lines (streams local build logs too)
    let n = 0;
    let lastLogTs = 0;
    const con = document.getElementById('deployConsole');
    const timer = setInterval(async () => {
      n++;
      try {
        const [svc, logRes] = await Promise.all([
          api('/services/' + id),
          api('/services/' + id + '/logs').catch(() => null)
        ]);
        // stream new log lines for local builds
        if (wiz.target === 'local' && logRes && Array.isArray(logRes.logs)) {
          for (const l of logRes.logs) {
            const ts = new Date(l.timestamp).getTime() || 0;
            if (ts > lastLogTs) {
              lastLogTs = ts;
              const line = document.createElement('div');
              line.className = 'log-line';
              line.innerHTML = `<span class="log-ts">${new Date(l.timestamp).toLocaleTimeString()}</span><span class="log-msg">${esc(l.message).slice(0, 200)}</span>`;
              con.appendChild(line);
            }
          }
          con.scrollTop = con.scrollHeight;
        }
        if (!logRes || wiz.target !== 'local') {
          const line = document.createElement('div');
          line.className = 'log-line';
          line.innerHTML = `<span class="log-ts">${new Date().toLocaleTimeString()}</span><span class="log-msg">${esc(svc.service.status === 'live' ? '✓ service is live at ' + (svc.service.url || svc.service.localUrl || '') : '… status: ' + svc.service.status)}</span>`;
          con.appendChild(line);
          con.scrollTop = con.scrollHeight;
        }
        if (svc.service.status === 'live' || svc.service.status === 'failed' || n > 40) {
          clearInterval(timer);
          const ok = document.createElement('div');
          ok.className = 'log-line qr';
          ok.innerHTML = `<span class="log-ts">${new Date().toLocaleTimeString()}</span><span class="log-msg">${svc.service.status === 'live' ? (wiz.target === 'local' ? '🎉 Running on our server! Open the service to pair WhatsApp via QR.' : '🎉 Deployment complete!') : '✗ Build failed — open the service page for the error.'}</span>`;
          con.appendChild(ok);
          con.scrollTop = con.scrollHeight;
        }
      } catch { clearInterval(timer); }
    }, 2500);
    onPageCleanup(() => clearInterval(timer));
  }

  render();
});
