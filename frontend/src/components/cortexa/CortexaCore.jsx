import React from "react";

/**
 * Cortexa Core (Assistant Orb) — animated circular indicator
 * with rotating rings and side waveforms. Matches the reference image.
 */
export function CortexaCore({ state = "idle" }) {
  return (
    <div className="core-wrap" data-testid="cortexa-core" data-state={state}>
      <div className="core-ring r1" />
      <div className="core-ring r2" />
      <div className="core-ring r3" />
      <div className="core-tick" />

      <div className="core-wave left">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={`l-${i}`}
            className="bar"
            style={{ animationDelay: `${(23 - i) * 0.06}s` }}
          />
        ))}
      </div>
      <div className="core-wave right">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={`r-${i}`}
            className="bar"
            style={{ animationDelay: `${i * 0.06}s` }}
          />
        ))}
      </div>

      <div className="core-orb">
        <span className="core-letter">C</span>
      </div>
    </div>
  );
}
