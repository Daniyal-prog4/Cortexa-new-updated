import React, { useState, useEffect, useRef, useCallback } from "react";
import { CortexaCore } from "@/components/cortexa/CortexaCore";
import CommandBar from "@/components/cortexa/CommandBar";
import { PermissionCard } from "@/components/cortexa/PermissionCard";
import { Mic, Keyboard, AppWindow, Search, MonitorCog, Globe, StickyNote, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWake } from "@/context/WakeWordContext";
import { streamChat } from "@/lib/stream";
import { api } from "@/lib/api";

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

const templates = {
  "Open App": "Open VS Code for me.",
  "Search Files": "Find PDF files edited in the last 7 days.",
  "System Info": "Give me a quick system health report.",
  "Web Search": "Search the web for the latest AI news.",
  "Take Notes": "Take a note: remember to review pull requests tonight.",
};

let _uid = 0;
const uid = () => `m${Date.now()}_${_uid++}`;

function renderRich(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <span key={i} className="mono" style={{ color: "var(--accent-soft)", fontSize: "0.92em" }}>{p.slice(1, -1)}</span>;
    return p;
  });
}

export default function Home() {
  const { user } = useAuth();
  const wake = useWake();
  const [listening, setListening] = useState(false);
  const [msgs, setMsgs] = useState([]); // {id, role: user|bot|tool, text, streaming, request, status, result}
  const [mode, setMode] = useState("welcome");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const sendMessage = useCallback((text) => {
    if (!text?.trim()) return;
    setMode("chat");
    setBusy(true);
    const botId = uid();
    setMsgs((m) => [
      ...m,
      { id: uid(), role: "user", text },
      { id: botId, role: "bot", text: "", streaming: true },
    ]);
    streamChat({
      message: text,
      sessionId: localStorage.getItem("cortexa_session") || undefined,
      onSession: (sid) => localStorage.setItem("cortexa_session", sid),
      onDelta: (t) => setMsgs((m) => m.map((x) => (x.id === botId ? { ...x, text: x.text + t } : x))),
      onToolRequest: (req) =>
        setMsgs((m) => [...m, { id: req.id, role: "tool", request: req, status: req.status || "pending" }]),
      onDone: () => {
        setBusy(false);
        setMsgs((m) => m.map((x) => (x.id === botId ? { ...x, streaming: false } : x)));
      },
      onError: () => {
        setBusy(false);
        setMsgs((m) =>
          m.map((x) =>
            x.id === botId
              ? {
                  ...x,
                  streaming: false,
                  text: x.text ? `${x.text}\n⚠️ Connection interrupted — reply may be incomplete.` : "⚠️ Unable to reach assistant.",
                }
              : x
          )
        );
      },
    });
  }, []);

  const resolveTool = async (msgId, approved) => {
    setMsgs((m) => m.map((x) => (x.id === msgId ? { ...x, busy: true, error: null } : x)));
    try {
      const { data } = await api.post(`/tools/${msgId}/resolve`, { approved });
      setMsgs((m) => m.map((x) => (x.id === msgId ? { ...x, busy: false, status: data.status, result: data.result } : x)));
    } catch (e) {
      const detail = e.response?.data?.detail || "Failed to resolve — please try again.";
      setMsgs((m) => m.map((x) => (x.id === msgId ? { ...x, busy: false, error: detail } : x)));
    }
  };

  // Wake word detected → enter listening mode
  useEffect(() => {
    if (wake?.wakeSignal > 0) setListening(true);
  }, [wake?.wakeSignal]);

  // Listening → capture speech and send it
  useEffect(() => {
    if (listening && wake?.supported) {
      const ok = wake.startDictation((text) => {
        setListening(false);
        if (text) sendMessage(text);
      });
      if (!ok) setListening(false);
    } else if (!listening) {
      wake?.stopDictation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

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
                color: "var(--text)",
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
            <CortexaCore state={listening ? "listening" : busy ? "thinking" : "idle"} />

            <div style={{ fontSize: 22, letterSpacing: "0.01em", color: "var(--text-bright)", marginTop: 6 }}>
              {listening ? "Listening…" : "How can I help you?"}
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
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                    {listening ? "Listening — speak now" : "Click to start listening"}
                  </div>
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
                  onClick={() => sendMessage(templates[qa.label] || qa.label)}
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
              <div style={{ width: 40, height: 40, borderRadius: 999, background: "radial-gradient(circle, var(--accent-1) 0%, var(--accent-2) 60%, transparent 100%)", boxShadow: "0 0 20px rgba(var(--accent-rgb),0.6)" }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Cortexa Assistant</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Claude Sonnet 4.6 · streaming · secure local execution</div>
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="cx-panel"
            style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}
            data-testid="chat-scroll"
          >
            {msgs.map((m) => {
              if (m.role === "user") return <div key={m.id} className="bubble-user" data-testid={`bubble-user-${m.id}`}>{m.text}</div>;
              if (m.role === "tool")
                return (
                  <PermissionCard
                    key={m.id}
                    request={m.request}
                    status={m.status}
                    result={m.result}
                    busy={m.busy}
                    error={m.error}
                    onResolve={(approved) => resolveTool(m.id, approved)}
                  />
                );
              return (
                <div key={m.id} className="bubble-bot" data-testid={`bubble-bot-${m.id}`}>
                  {m.text === "" && m.streaming ? (
                    <span className="dots"><span/><span/><span/></span>
                  ) : (
                    <>
                      {renderRich(m.text)}
                      {m.streaming && <span className="stream-caret" />}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CommandBar onSend={sendMessage} busy={busy} listening={listening} setListening={setListening} />
    </div>
  );
}
