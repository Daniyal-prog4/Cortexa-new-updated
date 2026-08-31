import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Users, Trash2, FileCode, Sparkles, Cpu, FolderOpen } from "lucide-react";

const iconMap = { code: FileCode, search: Sparkles, cog: Cpu, folder: FolderOpen };
const colorMap = {
  cyan: { fg: "var(--accent-1)", bg: "rgba(var(--accent-rgb),0.12)", bd: "rgba(var(--accent-rgb),0.4)" },
  violet: { fg: "#a78bfa", bg: "rgba(167,139,250,0.12)", bd: "rgba(167,139,250,0.4)" },
  blue: { fg: "#60a5fa", bg: "rgba(96,165,250,0.12)", bd: "rgba(96,165,250,0.4)" },
  amber: { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)", bd: "rgba(251,191,36,0.4)" },
};

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", description: "", color: "cyan", icon: "cog", tools: "" });
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/agents");
      setAgents(data);
      setError(null);
    } catch (e) {
      console.error("Failed to load agents:", e);
      setError("Couldn't load agents. Please check your connection and try again.");
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.role) return;
    try {
      await api.post("/agents", {
        ...form,
        tools: form.tools.split(",").map(s => s.trim()).filter(Boolean),
      });
      setForm({ name: "", role: "", description: "", color: "cyan", icon: "cog", tools: "" });
      setShowForm(false);
      load();
    } catch (e) {
      console.error("Failed to create agent:", e);
      setError("Couldn't create the agent. Please try again.");
    }
  };
  const remove = async (id) => {
    try {
      await api.delete(`/agents/${id}`);
      load();
    } catch (e) {
      console.error("Failed to delete agent:", e);
      setError("Couldn't delete the agent. Please try again.");
    }
  };

  return (
    <div style={{ padding: "32px 40px", flex: 1, overflowY: "auto" }} data-testid="agents-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500 }}>Agents</h1>
          <p style={{ color: "var(--text-dim)", margin: "6px 0 0" }}>Manage the intelligent agents that power Cortexa</p>
        </div>
        <button className="cx-btn" onClick={() => setShowForm(!showForm)} data-testid="new-agent-btn">
          <Plus size={16} /> New Agent
        </button>
      </div>

      {error && (
        <div className="cx-panel fade-in" style={{ padding: "12px 16px", marginBottom: 20, borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5", fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div className="cx-panel fade-in" style={{ padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input className="cx-input" placeholder="Name (e.g. Design Agent)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="agent-name-input" />
          <input className="cx-input" placeholder="Role (e.g. Figma, Icons)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="agent-role-input" />
          <input className="cx-input" placeholder="Description" style={{ gridColumn: "1 / -1" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="agent-desc-input" />
          <input className="cx-input" placeholder="Tools (comma separated)" value={form.tools} onChange={(e) => setForm({ ...form, tools: e.target.value })} data-testid="agent-tools-input" />
          <div style={{ display: "flex", gap: 12 }}>
            <select className="cx-input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}>
              <option value="cyan">Cyan</option><option value="violet">Violet</option><option value="blue">Blue</option><option value="amber">Amber</option>
            </select>
            <select className="cx-input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
              <option value="cog">Cog</option><option value="code">Code</option><option value="search">Search</option><option value="folder">Folder</option>
            </select>
            <button className="cx-btn" onClick={create} data-testid="agent-save-btn"><Plus size={16} /> Save</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {agents.map((a) => {
          const Icon = iconMap[a.icon] || Users;
          const c = colorMap[a.color] || colorMap.cyan;
          return (
            <div key={a.id} className="cx-panel" style={{ padding: 20 }} data-testid={`agent-card-${a.name}`}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div className="agent-icon" style={{ background: c.bg, borderColor: c.bd, color: c.fg, width: 48, height: 48 }}>
                  <Icon size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{a.name}</div>
                    <span className="cx-chip">Active</span>
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 3 }}>{a.role}</div>
                </div>
              </div>
              <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "14px 0" }}>{a.description}</p>
              {a.tools?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {a.tools.map((t) => (
                    <span key={t} style={{ padding: "3px 10px", fontSize: 11, borderRadius: 999, background: "rgba(var(--accent-rgb),0.06)", border: "1px solid var(--border-accent)", color: "var(--text-dim)" }}>{t}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="cx-btn" style={{ flex: 1, justifyContent: "center" }} data-testid={`agent-run-${a.name}`}>Run</button>
                <button className="cx-btn" onClick={() => remove(a.id)} style={{ borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5" }} data-testid={`agent-delete-${a.name}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}