import React, { useEffect, useState } from "react";
import { Cpu, HardDrive, Battery, MemoryStick, Users, Plus, Activity, FileCode, FolderOpen, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

const iconMap = {
  code: FileCode,
  search: Sparkles,
  cog: Cpu,
  folder: FolderOpen,
};
const colorMap = {
  cyan: { fg: "var(--accent-1)", bg: "rgba(var(--accent-rgb),0.12)", bd: "rgba(var(--accent-rgb),0.4)" },
  violet: { fg: "#a78bfa", bg: "rgba(167,139,250,0.12)", bd: "rgba(167,139,250,0.4)" },
  blue: { fg: "#60a5fa", bg: "rgba(96,165,250,0.12)", bd: "rgba(96,165,250,0.4)" },
  amber: { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)", bd: "rgba(251,191,36,0.4)" },
};

function TelemetryRow({ Icon, label, value, color = "var(--accent-1)" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
          display: "grid",
          placeItems: "center",
          color,
        }}
      >
        <Icon size={17} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "var(--text-dim)", fontSize: 13, letterSpacing: "0.03em" }}>{label}</span>
          <span data-testid={`telemetry-${label.toLowerCase().replace(/\s+/g, "-")}`} className="mono" style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>{value}%</span>
        </div>
        <div className="cx-progress">
          <div className="fill" style={{ width: `${value}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})`, boxShadow: `0 0 12px color-mix(in srgb, ${color} 55%, transparent)` }} />
        </div>
      </div>
    </div>
  );
}

export default function RightPanel() {
  const [tel, setTel] = useState({ cpu: 28, ram: 61, disk: 48, battery: 84 });
  const [agents, setAgents] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [t, a, act] = await Promise.all([
          api.get("/system/telemetry"),
          api.get("/agents"),
          api.get("/activity"),
        ]);
        setTel(t.data);
        setAgents(a.data);
        setActivity(act.data);
      } catch (_) {}
    };
    fetchAll();
    const id = setInterval(async () => {
      try {
        const t = await api.get("/system/telemetry");
        setTel(t.data);
      } catch (_) {}
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        width: 320,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 20,
        overflowY: "auto",
      }}
      data-testid="right-panel"
    >
      {/* System Overview */}
      <div className="cx-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 16, letterSpacing: "0.05em", fontWeight: 600 }}>System Overview</div>
          <button className="win-btn" style={{ width: "auto", padding: "2px 10px", fontSize: 12, color: "var(--accent-1)" }} data-testid="system-see-all">See All</button>
        </div>
        <TelemetryRow Icon={Cpu} label="CPU Usage" value={tel.cpu} color="var(--accent-1)" />
        <TelemetryRow Icon={MemoryStick} label="RAM Usage" value={tel.ram} color="var(--accent-soft)" />
        <TelemetryRow Icon={HardDrive} label="Disk Usage" value={tel.disk} color="#a78bfa" />
        <TelemetryRow Icon={Battery} label="Battery" value={tel.battery} color="#34d399" />
      </div>

      {/* Your Agents */}
      <div className="cx-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 16, letterSpacing: "0.05em", fontWeight: 600 }}>Your Agents</div>
          <button className="win-btn" style={{ width: "auto", padding: "2px 10px", fontSize: 12, color: "var(--accent-1)" }} data-testid="agents-manage">Manage</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agents.slice(0, 4).map((a) => {
            const Icon = iconMap[a.icon] || Users;
            const c = colorMap[a.color] || colorMap.cyan;
            return (
              <div key={a.id} data-testid={`agent-row-${a.name}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, background: "rgba(5,9,18,0.35)" }}>
                <div className="agent-icon" style={{ background: c.bg, borderColor: c.bd, color: c.fg }}>
                  <Icon size={19} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{a.role}</div>
                </div>
                <span className="cx-chip">
                  <Circle />
                  Active
                </span>
              </div>
            );
          })}
          {agents.length === 0 && (
            <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 8 }}>No agents yet. Create one below.</div>
          )}
          <button className="cx-btn" style={{ justifyContent: "center", marginTop: 4 }} data-testid="add-agent-btn">
            <Plus size={16} /> New Agent
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="cx-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 16, letterSpacing: "0.05em", fontWeight: 600 }}>Recent Activity</div>
          <button className="win-btn" style={{ width: "auto", padding: "2px 10px", fontSize: 12, color: "var(--accent-1)" }} data-testid="activity-see-all">See All</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activity.length === 0 && (
            <div style={{ padding: "14px 4px", color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
              No recent activity yet — start a conversation with Cortexa.
            </div>
          )}
          {activity.slice(0, 6).map((it) => (
            <ActivityLine key={it.id} icon={it.icon} title={it.title} when={new Date(it.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Circle() {
  return <span style={{ width: 7, height: 7, borderRadius: 999, background: "#34d399", boxShadow: "0 0 6px #34d399", display: "inline-block", marginRight: 4 }} />;
}

function ActivityLine({ icon, title, when }) {
  const Icon = ({
    code: FileCode,
    cpu: Cpu,
    folder: FolderOpen,
    check: Activity,
    message: Sparkles,
  }[icon] || Activity);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(var(--accent-rgb),0.08)", border: "1px solid var(--border-accent)", display: "grid", placeItems: "center", color: "var(--accent-1)" }}>
        <Icon size={13} />
      </div>
      <span style={{ flex: 1 }}>{title}</span>
      <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{when}</span>
    </div>
  );
}
