import React, { useState } from "react";
import { ThemeProvider, useTheme, FONT_IMPORT } from "./context/ThemeContext";
import { seniorProfile } from "./data/seniorMockData";

import PortalLogin from "./pages/auth/PortalLogin";
import Onboarding from "./pages/senior/Onboarding";
import Home       from "./pages/senior/Home";
import Bhavi      from "./pages/senior/Bhavi";
import Reminders  from "./pages/senior/Reminders";
import More       from "./pages/senior/More";
import Help       from "./pages/senior/Help";
import BottomNav  from "./components/senior/BottomNav";
import CaregiverDashboard from "./pages/caregiver/CaregiverDashboard";
import { caregiverApi } from "./pages/caregiver/api/caregiverApi";

function AppShell() {
  const { theme } = useTheme();

  // Load existing session from storage if present
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem("senior_auth_session");
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const [onboarded, setOnboarded]           = useState(false);
  const [tab, setTab]                       = useState("home");
  const [overlay, setOverlay]               = useState(null);
  const [inConversation, setInConversation] = useState(false);

  // Elder Login Handler
  const handleElderLogin = (elderName) => {
    const newSession = {
      role: "elder",
      name: elderName || seniorProfile.name,
      userIdentifier: "default_user",
      loginTime: new Date().toISOString(),
    };
    try {
      localStorage.setItem("senior_auth_session", JSON.stringify(newSession));
    } catch (_) {}
    setSession(newSession);
  };

  // Caregiver Login Handler
  const handleCaregiverLogin = (caregiverData) => {
    const newSession = {
      role: "caregiver",
      caregiver: caregiverData,
      loginTime: new Date().toISOString(),
    };
    try {
      localStorage.setItem("senior_auth_session", JSON.stringify(newSession));
    } catch (_) {}
    setSession(newSession);
  };

  // Global Logout Handler
  const handleLogout = async () => {
    try {
      localStorage.removeItem("senior_auth_session");
      await caregiverApi.logout();
    } catch (_) {}
    setSession(null);
    setTab("home");
    setOverlay(null);
    setInConversation(false);
  };

  const phoneFrame = {
    width: "100%", maxWidth: 400, height: 780, maxHeight: "92vh",
    margin: "0 auto", background: theme.bg, borderRadius: 36,
    overflow: "hidden", position: "relative",
    boxShadow: "0 20px 50px rgba(23,32,51,0.18)", border: "8px solid #0F172A",
  };

  // ── 1. Unauthenticated: PortalLogin is the primary entry point ─────────────
  if (!session) {
    return (
      <PortalLogin
        onSelectElder={handleElderLogin}
        onSelectCaregiver={handleCaregiverLogin}
      />
    );
  }

  // ── 2. Authenticated as Caregiver: Caregiver Dashboard Only ────────────────
  if (session.role === "caregiver") {
    return (
      <div style={{ width: "100%" }}>
        <CaregiverDashboard onLogout={handleLogout} />
      </div>
    );
  }

  // ── 3. Authenticated as Senior: Senior Voice Interface Only ────────────────
  const seniorName = session.name || seniorProfile.name;
  return (
    <div style={{ minHeight: "100vh", background: "#EEF2F8", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "center", padding: "24px 12px" }}>
        <div style={phoneFrame}>
          <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            {!onboarded ? (
              <Onboarding onFinish={() => setOnboarded(true)} />
            ) : overlay === "help" ? (
              <Help onBack={() => setOverlay(null)} />
            ) : (
              <>
                {tab === "home"      && (
                  <Home
                    name={seniorName}
                    inConversation={inConversation}
                    onEnterConversation={() => setInConversation(true)}
                    onExitConversation={() => setInConversation(false)}
                  />
                )}
                {tab === "reminders" && <Reminders />}
                {tab === "more"      && (
                  <More
                    goHelp={() => setOverlay("help")}
                    name={seniorName}
                    onLogout={handleLogout}
                    userIdentifier={session.userIdentifier || "default_user"}
                  />
                )}
              </>
            )}
          </div>
          {onboarded && !overlay && !inConversation && <BottomNav tab={tab} setTab={setTab} />}
        </div>
      </div>
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
