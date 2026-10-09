import React, { useState } from "react";
import {
  Shield,
  AlertCircle,
  Heart,
  Eye,
  EyeOff,
} from "lucide-react";
import { caregiverApi } from "../caregiver/api/caregiverApi";
import loginHeroImg from "../caregiver/assets/caregiver_login_hero.jpg";

export default function PortalLogin({ onSelectElder, onSelectCaregiver }) {
  // Role tab: 'caregiver' | 'elder'
  const [roleTab, setRoleTab] = useState("caregiver");

  // Elder profile choice
  const [elderName, setElderName] = useState("Raman");

  // Caretaker form states
  const [elderId, setElderId] = useState("");
  const [caretakerSlot, setCaretakerSlot] = useState("1"); // "1" | "2"
  const [caretakerName, setCaretakerName] = useState("Anita Raman");
  const [caretakerPhone, setCaretakerPhone] = useState("+91 98401 12233");
  const [password, setPassword] = useState("••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [caregiverLoading, setCaregiverLoading] = useState(false);
  const [caregiverError, setCaregiverError] = useState(null);

  // Handle Caretaker Sign In
  const handleCaregiverSubmit = async (e) => {
    e.preventDefault();
    setCaregiverError(null);
    setCaregiverLoading(true);

    try {
      if (!elderId.trim()) {
        throw new Error("Please provide the Senior ID (format: SM-XXXX-YYYY). Your senior can find it in their Settings page.");
      }
      if (!caretakerPhone.trim()) {
        throw new Error("Please provide your Caretaker Phone Number.");
      }

      const res = await caregiverApi.loginSimple({
        elder_id: elderId.trim(),
        phone_number: caretakerPhone.trim(),
        caretaker_slot: caretakerSlot,
        full_name: caretakerName.trim() || (caretakerSlot === "1" ? "Anita Raman" : "Suresh Raman"),
      });

      if (onSelectCaregiver) {
        onSelectCaregiver(res.caregiver);
      }
    } catch (err) {
      setCaregiverError(err.message || "Failed to log in. Please check your inputs.");
    } finally {
      setCaregiverLoading(false);
    }
  };

  // Quick preset fills — phone numbers only; Senior ID must be entered manually
  const handleFillCaretaker = (slot) => {
    setCaregiverError(null);
    setCaretakerSlot(slot);
    if (slot === "1") {
      setCaretakerName("Anita Raman");
      setCaretakerPhone("+91 98401 12233");
    } else {
      setCaretakerName("Suresh Raman");
      setCaretakerPhone("+91 98409 98877");
    }
  };

  // Handle Elder Sign In
  const handleElderSubmit = (e) => {
    e.preventDefault();
    if (onSelectElder) {
      onSelectElder(elderName || "Raman");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
        color: "#0F172A",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          background: "#FFFFFF",
          borderRadius: 24,
          border: "1px solid #E2E8F0",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
        }}
      >
        {/* ─── LEFT BRAND & ILLUSTRATION PANEL ───────────────────────── */}
        <div
          style={{
            background: "#F8FAFF",
            padding: "44px 40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            borderRight: "1px solid #F1F5F9",
          }}
        >
          {/* Logo & Headline */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#4F46E5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 10px rgba(79, 70, 229, 0.25)",
                }}
              >
                <Heart size={18} fill="#FFFFFF" />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.02em" }}>
                  SeniorMind
                </div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: -2 }}>
                  Better Care, Brighter Days.
                </div>
              </div>
            </div>

            <h2
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.2,
                margin: "0 0 12px",
                letterSpacing: "-0.03em",
              }}
            >
              Because <br />
              they matter.
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "#64748B",
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 320,
              }}
            >
              Stay connected. Stay informed. <br />
              Be there when it matters.
            </p>
          </div>

          {/* Hero Illustration */}
          <div style={{ margin: "24px 0 0", textAlign: "center" }}>
            <img
              src={loginHeroImg}
              alt="Caregiver with elder"
              style={{
                width: "100%",
                maxHeight: 280,
                objectFit: "contain",
                borderRadius: 16,
              }}
            />
          </div>

          {/* Bottom Trust Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#64748B",
              paddingTop: 16,
              borderTop: "1px solid #E2E8F0",
            }}
          >
            <Shield size={14} color="#4F46E5" />
            <span>2-Caretaker safety link • Direct daily wellness reports</span>
          </div>
        </div>

        {/* ─── RIGHT LOGIN CARD ────────────────────────────────────────── */}
        <div style={{ padding: "44px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Top Role Switcher */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              background: "#F1F5F9",
              padding: 4,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={() => setRoleTab("caregiver")}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: roleTab === "caregiver" ? "#FFFFFF" : "transparent",
                color: roleTab === "caregiver" ? "#4F46E5" : "#64748B",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: roleTab === "caregiver" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Caretaker
            </button>
            <button
              type="button"
              onClick={() => setRoleTab("elder")}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: roleTab === "elder" ? "#FFFFFF" : "transparent",
                color: roleTab === "elder" ? "#2563EB" : "#64748B",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: roleTab === "elder" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Elderly (Bhavi)
            </button>
          </div>

          {/* Form Header */}
          <div style={{ marginBottom: 20 }}>
            <h3
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0F172A",
                margin: "0 0 6px",
              }}
            >
              {roleTab === "caregiver" ? "Caregiver Login" : "Elderly Person Login"}
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
              {roleTab === "caregiver"
                ? "Access your caregiver dashboard"
                : "Open Bhavi friendly voice companion"}
            </p>
          </div>

          {caregiverError && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#B91C1C",
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} />
              <span>{caregiverError}</span>
            </div>
          )}

          {/* CARETAKER LOGIN FORM */}
          {roleTab === "caregiver" ? (
            <form onSubmit={handleCaregiverSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Email or Phone Number */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Email or Phone Number
                </label>
                <input
                  type="text"
                  value={caretakerPhone}
                  onChange={(e) => setCaretakerPhone(e.target.value)}
                  placeholder="Enter your email or phone"
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: "1px solid #CBD5E1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              {/* Old Person's ID Number */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Old Person's ID Number
                </label>
                <input
                  type="text"
                  value={elderId}
                  onChange={(e) => setElderId(e.target.value)}
                  placeholder="e.g. SM-7K4P-9Q2X (from senior's Settings)"
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: "1px solid #CBD5E1",
                    fontSize: 13,
                    fontWeight: 600,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              {/* Caretaker Slot Selection */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Caretaker Slot
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div
                    onClick={() => handleFillCaretaker("1")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1.5px solid ${caretakerSlot === "1" ? "#4F46E5" : "#E2E8F0"}`,
                      background: caretakerSlot === "1" ? "#EEF2FF" : "#FFFFFF",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: caretakerSlot === "1" ? "#4F46E5" : "#64748B",
                      textAlign: "center",
                    }}
                  >
                    Caretaker 1 (Reports + Alerts)
                  </div>
                  <div
                    onClick={() => handleFillCaretaker("2")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1.5px solid ${caretakerSlot === "2" ? "#4F46E5" : "#E2E8F0"}`,
                      background: caretakerSlot === "2" ? "#EEF2FF" : "#FFFFFF",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: caretakerSlot === "2" ? "#4F46E5" : "#64748B",
                      textAlign: "center",
                    }}
                  >
                    Caretaker 2 (Alerts Only)
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 14px",
                      borderRadius: 10,
                      border: "1px solid #CBD5E1",
                      fontSize: 13,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94A3B8",
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#64748B" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: "#4F46E5" }}
                  />
                  Remember me
                </label>
                <a href="#forgot" onClick={(e) => e.preventDefault()} style={{ color: "#4F46E5", textDecoration: "none", fontWeight: 600 }}>
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={caregiverLoading}
                style={{
                  marginTop: 8,
                  padding: "12px",
                  borderRadius: 10,
                  background: "#4F46E5",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: caregiverLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                  transition: "background 0.15s ease",
                }}
              >
                {caregiverLoading ? "Logging in..." : "Login"}
              </button>

              {/* Register link footer */}
              <div style={{ textAlign: "center", fontSize: 12, color: "#64748B", marginTop: 8 }}>
                Don't have an account?{" "}
                <span style={{ color: "#4F46E5", fontWeight: 600, cursor: "pointer" }}>Register</span>
              </div>
            </form>
          ) : (
            /* ELDERLY PERSON LOGIN FORM */
            <form onSubmit={handleElderSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Senior Citizen Name
                </label>
                <input
                  type="text"
                  value={elderName}
                  onChange={(e) => setElderName(e.target.value)}
                  placeholder="Enter your name (e.g. Raman)"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #CBD5E1",
                    fontSize: 14,
                    fontWeight: 600,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 12,
                  color: "#1E40AF",
                  lineHeight: 1.5,
                }}
              >
                Opens Bhavi friendly voice companion with voice interaction, memory recall, and medication reminders.
              </div>

              <button
                type="submit"
                style={{
                  marginTop: 8,
                  padding: "12px",
                  borderRadius: 10,
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                }}
              >
                Start Bhavi Voice Assistant
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
