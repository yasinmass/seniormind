import React, { useState } from "react";
import { ThemeProvider, useTheme, FONT_IMPORT } from "./context/ThemeContext";
import { seniorProfile } from "./data/seniorMockData";

import Onboarding from "./pages/senior/Onboarding";
import Home       from "./pages/senior/Home";
import Bhavi      from "./pages/senior/Bhavi";
import Reminders  from "./pages/senior/Reminders";
import More       from "./pages/senior/More";
import Help       from "./pages/senior/Help";
import BottomNav  from "./components/senior/BottomNav";
import CaregiverDashboard from "./pages/caregiver/CaregiverDashboard";

function AppShell() {
  const { theme } = useTheme();
  const [role, setRole]                     = useState("elder"); // 'elder' | 'caregiver'
  const [onboarded, setOnboarded]           = useState(false);
  const [tab, setTab]                       = useState("home");
  const [overlay, setOverlay]               = useState(null);
  const [inConversation, setInConversation] = useState(false);

  const phoneFrame = {
    width: "100%", maxWidth: 400, height: 780, maxHeight: "92vh",
    margin: "0 auto", background: theme.bg, borderRadius: 36,
    overflow: "hidden", position: "relative",
    boxShadow: "0 20px 50px rgba(23,32,51,0.18)", border: "8px solid #0F172A",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#EEF2F8", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{FONT_IMPORT}</style>

      {/* ── Top Role Selector Bar ────────────────────────────────────────────── */}
      <div style={{
        width: "100%",
        background: "#0F172A",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 100,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginRight: 8 }}>
          Bhavi AI Role:
        </div>
        <button
          onClick={() => setRole("elder")}
          style={{
            padding: "8px 18px",
            borderRadius: 20,
            border: "none",
            background: role === "elder" ? "#2563EB" : "#1E293B",
            color: role === "elder" ? "#FFFFFF" : "#94A3B8",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>👴</span> Elder Voice View
        </button>

        <button
          onClick={() => setRole("caregiver")}
          style={{
            padding: "8px 18px",
            borderRadius: 20,
            border: "none",
            background: role === "caregiver" ? "#2563EB" : "#1E293B",
            color: role === "caregiver" ? "#FFFFFF" : "#94A3B8",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🩺</span> Caregiver Dashboard
        </button>
      </div>

      {/* ── Main View ───────────────────────────────────────────────────────── */}
      {role === "caregiver" ? (
        <div style={{ width: "100%" }}>
          <CaregiverDashboard onSwitchRole={() => setRole("elder")} />
        </div>
      ) : (
        <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "center", padding: "24px 12px" }}>
          <div style={phoneFrame}>
            <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
              {!onboarded ? (
                <Onboarding onFinish={() => setOnboarded(true)} />
              ) : overlay === "help" ? (
                <Help onBack={() => setOverlay(null)} />
              ) : (
                <>
                  {tab === "home"      && <Home name={seniorProfile.name} inConversation={inConversation} onEnterConversation={() => setInConversation(true)} onExitConversation={() => setInConversation(false)} />}
                  {tab === "reminders" && <Reminders />}
                  {tab === "more"      && <More goHelp={() => setOverlay("help")} name={seniorProfile.name} />}
                </>
              )}
            </div>
            {onboarded && !overlay && !inConversation && <BottomNav tab={tab} setTab={setTab} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SeniorApp() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
