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

function AppShell() {
  const { theme } = useTheme();
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
    <div style={{ minHeight: "100vh", background: "#EEF2F8", display: "flex", alignItems: "center", padding: "24px 12px" }}>
      <style>{FONT_IMPORT}</style>
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
  );
}

export default function SeniorApp() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
