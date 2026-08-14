import React from "react";
import { useTheme } from "../../context/ThemeContext";
import ScreenShell from "../../components/senior/ScreenShell";
import TopBar from "../../components/senior/TopBar";
import ReminderCard from "../../components/senior/ReminderCard";
import { reminders } from "../../data/seniorMockData";

export default function Reminders() {
  const { theme } = useTheme();
  return (
    <ScreenShell bottomPad>
      <TopBar title="My Reminders" />
      <div style={{ padding: "6px 20px" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: theme.textSoft, letterSpacing: 0.4, margin: "10px 0 12px 4px" }}>
          TODAY
        </p>
        {reminders.map((r) => (
          <ReminderCard key={r.title} icon={r.icon} title={r.title} time={r.time} taken={r.taken} />
        ))}
      </div>
    </ScreenShell>
  );
}
