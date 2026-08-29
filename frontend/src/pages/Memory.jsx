import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Database } from "lucide-react";

export default function Memory() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ key: "", value: "", category: "preference" });

  const load = async () => setItems((await api.get("/memory")).data);
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.key || !form.value) return;
    await api.post("/memory", form);
    setForm({ key: "", value: "", category: "preference" });
    load();
  };
  const remove = async (id) => { await api.delete(`/memory/${id}`); load(); };

  return (
    <div style={{ padding: "32px 40px", flex: 1, overflowY: "auto" }} data-testid="memory-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500 }}>Memory</h1>
          <p style={{ color: "var(--text-dim)", margin: "6px 0 0" }}>What Cortexa remembers about you across sessions</p>
        </div>
      </div>

      <div className="cx-panel" style={{ padding: 18, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 2fr 160px 120px", gap: 12 }}>
        <input className="cx-input" placeholder="Key (e.g. preferred_editor)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} data-testid="memory-key-input" />
        <input className="cx-input" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="memory-value-input" />
        <select className="cx-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="preference">Preference</option>
          <option value="project">Project</option>
          <option value="app">App</option>
          <option value="note">Note</option>
        </select>
        <button className="cx-btn" onClick={add} data-testid="memory-add-btn"><Plus size={16} /> Add</button>
      </div>

      <div className="cx-panel" style={{ padding: 6 }}>
        {items.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)" }}>
            <Database size={26} style={{ opacity: 0.5 }} />
            <div style={{ marginTop: 10 }}>No memories saved yet.</div>
          </div>
        )}
        {items.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "1px solid var(--border-soft)" }} data-testid={`memory-row-${m.key}`}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(var(--accent-rgb),0.1)", border: "1px solid var(--border-accent)", display: "grid", placeItems: "center", color: "var(--accent-1)" }}>
              <Database size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{m.key}</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{m.value}</div>
            </div>
            <span className="cx-chip" style={{ background: "rgba(56,189,248,0.1)", color: "var(--electric)", borderColor: "rgba(56,189,248,0.3)" }}>{m.category}</span>
            <button className="win-btn" onClick={() => remove(m.id)} style={{ color: "#fca5a5" }} data-testid={`memory-del-${m.key}`}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
