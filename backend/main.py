from datetime import datetime, timedelta
import math

from fastapi.responses import StreamingResponse
import io
import csv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import SessionLocal, SensorReading, MachineBaseline

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SensorData(BaseModel):
    machine_id: str
    temperature: float
    humidity: float
    vibration_x: float
    vibration_y: float
    vibration_z: float


def vibration_mag(data: SensorData):
    x = data.vibration_x
    y = data.vibration_y
    z = data.vibration_z

    total_accel = math.sqrt(x**2 + y**2 + z**2)

    # If values are huge, assume raw MPU6050 units and convert to g.
    if total_accel > 100:
        x = x / 16384
        y = y / 16384
        z = z / 16384
        total_g = math.sqrt(x**2 + y**2 + z**2)

        # Stationary sensor should be near 1g.
        return abs(total_g - 1)

    # Otherwise assume values are m/s².
    return abs(total_accel - 9.81)


def calculate_health_score(data: SensorData, vibration_magnitude: float, baseline):
    if not baseline:
        return 100

    temp_diff = abs(data.temperature - baseline.avg_temperature)
    humidity_diff = abs(data.humidity - baseline.avg_humidity)
    vibration_diff = abs(vibration_magnitude - baseline.avg_vibration)

    score = 100
    score -= temp_diff * 2
    score -= humidity_diff * 0.5
    score -= vibration_diff * 5

    return max(0, min(100, round(score, 1)))


def analyze_trend(db, machine_id, current_vibration, minutes=5):
    cutoff_time = datetime.now() - timedelta(minutes=minutes)

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .all()
    )

    recent = []

    for reading in readings:
        if not reading.timestamp:
            continue

        try:
            reading_time = datetime.fromisoformat(reading.timestamp)
        except ValueError:
            continue

        if reading_time >= cutoff_time:
            recent.append(reading)

    if len(recent) < 5:
        return "", 0

    avg_recent_vibration = (
        sum(r.vibration_magnitude for r in recent) / len(recent)
    )

    if avg_recent_vibration == 0:
        return "", 0

    percent_increase = (
        (current_vibration - avg_recent_vibration)
        / avg_recent_vibration
    ) * 100

    percent_increase = round(percent_increase, 1)

    if percent_increase > 15:
        return (
            f"Vibration rose {percent_increase}% over the last {minutes} minutes. "
            "Possible developing imbalance or bearing wear.",
            percent_increase,
        )

    return "", percent_increase

def get_percent_change(old, new):
    if old is None or old == 0:
        return 0

    return round(abs((new - old) / old) * 100, 1)


def check_baseline_change(old_baseline, new_temp, new_humidity, new_vibration):
    if not old_baseline:
        return "", 0

    temp_change = get_percent_change(old_baseline.avg_temperature, new_temp)
    humidity_change = get_percent_change(old_baseline.avg_humidity, new_humidity)
    vibration_change = get_percent_change(old_baseline.avg_vibration, new_vibration)

    changes = {
        "temperature": temp_change,
        "humidity": humidity_change,
        "vibration": vibration_change,
    }

    biggest_metric = max(changes, key=changes.get)
    biggest_change = changes[biggest_metric]

    if biggest_change >= 100:
        time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        message = f"Baseline {biggest_metric} changed {biggest_change}% at {time_now}."
        return message, biggest_change

    return "", biggest_change

