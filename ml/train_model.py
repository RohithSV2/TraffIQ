"""
TraffIQ - Machine Learning Model Training & Evaluation Pipeline
Trains Random Forest Classifier to predict traffic congestion (Low, Moderate, High)
and compares with baseline models. Exports metrics, charts, and rules.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report
)

def train_and_evaluate():
    data_path = os.path.join("data", "traffic_dataset.csv")
    if not os.path.exists(data_path):
        from generate_dataset import generate_traffic_dataset
        df = generate_traffic_dataset()
    else:
        df = pd.read_csv(data_path)
        
    print(f"Loaded dataset with {len(df)} records.")
    
    # Define features and target
    # Feature columns:
    # time_of_day, day_of_week, is_weekend, road_capacity, traffic_volume,
    # avg_speed, incident_reported, emergency_vehicle_active, volume_capacity_ratio,
    # plus one-hot encoded road_type and weather
    
    categorical_cols = ["road_type", "weather"]
    df_encoded = pd.get_dummies(df, columns=categorical_cols, drop_first=False)
    
    feature_cols = [c for c in df_encoded.columns if c not in ["congestion_level"]]
    X = df_encoded[feature_cols]
    y = df_encoded["congestion_level"]
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    print(f"Training set: {len(X_train)} samples, Test set: {len(X_test)} samples")
    
    # 1. Main Model: Random Forest Classifier
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    rf_pred = rf_model.predict(X_test)
    rf_acc = float(accuracy_score(y_test, rf_pred))
    
    # 2. Baseline Model 1: Decision Tree
    dt_model = DecisionTreeClassifier(max_depth=6, random_state=42)
    dt_model.fit(X_train, y_train)
    dt_pred = dt_model.predict(X_test)
    dt_acc = float(accuracy_score(y_test, dt_pred))
    
    # 3. Baseline Model 2: Logistic Regression (with scaled features)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    lr_model = LogisticRegression(max_iter=1000, random_state=42)
    lr_model.fit(X_train_scaled, y_train)
    lr_pred = lr_model.predict(X_test_scaled)
    lr_acc = float(accuracy_score(y_test, lr_pred))
    
    print(f"\nModel Performance Comparison:")
    print(f"1. Random Forest Classifier Accuracy: {rf_acc * 100:.2f}%")
    print(f"2. Decision Tree Classifier Accuracy:  {dt_acc * 100:.2f}%")
    print(f"3. Logistic Regression Accuracy:       {lr_acc * 100:.2f}%")
    
    # Metrics for Random Forest
    precision, recall, f1, support = precision_recall_fscore_support(y_test, rf_pred, average=None)
    cm = confusion_matrix(y_test, rf_pred)
    
    class_names = ["Low", "Moderate", "High"]
    
    metrics = {
        "model_name": "Random Forest Classifier",
        "accuracy": round(rf_acc, 4),
        "total_samples": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "classes": class_names,
        "per_class": {
            class_names[i]: {
                "precision": round(float(precision[i]), 4),
                "recall": round(float(recall[i]), 4),
                "f1_score": round(float(f1[i]), 4),
                "support": int(support[i])
            }
            for i in range(len(class_names))
        },
        "confusion_matrix": cm.tolist(),
        "baseline_comparison": {
            "Random Forest": round(rf_acc * 100, 2),
            "Decision Tree": round(dt_acc * 100, 2),
            "Logistic Regression": round(lr_acc * 100, 2)
        },
        "feature_names": feature_cols,
        "feature_importances": [
            {"feature": f, "importance": round(float(imp), 4)}
            for f, imp in sorted(zip(feature_cols, rf_model.feature_importances_), key=lambda x: x[1], reverse=True)
        ]
    }
    
    # Save model and artifacts
    os.makedirs("ml", exist_ok=True)
    os.makedirs("data", exist_ok=True)
    joblib.dump(rf_model, os.path.join("ml", "model.joblib"))
    joblib.dump(feature_cols, os.path.join("ml", "feature_cols.joblib"))
    
    with open(os.path.join("data", "model_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
        
    # Export lightweight rules for fast inference
    model_rules = {
        "feature_names": feature_cols,
        "classes": class_names,
        "capacities": {
            "Highway": 3000,
            "Arterial": 1800,
            "Urban": 1200,
            "Residential": 600
        },
        "speed_limits": {
            "Highway": 90,
            "Arterial": 60,
            "Urban": 45,
            "Residential": 30
        },
        "feature_importances": metrics["feature_importances"],
        "metrics": {
            "accuracy": round(rf_acc * 100, 1),
            "macro_f1": round(float(np.mean(f1)) * 100, 1)
        }
    }
    with open(os.path.join("data", "model_rules.json"), "w") as f:
        json.dump(model_rules, f, indent=2)
        
    print("\nModel saved to ml/model.joblib and data/model_metrics.json")
    
    # Generate Visualizations for Frontend
    plot_dir = os.path.join("public", "assets", "ml")
    os.makedirs(plot_dir, exist_ok=True)
    
    # 1. Confusion Matrix Plot
    plt.figure(figsize=(6, 5))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title('Random Forest - Confusion Matrix', fontsize=12, fontweight='bold', pad=12)
    plt.colorbar()
    tick_marks = np.arange(len(class_names))
    plt.xticks(tick_marks, class_names, rotation=0)
    plt.yticks(tick_marks, class_names)
    
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, format(cm[i, j], 'd'),
                     ha="center", va="center",
                     color="white" if cm[i, j] > thresh else "black",
                     fontweight='bold')
    plt.ylabel('Actual Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    cm_path = os.path.join(plot_dir, "confusion_matrix.png")
    plt.savefig(cm_path, dpi=180)
    plt.close()
    
    # 2. Feature Importance Plot
    top_features = metrics["feature_importances"][:8]
    names = [x["feature"].replace("_", " ").title() for x in top_features][::-1]
    values = [x["importance"] for x in top_features][::-1]
    
    plt.figure(figsize=(7, 4.5))
    bars = plt.barh(names, values, color='#3B82F6')
    plt.title('TraffIQ - Top Feature Importances (Random Forest)', fontsize=12, fontweight='bold', pad=12)
    plt.xlabel('Importance Weight')
    for bar in bars:
        width = bar.get_width()
        plt.text(width + 0.005, bar.get_y() + bar.get_height()/2, f"{width:.3f}", 
                 va='center', ha='left', fontsize=9)
    plt.xlim(0, max(values) * 1.15)
    plt.tight_layout()
    fi_path = os.path.join(plot_dir, "feature_importance.png")
    plt.savefig(fi_path, dpi=180)
    plt.close()
    
    # 3. Model Comparison Plot
    models = list(metrics["baseline_comparison"].keys())
    scores = list(metrics["baseline_comparison"].values())
    
    plt.figure(figsize=(6, 4))
    bars = plt.bar(models, scores, color=['#10B981', '#6366F1', '#F59E0B'], width=0.55)
    plt.title('Model Accuracy Comparison (%)', fontsize=12, fontweight='bold', pad=12)
    plt.ylabel('Accuracy (%)')
    plt.ylim(70, 102)
    for bar in bars:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2, height + 0.8, f"{height:.1f}%", 
                 ha='center', va='bottom', fontweight='bold', fontsize=10)
    plt.tight_layout()
    mc_path = os.path.join(plot_dir, "model_comparison.png")
    plt.savefig(mc_path, dpi=180)
    plt.close()
    
    print(f"Generated evaluation plots in {plot_dir}")
    print("\nClassification Report:")
    print(classification_report(y_test, rf_pred, target_names=class_names))

if __name__ == "__main__":
    train_and_evaluate()
