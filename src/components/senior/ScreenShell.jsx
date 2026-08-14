import React from "react";
import { useTheme } from "../../context/ThemeContext";

export default function ScreenShell({ children, bottomPad }) {
  const { theme } = useTheme();
  return (
    <div
      className="fade-in"
      style={{
        minHeight: "100%",
        background: theme.bg,
        paddingBottom: bottomPad ? 110 : 24,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}
