import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { History as HIcon, Sparkles } from "lucide-react";

export default function History() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get("/activity")
      .then(r => { setItems(r.data); setError(null); })
      .catch(e => {
        console.error("Failed to load history:", e);
        setError("Couldn't load history. Please check your connection and try again.");
      });
  }, []);
  return (
    <div style={{ padding: "32px 40px", flex: 1, overflowY: "auto" }} data-testid="history-page">
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500 }}>History</h1>
      <p style={{ color: "var(--text-dim)", margin: "6px 0 22px" }}>Every recent action Cortexa performed for you</p>
      {error && (
        <div className="cx-panel fade-in" style={{ padding: "12px 16px", marginBottom: 20, borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5", fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}
      <div className="cx-panel" style={{ padding: 6 }}>
        {items.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)" }}><HIcon /> <div>No history yet — start chatting with Cortexa.</div></div>}
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(var(--accent-rgb),0.1)", border: "1px solid var(--border-accent)", display: "grid", placeItems: "center", color: "var(--accent-1)" }}>
              <Sparkles size={14} />
            </div>
            <div style={{ flex: 1 }}>{it.title}</div>
            <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{new Date(it.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}