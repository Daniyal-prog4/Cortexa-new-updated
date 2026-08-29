import { API } from "@/lib/api";

export async function streamChat({ message, sessionId, onSession, onDelta, onToolRequest, onDone, onError }) {
  const token = localStorage.getItem("cortexa_token");
  try {
    const res = await fetch(`${API}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, session_id: sessionId || null }),
    });
    if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`);
    let doneFired = false;
    const fireDone = () => { if (!doneFired) { doneFired = true; onDone?.(); } };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const p of parts) {
        const line = p.trim();
        if (!line.startsWith("data:")) continue;
        let evt;
        try { evt = JSON.parse(line.slice(5)); } catch (_) { continue; }
        if (evt.type === "session") onSession?.(evt.session_id);
        else if (evt.type === "delta") onDelta?.(evt.text);
        else if (evt.type === "tool_request") onToolRequest?.(evt.request);
        else if (evt.type === "error") onError?.(evt.detail);
        else if (evt.type === "done") fireDone();
      }
    }
    fireDone();
  } catch (e) {
    onError?.(e.message);
  }
}
