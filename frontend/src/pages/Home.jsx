import React, { useState, useEffect } from "react";
import { CortexaCore } from "@/components/cortexa/CortexaCore";
import CommandBar from "@/components/cortexa/CommandBar";
import { Mic, Keyboard, AppWindow, Search, MonitorCog, Globe, StickyNote, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working Late";
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  if (h < 21) return "Good Evening";
  return "Good Night";
}

const quickActions = [
  { icon: AppWindow, label: "Open App", desc: "Launch application", testid: "qa-open-app" },
  { icon: Search, label: "Search Files", desc: "Find files quickly", testid: "qa-search-files" },
  { icon: MonitorCog, label: "System Info", desc: "Check system", testid: "qa-system-info" },
  { icon: Globe, label: "Web Search", desc: "Search the web", testid: "qa-web-search" },
  { icon: StickyNote, label: "Take Notes", desc: "Create a note", testid: "qa-take-notes" },
];

export default function Home() {
  const { user } = useAuth();
  const [listening, setListening] = useState(false);
  const [chat, setChat] = useState([]); // {user, reply}
  const [mode, setMode] = useState("welcome"); // welcome | chat

  useEffect(() => {
    // reset chat when the user is loaded
  }, [user?.id]);

  const onSent = (msg) => {
    setMode("chat");
    setChat((c) => [...c, msg]);
  };

  const quickCommand = (label) => {
    const templates = {
      "Open App": "Open VS Code for me.",
      "Search Files": "Find PDF files edited in the last 7 days.",
      "System Info": "Give me a quick system health report.",
      "Web Search": "Search the web for the latest AI news.",
      "Take Notes": "Take a note: remember to review pull requests tonight.",
    };
    const text = templates[label] || label;
    onSent({ user: text, reply: null, pending: true });
    // trigger real send via API
    import("@/lib/api").then(async ({ api }) => {
      try {
        const sid = localStorage.getItem("cortexa_session") || undefined;
        const { data } = await api.post("/chat", { message: text, session_id: sid });
        localStorage.setItem("cortexa_session", data.session_id);
        setChat((c) => {
          const copy = [...c];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].pending && copy[i].user === text) { copy[i] = { user: text, reply: data.reply }; break; }
          }
          return copy;
        });
      } catch (_) {
        setChat((c) => c.map((m) => (m.pending && m.user === text ? { user: text, reply: "⚠️ Unable to reach assistant." } : m)));
      }
    });
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "32px 40px 20px",
        gap: 20,
        minHeight: 0,
      }}
      data-testid="home-screen"
    >
      {mode === "welcome" ? (
        <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          <div>
            <h1
              style={{
                fontSize: 36,
                margin: 0,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "#e6f6ff",
              }}
              data-testid="greeting-heading"
            >
              {greeting()}, {user?.name?.split(" ")[0] || "Friend"} <span role="img" aria-label="wave">👋</span>
            </h1>
            <p style={{ margin: "8px 0 0", color: "var(--text-dim)", fontSize: 17 }}>
              I'm Cortexa, your AI assistant.<br />How can I help you today?
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginTop: 4 }}>
            <CortexaCore state={listening ? "listening" : "idle"} />

            <div style={{ fontSize: 22, letterSpacing: "0.01em", color: "#eafcff", marginTop: 6 }}>
              How can I help you?
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 4, width: "100%", maxWidth: 640 }}>
              <button
                className="cmd-tile"
                data-testid="speak-cta"
                onClick={() => setListening(!listening)}
              >
                <span className="qa-icon-wrap"><Mic size={22} /></span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>Speak to Cortexa</div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Click to start listening</div>
                </div>
              </button>
              <button
                className="cmd-tile"
                data-testid="type-cta"
                onClick={() => document.querySelector('[data-testid="command-input"]')?.focus()}
              >
                <span className="qa-icon-wrap"><Keyboard size={22} /></span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>Type a command</div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Type your request</div>
                </div>
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 18, marginBottom: 12, letterSpacing: "0.03em" }}>Quick Actions</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  className="qa-tile"
                  onClick={() => quickCommand(qa.label)}
                  data-testid={qa.testid}
                >
                  <span className="qa-icon-wrap"><qa.icon size={22} /></span>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{qa.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{qa.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="cx-btn" onClick={() => setMode("welcome")} data-testid="back-to-home">
              <ArrowLeft size={16} /> Back
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 999, background: "radial-gradient(circle, #22d3ee 0%, #06b6d4 60%, transparent 100%)", boxShadow: "0 0 20px rgba(34,211,238,0.6)" }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Cortexa Assistant</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Claude Sonnet 4.6 · secure local execution</div>
              </div>
            </div>
          </div>

          <div
            className="cx-panel"
            style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}
            data-testid="chat-scroll"
          >
            {chat.map((m, i) => (
              <React.Fragment key={i}>
                <div className="bubble-user" data-testid={`bubble-user-${i}`}>{m.user}</div>
                {m.pending || m.reply === null ? (
                  <div className="bubble-bot"><span className="dots"><span/><span/><span/></span></div>
                ) : (
                  <div className="bubble-bot" data-testid={`bubble-bot-${i}`}>{m.reply}</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <CommandBar onSent={onSent} listening={listening} setListening={setListening} />
    </div>
  );
}
