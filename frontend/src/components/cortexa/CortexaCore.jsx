import React from "react";

const BAR_COUNT = 26;

function waveBars(mirror) {
  return Array.from({ length: BAR_COUNT }).map((_, i) => {
    const envelope = Math.exp(-i / 11);
    const pattern = 0.3 + 0.7 * (Math.abs(Math.sin(i * 2.13) + Math.sin(i * 0.71)) / 2);
    const h = Math.max(6, Math.round(10 + 78 * envelope * pattern));
    const d = (1.15 + ((i * 7) % 9) * 0.09).toFixed(2);
    const delay = ((mirror ? BAR_COUNT - i : i) * 0.055).toFixed(2);
    return (
      <span
        key={i}
        className="wbar"
        style={{ "--h": `${h}px`, "--d": `${d}s`, animationDelay: `${delay}s` }}
      />
    );
  });
}

export function CortexaCore({ state = "idle" }) {
  return (
    <div className="core2-wrap" data-testid="cortexa-core" data-state={state}>
      <div className="core2-halo" />

      <div className="core2-wave left">{waveBars(true)}</div>
      <div className="core2-wave right">{waveBars(false)}</div>

      <svg className="core2-rings" viewBox="0 0 340 340" fill="none">
        {/* Fine tick ring */}
        <circle
          cx="170" cy="170" r="162"
          strokeWidth="1"
          strokeDasharray="1.5 6.2"
          style={{ stroke: "rgba(var(--accent-rgb), 0.42)" }}
        />
        {/* Segmented outer arcs */}
        <g className="rot slow">
          <circle
            cx="170" cy="170" r="146"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="110 42 58 42 210 455"
            style={{ stroke: "rgba(var(--accent-rgb), 0.6)" }}
          />
          <circle cx="170" cy="24" r="3.4" style={{ fill: "var(--accent-1)", filter: "drop-shadow(0 0 6px var(--accent-1))" }} />
        </g>
        {/* Mid counter-rotating arc */}
        <g className="rot rev">
          <circle
            cx="170" cy="170" r="128"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="250 554"
            style={{ stroke: "rgba(var(--accent-rgb), 0.5)" }}
          />
        </g>
        {/* Bright sweep arc */}
        <g className="rot fast">
          <circle
            cx="170" cy="170" r="106"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="145 521"
            style={{ stroke: "var(--accent-1)", filter: "drop-shadow(0 0 8px rgba(var(--accent-rgb), 0.9))" }}
          />
          <circle
            cx="170" cy="170" r="106"
            strokeWidth="1"
            strokeDasharray="30 40 12 584"
            strokeDashoffset="-220"
            style={{ stroke: "rgba(var(--accent-rgb), 0.25)" }}
          />
        </g>
        {/* Inner precision ring hugging the orb */}
        <circle
          cx="170" cy="170" r="86"
          strokeWidth="1"
          strokeDasharray="4 5"
          style={{ stroke: "rgba(var(--accent-rgb), 0.5)" }}
        />
      </svg>

      <div className="core2-orb">
        <div className="core2-aurora" />
        <span className="core2-letter">C</span>
      </div>
    </div>
  );
}
