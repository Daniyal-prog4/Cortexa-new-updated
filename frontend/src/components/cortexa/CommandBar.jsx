import React, { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { useWake } from "@/context/WakeWordContext";

export default function CommandBar({ onSend, busy, listening, setListening }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);
  const { dictating } = useWake() || {};

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

  const send = () => {
    const msg = value.trim();
    if (!msg || busy) return;
    setValue("");
    onSend?.(msg);
  };

  const micActive = listening || dictating;

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
        title={micActive ? "Listening… click to stop" : "Speak to Cortexa"}
        data-testid="mic-btn"
        style={{ color: micActive ? "var(--accent-1)" : "var(--text-dim)" }}
      >
        <Mic size={18} />
      </button>
      <input
        ref={inputRef}
        data-testid="command-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder={micActive ? "Listening… say your command" : "Type your command here…"}
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
        onClick={send}
        disabled={busy}
        className="win-btn"
        data-testid="send-btn"
        style={{
          width: 40,
          height: 36,
          borderRadius: 10,
          border: "1px solid rgba(var(--accent-rgb),0.5)",
          background: "rgba(var(--accent-rgb),0.12)",
          color: "var(--accent-1)",
        }}
        title="Send"
      >
        {busy ? <span className="dots"><span/><span/><span/></span> : <Send size={17} />}
      </button>
    </div>
  );
}
