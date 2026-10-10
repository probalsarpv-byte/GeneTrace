import { getSystemStats } from '../firebase/firestore.js';

export class AdminAnalytics {
  async render(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<h2>Analytics Overview</h2><p>Loading stats...</p>`;

    const stats = await getSystemStats();

    if (!stats) {
      container.innerHTML = `
        <h2>Analytics Overview</h2>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:20px;">
          <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Total Users</h3><p>No data yet.</p></div>
          <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Free Users</h3><p>No data yet.</p></div>
          <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Premium Users</h3><p>No data yet.</p></div>
          <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Active Today</h3><p>No data yet.</p></div>
          <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Projects</h3><p>No data yet.</p></div>
          <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Reports Generated</h3><p>No data yet.</p></div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <h2>Analytics Overview</h2>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:20px;">
        <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Total Users</h3><p style="font-size:24px; font-weight:bold;">${stats.totalUsers}</p></div>
        <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Free Users</h3><p style="font-size:24px; font-weight:bold;">${stats.freeUsers}</p></div>
        <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Premium Users</h3><p style="font-size:24px; font-weight:bold;">${stats.premiumUsers}</p></div>
        <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Active Today</h3><p style="font-size:24px; font-weight:bold;">${stats.activeToday}</p></div>
        <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Projects</h3><p style="font-size:24px; font-weight:bold;">${stats.projects}</p></div>
        <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h3>Reports Generated</h3><p style="font-size:24px; font-weight:bold;">${stats.reportsGenerated}</p></div>
      </div>
    `;
  }
}
