import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme, THEMES } from "@/context/ThemeContext";
import { useWake } from "@/context/WakeWordContext";
import { User, Bot, Volume2, Palette, Monitor, ShieldCheck, KeyRound, Info, LogOut, Check, Mic } from "lucide-react";

const groups = [
  { key: "account", label: "Account", Icon: User },
  { key: "ai", label: "AI", Icon: Bot },
  { key: "voice", label: "Voice", Icon: Volume2 },
  { key: "appearance", label: "Appearance", Icon: Palette },
  { key: "desktop", label: "Desktop", Icon: Monitor },
  { key: "permissions", label: "Permissions", Icon: ShieldCheck },
  { key: "privacy", label: "Privacy", Icon: KeyRound },
  { key: "about", label: "About", Icon: Info },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const wake = useWake();
  const [active, setActive] = useState("account");

  return (
    <div style={{ padding: "32px 40px", flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }} data-testid="settings-page">
      <div className="cx-panel" style={{ padding: 8, height: "fit-content" }}>
        {groups.map(g => (
          <button
            key={g.key}
            onClick={() => setActive(g.key)}
            className={`side-item ${active === g.key ? "active" : ""}`}
            style={{ width: "100%", background: "none", border: 0, textAlign: "left" }}
            data-testid={`settings-tab-${g.key}`}
          >
            <g.Icon size={17} /> {g.label}
          </button>
        ))}
      </div>

      <div className="cx-panel" style={{ padding: 26 }}>
        {active === "account" && (
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Account</h2>
            <p style={{ color: "var(--text-dim)", marginTop: 4 }}>Signed in as</p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, background: "rgba(5,9,18,0.55)", border: "1px solid var(--border-accent)", borderRadius: 12, maxWidth: 480 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))", display: "grid", placeItems: "center", fontWeight: 700, color: "#f2f5ff", fontSize: 20 }}>
                {(user?.name || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{user?.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{user?.email}</div>
              </div>
              <div style={{ flex: 1 }} />
              <span className="cx-chip">{user?.plan}</span>
            </div>
            <button className="cx-btn" style={{ marginTop: 20, borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5" }} onClick={logout} data-testid="signout-btn">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
        {active === "ai" && (
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>AI Provider</h2>
            <p style={{ color: "var(--text-dim)" }}>Cortexa is powered by <b style={{ color: "var(--accent-1)" }}>Claude Sonnet 4.6</b> via the Emergent Universal Key. Replies now stream token-by-token.</p>
            <div className="cx-panel" style={{ padding: 16, marginTop: 10, background: "rgba(var(--accent-rgb),0.05)" }}>
              <div style={{ fontSize: 14 }}>Model: <span className="mono">claude-sonnet-4-6</span></div>
              <div style={{ fontSize: 14, marginTop: 6 }}>Streaming: <span style={{ color: "#34d399" }}>enabled (SSE)</span></div>
              <div style={{ fontSize: 14, marginTop: 6 }}>Tool use: <span style={{ color: "#34d399" }}>enabled (permission-gated)</span></div>
            </div>
          </div>
        )}
        {active === "voice" && (
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Voice & Wake Word</h2>
            <p style={{ color: "var(--text-dim)" }}>
              Say <b style={{ color: "var(--accent-1)" }}>"Cortexa"</b> and the assistant wakes up, starts listening and runs your spoken command.
              Detection runs locally in this browser — nothing is uploaded.
            </p>
            {!wake?.supported && (
              <div style={{ color: "var(--amber)", fontSize: 13, marginTop: 6 }} data-testid="wake-unsupported">
                ⚠️ Speech recognition is not supported by this browser. Use Chrome or Edge, or the Cortexa desktop build.
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, cursor: "pointer" }} data-testid="wake-toggle-label">
              <input
                type="checkbox"
                checked={!!wake?.enabled}
                disabled={!wake?.supported}
                onChange={(e) => wake?.setEnabled(e.target.checked)}
                data-testid="wake-toggle"
              />
              <span>Enable wake-word listening while Cortexa is open</span>
            </label>
            {wake?.enabled && (
              <div className="wake-chip" style={{ marginTop: 14 }} data-testid="wake-status-chip">
                <span className="pulse-dot" /> <Mic size={12} /> Listening for "Cortexa"…
              </div>
            )}
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 16 }}>
              The desktop build adds fully offline, always-on wake-word detection (Porcupine) — even when the window is closed.
            </p>
          </div>
        )}
        {active === "appearance" && (
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Appearance</h2>
            <p style={{ color: "var(--text-dim)" }}>Deep dark theme with your choice of accent. Applies instantly across the whole interface.</p>
            <div className="theme-grid" data-testid="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  className={`theme-swatch ${theme === t.key ? "active" : ""}`}
                  onClick={() => setTheme(t.key)}
                  data-testid={`theme-${t.key}`}
                >
                  <span className="swatch-dot" style={{ background: t.color, color: t.color }} />
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    {t.label} {theme === t.key && <Check size={14} style={{ color: "var(--accent-1)" }} />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {active === "desktop" && (
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Desktop</h2>
            <p style={{ color: "var(--text-dim)" }}>Startup, tray, and shortcut behaviors — configurable in the Tauri desktop build.</p>
          </div>
        )}
        {active === "permissions" && (
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Permissions</h2>
            <p style={{ color: "var(--text-dim)" }}>Tools are grouped by risk level. LOW auto-executes; CONFIRM shows a confirm-or-cancel card in chat before anything runs; BLOCKED is never run.</p>
            <div className="cx-panel" style={{ padding: 14, marginTop: 12 }}>
              <div>🟢 LOW — read files inside allowlisted folders, open known apps</div>
              <div style={{ marginTop: 8 }}>🟡 CONFIRM — write files, move/rename, run scripts</div>
              <div style={{ marginTop: 8 }}>🔴 BLOCKED — raw shell, format disk, delete outside allowlist</div>
            </div>
          </div>
        )}
        {active === "privacy" && (
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Privacy</h2>
            <p style={{ color: "var(--text-dim)" }}>Cortexa never uploads your files or credentials. Wake-word audio is processed locally and discarded. Telemetry excludes secrets and file contents.</p>
          </div>
        )}
        {active === "about" && (
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>About Cortexa</h2>
            <p style={{ color: "var(--text-dim)" }}>Version 0.2.0 — Windows-first AI desktop assistant with streaming chat, wake word and permission-gated tool execution.</p>
          </div>
        )}
      </div>
    </div>
  );
}
