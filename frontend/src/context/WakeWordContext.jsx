import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const WAKE_RE = /\b(cortexa|cortex|kortexa|cortez)\b/i;

const Ctx = createContext(null);

export function WakeWordProvider({ children }) {
  const [enabled, setEnabledState] = useState(() => localStorage.getItem("cortexa_wake") === "1");
  const [wakeSignal, setWakeSignal] = useState(0);
  const [dictating, setDictating] = useState(false);
  const recRef = useRef(null);
  const st = useRef({ enabled: localStorage.getItem("cortexa_wake") === "1", mode: "idle", cb: null });

  const stopRec = () => {
    const r = recRef.current;
    recRef.current = null;
    if (r) {
      r.onend = null;
      r.onresult = null;
      try { r.stop(); } catch (_) {}
    }
  };

  const startWakeLoop = useCallback(() => {
    if (!SR || !st.current.enabled || st.current.mode === "dictation") return;
    stopRec();
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (WAKE_RE.test(txt)) {
        stopRec();
        st.current.mode = "idle";
        setWakeSignal((s) => s + 1);
      }
    };
    rec.onend = () => {
      if (st.current.enabled && st.current.mode === "wake") setTimeout(startWakeLoop, 400);
    };
    rec.onerror = () => {};
    st.current.mode = "wake";
    try { rec.start(); recRef.current = rec; } catch (_) {}
  }, []);

  const setEnabled = useCallback((v) => {
    localStorage.setItem("cortexa_wake", v ? "1" : "0");
    st.current.enabled = v;
    setEnabledState(v);
    if (v) startWakeLoop();
    else if (st.current.mode === "wake") { st.current.mode = "idle"; stopRec(); }
  }, [startWakeLoop]);

  const stopDictation = useCallback(() => {
    if (st.current.mode !== "dictation") return;
    st.current.mode = "idle";
    st.current.cb = null;
    setDictating(false);
    stopRec();
    if (st.current.enabled) startWakeLoop();
  }, [startWakeLoop]);

  const startDictation = useCallback((cb) => {
    if (!SR) return false;
    stopRec();
    st.current.mode = "dictation";
    st.current.cb = cb;
    setDictating(true);
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript || "";
      const fn = st.current.cb;
      st.current.cb = null;
      fn?.(t.trim());
    };
    rec.onend = () => {
      st.current.mode = "idle";
      const fn = st.current.cb;
      st.current.cb = null;
      setDictating(false);
      recRef.current = null;
      fn?.("");
      if (st.current.enabled) startWakeLoop();
    };
    rec.onerror = () => {};
    try { rec.start(); recRef.current = rec; } catch (_) { return false; }
    return true;
  }, [startWakeLoop]);

  useEffect(() => {
    if (st.current.enabled) startWakeLoop();
    return stopRec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{ supported: !!SR, enabled, setEnabled, wakeSignal, dictating, startDictation, stopDictation }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWake = () => useContext(Ctx);
