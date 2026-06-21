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
  const [allData, setAllData] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [baselineMessage, setBaselineMessage] = useState("");
  const [machineId, setMachineId] = useState("motor_1");

  const machines = ["motor_1", "motor_2", "fan_1", "pump_1"];
  const latest = data[data.length - 1];

  async function fetchData() {
    try {
      const res = await axios.get("http://127.0.0.1:8000/history");
      setAllData(res.data);

      const filtered = res.data.filter((item) => item.machine_id === machineId);
      setData(filtered);
    } catch (err) {
      console.error("Fetch failed:", err);
    }
  }

  async function fetchBaseline() {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/baseline/${machineId}`);
      if (!res.data.error) setBaseline(res.data);
      else setBaseline(null);
    } catch (err) {
      console.error("Baseline fetch failed:", err);
    }
  }

  async function createBaseline() {
    try {
      const res = await axios.post(
        `http://127.0.0.1:8000/baseline/create/${machineId}`
      );

      if (res.data.error) setBaselineMessage(res.data.error);
      else {
        setBaseline(res.data);
        setBaselineMessage("Baseline updated successfully.");
      }
    } catch {
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
    } catch {
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
  const trendPercent = latest?.trend_percent ?? 0;
  const trendWarning = latest?.trend_warning ?? "";

  const alertList = latest?.alerts ? latest.alerts.split(", ") : [];
  const recList = latest?.recommendations
    ? latest.recommendations.split(", ")
    : [];

  const fleetMachines = [...new Set(allData.map((item) => item.machine_id))];

  const fleetStatus = fleetMachines.map((machine) => {
    const machineData = allData.filter((item) => item.machine_id === machine);
    const latestMachine = machineData[machineData.length - 1];

    return {
      machine,
      health: latestMachine?.health_score ?? 0,
      status: latestMachine?.status ?? "unknown",
      trend: latestMachine?.trend_percent ?? 0,
    };
  });

  function healthClass(score) {
    if (score >= 90) return "good";
    if (score >= 70) return "caution";
    return "bad";
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="logo">⌁</div>

        <nav>
          <div className="navItem active">▦<span>Dashboard</span></div>
          <div className="navItem">◷<span>History</span></div>
          <div className="navItem">⚠<span>Alerts</span></div>
          <div className="navItem">◎<span>Baseline</span></div>
          <div className="navItem">▤<span>Reports</span></div>
        </nav>

        <div className="systemStatus">
          <span className="onlineDot"></span>
          <p>System</p>
          <strong>Online</strong>
        </div>
      </aside>

      <main className="dashboard">
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

        <section className="fleetPanel">
          <div className="fleetHeader">
            <h2>Machine Fleet Overview</h2>
            <span>{fleetStatus.length} machines tracked</span>
          </div>

          <div className="fleetGrid">
            {fleetStatus.map((machine) => (
              <div
                key={machine.machine}
                className={`fleetCard ${healthClass(machine.health)}`}
              >
                <div className="fleetTop">
                  <div>
                    <h3>{machine.machine}</h3>
                    <p>{machine.status.toUpperCase()}</p>
                  </div>
                  <span className="fleetDot"></span>
                </div>

                <h4>{machine.health.toFixed(1)}%</h4>
                <p className="healthLabel">Health Score</p>

                <div className="healthBar">
                  <div style={{ width: `${machine.health}%` }}></div>
                </div>

                <div className="fleetTrend">
                  <span>Trend:</span>
                  <strong>
                    {machine.trend > 0 ? `+${machine.trend}%` : `${machine.trend}%`}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="heroGrid">
          <div className={`heroHealth ${healthClass(health)}`}>
            <div>
              <p className="label">Machine Health</p>
              <h2>{latest ? `${health.toFixed(1)}%` : "--"}</h2>
              <p>{latest?.status ? latest.status.toUpperCase() : "NO DATA"}</p>
            </div>
            <div className="heroIcon">❤</div>
          </div>

          <div className="metricCard blue">
            <p>Temperature</p>
            <h3>{latest ? `${latest.temperature.toFixed(1)}°C` : "--"}</h3>
            <span>♨</span>
          </div>

          <div className="metricCard cyan">
            <p>Humidity</p>
            <h3>{latest ? `${latest.humidity.toFixed(1)}%` : "--"}</h3>
            <span>♢</span>
          </div>

          <div className="metricCard purple">
            <p>Vibration</p>
            <h3>{latest ? latest.vibration_magnitude.toFixed(2) : "--"}</h3>
            <span>⌁</span>
          </div>
        </section>

        <section className="infoGrid">
          <div className="panel trendPanel">
            <h2>↗ Trend Intelligence</h2>

            <div className="trendCards">
              <div>
                <span>Trend Change</span>
                <strong>{trendPercent > 0 ? `+${trendPercent}%` : `${trendPercent}%`}</strong>
                <p>vs last 5 minutes</p>
              </div>

              <div>
                <span>Status</span>
                <strong>{trendPercent > 15 ? "RISING" : "STABLE"}</strong>
              </div>
            </div>

            {trendWarning ? (
              <div className="trendWarning">⚠ {trendWarning}</div>
            ) : (
              <div className="trendGood">✓ No concerning trends detected.</div>
            )}
          </div>

          <div className="panel">
            <div className="panelHeader">
              <h2>Alerts</h2>
              <span className={alertList.length ? "pill danger" : "pill safe"}>
                {alertList.length ? `${alertList.length} Active` : "Clear"}
              </span>
            </div>

            {alertList.length ? (
              alertList.map((alert, index) => (
                <div className="alertRow" key={index}>
                  ⚠ {alert}
                </div>
              ))
            ) : (
              <p className="muted">No active alerts. Machine is operating normally.</p>
            )}
          </div>

          <div className="panel">
            <h2>Recommended Actions</h2>

            {recList.length ? (
              recList.map((rec, index) => (
                <div className="recRow" key={index}>
                  ✓ {rec}
                </div>
              ))
            ) : (
              <p className="muted">No maintenance action required.</p>
            )}
          </div>
        </section>

        <section className="baselinePanel">
          <div className="baselineTop">
            <div>
              <p className="eyebrow">Baseline Profile</p>
              <h2>{machineId}</h2>
            </div>

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
            <div className="baselineAlert">⚠ {baseline.baseline_change_message}</div>
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
        </section>

        <section className="charts">
          <div className="chartPanel">
            <h2>Health Score Trend</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="id" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="health_score" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chartPanel">
            <h2>Temperature Trend</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="id" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="temperature" strokeWidth={3} dot={false} />
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
                <Line type="monotone" dataKey="vibration_magnitude" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;