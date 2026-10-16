"""
TraffIQ - Standalone Python Inference CLI
Predicts traffic congestion category given road and environmental parameters.
Usage:
    python ml/predict.py --volume 2100 --speed 35 --road Highway --time 18 --weather Rainy --incident 1
"""

import os
import sys
import argparse
import json
import joblib
import pandas as pd

def predict_congestion(params):
    model_path = os.path.join(os.path.dirname(__file__), "model.joblib")
    feature_cols_path = os.path.join(os.path.dirname(__file__), "feature_cols.joblib")
    
    if not os.path.exists(model_path) or not os.path.exists(feature_cols_path):
        raise FileNotFoundError("Trained model files not found. Run ml/train_model.py first.")
        
    model = joblib.load(model_path)
    feature_cols = joblib.load(feature_cols_path)
    
    # Capacities map
    capacities = {
        "Highway": 3000,
        "Arterial": 1800,
        "Urban": 1200,
        "Residential": 600
    }
    
    road_type = params.get("road_type", "Highway")
    capacity = capacities.get(road_type, 2000)
    traffic_volume = float(params.get("traffic_volume", 1500))
    time_of_day = int(params.get("time_of_day", 14))
    day_of_week = int(params.get("day_of_week", 2))
    is_weekend = 1 if day_of_week >= 5 else 0
    avg_speed = float(params.get("avg_speed", 45))
    weather = params.get("weather", "Clear")
    incident_reported = int(params.get("incident_reported", 0))
    emergency_vehicle = int(params.get("emergency_vehicle_active", 0))
    v_c = traffic_volume / capacity
    
    # Build single-row DataFrame
    input_dict = {
        "time_of_day": [time_of_day],
        "day_of_week": [day_of_week],
        "is_weekend": [is_weekend],
        "road_capacity": [capacity],
        "traffic_volume": [traffic_volume],
        "avg_speed": [avg_speed],
        "incident_reported": [incident_reported],
        "emergency_vehicle_active": [emergency_vehicle],
        "volume_capacity_ratio": [v_c],
        "road_type": [road_type],
        "weather": [weather]
    }
    
    df_single = pd.DataFrame(input_dict)
    df_encoded = pd.get_dummies(df_single, columns=["road_type", "weather"])
    
    # Align columns with training feature columns
    for col in feature_cols:
        if col not in df_encoded.columns:
            df_encoded[col] = 0
    df_aligned = df_encoded[feature_cols]
    
    pred_class_idx = int(model.predict(df_aligned)[0])
    probabilities = model.predict_proba(df_aligned)[0]
    
    class_map = {0: "Low", 1: "Moderate", 2: "High"}
    result = {
        "predicted_class": class_map.get(pred_class_idx, "Unknown"),
        "congestion_index": pred_class_idx,
        "confidence": round(float(probabilities[pred_class_idx]), 4),
        "probabilities": {
            "Low": round(float(probabilities[0]), 4),
            "Moderate": round(float(probabilities[1]), 4),
            "High": round(float(probabilities[2]), 4)
        },
        "inputs": {
            "road_type": road_type,
            "traffic_volume": traffic_volume,
            "avg_speed": avg_speed,
            "time_of_day": time_of_day,
            "weather": weather,
            "incident_reported": incident_reported,
            "emergency_vehicle": emergency_vehicle,
            "volume_capacity_ratio": round(v_c, 2)
        }
    }
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TraffIQ Traffic Congestion Prediction")
    parser.add_argument("--volume", type=float, default=2100, help="Traffic volume (vehicles/hour)")
    parser.add_argument("--speed", type=float, default=32.0, help="Average speed (km/h)")
    parser.add_argument("--road", type=str, default="Highway", choices=["Highway", "Arterial", "Urban", "Residential"])
    parser.add_argument("--time", type=int, default=18, help="Hour of the day (0-23)")
    parser.add_argument("--dow", type=int, default=3, help="Day of week (0=Mon, 6=Sun)")
    parser.add_argument("--weather", type=str, default="Rainy", choices=["Clear", "Cloudy", "Rainy", "Heavy Rain", "Foggy"])
    parser.add_argument("--incident", type=int, default=1, help="Incident code (0-4)")
    parser.add_argument("--emergency", type=int, default=0, help="Emergency vehicle active (0 or 1)")
    
    args = parser.parse_args()
    params = {
        "traffic_volume": args.volume,
        "avg_speed": args.speed,
        "road_type": args.road,
        "time_of_day": args.time,
        "day_of_week": args.dow,
        "weather": args.weather,
        "incident_reported": args.incident,
        "emergency_vehicle_active": args.emergency
    }
    output = predict_congestion(params)
    print(json.dumps(output, indent=2))
