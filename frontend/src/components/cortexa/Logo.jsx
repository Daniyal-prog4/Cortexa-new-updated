import React from "react";

// Cortexa hexagonal logo - matches reference exactly
export function CortexaLogo({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.55))" }}
    >
      <defs>
        <linearGradient id="cx-hex" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <path
        d="M20 3 L34.5 11.5 V28.5 L20 37 L5.5 28.5 V11.5 Z"
        stroke="url(#cx-hex)"
        strokeWidth="2"
        fill="rgba(34,211,238,0.06)"
      />
      <path
        d="M20 9.2 L29.2 14.6 V25.4 L20 30.8 L10.8 25.4 V14.6 Z"
        stroke="#67e8f9"
        strokeWidth="1.2"
        fill="none"
        opacity="0.7"
      />
      <circle cx="20" cy="20" r="3" fill="#22d3ee" />
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
          color: "#22d3ee",
          textShadow: "0 0 14px rgba(34,211,238,0.6)",
        }}
      >
        CORTEXA
      </span>
    </div>
  );
}
