import React from "react";
import { Phone, Stethoscope, AlertTriangle } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import ScreenShell from "../../components/senior/ScreenShell";
import TopBar from "../../components/senior/TopBar";
import BigButton from "../../components/senior/BigButton";

export default function Help({ onBack }) {
  const { theme } = useTheme();
  return (
    <ScreenShell>
      <TopBar title="Need Help?" onBack={onBack} />
      <div style={{ padding: "16px 20px" }}>
        <p style={{ fontSize: 20, color: theme.textSoft, margin: "0 0 26px", lineHeight: 1.5 }}>
          Choose who you'd like to reach.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <BigButton tone="light"><Phone size={22} strokeWidth={2.25} /> Call Family</BigButton>
          <BigButton tone="light"><Stethoscope size={22} strokeWidth={2.25} /> Call Caregiver</BigButton>
          <BigButton tone="danger"><AlertTriangle size={22} strokeWidth={2.25} /> Emergency</BigButton>
        </div>
      </div>
    </ScreenShell>
  );
}
