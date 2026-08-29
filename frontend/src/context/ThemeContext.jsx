import React, { createContext, useContext, useEffect, useState } from "react";

export const THEMES = [
  { key: "royal", label: "Royal Blue", color: "#4a6cff" },
  { key: "violet", label: "Violet", color: "#8b5cf6" },
  { key: "emerald", label: "Emerald", color: "#10b981" },
  { key: "crimson", label: "Crimson", color: "#f43f5e" },
];

const Ctx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("cortexa_theme") || "royal");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("cortexa_theme", theme);
  }, [theme]);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
