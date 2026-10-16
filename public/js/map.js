/**
 * TraffIQ Interactive Leaflet Map & Smart Route Recommendation
 */

class TraffIQMapManager {
  constructor() {
    this.map = null;
    this.routeLayers = [];
    this.markerLayers = [];
    this.incidentMarkers = [];
    this.emergencyMarkers = [];
    this.activeRouteIndex = 0;
    this.currentRoutesData = null;
    this.simulationMarker = null;
    this.simulationInterval = null;

    this.initMap();
    this.bindEvents();
    this.loadInitialRoutes();
    this.refreshMapMarkers();
  }

  initMap() {
    // Default center on metropolitan area (Bangalore coordinates)
    this.map = L.map('traffic-map', {
      zoomControl: true,
      attributionControl: false
    }).setView([12.9716, 77.5946], 12);

    // CartoDB Dark Matter Tiles (Clean, modern dark map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.map);
  }

  bindEvents() {
    const routeForm = document.getElementById('route-form');
    if (routeForm) {
      routeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.fetchRoutes();
      });
    }

    const swapBtn = document.getElementById('btn-swap-locations');
    if (swapBtn) {
      swapBtn.addEventListener('click', () => {
        const originSelect = document.getElementById('route-origin');
        const destSelect = document.getElementById('route-destination');
        const temp = originSelect.value;
        originSelect.value = destSelect.value;
        destSelect.value = temp;
        this.fetchRoutes();
      });
    }

    const resetBtn = document.getElementById('btn-reset-map');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (this.currentRoutesData && this.currentRoutesData.routes.length > 0) {
          this.selectRoute(0);
        } else {
          this.map.setView([12.9716, 77.5946], 12);
        }
      });
    }

    const trafficLayerBtn = document.getElementById('btn-toggle-traffic-layer');
    if (trafficLayerBtn) {
      trafficLayerBtn.addEventListener('click', () => {
        if (window.showToast) window.showToast('AI Traffic Heatmap Overlay Active', 'info');
      });
    }
  }

  async loadInitialRoutes() {
    await this.fetchRoutes();
  }

  async fetchRoutes() {
    const origin = document.getElementById('route-origin').value;
    const destination = document.getElementById('route-destination').value;
    const timeVal = document.getElementById('route-time').value;
    const weather = document.getElementById('route-weather').value;

    const loader = document.getElementById('routes-loader');
    if (loader) loader.classList.remove('hidden');

    try {
      const res = await fetch('/api/routes/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          context: {
            weather,
            time_of_day: timeVal === 'current' ? new Date().getHours() : parseInt(timeVal)
          }
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        this.currentRoutesData = data.data;
        this.renderRoutesOnMap(data.data);
        this.renderRoutesList(data.data);
      }
    } catch (err) {
      console.error('Error fetching routes:', err);
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  renderRoutesOnMap(data) {
    // Clear previous routes and markers
    this.routeLayers.forEach(l => this.map.removeLayer(l));
    this.routeLayers = [];
    this.markerLayers.forEach(m => this.map.removeLayer(m));
    this.markerLayers = [];

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.simulationMarker) {
      this.map.removeLayer(this.simulationMarker);
      this.simulationMarker = null;
    }

    const bounds = L.latLngBounds([]);

    // Plot Origin and Destination Markers
    const startIcon = L.divIcon({
      className: 'origin-marker',
      html: '<div style="background:#10B981; width:22px; height:22px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px #10B981; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px;"><i class="fa-solid fa-play"></i></div>',
      iconSize: [22, 22]
    });

    const destIcon = L.divIcon({
      className: 'dest-marker',
      html: '<div style="background:#EF4444; width:24px; height:24px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px #EF4444; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px;"><i class="fa-solid fa-flag-checkered"></i></div>',
      iconSize: [24, 24]
    });

    const originMarker = L.marker([data.origin.lat, data.origin.lng], { icon: startIcon })
      .bindPopup(`<strong>Origin:</strong> ${data.origin.name}`)
      .addTo(this.map);

    const destMarker = L.marker([data.destination.lat, data.destination.lng], { icon: destIcon })
      .bindPopup(`<strong>Destination:</strong> ${data.destination.name}`)
      .addTo(this.map);

    this.markerLayers.push(originMarker, destMarker);
    bounds.extend([data.origin.lat, data.origin.lng]);
    bounds.extend([data.destination.lat, data.destination.lng]);

    // Draw route polylines
    data.routes.forEach((route, idx) => {
      const isSelected = idx === this.activeRouteIndex;
      const polyline = L.polyline(route.coordinates, {
        color: route.color,
        weight: isSelected ? 6 : 4,
        opacity: isSelected ? 0.95 : 0.45,
        smoothFactor: 1
      }).addTo(this.map);

      polyline.on('click', () => this.selectRoute(idx));
      polyline.bindPopup(`
        <div style="padding:4px;">
          <h4 style="margin:0 0 4px 0; font-size:13px; font-weight:700;">${route.name}</h4>
          <p style="margin:0; font-size:12px;">ETA: <strong>${route.travel_time_mins} mins</strong> (${route.distance_km} km)</p>
          <p style="margin:2px 0 0 0; font-size:11px; color:#94A3B8;">Congestion: <strong>${route.predicted_congestion}</strong></p>
        </div>
      `);

      this.routeLayers.push(polyline);
      route.coordinates.forEach(pt => bounds.extend(pt));
    });

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  renderRoutesList(data) {
    const container = document.getElementById('routes-results-list');
    if (!container) return;

    container.innerHTML = data.routes.map((route, idx) => {
      const isSelected = idx === this.activeRouteIndex;
      let badgeHtml = '';
      if (route.is_recommended) {
        badgeHtml = `<span class="route-badge badge-recommended"><i class="fa-solid fa-award"></i> ${route.recommendation_tag}</span>`;
      } else if (route.traffic_delay_mins > 8) {
        badgeHtml = `<span class="route-badge badge-delay"><i class="fa-solid fa-triangle-exclamation"></i> +${route.traffic_delay_mins}m Delay</span>`;
      }

      let evNoteHtml = '';
      if (route.has_emergency_vehicle) {
        evNoteHtml = `<div class="route-pill text-rose" style="width:100%; margin-top:4px;"><i class="fa-solid fa-truck-medical"></i> ${route.emergency_vehicle_note}</div>`;
      }

      return `
        <div class="route-card ${isSelected ? 'active-route' : ''} ${route.is_recommended ? 'is-recommended' : ''}" 
             onclick="window.TraffIQMap.selectRoute(${idx})" 
             style="border-left-color: ${route.color};">
          ${badgeHtml}
          <div class="route-title-row">
            <span class="route-title">${route.name}</span>
            <span class="route-eta" style="color:${route.color};">${route.travel_time_mins} <span style="font-size:0.85rem; font-weight:500;">mins</span></span>
          </div>
          <div class="route-via">${route.via}</div>
          <div class="route-meta-pills">
            <span class="route-pill"><i class="fa-solid fa-road"></i> ${route.distance_km} km</span>
            <span class="route-pill"><i class="fa-solid fa-gauge-high"></i> ~${route.avg_speed_kmh} km/h</span>
            <span class="route-pill" style="color:${route.color};"><i class="fa-solid fa-circle"></i> ${route.predicted_congestion} Congestion</span>
            <span class="route-pill"><i class="fa-solid fa-leaf text-emerald"></i> Eco: ${route.eco_rating}</span>
            ${evNoteHtml}
          </div>
          ${isSelected ? `
            <button class="btn btn-primary btn-sm route-sim-btn" onclick="event.stopPropagation(); window.TraffIQMap.startRouteSimulation(${idx});">
              <i class="fa-solid fa-car"></i> Start Turn-by-Turn Simulation
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  selectRoute(idx) {
    this.activeRouteIndex = idx;
    if (!this.currentRoutesData) return;

    this.routeLayers.forEach((layer, i) => {
      const isSelected = i === idx;
      layer.setStyle({
        weight: isSelected ? 6 : 4,
        opacity: isSelected ? 0.95 : 0.45
      });
      if (isSelected) layer.bringToFront();
    });

    this.renderRoutesList(this.currentRoutesData);

    const route = this.currentRoutesData.routes[idx];
    if (route) {
      const bounds = L.latLngBounds(route.coordinates);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  startRouteSimulation(routeIndex) {
    if (!this.currentRoutesData || !this.currentRoutesData.routes[routeIndex]) return;
    const route = this.currentRoutesData.routes[routeIndex];
    const points = route.coordinates;

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.simulationMarker) {
      this.map.removeLayer(this.simulationMarker);
    }

    const carIcon = L.divIcon({
      className: 'sim-car-marker',
      html: '<div style="background:#3B82F6; width:28px; height:28px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 12px #3B82F6; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;"><i class="fa-solid fa-car"></i></div>',
      iconSize: [28, 28]
    });

    let currentStep = 0;
    this.simulationMarker = L.marker(points[0], { icon: carIcon }).addTo(this.map);
    this.simulationMarker.bindPopup(`<strong>Simulating Commute:</strong> ${route.name}`).openPopup();

    if (window.showToast) {
      window.showToast(`Navigating ${route.name} (${route.travel_time_mins} mins ETA)`, 'info');
    }

    this.simulationInterval = setInterval(() => {
      currentStep++;
      if (currentStep >= points.length) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
        if (window.showToast) {
          window.showToast(`Destination reached via ${route.name}!`, 'success');
        }
        return;
      }
      this.simulationMarker.setLatLng(points[currentStep]);
      this.map.panTo(points[currentStep]);
    }, 1200);
  }

  async refreshMapMarkers() {
    try {
      const [incidentsRes, vehiclesRes] = await Promise.all([
        fetch('/api/incidents').then(r => r.json()),
        fetch('/api/emergency-vehicles').then(r => r.json())
      ]);

      // Clear previous incident and emergency markers
      this.incidentMarkers.forEach(m => this.map.removeLayer(m));
      this.incidentMarkers = [];
      this.emergencyMarkers.forEach(m => this.map.removeLayer(m));
      this.emergencyMarkers = [];

      // Incidents markers
      if (incidentsRes.success && incidentsRes.incidents) {
        incidentsRes.incidents.forEach(inc => {
          let iconHtml = '<i class="fa-solid fa-triangle-exclamation text-amber"></i>';
          let borderCol = '#F59E0B';
          if (inc.incident_type === 'Accident') {
            iconHtml = '<i class="fa-solid fa-car-burst text-rose"></i>';
            borderCol = '#EF4444';
          } else if (inc.incident_type === 'Roadwork') {
            iconHtml = '<i class="fa-solid fa-person-digging text-amber"></i>';
          } else if (inc.incident_type === 'Waterlogging') {
            iconHtml = '<i class="fa-solid fa-water text-blue"></i>';
            borderCol = '#3B82F6';
          }

          const incIcon = L.divIcon({
            className: 'incident-marker-icon',
            html: `<div style="background:#1E293B; width:26px; height:26px; border-radius:50%; border:2px solid ${borderCol}; display:flex; align-items:center; justify-content:center; font-size:12px; box-shadow:0 0 8px rgba(0,0,0,0.5);">${iconHtml}</div>`,
            iconSize: [26, 26]
          });

          const m = L.marker([inc.latitude, inc.longitude], { icon: incIcon })
            .bindPopup(`
              <div style="font-size:12px;">
                <strong>${inc.title}</strong><br>
                <span style="color:#94A3B8;">${inc.road_name}</span><br>
                <span>Severity: <strong>${inc.severity}</strong> • Upvotes: <strong>${inc.upvotes}</strong></span>
              </div>
            `)
            .addTo(this.map);

          this.incidentMarkers.push(m);
        });
      }

      // Emergency vehicles radar markers
      if (vehiclesRes.success && vehiclesRes.vehicles) {
        vehiclesRes.vehicles.forEach(ev => {
          if (!ev.active) return;
          const evIcon = L.divIcon({
            className: 'ev-radar-marker',
            html: `
              <div class="custom-radar-marker">
                <span class="radar-ring"></span>
                <div style="background:#EF4444; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px;">
                  <i class="fa-solid fa-truck-medical"></i>
                </div>
              </div>
            `,
            iconSize: [32, 32]
          });

          const m = L.marker([ev.latitude, ev.longitude], { icon: evIcon })
            .bindPopup(`
              <div style="font-size:12px;">
                <strong style="color:#EF4444;"><i class="fa-solid fa-truck-medical"></i> ${ev.vehicle_code} (${ev.vehicle_type})</strong><br>
                <span>Corridor: <strong>${ev.current_route}</strong></span><br>
                <span>Speed: <strong>${ev.speed_kmh} km/h</strong></span><br>
                <span>Destination: <strong>${ev.destination}</strong></span>
              </div>
            `)
            .addTo(this.map);

          this.emergencyMarkers.push(m);
        });
      }
    } catch (err) {
      console.error('Error refreshing map markers:', err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.TraffIQMap = new TraffIQMapManager();
});
