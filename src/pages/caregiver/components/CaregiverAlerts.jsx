import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  Filter,
  Check,
  Send,
  Info,
  BadgeCheck,
} from "lucide-react";
import { caregiverApi } from "../api/caregiverApi";

export default function CaregiverAlerts({ elderId, elderName, onAcknowledgeAlert, onRefreshOverview }) {
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeSubTab, setActiveSubTab] = useState("alerts"); // 'alerts' | 'notifications'

  const fetchAlertsAndNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsRes, notifsRes] = await Promise.all([
        caregiverApi.getElderAlerts(elderId, { severity: severityFilter, status: statusFilter }),
        caregiverApi.getNotifications(),
      ]);
      setAlerts(alertsRes.alerts || []);
      setNotifications(notifsRes.notifications || []);
    } catch (err) {
      setError(err.message || "Failed to load safety alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (elderId) {
      fetchAlertsAndNotifications();
    }
  }, [elderId, severityFilter, statusFilter]);

  const handleUpdateStatus = async (alertId, newStatus) => {
    try {
      await caregiverApi.acknowledgeAlert(alertId, newStatus);
      fetchAlertsAndNotifications();
      if (onRefreshOverview) onRefreshOverview();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleConfirmEvent = async (alertId, currentConfirmed) => {
    try {
      await caregiverApi.confirmAlert(alertId, !currentConfirmed);
      fetchAlertsAndNotifications();
      if (onRefreshOverview) onRefreshOverview();
    } catch (err) {
      console.error("Failed to confirm event:", err);
    }
  };

  const getSeverityBadge = (level) => {
    switch (level) {
      case "CRITICAL":
        return { bg: "rgba(239, 68, 68, 0.2)", text: "#F87171", border: "rgba(239, 68, 68, 0.4)", icon: AlertOctagon };
      case "HIGH":
        return { bg: "rgba(249, 115, 22, 0.2)", text: "#FB923C", border: "rgba(249, 115, 22, 0.4)", icon: AlertTriangle };
      case "MEDIUM":
        return { bg: "rgba(234, 179, 8, 0.2)", text: "#FACC15", border: "rgba(234, 179, 8, 0.4)", icon: AlertTriangle };
      default:
        return { bg: "rgba(59, 130, 246, 0.2)", text: "#60A5FA", border: "rgba(59, 130, 246, 0.4)", icon: Info };
    }
  };

  const getStatusBadge = (status, isConfirmed) => {
    if (status === "RESOLVED") {
      return { bg: "rgba(34, 197, 94, 0.15)", text: "#4ADE80", label: "Resolved" };
    }
    if (status === "REVIEWED") {
      return {
        bg: isConfirmed ? "rgba(239, 68, 68, 0.15)" : "rgba(234, 179, 8, 0.15)",
        text: isConfirmed ? "#F87171" : "#FACC15",
        label: isConfirmed ? "Confirmed Issue" : "Under Review (Suspected)",
      };
    }
    return { bg: "rgba(249, 115, 22, 0.15)", text: "#FB923C", label: "New / Unreviewed" };
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return isoString;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header & Sub-tabs */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
            Safety Alerts & Emergency Dispatch
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>
            Monitoring safety incidents for <strong>{elderName || "Elder"}</strong> detected by Bhavi's risk analyzer
          </p>
        </div>

        <div style={{
          display: "flex",
          background: "#1E293B",
          borderRadius: 12,
          padding: 4,
          border: "1px solid #334155",
        }}>
          <button
            type="button"
            onClick={() => setActiveSubTab("alerts")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: activeSubTab === "alerts" ? "#2563EB" : "transparent",
              color: activeSubTab === "alerts" ? "#FFFFFF" : "#94A3B8",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Alerts List ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("notifications")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: activeSubTab === "notifications" ? "#2563EB" : "transparent",
              color: activeSubTab === "notifications" ? "#FFFFFF" : "#94A3B8",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Send size={14} /> Simulated Dispatch Logs ({notifications.length})
          </button>
        </div>
      </div>

      {activeSubTab === "alerts" ? (
        <>
          {/* Filters Bar */}
          <div style={{
            background: "#1E293B",
            borderRadius: 16,
            padding: "16px 20px",
            border: "1px solid #334155",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", display: "flex", alignItems: "center", gap: 6 }}>
                <Filter size={15} /> Severity:
              </span>
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: severityFilter === sev ? "1px solid #3B82F6" : "1px solid #334155",
                    background: severityFilter === sev ? "rgba(59, 130, 246, 0.2)" : "#0F172A",
                    color: severityFilter === sev ? "#60A5FA" : "#94A3B8",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8" }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: "#0F172A",
                  border: "1px solid #334155",
                  color: "#FFFFFF",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  outline: "none",
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="NEW">New (Unreviewed)</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>

          {/* Alerts Content */}
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
              Loading safety alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div style={{
              background: "#1E293B",
              borderRadius: 20,
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #334155",
            }}>
              <CheckCircle size={40} color="#22C55E" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>
                No Matching Safety Alerts
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>
                No safety events match the selected filters.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {alerts.map((alert) => {
                const sevBadge = getSeverityBadge(alert.risk_level);
                const statBadge = getStatusBadge(alert.status, alert.is_confirmed);
                const SevIcon = sevBadge.icon;

                return (
                  <div
                    key={alert.id}
                    style={{
                      background: "#1E293B",
                      borderRadius: 18,
                      padding: "20px 24px",
                      border: `1px solid ${sevBadge.border}`,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {/* Header Row */}
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{
                          background: sevBadge.bg,
                          color: sevBadge.text,
                          padding: "4px 10px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}>
                          <SevIcon size={14} /> {alert.risk_level}
                        </span>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>
                          {alert.category_display} Concern
                        </h4>
                        <span style={{
                          background: statBadge.bg,
                          color: statBadge.text,
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {statBadge.label}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: "#94A3B8" }}>
                        Detected {formatTime(alert.created_at)}
                      </div>
                    </div>

                    {/* Explanation */}
                    <div style={{
                      background: "#0F172A",
                      padding: "14px 16px",
                      borderRadius: 12,
                      border: "1px solid #334155",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", marginBottom: 4, textTransform: "uppercase" }}>
                        Why this alert was created:
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: "#F1F5F9", lineHeight: 1.5 }}>
                        {alert.reason || "Safety risk detected during voice conversation analysis."}
                      </p>
                      {alert.relevant_text && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>
                          Transcript excerpt: "{alert.relevant_text}"
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      paddingTop: 8,
                      borderTop: "1px solid rgba(51, 65, 85, 0.6)",
                    }}>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>
                        {alert.reviewed_by ? (
                          <span>Reviewed by <strong>{alert.reviewed_by}</strong> on {formatTime(alert.reviewed_at)}</span>
                        ) : (
                          <span>Awaiting caregiver review</span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {/* Toggle Confirm / Suspected */}
                        <button
                          type="button"
                          onClick={() => handleConfirmEvent(alert.id, alert.is_confirmed)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            border: alert.is_confirmed ? "1px solid #EF4444" : "1px solid #475569",
                            background: alert.is_confirmed ? "rgba(239, 68, 68, 0.15)" : "#0F172A",
                            color: alert.is_confirmed ? "#FCA5A5" : "#94A3B8",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <BadgeCheck size={14} />
                          {alert.is_confirmed ? "Confirmed Issue" : "Mark Confirmed"}
                        </button>

                        {alert.status !== "REVIEWED" && alert.status !== "RESOLVED" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(alert.id, "REVIEWED")}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 8,
                              border: "1px solid #3B82F6",
                              background: "rgba(59, 130, 246, 0.2)",
                              color: "#93C5FD",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Mark Reviewed
                          </button>
                        )}

                        {alert.status !== "RESOLVED" ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(alert.id, "RESOLVED")}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 8,
                              border: "none",
                              background: "#16A34A",
                              color: "#FFFFFF",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Check size={14} /> Resolve Alert
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(alert.id, "REVIEWED")}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 8,
                              border: "1px solid #475569",
                              background: "transparent",
                              color: "#94A3B8",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Simulated Dispatch Logs */
        <div style={{
          background: "#1E293B",
          borderRadius: 20,
          padding: "24px",
          border: "1px solid #334155",
        }}>
          <div style={{
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 20,
            fontSize: 13,
            color: "#93C5FD",
            lineHeight: 1.5,
          }}>
            <strong>Simulated Multi-Channel Notification Provider:</strong> External SMS and Email credentials are not required for local testing. All critical alerts trigger real DB dispatch records shown below with clear simulated markers.
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
              No notification logs recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    background: "#0F172A",
                    borderRadius: 14,
                    padding: "16px 20px",
                    border: "1px solid #334155",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: notif.channel.includes("SMS") ? "rgba(234, 179, 8, 0.15)" : notif.channel.includes("EMAIL") ? "rgba(168, 85, 247, 0.15)" : "rgba(59, 130, 246, 0.15)",
                        color: notif.channel.includes("SMS") ? "#FACC15" : notif.channel.includes("EMAIL") ? "#C084FC" : "#60A5FA",
                      }}>
                        {notif.channel_display}
                      </span>
                      <strong style={{ fontSize: 14, color: "#FFFFFF" }}>{notif.title}</strong>
                    </div>
                    <span style={{ fontSize: 11, color: "#64748B" }}>
                      {formatTime(notif.created_at)}
                    </span>
                  </div>
                  <pre style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#CBD5E1",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    background: "rgba(15, 23, 42, 0.5)",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #1E293B",
                  }}>
                    {notif.message}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
