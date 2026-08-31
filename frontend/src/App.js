import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { WakeWordProvider, useWake } from "@/context/WakeWordContext";
import Sidebar from "@/components/cortexa/Sidebar";
import TitleBar from "@/components/cortexa/TitleBar";
import RightPanel from "@/components/cortexa/RightPanel";
import Home from "@/pages/Home";
import Agents from "@/pages/Agents";
import Memory from "@/pages/Memory";
import Tasks from "@/pages/Tasks";
import System from "@/pages/System";
import History from "@/pages/History";
import Settings from "@/pages/Settings";

function Shell({ children, hideRightPanel = false }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", position: "relative", zIndex: 1 }}>
      <Sidebar />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <TitleBar />
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
            {children}
          </div>
          {!hideRightPanel && <RightPanel />}
        </div>
      </div>
    </div>
  );
}

// NOTE: login/auth gating removed — the app now opens straight to Home.
// Backend has no auth checks anymore either (see server.py current_user()),
// so there's nothing left to protect here.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Shell><Home /></Shell>} />
      <Route path="/agents" element={<Shell><Agents /></Shell>} />
      <Route path="/memory" element={<Shell><Memory /></Shell>} />
      <Route path="/tasks" element={<Shell><Tasks /></Shell>} />
      <Route path="/system" element={<Shell><System /></Shell>} />
      <Route path="/history" element={<Shell><History /></Shell>} />
      <Route path="/settings" element={<Shell hideRightPanel><Settings /></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function WakeWordManager() {
  const wake = useWake();
  const navigate = useNavigate();
  useEffect(() => {
    if (wake?.wakeSignal > 0) navigate("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wake?.wakeSignal]);
  return null;
}

export default function App() {
  return (
    <div className="App" style={{ height: "100vh" }}>
      <ThemeProvider>
        <AuthProvider>
          <WakeWordProvider>
            <BrowserRouter>
              <WakeWordManager />
              <AppRoutes />
            </BrowserRouter>
          </WakeWordProvider>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}