/**
 * TraffIQ REST API Router
 */

const express = require('express');
const router = express.Router();
const mlPredictor = require('../services/mlPredictor');
const routeRecommender = require('../services/routeRecommender');
const db = require('../database/db');

// 1. Health & System Status
router.get('/system/status', (req, res) => {
  res.json({
    status: 'online',
    system: 'TraffIQ Intelligent Traffic Assistance System',
    version: '1.0.0',
    database_mode: db.isUsingMySQL() ? 'MySQL Enterprise Database' : 'Persistent Storage Engine',
    ml_model: 'Scikit-Learn Random Forest Classifier',
    timestamp: new Date().toISOString()
  });
});

// 2. ML Prediction Endpoint
router.post('/predict', async (req, res) => {
  try {
    const inputs = req.body || {};
    const prediction = mlPredictor.predict(inputs);

    // Persist prediction into database
    await db.savePrediction({
      road_type: inputs.road_type || 'Highway',
      traffic_volume: inputs.traffic_volume || 1200,
      avg_speed: inputs.avg_speed || 45,
      time_of_day: inputs.time_of_day || 14,
      day_of_week: inputs.day_of_week || 2,
      weather: inputs.weather || 'Clear',
      incident_reported: inputs.incident_reported || 0,
      emergency_vehicle: inputs.emergency_vehicle_active || 0,
      predicted_congestion: prediction.predicted_congestion,
      confidence: prediction.confidence,
      probabilities: prediction.probabilities
    });

    res.json({
      success: true,
      prediction
    });
  } catch (err) {
    console.error('Prediction error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute traffic prediction' });
  }
});

// 3. ML Model Metrics & Academic Evaluation Data
router.get('/model/metrics', (req, res) => {
  try {
    const metrics = mlPredictor.getModelMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Route Recommendation Engine
router.post('/routes/recommend', async (req, res) => {
  try {
    const { origin, destination, context } = req.body || {};
    const recommendation = await routeRecommender.recommendRoutes(origin, destination, context || {});
    res.json({
      success: true,
      data: recommendation
    });
  } catch (err) {
    console.error('Route recommendation error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute route recommendations' });
  }
});

// 5. Available Landmarks / Locations
router.get('/landmarks', (req, res) => {
  res.json({
    success: true,
    landmarks: routeRecommender.LANDMARKS
  });
});

// 6. Monitored Road Segments
router.get('/roads', async (req, res) => {
  try {
    const roads = await db.getRoads();
    res.json({
      success: true,
      roads
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Community Incidents & Reports
router.get('/incidents', async (req, res) => {
  try {
    const incidents = await db.getIncidents(req.query.status);
    res.json({
      success: true,
      incidents
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Submit Incident Report
router.post('/incidents', async (req, res) => {
  try {
    const { title, incident_type, severity, road_name, latitude, longitude, description, reporter_name } = req.body;

    if (!title || !incident_type) {
      return res.status(400).json({ success: false, error: 'Title and incident type are required' });
    }

    const created = await db.addIncident({
      title,
      incident_type,
      severity,
      road_name,
      latitude,
      longitude,
      description,
      reporter_name
    });

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully. Thank you for contributing to safer roads!',
      incident: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Upvote Incident Report
router.post('/incidents/:id/upvote', async (req, res) => {
  try {
    const updated = await db.upvoteIncident(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }
    res.json({
      success: true,
      upvotes: updated.upvotes,
      incident: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Admin Moderate Incident Status
router.patch('/incidents/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Reported', 'Verified', 'Resolved', 'Dismissed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const updated = await db.updateIncidentStatus(req.params.id, status);
    res.json({
      success: true,
      incident: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Alerts & Announcements
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await db.getAlerts();
    res.json({
      success: true,
      alerts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Create Alert (Admin)
router.post('/alerts', async (req, res) => {
  try {
    const { title, message, alert_type, priority } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required' });
    }
    const alert = await db.addAlert({ title, message, alert_type, priority });
    res.status(201).json({
      success: true,
      alert
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Delete Alert (Admin)
router.delete('/alerts/:id', async (req, res) => {
  try {
    await db.deleteAlert(req.params.id);
    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Emergency Vehicles Tracking
router.get('/emergency-vehicles', async (req, res) => {
  try {
    const vehicles = await db.getEmergencyVehicles();
    res.json({
      success: true,
      vehicles
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Simulate Emergency Vehicle Movement / Awareness Alert
router.post('/emergency-vehicles/simulate', async (req, res) => {
  try {
    const { vehicle_code, route_name } = req.body;
    const targetCode = vehicle_code || 'AMB-108';

    // Move slightly along the corridor
    const latDelta = (Math.random() - 0.5) * 0.005;
    const lngDelta = (Math.random() - 0.5) * 0.005;

    const vehicles = await db.getEmergencyVehicles();
    const curr = vehicles.find(v => v.vehicle_code === targetCode) || {
      latitude: 12.9620,
      longitude: 77.6380,
      speed_kmh: 65.0
    };

    const newLat = Math.round((curr.latitude + latDelta) * 10000) / 10000;
    const newLng = Math.round((curr.longitude + lngDelta) * 10000) / 10000;

    const updated = await db.updateEmergencyVehicle(targetCode, {
      latitude: newLat,
      longitude: newLng,
      speed_kmh: Math.round(55 + Math.random() * 20),
      current_route: route_name || curr.current_route
    });

    res.json({
      success: true,
      message: `Emergency vehicle ${targetCode} dispatched along corridor. Audible alert triggered.`,
      vehicle: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Admin Authentication
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if ((username === 'admin' && password === 'traffiq2026') || (username === 'admin' && password === 'admin123')) {
    return res.json({
      success: true,
      token: 'traffiq-admin-auth-session-token',
      user: {
        username: 'admin',
        role: 'Administrator',
        permissions: ['moderate_incidents', 'broadcast_alerts', 'view_metrics']
      }
    });
  }
  res.status(401).json({
    success: false,
    error: 'Invalid administrator credentials. (Default: admin / traffiq2026)'
  });
});

// 17. Prediction History
router.get('/predictions/history', async (req, res) => {
  try {
    const history = await db.getPredictionHistory(15);
    res.json({
      success: true,
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
