import { createContext, useContext, useState } from "react";

/* ------------------------------- Theme tokens ------------------------------- */

export const lightTheme = {
  mode: "light",
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  lightBlue: "#DBEAFE",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  white: "#FFFFFF",
  text: "#172033",
  textSoft: "#5B6475",
  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  border: "#EAEEF5",
  shadow: "rgba(23,32,51,0.08)",
  shadowSoft: "rgba(23,32,51,0.06)",
};

export const darkTheme = {
  mode: "dark",
  primary: "#3B82F6",
  primaryDark: "#60A5FA",
  lightBlue: "#1E3A5F",
  bg: "#0B1220",
  card: "#1A2436",
  white: "#FFFFFF",
  text: "#F1F5F9",
  textSoft: "#94A3B8",
  success: "#22C55E",
  successBg: "#153420",
  warning: "#FBBF24",
  warningBg: "#4A3510",
  danger: "#F87171",
  dangerBg: "#4A1616",
  border: "#2A3548",
  shadow: "rgba(0,0,0,0.35)",
  shadowSoft: "rgba(0,0,0,0.25)",
};

export const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap');

* { font-family: 'Atkinson Hyperlegible', 'Noto Sans', sans-serif; box-sizing: border-box; }

@keyframes pulseRing {
  0%   { transform: scale(1);   opacity: 0.55; }
  70%  { transform: scale(1.55);opacity: 0; }
  100% { transform: scale(1.55);opacity: 0; }
}
@keyframes pulseRingSlow {
  0%   { transform: scale(1);   opacity: 0.35; }
  100% { transform: scale(1.35);opacity: 0; }
}
@keyframes spinSoft {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes wave {
  0%, 100% { height: 10px; }
  50%      { height: 34px; }
}
@keyframes floatUp {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeIn 0.35s ease-out; }
button { cursor: pointer; }
button:focus-visible, [tabindex]:focus-visible { outline: 3px solid #1D4ED8; outline-offset: 2px; }
`;

export const ThemeContext = createContext({
  theme: lightTheme,
  mode: "light",
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("light");
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const toggleTheme = () => setMode((m) => (m === "dark" ? "light" : "dark"));
  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
