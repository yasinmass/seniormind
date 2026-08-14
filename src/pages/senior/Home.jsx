import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Pill } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import ScreenShell from "../../components/senior/ScreenShell";
import SeniorHeader from "../../components/senior/SeniorHeader";
import VoiceButton from "../../components/senior/VoiceButton";
import VoiceState from "../../components/senior/VoiceState";
import ReminderCard from "../../components/senior/ReminderCard";
import { nextReminder } from "../../data/seniorMockData";

const STATE_LABELS = {
  idle: "Talk to Bhavi", listening: "Listening...",
  thinking: "Thinking...", speaking: "Bhavi is speaking",
};

export default function Home({ name, inConversation, onEnterConversation, onExitConversation }) {
  const { theme } = useTheme();
  const [state, setState] = useState("idle");
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const startConversation = () => {
    if (inConversation) return;
    onEnterConversation();
    setState("listening");
    timers.current.push(setTimeout(() => setState("thinking"), 2200));
    timers.current.push(setTimeout(() => setState("speaking"), 3600));
    timers.current.push(setTimeout(() => setState("idle"),     6400));
  };

  const handleBack = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setState("idle");
    onExitConversation();
  };

  return (
    <ScreenShell bottomPad={!inConversation}>
      {inConversation ? (
        <div style={{ padding: "22px 20px 6px" }}>
          <button onClick={handleBack} aria-label="Back to Home" style={{
            width: 48, height: 48, borderRadius: 16, border: "none",
            background: theme.card, boxShadow: "0 1px 3px rgba(23,32,51,0.08)",
            color: theme.text, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ArrowLeft size={22} strokeWidth={2.25} />
          </button>
        </div>
      ) : (
        <SeniorHeader name={name} />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <VoiceButton state={state} onClick={startConversation} disabled={inConversation} />
        <p style={{ fontSize: 22, fontWeight: 700, color: theme.primaryDark, marginTop: 20 }}>
          {STATE_LABELS[state]}
        </p>
        <VoiceState state={state} visible={inConversation} />
      </div>

      {!inConversation && (
        <div style={{ padding: "0 20px" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: theme.textSoft, letterSpacing: 0.4, margin: "0 0 8px 4px" }}>
            NEXT REMINDER
          </p>
          <ReminderCard icon={Pill} title={nextReminder.title} time={nextReminder.time} compact />
        </div>
      )}
    </ScreenShell>
  );
}
