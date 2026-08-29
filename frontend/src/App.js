import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
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
import Auth from "@/pages/Auth";

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

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", color: "var(--text-dim)" }}>
        <span className="dots"><span/><span/><span/></span>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthRedirect><Auth /></AuthRedirect>} />
      <Route path="/" element={<Protected><Shell><Home /></Shell></Protected>} />
      <Route path="/agents" element={<Protected><Shell><Agents /></Shell></Protected>} />
      <Route path="/memory" element={<Protected><Shell><Memory /></Shell></Protected>} />
      <Route path="/tasks" element={<Protected><Shell><Tasks /></Shell></Protected>} />
      <Route path="/system" element={<Protected><Shell><System /></Shell></Protected>} />
      <Route path="/history" element={<Protected><Shell><History /></Shell></Protected>} />
      <Route path="/settings" element={<Protected><Shell hideRightPanel><Settings /></Shell></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthRedirect({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="App" style={{ height: "100vh" }}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
