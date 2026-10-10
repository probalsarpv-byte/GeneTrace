import { getUserUsage } from '../firebase/firestore.js';

export class UserDashboard {
  async render(containerId, userProfile) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!userProfile) {
      container.innerHTML = `
        <div style="padding:2rem; text-align:center; color:var(--text-muted);">
          <h3>No User Profile Detected</h3>
          <p>Sign in via the account button in the top bar to synchronize your workspace.</p>
        </div>
      `;
      return;
    }

    let usage = null;
    if (userProfile.uid) {
      usage = await getUserUsage(userProfile.uid);
    }
    
    const usageHtml = (!usage || Object.keys(usage).length === 0) 
      ? `<p style="color:var(--text-muted);">No analyses tracked yet today.</p>` 
      : `<ul style="list-style:none; padding:0;">${Object.entries(usage).map(([fId, data]) => `<li style="padding:8px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between;"><span>${fId}</span><strong>${data.count} uses</strong></li>`).join('')}</ul>`;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.5rem; max-width:900px;">
        <div class="card" style="margin:0; background:var(--bg-secondary);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div>
              <h3>${userProfile.displayName || 'Research User'}</h3>
              <p style="color:var(--text-secondary); margin:0.25rem 0;">${userProfile.email || 'user@genetrace.local'}</p>
              <div style="display:flex; gap:0.5rem; align-items:center; margin-top:0.5rem;">
                <span class="badge ${userProfile.role === 'admin' ? 'badge-admin' : 'badge-dna'}">${(userProfile.role || 'user').toUpperCase()}</span>
                <span class="badge badge-pro">${(userProfile.plan || 'free').toUpperCase().replace('_', ' ')}</span>
                <span style="font-size:0.8rem; color:var(--text-muted);">Status: Active</span>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button id="btn-dash-switch-free" class="btn secondary small">Set Free</button>
              <button id="btn-dash-switch-student" class="btn secondary small">Set Student Pro</button>
              <button id="btn-dash-switch-research" class="btn primary small">Set Research Pro</button>
            </div>
          </div>
        </div>
        
        <div class="card" style="margin:0; background:var(--bg-secondary);">
          <h3>Tier & Entitlement Comparison</h3>
          <table class="data-table" style="width:100%; margin-top:1rem;">
            <thead>
              <tr><th>Plan Tier</th><th>Included Features</th><th>Compute / Daily Limits</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style="color:var(--text-muted);">Free</strong></td>
                <td>Sequence Inspector, ORF Finder, Translation, Motifs, Mutations, Restriction Digest, Compare, Newick Tree</td>
                <td>Standard limits (20–100/day)</td>
              </tr>
              <tr>
                <td><strong style="color:var(--accent-primary);">Student Pro</strong></td>
                <td>Everything in Free + Raw Sanger AB1 Chromatograms, FASTQ Quality & Filter, 16S / ITS / 18S Workflows, 3D Organism Viewer</td>
                <td>Higher limits (50–500/day)</td>
              </tr>
              <tr>
                <td><strong style="color:#8b5cf6;">Research Pro</strong></td>
                <td>Everything in Student Pro + Batch Multi-FASTA Analysis, Advanced Phylogeny, Full Scientific HTML/PDF Export</td>
                <td>Maximum limits (1,000+/day)</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="card" style="margin:0; background:var(--bg-secondary);">
          <h3>Daily Feature Usage</h3>
          ${usageHtml}
        </div>
      </div>
    `;

    const setPlan = (planName) => {
      userProfile.plan = planName;
      localStorage.setItem('genetrace_user_plan', planName);
      const badge = document.getElementById('plan-badge');
      if (badge) {
        badge.textContent = planName.toUpperCase().replace('_', ' ');
        badge.className = `plan-badge ${planName.includes('pro') ? 'pro' : planName}`;
      }
      this.render(containerId, userProfile);
      if (window.GeneTrace) {
        window.GeneTrace.updateUserPlan(planName);
      }
    };

    const btnFree = document.getElementById('btn-dash-switch-free');
    const btnStudent = document.getElementById('btn-dash-switch-student');
    const btnResearch = document.getElementById('btn-dash-switch-research');

    if (btnFree) btnFree.onclick = () => setPlan('free');
    if (btnStudent) btnStudent.onclick = () => setPlan('student_pro');
    if (btnResearch) btnResearch.onclick = () => setPlan('research_pro');
  }
}
