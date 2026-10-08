import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Brain,
  Clock,
  User,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  Heart,
  Calendar,
  Sparkles,
  Search,
  Filter,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function CaregiverDashboard({ onSwitchRole }) {
  const { theme } = useTheme();
  const [userIdentifier, setUserIdentifier] = useState("default_user");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState("ALL");

  const fetchOverview = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/caregiver/${encodeURIComponent(userIdentifier)}/overview/`
      );
      if (!res.ok) {
        throw new Error(`Failed to load caregiver data (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json.status === "ok") {
        setData(json);
      } else {
        throw new Error(json.error || "Failed to parse caregiver payload");
      }
    } catch (err) {
      console.error("[CaregiverDashboard] Fetch error:", err);
      setError("Unable to connect to Bhavi backend service. Please check server connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [userIdentifier]);

  const handleUpdateEventStatus = async (eventId, newStatus) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/safety-events/${eventId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchOverview(true);
      }
    } catch (err) {
      console.error("[CaregiverDashboard] Update event status failed:", err);
    }
  };

  // Helper formatting for timestamps
  const formatTime = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return isoString;
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      }
      return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return isoString;
    }
  };

  // Severity styles generator
  const getSeverityStyle = (level) => {
    switch (level) {
      case "CRITICAL":
        return {
          bg: "#FEF2F2",
          border: "#FECACA",
          text: "#991B1B",
          badgeBg: "#EF4444",
          badgeText: "#FFFFFF",
          icon: AlertOctagon,
        };
      case "HIGH":
        return {
          bg: "#FFF1F2",
          border: "#FFE4E6",
          text: "#9F1239",
          badgeBg: "#E11D48",
          badgeText: "#FFFFFF",
          icon: AlertTriangle,
        };
      case "MEDIUM":
        return {
          bg: "#FFFBEB",
          border: "#FDE68A",
          text: "#92400E",
          badgeBg: "#F59E0B",
          badgeText: "#FFFFFF",
          icon: ShieldAlert,
        };
      case "LOW":
      default:
        return {
          bg: "#F0FDF4",
          border: "#BBF7D0",
          text: "#166534",
          badgeBg: "#10B981",
          badgeText: "#FFFFFF",
          icon: CheckCircle,
        };
    }
  };

  // Category Icon / Emoji helper
  const getCategoryEmoji = (category) => {
    switch (category) {
      case "MEDICATION":
        return "💊 Medication";
      case "FALL":
        return "🚨 Fall Alert";
      case "MEDICAL":
        return "🩺 Medical";
      case "CONFUSION":
        return "🧠 Confusion";
      case "EMOTIONAL_DISTRESS":
        return "💙 Emotional";
      case "SELF_HARM":
        return "⚠️ Crisis";
      case "SAFETY":
        return "🛡️ Safety";
      case "EMERGENCY":
        return "🆘 Emergency";
      default:
        return "📋 General";
    }
  };

  const getMemoryCategoryEmoji = (type) => {
    switch (type) {
      case "family":
        return "👨‍👩‍👧 Family";
      case "preference":
        return "🍛 Preference";
      case "interest":
        return "🎵 Interest";
      case "lifestyle":
        return "🏠 Lifestyle";
      default:
        return "💡 Fact";
    }
  };

  const overallStatus = data?.overall_status || "STABLE";
  const elderProfile = data?.elder_profile || { name: "Raj Kumar", age: 78, location: "Chennai" };
  const safetyEvents = data?.safety_events || [];
  const memories = data?.recent_memories || [];
  const activity = data?.recent_activity || [];
  const summary = data?.summary || { total_alerts: 0, critical_alerts: 0, high_alerts: 0, medium_alerts: 0, total_memories: 0 };

  const filteredEvents = safetyEvents.filter((ev) => {
    if (filterSeverity === "ALL") return true;
    return ev.risk_level === filterSeverity;
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        color: "#0F172A",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: "24px 16px 48px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ── Top Header / Role Switcher Navigation ───────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
            padding: "16px 24px",
            background: "#FFFFFF",
            borderRadius: 20,
            boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
            border: "1px solid #E2E8F0",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFF",
                  fontWeight: 700,
                  fontSize: 20,
                }}
              >
                🩺
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>
                  Bhavi Caregiver Dashboard
                </h1>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                  Real-time safety monitoring & elder care insights
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => fetchOverview(true)}
              disabled={refreshing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 12,
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#334155",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            {onSwitchRole && (
              <button
                onClick={onSwitchRole}
                style={{
                  padding: "8px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                }}
              >
                👴 Switch to Elder Voice View
              </button>
            )}
          </div>
        </div>

        {/* ── Error Banner ────────────────────────────────────────────────── */}
        {error && (
          <div
            style={{
              padding: "14px 20px",
              borderRadius: 16,
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              color: "#991B1B",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <AlertOctagon size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Elder Profile & Overall Status Hero ─────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* Elder Profile Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
              border: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 16 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    background: "linear-gradient(135deg, #E0F2FE, #BAE6FD)",
                    color: "#0369A1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    fontWeight: 700,
                  }}
                >
                  👴
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    MONITORED ELDER
                  </span>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "2px 0 4px" }}>
                    {elderProfile.name}
                  </h2>
                  <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                    Age {elderProfile.age} • {elderProfile.location}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>USER ID</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{elderProfile.user_identifier}</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid #F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#64748B" }}>Last interaction with Bhavi:</span>
              <span style={{ fontWeight: 700, color: "#0F172A" }}>
                {data?.last_interaction ? formatDate(data.last_interaction.timestamp) : "No interaction today"}
              </span>
            </div>
          </div>

          {/* Overall Health & Safety Status Card */}
          <div
            style={{
              background:
                overallStatus === "CRITICAL"
                  ? "linear-gradient(135deg, #991B1B, #7F1D1D)"
                  : overallStatus === "HIGH_RISK"
                  ? "linear-gradient(135deg, #BE123C, #9E1140)"
                  : overallStatus === "ATTENTION_REQUIRED"
                  ? "linear-gradient(135deg, #D97706, #B45309)"
                  : "linear-gradient(135deg, #059669, #047857)",
              borderRadius: 20,
              padding: 24,
              color: "#FFFFFF",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  OVERALL SAFETY STATUS
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "rgba(255, 255, 255, 0.2)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  Live Pipeline Active
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                <div style={{ fontSize: 32 }}>
                  {overallStatus === "CRITICAL"
                    ? "🔴"
                    : overallStatus === "HIGH_RISK"
                    ? "🚨"
                    : overallStatus === "ATTENTION_REQUIRED"
                    ? "🟠"
                    : "🟢"}
                </div>
                <div>
                  <h3 style={{ fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                    {data?.status_label || "Stable"}
                  </h3>
                  <p style={{ fontSize: 13, opacity: 0.9, margin: "2px 0 0" }}>
                    {overallStatus === "STABLE"
                      ? "No active safety risks detected in recent conversations."
                      : `${summary.new_alerts || summary.total_alerts} alert(s) require caregiver attention.`}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255, 255, 255, 0.2)", display: "flex", gap: 20 }}>
              <div>
                <span style={{ fontSize: 11, opacity: 0.85 }}>CRITICAL</span>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{summary.critical_alerts}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, opacity: 0.85 }}>HIGH / MEDIUM</span>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{summary.high_alerts + summary.medium_alerts}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, opacity: 0.85 }}>MEMORIES SAVED</span>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{summary.total_memories}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content Grid: Safety Alerts + Insights/Memories ────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 24,
            marginBottom: 28,
          }}
        >
          {/* SECTION 1: Safety Alerts */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
              border: "1px solid #E2E8F0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ShieldAlert size={22} color="#DC2626" />
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0F172A" }}>
                  Safety Alerts ({safetyEvents.length})
                </h3>
              </div>

              {/* Severity Filter */}
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                }}
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Empty State */}
            {filteredEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 16px", color: "#64748B" }}>
                <CheckCircle size={40} color="#10B981" style={{ marginBottom: 10, opacity: 0.9 }} />
                <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "#1E293B" }}>
                  No Safety Alerts
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  No potential safety or medical risks detected for this elder.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {filteredEvents.map((ev) => {
                  const style = getSeverityStyle(ev.risk_level);
                  const IconComp = style.icon;

                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        background: style.bg,
                        border: `1px solid ${style.border}`,
                        transition: "transform 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 20,
                              background: style.badgeBg,
                              color: style.badgeText,
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: 0.5,
                            }}
                          >
                            {ev.risk_level}
                          </span>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 20,
                              background: "#FFFFFF",
                              border: "1px solid #CBD5E1",
                              color: "#334155",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {getCategoryEmoji(ev.category)}
                          </span>
                        </div>

                        <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                          {formatTime(ev.created_at)}
                        </span>
                      </div>

                      {/* Excerpt / Reason */}
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: style.text, margin: "0 0 4px" }}>
                          "{ev.relevant_text || ev.reason}"
                        </p>
                        {ev.reason && ev.relevant_text && ev.reason !== ev.relevant_text && (
                          <p style={{ fontSize: 12, color: "#475569", margin: 0, fontStyle: "italic" }}>
                            Insight: {ev.reason}
                          </p>
                        )}
                      </div>

                      {/* Card Action Controls */}
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 10,
                          borderTop: "1px dashed rgba(0,0,0,0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: ev.status === "NEW" ? "#DC2626" : "#64748B" }}>
                          Status: {ev.status}
                        </span>

                        <div style={{ display: "flex", gap: 6 }}>
                          {ev.status === "NEW" && (
                            <button
                              onClick={() => handleUpdateEventStatus(ev.id, "REVIEWED")}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 8,
                                border: "1px solid #CBD5E1",
                                background: "#FFFFFF",
                                color: "#334155",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Mark Reviewed
                            </button>
                          )}
                          {ev.status !== "RESOLVED" && (
                            <button
                              onClick={() => handleUpdateEventStatus(ev.id, "RESOLVED")}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 8,
                                border: "none",
                                background: "#10B981",
                                color: "#FFFFFF",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: Persistent User Memories / Insights */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
              border: "1px solid #E2E8F0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Brain size={22} color="#2563EB" />
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0F172A" }}>
                  Extracted Memory Insights ({memories.length})
                </h3>
              </div>
            </div>

            {/* Empty State */}
            {memories.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 16px", color: "#64748B" }}>
                <Sparkles size={40} color="#3B82F6" style={{ marginBottom: 10, opacity: 0.8 }} />
                <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "#1E293B" }}>
                  No Insights Saved Yet
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  As Raj Kumar speaks to Bhavi, personal facts & preferences will automatically appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {memories.map((mem) => (
                  <div
                    key={mem.id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "#DBEAFE",
                          color: "#1E40AF",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {getMemoryCategoryEmoji(mem.memory_type)}
                      </span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>
                        {formatDate(mem.updated_at)}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "capitalize" }}>
                        {mem.key.replace(/_/g, " ")}:
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                        "{mem.value}"
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 3: Recent Care Activity Timeline ───────────────────── */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
            border: "1px solid #E2E8F0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 18,
              paddingBottom: 14,
              borderBottom: "1px solid #F1F5F9",
            }}
          >
            <Clock size={22} color="#0EA5E9" />
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0F172A" }}>
              Recent Activity Timeline
            </h3>
          </div>

          {activity.length === 0 ? (
            <p style={{ color: "#64748B", fontSize: 14, textAlign: "center", margin: "20px 0" }}>
              No recent activity logged.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {activity.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: item.type === "safety_event" ? "#FFF1F2" : "#F8FAFC",
                    border: "1px solid #F1F5F9",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: item.type === "safety_event" ? "#FFE4E6" : "#E0F2FE",
                      color: item.type === "safety_event" ? "#E11D48" : "#0284C7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {item.type === "safety_event" ? "🚨" : "💡"}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        {item.title}
                      </h4>
                      <span style={{ fontSize: 11, color: "#64748B" }}>{formatDate(item.timestamp)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#475569", margin: "2px 0 0" }}>
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
