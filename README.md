# Predictive Maintenance IoT System

An end-to-end Industrial IoT predictive maintenance platform built using ESP32, FastAPI, SQLite, and React.

The system collects real-time temperature, humidity, and vibration data from an ESP32-based sensor node, analyzes machine health, detects abnormal behavior, tracks trends, and visualizes results through a modern web dashboard.

## Features

* Real-time sensor monitoring
* Temperature, humidity, and vibration tracking
* Machine health scoring
* Baseline learning and comparison
* Automatic baseline updates
* Trend analysis and anomaly detection
* Alert event logging
* Multi-machine fleet monitoring
* CSV report export
* Historical data storage
* Interactive React dashboard

## Tech Stack

### Hardware

* ESP32 Development Board
* MPU6050 Accelerometer/Gyroscope
* DHT11 Temperature/Humidity Sensor

### Backend

* FastAPI
* SQLAlchemy
* SQLite

### Frontend

* React
* Vite
* Recharts
* Axios

### Development Tools

* PlatformIO
* Git
* GitHub
* Visual Studio Code

## System Architecture

```text
Sensors → ESP32 → WiFi → FastAPI Backend → SQLite Database → React Dashboard
```

## Dashboard Features

* Fleet Overview
* Machine Health Score
* Baseline Management
* Trend Intelligence
* Alert History
* Temperature Trends
* Vibration Trends
* CSV Export Reports

## Project Structure

```text
predictive-maintenance/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   └── sensor_data.db
│
├── dashboard/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
│
├── esp32-monitor/
│   └── src/
│       └── main.cpp
│
└── README.md
```

## Running the Project

### Start Backend

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Start Dashboard

```bash
cd dashboard
npm install
npm run dev
```

### ESP32

Update WiFi credentials and backend IP address in `esp32-monitor/src/main.cpp`, then upload the code to the ESP32 using PlatformIO.

## API Endpoints

```text
POST   /sensor-data
GET    /history
GET    /baseline/{machine_id}
POST   /baseline/create/{machine_id}
GET    /alerts
GET    /export/{machine_id}
DELETE /reset/{machine_id}
```

## Future Improvements

* PDF report generation
* Cloud deployment
* User authentication
* Mobile application
* Machine learning failure prediction
* Additional sensor integrations

