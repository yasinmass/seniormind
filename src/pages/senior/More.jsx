import React from "react";
import { Sun, Moon, User, Languages, Volume2, Bell, Users, PhoneCall, HelpCircle } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import ScreenShell from "../../components/senior/ScreenShell";
import TopBar from "../../components/senior/TopBar";
import SettingsRow from "../../components/senior/SettingsRow";
import SettingsToggleRow from "../../components/senior/SettingsToggleRow";
import { seniorProfile } from "../../data/seniorMockData";

export default function More({ goHelp, name }) {
  const { theme, mode, toggleTheme } = useTheme();
  const displayName = name || seniorProfile.name;
  return (
    <ScreenShell bottomPad>
      <TopBar title="More" />
      <div style={{ padding: "6px 20px" }}>
        <div style={{ background: theme.lightBlue, borderRadius: 22, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: theme.primary, color: theme.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, flexShrink: 0 }}>
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: theme.text, margin: 0 }}>{displayName}</p>
            <p style={{ fontSize: 17, color: theme.primaryDark, margin: "4px 0 0" }}>View profile</p>
          </div>
        </div>
        <SettingsRow icon={User}      label="My Profile" />
        <SettingsRow icon={Languages} label="Language"         value="English"       />
        <SettingsRow icon={Volume2}   label="Voice"            value="Warm & Gentle" />
        <SettingsRow icon={Bell}      label="Notifications"    value="On"            />
        <SettingsToggleRow icon={mode === "dark" ? Moon : Sun} label="Dark Mode" checked={mode === "dark"} onChange={toggleTheme} />
        <SettingsRow icon={Users}     label="My Family"          />
        <SettingsRow icon={PhoneCall} label="Emergency Contact"  />
        <SettingsRow icon={HelpCircle} label="Help" onClick={goHelp} />
      </div>
    </ScreenShell>
  );
}
