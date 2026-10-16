/**
 * TraffIQ Database Layer
 * Dual-Engine: Connects to MySQL when credentials are provided,
 * otherwise gracefully uses the local persistent JSON data store.
 */

const fs = require('fs');
const path = require('path');

let mysqlPool = null;
let useMySQL = false;

// Check if MySQL env vars are present
if (process.env.MYSQL_HOST && process.env.MYSQL_USER) {
  try {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'traffiq_db',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    useMySQL = true;
    console.log('TraffIQ: Configured MySQL database pool connection.');
  } catch (err) {
    console.warn('TraffIQ: MySQL module not available or connection failed. Using JSON store fallback.', err.message);
    useMySQL = false;
  }
}

// In-Memory / File-based Store fallback
const DATA_FILE = path.join(__dirname, '..', 'data', 'traffiq_store.json');
const DEFAULT_DATA_FILE = path.join(__dirname, '..', 'data', 'default_store.json');

function loadLocalStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } else if (fs.existsSync(DEFAULT_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DEFAULT_DATA_FILE, 'utf8'));
      // attempt to persist if writable
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      } catch (e) {
        // Vercel serverless /tmp or read-only filesystem handling
      }
      return data;
    }
  } catch (err) {
    console.error('Error reading JSON store:', err);
  }
  return {
    roads: [],
    incidents: [],
    alerts: [],
    emergency_vehicles: [],
    predictions_history: []
  };
}

let memoryStore = loadLocalStore();

function saveLocalStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2));
  } catch (err) {
    // In serverless environments, writing to disk might fail silently or /tmp can be used
  }
}

// DB Methods
async function getRoads() {
  if (useMySQL) {
    try {
      const [rows] = await mysqlPool.query('SELECT * FROM roads ORDER BY id ASC');
      return rows.map(r => ({
        ...r,
        coordinates: typeof r.coordinates_json === 'string' ? JSON.parse(r.coordinates_json) : r.coordinates_json
      }));
    } catch (err) {
      console.warn('MySQL getRoads error, using fallback:', err.message);
    }
  }
  return memoryStore.roads || [];
}

async function getRoadById(id) {
  const roads = await getRoads();
  return roads.find(r => r.id === parseInt(id) || r.road_code === id);
}

async function getIncidents(statusFilter = null) {
  if (useMySQL) {
    try {
      let query = 'SELECT * FROM incidents';
      const params = [];
      if (statusFilter) {
        query += ' WHERE status = ?';
        params.push(statusFilter);
      }
      query += ' ORDER BY created_at DESC';
      const [rows] = await mysqlPool.query(query, params);
      return rows;
    } catch (err) {
      console.warn('MySQL getIncidents error, using fallback:', err.message);
    }
  }
  let list = memoryStore.incidents || [];
  if (statusFilter) {
    list = list.filter(item => item.status === statusFilter);
  }
  return list;
}

