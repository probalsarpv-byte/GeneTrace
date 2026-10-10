import { getAllUsers, setUserPlan, setUserRole } from '../firebase/firestore.js';

export class AdminUsers {
  async render(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<h2>Users</h2><p>Loading...</p>`;
    
    const users = await getAllUsers();
    
    if (users.length === 0) {
      container.innerHTML = `<h2>Users</h2><p>No data yet.</p>`;
      return;
    }

    let html = `
      <h2>Users</h2>
      <table style="width:100%; border-collapse:collapse; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background:#eee; text-align:left;">
            <th style="padding:10px;">User</th>
            <th style="padding:10px;">Email</th>
            <th style="padding:10px;">Role</th>
            <th style="padding:10px;">Plan</th>
            <th style="padding:10px;">Actions</th>
          </tr>
        </thead>
        <tbody id="user-table-body">
        </tbody>
      </table>
    `;
    container.innerHTML = html;
    
    const tbody = document.getElementById('user-table-body');
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #ddd';
      tr.innerHTML = `
        <td style="padding:10px;">${u.displayName || 'N/A'}</td>
        <td style="padding:10px;">${u.email}</td>
        <td style="padding:10px;">${u.role}</td>
        <td style="padding:10px;">${u.plan}</td>
        <td style="padding:10px;">
          <button class="edit-plan-btn" data-uid="${u.uid}" style="margin-right:5px;">Edit Plan</button>
          <button class="set-role-btn" data-uid="${u.uid}" data-role="${u.role === 'admin' ? 'user' : 'admin'}">Make ${u.role === 'admin' ? 'User' : 'Admin'}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.edit-plan-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const uid = e.target.getAttribute('data-uid');
        const newPlan = prompt('Enter new plan (free, student_pro, research_pro):', 'free');
        if (newPlan) {
          const res = await setUserPlan(uid, newPlan, null);
          if (res.success) {
            alert('Plan updated');
            this.render(containerId);
          } else {
            alert('Error: ' + res.reason);
          }
        }
      };
    });

    document.querySelectorAll('.set-role-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const uid = e.target.getAttribute('data-uid');
        const newRole = e.target.getAttribute('data-role');
        if (confirm(`Change role to ${newRole}?`)) {
          const res = await setUserRole(uid, newRole);
          if (res.success) {
            alert('Role updated');
            this.render(containerId);
          } else {
            alert('Error: ' + res.reason);
          }
        }
      };
    });
  }
}
