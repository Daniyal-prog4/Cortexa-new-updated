import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Cpu, MemoryStick, HardDrive, Battery, Wifi, ShieldCheck } from "lucide-react";

function Stat({ Icon, label, value, color }) {
  return (
    <div className="cx-panel" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-dim)", fontSize: 13 }}>
        <Icon size={16} color={color} /> {label}
      </div>
      <div style={{ fontSize: 40, marginTop: 6, fontWeight: 600, color, textShadow: `0 0 14px color-mix(in srgb, ${color} 35%, transparent)` }}>{value}%</div>
      <div className="cx-progress" style={{ marginTop: 8 }}>
        <div className="fill" style={{ width: `${value}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})` }} />
      </div>
    </div>
  );
}

export default function System() {
  const [t, setT] = useState({ cpu: 28, ram: 61, disk: 48, battery: 84, online: true });
  const [error, setError] = useState(null);
  useEffect(() => {
    const load = async () => {
      try {
        setT((await api.get("/system/telemetry")).data);
        setError(null);
      } catch (e) {
        console.error("Failed to load telemetry:", e);
        setError("Couldn't reach system telemetry. Retrying…");
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: "32px 40px", flex: 1, overflowY: "auto" }} data-testid="system-page">
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500 }}>System</h1>
      <p style={{ color: "var(--text-dim)", margin: "6px 0 22px" }}>Live telemetry from your Cortexa desktop agent</p>

      {error && (
        <div className="cx-panel fade-in" style={{ padding: "12px 16px", marginBottom: 20, borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5", fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Stat Icon={Cpu} label="CPU Usage" value={t.cpu} color="var(--accent-1)" />
        <Stat Icon={MemoryStick} label="RAM Usage" value={t.ram} color="var(--accent-soft)" />
        <Stat Icon={HardDrive} label="Disk Usage" value={t.disk} color="#a78bfa" />
        <Stat Icon={Battery} label="Battery" value={t.battery} color="#34d399" />
      </div>

      <div className="cx-panel" style={{ padding: 22, marginTop: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Connection</div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.online ? "#bef264" : "#f87171" }}>
            <Wifi size={16} /> {t.online ? "Online" : "Offline"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#34d399" }}>
            <ShieldCheck size={16} /> Secure tunnel active
          </div>
        </div>
      </div>
    </div>
  );
}