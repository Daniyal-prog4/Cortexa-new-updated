import React from "react";

// Cortexa hexagonal logo — accent-aware
export function CortexaLogo({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 0 8px rgba(var(--accent-rgb),0.55))" }}
    >
      <path
        d="M20 3 L34.5 11.5 V28.5 L20 37 L5.5 28.5 V11.5 Z"
        strokeWidth="2"
        style={{ stroke: "var(--accent-1)", fill: "rgba(var(--accent-rgb),0.06)" }}
      />
      <path
        d="M20 9.2 L29.2 14.6 V25.4 L20 30.8 L10.8 25.4 V14.6 Z"
        strokeWidth="1.2"
        fill="none"
        opacity="0.7"
        style={{ stroke: "var(--accent-soft)" }}
      />
      <circle cx="20" cy="20" r="3" style={{ fill: "var(--accent-1)" }} />
    </svg>
  );
}

export function CortexaWordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <CortexaLogo size={34} />
      <span
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: "0.14em",
          color: "var(--accent-1)",
          textShadow: "0 0 14px rgba(var(--accent-rgb),0.6)",
        }}
      >
        CORTEXA
      </span>
    </div>
  );
}
