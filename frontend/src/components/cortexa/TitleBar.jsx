import React from "react";
import { Search, Bell, Circle, Minus, Square, X, Command } from "lucide-react";

export default function TitleBar({ online = true }) {
  return (
    <div
      className="cx-panel"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 16px",
        borderRadius: 0,
        borderLeft: 0,
        borderRight: 0,
        borderTop: 0,
      }}
      data-testid="title-bar"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Circle size={9} fill="#22c55e" color="#22c55e" style={{ filter: "drop-shadow(0 0 6px #22c55e)" }} />
        <span style={{ color: "#bef264", fontSize: 14, letterSpacing: "0.05em" }}>
          {online ? "Online" : "Offline"}
        </span>
      </div>

      <div style={{ flex: 1, maxWidth: 480, marginLeft: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            background: "rgba(5,9,18,0.55)",
            border: "1px solid var(--border-cyan)",
            borderRadius: 999,
          }}
        >
          <Search size={16} color="var(--text-dim)" />
          <input
            data-testid="global-search"
            placeholder="Search anything…"
            style={{
              flex: 1,
              border: 0,
              background: "transparent",
              outline: 0,
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button className="win-btn" title="Notifications" data-testid="notifications-btn" style={{ position: "relative" }}>
        <Bell size={17} />
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 4,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#22d3ee",
            color: "#04121b",
            fontSize: 10,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 0 8px rgba(34,211,238,0.7)",
          }}
        >
          3
        </span>
      </button>
      <button className="win-btn" title="Command palette" data-testid="cmd-palette-btn">
        <Command size={16} />
      </button>
      <button className="win-btn" title="Minimize"><Minus size={16} /></button>
      <button className="win-btn" title="Maximize"><Square size={13} /></button>
      <button className="win-btn close" title="Close"><X size={17} /></button>
    </div>
  );
}
