import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CortexaLogo } from "@/components/cortexa/Logo";
import { Mail, Lock, User, ArrowRight } from "lucide-react";

export default function Auth() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (e2) {
      setErr(e2.response?.data?.detail || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        position: "relative",
      }}
      data-testid="auth-screen"
    >
      <div className="cx-panel fade-in" style={{ width: "100%", maxWidth: 460, padding: 36, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 26 }}>
          <CortexaLogo size={64} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.14em", color: "#22d3ee", textShadow: "0 0 14px rgba(34,211,238,0.6)" }}>CORTEXA</div>
            <div style={{ color: "var(--text-dim)", marginTop: 6, fontSize: 14 }}>
              {mode === "login" ? "Activate your device to continue" : "Create your Cortexa account"}
            </div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <div style={{ position: "relative" }}>
              <User size={16} color="var(--text-dim)" style={{ position: "absolute", left: 14, top: 15 }} />
              <input
                data-testid="auth-name"
                className="cx-input"
                style={{ paddingLeft: 42 }}
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          )}
          <div style={{ position: "relative" }}>
            <Mail size={16} color="var(--text-dim)" style={{ position: "absolute", left: 14, top: 15 }} />
            <input
              data-testid="auth-email"
              className="cx-input"
              style={{ paddingLeft: 42 }}
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div style={{ position: "relative" }}>
            <Lock size={16} color="var(--text-dim)" style={{ position: "absolute", left: 14, top: 15 }} />
            <input
              data-testid="auth-password"
              className="cx-input"
              style={{ paddingLeft: 42 }}
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          {err && <div style={{ color: "#fca5a5", fontSize: 13 }} data-testid="auth-error">{err}</div>}
          <button
            type="submit"
            className="cx-btn"
            disabled={busy}
            style={{
              justifyContent: "center",
              marginTop: 6,
              background: "linear-gradient(135deg, rgba(34,211,238,0.22), rgba(6,182,212,0.12))",
              borderColor: "rgba(34,211,238,0.5)",
              padding: "12px 18px",
              fontSize: 16,
            }}
            data-testid="auth-submit"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, color: "var(--text-dim)", fontSize: 14 }}>
          {mode === "login" ? (
            <>New here? <button type="button" onClick={() => setMode("register")} style={{ background: "none", border: 0, color: "var(--cyan-1)", cursor: "pointer" }} data-testid="switch-register">Create account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => setMode("login")} style={{ background: "none", border: 0, color: "var(--cyan-1)", cursor: "pointer" }} data-testid="switch-login">Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
