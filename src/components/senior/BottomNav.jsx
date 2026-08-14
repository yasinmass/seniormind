import React from "react";
import { Home as HomeIcon, BellRing, Menu } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const NAV_ITEMS = [
  { key: "home",      label: "Home",      Icon: HomeIcon },
  { key: "reminders", label: "Reminders", Icon: BellRing },
  { key: "more",      label: "More",      Icon: Menu     },
];

export default function BottomNav({ tab, setTab }) {
  const { theme } = useTheme();
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: theme.card, borderTop: "1px solid #EAEEF5",
      display: "flex",
      padding: "12px 6px calc(8px + env(safe-area-inset-bottom))",
      boxShadow: "0 -2px 10px rgba(23,32,51,0.05)",
    }}>
      {NAV_ITEMS.map((item) => {
        const active = tab === item.key;
        const { Icon } = item;
        return (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6, padding: "4px 4px 0",
              background: "transparent", border: "none",
              color: active ? theme.primary : theme.textSoft,
            }}
          >
            <Icon size={26} strokeWidth={2}
              fill={active && item.key === "home" ? theme.primary : "none"}
              color={active ? theme.primary : theme.textSoft} />
            <span style={{ fontSize: 13, fontWeight: 700, color: active ? theme.primary : theme.textSoft }}>
              {item.label}
            </span>
            <span style={{
              width: active ? 22 : 0, height: 3, borderRadius: 2,
              background: theme.primary, marginTop: 2, transition: "width 0.15s ease",
            }} />
          </button>
        );
      })}
    </div>
  );
}
