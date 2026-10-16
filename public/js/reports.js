/**
 * TraffIQ Community Incident Reports Module
 */

class ReportsManager {
  constructor() {
    this.incidents = [];
    this.currentFilter = 'all';
    this.upvotedSet = new Set();
    this.init();
  }

  init() {
    this.fetchIncidents();
    this.bindEvents();
  }

  bindEvents() {
    // Filter chips
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.dataset.filter;
        this.renderIncidents();
      });
    });

    // Submit report form
    const form = document.getElementById('form-submit-incident');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmitReport(e));
    }
  }

  async fetchIncidents() {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (data.success && data.incidents) {
        this.incidents = data.incidents;
        this.renderIncidents();
        this.updateBadge();
      }
    } catch (err) {
      console.error('Error fetching incidents:', err);
    }
  }

  updateBadge() {
    const badge = document.getElementById('incidents-count-badge');
    if (badge) {
      badge.textContent = this.incidents.length;
    }
  }

  renderIncidents() {
    const container = document.getElementById('incidents-container');
    if (!container) return;

    let filtered = this.incidents;
    if (this.currentFilter !== 'all') {
      filtered = this.incidents.filter(i => i.incident_type === this.currentFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: var(--accent-green); margin-bottom: 0.75rem;"></i>
          <h4>No reported incidents matching "${this.currentFilter}"</h4>
          <p>Corridors in this category are operating smoothly with normal traffic flow.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(inc => {
      let badgeClass = 'badge-accident';
      if (inc.incident_type === 'Roadwork') badgeClass = 'badge-roadwork';
      else if (inc.incident_type === 'Waterlogging') badgeClass = 'badge-waterlogging';
      else if (inc.incident_type === 'Hazard') badgeClass = 'badge-hazard';

      const hasUpvoted = this.upvotedSet.has(inc.id);

      return `
        <div class="incident-card">
          <div>
            <div class="incident-top-row">
              <span class="incident-badge ${badgeClass}"><i class="fa-solid fa-tag"></i> ${inc.incident_type}</span>
              <span class="text-muted" style="font-size:0.75rem;">${this.formatTime(inc.created_at)}</span>
            </div>
            <h3 class="incident-title">${inc.title}</h3>
            <div class="incident-road"><i class="fa-solid fa-location-dot text-rose"></i> ${inc.road_name}</div>
            <p class="incident-desc">${inc.description || 'Reported by commuter. Exercise caution on this section.'}</p>
          </div>
          <div class="incident-footer">
            <span>By <strong>${inc.reporter_name || 'Anonymous'}</strong> • <span class="text-emerald">${inc.status || 'Verified'}</span></span>
            <button class="btn-upvote ${hasUpvoted ? 'upvoted' : ''}" onclick="window.traffiqReports.upvote(${inc.id})">
              <i class="fa-solid fa-thumbs-up"></i> <span>${inc.upvotes || 1}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  formatTime(isoString) {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    const diffMins = Math.round((new Date() - date) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  async upvote(incidentId) {
    if (this.upvotedSet.has(incidentId)) {
      if (window.showToast) window.showToast('You already verified this report', 'info');
      return;
    }

    this.upvotedSet.add(incidentId);

    // Optimistic UI update
    const target = this.incidents.find(i => i.id === incidentId);
    if (target) {
      target.upvotes = (target.upvotes || 1) + 1;
      this.renderIncidents();
    }

    try {
      const res = await fetch(`/api/incidents/${incidentId}/upvote`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (window.showToast) window.showToast('Upvote confirmed! Thank you for validating road conditions.', 'success');
      }
    } catch (err) {
      console.error('Error upvoting incident:', err);
    }
  }

  async handleSubmitReport(e) {
    e.preventDefault();
    const payload = {
      title: document.getElementById('inc-title').value,
      incident_type: document.getElementById('inc-type').value,
      severity: document.getElementById('inc-severity').value,
      road_name: document.getElementById('inc-road').value,
      latitude: parseFloat(document.getElementById('inc-lat').value) || 12.975,
      longitude: parseFloat(document.getElementById('inc-lng').value) || 77.61,
      description: document.getElementById('inc-desc').value,
      reporter_name: document.getElementById('inc-reporter').value || 'Community Commuter'
    };

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        closeReportModal();
        if (window.showToast) {
          window.showToast('Incident report submitted successfully! Visible to all commuters.', 'success');
        }
        document.getElementById('form-submit-incident').reset();
        await this.fetchIncidents();
        if (window.TraffIQMap) {
          window.TraffIQMap.refreshMapMarkers();
        }
      }
    } catch (err) {
      console.error('Error submitting incident:', err);
      if (window.showToast) window.showToast('Failed to submit report. Please try again.', 'error');
    }
  }
}

// Modal helper functions
window.openReportModal = function() {
  const modal = document.getElementById('modal-report');
  if (modal) modal.classList.remove('hidden');
};

window.closeReportModal = function() {
  const modal = document.getElementById('modal-report');
  if (modal) modal.classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
  window.traffiqReports = new ReportsManager();
});