def update_baseline_every_10_readings(db, machine_id):
    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.id.desc())
        .limit(10)
        .all()
    )

    if len(readings) < 10:
        return None

    latest_reading = readings[0]

    if latest_reading.id % 10 != 0:
        return None

    avg_temperature = sum(r.temperature for r in readings) / len(readings)
    avg_humidity = sum(r.humidity for r in readings) / len(readings)
    avg_vibration = sum(r.vibration_magnitude for r in readings) / len(readings)

    baseline = (
        db.query(MachineBaseline)
        .filter(MachineBaseline.machine_id == machine_id)
        .first()
    )

    baseline_change_message, baseline_change_percent = check_baseline_change(
        baseline,
        avg_temperature,
        avg_humidity,
        avg_vibration,
    )

    if baseline:
        baseline.avg_temperature = avg_temperature
        baseline.avg_humidity = avg_humidity
        baseline.avg_vibration = avg_vibration
        baseline.reading_count = latest_reading.id
        baseline.last_updated = datetime.now().isoformat()
        baseline.baseline_change_message = baseline_change_message
        baseline.baseline_change_percent = baseline_change_percent
    else:
        baseline = MachineBaseline(
            machine_id=machine_id,
            avg_temperature=avg_temperature,
            avg_humidity=avg_humidity,
            avg_vibration=avg_vibration,
            reading_count=latest_reading.id,
            last_updated=datetime.now().isoformat(),
            baseline_change_message="",
            baseline_change_percent=0,
        )

        db.add(baseline)

    db.commit()

    return baseline
def analyze_machine(data: SensorData, baseline=None, trend_warning=""):
    vibration_magnitude = vibration_mag(data)
    health_score = calculate_health_score(data, vibration_magnitude, baseline)

    alerts = []
    recommendations = []

    if data.temperature > 40:
        alerts.append("High temperature detected")
        recommendations.append("Check airflow, cooling, or motor load.")

    if data.humidity > 80:
        alerts.append("High humidity detected")
        recommendations.append(
            "Check environment moisture and electronics protection."
        )

    if vibration_magnitude > 15:
        alerts.append("High vibration detected")
        recommendations.append(
            "Check bearings, mounting, alignment, or imbalance."
        )

    if baseline:
        if data.temperature > baseline.avg_temperature + 8:
            alerts.append("Temperature above normal baseline")
            recommendations.append(
                "Compare current load and cooling against normal operating condition."
            )

        if vibration_magnitude > baseline.avg_vibration * 1.5:
            alerts.append("Vibration above normal baseline")
            recommendations.append(
                "Inspect for imbalance, loosened mounting, or bearing wear."
            )

    if trend_warning:
        alerts.append("Rising vibration trend detected")
        recommendations.append(
            "Monitor the machine closely and inspect rotating components if trend continues."
        )

    status = "normal"

    if alerts or health_score < 75:
        status = "warning"

    return {
        "status": status,
        "vibration_magnitude": vibration_magnitude,
        "health_score": health_score,
        "alerts": alerts,
        "recommendations": recommendations,
        "trend_warning": trend_warning,
    }


@app.post("/sensor-data")
async def receive_data(data: SensorData):
    db = SessionLocal()

    baseline = (
        db.query(MachineBaseline)
        .filter(MachineBaseline.machine_id == data.machine_id)
        .first()
    )

    current_vibration = vibration_mag(data)
    trend_warning, trend_percent = analyze_trend(
        db,
        data.machine_id,
        current_vibration,
    )

    analysis = analyze_machine(
        data,
        baseline,
        trend_warning,
    )

    reading = SensorReading(
        machine_id=data.machine_id,
        temperature=data.temperature,
        humidity=data.humidity,
        vibration_x=data.vibration_x,
        vibration_y=data.vibration_y,
        vibration_z=data.vibration_z,
        vibration_magnitude=analysis["vibration_magnitude"],
        status=analysis["status"],
        alerts=", ".join(analysis["alerts"]),
        recommendations=", ".join(analysis["recommendations"]),
        health_score=analysis["health_score"],
        trend_warning=analysis["trend_warning"],
        trend_percent=trend_percent,
    )

    db.add(reading)
    db.commit()
    db.refresh(reading)

    updated_baseline = update_baseline_every_10_readings(
        db,
        data.machine_id,
    )

    db.close()

    return {
        **analysis,
        "trend_percent": trend_percent,
        "auto_baseline_updated": updated_baseline is not None,
    }


