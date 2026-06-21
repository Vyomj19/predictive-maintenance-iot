from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, Float, String
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./sensor_data.db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String, default=lambda: datetime.now().isoformat())

    machine_id = Column(String)

    temperature = Column(Float)
    humidity = Column(Float)

    vibration_x = Column(Float)
    vibration_y = Column(Float)
    vibration_z = Column(Float)
    vibration_magnitude = Column(Float)

    status = Column(String)
    alerts = Column(String)
    recommendations = Column(String)
    health_score = Column(Float)

    trend_warning = Column(String)
    trend_percent = Column(Float)


class MachineBaseline(Base):
    __tablename__ = "machine_baselines"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, unique=True)

    avg_temperature = Column(Float)
    avg_humidity = Column(Float)
    avg_vibration = Column(Float)

    reading_count = Column(Integer, default=0)
    last_updated = Column(String, default=lambda: datetime.now().isoformat())

    baseline_change_message = Column(String)
    baseline_change_percent = Column(Float)


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String, default=lambda: datetime.now().isoformat())

    machine_id = Column(String)
    severity = Column(String)
    message = Column(String)
    recommendation = Column(String)


Base.metadata.create_all(bind=engine)