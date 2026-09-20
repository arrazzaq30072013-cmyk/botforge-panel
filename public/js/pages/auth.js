/* ════════════════════════════════════════════════════════════════
   BotForge — auth pages (login / register)
   ════════════════════════════════════════════════════════════════ */

'use strict';

function authForm(kind) {
  const isLogin = kind === 'login';
  return `
  <div class="auth-wrap">
    <div class="panel auth-card">
      <div class="auth-head">
        <div style="font-size:2.4rem;margin-bottom:10px">${isLogin ? '👋' : '⚒️'}</div>
        <h2>${isLogin ? 'Welcome back' : 'Create your account'}</h2>
        <p>${isLogin ? 'Log in to your bot control panel.' : 'Free forever. Deploy your first bot in minutes.'}</p>
      </div>
      ${!isLogin ? `<div class="alert alert-info">💡 <b>Tip:</b> The first account created becomes the platform <b>admin</b>.</div>` : ''}
      <form id="authForm">
        ${!isLogin ? `
        <div class="field">
          <label>Name</label>
          <input class="input" name="name" placeholder="Your name" maxlength="60" autocomplete="name">
        </div>` : ''}
        <div class="field">
          <label>Email</label>
          <input class="input" type="email" name="email" placeholder="you@example.com" required autocomplete="email">
        </div>
        <div class="field">
          <label>Password</label>
          <div class="input-group">
            <input class="input" type="password" name="password" placeholder="••••••••" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}">
            <button type="button" class="toggle-vis" tabindex="-1">show</button>
          </div>
          ${!isLogin ? '<div class="hint">At least 6 characters.</div>' : ''}
        </div>
        <button class="btn btn-primary btn-block btn-lg" id="authSubmit">
          <span class="btn-spinner"></span>
          <span class="btn-label">${isLogin ? 'Log in' : 'Create account'}</span>
        </button>
        <div id="authError" class="alert alert-err hidden mt-2"></div>
      </form>
      <div class="auth-foot">
        ${isLogin
          ? `No account? <a href="/register" data-link>Create one free</a>`
          : `Already registered? <a href="/login" data-link>Log in</a>`}
      </div>
    </div>
  </div>`;
}

function wireAuth(kind) {
  const form = document.getElementById('authForm');
  const btn = document.getElementById('authSubmit');
  const errBox = document.getElementById('authError');
  form.querySelectorAll('.toggle-vis').forEach(t => {
    t.onclick = () => {
      const input = t.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      t.textContent = show ? 'hide' : 'show';
    };
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    setLoading(btn, true);
    try {
      const res = await api(`/auth/${kind}`, { method: 'POST', body });
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('bf_token', res.token);
      toast(`Welcome, ${res.user.name}! 🎉`);
      navigate('/dashboard');
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  };
}

route('/login', async (app) => {
  if (state.user) return navigate('/dashboard');
  app.innerHTML = authForm('login');
  wireAuth('login');
});

route('/register', async (app) => {
  if (state.user) return navigate('/dashboard');
  app.innerHTML = authForm('register');
  wireAuth('register');
});
