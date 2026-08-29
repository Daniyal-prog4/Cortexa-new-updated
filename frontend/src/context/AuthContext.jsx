import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("cortexa_token");
    if (!t) { setLoading(false); return; }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => {
      localStorage.removeItem("cortexa_token");
    }).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("cortexa_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    localStorage.setItem("cortexa_token", data.token);
    setUser(data.user);
    // Auto-activate a default device
    try {
      await api.post("/devices/activate", {
        device_name: `${name}'s PC`,
        platform: "Windows",
      });
    } catch (_) {}
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("cortexa_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
