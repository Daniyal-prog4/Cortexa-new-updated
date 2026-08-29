import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  Database,
  CheckSquare,
  Cpu,
  History,
  Settings,
  ChevronDown,
} from "lucide-react";
import { CortexaWordmark } from "./Logo";
import { useAuth } from "@/context/AuthContext";

const items = [
  { to: "/", label: "Home", icon: Home, testid: "nav-home" },
  { to: "/agents", label: "Agents", icon: Users, testid: "nav-agents" },
  { to: "/memory", label: "Memory", icon: Database, testid: "nav-memory" },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, testid: "nav-tasks" },
  { to: "/system", label: "System", icon: Cpu, testid: "nav-system" },
  { to: "/history", label: "History", icon: History, testid: "nav-history" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const initial = (user?.name || "U").trim().charAt(0).toUpperCase();
  return (
    <aside
      className="cx-panel"
      style={{
        width: 244,
        height: "100%",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderRadius: 0,
        borderTop: 0,
        borderBottom: 0,
        borderLeft: 0,
      }}
      data-testid="sidebar"
    >
      <div style={{ padding: "6px 4px 22px" }}>
        <CortexaWordmark />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            data-testid={it.testid}
            className={({ isActive }) => `side-item ${isActive ? "active" : ""}`}
          >
            <it.icon size={19} strokeWidth={1.7} />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <button
        data-testid="user-menu-trigger"
        onClick={logout}
        className="cx-panel"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          borderRadius: 14,
          border: "1px solid var(--border-accent)",
          cursor: "pointer",
          background: "rgba(11,17,34,0.6)",
        }}
        title="Sign out"
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            color: "#050914",
            boxShadow: "0 0 14px rgba(var(--accent-rgb),0.5)",
          }}
        >
          {initial}
        </div>
        <div style={{ textAlign: "left", flex: 1 }}>
          <div style={{ fontSize: 15, color: "var(--text)" }}>{user?.name || "Guest"}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{user?.plan || "Pro"} Plan</div>
        </div>
        <ChevronDown size={16} color="var(--text-dim)" />
      </button>
    </aside>
  );
}
