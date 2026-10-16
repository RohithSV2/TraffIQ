/**
 * TraffIQ Core Application Controller
 * Handles tabs, theming, telemetry, and notifications
 */

// Toast notification helper
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = '<i class="fa-solid fa-circle-info text-blue"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check text-emerald"></i>';
  else if (type === 'error') icon = '<i class="fa-solid fa-circle-xmark text-rose"></i>';
  else if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation text-amber"></i>';

  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

class AppController {
  constructor() {
    this.initTabs();
    this.initTheme();
    this.initClock();
    this.checkSystemStatus();
  }

  initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const activePane = document.getElementById(targetId);
        if (activePane) activePane.classList.add('active');

        // If switching to map, trigger map resize
        if (targetId === 'tab-map' && window.TraffIQMap && window.TraffIQMap.map) {
          setTimeout(() => {
            window.TraffIQMap.map.invalidateSize();
          }, 150);
        }

        // If switching to admin, refresh moderation table
        if (targetId === 'tab-admin' && window.traffiqAdmin) {
          window.traffiqAdmin.updateView();
        }
      });
    });
  }

  initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('traffiq_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('traffiq_theme', nextTheme);
        this.updateThemeIcon(nextTheme);
      });
    }
  }

  updateThemeIcon(theme) {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'dark'
        ? '<i class="fa-solid fa-moon"></i>'
        : '<i class="fa-solid fa-sun text-amber"></i>';
    }
  }

  initClock() {
    const clockEl = document.getElementById('live-clock');
    const updateTime = () => {
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = `${now.toLocaleTimeString()} IST`;
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  async checkSystemStatus() {
    try {
      const res = await fetch('/api/system/status');
      const data = await res.json();
      const statusText = document.getElementById('system-status-text');
      if (statusText && data.status === 'online') {
        statusText.textContent = `AI/ML Ready • ${data.database_mode.includes('MySQL') ? 'MySQL DB' : 'Embedded DB'}`;
      }
    } catch (e) {
      console.warn('System status ping failed:', e);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.traffiqApp = new AppController();
});