async function addIncident(data) {
  const newIncident = {
    id: Date.now(),
    title: data.title || 'Reported Incident',
    incident_type: data.incident_type || 'Accident',
    severity: data.severity || 'Medium',
    road_name: data.road_name || 'Urban Arterial',
    latitude: parseFloat(data.latitude) || 12.9716,
    longitude: parseFloat(data.longitude) || 77.5946,
    description: data.description || '',
    reporter_name: data.reporter_name || 'Community Member',
    status: 'Reported',
    upvotes: 1,
    created_at: new Date().toISOString()
  };

  if (useMySQL) {
    try {
      const [result] = await mysqlPool.query(
        `INSERT INTO incidents (title, incident_type, severity, road_name, latitude, longitude, description, reporter_name, status, upvotes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newIncident.title,
          newIncident.incident_type,
          newIncident.severity,
          newIncident.road_name,
          newIncident.latitude,
          newIncident.longitude,
          newIncident.description,
          newIncident.reporter_name,
          newIncident.status,
          newIncident.upvotes
        ]
      );
      newIncident.id = result.insertId;
      return newIncident;
    } catch (err) {
      console.warn('MySQL addIncident error, falling back to memory store:', err.message);
    }
  }

  memoryStore.incidents.unshift(newIncident);
  saveLocalStore();
  return newIncident;
}

async function upvoteIncident(id) {
  const incidentId = parseInt(id);
  if (useMySQL) {
    try {
      await mysqlPool.query('UPDATE incidents SET upvotes = upvotes + 1 WHERE id = ?', [incidentId]);
      const [rows] = await mysqlPool.query('SELECT * FROM incidents WHERE id = ?', [incidentId]);
      return rows[0];
    } catch (err) {
      console.warn('MySQL upvoteIncident error:', err.message);
    }
  }

  const incident = memoryStore.incidents.find(i => i.id === incidentId);
  if (incident) {
    incident.upvotes = (incident.upvotes || 0) + 1;
    saveLocalStore();
  }
  return incident;
}

async function updateIncidentStatus(id, status) {
  const incidentId = parseInt(id);
  if (useMySQL) {
    try {
      await mysqlPool.query('UPDATE incidents SET status = ? WHERE id = ?', [status, incidentId]);
      const [rows] = await mysqlPool.query('SELECT * FROM incidents WHERE id = ?', [incidentId]);
      return rows[0];
    } catch (err) {
      console.warn('MySQL updateIncidentStatus error:', err.message);
    }
  }

  const incident = memoryStore.incidents.find(i => i.id === incidentId);
  if (incident) {
    incident.status = status;
    saveLocalStore();
  }
  return incident;
}

async function getAlerts() {
  if (useMySQL) {
    try {
      const [rows] = await mysqlPool.query('SELECT * FROM alerts WHERE active = TRUE ORDER BY created_at DESC');
      return rows;
    } catch (err) {
      console.warn('MySQL getAlerts error:', err.message);
    }
  }
  return (memoryStore.alerts || []).filter(a => a.active !== false);
}

async function addAlert(data) {
  const newAlert = {
    id: Date.now(),
    title: data.title,
    message: data.message,
    alert_type: data.alert_type || 'Emergency',
    priority: data.priority || 'Normal',
    active: true,
    created_at: new Date().toISOString()
  };

  if (useMySQL) {
    try {
      const [result] = await mysqlPool.query(
        'INSERT INTO alerts (title, message, alert_type, priority, active) VALUES (?, ?, ?, ?, ?)',
        [newAlert.title, newAlert.message, newAlert.alert_type, newAlert.priority, true]
      );
      newAlert.id = result.insertId;
      return newAlert;
    } catch (err) {
      console.warn('MySQL addAlert error:', err.message);
    }
  }

  memoryStore.alerts.unshift(newAlert);
  saveLocalStore();
  return newAlert;
}

async function deleteAlert(id) {
  const alertId = parseInt(id);
  if (useMySQL) {
    try {
      await mysqlPool.query('DELETE FROM alerts WHERE id = ?', [alertId]);
      return true;
    } catch (err) {
      console.warn('MySQL deleteAlert error:', err.message);
    }
  }

  memoryStore.alerts = memoryStore.alerts.filter(a => a.id !== alertId);
  saveLocalStore();
  return true;
}

async function getEmergencyVehicles() {
  if (useMySQL) {
    try {
      const [rows] = await mysqlPool.query('SELECT * FROM emergency_vehicles WHERE active = TRUE');
      return rows;
    } catch (err) {
      console.warn('MySQL getEmergencyVehicles error:', err.message);
    }
  }
  return memoryStore.emergency_vehicles || [];
}

async function updateEmergencyVehicle(code, data) {
  if (useMySQL) {
    try {
      await mysqlPool.query(
        'UPDATE emergency_vehicles SET latitude = ?, longitude = ?, speed_kmh = ?, current_route = ? WHERE vehicle_code = ?',
        [data.latitude, data.longitude, data.speed_kmh, data.current_route, code]
      );
    } catch (err) {
      console.warn('MySQL updateEmergencyVehicle error:', err.message);
    }
  }

  const v = memoryStore.emergency_vehicles.find(ev => ev.vehicle_code === code);
  if (v) {
    if (data.latitude) v.latitude = data.latitude;
    if (data.longitude) v.longitude = data.longitude;
    if (data.speed_kmh) v.speed_kmh = data.speed_kmh;
    if (data.current_route) v.current_route = data.current_route;
    v.updated_at = new Date().toISOString();
    saveLocalStore();
  }
  return v;
}

async function savePrediction(predictionData) {
  const item = {
    id: Date.now(),
    ...predictionData,
    created_at: new Date().toISOString()
  };

  if (useMySQL) {
    try {
      await mysqlPool.query(
        `INSERT INTO traffic_predictions (road_type, traffic_volume, avg_speed, time_of_day, day_of_week, weather, incident_reported, emergency_vehicle, predicted_congestion, confidence, probabilities_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.road_type,
          item.traffic_volume,
          item.avg_speed,
          item.time_of_day,
          item.day_of_week,
          item.weather,
          item.incident_reported,
          item.emergency_vehicle,
          item.predicted_congestion,
          item.confidence,
          JSON.stringify(item.probabilities)
        ]
      );
    } catch (err) {
      console.warn('MySQL savePrediction error:', err.message);
    }
  }

  if (!memoryStore.predictions_history) {
    memoryStore.predictions_history = [];
  }
  memoryStore.predictions_history.unshift(item);
  if (memoryStore.predictions_history.length > 50) {
    memoryStore.predictions_history.pop();
  }
  saveLocalStore();
  return item;
}

async function getPredictionHistory(limit = 10) {
  if (useMySQL) {
    try {
      const [rows] = await mysqlPool.query('SELECT * FROM traffic_predictions ORDER BY created_at DESC LIMIT ?', [limit]);
      return rows;
    } catch (err) {
      console.warn('MySQL getPredictionHistory error:', err.message);
    }
  }
  return (memoryStore.predictions_history || []).slice(0, limit);
}

module.exports = {
  getRoads,
  getRoadById,
  getIncidents,
  addIncident,
  upvoteIncident,
  updateIncidentStatus,
  getAlerts,
  addAlert,
  deleteAlert,
  getEmergencyVehicles,
  updateEmergencyVehicle,
  savePrediction,
  getPredictionHistory,
  isUsingMySQL: () => useMySQL
};
