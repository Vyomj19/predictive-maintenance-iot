import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

function App() {
  const [data, setData] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [baselineMessage, setBaselineMessage] = useState("");
  const [machineId, setMachineId] = useState("motor_1");

  const machines = ["motor_1", "motor_2", "fan_1", "pump_1"];
  const latest = data[data.length - 1];

  async function fetchData() {
    try {
      const res = await axios.get("http://127.0.0.1:8000/history");

      const filtered = res.data.filter(
        (item) => item.machine_id === machineId
      );

      setData(filtered);
    } catch (err) {
      console.error("Fetch failed:", err);
    }
  }

  async function fetchBaseline() {
    try {
      const res = await axios.get(
        `http://127.0.0.1:8000/baseline/${machineId}`
      );

      if (!res.data.error) {
        setBaseline(res.data);
      } else {
        setBaseline(null);
      }
    } catch (err) {
      console.error("Baseline fetch failed:", err);
    }
  }

  async function createBaseline() {
    try {
      const res = await axios.post(
        `http://127.0.0.1:8000/baseline/create/${machineId}`
      );

      if (res.data.error) {
        setBaselineMessage(res.data.error);
      } else {
        setBaseline(res.data);
        setBaselineMessage("Baseline updated successfully.");
      }
    } catch (err) {
      console.error("Baseline creation failed:", err);
      setBaselineMessage("Baseline update failed.");
    }
  }

  async function resetMachine() {
    const confirmed = window.confirm(
      "Delete all readings and baseline data for this machine?"
    );

    if (!confirmed) return;

    try {
      await axios.delete(`http://127.0.0.1:8000/reset/${machineId}`);

      setData([]);
      setBaseline(null);
      setBaselineMessage("Machine reset successfully.");
    } catch (err) {
      console.error("Reset failed:", err);
      setBaselineMessage("Reset failed.");
    }
  }

  function exportReport() {
    window.open(`http://127.0.0.1:8000/export/${machineId}`, "_blank");
  }

  useEffect(() => {
    setData([]);
    setBaseline(null);
    setBaselineMessage("");

    fetchData();
    fetchBaseline();

    const interval = setInterval(() => {
      fetchData();
      fetchBaseline();
    }, 3000);

    return () => clearInterval(interval);
  }, [machineId]);

  const health = latest?.health_score ?? 0;
  const alertList = latest?.alerts ? latest.alerts.split(", ") : [];
  const recList = latest?.recommendations
    ? latest.recommendations.split(", ")
    : [];

  function healthClass(score) {
    if (score >= 90) return "good";
    if (score >= 70) return "caution";
    return "bad";
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">Industrial IoT Monitoring</p>
          <h1>Predictive Maintenance</h1>
          <p className="subtitle">
            Live telemetry, baseline learning, anomaly detection, and machine
            health scoring.
          </p>
        </div>

        <div className="machineBadge">
          <span>Machine</span>

          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
          >
            {machines.map((machine) => (
              <option key={machine} value={machine}>
                {machine}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="heroGrid">
        <div className={`heroHealth ${healthClass(health)}`}>
          <p className="label">Machine Health</p>
          <h2>{latest ? `${health.toFixed(1)}%` : "--"}</h2>
          <p>{latest?.status ? latest.status.toUpperCase() : "NO DATA"}</p>
        </div>

        <div className="metricCard">
          <p>Temperature</p>
          <h3>{latest ? `${latest.temperature.toFixed(1)}°C` : "--"}</h3>
        </div>

        <div className="metricCard">
          <p>Humidity</p>
          <h3>{latest ? `${latest.humidity.toFixed(1)}%` : "--"}</h3>
        </div>

        <div className="metricCard">
          <p>Vibration</p>
          <h3>{latest ? latest.vibration_magnitude.toFixed(2) : "--"}</h3>
        </div>
      </section>

      <section className="splitGrid">
        <div className="panel">
          <div className="panelHeader">
            <h2>Alerts</h2>

            <span className={alertList.length ? "pill danger" : "pill safe"}>
              {alertList.length ? `${alertList.length} active` : "clear"}
            </span>
          </div>

          {alertList.length ? (
            alertList.map((alert, index) => (
              <div className="alertRow" key={index}>
                ⚠ {alert}
              </div>
            ))
          ) : (
            <p className="muted">
              No active alerts. Machine is operating normally.
            </p>
          )}

          <h3>Recommended Actions</h3>

          {recList.length ? (
            recList.map((rec, index) => (
              <div className="recRow" key={index}>
                → {rec}
              </div>
            ))
          ) : (
            <p className="muted">No maintenance action required.</p>
          )}
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>Baseline Profile</h2>

            <div className="buttonGroup">
              <button onClick={createBaseline}>Update Baseline</button>

              <button onClick={exportReport}>Export CSV</button>

              <button className="dangerButton" onClick={resetMachine}>
                Reset Machine
              </button>
            </div>
          </div>

          {baselineMessage && <p className="success">{baselineMessage}</p>}

          {baseline?.baseline_change_message && (
            <div className="baselineAlert">
              ⚠ {baseline.baseline_change_message}
            </div>
          )}

          {baseline ? (
            <div className="baselineStats">
              <div>
                <span>Avg Temp</span>
                <strong>{baseline.avg_temperature.toFixed(2)}°C</strong>
              </div>

              <div>
                <span>Avg Humidity</span>
                <strong>{baseline.avg_humidity.toFixed(2)}%</strong>
              </div>

              <div>
                <span>Avg Vibration</span>
                <strong>{baseline.avg_vibration.toFixed(2)}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">
              No baseline yet. Run the machine normally, then create a baseline.
            </p>
          )}
        </div>
      </section>

      <div className="chartPanel">
        <h2>Machine Health Trend</h2>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="id" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="health_score"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chartGrid">
        <div className="chartPanel">
          <h2>Temperature Trend</h2>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="temperature"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chartPanel">
          <h2>Vibration Trend</h2>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="vibration_magnitude"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;