@app.post("/baseline/create/{machine_id}")
async def create_baseline(machine_id: str):
    db = SessionLocal()

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .all()
    )

    if not readings:
        db.close()
        return {"error": "No readings found for this machine yet."}

    avg_temperature = sum(r.temperature for r in readings) / len(readings)
    avg_humidity = sum(r.humidity for r in readings) / len(readings)
    avg_vibration = sum(r.vibration_magnitude for r in readings) / len(readings)

    existing = (
        db.query(MachineBaseline)
        .filter(MachineBaseline.machine_id == machine_id)
        .first()
    )

    if existing:
        existing.avg_temperature = avg_temperature
        existing.avg_humidity = avg_humidity
        existing.avg_vibration = avg_vibration
        existing.reading_count = len(readings)
        existing.last_updated = datetime.now().isoformat()
    else:
        baseline = MachineBaseline(
            machine_id=machine_id,
            avg_temperature=avg_temperature,
            avg_humidity=avg_humidity,
            avg_vibration=avg_vibration,
            reading_count=len(readings),
            last_updated=datetime.now().isoformat(),
        )
        db.add(baseline)

    db.commit()
    db.close()

    return {
        "message": "Baseline created",
        "machine_id": machine_id,
        "avg_temperature": avg_temperature,
        "avg_humidity": avg_humidity,
        "avg_vibration": avg_vibration,
        "reading_count": len(readings),
        "last_updated": datetime.now().isoformat(),
    }

@app.get("/export/{machine_id}")
async def export_machine_data(machine_id: str):
    db = SessionLocal()

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "id",
        "timestamp",
        "machine_id",
        "temperature",
        "humidity",
        "vibration_x",
        "vibration_y",
        "vibration_z",
        "vibration_magnitude",
        "health_score",
        "status",
        "alerts",
        "recommendations",
        "trend_warning",
        "trend_percent",
    ])

    for r in readings:
        writer.writerow([
            r.id,
            r.timestamp,
            r.machine_id,
            r.temperature,
            r.humidity,
            r.vibration_x,
            r.vibration_y,
            r.vibration_z,
            r.vibration_magnitude,
            r.health_score,
            r.status,
            r.alerts,
            r.recommendations,
            r.trend_warning,
            r.trend_percent,
        ])

    db.close()

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={machine_id}_report.csv"
        },
    )


@app.get("/history")
async def get_history():
    db = SessionLocal()
    readings = db.query(SensorReading).all()

    result = []

    for r in readings:
        result.append(
            {
                "id": r.id,
                "timestamp": r.timestamp,
                "machine_id": r.machine_id,
                "temperature": r.temperature,
                "humidity": r.humidity,
                "vibration_x": r.vibration_x,
                "vibration_y": r.vibration_y,
                "vibration_z": r.vibration_z,
                "vibration_magnitude": r.vibration_magnitude,
                "status": r.status,
                "alerts": r.alerts,
                "recommendations": r.recommendations,
                "health_score": r.health_score,
                "trend_warning": r.trend_warning,
                "trend_percent": r.trend_percent,
            }
        )

    db.close()
    return result


@app.get("/baseline/{machine_id}")
async def get_baseline(machine_id: str):
    db = SessionLocal()

    baseline = (
        db.query(MachineBaseline)
        .filter(MachineBaseline.machine_id == machine_id)
        .first()
    )

    db.close()

    if not baseline:
        return {"error": "No baseline found for this machine."}

    return {
        "machine_id": baseline.machine_id,
        "avg_temperature": baseline.avg_temperature,
        "avg_humidity": baseline.avg_humidity,
        "avg_vibration": baseline.avg_vibration,
        "reading_count": baseline.reading_count,
        "last_updated": baseline.last_updated,
    }


@app.delete("/reset/{machine_id}")
async def reset_machine(machine_id: str):
    db = SessionLocal()

    db.query(SensorReading).filter(
        SensorReading.machine_id == machine_id
    ).delete()

    db.query(MachineBaseline).filter(
        MachineBaseline.machine_id == machine_id
    ).delete()

    db.commit()
    db.close()

    return {"message": f"{machine_id} reset successfully"}


@app.get("/")
async def root():
    return {"message": "Predictive maintenance backend is running"}