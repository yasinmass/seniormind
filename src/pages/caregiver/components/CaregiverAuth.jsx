import React, { useState } from "react";
import {
  Shield,
  User,
  Lock,
  Phone,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  AlertCircle,
  HeartHandshake,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { caregiverApi } from "../api/caregiverApi";

export default function CaregiverAuth({ onAuthSuccess, onBackToPortal }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "register") {
        if (!fullName.trim()) throw new Error("Please enter your full name.");
        if (!username.trim()) throw new Error("Please choose a username.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");

        const res = await caregiverApi.register({
          username: username.trim(),
          password,
          full_name: fullName.trim(),
          email: email.trim(),
          phone_number: phone.trim(),
        });
        setSuccessMsg("Account registered successfully! Redirecting...");
        setTimeout(() => {
          onAuthSuccess(res.caregiver);
        }, 600);
      } else {
        if (!username.trim() || !password) {
          throw new Error("Please enter your username and password.");
        }
        const res = await caregiverApi.login({
          username: username.trim(),
          password,
        });
        onAuthSuccess(res.caregiver);
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (role) => {
    setError(null);
    if (role === "anita") {
      setUsername("caregiver_anita");
      setPassword("password123");
      setFullName("Anita Raman");
      setEmail("anita@example.com");
      setPhone("+91 98401 12233");
    } else if (role === "suresh") {
      setUsername("caregiver_suresh");
      setPassword("password123");
      setFullName("Suresh Raman");
      setEmail("suresh@example.com");
      setPhone("+91 98409 98877");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
      color: "#F8FAFC",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {onBackToPortal && (
        <div style={{ width: "100%", maxWidth: 480, marginBottom: 12 }}>
          <button
            type="button"
            onClick={onBackToPortal}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 0",
            }}
          >
            ← Back to Portal Selection
          </button>
        </div>
      )}
      <div style={{
        width: "100%",
        maxWidth: 480,
        background: "#1E293B",
        borderRadius: 24,
        border: "1px solid rgba(148, 163, 184, 0.15)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
          padding: "32px 28px 24px",
          textAlign: "center",
          position: "relative",
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 18,
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
            marginBottom: 12,
            boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
          }}>
            <HeartHandshake size={32} color="#FFFFFF" strokeWidth={2.2} />
          </div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
            SeniorMind Caregiver Portal
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255, 255, 255, 0.85)", fontWeight: 500 }}>
            Family & Caregiver Wellbeing Intelligence for Bhavi
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid #334155",
          background: "#0F172A",
        }}>
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            style={{
              flex: 1,
              padding: "14px 16px",
              background: mode === "login" ? "#1E293B" : "transparent",
              color: mode === "login" ? "#60A5FA" : "#94A3B8",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              borderBottom: mode === "login" ? "3px solid #3B82F6" : "3px solid transparent",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <LogIn size={16} /> Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            style={{
              flex: 1,
              padding: "14px 16px",
              background: mode === "register" ? "#1E293B" : "transparent",
              color: mode === "register" ? "#60A5FA" : "#94A3B8",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              borderBottom: mode === "register" ? "3px solid #3B82F6" : "3px solid transparent",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <UserPlus size={16} /> New Registration
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "28px" }}>
          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#FCA5A5",
              borderRadius: 12,
              padding: "12px 14px",
              fontSize: 13,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              color: "#86EFAC",
              borderRadius: 12,
              padding: "12px 14px",
              fontSize: 13,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{successMsg}</div>
            </div>
          )}

          {mode === "register" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
                  Full Name *
                </label>
                <div style={{ position: "relative" }}>
                  <User size={18} color="#94A3B8" style={{ position: "absolute", left: 14, top: 13 }} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Anita Raman"
                    required
                    style={{
                      width: "100%",
                      padding: "12px 14px 12px 42px",
                      background: "#0F172A",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      color: "#FFFFFF",
                      fontSize: 14,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
                    Phone Number
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91..."
                      style={{
                        width: "100%",
                        padding: "12px 10px 12px 36px",
                        background: "#0F172A",
                        border: "1px solid #334155",
                        borderRadius: 12,
                        color: "#FFFFFF",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
                    Email Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@mail.com"
                      style={{
                        width: "100%",
                        padding: "12px 10px 12px 36px",
                        background: "#0F172A",
                        border: "1px solid #334155",
                        borderRadius: 12,
                        color: "#FFFFFF",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
              Username or ID *
            </label>
            <div style={{ position: "relative" }}>
              <User size={18} color="#94A3B8" style={{ position: "absolute", left: 14, top: 13 }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="caregiver username"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px 12px 42px",
                  background: "#0F172A",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  color: "#FFFFFF",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
              Password *
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={18} color="#94A3B8" style={{ position: "absolute", left: 14, top: 13 }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%",
                  padding: "12px 42px 12px 42px",
                  background: "#0F172A",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  color: "#FFFFFF",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "#64748B" : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
              transition: "transform 0.1s ease, filter 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : mode === "login" ? (
              <>
                <LogIn size={18} /> Sign In to Dashboard
              </>
            ) : (
              <>
                <UserPlus size={18} /> Complete Registration
              </>
            )}
          </button>

          {/* Quick Demo Credentials Helpers */}
          <div style={{
            marginTop: 24,
            padding: "14px 16px",
            background: "rgba(15, 23, 42, 0.6)",
            borderRadius: 14,
            border: "1px dashed #334155",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "#94A3B8",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              <Sparkles size={14} color="#60A5FA" /> Quick Demo Accounts:
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleDemoFill("anita")}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  background: "#1E293B",
                  border: "1px solid #475569",
                  borderRadius: 10,
                  color: "#E2E8F0",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Caregiver 1 (Primary)
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill("suresh")}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  background: "#1E293B",
                  border: "1px solid #475569",
                  borderRadius: 10,
                  color: "#E2E8F0",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Caregiver 2 (Secondary)
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
