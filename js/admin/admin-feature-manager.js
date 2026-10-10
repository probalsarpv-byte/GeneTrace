import { getAllFeatures } from '../firebase/feature-manager.js';
import { setFeatureConfig } from '../firebase/firestore.js';
import { FIREBASE_ENABLED } from '../firebase/firebase-config.js';

export class AdminFeatureManager {
  async render(containerId) {
    const container = document.getElementById(containerId);
    let html = `<h2>Feature Registry</h2>`;
    
    if (!FIREBASE_ENABLED) {
      html += `<div style="background:#fff3cd; color:#856404; padding:10px; margin-bottom:15px; border-radius:4px;">Feature changes require Firebase. Using local defaults.</div>`;
    }

    html += `
      <table style="width:100%; border-collapse:collapse; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background:#eee; text-align:left;">
            <th style="padding:10px;">Feature Name</th>
            <th style="padding:10px;">Status</th>
            <th style="padding:10px;">Access Tier</th>
            <th style="padding:10px;">Free Limit</th>
            <th style="padding:10px;">Premium Limit</th>
            <th style="padding:10px;">Beta</th>
            <th style="padding:10px;">Actions</th>
          </tr>
        </thead>
        <tbody id="feature-table-body">
        </tbody>
      </table>
    `;
    container.innerHTML = html;

    const features = getAllFeatures();
    const tbody = document.getElementById('feature-table-body');
    
    for (const [id, config] of Object.entries(features)) {
      tbody.appendChild(this.renderFeatureRow(id, config));
    }
  }

  renderFeatureRow(featureId, config) {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #ddd';
    
    let statusPill = config.enabled ? `<span style="background:#28a745; color:white; padding:2px 6px; border-radius:10px; font-size:12px;">ENABLED</span>` : `<span style="background:#6c757d; color:white; padding:2px 6px; border-radius:10px; font-size:12px;">DISABLED</span>`;
    if (config.beta) {
        statusPill += ` <span style="background:#ffc107; color:black; padding:2px 6px; border-radius:10px; font-size:12px;">BETA</span>`;
    }
    
    tr.innerHTML = `
      <td style="padding:10px;">${config.name} <div style="font-size:10px; color:#888;">${featureId}</div></td>
      <td style="padding:10px;">${statusPill}</td>
      <td style="padding:10px;">
        <select id="tier-${featureId}">
          <option value="free" ${config.accessTier === 'free' ? 'selected' : ''}>Free</option>
          <option value="student_pro" ${config.accessTier === 'student_pro' ? 'selected' : ''}>Student Pro</option>
          <option value="research_pro" ${config.accessTier === 'research_pro' ? 'selected' : ''}>Research Pro</option>
          <option value="admin" ${config.accessTier === 'admin' ? 'selected' : ''}>Admin Only</option>
        </select>
      </td>
      <td style="padding:10px;"><input type="number" id="freelimit-${featureId}" value="${config.freeDailyLimit}" style="width:60px;"></td>
      <td style="padding:10px;"><input type="number" id="premlimit-${featureId}" value="${config.premiumDailyLimit}" style="width:60px;"></td>
      <td style="padding:10px;"><input type="checkbox" id="beta-${featureId}" ${config.beta ? 'checked' : ''}></td>
      <td style="padding:10px;"><button id="save-${featureId}" style="padding:5px 10px; background:#007bff; color:#fff; border:none; cursor:pointer;">Save</button></td>
    `;

    tr.querySelector(`#save-${featureId}`).onclick = async () => {
      const updatedConfig = {
        name: config.name,
        enabled: config.enabled,
        accessTier: document.getElementById(`tier-${featureId}`).value,
        freeDailyLimit: parseInt(document.getElementById(`freelimit-${featureId}`).value),
        premiumDailyLimit: parseInt(document.getElementById(`premlimit-${featureId}`).value),
        beta: document.getElementById(`beta-${featureId}`).checked
      };
      const res = await setFeatureConfig(featureId, updatedConfig);
      if (res.success) {
        alert('Saved');
        this.render(document.getElementById('feature-table-body').closest('div').id);
      } else {
        alert('Error: ' + res.reason);
      }
    };

    return tr;
  }
}
