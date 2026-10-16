"""
TraffIQ - Synthetic Historical Traffic Dataset Generator
Generates realistic traffic sensor and mobility data across urban corridors
"""

import numpy as np
import pandas as pd
import os

def generate_traffic_dataset(num_samples=6000, random_seed=42):
    np.random.seed(random_seed)

    road_types = ["Highway", "Arterial", "Urban", "Residential"]
    weather_conditions = ["Clear", "Cloudy", "Rainy", "Heavy Rain", "Foggy"]
    
    capacities = {
        "Highway": 3000,
        "Arterial": 1800,
        "Urban": 1200,
        "Residential": 600
    }
    
    speed_limits = {
        "Highway": 90,
        "Arterial": 60,
        "Urban": 45,
        "Residential": 30
    }

    # Generate synthetic samples
    hours = np.random.randint(0, 24, size=num_samples)
    days_of_week = np.random.randint(0, 7, size=num_samples)  # 0=Monday, 6=Sunday
    is_weekend = (days_of_week >= 5).astype(int)
    
    # Peak hours: Morning (8-10) and Evening (17-20) on weekdays; Weekend afternoons (12-16)
    is_morning_peak = ((hours >= 8) & (hours <= 10) & (is_weekend == 0)).astype(int)
    is_evening_peak = ((hours >= 17) & (hours <= 20) & (is_weekend == 0)).astype(int)
    is_weekend_rush = ((hours >= 12) & (hours <= 16) & (is_weekend == 1)).astype(int)
    
    road_choice = np.random.choice(road_types, size=num_samples, p=[0.35, 0.35, 0.20, 0.10])
    weather_choice = np.random.choice(weather_conditions, size=num_samples, p=[0.55, 0.20, 0.15, 0.06, 0.04])
    
    incident_types = [0, 1, 2, 3, 4]  # 0: None, 1: Minor Accident, 2: Major Accident, 3: Roadwork, 4: Hazard
    incident_reported = np.random.choice(incident_types, size=num_samples, p=[0.80, 0.08, 0.03, 0.06, 0.03])
    
    emergency_vehicle = np.random.choice([0, 1], size=num_samples, p=[0.94, 0.06])
    
    data = []
    
    for i in range(num_samples):
        r_type = road_choice[i]
        cap = capacities[r_type]
        base_speed = speed_limits[r_type]
        hr = hours[i]
        dow = days_of_week[i]
        w = weather_choice[i]
        inc = incident_reported[i]
        emv = emergency_vehicle[i]
        
        # Calculate volume demand factor based on time and road type
        demand_factor = 0.25 # baseline late night
        if is_morning_peak[i] or is_evening_peak[i]:
            demand_factor = np.random.uniform(0.75, 1.15)
        elif 11 <= hr <= 16:
            demand_factor = np.random.uniform(0.50, 0.80)
        elif 6 <= hr <= 7 or 21 <= hr <= 22:
            demand_factor = np.random.uniform(0.35, 0.65)
        elif is_weekend_rush[i]:
            demand_factor = np.random.uniform(0.65, 0.95)
        else:
            demand_factor = np.random.uniform(0.15, 0.40)
            
        traffic_vol = int(np.clip(cap * demand_factor + np.random.normal(0, cap * 0.05), 50, cap * 1.3))
        
        # Weather impact factor on speed
        weather_speed_mult = 1.0
        if w == "Rainy":
            weather_speed_mult = 0.85
        elif w == "Heavy Rain":
            weather_speed_mult = 0.65
        elif w == "Foggy":
            weather_speed_mult = 0.70
        elif w == "Cloudy":
            weather_speed_mult = 0.95
            
        # Incident impact factor
        incident_speed_mult = 1.0
        if inc == 1: # Minor
            incident_speed_mult = 0.75
        elif inc == 2: # Major
            incident_speed_mult = 0.40
        elif inc == 3: # Roadwork
            incident_speed_mult = 0.60
        elif inc == 4: # Hazard
            incident_speed_mult = 0.55
            
        # Volume-to-Capacity ratio
        v_c = traffic_vol / cap
        
        # Speed drops sharply as v_c exceeds 0.8 (Greenshields/BPR traffic flow relationship)
        speed_flow_mult = max(0.20, 1.0 - (0.75 * (v_c ** 2.2)))
        avg_speed = base_speed * speed_flow_mult * weather_speed_mult * incident_speed_mult
        avg_speed = round(max(8.0, avg_speed + np.random.normal(0, 3)), 1)
        
        # Determine Congestion Class (Ground truth label):
        # 0: Low, 1: Moderate, 2: High
        congestion_score = (v_c * 50) + ((1.0 - (avg_speed / base_speed)) * 40)
        if inc > 0:
            congestion_score += (inc * 6)
        if w in ["Rainy", "Foggy"]:
            congestion_score += 8
        elif w == "Heavy Rain":
            congestion_score += 15
            
        if congestion_score < 45:
            congestion_label = 0  # Low
        elif congestion_score < 75:
            congestion_label = 1  # Moderate
        else:
            congestion_label = 2  # High
            
        data.append({
            "time_of_day": hr,
            "day_of_week": dow,
            "is_weekend": is_weekend[i],
            "road_type": r_type,
            "road_capacity": cap,
            "traffic_volume": traffic_vol,
            "avg_speed": avg_speed,
            "weather": w,
            "incident_reported": inc,
            "emergency_vehicle_active": emv,
            "volume_capacity_ratio": round(v_c, 3),
            "congestion_level": congestion_label
        })
        
    df = pd.DataFrame(data)
    
    os.makedirs("data", exist_ok=True)
    csv_path = os.path.join("data", "traffic_dataset.csv")
    df.to_csv(csv_path, index=False)
    print(f"Dataset generated successfully with {len(df)} samples at {csv_path}")
    print("\nClass distribution:")
    print(df["congestion_level"].value_counts(normalize=True).round(3))
    return df

if __name__ == "__main__":
    generate_traffic_dataset()
