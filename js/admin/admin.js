import { AdminUsers } from './admin-users.js';
import { AdminFeatureManager } from './admin-feature-manager.js';
import { AdminAnalytics } from './admin-analytics.js';
import { FIRESTORE_RULES } from '../firebase/firestore-rules.js';

export class AdminDashboard {
  init(userProfile, containerId = 'admin-dashboard-container') {
    this.render(containerId);
  }

  render(containerId = 'admin-dashboard-container') {
    const root = document.getElementById(containerId) || document.getElementById('app') || document.body;
    root.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.5rem;">
        <div style="display:flex; gap:0.5rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem; flex-wrap:wrap;">
          <button class="btn primary small" id="admin-nav-features">Feature Flags & Limits</button>
          <button class="btn secondary small" id="admin-nav-overview">System Analytics</button>
          <button class="btn secondary small" id="admin-nav-users">User Accounts</button>
          <button class="btn secondary small" id="admin-nav-security">Firestore Security Rules</button>
        </div>
        <div id="admin-section-content" style="min-height:300px;">
        </div>
      </div>
    `;

    const navFeatures = document.getElementById('admin-nav-features');
    const navOverview = document.getElementById('admin-nav-overview');
    const navUsers = document.getElementById('admin-nav-users');
    const navSecurity = document.getElementById('admin-nav-security');

    const setActive = (activeBtn) => {
      [navFeatures, navOverview, navUsers, navSecurity].forEach(b => {
        if (b) {
          b.className = 'btn secondary small';
        }
      });
      if (activeBtn) activeBtn.className = 'btn primary small';
    };

    if (navFeatures) navFeatures.onclick = () => { setActive(navFeatures); this.loadSection('features'); };
    if (navOverview) navOverview.onclick = () => { setActive(navOverview); this.loadSection('overview'); };
    if (navUsers) navUsers.onclick = () => { setActive(navUsers); this.loadSection('users'); };
    if (navSecurity) navSecurity.onclick = () => { setActive(navSecurity); this.loadSection('security'); };

    this.loadSection('features');
  }

  loadSection(sectionId) {
    const content = document.getElementById('admin-section-content');
    if (!content) return;
    
    if (sectionId === 'overview') {
      const analytics = new AdminAnalytics();
      analytics.render('admin-section-content');
    } else if (sectionId === 'users') {
      const users = new AdminUsers();
      users.render('admin-section-content');
    } else if (sectionId === 'features') {
      const fm = new AdminFeatureManager();
      fm.render('admin-section-content');
    } else if (sectionId === 'security') {
      content.innerHTML = `
        <div class="card" style="margin:0; background:var(--bg-secondary);">
          <h4>Firestore Security Rules for Production</h4>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">
            Copy these production security rules into your Firebase Console (Firestore Database ➔ Rules).
          </p>
          <pre style="background:var(--bg-tertiary); padding:1rem; border-radius:var(--radius-md); font-family:var(--font-mono); font-size:0.8rem; overflow-x:auto;">${FIRESTORE_RULES}</pre>
        </div>
      `;
    }
  }
}
