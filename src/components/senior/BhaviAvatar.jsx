import React from "react";
import { useTheme } from "../../context/ThemeContext";

export default function BhaviAvatar({ state = "idle" }) {
  const { theme } = useTheme();
  return (
    <div style={{
      width: 130, height: 130, borderRadius: "50%",
      background: `radial-gradient(circle at 35% 30%, #93C5FD, ${theme.primary})`,
      marginBottom: 34, boxShadow: "0 10px 24px rgba(37,99,235,0.28)",
      animation: state === "idle" ? "floatUp 3.5s ease-in-out infinite" : "none",
    }} />
  );
}
