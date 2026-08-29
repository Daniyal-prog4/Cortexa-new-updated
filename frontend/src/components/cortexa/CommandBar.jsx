import React, { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { api } from "@/lib/api";

export default function CommandBar({ onSent, listening, setListening }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const send = async (text) => {
    const msg = (text ?? value).trim();
    if (!msg || busy) return;
    setValue("");
    setBusy(true);
    try {
      const sid = localStorage.getItem("cortexa_session") || undefined;
      const { data } = await api.post("/chat", { message: msg, session_id: sid });
      localStorage.setItem("cortexa_session", data.session_id);
      onSent?.({ user: msg, reply: data.reply, session_id: data.session_id });
    } catch (e) {
      onSent?.({ user: msg, reply: "⚠️ Sorry, I couldn't reach the assistant.", error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="cx-panel"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 14,
      }}
      data-testid="command-bar"
    >
      <button
        onClick={() => setListening?.(!listening)}
        className="win-btn"
        title="Push to talk (simulated)"
        data-testid="mic-btn"
        style={{ color: listening ? "#22d3ee" : "var(--text-dim)" }}
      >
        <Mic size={18} />
      </button>
      <input
        ref={inputRef}
        data-testid="command-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="Type your command here…"
        style={{
          flex: 1,
          background: "transparent",
          border: 0,
          outline: 0,
          color: "var(--text)",
          fontFamily: "inherit",
          fontSize: 16,
          padding: "10px 4px",
        }}
      />
      <button
        onClick={() => send()}
        disabled={busy}
        className="win-btn"
        data-testid="send-btn"
        style={{
          width: 40,
          height: 36,
          borderRadius: 10,
          border: "1px solid rgba(34,211,238,0.5)",
          background: "rgba(34,211,238,0.12)",
          color: "#22d3ee",
        }}
        title="Send"
      >
        {busy ? <span className="dots"><span/><span/><span/></span> : <Send size={17} />}
      </button>
    </div>
  );
}
