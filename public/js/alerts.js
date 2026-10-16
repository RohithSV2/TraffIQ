/**
 * TraffIQ Emergency Vehicle Awareness & Alerts Engine
 * Uses Web Audio API for synthetic emergency sirens and manages live bulletins
 */

class AlertsEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.sirenOscillator = null;
    this.sirenInterval = null;
    this.activeEmergency = null;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API not supported on this browser:', e);
    }
  }

  ensureAudioResumed() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Play two-tone emergency ambulance chime
  playEmergencyChime() {
    if (this.isMuted) return;
    this.ensureAudioResumed();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      // High pitch then low pitch
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(880, now + 0.25);
      osc.frequency.setValueAtTime(659.25, now + 0.3);
      osc.frequency.setValueAtTime(659.25, now + 0.55);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  // Soft notification chime
  playNoticeChime() {
    if (this.isMuted) return;
    this.ensureAudioResumed();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn(e);
    }
  }

  showEmergencyBanner(vehicleCode, routeName, desc) {
    const banner = document.getElementById('emergency-banner');
    const title = document.getElementById('emergency-banner-title');
    const description = document.getElementById('emergency-banner-desc');

    if (banner && title && description) {
      title.textContent = `PRIORITY CORRIDOR ACTIVE: ${vehicleCode}`;
      description.textContent = `${vehicleCode} active on ${routeName}. ${desc || 'Please clear the right lane immediately to allow emergency transit.'}`;
      banner.classList.remove('hidden');
      this.playEmergencyChime();
    }
  }

  hideEmergencyBanner() {
    const banner = document.getElementById('emergency-banner');
    if (banner) {
      banner.classList.add('hidden');
    }
  }

  toggleSound() {
    this.isMuted = !this.isMuted;
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) {
      btn.innerHTML = this.isMuted
        ? '<i class="fa-solid fa-volume-xmark"></i>'
        : '<i class="fa-solid fa-volume-high"></i>';
    }
    if (window.showToast) {
      window.showToast(this.isMuted ? 'Alert sounds muted' : 'Alert sounds enabled', 'info');
    }
  }

  async fetchAndRenderAlerts() {
    try {
      const [alertsRes, vehiclesRes] = await Promise.all([
        fetch('/api/alerts').then(r => r.json()),
        fetch('/api/emergency-vehicles').then(r => r.json())
      ]);

      if (alertsRes.success) {
        this.renderBulletins(alertsRes.alerts);
        this.updateTicker(alertsRes.alerts);
      }

      if (vehiclesRes.success) {
        this.renderEmergencyVehicles(vehiclesRes.vehicles);
        // If there's an active ambulance, show banner
        const activeAmbulance = vehiclesRes.vehicles.find(v => v.active);
        if (activeAmbulance) {
          this.showEmergencyBanner(
            activeAmbulance.vehicle_code,
            activeAmbulance.current_route,
            `En route to ${activeAmbulance.destination} at ${activeAmbulance.speed_kmh} km/h.`
          );
        }
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  }

  renderBulletins(alerts) {
    const container = document.getElementById('alerts-bulletins-container');
    if (!container) return;

    if (!alerts || alerts.length === 0) {
      container.innerHTML = '<p class="text-muted">No active safety advisories at this time.</p>';
      return;
    }

    container.innerHTML = alerts.map(a => {
      let icon = '<i class="fa-solid fa-triangle-exclamation text-amber"></i>';
      if (a.alert_type === 'Emergency') icon = '<i class="fa-solid fa-truck-medical text-rose"></i>';
      else if (a.alert_type === 'Weather') icon = '<i class="fa-solid fa-cloud-showers-heavy text-blue"></i>';
      else if (a.alert_type === 'Road Closure') icon = '<i class="fa-solid fa-road-barrier text-amber"></i>';

      return `
        <div class="bulletin-card">
          <div class="bulletin-icon">${icon}</div>
          <div class="bulletin-content">
            <h4>${a.title}</h4>
            <p>${a.message}</p>
            <small class="text-muted"><i class="fa-regular fa-clock"></i> ${new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Priority: <strong>${a.priority}</strong></small>
          </div>
        </div>
      `;
    }).join('');
  }

  renderEmergencyVehicles(vehicles) {
    const container = document.getElementById('emergency-vehicles-container');
    if (!container) return;

    if (!vehicles || vehicles.length === 0) {
      container.innerHTML = '<p class="text-muted">No emergency vehicles currently deployed.</p>';
      return;
    }

    container.innerHTML = vehicles.map(v => `
      <div class="ev-card">
        <div class="ev-icon-box">
          <i class="fa-solid ${v.vehicle_type === 'Ambulance' ? 'fa-truck-medical' : 'fa-fire-extinguisher'}"></i>
        </div>
        <div class="ev-info">
          <h4>${v.vehicle_code} (${v.vehicle_type})</h4>
          <p><i class="fa-solid fa-route text-blue"></i> ${v.current_route}</p>
          <p><i class="fa-solid fa-hospital text-emerald"></i> Destination: ${v.destination}</p>
          <small class="text-muted">Speed: <strong>${v.speed_kmh} km/h</strong> • Status: <span class="text-emerald">Priority En Route</span></small>
        </div>
      </div>
    `).join('');
  }

  updateTicker(alerts) {
    const ticker = document.getElementById('ticker-content');
    if (!ticker || !alerts || alerts.length === 0) return;
    ticker.innerHTML = alerts.map(a => `<span><i class="fa-solid fa-circle-exclamation text-amber"></i> ${a.title}: ${a.message}</span>`).join('');
  }

  async triggerEmergencySimulation() {
    try {
      this.playEmergencyChime();
      const res = await fetch('/api/emergency-vehicles/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_code: 'AMB-108' })
      });
      const data = await res.json();
      if (data.success) {
        if (window.showToast) {
          window.showToast('🚨 Priority emergency dispatch alert triggered!', 'warning');
        }
        this.fetchAndRenderAlerts();
        if (window.TraffIQMap) {
          window.TraffIQMap.refreshMapMarkers();
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
}

window.traffiqAlerts = new AlertsEngine();

document.addEventListener('DOMContentLoaded', () => {
  const dismissBtn = document.getElementById('btn-emergency-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => window.traffiqAlerts.hideEmergencyBanner());
  }

  const soundBtn = document.getElementById('btn-sound-toggle');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => window.traffiqAlerts.toggleSound());
  }

  const testSirenBtn = document.getElementById('btn-test-siren');
  if (testSirenBtn) {
    testSirenBtn.addEventListener('click', () => {
      window.traffiqAlerts.playEmergencyChime();
      if (window.showToast) window.showToast('Playing synthetic emergency chime...', 'info');
    });
  }

  const simAmbulanceBtn = document.getElementById('btn-trigger-ambulance');
  if (simAmbulanceBtn) {
    simAmbulanceBtn.addEventListener('click', () => window.traffiqAlerts.triggerEmergencySimulation());
  }

  const simAmbulanceQuick = document.getElementById('btn-simulate-emergency');
  if (simAmbulanceQuick) {
    simAmbulanceQuick.addEventListener('click', () => window.traffiqAlerts.triggerEmergencySimulation());
  }

  // Load initial alerts
  window.traffiqAlerts.fetchAndRenderAlerts();
});
