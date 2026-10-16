/**
 * TraffIQ ML Model Analytics & Academic Metrics
 */

class AnalyticsManager {
  constructor() {
    this.fetchMetrics();
  }

  async fetchMetrics() {
    try {
      const res = await fetch('/api/model/metrics');
      const data = await res.json();
      if (data.success && data.metrics) {
        this.renderMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Error fetching ML metrics:', err);
    }
  }

  renderMetrics(m) {
    const accEl = document.getElementById('kpi-accuracy');
    const f1El = document.getElementById('kpi-f1');
    const samplesEl = document.getElementById('kpi-samples');

    if (accEl) accEl.textContent = `${(m.accuracy * 100).toFixed(1)}%`;
    if (samplesEl && m.total_samples) samplesEl.textContent = Number(m.total_samples).toLocaleString();

    // Table body
    const tbody = document.getElementById('metrics-table-body');
    if (tbody && m.per_class) {
      let macroF1Sum = 0;
      let count = 0;

      const rows = Object.entries(m.per_class).map(([className, vals]) => {
        macroF1Sum += vals.f1_score;
        count++;
        return `
          <tr>
            <td><strong>${className}</strong></td>
            <td>${vals.precision.toFixed(2)}</td>
            <td>${vals.recall.toFixed(2)}</td>
            <td><strong>${vals.f1_score.toFixed(2)}</strong></td>
            <td>${vals.support}</td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows;

      if (f1El && count > 0) {
        f1El.textContent = (macroF1Sum / count).toFixed(2);
      }
    }

    // Top feature importances fallback list
    const featList = document.getElementById('features-list-dynamic');
    if (featList && m.feature_importances) {
      featList.innerHTML = m.feature_importances.slice(0, 8).map(f => `
        <li style="margin-bottom:6px; display:flex; justify-content:space-between; font-size:0.85rem;">
          <span>${f.feature.replace(/_/g, ' ')}</span>
          <strong>${(f.importance * 100).toFixed(1)}%</strong>
        </li>
      `).join('');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.traffiqAnalytics = new AnalyticsManager();
});
