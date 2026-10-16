/**
 * TraffIQ AI Congestion Predictor Playground
 * Interactive UI connecting to the trained Random Forest Machine Learning Model
 */

class CongestionPredictor {
  constructor() {
    this.initElements();
    this.bindEvents();
    // Run initial prediction
    this.runPrediction();
  }

  initElements() {
    // Form Inputs
    this.roadTypeSelect = document.getElementById('p-road-type');
    this.weatherSelect = document.getElementById('p-weather');
    this.dayOfWeekSelect = document.getElementById('p-day-of-week');
    this.incidentSelect = document.getElementById('p-incident');
    this.emergencyCheck = document.getElementById('p-emergency-active');

    // Sliders
    this.volSlider = document.getElementById('p-traffic-volume');
    this.speedSlider = document.getElementById('p-avg-speed');
    this.timeSlider = document.getElementById('p-time-of-day');

    // Value Badges
    this.volVal = document.getElementById('val-traffic-volume');
    this.speedVal = document.getElementById('val-avg-speed');
    this.timeVal = document.getElementById('val-time-of-day');

    // Output UI
    this.heroBox = document.getElementById('prediction-hero-box');
    this.heroLabel = document.getElementById('pred-pill-label');
    this.heroConf = document.getElementById('pred-confidence-text');

    this.barLow = document.getElementById('bar-low');
    this.barMod = document.getElementById('bar-mod');
    this.barHigh = document.getElementById('bar-high');

    this.probLowVal = document.getElementById('prob-low-val');
    this.probModVal = document.getElementById('prob-mod-val');
    this.probHighVal = document.getElementById('prob-high-val');

    this.factorVC = document.getElementById('factor-vc');
    this.factorSpeed = document.getElementById('factor-speed');
    this.factorIncident = document.getElementById('factor-incident');
    this.factorWeather = document.getElementById('factor-weather');
    this.adviceText = document.getElementById('advice-text');

    this.predictBtn = document.getElementById('btn-predict-now');
  }

  bindEvents() {
    // Sliders live text update
    this.volSlider.addEventListener('input', () => {
      this.volVal.textContent = Number(this.volSlider.value).toLocaleString();
      this.runPrediction();
    });

    this.speedSlider.addEventListener('input', () => {
      this.speedVal.textContent = `${this.speedSlider.value} km/h`;
      this.runPrediction();
    });

    this.timeSlider.addEventListener('input', () => {
      const h = parseInt(this.timeSlider.value);
      let desc = 'Night';
      if (h >= 8 && h <= 10) desc = 'Morning Peak';
      else if (h >= 11 && h <= 16) desc = 'Mid-day Offpeak';
      else if (h >= 17 && h <= 20) desc = 'Evening Peak';
      this.timeVal.textContent = `${h.toString().padStart(2, '0')}:00 (${desc})`;
      this.runPrediction();
    });

    // Select change listeners
    [this.roadTypeSelect, this.weatherSelect, this.dayOfWeekSelect, this.incidentSelect, this.emergencyCheck].forEach(el => {
      if (el) el.addEventListener('change', () => this.runPrediction());
    });

    if (this.predictBtn) {
      this.predictBtn.addEventListener('click', () => {
        this.runPrediction();
        if (window.showToast) window.showToast('ML Model classified traffic condition!', 'success');
      });
    }
  }

  async runPrediction() {
    const payload = {
      road_type: this.roadTypeSelect.value,
      traffic_volume: parseFloat(this.volSlider.value),
      avg_speed: parseFloat(this.speedSlider.value),
      time_of_day: parseInt(this.timeSlider.value),
      day_of_week: parseInt(this.dayOfWeekSelect.value),
      weather: this.weatherSelect.value,
      incident_reported: parseInt(this.incidentSelect.value),
      emergency_vehicle_active: this.emergencyCheck.checked ? 1 : 0
    };

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.prediction) {
        this.renderPrediction(data.prediction);
      }
    } catch (err) {
      console.error('Prediction API error:', err);
    }
  }

  renderPrediction(pred) {
    const level = pred.predicted_congestion;
    const confPercent = (pred.confidence * 100).toFixed(1);

    this.heroLabel.textContent = `${level.toUpperCase()} CONGESTION`;
    this.heroConf.textContent = `${confPercent}% Confidence`;

    // Style hero box based on level
    if (level === 'Low') {
      this.heroBox.style.background = 'rgba(16, 185, 129, 0.12)';
      this.heroBox.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      this.heroLabel.style.color = '#10B981';
    } else if (level === 'Moderate') {
      this.heroBox.style.background = 'rgba(245, 158, 11, 0.12)';
      this.heroBox.style.borderColor = 'rgba(245, 158, 11, 0.35)';
      this.heroLabel.style.color = '#F59E0B';
    } else {
      this.heroBox.style.background = 'rgba(239, 68, 68, 0.15)';
      this.heroBox.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      this.heroLabel.style.color = '#EF4444';
    }

    // Probabilities
    const pLow = (pred.probabilities.Low * 100).toFixed(1);
    const pMod = (pred.probabilities.Moderate * 100).toFixed(1);
    const pHigh = (pred.probabilities.High * 100).toFixed(1);

    this.probLowVal.textContent = `${pLow}%`;
    this.probModVal.textContent = `${pMod}%`;
    this.probHighVal.textContent = `${pHigh}%`;

    this.barLow.style.width = `${pLow}%`;
    this.barMod.style.width = `${pMod}%`;
    this.barHigh.style.width = `${pHigh}%`;

    // Explainability
    this.factorVC.textContent = `${pred.volume_capacity_ratio} (${pred.volume_capacity_ratio > 0.85 ? 'High Demand' : 'Normal Flow'})`;
    const speedRatio = Math.round((pred.inputs.avg_speed / (pred.inputs.road_type === 'Highway' ? 90 : 60)) * 100);
    this.factorSpeed.textContent = `${speedRatio}% of Road Limit`;

    const incMap = {
      0: 'None (0 pts)',
      1: 'Minor Collision (+7 pts)',
      2: 'Major Collision (+18 pts)',
      3: 'Roadwork (+12 pts)',
      4: 'Hazard (+10 pts)'
    };
    this.factorIncident.textContent = incMap[pred.inputs.incident_reported] || 'None';

    const wMap = {
      Clear: 'Clear (+0 pts)',
      Cloudy: 'Overcast (+2 pts)',
      Rainy: 'Rain Impact (+6 pts)',
      'Heavy Rain': 'Monsoon (+14 pts)',
      Foggy: 'Visibility Drag (+8 pts)'
    };
    this.factorWeather.textContent = wMap[pred.inputs.weather] || 'Clear';

    this.adviceText.textContent = pred.recommendation;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.traffiqPredictor = new CongestionPredictor();
});
