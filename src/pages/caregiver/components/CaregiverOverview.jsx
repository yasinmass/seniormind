import React from "react";
import {
  ShieldAlert,
  Brain,
  Clock,
  User,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  Calendar,
  Sparkles,
  ArrowRight,
  Activity,
  Heart,
  FileText,
  BadgeCheck,
  RefreshCw,
} from "lucide-react";

export default function CaregiverOverview({
  elderData,
  onNavigateTab,
  onAcknowledgeAlert,
  onRefresh,
  refreshing,
}) {
  if (!elderData) return null;

  const {
    elder_profile,
    caregiver_role,
    caregiver_role_display,
    overall_status,
    status_label,
    last_interaction,
    latest_report,
    safety_events = [],
    recent_memories = [],
    recent_activity = [],
    summary = {},
    can_view_reports = true,
  } = elderData;

  const unresolvedAlerts = safety_events.filter(
    (e) => e.status === "NEW" || e.status === "REVIEWED"
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case "CRITICAL":
        return { bg: "rgba(239, 68, 68, 0.15)", text: "#EF4444", border: "rgba(239, 68, 68, 0.3)", icon: AlertOctagon };
      case "HIGH_RISK":
        return { bg: "rgba(249, 115, 22, 0.15)", text: "#F97316", border: "rgba(249, 115, 22, 0.3)", icon: AlertTriangle };
      case "ATTENTION_REQUIRED":
        return { bg: "rgba(234, 179, 8, 0.15)", text: "#EAB308", border: "rgba(234, 179, 8, 0.3)", icon: AlertTriangle };
      default:
        return { bg: "rgba(34, 197, 94, 0.15)", text: "#22C55E", border: "rgba(34, 197, 94, 0.3)", icon: CheckCircle };
    }
  };

  const getSeverityStyle = (level) => {
    switch (level) {
      case "CRITICAL":
        return { bg: "rgba(239, 68, 68, 0.2)", text: "#F87171", border: "rgba(239, 68, 68, 0.4)" };
      case "HIGH":
        return { bg: "rgba(249, 115, 22, 0.2)", text: "#FB923C", border: "rgba(249, 115, 22, 0.4)" };
      case "MEDIUM":
        return { bg: "rgba(234, 179, 8, 0.2)", text: "#FACC15", border: "rgba(234, 179, 8, 0.4)" };
      default:
        return { bg: "rgba(59, 130, 246, 0.2)", text: "#60A5FA", border: "rgba(59, 130, 246, 0.4)" };
    }
  };

  const statusBadge = getStatusBadge(overall_status);
  const StatusIcon = statusBadge.icon;

  const formatTimeAgo = (isoString) => {
    if (!isoString) return "No recorded activity";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return isoString;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Top Elder Profile Summary Banner ─────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
        borderRadius: 20,
        padding: "24px",
        border: "1px solid #334155",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 800,
            boxShadow: "0 8px 20px rgba(37, 99, 235, 0.3)",
          }}>
            {elder_profile.display_name?.slice(0, 1) || "E"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
                {elder_profile.display_name}
              </h2>
              <span style={{
                background: "rgba(59, 130, 246, 0.15)",
                color: "#60A5FA",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}>
                ID: {elder_profile.elder_id}
              </span>
              <span style={{
                background: caregiver_role === "PRIMARY" ? "rgba(16, 185, 129, 0.15)" : "rgba(139, 92, 246, 0.15)",
                color: caregiver_role === "PRIMARY" ? "#34D399" : "#C084FC",
                border: caregiver_role === "PRIMARY" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(139, 92, 246, 0.3)",
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
              }}>
                {caregiver_role_display}
              </span>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#94A3B8" }}>
              Age {elder_profile.age || 78} • {elder_profile.location || "Chennai"} • Connected to Bhavi Voice AI
            </p>
          </div>
        </div>

        {/* Overall Status Badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: statusBadge.bg,
          border: `1px solid ${statusBadge.border}`,
          borderRadius: 16,
          padding: "12px 18px",
        }}>
          <StatusIcon size={24} color={statusBadge.text} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Overall Wellbeing Status
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: statusBadge.text }}>
              {status_label}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Stats Cards ────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 16,
      }}>
        {/* Unresolved Alerts */}
        <div style={{
          background: "#1E293B",
          borderRadius: 18,
          padding: "18px 20px",
          border: "1px solid #334155",
          cursor: "pointer",
          transition: "transform 0.15s ease",
        }}
        onClick={() => onNavigateTab("alerts")}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>Active Safety Alerts</span>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: unresolvedAlerts.length > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
              color: unresolvedAlerts.length > 0 ? "#EF4444" : "#22C55E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: unresolvedAlerts.length > 0 ? "#EF4444" : "#FFFFFF" }}>
            {summary.new_alerts || 0}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
            {summary.critical_alerts || 0} critical, {summary.high_alerts || 0} high
          </div>
        </div>

        {/* Daily Wellbeing Report */}
        <div style={{
          background: "#1E293B",
          borderRadius: 18,
          padding: "18px 20px",
          border: "1px solid #334155",
          cursor: "pointer",
        }}
        onClick={() => onNavigateTab("reports")}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>Daily Report</span>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(59, 130, 246, 0.15)",
              color: "#60A5FA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#FFFFFF" }}>
            {latest_report ? latest_report.report_date : "Pending"}
          </div>
          <div style={{ fontSize: 12, color: latest_report ? "#34D399" : "#94A3B8", marginTop: 4 }}>
            {latest_report ? `Completeness: ${latest_report.data_completeness}` : "No reports generated today"}
          </div>
        </div>

        {/* Persistent Memories */}
        <div style={{
          background: "#1E293B",
          borderRadius: 18,
          padding: "18px 20px",
          border: "1px solid #334155",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>Learned Insights</span>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(168, 85, 247, 0.15)",
              color: "#C084FC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Brain size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#FFFFFF" }}>
            {summary.total_memories || 0}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
            Preferences & routines saved
          </div>
        </div>

        {/* Last Interaction */}
        <div style={{
          background: "#1E293B",
          borderRadius: 18,
          padding: "18px 20px",
          border: "1px solid #334155",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>Last Bhavi Interaction</span>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(14, 165, 233, 0.15)",
              color: "#38BDF8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>
            {last_interaction ? formatTimeAgo(last_interaction.timestamp) : "No interactions yet"}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {last_interaction?.text ? `"${last_interaction.text}"` : "Awaiting first voice conversation"}
          </div>
        </div>
      </div>

      {/* ── Main Content Grid: Report Preview + Active Alerts ─────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: 24,
      }}>
        {/* Left Column: Daily Report Preview */}
        <div style={{
          background: "#1E293B",
          borderRadius: 20,
          padding: "24px",
          border: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(37, 99, 235, 0.15)",
                color: "#60A5FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <FileText size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#FFFFFF" }}>
                Daily Wellbeing Report
              </h3>
            </div>
            {can_view_reports && (
              <button
                type="button"
                onClick={() => onNavigateTab("reports")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#60A5FA",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                View History <ArrowRight size={14} />
              </button>
            )}
          </div>

          {!can_view_reports ? (
            <div style={{
              background: "#0F172A",
              borderRadius: 14,
              padding: "20px",
              textAlign: "center",
              color: "#94A3B8",
              fontSize: 13,
              marginTop: "auto",
              marginBottom: "auto",
            }}>
              <Info size={24} color="#F59E0B" style={{ marginBottom: 8 }} />
              <div>Daily report access is restricted to the Primary Caregiver by elder consent preferences.</div>
            </div>
          ) : latest_report ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              <div style={{
                background: "#0F172A",
                borderRadius: 14,
                padding: "16px",
                border: "1px solid #334155",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#60A5FA" }}>
                    Report for {latest_report.report_date}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: latest_report.data_completeness === "FULL" ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                    color: latest_report.data_completeness === "FULL" ? "#4ADE80" : "#FACC15",
                  }}>
                    {latest_report.data_completeness}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1", lineHeight: 1.5 }}>
                  {latest_report.summary}
                </p>
              </div>

              {latest_report.follow_up_items && latest_report.follow_up_items.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 8 }}>
                    Follow-Up Items for Caregiver:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {latest_report.follow_up_items.slice(0, 3).map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#0F172A",
                          borderRadius: 12,
                          padding: "10px 14px",
                          border: "1px solid #334155",
                          fontSize: 13,
                          color: "#E2E8F0",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: item.severity === "CRITICAL" ? "#EF4444" : item.severity === "HIGH" ? "#F97316" : "#3B82F6",
                          flexShrink: 0,
                        }} />
                        <span>{item.action || item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: "#0F172A",
              borderRadius: 14,
              padding: "24px",
              textAlign: "center",
              color: "#94A3B8",
              fontSize: 13,
              marginTop: "auto",
              marginBottom: "auto",
            }}>
              <Calendar size={28} color="#64748B" style={{ marginBottom: 10 }} />
              <div style={{ fontWeight: 600, color: "#E2E8F0", marginBottom: 4 }}>
                No report generated yet today
              </div>
              <p style={{ margin: "0 0 16px 0", fontSize: 12 }}>
                Reports summarize daily voice turns, routines, and safety items.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab("reports")}
                style={{
                  padding: "8px 16px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Generate Report Now
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Active Safety Alerts */}
        <div style={{
          background: "#1E293B",
          borderRadius: 20,
          padding: "24px",
          border: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: unresolvedAlerts.length > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                color: unresolvedAlerts.length > 0 ? "#EF4444" : "#22C55E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <ShieldAlert size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#FFFFFF" }}>
                Unresolved Alerts ({unresolvedAlerts.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("alerts")}
              style={{
                background: "transparent",
                border: "none",
                color: "#60A5FA",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              All Alerts <ArrowRight size={14} />
            </button>
          </div>

          {unresolvedAlerts.length === 0 ? (
            <div style={{
              background: "#0F172A",
              borderRadius: 14,
              padding: "28px 20px",
              textAlign: "center",
              color: "#94A3B8",
              marginTop: "auto",
              marginBottom: "auto",
            }}>
              <CheckCircle size={32} color="#22C55E" style={{ marginBottom: 10 }} />
              <div style={{ fontWeight: 700, color: "#FFFFFF", fontSize: 15, marginBottom: 4 }}>
                All Clear — No Active Concerns
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
                No unresolved safety events detected by Bhavi's monitoring.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto", maxHeight: 320 }}>
              {unresolvedAlerts.slice(0, 4).map((alert) => {
                const sevStyle = getSeverityStyle(alert.risk_level);
                return (
                  <div
                    key={alert.id}
                    style={{
                      background: "#0F172A",
                      borderRadius: 14,
                      padding: "14px",
                      border: `1px solid ${sevStyle.border}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          background: sevStyle.bg,
                          color: sevStyle.text,
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                        }}>
                          {alert.risk_level}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
                          {alert.category_display}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>
                        {formatTimeAgo(alert.created_at)}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: 12, color: "#CBD5E1", lineHeight: 1.4 }}>
                      {alert.reason || alert.relevant_text}
                    </p>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => onAcknowledgeAlert(alert.id, "REVIEWED")}
                        style={{
                          padding: "5px 12px",
                          background: "rgba(59, 130, 246, 0.2)",
                          border: "1px solid rgba(59, 130, 246, 0.4)",
                          color: "#93C5FD",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity Feed ─────────────────────────────────────────── */}
      <div style={{
        background: "#1E293B",
        borderRadius: 20,
        padding: "24px",
        border: "1px solid #334155",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34D399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Activity size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#FFFFFF" }}>
              Recent Activity & Routine Timeline
            </h3>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#94A3B8",
              borderRadius: 10,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {recent_activity.length === 0 ? (
          <div style={{
            background: "#0F172A",
            borderRadius: 14,
            padding: "24px",
            textAlign: "center",
            color: "#94A3B8",
            fontSize: 13,
          }}>
            No activity recorded yet for {elder_profile.display_name}. Activity appears as conversations occur with Bhavi.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recent_activity.slice(0, 8).map((act, idx) => (
              <div
                key={act.id || idx}
                style={{
                  background: "#0F172A",
                  borderRadius: 12,
                  padding: "12px 16px",
                  border: "1px solid #334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: act.type === "safety_event" ? "rgba(239, 68, 68, 0.15)" : "rgba(168, 85, 247, 0.15)",
                    color: act.type === "safety_event" ? "#EF4444" : "#C084FC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {act.type === "safety_event" ? <ShieldAlert size={16} /> : <Brain size={16} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
                      {act.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                      {act.subtitle}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap" }}>
                  {formatTimeAgo(act.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
