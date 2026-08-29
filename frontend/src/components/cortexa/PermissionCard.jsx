import React from "react";
import { ShieldAlert, Check, X, TerminalSquare } from "lucide-react";

export function PermissionCard({ request, status, result, busy, error, onResolve }) {
  const blocked = status === "blocked";
  return (
    <div className="perm-card" data-testid={`perm-card-${request.tool}`}>
      <div className="perm-head">
        <span className="perm-icon"><ShieldAlert size={18} /></span>
        <div style={{ flex: 1 }}>
          <div className="perm-title">{blocked ? "Action blocked" : "Permission required"}</div>
          <div className="perm-desc">{request.description}</div>
        </div>
        <span className={`perm-risk ${blocked ? "blocked" : ""}`}>{request.risk || "CONFIRM"}</span>
      </div>
      <div className="perm-cmd mono">
        <TerminalSquare size={13} style={{ flexShrink: 0 }} />
        <span><b>{request.tool}</b> — "{request.command}"</span>
      </div>
      {status === "pending" ? (
        <div className="perm-actions">
          <button className="perm-btn confirm" disabled={busy} onClick={() => onResolve(true)} data-testid="perm-confirm-btn">
            <Check size={15} /> Confirm & Run
          </button>
          <button className="perm-btn cancel" disabled={busy} onClick={() => onResolve(false)} data-testid="perm-cancel-btn">
            <X size={15} /> Cancel
          </button>
        </div>
      ) : (
        <div className={`perm-result ${blocked ? "denied" : status}`} data-testid="perm-result">
          {status === "executed" ? <Check size={14} /> : <X size={14} />}{" "}
          {blocked ? "Blocked by security policy — this action will never run." : result}
        </div>
      )}
      {error && (
        <div style={{ color: "var(--danger)", fontSize: 12 }} data-testid="perm-error">{error}</div>
      )}
    </div>
  );
}
