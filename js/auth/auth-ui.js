import { loginUser, registerUser, resetPassword } from '../firebase/auth.js';
import { FIREBASE_ENABLED } from '../firebase/firebase-config.js';

export class AuthUI {
  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'auth-overlay';
    this.overlay.style.display = 'none';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
    this.overlay.style.zIndex = '9999';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.alignItems = 'center';
    document.body.appendChild(this.overlay);

    this.container = document.createElement('div');
    this.container.style.backgroundColor = '#fff';
    this.container.style.padding = '30px';
    this.container.style.borderRadius = '8px';
    this.container.style.width = '100%';
    this.container.style.maxWidth = '400px';
    this.overlay.appendChild(this.container);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  show(mode = 'login') {
    this.overlay.style.display = 'flex';
    if (!FIREBASE_ENABLED) {
      this.container.innerHTML = `<div style="color:red; margin-bottom:15px;">Authentication requires Firebase configuration. See js/firebase/firebase-config.js</div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Close';
      btn.onclick = () => this.hide();
      this.container.appendChild(btn);
      return;
    }
    
    if (mode === 'login') this.renderLoginForm();
    else if (mode === 'register') this.renderRegisterForm();
    else if (mode === 'forgot') this.renderForgotForm();
  }

  hide() {
    this.overlay.style.display = 'none';
  }

  renderLoginForm() {
    this.container.innerHTML = `
      <h2>Login</h2>
      <div id="auth-error" style="color:red; margin-bottom:10px;"></div>
      <input type="email" id="auth-email" placeholder="Email" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;">
      <input type="password" id="auth-password" placeholder="Password" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;">
      <button id="auth-login-btn" style="width:100%; padding:10px; background:#007bff; color:#fff; border:none; border-radius:4px; cursor:pointer;">Login</button>
      <div style="margin-top:15px; text-align:center;">
        <a href="#" id="auth-forgot-link">Forgot password?</a> | 
        <a href="#" id="auth-register-link">Create account</a>
      </div>
    `;

    document.getElementById('auth-login-btn').onclick = () => {
      const email = document.getElementById('auth-email').value;
      const pass = document.getElementById('auth-password').value;
      this.handleLogin(email, pass);
    };
    document.getElementById('auth-forgot-link').onclick = (e) => { e.preventDefault(); this.show('forgot'); };
    document.getElementById('auth-register-link').onclick = (e) => { e.preventDefault(); this.show('register'); };
  }

  renderRegisterForm() {
    this.container.innerHTML = `
      <h2>Register</h2>
      <div id="auth-error" style="color:red; margin-bottom:10px;"></div>
      <input type="text" id="auth-name" placeholder="Display Name" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;">
      <input type="email" id="auth-email" placeholder="Email" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;">
      <input type="password" id="auth-password" placeholder="Password" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;">
      <input type="password" id="auth-confirm" placeholder="Confirm Password" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;">
      <button id="auth-register-btn" style="width:100%; padding:10px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer;">Register</button>
      <div style="margin-top:15px; text-align:center;">
        <a href="#" id="auth-login-link">Already have an account? Login</a>
      </div>
    `;

    document.getElementById('auth-register-btn').onclick = () => {
      const name = document.getElementById('auth-name').value;
      const email = document.getElementById('auth-email').value;
      const pass = document.getElementById('auth-password').value;
      const confirm = document.getElementById('auth-confirm').value;
      if (pass !== confirm) {
        document.getElementById('auth-error').textContent = 'Passwords do not match';
        return;
      }
      this.handleRegister(name, email, pass);
    };
    document.getElementById('auth-login-link').onclick = (e) => { e.preventDefault(); this.show('login'); };
  }

  renderForgotForm() {
    this.container.innerHTML = `
      <h2>Reset Password</h2>
      <div id="auth-error" style="color:red; margin-bottom:10px;"></div>
      <div id="auth-msg" style="color:green; margin-bottom:10px;"></div>
      <input type="email" id="auth-email" placeholder="Email" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;">
      <button id="auth-reset-btn" style="width:100%; padding:10px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer;">Send reset email</button>
      <div style="margin-top:15px; text-align:center;">
        <a href="#" id="auth-login-link">Back to Login</a>
      </div>
    `;

    document.getElementById('auth-reset-btn').onclick = () => {
      const email = document.getElementById('auth-email').value;
      this.handleForgot(email);
    };
    document.getElementById('auth-login-link').onclick = (e) => { e.preventDefault(); this.show('login'); };
  }

  async handleLogin(email, password) {
    const res = await loginUser(email, password);
    if (res.success) {
      this.hide();
    } else {
      document.getElementById('auth-error').textContent = res.reason;
    }
  }

  async handleRegister(displayName, email, password) {
    const res = await registerUser(email, password, displayName);
    if (res.success) {
      this.hide();
    } else {
      document.getElementById('auth-error').textContent = res.reason;
    }
  }

  async handleForgot(email) {
    const res = await resetPassword(email);
    if (res.success) {
      document.getElementById('auth-msg').textContent = 'Reset email sent.';
      document.getElementById('auth-error').textContent = '';
    } else {
      document.getElementById('auth-error').textContent = res.reason;
      document.getElementById('auth-msg').textContent = '';
    }
  }

  updateTopBarAccount(user, userProfile) {
    const btn = document.getElementById('account-btn');
    if (!btn) return;
    if (user && userProfile) {
      const initials = (userProfile.displayName || 'U').substring(0,2).toUpperCase();
      btn.innerHTML = `<div style="display:flex; align-items:center; gap:10px;">
        <div style="width:30px; height:30px; border-radius:50%; background:#007bff; color:#fff; display:flex; justify-content:center; align-items:center; font-size:12px;">${initials}</div>
        <span>${userProfile.displayName}</span>
        <span id="plan-badge" style="padding:2px 6px; font-size:10px; border-radius:10px; background:#ffc107; color:#000;">${userProfile.plan}</span>
      </div>`;
    } else {
      btn.innerHTML = `<button style="padding:5px 15px;">Sign In</button>`;
      btn.onclick = () => this.show('login');
    }
  }

  showPlanBadge(plan) {
    const badge = document.getElementById('plan-badge');
    if (badge) badge.textContent = plan;
  }
}
