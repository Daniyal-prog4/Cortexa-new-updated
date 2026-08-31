import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, CheckSquare, Play, Trash2 } from "lucide-react";

const statusColor = {
  pending: { fg: "#fbbf24", bg: "rgba(251,191,36,0.1)", bd: "rgba(251,191,36,0.3)" },
  running: { fg: "var(--accent-1)", bg: "rgba(var(--accent-rgb),0.1)", bd: "rgba(var(--accent-rgb),0.3)" },
  done:    { fg: "#34d399", bg: "rgba(52,211,153,0.1)", bd: "rgba(52,211,153,0.3)" },
  failed:  { fg: "#f87171", bg: "rgba(248,113,113,0.1)", bd: "rgba(248,113,113,0.3)" },
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setTasks((await api.get("/tasks")).data);
      setError(null);
    } catch (e) {
      console.error("Failed to load tasks:", e);
      setError("Couldn't load tasks. Please check your connection and try again.");
    }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim()) return;
    try {
      await api.post("/tasks", { title });
      setTitle("");
      load();
    } catch (e) {
      console.error("Failed to add task:", e);
      setError("Couldn't add that task. Please try again.");
    }
  };
  const setStatus = async (id, s) => {
    try {
      await api.patch(`/tasks/${id}?status_value=${s}`);
      load();
    } catch (e) {
      console.error("Failed to update task:", e);
      setError("Couldn't update that task. Please try again.");
    }
  };

  return (
    <div style={{ padding: "32px 40px", flex: 1, overflowY: "auto" }} data-testid="tasks-page">
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500 }}>Tasks</h1>
      <p style={{ color: "var(--text-dim)", margin: "6px 0 22px" }}>Tasks Cortexa is running or has queued for you</p>

      {error && (
        <div className="cx-panel fade-in" style={{ padding: "12px 16px", marginBottom: 20, borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5", fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <div className="cx-panel" style={{ padding: 14, marginBottom: 20, display: "flex", gap: 12 }}>
        <input className="cx-input" placeholder="Describe a task…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} data-testid="task-input" />
        <button className="cx-btn" onClick={add} data-testid="task-add-btn"><Plus size={16} /> Add</button>
      </div>

      <div className="cx-panel" style={{ padding: 6 }}>
        {tasks.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)" }}>
            <CheckSquare size={26} style={{ opacity: 0.5 }} />
            <div style={{ marginTop: 10 }}>No tasks yet.</div>
          </div>
        )}
        {tasks.map((t) => {
          const c = statusColor[t.status] || statusColor.pending;
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border-soft)" }} data-testid={`task-row-${t.id}`}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: c.bg, border: `1px solid ${c.bd}`, display: "grid", placeItems: "center", color: c.fg }}>
                <CheckSquare size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{new Date(t.created_at).toLocaleString()}</div>
              </div>
              <span className="cx-chip" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>{t.status}</span>
              <button className="win-btn" onClick={() => setStatus(t.id, "running")} title="Run" data-testid={`task-run-${t.id}`}><Play size={15} /></button>
              <button className="win-btn" onClick={() => setStatus(t.id, "done")} title="Done" data-testid={`task-done-${t.id}`} style={{ color: "#34d399" }}><CheckSquare size={15} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}