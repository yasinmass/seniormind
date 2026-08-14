import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import BigButton from "../../components/senior/BigButton";
import { onboardingLanguages, onboardingInterests, onboardingVoices } from "../../data/seniorMockData";

const TOTAL_STEPS = 6;

function ProgressDots({ step, total }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === step ? 22 : 8, height: 8, borderRadius: 4,
          background: i === step ? theme.primary : theme.border,
          transition: "all 0.2s ease",
        }} />
      ))}
    </div>
  );
}

export default function Onboarding({ onFinish }) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [lang, setLang] = useState("English");
  const [interests, setInterests] = useState([]);
  const [voice, setVoice] = useState("Warm & Gentle");

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const toggleInterest = (i) => setInterests((cur) => cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]);

  return (
    <div style={{
      minHeight: "100%", background: theme.bg, display: "flex",
      flexDirection: "column", justifyContent: "space-between", padding: "28px 24px 30px",
    }}>
      <div className="fade-in" key={step} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 18, animation: "floatUp 3s ease-in-out infinite" }}>💙</div>
            <h1 style={{ fontSize: 30, fontWeight: 700, color: theme.text, margin: "0 0 10px" }}>Welcome to SeniorMind ❤️</h1>
            <p style={{ fontSize: 20, color: theme.textSoft, lineHeight: 1.5 }}>Let's get things ready for you.</p>
          </div>
        )}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: "0 0 22px", textAlign: "center" }}>What should we call you?</h1>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
              style={{ width: "100%", fontSize: 22, padding: "18px 20px", borderRadius: 18, border: `2px solid ${theme.border}`, background: theme.card, color: theme.text, textAlign: "center" }} />
          </div>
        )}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: "0 0 22px", textAlign: "center" }}>Choose your language</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {onboardingLanguages.map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: "20px", borderRadius: 18, fontSize: 22, fontWeight: 700,
                  border: lang === l ? `2px solid ${theme.primary}` : `2px solid ${theme.border}`,
                  background: lang === l ? theme.lightBlue : theme.card,
                  color: lang === l ? theme.primaryDark : theme.text,
                }}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: "0 0 22px", textAlign: "center" }}>What do you enjoy?</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              {onboardingInterests.map(([label, icon]) => {
                const active = interests.includes(label);
                return (
                  <button key={label} onClick={() => toggleInterest(label)} style={{
                    padding: "16px 20px", borderRadius: 18, fontSize: 20, fontWeight: 700,
                    border: active ? `2px solid ${theme.primary}` : `2px solid ${theme.border}`,
                    background: active ? theme.lightBlue : theme.card,
                    color: active ? theme.primaryDark : theme.text,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 22 }}>{icon}</span> {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {step === 4 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: "0 0 22px", textAlign: "center" }}>How would you like Bhavi to speak?</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {onboardingVoices.map((v) => (
                <button key={v} onClick={() => setVoice(v)} style={{
                  padding: "20px", borderRadius: 18, fontSize: 21, fontWeight: 700,
                  border: voice === v ? `2px solid ${theme.primary}` : `2px solid ${theme.border}`,
                  background: voice === v ? theme.lightBlue : theme.card,
                  color: voice === v ? theme.primaryDark : theme.text,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  {v} {voice === v ? "🔊" : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 5 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 18 }}>❤️</div>
            <h1 style={{ fontSize: 30, fontWeight: 700, color: theme.text, margin: "0 0 10px" }}>
              You're all set{name ? `, ${name}` : ""} ❤️
            </h1>
            <p style={{ fontSize: 20, color: theme.textSoft, lineHeight: 1.5 }}>Bhavi is ready to talk with you.</p>
          </div>
        )}
      </div>
      <div>
        <ProgressDots step={step} total={TOTAL_STEPS} />
        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          {step > 0 && <BigButton tone="white" onClick={back} style={{ flex: 1 }}>Back</BigButton>}
          <BigButton onClick={step === TOTAL_STEPS - 1 ? onFinish : next} style={{ flex: 2 }}>
            {step === TOTAL_STEPS - 1 ? "Start" : "Continue"}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
