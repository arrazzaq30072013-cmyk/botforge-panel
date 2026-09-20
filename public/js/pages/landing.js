/* ════════════════════════════════════════════════════════════════
   BotForge — landing page
   ════════════════════════════════════════════════════════════════ */

'use strict';

route('/', async (app) => {
  const templates = await loadTemplates();
  const stats = await api('/stats').catch(() => null);

  app.innerHTML = `
  <!-- ═══════════ HERO ═══════════ -->
  <section class="hero">
    <div class="hero-grid-bg"></div>
    <div class="container hero-inner">
      <div class="hero-pill"><span class="dot pulse" style="color:var(--accent)"></span> Self-hosted · Free forever · Runs bots on our site</div>
      <h1>Host your bots.<br><span class="grad">Forge in seconds.</span></h1>
      <p class="lead">BotForge is a self-hosted bot hosting panel — deploy WhatsApp, Discord &amp; Telegram bots from GitHub in one click and run them <b>right on the site</b> with the built-in runner, or push them to <b>Render</b>. Live logs, QR pairing, env vars and 24/7 keep-alive included.</p>
      <div class="hero-cta">
        <a href="/register" class="btn btn-primary btn-lg" data-link>⚒️ Start deploying free</a>
        <a href="/deploy" class="btn btn-ghost btn-lg" data-link>Deploy a bot →</a>
      </div>
      <div class="term">
        <div class="term-bar">
          <span class="term-dot" style="background:#ff5f57"></span>
          <span class="term-dot" style="background:#febc2e"></span>
          <span class="term-dot" style="background:#28c840"></span>
          <span class="term-title">botforge — deploy knightbot-mini</span>
        </div>
        <div class="term-body" id="heroTerm"></div>
      </div>
      <div class="hero-stats">
        <div class="hstat"><div class="val">${stats ? stats.services : '0'}</div><div class="lbl">Bots deployed</div></div>
        <div class="hstat"><div class="val">${templates.length}</div><div class="lbl">One-click templates</div></div>
        <div class="hstat"><div class="val">24/7</div><div class="lbl">Keep-alive uptime</div></div>
        <div class="hstat"><div class="val">$0</div><div class="lbl">Platform cost</div></div>
      </div>
    </div>
  </section>

  <!-- ═══════════ FEATURES ═══════════ -->
  <section class="section" id="features">
    <div class="container">
      <div class="section-head">
        <div class="section-kicker">Everything included</div>
        <h2 class="section-title">A real hosting panel, not a toy</h2>
        <p class="section-sub">Everything you need to run production bots on Render — accounts, deploys, logs, secrets, uptime.</p>
      </div>
      <div class="features-grid">
        <div class="card card-hover">
          <div class="feature-icon">🚀</div>
          <div class="feature-title">One-click deploys</div>
          <div class="feature-desc">Pick a template or paste any GitHub repo. BotForge calls the Render API to build and launch it — first deploy in ~3 minutes.</div>
        </div>
        <div class="card card-hover">
          <div class="feature-icon green">📱</div>
          <div class="feature-title">WhatsApp QR &amp; pairing</div>
          <div class="feature-desc">Deploy KnightBot or any Baileys bot, open Live Logs and scan the QR code — or grab an 8-digit pairing code. Session strings supported too.</div>
        </div>
        <div class="card card-hover">
          <div class="feature-icon blue">📜</div>
          <div class="feature-title">Live log console</div>
          <div class="feature-desc">A real-time console streams your bot's Render logs, auto-detects QR codes &amp; pairing codes and highlights errors.</div>
        </div>
        <div class="card card-hover">
          <div class="feature-icon purple">⚡</div>
          <div class="feature-title">24/7 keep-alive</div>
          <div class="feature-desc">Render free tier sleeps after 15 min idle. BotForge pings your bots every few minutes so they never go down — even on $0 plans.</div>
        </div>
        <div class="card card-hover">
          <div class="feature-icon">🔐</div>
          <div class="feature-title">Encrypted secrets</div>
          <div class="feature-desc">Render API keys and bot env vars are AES-256 encrypted at rest. Values are masked in the UI and never logged.</div>
        </div>
        <div class="card card-hover">
          <div class="feature-icon green">🎛️</div>
          <div class="feature-title">Full service control</div>
          <div class="feature-desc">Suspend, resume, restart, redeploy, edit env vars, view deploy history and delete — all from one dashboard.</div>
        </div>
        <div class="card card-hover">
          <div class="feature-icon blue">👥</div>
          <div class="feature-title">Multi-user &amp; admin</div>
          <div class="feature-desc">Built-in auth with JWT sessions, user roles and an admin panel. Run it for yourself or share it with your team/community.</div>
        </div>
        <div class="card card-hover">
          <div class="feature-icon purple">🧩</div>
          <div class="feature-title">Any repo, any runtime</div>
          <div class="feature-desc">Node.js or Python, web service or background worker — point the wizard at any GitHub repo and set your own commands.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════ TEMPLATES ═══════════ -->
  <section class="section alt" id="templates">
    <div class="container">
      <div class="section-head">
        <div class="section-kicker">Deploy instantly</div>
        <h2 class="section-title">One-click bot templates</h2>
        <p class="section-sub">Curated, working repos. Featured: <b>KnightBot Mini</b> — the WhatsApp bot this platform was built around.</p>
      </div>
      <div class="templates-grid">
        ${templates.map(t => `
        <div class="tcard ${t.featured ? 'featured' : ''}">
          ${t.featured ? '<div class="featured-ribbon">Featured</div>' : ''}
          <div class="tcard-head">
            <div class="tcard-icon">${t.icon}</div>
            <div>
              <div class="tcard-title">${esc(t.name)}</div>
              <div class="tcard-badges">
                ${platformBadge(t.platform)}
                <span class="badge badge-gray">${t.runtime}</span>
                ${t.plan === 'free' ? '<span class="badge badge-green">free tier</span>' : ''}
              </div>
            </div>
          </div>
          <div class="tcard-desc">${esc(t.description)}</div>
          <ul class="tcard-features">${(t.features || []).slice(0, 4).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
          <div class="tcard-foot">
            <span class="muted small mono">${esc(t.repo.replace('https://github.com/', ''))}</span>
            <a href="/deploy?t=${t.id}" class="btn btn-primary btn-sm" data-link>Deploy →</a>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- ═══════════ HOW IT WORKS ═══════════ -->
  <section class="section" id="how">
    <div class="container">
      <div class="section-head">
        <div class="section-kicker">Four steps</div>
        <h2 class="section-title">From repo to running bot</h2>
        <p class="section-sub">No Docker files, no terminal, no YAML editing (unless you want to).</p>
      </div>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-title">Pick where it runs</div>
          <div class="step-desc">🖥️ <b>Run on our site</b> — no extra account, the built-in runner executes your bot on the BotForge server. Or connect Render with an API key for ☁️ cloud deploys.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-title">Pick a template or repo</div>
          <div class="step-desc">Choose KnightBot Mini, another template, or paste any GitHub repo with your own build &amp; start commands.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-title">Deploy &amp; pair</div>
          <div class="step-desc">The bot boots and prints a WhatsApp QR — BotForge turns it into a scannable image. Scan it once and your session string is minted automatically.</div>
        </div>
        <div class="step">
          <div class="step-num">4</div>
          <div class="step-title">Manage 24/7</div>
          <div class="step-desc">Watch logs, edit env vars, restart, suspend, redeploy — local services are served from the panel’s own domain and auto-restore after restarts.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════ PRICING ═══════════ -->
  <section class="section alt" id="pricing">
    <div class="container">
      <div class="section-head">
        <div class="section-kicker">Simple costs</div>
        <h2 class="section-title">The platform is free. Render does the math.</h2>
        <p class="section-sub">BotForge itself is open-source and self-hosted on Render's free tier. Your bots run on Render plans you control.</p>
      </div>
      <div class="pricing-grid">
        <div class="card pcard">
          <h3>Free</h3>
          <p class="muted small">Render free instance</p>
          <div class="price mt-2">$0</div>
          <ul>
            <li>512 MB RAM · shared CPU</li>
            <li>Spins down after 15 min idle</li>
            <li>BotForge keep-alive keeps bots awake*</li>
            <li>750 free instance-hours/mo</li>
            <li>Unlimited deploys</li>
            <li class="no">No persistent disk</li>
          </ul>
          <a href="/register" class="btn btn-ghost btn-block" data-link>Start free</a>
        </div>
        <div class="card pcard recommended">
          <span class="badge badge-orange" style="align-self:flex-start">Most popular for bots</span>
          <h3 class="mt-1">Starter</h3>
          <p class="muted small">Render starter instance</p>
          <div class="price mt-2">$7<small>/mo per service</small></div>
          <ul>
            <li>512 MB RAM · dedicated</li>
            <li>Never sleeps</li>
            <li>Full keep-alive + auto-restart</li>
            <li>Custom domains</li>
            <li>Metrics &amp; alerts</li>
            <li class="no">Persistent disk (upgrade)</li>
          </ul>
          <a href="/register" class="btn btn-primary btn-block" data-link>Deploy a bot</a>
        </div>
        <div class="card pcard">
          <h3>Standard</h3>
          <p class="muted small">Render standard instance</p>
          <div class="price mt-2">$25<small>/mo per service</small></div>
          <ul>
            <li>2 GB RAM · 1 CPU</li>
            <li>Heavy WhatsApp bots &amp; media</li>
            <li>Persistent disks available</li>
            <li>Multiple background workers</li>
            <li>Priority builds</li>
            <li>Everything in Starter</li>
          </ul>
          <a href="/register" class="btn btn-ghost btn-block" data-link>Deploy a bot</a>
        </div>
      </div>
      <p class="muted small center mt-3">* Keep-alive keeps HTTP services awake on free plans. WhatsApp sessions with a session string also survive restarts. Prices reflect Render's public pricing and may change.</p>
    </div>
  </section>

  <!-- ═══════════ FAQ ═══════════ -->
  <section class="section" id="faq">
    <div class="container">
      <div class="section-head">
        <div class="section-kicker">Questions</div>
        <h2 class="section-title">Frequently asked</h2>
      </div>
      <div class="faq-list">
        <details class="faq">
          <summary>Is this really free?</summary>
          <div class="faq-body">Yes. BotForge is self-hosted and open-source — deploy it on Render's free tier. Your bots also run on Render free instances (750 instance-hours/month). You only pay Render if you upgrade a bot to a paid plan.</div>
        </details>
        <details class="faq">
          <summary>How does WhatsApp pairing work on Render?</summary>
          <div class="faq-body">WhatsApp bots (like KnightBot) print a QR code to their logs. BotForge's live log console detects it and renders a scannable QR image. Open WhatsApp → Settings → Linked Devices → Link a device, and scan. Alternatively, paste a session string (SESSION_ID) at deploy time for instant login.</div>
        </details>
        <details class="faq">
          <summary>Do free-tier bots stay awake 24/7?</summary>
          <div class="faq-body">Render free services sleep after ~15 minutes without HTTP traffic. BotForge includes a keep-alive pinger that hits each bot's public URL every few minutes, which keeps web services awake. For heavy 24/7 workloads we recommend a Starter ($7/mo) instance, which never sleeps.</div>
        </details>
        <details class="faq">
          <summary>Where is my data stored?</summary>
          <div class="faq-body">BotForge stores accounts, service records and encrypted secrets in a JSON database on its own disk. Attach a 1 GB Render disk (included in render.yaml) so data survives redeploys. Render API keys and env values are AES-256-GCM encrypted at rest.</div>
        </details>
        <details class="faq">
          <summary>Can I host any GitHub bot repo?</summary>
          <div class="faq-body">Yes — the deploy wizard accepts any public GitHub repo. Set the branch, runtime (Node or Python), build command and start command. Private repos work too if your Render account has GitHub connected with access.</div>
        </details>
        <details class="faq">
          <summary>Is this affiliated with Render or WhatsApp?</summary>
          <div class="faq-body">No. BotForge is an independent, open-source control panel that uses Render's public API. WhatsApp is a trademark of Meta; bots use the community Baileys library. Use responsibly and respect WhatsApp's Terms of Service.</div>
        </details>
      </div>
    </div>
  </section>

  <!-- ═══════════ CTA ═══════════ -->
  <section class="section alt">
    <div class="container center">
      <h2 class="section-title">Ready to forge your bot?</h2>
      <p class="section-sub mb-3">Deploy KnightBot or any repo in under a minute.</p>
      <a href="/register" class="btn btn-primary btn-lg" data-link>⚒️ Create free account</a>
    </div>
  </section>`;

  // animated terminal
  const term = document.getElementById('heroTerm');
  const script = [
    ['<span class="t-dim">$</span> botforge deploy --template knightbot-mini', 40],
    ['<span class="t-dim">→</span> repo: <span class="t-accent">github.com/mruniquehacker/KnightBot-Mini</span>', 350],
    ['<span class="t-dim">→</span> target: <span class="t-accent">run on our site</span> · port 10001', 420],
    ['<span class="t-dim">→</span> cloning repo… installing deps <span class="t-ok">✓</span>', 700],
    ['<span class="t-dim">→</span> build: npm install … <span class="t-ok">done in 26s</span>', 500],
    ['<span class="t-dim">→</span> running on our server at <span class="t-accent">/svc/knightbot-mini</span>', 650],
    ['<span class="t-dim">→</span> pairing: QR detected in logs — scan to link WhatsApp', 600],
    ['<span class="t-ok">✓ bot connected · 200+ commands loaded · keep-alive ON</span>', 800],
    ['<span class="t-dim">$</span> <span class="t-cursor"></span>', 900]
  ];
  let line = 0;
  function nextLine() {
    if (line >= script.length) return;
    const [html, delay] = script[line];
    const div = document.createElement('div');
    div.innerHTML = html;
    term.appendChild(div);
    line++;
    setTimeout(nextLine, delay);
  }
  nextLine();
});

route('/pricing', async (app) => {
  await routes['/'](app);
  setTimeout(() => document.getElementById('pricing')?.scrollIntoView(), 80);
});

route('404', async (app) => {
  app.innerHTML = `
  <div class="auth-wrap">
    <div class="center">
      <div style="font-size:4rem">🧭</div>
      <h2 style="margin:14px 0 8px">Page not found</h2>
      <p class="dim">That route doesn't exist in the forge.</p>
      <a href="/" class="btn btn-primary mt-3" data-link>← Back home</a>
    </div>
  </div>`;
});
