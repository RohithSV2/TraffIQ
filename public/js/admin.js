/**
 * TraffIQ Administrative Control Center
 * Incident moderation and emergency safety broadcasts
 */

class AdminPortal {
  constructor() {
    this.token = localStorage.getItem('traffiq_admin_token') || null;
    this.adminUser = localStorage.getItem('traffiq_admin_user') || null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.updateView();
  }

  bindEvents() {
    // Login form
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Logout button
    const logoutBtn = document.getElementById('btn-admin-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Broadcast alert form
    const alertForm = document.getElementById('form-broadcast-alert');
    if (alertForm) {
      alertForm.addEventListener('submit', (e) => this.handleBroadcastAlert(e));
    }
  }

  updateView() {
    const loginView = document.getElementById('admin-login-view');
    const dashView = document.getElementById('admin-dashboard-view');
    const userDisplay = document.getElementById('admin-user-display');

    if (this.token) {
      if (loginView) loginView.classList.add('hidden');
      if (dashView) dashView.classList.remove('hidden');
      if (userDisplay) userDisplay.textContent = this.adminUser || 'Administrator';
      this.loadIncidentsTable();
    } else {
      if (loginView) loginView.classList.remove('hidden');
      if (dashView) dashView.classList.add('hidden');
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('admin-user').value.trim();
    const password = document.getElementById('admin-pass').value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        this.token = data.token;
        this.adminUser = data.user.username;
        localStorage.setItem('traffiq_admin_token', this.token);
        localStorage.setItem('traffiq_admin_user', this.adminUser);
        if (window.showToast) window.showToast('Admin session authenticated successfully', 'success');
        this.updateView();
      } else {
        if (window.showToast) window.showToast(data.error || 'Invalid credentials', 'error');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (window.showToast) window.showToast('Login request failed', 'error');
    }
  }

  handleLogout() {
    this.token = null;
    this.adminUser = null;
    localStorage.removeItem('traffiq_admin_token');
    localStorage.removeItem('traffiq_admin_user');
    if (window.showToast) window.showToast('Logged out of admin portal', 'info');
    this.updateView();
  }

  async loadIncidentsTable() {
    const tbody = document.getElementById('admin-incidents-table-body');
    if (!tbody) return;

    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (data.success && data.incidents) {
        tbody.innerHTML = data.incidents.map(inc => `
          <tr>
            <td>
              <strong>${inc.title}</strong><br>
              <small class="text-muted"><i class="fa-solid fa-road"></i> ${inc.road_name}</small>
            </td>
            <td><span class="incident-badge badge-accident">${inc.incident_type}</span></td>
            <td><strong>${inc.severity}</strong></td>
            <td>${inc.reporter_name || 'Commuter'}</td>
            <td><span class="text-${inc.status === 'Resolved' ? 'emerald' : inc.status === 'Verified' ? 'blue' : 'amber'}">${inc.status}</span></td>
            <td>${inc.upvotes || 1}</td>
            <td>
              <div style="display:flex; gap:4px;">
                <button class="btn btn-outline btn-sm" onclick="window.traffiqAdmin.updateStatus(${inc.id}, 'Verified')" title="Mark Verified">
                  <i class="fa-solid fa-check text-blue"></i>
                </button>
                <button class="btn btn-outline btn-sm" onclick="window.traffiqAdmin.updateStatus(${inc.id}, 'Resolved')" title="Mark Resolved">
                  <i class="fa-solid fa-circle-check text-emerald"></i>
                </button>
                <button class="btn btn-outline btn-sm" onclick="window.traffiqAdmin.updateStatus(${inc.id}, 'Dismissed')" title="Dismiss">
                  <i class="fa-solid fa-trash-can text-rose"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Error loading incidents for moderation:', err);
    }
  }

  async updateStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        if (window.showToast) window.showToast(`Incident #${id} marked as ${newStatus}`, 'success');
        this.loadIncidentsTable();
        if (window.traffiqReports) window.traffiqReports.fetchIncidents();
        if (window.TraffIQMap) window.TraffIQMap.refreshMapMarkers();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async handleBroadcastAlert(e) {
    e.preventDefault();
    const title = document.getElementById('alert-title').value.trim();
    const alert_type = document.getElementById('alert-type').value;
    const priority = document.getElementById('alert-priority').value;
    const message = document.getElementById('alert-message').value.trim();

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, alert_type, priority, message })
      });
      const data = await res.json();
      if (data.success) {
        closeAlertModal();
        if (window.showToast) window.showToast('🚨 Emergency alert broadcasted successfully!', 'warning');
        if (window.traffiqAlerts) {
          window.traffiqAlerts.playEmergencyChime();
          window.traffiqAlerts.fetchAndRenderAlerts();
        }
        document.getElementById('form-broadcast-alert').reset();
      }
    } catch (err) {
      console.error('Error broadcasting alert:', err);
    }
  }
}

// Modal helper functions
window.openAlertModal = function() {
  const modal = document.getElementById('modal-alert');
  if (modal) modal.classList.remove('hidden');
};

window.closeAlertModal = function() {
  const modal = document.getElementById('modal-alert');
  if (modal) modal.classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
  window.traffiqAdmin = new AdminPortal();
});
